const puppeteer = require("puppeteer");

const SILPO_OFFERS_URL = "https://silpo.ua/offers";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePrice(value) {
  const cleaned = String(value)
    .replace(/\s+/g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");

  const num = Number(cleaned);
  return Number.isFinite(num) ? Number(num.toFixed(2)) : null;
}

function normalizeImage(url) {
  if (!url) return "";
  if (url.startsWith("//")) return "https:" + url;
  if (url.startsWith("/")) return "https://silpo.ua" + url;
  return url;
}

async function acceptCookies(page) {
  const buttons = await page.$$("button, a");

  for (const btn of buttons) {
    try {
      const text = await page.evaluate(el => el.innerText, btn);

      if (/прийняти|accept|ok|добре/i.test(text)) {
        await btn.click().catch(() => {});
        await sleep(1000);
        return;
      }
    } catch {}
  }
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let total = 0;
      const step = 800;

      const timer = setInterval(() => {
        window.scrollBy(0, step);
        total += step;

        if (total > document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 400);
    });
  });
}

async function scrapeSilpo() {
  console.log("🚀 SILPO NEW PARSER START");

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox"]
  });

  try {
    const page = await browser.newPage();

    await page.setViewport({ width: 1400, height: 2000 });

    await page.goto(SILPO_OFFERS_URL, {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    await sleep(4000);
    await acceptCookies(page);
    await autoScroll(page);
    await sleep(3000);

    const items = await page.evaluate(() => {
      function text(el) {
        return String(el?.innerText || "")
          .replace(/\s+/g, " ")
          .trim();
      }

      function parsePrice(value) {
        const cleaned = String(value)
          .replace(/\s+/g, "")
          .replace(",", ".")
          .replace(/[^\d.]/g, "");

        const num = Number(cleaned);
        return Number.isFinite(num) ? Number(num.toFixed(2)) : null;
      }

      function getImage(node) {
        const imgs = Array.from(node.querySelectorAll("img"));

        for (const img of imgs) {
          const src =
            img.currentSrc ||
            img.src ||
            img.getAttribute("src") ||
            "";

          if (/images\.silpo\.ua/.test(src)) {
            return src;
          }
        }

        return "";
      }

      const nodes = Array.from(document.querySelectorAll("a, article"));
      const result = [];
      const seen = new Set();

      for (const node of nodes) {
        const full = text(node);

        if (!/грн|₴/.test(full)) continue;

        const match = full.match(
          /(\d[\d\s.,]*)\s*(?:грн|₴)\s+(\d[\d\s.,]*)\s*(?:грн|₴)\s+-\s*(\d+)%\s+(.+?)\s+(\d+(?:[.,]\d+)?\s?(?:г|кг|мл|л|шт))/i
        );

        if (!match) continue;

        const price = parsePrice(match[1]);
        const oldPrice = parsePrice(match[2]);
        const title = match[4].trim();

        if (!price || !title) continue;

        const image = getImage(node);
        if (!image) continue;

        const key = title.toLowerCase() + price;

        if (seen.has(key)) continue;
        seen.add(key);

        result.push({
          title,
          price,
          oldPrice,
          imageUrl: image
        });
      }

      return result;
    });

    console.log("✅ SILPO ITEMS:", items.length);
    console.log("SAMPLE:", items.slice(0, 10));

    return items;
  } catch (e) {
    console.error("❌ SILPO ERROR:", e.message);
    return [];
  } finally {
    await browser.close();
  }
}

module.exports = {
  scrapeSilpo
};
