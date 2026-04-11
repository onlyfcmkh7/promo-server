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

async function autoScroll(page, steps = 10) {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel({ deltaY: 1200 });
    await sleep(700);
  }
}

async function acceptCookies(page) {
  const buttons = await page.$$("button, a, [role='button']");

  for (const btn of buttons) {
    try {
      const text = await page.evaluate(
        el => (el.innerText || "").trim(),
        btn
      );

      if (/прийняти|accept|ok|добре|погоджуюсь/i.test(text)) {
        await btn.click().catch(() => {});
        await sleep(1000);
        return;
      }
    } catch (_) {}
  }
}

async function scrapeSilpo() {
  console.log("🚀 SILPO PARSER START");

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox"]
  });

  try {
    const page = await browser.newPage();

    await page.setViewport({ width: 1400, height: 2000 });

    await page.goto(SILPO_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    await sleep(3000);
    await acceptCookies(page);

    await autoScroll(page);
    await sleep(2000);

    const rawItems = await page.evaluate(() => {
      function parsePrice(str) {
        if (!str) return null;

        const cleaned = String(str)
          .replace(",", ".")
          .replace(/[^\d.]/g, "");

        const num = Number(cleaned);
        return Number.isFinite(num) ? num : null;
      }

      const cards = document.querySelectorAll("article.product-card");
      const result = [];
      const seen = new Set();

      cards.forEach(card => {
        const title = card
          .querySelector(".product-card__title")
          ?.innerText?.trim();

        const priceText = card
          .querySelector(".product-card-price__displayPrice")
          ?.innerText;

        const oldPriceText = card
          .querySelector(".product-card-price__displayOldPrice")
          ?.innerText;

        const imageUrl = card
          .querySelector(".product-card__product-img")
          ?.src;

        const price = parsePrice(priceText);
        const oldPrice = parsePrice(oldPriceText);

        if (!title || !price) return;

        const key = title + price;
        if (seen.has(key)) return;
        seen.add(key);

        result.push({
          title,
          price,
          oldPrice: oldPrice || price,
          imageUrl
        });
      });

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
      imageUrl: item.imageUrl || null
    }));

    console.log("✅ SILPO FINAL:", items.length);

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
