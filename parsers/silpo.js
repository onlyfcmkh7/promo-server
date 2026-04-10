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

function detectBrand(title) {
  const safeTitle = String(title || "").trim();

  const quoted = safeTitle.match(/[«"](.*?)[»"]/);
  if (quoted && quoted[1]) {
    return quoted[1].trim();
  }

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

      if (/прийняти|accept|добре|ok/i.test(text)) {
        await button.click({ delay: 50 });
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
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });

  try {
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );

    await page.goto(SILPO_URL, {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    await sleep(3000);
    await acceptCookies(page);
    await autoScroll(page);
    await sleep(2000);

    const rawItems = await page.evaluate(() => {
      function txt(el) {
        return (el?.innerText || el?.textContent || "")
          .replace(/\s+/g, " ")
          .trim();
      }

      function getImage(card) {
        const img = card.querySelector("img[alt]");
        if (!img) return "";

        return (
          img.currentSrc ||
          img.src ||
          img.getAttribute("src") ||
          img.getAttribute("data-src") ||
          ""
        );
      }

      const cards = [...document.querySelectorAll("a, div, li, article")];
      const result = [];
      const seen = new Set();

      for (const card of cards) {
        const text = txt(card);

        if (!/грн/i.test(text) || !/-\s*\d+%/i.test(text)) continue;

        const img = card.querySelector("img[alt]");
        if (!img) continue;

        const title = img.getAttribute("alt")?.trim();
        if (!title) continue;

        const match = text.match(
          /(\d[\d\s.,]*)\s*грн[\s\S]*?(\d[\d\s.,]*)\s*грн[\s\S]*?-\s*(\d+)%/i
        );

        if (!match) continue;

        const key = title + match[1] + match[2];
        if (seen.has(key)) continue;
        seen.add(key);

        result.push({
          title,
          priceText: match[1],
          oldPriceText: match[2],
          imageUrl: getImage(card)
        });
      }

      return result;
    });

    console.log("🔍 FOUND SILPO:", rawItems.length);

    const items = rawItems
      .map((item, i) => {
        const price = parsePrice(item.priceText);
        const oldPrice = parsePrice(item.oldPriceText);

        if (!price || !oldPrice || !(oldPrice > price)) return null;

        return {
          id: String(i + 1),
          storeId: 2,
          title: item.title,
          brand: detectBrand(item.title),
          price,
          oldPrice,
          discountPercent: Math.round(((oldPrice - price) / oldPrice) * 100),
          imageUrl: item.imageUrl
        };
      })
      .filter(Boolean);

    console.log("✅ FINAL SILPO:", items.length);

    return items;
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeSilpo };
