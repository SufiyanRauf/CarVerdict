import { Pinecone } from "@pinecone-database/pinecone";
import { ingestVehicle } from "../ingest/route";

const EMBED_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent";
const GENERATE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const SAFETY_LIST = "https://api.nhtsa.gov/SafetyRatings/modelyear";
const SAFETY_ID = "https://api.nhtsa.gov/SafetyRatings/VehicleId";

// used when the user compares cars by name without giving a year ("Camry vs Accord")
const DEFAULT_YEAR = 2020;

// Capitalize the first letter of each word but leave existing capitals alone, so the
// seeded names that aren't plain title case still match (CR-V, RAV4, F-150).
function titleCase(s) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

async function embedOne(text) {
  const res = await fetch(EMBED_URL, {
    method: "POST",
    headers: {
      "x-goog-api-key": process.env.GEMINI_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "models/gemini-embedding-001",
      content: { parts: [{ text }] },
      outputDimensionality: 768,
    }),
  });
  const data = await res.json();
  return data.embedding.values;
}

// NCAP overall safety stars (a two-step lookup): find the vehicle id, then its rating.
// Returns a number, or null when NHTSA has no rating for that car.
async function fetchStars(make, model, year) {
  try {
    const listRes = await fetch(
      `${SAFETY_LIST}/${year}/make/${encodeURIComponent(make)}/model/${encodeURIComponent(model)}`
    );
    if (!listRes.ok) return null;
    const list = await listRes.json();
    if (!list.Count || !list.Results?.length) return null;

    const detRes = await fetch(`${SAFETY_ID}/${list.Results[0].VehicleId}`);
    if (!detRes.ok) return null;
    const overall = Number((await detRes.json()).Results?.[0]?.OverallRating);
    return Number.isFinite(overall) && overall > 0 ? overall : null;
  } catch {
    return null;
  }
}

// is this exact vehicle already in the index?
async function hasVehicle(index, vector, v) {
  const res = await index.query({
    topK: 1,
    vector,
    includeMetadata: false,
    filter: { make: { $eq: v.make }, model: { $eq: v.model }, year: { $eq: v.year } },
  });
  return res.matches.length > 0;
}

// pull all of a vehicle's stored complaints (there are at most ~25 per car, so a
// filtered query with a generous topK returns the whole set regardless of the vector)
async function vehicleComplaints(index, vector, v) {
  const res = await index.query({
    topK: 50,
    vector,
    includeMetadata: true,
    filter: { make: { $eq: v.make }, model: { $eq: v.model }, year: { $eq: v.year } },
  });
  return res.matches || [];
}

// count how often each part shows up across a vehicle's complaints, most common first
function countComponents(matches) {
  const counts = {};
  for (const m of matches) {
    const comps = Array.isArray(m.metadata?.components) ? m.metadata.components : [];
    for (const c of comps) counts[c] = (counts[c] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([component, count]) => ({ component, count }))
    .sort((a, b) => b.count - a.count);
}

// Compare two or more vehicles. Auto-ingests any that aren't in the index yet, then
// returns per-vehicle stats (complaint count, top components, NCAP stars). Shared by
// this route (the Compare page) and the chat route's in-chat comparison.
export async function compareVehicles(rawVehicles) {
  const vehicles = rawVehicles.map((v) => ({
    make: titleCase(String(v.make || "").trim()),
    model: titleCase(String(v.model || "").trim()),
    year: v.year ? Number(v.year) : DEFAULT_YEAR,
  }));

  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  const index = pc.index(process.env.PINECONE_INDEX);
  const vector = await embedOne("vehicle owner complaints and reliability");

  // fetch any missing vehicles from NHTSA before we compare
  let ingestedAny = false;
  for (const v of vehicles) {
    if (!(await hasVehicle(index, vector, v))) {
      const result = await ingestVehicle(v);
      if (result.count > 0) ingestedAny = true;
    }
  }
  if (ingestedAny) await new Promise((r) => setTimeout(r, 2500)); // let new vectors settle

  const stats = [];
  for (const v of vehicles) {
    const matches = await vehicleComplaints(index, vector, v);
    const stars = await fetchStars(v.make, v.model, v.year);
    stats.push({
      make: v.make,
      model: v.model,
      year: v.year,
      complaints: matches.length,
      topComponents: countComponents(matches).slice(0, 4),
      stars,
      noData: matches.length === 0,
    });
  }
  return stats;
}

// Build the instruction that asks Gemini to write the ranked verdict from the stats.
// Exported so the chat route can stream the same verdict for an in-chat comparison.
export function verdictSystemPrompt(stats, focus) {
  const lines = stats
    .map((s) => {
      if (s.noData) {
        return `${s.year} ${s.make} ${s.model}: no NHTSA complaints on file${
          s.stars ? `; NCAP overall ${s.stars} stars` : ""
        }.`;
      }
      const comps = s.topComponents.map((c) => `${c.component} (${c.count})`).join(", ");
      return `${s.year} ${s.make} ${s.model}: ${s.complaints} recent complaints; most-reported areas: ${comps}${
        s.stars ? `; NCAP overall ${s.stars} stars` : "; NCAP rating not available"
      }.`;
    })
    .join("\n");

  return `You are CarVerdict. Compare these vehicles using only the real NHTSA complaint data and NCAP safety ratings below, and recommend which is the more reliable choice and why.${
    focus ? ` The person especially cares about ${focus}, so weigh that area heavily.` : ""
  } Fewer complaints in a part and more NCAP stars are better. The complaint counts are from a recent sample, not lifetime totals, so speak in relative terms and don't invent exact numbers beyond what is given. If a car has no data, say so plainly. Write in plain text with no markdown symbols, keep it to a few short paragraphs, and name the winner clearly.

Data:
${lines}`;
}

async function generateVerdict(system) {
  const res = await fetch(GENERATE_URL, {
    method: "POST",
    headers: {
      "x-goog-api-key": process.env.GEMINI_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ parts: [{ text: "Which is the more reliable choice, and why?" }] }],
    }),
  });
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

export async function POST(req) {
  const { vehicles, focus } = await req.json().catch(() => ({}));

  if (!Array.isArray(vehicles) || vehicles.length < 2) {
    return Response.json({ error: "Pick two vehicles to compare." }, { status: 400 });
  }
  for (const v of vehicles) {
    if (!v || !v.make || !v.model || !Number.isInteger(Number(v.year)) || Number(v.year) < 1900) {
      return Response.json(
        { error: "Each vehicle needs a make, model, and year." },
        { status: 400 }
      );
    }
  }

  try {
    const stats = await compareVehicles(vehicles);
    const verdict = await generateVerdict(verdictSystemPrompt(stats, focus));
    return Response.json({ vehicles: stats, verdict });
  } catch {
    return Response.json(
      { error: "Something went wrong comparing those vehicles. Please try again." },
      { status: 500 }
    );
  }
}
