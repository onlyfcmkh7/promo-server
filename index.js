const express = require("express");
const cors = require("cors");

const { scrapeATB } = require("./parsers/atb");
const { scrapeSilpo } = require("./parsers/silpo");
const { scrapeMetro } = require("./parsers/metro");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// 🔵 ATB
app.get("/promotions/atb", async (_req, res) => {
  try {
    const data = await scrapeATB();
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "fail" });
  }
});

// 🟢 SILPO
app.get("/promotions/silpo", async (_req, res) => {
  try {
    const data = await scrapeSilpo();
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "fail" });
  }
});

// 🟡 METRO
app.get("/promotions/metro", async (_req, res) => {
  try {
    const data = await scrapeMetro();
    res.json(data);
  } catch (e) {
    console.error("METRO ERROR:", e);
    res.status(500).json({ error: "fail" });
  }
});

app.listen(PORT, () => {
  console.log("Server running on", PORT);
});
