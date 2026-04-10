const puppeteer = require("puppeteer");

const SILPO_URL = "https://silpo.ua/offers";

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

function normalizeImageUrl(url) {
  if (!url) return "";

  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `https://silpo.ua${url}`;

  return url;
}

function normalizeTitle(title) {
  return String(title || "")
    .replace(/\s+/g, " ")
    .trim();
}

function detectBrand(title) {
  const safeTitle = normalizeTitle(title);
  return safeTitle.split(" ")[0] || "";
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

async function acceptCookies(page) {
  const buttons = await page.$$("button, a, div[role='button']");

  for (const button of buttons) {
    try {
      const text = await page.evaluate(
        (el) => (el.innerText || el.textContent || "").trim(),
        button
      );

      if (/прийняти|accept|ok|добре/i.test(text)) {
        await button.click().catch(() => {});
        await sleep(1000);
        break;
      }
    } catch (_) {}
  }
}

async function scrapeSilpo() {
  console.log("🚀 START SCRAPING SILPO");

  const browser = await puppeteer.launch({
    headless: "new",
    protocolTimeout: 120000,
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

    await page.goto(SILPO_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    await sleep(4000);
    await acceptCookies(page);
    await autoScroll(page);
    await sleep(3000);

    const rawItems = await page.evaluate(() => {
      function txt(el) {
        return (el?.innerText || "").replace(/\s+/g, " ").trim();
      }

      const result = [];
      const cards = document.querySelectorAll("div");

      for (const card of cards) {
        const text = txt(card);

        if (!text.includes("грн") || !text.includes("%")) continue;

        const match = text.match(
          /(\d[\d\s.,]*)\s*грн[\s\S]*?(\d[\d\s.,]*)\s*грн[\s\S]*?-\s*(\d+)%/i
        );

        if (!match) continue;

        const img = card.querySelector("img");

        const imageUrl =
          img?.currentSrc ||
          img?.src ||
          img?.getAttribute("src") ||
          "";

        const title =
          img?.getAttribute("alt") ||
          text.split("грн")[0] ||
          "";

        result.push({
          title,
          priceText: match[1],
          oldPriceText: match[2],
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

        if (!title || !price || !oldPrice || !(oldPrice > price)) return null;

        return {
          id: String(i + 1),
          storeId: 2,
          title,
          brand: detectBrand(title),
          price,
          oldPrice,
          discountPercent: Math.round(((oldPrice - price) / oldPrice) * 100),
          imageUrl,
          createdAt: Date.now()
        };
      })
      .filter(Boolean);

    console.log("✅ FINAL SILPO:", items.length);

    return items;
  } catch (e) {
    console.log("❌ SILPO ERROR:", e.message);
    return [];
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeSilpo };
