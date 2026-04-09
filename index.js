const express = require("express");
const cors = require("cors");

const { scrapeATB } = require("./parsers/atb");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

app.get("/promotions/atb", async (_req, res) => {
  try {
    const data = await scrapeATB();
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "fail" });
  }
});

app.listen(PORT, () => {
  console.log("Server running on", PORT);
});
