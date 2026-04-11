const puppeteer = require("puppeteer");

const ROST_OFFERS_BASE = "https://rostmarket.com.ua/znizhki-40-50/p/";
const TOTAL_PAGES = 21;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeImage(url) {
  if (!url) return "";
  if (url.startsWith("//")) return "https:" + url;
  if (url.startsWith("/")) return "https://rostmarket.com.ua" + url;
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

async function scrapeRost() {
  console.log("🚀 ROST PARSER START");

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

    const allItems = [];
    const seen = new Set();

    for (let pageNumber = 1; pageNumber <= TOTAL_PAGES; pageNumber++) {
      const url = `${ROST_OFFERS_BASE}${pageNumber}/`;
      console.log(`PAGE ${pageNumber}: ${url}`);

      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 90000
      });

      await sleep(4000);

      await page.waitForSelector("li.item.product.product-item", {
        timeout: 30000
      }).catch(() => {});

      await autoScroll(page);
      await sleep(2000);

      const pageItems = await page.evaluate(() => {
        function parsePrice(value) {
          const cleaned = String(value || "")
            .replace(/\s+/g, "")
            .replace(",", ".")
            .replace(/[^\d.]/g, "");

          const num = Number(cleaned);
          return Number.isFinite(num) ? Number(num.toFixed(2)) : null;
        }

        function getImage(el) {
          const img = el.querySelector("img.product-image-photo");
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
          document.querySelectorAll("li.item.product.product-item")
        );

        const result = [];

        for (const el of nodes) {
          const title =
            el.querySelector(".product-item-link")?.innerText?.trim() || "";

          const imageUrl = getImage(el);
          const priceBlock = el.querySelector(".price-box")?.innerText || "";
          const prices = priceBlock.match(/\d+[\.,]\d+/g) || [];

          const price = parsePrice(prices[0]);
          const oldPrice = parsePrice(prices[1]) || price;

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

      console.log(`FOUND PAGE ${pageNumber}:`, pageItems.length);

      for (const item of pageItems) {
        const key = `${item.title.toLowerCase()}|${item.price}|${item.oldPrice}`;

        if (seen.has(key)) continue;
        seen.add(key);
        allItems.push(item);
      }
    }

    const normalized = allItems.map((item, index) => ({
      id: String(index + 1),
      storeId: 6,
      title: item.title,
      price: item.price,
      oldPrice: item.oldPrice,
      imageUrl: normalizeImage(item.imageUrl),
      createdAt: Date.now()
    }));

    console.log("FOUND:", allItems.length);
    console.log("FINAL:", normalized.length);
    console.log("✅ ROST ITEMS:", normalized.length);

    return normalized;
  } catch (e) {
    console.error("❌ ROST ERROR:", e.message);
    return [];
  } finally {
    await browser.close().catch(() => {});
  }
}

module.exports = {
  scrapeRost
};
