# CarVerdict

CarVerdict is a chat app that tells you what tends to go wrong with a specific car, using real complaints that owners filed with the NHTSA (the US road safety agency). You ask something like "what goes wrong with a 2018 Honda Accord?" and it answers in plain language, grouped by the part that fails, based on actual complaint records instead of the model's guesswork.

I built this to make it easier for my family and friends to make an informed decision when buying a car. I also wanted a project that did real retrieval over real public data rather than a toy chatbot.

## What works now
- Ask about a specific car and get an answer grounded in real NHTSA owner complaints.
- Answers stream in as they are written, and the chat keeps its history so follow-up questions still have context.
- It starts with a seeded set of more than 50 popular vehicles (about 220 complaints), and you can add any other car yourself: enter a make, model, and year, or paste a VIN. If you just ask about a car it does not have yet, it loads that car's complaints on the spot and then answers.
- If a car has no complaints on file, it says so rather than making something up.

## Planned next
- Compare two cars side by side.
- Show how defects trend across model years.

## How it works
The question is turned into an embedding with Google's gemini-embedding-001 model at 768 dimensions. The closest complaints are pulled from Pinecone and passed to Gemini (gemini-2.5-flash) as context, and the answer is streamed back to the browser. A separate Python notebook (load.ipynb) fetches the complaints from the NHTSA API and loads them into Pinecone once, to seed the popular vehicles. Adding a car (or asking about one that is not loaded yet) runs the same fetch, embed, and store steps live through an API route, so it becomes searchable right away.

## Tech stack
- Next.js (App Router) and React
- Google Gemini for the chat model and the embeddings
- Pinecone for vector search
- Material UI for the chat interface
- NHTSA public data (owner complaints, plus VIN decoding to identify a car; recalls and safety ratings are part of the planned work)

## Running it locally
1. Create a Pinecone index named `carverdict` with 768 dimensions and the cosine metric.
2. Add a `.env.local` file in the project root with `GEMINI_API_KEY`, `PINECONE_API_KEY`, and `PINECONE_INDEX`.
3. Install the dependencies: `npm install`
4. Load the seed data into Pinecone once by running `load.ipynb`. It needs a few Python packages first: `pip install -r requirements.txt`.
5. Start the app: `npm run dev`, then open http://localhost:3000.
