import { resolveModel, getComplaints } from "../ingest/route";

export const maxDuration = 60;

const GENERATE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

// don't let someone ask for a hundred years at once (each year is a couple NHTSA calls)
const MAX_SPAN = 12;

// a complaint counts as serious if anyone was hurt or there was a crash or fire
function isSevere(c) {
  return Boolean(c.crash) || Boolean(c.fire) || (c.numberOfInjuries || 0) > 0 || (c.numberOfDeaths || 0) > 0;
}

// pull one model year's complaints from NHTSA and boil them down to a few numbers
async function yearStats(make, model, year) {
  const queryModel = await resolveModel(make, model, year);
  const complaints = (await getComplaints(make, queryModel, year)).filter((c) =>
    (c.summary || "").trim()
  );

  const components = {};
  let severe = 0;
  for (const c of complaints) {
    if (isSevere(c)) severe += 1;
    for (const part of (c.components || "").split(",").map((x) => x.trim()).filter(Boolean)) {
      components[part] = (components[part] || 0) + 1;
    }
  }
  return { year, total: complaints.length, severe, components };
}

// merge the per-year component tallies into one top-N list for the whole range
function topComponents(years, n) {
  const totals = {};
  for (const y of years) {
    for (const [part, count] of Object.entries(y.components)) {
      totals[part] = (totals[part] || 0) + count;
    }
  }
  return Object.entries(totals)
    .filter(([component]) => component.toUpperCase() !== "UNKNOWN OR OTHER")
    .map(([component, count]) => ({ component, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

// ask Gemini to read the trend out loud in a sentence or two
async function summarize(make, model, years, parts) {
  const perYear = years
    .map((y) => `${y.year}: ${y.total} complaints (${y.severe} serious)`)
    .join("; ");
  const partList = parts.map((p) => `${p.component} (${p.count})`).join(", ");
  const prompt = `Here are NHTSA complaint counts by model year for the ${make} ${model}. Point out the trend across model years (which years stand out and whether serious complaints track the totals) and name the parts that come up most. Keep it to two or three short sentences, plain text, no markdown, and don't invent numbers beyond these.\n\nBy model year: ${perYear}.\nMost-reported parts across the range: ${partList || "none"}.`;

  try {
    const res = await fetch(GENERATE_URL, {
      method: "POST",
      headers: {
        "x-goog-api-key": process.env.GEMINI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
  } catch {
    return "";
  }
}

export async function POST(req) {
  const { make, model, startYear, endYear } = await req.json().catch(() => ({}));

  const start = Number(startYear);
  const end = Number(endYear);
  if (!make || !model || !Number.isInteger(start) || !Number.isInteger(end)) {
    return Response.json({ error: "Enter a make, model, and year range." }, { status: 400 });
  }
  const thisYear = new Date().getFullYear();
  if (start < 1995 || end > thisYear || start > end) {
    return Response.json({ error: `Pick a year range between 1995 and ${thisYear}.` }, { status: 400 });
  }
  if (end - start + 1 > MAX_SPAN) {
    return Response.json({ error: `Keep the range to ${MAX_SPAN} model years or fewer.` }, { status: 400 });
  }

  const cleanMake = make.trim();
  const cleanModel = model.trim();

  try {
    const wanted = [];
    for (let y = start; y <= end; y++) wanted.push(y);
    // the years don't depend on each other, so fetch them at once
    const years = await Promise.all(wanted.map((y) => yearStats(cleanMake, cleanModel, y)));

    const parts = topComponents(years, 5);
    const hasData = years.some((y) => y.total > 0);
    const summary = hasData ? await summarize(cleanMake, cleanModel, years, parts) : "";

    return Response.json({ make: cleanMake, model: cleanModel, years, topComponents: parts, summary });
  } catch {
    return Response.json(
      { error: "Something went wrong pulling those trends. Please try again." },
      { status: 500 }
    );
  }
}
