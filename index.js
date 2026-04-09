const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

const URL = "https://www.atbmarket.com/promo/sale_tovari";

function parsePrice(text) {
  if (!text) return null;
  return Number(text.replace(",", ".").replace(/[^\d.]/g, ""));
}

async function scrapeATB() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();

  await page.goto(URL, { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 3000));

  const items = await page.evaluate(() => {
    const cards = document.querySelectorAll("a[href*='/product/']");
    const result = [];

    cards.forEach(link => {
      const card = link.closest("div");
      if (!card) return;

      const text = card.innerText;

      const priceMatch = text.match(/(\d+[.,]\d{2})\s*грн\/шт\s*(\d+[.,]\d{2})/i);
      if (!priceMatch) return;

      const img = card.querySelector("img");

      result.push({
        title: link.innerText.trim(),
        price: priceMatch[1],
        oldPrice: priceMatch[2],
        image: img?.src || ""
      });
    });

    return result;
  });

  await browser.close();

  return items.map((item, i) => {
    const price = parsePrice(item.price);
    const oldPrice = parsePrice(item.oldPrice);

    return {
      id: String(i + 1),
      storeId: 1,
      category: "other",
      brand: item.title.split(" ")[0],
      title: item.title,
      price,
      oldPrice,
      discountPercent: Math.round(((oldPrice - price) / oldPrice) * 100),
      createdAt: Date.now(),
      imageUrl: item.image
    };
  });
}

app.get("/promotions/atb", async (req, res) => {
  try {
    const data = await scrapeATB();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: "fail" });
  }
});

app.listen(PORT, () => {
  console.log("Server running on", PORT);
});
