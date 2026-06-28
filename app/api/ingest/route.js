import { Pinecone } from "@pinecone-database/pinecone";

const EMBED_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents";
const VIN_URL = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues";
const MODELS_URL = "https://api.nhtsa.gov/products/vehicle/models";
const COMPLAINTS_URL = "https://api.nhtsa.gov/complaints/complaintsByVehicle";

// keep the seed quota safe: only the most recent complaints per vehicle
const MAX_COMPLAINTS = 25;

function titleCase(s) {
  // capitalize each word, including after a hyphen (MERCEDES-BENZ -> Mercedes-Benz)
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// turn a VIN into make/model/year with NHTSA's free vPIC decoder
async function decodeVin(vin) {
  const res = await fetch(`${VIN_URL}/${encodeURIComponent(vin)}?format=json`);
  const data = await res.json();
  const r = data.Results?.[0];
  const year = Number(r?.ModelYear);
  if (!r || !r.Make || !r.Model || !Number.isInteger(year)) return null;
  // vPIC returns the make in all caps, tidy it to match how the seed stores cars
  return { make: titleCase(r.Make), model: r.Model, year };
}

// NHTSA's complaints API uses its own model names (the F-150 is filed under body
// styles like "F-150 SUPERCAB"). Ask which complaint models exist for this make and
// year, then pick the closest one to what the user typed.
async function resolveModel(make, model, year) {
  try {
    const res = await fetch(
      `${MODELS_URL}?modelYear=${year}&make=${encodeURIComponent(make)}&issueType=c`
    );
    const data = await res.json();
    const names = (data.results || []).map((r) => r.model);
    if (names.length === 0) return model;

    const want = model.toUpperCase();
    const exact = names.find((n) => n.toUpperCase() === want);
    if (exact) return exact;

    // e.g. "F-150" -> "F-150 SUPERCAB"; pick the shortest name that contains it
    const partial = names
      .filter((n) => n.toUpperCase().includes(want) || want.includes(n.toUpperCase()))
      .sort((a, b) => a.length - b.length);
    return partial[0] || model;
  } catch {
    return model;
  }
}

async function getComplaints(make, model, year) {
  const res = await fetch(
    `${COMPLAINTS_URL}?make=${encodeURIComponent(make)}&model=${encodeURIComponent(
      model
    )}&modelYear=${year}`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.results || [];
}

// complaints are dated MM/DD/YYYY; turn that into a number so we can sort newest first
function complaintDate(s) {
  const [m, d, y] = (s || "").split("/");
  return new Date(Number(y), Number(m) - 1, Number(d)).getTime() || 0;
}

// embed the same way load.ipynb did, so new vehicles sit in the same space as the seed
async function embedBatch(texts) {
  const res = await fetch(EMBED_URL, {
    method: "POST",
    headers: {
      "x-goog-api-key": process.env.GEMINI_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: texts.map((text) => ({
        model: "models/gemini-embedding-001",
        content: { parts: [{ text }] },
        outputDimensionality: 768,
      })),
    }),
  });
  const data = await res.json();
  return data.embeddings.map((e) => e.values);
}

// put the car name in the embedded text so "Mercedes problems" matches the right car
function embedText(r) {
  return `${r.year} ${r.make} ${r.model} - ${r.components.join(", ")}. ${r.summary}`;
}

// Fetch a vehicle's recent NHTSA complaints, embed them, and upsert to Pinecone.
// Shared with the chat route's auto-ingest. The complaint's odiNumber is the vector id,
// so re-adding a vehicle updates in place instead of creating duplicates.
export async function ingestVehicle({ make, model, year }) {
  const queryModel = await resolveModel(make, model, year);
  const complaints = (await getComplaints(make, queryModel, year))
    .filter((c) => (c.summary || "").trim())
    .sort((a, b) => complaintDate(b.dateComplaintFiled) - complaintDate(a.dateComplaintFiled))
    .slice(0, MAX_COMPLAINTS);

  if (complaints.length === 0) {
    return { make, model, year, count: 0 };
  }

  const records = complaints.map((c) => ({
    id: String(c.odiNumber),
    make,
    model,
    year,
    components: (c.components || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
    date: c.dateComplaintFiled || "",
    crash: Boolean(c.crash),
    fire: Boolean(c.fire),
    injuries: c.numberOfInjuries || 0,
    deaths: c.numberOfDeaths || 0,
    summary: c.summary.trim(),
  }));

  const embeddings = await embedBatch(records.map(embedText));
  const vectors = records.map((r, i) => ({
    id: r.id,
    values: embeddings[i],
    metadata: {
      make: r.make,
      model: r.model,
      year: r.year,
      components: r.components,
      date: r.date,
      crash: r.crash,
      fire: r.fire,
      injuries: r.injuries,
      deaths: r.deaths,
      summary: r.summary,
    },
  }));

  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  const index = pc.index(process.env.PINECONE_INDEX);
  await index.upsert(vectors);

  return { make, model, year, count: vectors.length };
}

export async function POST(req) {
  const { make, model, year, vin } = await req.json();

  let vehicle = null;
  if (vin && vin.trim()) {
    vehicle = await decodeVin(vin.trim());
    if (!vehicle) {
      return Response.json(
        { error: "Could not read that VIN. Check it and try again." },
        { status: 400 }
      );
    }
  } else if (make && model && year) {
    const y = Number(year);
    if (!Number.isInteger(y) || y < 1900) {
      return Response.json(
        { error: "Enter a make, model, and year, or paste a VIN." },
        { status: 400 }
      );
    }
    vehicle = { make: make.trim(), model: model.trim(), year: y };
  } else {
    return Response.json(
      { error: "Enter a make, model, and year, or paste a VIN." },
      { status: 400 }
    );
  }

  try {
    const result = await ingestVehicle(vehicle);
    return Response.json(result);
  } catch {
    return Response.json(
      { error: "Something went wrong adding that vehicle. Please try again." },
      { status: 500 }
    );
  }
}
