const puppeteer = require("puppeteer");

const SILPO_OFFERS_URL = "https://silpo.ua/offers";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeImage(url) {
  if (!url) return "";
  if (url.startsWith("//")) return "https:" + url;
  if (url.startsWith("/")) return "https://silpo.ua" + url;
  return url;
}

async function scrollStep(page, times = 6) {
  for (let i = 0; i < times; i++) {
    await page.evaluate(() => window.scrollBy(0, 1200)).catch(() => {});
    await sleep(800);
  }
}

async function scrapeSilpo() {
  console.log("🚀 SILPO PARSER START");

  const browser = await puppeteer.launch({
    headless: "new",
    protocolTimeout: 180000,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--single-process",
      "--no-zygote"
    ]
  });

  try {
    const page = await browser.newPage();

    await page.setViewport({ width: 1440, height: 2200 });

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/135.0.0.0 Safari/537.36"
    );

    await page.setExtraHTTPHeaders({
      "Accept-Language": "uk-UA,uk;q=0.9,en;q=0.8"
    });

    console.log(`[SILPO] PAGE 1: ${SILPO_OFFERS_URL}`);

    await page.goto(SILPO_OFFERS_URL, {
      waitUntil: "domcontentloaded",
      timeout: 90000
    });

    await sleep(5000);

    console.log("[SILPO] first selector wait");
    await page.waitForSelector("silpo-products-list-item", {
      timeout: 15000
    }).catch(() => {});

    console.log("[SILPO] scroll");
    await scrollStep(page, 6);
    await sleep(2000);

    const count = await page.$$eval(
      "silpo-products-list-item",
      (els) => els.length
    ).catch(() => 0);

    console.log("[SILPO] CARD COUNT:", count);

    if (!count) {
      console.log("[SILPO] no cards found");
      return [];
    }

    const items = await page.$$eval("silpo-products-list-item", (nodes) => {
      function parsePrice(value) {
        const cleaned = String(value || "")
          .replace(/\s+/g, "")
          .replace(",", ".")
          .replace(/[^\d.]/g, "");

        const num = Number(cleaned);
        return Number.isFinite(num) ? Number(num.toFixed(2)) : null;
      }

      function getText(el) {
        return String(el?.textContent || "")
          .replace(/\s+/g, " ")
          .trim();
      }

      function getImage(el) {
        const img = el.querySelector(".product-card__product-img");
        if (!img) return "";

        return (
          img.currentSrc ||
          img.src ||
          img.getAttribute("src") ||
          img.getAttribute("data-src") ||
          ""
        );
      }

      const result = [];
      const seen = new Set();

      for (const el of nodes) {
        const title = getText(el.querySelector(".product-card__title"));
        const price = parsePrice(
          getText(el.querySelector(".product-card-price__displayPrice"))
        );
        const oldPriceRaw = parsePrice(
          getText(el.querySelector(".product-card-price__displayOldPrice"))
        );
        const imageUrl = getImage(el);

        if (!title || !price || !imageUrl) continue;

        const oldPrice = oldPriceRaw && oldPriceRaw > price ? oldPriceRaw : price;
        const key = `${title.toLowerCase()}|${price}|${oldPrice}`;

        if (seen.has(key)) continue;
        seen.add(key);

        result.push({
          title,
          price,
          oldPrice,
          imageUrl
        });
      }

      return result;
    });

    console.log("[SILPO] RAW:", items.length);

    const normalized = items.map((item, index) => ({
      id: String(index + 1),
      storeId: 2,
      category: "other",
      title: item.title,
      price: item.price,
      oldPrice: item.oldPrice,
      imageUrl: normalizeImage(item.imageUrl),
      createdAt: Date.now()
    }));

    console.log("[SILPO] FINAL:", normalized.length);

    return normalized;
  } catch (e) {
    console.error("❌ SILPO ERROR:", e.message);
    return [];
  } finally {
    await browser.close().catch(() => {});
  }
}

module.exports = {
  scrapeSilpo
};
