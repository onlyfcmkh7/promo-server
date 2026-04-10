const puppeteer = require("puppeteer");

const ROST_URL = "https://rost.kh.ua/";

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
  if (url.startsWith("/")) return `https://rost.kh.ua${url}`;

  return url;
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

async function scrapeRost() {
  console.log("🚀 START SCRAPING ROST");

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

    await page.goto(ROST_URL, {
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

      function getImg(card) {
        const img = card.querySelector("img");
        if (!img) return "";

        return (
          img.currentSrc ||
          img.src ||
          img.getAttribute("data-src") ||
          img.getAttribute("data-lazy-src") ||
          ""
        );
      }

      const result = [];
      const cards = document.querySelectorAll("a[href*='product']");

      cards.forEach((link) => {
        const title = txt(link);
        if (!title) return;

        const card = link.closest("div");
        if (!card) return;

        const text = txt(card);
        const prices = text.match(/(\d[\d\s.,]*)/g);

        if (!prices || prices.length < 2) return;

        result.push({
          title,
          oldPriceText: prices[0],
          priceText: prices[1],
          imageUrl: getImg(card)
        });
      });

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
          storeId: 6,
          title,
          brand: detectBrand(title),
          price,
          oldPrice,
          discountPercent: Math.round(
            ((oldPrice - price) / oldPrice) * 100
          ),
          imageUrl
        };
      })
      .filter(Boolean);

    console.log("✅ FINAL ROST:", items.length);

    return items;
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeRost };
