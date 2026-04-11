const puppeteer = require("puppeteer");

const URLS = [
  "https://klassmarket.ua/yarmarok-nyzkykh-tsin/filter/page=1/",
  "https://klassmarket.ua/yarmarok-nyzkykh-tsin/filter/page=2/",
  "https://klassmarket.ua/yarmarok-nyzkykh-tsin/filter/page=3/",
  "https://klassmarket.ua/yarmarok-nyzkykh-tsin/filter/page=4/",
  "https://klassmarket.ua/yarmarok-nyzkykh-tsin/filter/page=5/",
  "https://klassmarket.ua/aktsiia-pyvni-znyzhky/"
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeImage(url) {
  if (!url) return "";
  if (url.startsWith("//")) return "https:" + url;
  if (url.startsWith("/")) return "https://klassmarket.ua" + url;
  return url;
}

async function scrapeKlass() {
  console.log("🚀 KLASS PARSER START");

  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu"
    ]
  });

  try {
    const page = await browser.newPage();

    await page.setViewport({ width: 1400, height: 2000 });

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/135.0.0.0 Safari/537.36"
    );

    const allItems = [];
    const seen = new Set();

    for (let i = 0; i < URLS.length; i++) {
      const url = URLS[i];
      console.log(`PAGE ${i + 1}: ${url}`);

      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 90000
      });

      await sleep(4000);

      const pageItems = await page.evaluate(() => {
        function parsePrice(text) {
          const cleaned = String(text || "")
            .replace(",", ".")
            .replace(/[^\d.]/g, "");

          const num = Number(cleaned);
          return Number.isFinite(num) ? Number(num.toFixed(2)) : null;
        }

        const cards = document.querySelectorAll("li.catalog-grid__item");
        const result = [];

        for (const el of cards) {
          const title = el
            .querySelector(".catalogCard-title a")
            ?.textContent?.trim();

          const priceText = el
            .querySelector(".catalogCard-price")
            ?.textContent;

          const oldPriceText = el
            .querySelector(".catalogCard-oldPrice")
            ?.textContent;

          const img = el.querySelector(".catalogCard-img");

          const imageUrl =
            img?.currentSrc || img?.src || "";

          const price = parsePrice(priceText);
          const oldPrice = parsePrice(oldPriceText);

          if (!title || !price) continue;

          result.push({
            title,
            price,
            oldPrice: oldPrice && oldPrice > price ? oldPrice : price,
            imageUrl
          });
        }

        return result;
      });

      console.log(`FOUND PAGE ${i + 1}:`, pageItems.length);

      for (const item of pageItems) {
        const key = `${item.title.toLowerCase()}|${item.price}`;

        if (seen.has(key)) continue;
        seen.add(key);

        allItems.push(item);
      }
    }

    const normalized = allItems.map((item, index) => ({
      id: String(index + 1),
      storeId: 4,
      category: "other",
      title: item.title,
      price: item.price,
      oldPrice: item.oldPrice,
      imageUrl: normalizeImage(item.imageUrl),
      createdAt: Date.now()
    }));

    console.log("FINAL:", normalized.length);
    console.log("✅ KLASS ITEMS:", normalized.length);

    return normalized;
  } catch (e) {
    console.error("❌ KLASS ERROR:", e.message);
    return [];
  } finally {
    await browser.close().catch(() => {});
  }
}

module.exports = {
  scrapeKlass
};
