import { Pinecone } from "@pinecone-database/pinecone";

const EMBED_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent";
const CHAT_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse";

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

export async function POST(req) {
  const { messages } = await req.json();
  const question = messages[messages.length - 1].content;

  // pull the most relevant complaints out of Pinecone
  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  const index = pc.index(process.env.PINECONE_INDEX);
  const vector = await embed(question);
  const search = await index.query({ topK: 8, vector, includeMetadata: true });

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
