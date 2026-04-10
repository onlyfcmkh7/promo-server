const puppeteer = require("puppeteer");

const VOSTORG_URL = "https://vostorg.zakaz.ua/ru/offers/";

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
      const distance = 600;

      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        total += distance;

        if (total >= document.body.scrollHeight + 1500) {
          clearInterval(timer);
          resolve();
        }
      }, 250);
    });
  });
}

async function scrapeVostorg() {
  console.log("🚀 START SCRAPING VOSTORG OFFERS");

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
    await sleep(2000);

    const rawItems = await page.evaluate(() => {
      function txt(el) {
        return (el?.innerText || el?.textContent || "")
          .replace(/\s+/g, " ")
          .trim();
      }

      function getImg(el) {
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

      const result = [];
      const seen = new Set();
      const nodes = Array.from(document.querySelectorAll("div, article, section, a, li"));

      for (const node of nodes) {
        const text = txt(node);
        if (!text) continue;

        const prices = [...text.matchAll(/(\d[\d\s.,]*)\s*[₴грн]/gi)].map((m) => m[1]);
        if (prices.length < 2) continue;

        const title =
          txt(node.querySelector("h1, h2, h3, h4")) ||
          txt(node.querySelector("p")) ||
          txt(node.querySelector("span")) ||
          txt(node.querySelector("a"));

        const imageUrl = getImg(node);

        if (!title || title.length < 4) continue;
        if (!imageUrl) continue;

        const key = `${title}|${prices[0]}|${prices[1]}`;
        if (seen.has(key)) continue;
        seen.add(key);

        result.push({
          title,
          oldPriceText: prices[0],
          priceText: prices[1],
          imageUrl
        });
      }

      return result;
    });

    const items = rawItems
      .map((item, i) => {
        const title = normalizeTitle(item.title);
        const price = parsePrice(item.priceText);
        const oldPrice = parsePrice(item.oldPriceText);
        const imageUrl = normalizeImageUrl(item.imageUrl);

        if (!title) return null;
        if (!price || !oldPrice || !(oldPrice > price)) return null;

        return {
          id: String(i + 1),
          storeId: 5,
          title,
          brand: detectBrand(title),
          price,
          oldPrice,
          discountPercent: Math.round(((oldPrice - price) / oldPrice) * 100),
          imageUrl
        };
      })
      .filter(Boolean);

    console.log("✅ FINAL VOSTORG:", items.length);

    return items;
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeVostorg };
