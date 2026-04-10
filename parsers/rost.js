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

// 🔵 ATB
app.get("/promotions/atb", async (_req, res) => {
  try {
    const data = await scrapeATB();
    res.json(data);
  } catch (e) {
    console.error("ATB ERROR:", e);
    res.status(500).json({ error: "fail" });
  }
});

// 🟢 SILPO
app.get("/promotions/silpo", async (_req, res) => {
  try {
    const data = await scrapeSilpo();
    res.json(data);
  } catch (e) {
    console.error("SILPO ERROR:", e);
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

// 🔴 KLASS
app.get("/promotions/klass", async (_req, res) => {
  try {
    const data = await scrapeKlass();
    res.json(data);
  } catch (e) {
    console.error("KLASS ERROR:", e);
    res.status(500).json({ error: "fail" });
  }
});

// 🟣 VOSTORG
app.get("/promotions/vostorg", async (_req, res) => {
  try {
    const data = await scrapeVostorg();
    res.json(data);
  } catch (e) {
    console.error("VOSTORG ERROR:", e);
    res.status(500).json({ error: "fail" });
  }
});

// 🟠 ROST
app.get("/promotions/rost", async (_req, res) => {
  try {
    const data = await scrapeRost();
    res.json(data);
  } catch (e) {
    console.error("ROST ERROR:", e);
    res.status(500).json({ error: "fail" });
  }
});

app.listen(PORT, () => {
  console.log("Server running on", PORT);
});
