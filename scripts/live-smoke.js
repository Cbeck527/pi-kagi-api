const apiKey = process.env.KAGI_API_KEY?.trim();

if (!apiKey) {
  console.log("Skipping live Kagi smoke test: KAGI_API_KEY is not set.");
  process.exit(0);
}

const response = await fetch("https://kagi.com/api/v1/search", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  body: JSON.stringify({
    query: "Kagi API",
    workflow: "search",
    format: "json",
    limit: 1,
  }),
});

const bodyText = await response.text();

if (!response.ok) {
  throw new Error(`Live Kagi smoke test failed with HTTP ${response.status}: ${bodyText}`);
}

const body = JSON.parse(bodyText);
const resultCount = body.data?.search?.length ?? 0;

if (resultCount < 1) {
  throw new Error("Live Kagi smoke test did not return any search results.");
}

console.log(`Live Kagi smoke test returned ${resultCount} result(s).`);
