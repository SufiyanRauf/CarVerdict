import { Pinecone } from "@pinecone-database/pinecone";
import { ingestVehicle } from "../ingest/route";

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

// pull the specific car out of the question so we can load it on demand if it's not
// in the index yet. Returns { make, model, year } or null. Year is null when the user
// didn't give one, and we only auto-load a vehicle when we know its year.
async function extractVehicle(question) {
  const prompt = `Extract the vehicle from this question. Reply with only JSON like {"make":"Toyota","model":"Camry","year":2019}. Use "" or 0 for anything not stated. If there is no specific car, reply null.\n\nQuestion: ${question}`;
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
    const v = JSON.parse(text);
    if (!v || !v.make || !v.model) return null;
    return { make: v.make, model: v.model, year: v.year ? Number(v.year) : null };
  } catch {
    return null;
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

export async function POST(req) {
  const { messages } = await req.json();
  if (!messages?.length) {
    return new Response("Sorry, I didn't get a question to answer.");
  }
  const question = messages[messages.length - 1].content;

  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  const index = pc.index(process.env.PINECONE_INDEX);

  // find the most relevant complaints, pulling the car from NHTSA first if we don't have it
  let search;
  try {
    const vector = await embed(question);
    search = await index.query({ topK: 8, vector, includeMetadata: true });

    const vehicle = await extractVehicle(question);
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
    const c = match.metadata;
    const components = Array.isArray(c.components) ? c.components.join(", ") : "";
    context += `${c.year} ${c.make} ${c.model} (${components})\n${String(c.summary).slice(0, 600)}\n\n`;
  }

  const body = {
    system_instruction: {
      parts: [{ text: `${systemPrompt}\n\nComplaints:\n${context}` }],
    },
    contents: messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
  };

  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "x-goog-api-key": process.env.GEMINI_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
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
