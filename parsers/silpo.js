const puppeteer = require("puppeteer");

const SILPO_URL = "https://silpo.ua/offers";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePrice(value) {
  if (!value) return null;

  const cleaned = String(value)
    .replace(",", ".")
    .replace(/[^\d.]/g, "");

  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function normalizeImage(url) {
  if (!url) return "";
  if (url.startsWith("//")) return "https:" + url;
  if (url.startsWith("/")) return "https://silpo.ua" + url;
  return url;
}

async function acceptCookies(page) {
  const buttons = await page.$$("button, a, [role='button']");

  for (const btn of buttons) {
    try {
      const text = await page.evaluate(
        (el) => (el.innerText || el.textContent || "").trim(),
        btn
      );

      if (/прийняти|accept|ok|добре|погоджуюсь|зрозуміло/i.test(text)) {
        await btn.click().catch(() => {});
        await sleep(1000);
        return;
      }
    } catch (_) {}
  }
}

async function autoScroll(page, steps = 12) {
  for (let i = 0; i < steps; i++) {
    await page.evaluate(() => {
      window.scrollBy(0, 1200);
    });
    await sleep(700);
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
      "--disable-gpu"
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

    console.log("[SILPO] goto offers");

    await page.goto(SILPO_URL, {
      waitUntil: "domcontentloaded",
      timeout: 90000
    });

    await sleep(4000);

    console.log("[SILPO] accept cookies");
    await acceptCookies(page);
    await sleep(1500);

    console.log("[SILPO] wait content");
    await page.waitForFunction(
      () => {
        const text = document.body?.innerText || "";
        return /грн|₴|акц|знижк/i.test(text);
      },
      { timeout: 30000 }
    ).catch(() => {});

    console.log("[SILPO] scroll");
    await autoScroll(page, 12);
    await sleep(2500);

    console.log("[SILPO] wait items");
    await page.waitForSelector("silpo-products-list-item", {
      timeout: 30000
    }).catch(() => {});

    const count = await page.$$eval(
      "silpo-products-list-item",
      (els) => els.length
    ).catch(() => 0);

    console.log("SILPO CARD COUNT:", count);

    console.log("[SILPO] extract");

    const rawItems = await page.evaluate(() => {
      function parsePrice(str) {
        if (!str) return null;

        const cleaned = String(str)
          .replace(",", ".")
          .replace(/[^\d.]/g, "");

        const num = Number(cleaned);
        return Number.isFinite(num) ? num : null;
      }

      const cards = [...document.querySelectorAll("silpo-products-list-item")];
      const result = [];
      const seen = new Set();

      for (const item of cards) {
        const title = item
          .querySelector(".product-card__title")
          ?.textContent?.replace(/\s+/g, " ")
          .trim();

        const priceText = item
          .querySelector(".product-card-price__displayPrice")
          ?.textContent;

        const oldPriceText = item
          .querySelector(".product-card-price__displayOldPrice")
          ?.textContent;

        const imageUrl =
          item.querySelector(".product-card__product-img")?.currentSrc ||
          item.querySelector(".product-card__product-img")?.src ||
          "";

        const price = parsePrice(priceText);
        const oldPrice = parsePrice(oldPriceText);

        if (!title || !price) continue;

        const key = `${title}_${price}`;
        if (seen.has(key)) continue;
        seen.add(key);

        result.push({
          title,
          price,
          oldPrice: oldPrice && oldPrice > price ? oldPrice : null,
          imageUrl
        });
      }

      return result;
    });

    console.log("🔍 SILPO RAW:", rawItems.length);

    const items = rawItems.map((item, i) => ({
      id: String(i + 1),
      storeId: 2,
      category: "other",
      title: item.title,
      price: item.price,
      oldPrice: item.oldPrice ?? null,
      imageUrl: normalizeImage(item.imageUrl) || null
    }));

    console.log("✅ SILPO FINAL:", items.length);
    console.log("SILPO SAMPLE:", JSON.stringify(items.slice(0, 3), null, 2));

    return items;
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
