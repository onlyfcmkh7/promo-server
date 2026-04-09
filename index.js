const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const ATB_URL = "https://www.atbmarket.com/promo/sale_tovari";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePrice(value) {
  if (!value) return null;
  const cleaned = String(value).replace(",", ".").replace(/[^\d.]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
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
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage"
    ]
  });

  try {
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );

    await page.goto(ATB_URL, {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    await sleep(3000);
    await autoScroll(page);
    await sleep(2000);

    const rawItems = await page.evaluate(() => {
      function txt(el) {
        return (el?.innerText || el?.textContent || "")
          .replace(/\s+/g, " ")
          .trim();
      }

      const cards = document.querySelectorAll("[class*='product']");
      const result = [];

      cards.forEach((card) => {
        const text = txt(card);
        const title =
          txt(card.querySelector("a")) ||
          txt(card.querySelector("[class*='title']")) ||
          txt(card.querySelector("h2")) ||
          txt(card.querySelector("h3"));

        const prices = text.match(/(\d+[.,]\d{2})/g) || [];
        if (!title || prices.length < 2) return;

        const img = card.querySelector("img");

        result.push({
          title,
          rawText: text,
          priceText: prices[0],
          oldPriceText: prices[1],
          imageUrl:
            img?.currentSrc ||
            img?.src ||
            img?.getAttribute?.("data-src") ||
            ""
        });
      });

      return result;
    });

    console.log("🔍 PRODUCT CARDS FOUND:", rawItems.length);
    console.log("🧪 SAMPLE:", rawItems.slice(0, 3));

    const items = rawItems
      .map((item, i) => {
        const price = parsePrice(item.priceText);
        const oldPrice = parsePrice(item.oldPriceText);

        if (!item.title || !price || !oldPrice) return null;
        if (!(oldPrice > price)) return null;

        return {
          id: String(i + 1),
          storeId: 1,
          category: "other",
          brand: item.title.split(" ")[0] || "",
          title: item.title,
          price,
          oldPrice,
          discountPercent: Math.round(((oldPrice - price) / oldPrice) * 100),
          createdAt: Date.now(),
          imageUrl: item.imageUrl || ""
        };
      })
      .filter(Boolean);

    console.log("✅ VALID ITEMS:", items.length);

    if (!items.length) {
      console.log("❌ NO ITEMS FOUND");
    }

    return items;
  } finally {
    await browser.close();
  }
}

app.get("/promotions/atb", async (_req, res) => {
  try {
    const data = await scrapeATB();
    res.json(data);
  } catch (e) {
    console.error("🔥 ERROR:", e);
    res.status(500).json({
      error: "fail",
      details: e.message
    });
  }
});

app.listen(PORT, () => {
  console.log("Server running on", PORT);
});
