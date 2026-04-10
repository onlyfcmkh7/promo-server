const express = require("express");
const cors = require("cors");

const { scrapeATB } = require("./parsers/atb");
const { scrapeSilpo } = require("./parsers/silpo");
const { scrapeMetro } = require("./parsers/metro");
const { scrapeKlass } = require("./parsers/klass");
const { scrapeVostorg } = require("./parsers/vostorg");
const { scrapeRost } = require("./parsers/rost");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

async function handle(res, fn, name) {
  try {
    const data = await fn();
    res.json(data);
  } catch (e) {
    console.error(`${name} ERROR:`, e.message);
    res.status(500).json({ error: "fail" });
  }
}

app.get("/promotions/atb", async (_req, res) => {
  await handle(res, scrapeATB, "ATB");
});

app.get("/promotions/silpo", async (_req, res) => {
  await handle(res, scrapeSilpo, "SILPO");
});

app.get("/promotions/metro", async (_req, res) => {
  await handle(res, scrapeMetro, "METRO");
});

app.get("/promotions/klass", async (_req, res) => {
  await handle(res, scrapeKlass, "KLASS");
});

app.get("/promotions/vostorg", async (_req, res) => {
  await handle(res, scrapeVostorg, "VOSTORG");
});

app.get("/promotions/rost", async (_req, res) => {
  await handle(res, scrapeRost, "ROST");
});

app.listen(PORT, () => {
  console.log("🚀 Server running on", PORT);
});
