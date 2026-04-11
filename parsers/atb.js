const puppeteer = require("puppeteer");

const ATB_URL = "https://www.atbmarket.com/promo/sale_tovari";

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

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let lastHeight = 0;
      let sameCount = 0;

      const timer = setInterval(() => {
        window.scrollBy(0, 700);

        const newHeight = document.body.scrollHeight;

        if (newHeight === lastHeight) {
          sameCount += 1;
        } else {
          sameCount = 0;
          lastHeight = newHeight;
        }

        if (sameCount >= 3) {
          clearInterval(timer);
          resolve();
        }
      }, 400);
    });
  });
}

async function accept18PlusIfNeeded(page) {
  const buttons = await page.$$("button, a, div[role='button']");

  for (const button of buttons) {
    try {
      const text = await page.evaluate(
        (el) => (el.innerText || el.textContent || "").trim(),
        button
      );

      if (/так мені вже є 18/i.test(text)) {
        await button.click({ delay: 50 });
        await sleep(1000);
        break;
      }
    } catch (_) {}
  }
}

async function scrapeATB() {
  console.log("🚀 START SCRAPING ATB");

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
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36"
    );

    await page.goto(ATB_URL, {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    await sleep(3000);
    await accept18PlusIfNeeded(page);
    await autoScroll(page);
    await sleep(2000);

    const rawItems = await page.evaluate(() => {
      function parsePrice(str) {
        if (!str) return null;

        const valueAttr = str.match(/^\d+(\.\d+)?$/);
        if (valueAttr) return Number(valueAttr[0]);

        const cleaned = String(str)
          .replace(",", ".")
          .replace(/[^\d.]/g, "");

        const num = Number(cleaned);
        return Number.isFinite(num) ? num : null;
      }

      const cards = [...document.querySelectorAll(".catalog-item")];
      const result = [];
      const seen = new Set();

      for (const card of cards) {
        const title = card
          .querySelector(".catalog-item__title a")
          ?.innerText?.replace(/\s+/g, " ")
          .trim();

        const priceText =
          card.querySelector(".product-price__top")?.getAttribute("value") ||
          card.querySelector(".product-price__top")?.textContent ||
          "";

        const oldPriceText =
          card.querySelector(".product-price__bottom")?.getAttribute("value") ||
          card.querySelector(".product-price__bottom")?.textContent ||
          "";

        const imageUrl =
          card.querySelector(".catalog-item__img")?.currentSrc ||
          card.querySelector(".catalog-item__img")?.src ||
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
          oldPrice: oldPrice || price,
          imageUrl
        });
      }

      return result;
    });

    console.log("🔍 RAW:", rawItems.length);

    const items = rawItems.map((item, i) => ({
      id: String(i + 1),
      storeId: 1,
      category: "other",
      title: item.title,
      price: item.price,
      oldPrice: item.oldPrice ?? null,
      imageUrl: item.imageUrl || null
    }));

    console.log("✅ FINAL:", items.length);

    return items;
  } catch (e) {
    console.error("❌ ERROR:", e.message);
    return [];
  } finally {
    await browser.close().catch(() => {});
  }
}

module.exports = {
  scrapeATB
};
