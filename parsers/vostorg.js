const puppeteer = require("puppeteer");

const VOSTORG_URL = "https://vostorg.zakaz.ua/ru/custom-categories/promotions/";

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
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function detectBrand(title) {
  return normalizeTitle(title).split(" ")[0] || "";
}

function normalizeImageUrl(url) {
  if (!url) return "";
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `https://vostorg.zakaz.ua${url}`;
  return url;
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let total = 0;
      const distance = 700;

      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        total += distance;

        if (total >= document.body.scrollHeight + 2000) {
          clearInterval(timer);
          resolve();
        }
      }, 250);
    });
  });
}

async function scrapeVostorg() {
  console.log("🚀 START SCRAPING VOSTORG");

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

    await page.goto(VOSTORG_URL, {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    await sleep(3000);
    await autoScroll(page);
    await sleep(2500);

    const html = await page.content();

    const productRegex =
      /<img[^>]+src="([^"]+)"[^>]*>[\s\S]{0,1200}?([A-Za-zА-Яа-яІіЇїЄєҐґ0-9"'`’\-\–\.,%\/\s\(\)]+)[\s\S]{0,600}?(\d[\d\s.,]*)\s*₴[\s\S]{0,120}?(\d[\d\s.,]*)\s*₴/g;

    const rawItems = [];
    const seen = new Set();

    for (const match of html.matchAll(productRegex)) {
      const imageUrl = normalizeImageUrl(match[1]);
      const title = normalizeTitle(match[2]);
      const oldPrice = parsePrice(match[3]);
      const price = parsePrice(match[4]);

      if (!title || title.length < 4) continue;
      if (!imageUrl) continue;
      if (!price || !oldPrice || !(oldPrice > price)) continue;

      const key = `${title}|${price}|${oldPrice}`;
      if (seen.has(key)) continue;
      seen.add(key);

      rawItems.push({
        title,
        price,
        oldPrice,
        imageUrl
      });
    }

    const items = rawItems.map((item, i) => ({
      id: String(i + 1),
      storeId: 5,
      title: item.title,
      brand: detectBrand(item.title),
      price: item.price,
      oldPrice: item.oldPrice,
      discountPercent: Math.round(
        ((item.oldPrice - item.price) / item.oldPrice) * 100
      ),
      imageUrl: item.imageUrl
    }));

    console.log("✅ FINAL VOSTORG:", items.length);

    return items;
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeVostorg };
