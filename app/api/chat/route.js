import { Pinecone } from "@pinecone-database/pinecone";
import { ingestVehicle } from "../ingest/route";
import { compareVehicles, verdictSystemPrompt } from "../compare/route";

const EMBED_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent";
const CHAT_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse";
const GENERATE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const systemPrompt = `You are CarVerdict, an assistant that explains the common problems with a specific car using real owner complaints filed with the NHTSA.

Answer the question using the complaints provided below. Complaints from a nearby model year of the same car are still relevant, so use them and mention which years you are drawing from. Group the issues by the part that fails (transmission, brakes, engine, electrical, and so on) and say how serious or common each one looks. Only say you don't have data yet if none of the complaints are for that make and model. Keep it specific and don't invent numbers. Write in plain text, no markdown symbols like ** or #. Use short paragraphs and a plain dash for any list items.`;

// embed the question the same way load.ipynb embedded the complaints (768 dims, key in header)
async function embed(text) {
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

// Pull the vehicle(s) and any focus area out of the question. One vehicle means a
// normal answer (auto-loaded if we don't have it); two or more means a comparison.
// Returns { vehicles: [{ make, model, year }], focus }. year is null when not stated.
async function extractIntent(question) {
  const prompt = `From this question, list the vehicles asked about and any specific concern. Reply with only JSON like {"vehicles":[{"make":"Toyota","model":"Camry","year":2019}],"focus":"transmission"}. Use "" or 0 for anything not stated, and "focus":null if no specific part is mentioned. Include every vehicle when the question compares more than one. If there is no specific car, reply {"vehicles":[],"focus":null}.\n\nQuestion: ${question}`;
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
    const text = (data.candidates?.[0]?.content?.parts?.[0]?.text || "")
      .replace(/```json|```/g, "")
      .trim();
    const parsed = JSON.parse(text);
    const vehicles = (parsed.vehicles || [])
      .filter((v) => v && v.make && v.model)
      .map((v) => ({ make: v.make, model: v.model, year: v.year ? Number(v.year) : null }));
    return { vehicles, focus: parsed.focus || null };
  } catch {
    return { vehicles: [], focus: null };
  }
}

// is this exact vehicle already in the index? a filtered lookup, not the topK results,
// so a differently worded follow-up about the same car doesn't fetch it a second time.
async function alreadyHave(index, vector, vehicle) {
  const res = await index.query({
    topK: 1,
    vector,
    includeMetadata: false,
    filter: {
      make: { $eq: vehicle.make },
      model: { $eq: vehicle.model },
      year: { $eq: vehicle.year },
    },
  });
  return res.matches.length > 0;
}

// stream a Gemini answer for the given system instruction and chat history
async function streamGemini(systemText, messages) {
  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "x-goog-api-key": process.env.GEMINI_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemText }] },
      contents: messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
    }),
  });

  if (!res.ok || !res.body) {
    return new Response("Sorry, I couldn't reach the model just now. Please try again.");
  }

  // Gemini streams server-sent events; forward just the text as it arrives
  const stream = new ReadableStream({
    async start(controller) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const json = line.slice(5).trim();
          if (!json) continue;
          try {
            const text = JSON.parse(json).candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) controller.enqueue(encoder.encode(text));
          } catch {
            // partial line, wait for the rest
          }
        }
      }
      controller.close();
    },
  });

  return new Response(stream);
}

export async function POST(req) {
  const { messages } = await req.json().catch(() => ({}));
  if (!messages?.length) {
    return new Response("Sorry, I didn't get a question to answer.");
  }
  const question = messages[messages.length - 1].content;

  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  const index = pc.index(process.env.PINECONE_INDEX);

  let intent;
  try {
    intent = await extractIntent(question);
  } catch {
    intent = { vehicles: [], focus: null };
  }

  // two or more vehicles named -> compare them and stream the verdict
  if (intent.vehicles.length >= 2) {
    try {
      const stats = await compareVehicles(intent.vehicles);
      return streamGemini(verdictSystemPrompt(stats, intent.focus), messages);
    } catch {
      return new Response("Sorry, I had trouble comparing those cars just now. Please try again.");
    }
  }

  // otherwise answer about a single car, loading it from NHTSA first if we don't have it
  let search;
  try {
    const vector = await embed(question);
    search = await index.query({ topK: 8, vector, includeMetadata: true });

    const vehicle = intent.vehicles[0];
    if (vehicle && vehicle.year && !(await alreadyHave(index, vector, vehicle))) {
      await ingestVehicle(vehicle);
      await new Promise((r) => setTimeout(r, 2000)); // give the new vectors a moment to be searchable
      search = await index.query({ topK: 8, vector, includeMetadata: true });
    }
  } catch {
    return new Response("Sorry, I had trouble looking that up. Please try again.");
  }

  let context = "";
  for (const match of search.matches) {
    const c = match.metadata || {};
    const components = Array.isArray(c.components) ? c.components.join(", ") : "";
    context += `${c.year} ${c.make} ${c.model} (${components})\n${String(c.summary).slice(0, 600)}\n\n`;
  }

  return streamGemini(`${systemPrompt}\n\nComplaints:\n${context}`, messages);
}
