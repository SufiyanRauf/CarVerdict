# CarVerdict

CarVerdict is a chat app that tells you what tends to go wrong with a specific car, using real complaints that owners filed with the NHTSA (the US road safety agency). You ask something like "what goes wrong with a 2018 Honda Accord?" and it answers in plain language, grouped by the part that fails, based on actual complaint records instead of the model's guesswork.

I built this to make it easier for my family and friends to make an informed decision when buying a car. I also wanted a project that did real retrieval over real public data rather than a toy chatbot.

## Live demo
https://carverdict.vercel.app

## What it does
- Ask about a specific car and get an answer grounded in real NHTSA owner complaints, grouped by the part that fails.
- Answers stream in as they are written, and the chat keeps its history so follow-up questions still have context.
- Starts with a seeded set of 55 popular vehicles (up to 12 recent complaints each). Ask about a car it does not have yet and it loads that car's complaints from the NHTSA on the spot, then answers.
- Compare two cars side by side (or just ask "compare the Camry and the Accord" in chat) and get a recommendation based on how often each part is reported (from a recent sample of complaints) and the car's NCAP safety rating.
- See how a car's complaints trend across model years, including how many were serious (a crash, fire, or injury) and which parts come up most.
- If a car has no complaints on file, it says so rather than making something up.

## How it works
The question is turned into an embedding with Google's gemini-embedding-001 model at 768 dimensions. The closest complaints are pulled from Pinecone and passed to Gemini (gemini-2.5-flash) as context, and the answer is streamed back to the browser. A separate Python notebook (load.ipynb) fetches the complaints from the NHTSA API and loads them into Pinecone once, to seed the popular vehicles. Asking about a car that is not loaded yet runs the same fetch, embed, and store steps live through an API route, so it becomes searchable right away.

Comparing two cars runs a filtered Pinecone query per car to pull just that car's complaints, counts the parts that come up most, and fetches the NCAP overall safety rating from the NHTSA SafetyRatings API, then asks Gemini to weigh it all into a recommendation. The trends view pulls complaint counts straight from the NHTSA API for each model year in a range and charts them, with a short written summary.

## Tech stack
- Next.js (App Router) and React
- Google Gemini for the chat model and the embeddings
- Pinecone for vector search
- Material UI for the interface
- NHTSA public data: owner complaints, VIN decoding, and NCAP safety ratings

## Running it locally
1. Create a Pinecone index named `carverdict` with 768 dimensions and the cosine metric.
2. Add a `.env.local` file in the project root with `GEMINI_API_KEY`, `PINECONE_API_KEY`, and `PINECONE_INDEX`.
3. Install the dependencies: `npm install`
4. Load the seed data into Pinecone once by running `load.ipynb`. It needs a few Python packages first: `pip install -r requirements.txt`.
5. Start the app: `npm run dev`, then open http://localhost:3000.

## Deploying
The app runs on Vercel. Import the repository, add the same three environment variables (`GEMINI_API_KEY`, `PINECONE_API_KEY`, and `PINECONE_INDEX`) in the project settings, and deploy. Use a Pinecone index with 768 dimensions and the cosine metric, with the name matching `PINECONE_INDEX`. Before the app has anything to answer from, seed that index once by running load.ipynb from your machine (with the same keys) pointed at the production index.
