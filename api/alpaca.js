// Vercel serverless function — proxies requests to Alpaca to avoid browser CORS issues
// and keep the secret key server-side only.

const ALPACA_KEY = "PK7JETS262GCU4VBEZBIQCSMJN";
const ALPACA_SECRET = "6UhAQ2SQFnpBkHUuhk15pDw3HeYSDUqKmuQBmYDSkMWu";
const ALPACA_BASE = "https://paper-api.alpaca.markets";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const { path } = req.query; // e.g. ?path=v2/positions
  if (!path) {
    res.status(400).json({ error: "Missing path parameter" });
    return;
  }

  try {
    const url = `${ALPACA_BASE}/${path}`;
    const alpacaRes = await fetch(url, {
      method: req.method,
      headers: {
        "APCA-API-KEY-ID": ALPACA_KEY,
        "APCA-API-SECRET-KEY": ALPACA_SECRET,
        "Content-Type": "application/json",
      },
      body: req.method === "POST" ? JSON.stringify(req.body) : undefined,
    });

    const data = await alpacaRes.json();
    res.status(alpacaRes.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

