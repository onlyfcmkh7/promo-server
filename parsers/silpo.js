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

async function scrapeSilpo() {
  console.log("🚀 SILPO PARSER START");

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

    console.log(`PAGE 1: ${SILPO_OFFERS_URL}`);

    await page.goto(SILPO_OFFERS_URL, {
      waitUntil: "domcontentloaded",
      timeout: 90000
    });

    await sleep(5000);

    await page.waitForSelector("silpo-products-list-item", {
      timeout: 30000
    }).catch(() => {});

    await autoScroll(page);
    await sleep(2500);

    const items = await page.evaluate(() => {
      function parsePrice(value) {
        const cleaned = String(value || "")
          .replace(/\s+/g, "")
          .replace(",", ".")
          .replace(/[^\d.]/g, "");

        const num = Number(cleaned);
        return Number.isFinite(num) ? Number(num.toFixed(2)) : null;
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

      const nodes = Array.from(
        document.querySelectorAll("silpo-products-list-item")
      );

      const result = [];

      for (const el of nodes) {
        const title =
          el.querySelector(".product-card__title")?.innerText?.trim() || "";

        const imageUrl = getImage(el);

        const priceText =
          el.querySelector(".product-card-price__displayPrice")?.innerText || "";

        const oldPriceText =
          el.querySelector(".product-card-price__displayOldPrice")?.innerText || "";

        const price = parsePrice(priceText);
        const oldPrice = parsePrice(oldPriceText) || price;

        if (!title || !price || !imageUrl) continue;

        result.push({
          title,
          price,
          oldPrice,
          imageUrl
        });
      }

      return result;
    });

    console.log("FOUND PAGE 1:", items.length);

    const seen = new Set();

    const normalized = items
      .filter((item) => {
        const key = `${item.title.toLowerCase()}|${item.price}|${item.oldPrice}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((item, index) => ({
        id: String(index + 1),
        storeId: 2,
        category: "other",
        title: item.title,
        price: item.price,
        oldPrice: item.oldPrice,
        imageUrl: normalizeImage(item.imageUrl),
        createdAt: Date.now()
      }));

    console.log("FOUND:", items.length);
    console.log("FINAL:", normalized.length);
    console.log("✅ SILPO ITEMS:", normalized.length);

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
