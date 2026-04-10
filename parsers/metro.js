const puppeteer = require("puppeteer");

const METRO_URL = "https://metro.zakaz.ua/uk/promotions/";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePrice(value) {
  if (!value) return null;

  const cleaned = String(value)
    .replace(/\s+/g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");

  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function normalizeTitle(title) {
  return String(title || "")
    .replace(/\s+/g, " ")
    .trim();
}

function detectBrand(title) {
  return (title || "").split(" ")[0] || "";
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

async function scrapeMetro() {
  console.log("🚀 START SCRAPING METRO");

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
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"
    );

    await page.goto(METRO_URL, {
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

      const cards = document.querySelectorAll(".catalog-item");
      const result = [];

      cards.forEach((card) => {
        const title = txt(card.querySelector(".catalog-item__title"));
        const price = txt(card.querySelector(".price__value"));
        const oldPrice = txt(card.querySelector(".price__old"));
        const img = card.querySelector("img")?.src || "";

        if (!title || !price || !oldPrice) return;

        result.push({
          title,
          priceText: price,
          oldPriceText: oldPrice,
          imageUrl: img
        });
      });

      return result;
    });

    const items = rawItems
      .map((item, i) => {
        const title = normalizeTitle(item.title);
        const price = parsePrice(item.priceText);
        const oldPrice = parsePrice(item.oldPriceText);

        if (!title || !price || !oldPrice || !(oldPrice > price)) return null;

        return {
          id: String(i + 1),
          storeId: 3,
          title,
          brand: detectBrand(title),
          price,
          oldPrice,
          discountPercent: Math.round(
            ((oldPrice - price) / oldPrice) * 100
          ),
          imageUrl: item.imageUrl
        };
      })
      .filter(Boolean);

    console.log("✅ FINAL METRO:", items.length);

    return items;
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeMetro };
