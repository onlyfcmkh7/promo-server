const puppeteer = require("puppeteer");

const METRO_OFFERS_URL = "https://metro.zakaz.ua/uk/custom-categories/promotions/";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeImage(url) {
  if (!url) return "";
  if (url.startsWith("//")) return "https:" + url;
  if (url.startsWith("/")) return "https://metro.zakaz.ua" + url;
  return url;
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let total = 0;
      const step = 800;
      let idle = 0;
      let lastHeight = document.body.scrollHeight;

      const timer = setInterval(() => {
        window.scrollBy(0, step);
        total += step;

        const currentHeight = document.body.scrollHeight;

        if (currentHeight === lastHeight) {
          idle += 1;
        } else {
          idle = 0;
          lastHeight = currentHeight;
        }

        if (idle >= 4 || total > currentHeight + 1500) {
          clearInterval(timer);
          resolve();
        }
      }, 400);
    });
  });
}

async function waitForPrices(page) {
  await page.waitForFunction(
    () => {
      const tiles = document.querySelectorAll('[data-testid="product-tile"]');
      if (!tiles.length) return false;

      return Array.from(tiles).some((el) => {
        return (
          el.querySelector('[data-marker="Discounted Price"]') ||
          el.querySelector('[data-marker="Old Price"]')
        );
      });
    },
    { timeout: 20000 }
  ).catch(() => {});
}

async function scrapeMetro() {
  console.log("🚀 METRO PARSER START");

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

    await page.setExtraHTTPHeaders({
      "Accept-Language": "uk-UA,uk;q=0.9,en;q=0.8"
    });

    await page.goto(METRO_OFFERS_URL, {
      waitUntil: "domcontentloaded",
      timeout: 90000
    });

    await sleep(4000);

    await page.waitForSelector('[data-testid="product-tile"]', {
      timeout: 30000
    }).catch(() => {});

    await waitForPrices(page);
    await autoScroll(page);
    await sleep(2500);

    console.log("PAGE URL:", page.url());

    const bodyPreview = await page.evaluate(() =>
      (document.body?.innerText || "").slice(0, 1000)
    );
    console.log("BODY PREVIEW:", bodyPreview);

    const tileCount = await page.$$eval(
      '[data-testid="product-tile"]',
      (els) => els.length
    ).catch(() => 0);

    console.log("TILES BEFORE EVALUATE:", tileCount);

    const items = await page.evaluate(() => {
      function parsePrice(value) {
        const cleaned = String(value || "")
          .replace(/\s+/g, "")
          .replace(",", ".")
          .replace(/[^\d.]/g, "");

        const num = Number(cleaned);
        return Number.isFinite(num) ? Number(num.toFixed(2)) : null;
      }

      const nodes = Array.from(
        document.querySelectorAll('[data-testid="product-tile"]')
      );

      const result = [];
      const seen = new Set();

      for (const el of nodes) {
        const title =
          el.querySelector('[data-testid="product_tile_title"]')?.innerText?.trim() || "";

        const price = parsePrice(
          el.querySelector('[data-marker="Discounted Price"] .Price__value_caption')?.innerText
        );

        const oldPrice = parsePrice(
          el.querySelector('[data-marker="Old Price"] .Price__value_body')?.innerText
        );

        const imageUrl = el.querySelector("img")?.src || "";

        if (!title || !price || !imageUrl) continue;

        const finalOldPrice = oldPrice || price;
        const key = `${title.toLowerCase()}|${price}|${finalOldPrice}`;

        if (seen.has(key)) continue;
        seen.add(key);

        result.push({
          title,
          price,
          oldPrice: finalOldPrice,
          imageUrl
        });
      }

      return result;
    });

    const normalized = items.map((item, index) => ({
      id: String(index + 1),
      storeId: 3,
      title: item.title,
      price: item.price,
      oldPrice: item.oldPrice,
      imageUrl: normalizeImage(item.imageUrl),
      createdAt: Date.now()
    }));

    console.log("FOUND:", items.length);
    console.log("FINAL:", normalized.length);
    console.log("✅ METRO ITEMS:", normalized.length);

    return normalized;
  } catch (e) {
    console.error("❌ METRO ERROR:", e.message);
    return [];
  } finally {
    await browser.close().catch(() => {});
  }
}

module.exports = {
  scrapeMetro
};
