const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

const ATB_URL = "https://www.atbmarket.com/promo/sale_tovari";

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function parsePrice(value) {
  if (!value) return null;
  const cleaned = value.replace(",", ".").replace(/[^\d.]/g, "");
  return Number(cleaned);
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let total = 0;
      const distance = 500;

      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        total += distance;

        if (total >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 200);
    });
  });
}

async function scrapeATB() {
  console.log("🚀 START SCRAPING ATB");

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();

  await page.goto(ATB_URL, {
    waitUntil: "networkidle2",
    timeout: 60000
  });

  await sleep(3000);
  await autoScroll(page);
  await sleep(2000);

  const items = await page.evaluate(() => {
    function text(el) {
      return (el?.innerText || "").replace(/\s+/g, " ").trim();
    }

    const links = document.querySelectorAll("a[href*='/product/']");
    console.log("LINKS LENGTH:", links.length);

    const result = [];

    links.forEach(link => {
      const card = link.closest("div");
      if (!card) return;

      const cardText = text(card);

      const priceMatch = cardText.match(
        /(\d+[.,]\d{2})\s*грн\/шт\s*(\d+[.,]\d{2})/i
      );

      if (!priceMatch) return;

      const img = card.querySelector("img");

      result.push({
        title: text(link),
        rawText: cardText,
        price: priceMatch[1],
        oldPrice: priceMatch[2],
        image: img?.src || ""
      });
    });

    return {
      count: links.length,
      items: result.slice(0, 50) // щоб не було занадто велико
    };
  });

  console.log("🔍 LINKS FOUND:", items.count);
  console.log("✅ VALID ITEMS:", items.items.length);

  if (!items.items.length) {
    console.log("❌ NO ITEMS FOUND");
    await browser.close();
    return [];
  }

  const result = items.items.map((item, i) => {
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

  await browser.close();

  console.log("🎉 FINAL ITEMS:", result.length);

  return result;
}

app.get("/promotions/atb", async (req, res) => {
  try {
    const data = await scrapeATB();
    res.json(data);
  } catch (e) {
    console.error("🔥 ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log("Server running on", PORT);
});
