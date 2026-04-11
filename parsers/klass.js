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
      await autoScroll(page);
      await sleep(2000);

      const pageItems = await page.evaluate(() => {
        function parsePrice(text) {
          const cleaned = String(text || "")
            .replace(/\s+/g, "")
            .replace(",", ".")
            .replace(/[^\d.]/g, "");

          const num = Number(cleaned);
          return Number.isFinite(num) ? Number(num.toFixed(2)) : null;
        }

        function getImage(el) {
          const img = el.querySelector("img");
          if (!img) return "";

          return (
            img.currentSrc ||
            img.src ||
            img.getAttribute("src") ||
            img.getAttribute("data-src") ||
            ""
          );
        }

        const nodes = Array.from(document.querySelectorAll("a, article, div"));
        const result = [];

        for (const el of nodes) {
          const text = (el.innerText || "").replace(/\s+/g, " ").trim();

          if (!/грн\/шт/i.test(text)) continue;
          if (text.length > 300) continue;

          const prices = text.match(/\d+[.,]\d+/g) || [];
          const price = parsePrice(prices[0]);
          const oldPrice = parsePrice(prices[1]) || price;
          const imageUrl = getImage(el);

          if (!price) continue;

          let title = text
            .replace(/-\d+%/g, "")
            .replace(/\d+[.,]\d+/g, "")
            .replace(/грн\/шт/gi, "")
            .replace(/Артикул:\s*[\d/]+/gi, "")
            .replace(/\s+/g, " ")
            .trim();

          if (!title || title.length < 4) continue;

          result.push({
            title,
            price,
            oldPrice,
            imageUrl
          });
        }

        return result;
      });

      console.log(`FOUND PAGE ${i + 1}: ${pageItems.length}`);

      for (const item of pageItems) {
        const key = `${item.title.toLowerCase()}|${item.price}|${item.oldPrice}`;

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

    console.log("FOUND:", allItems.length);
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
