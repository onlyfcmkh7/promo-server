const puppeteer = require("puppeteer");

const ATB_URL = "https://www.atbmarket.com/promo/sale_tovari";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePrice(value) {
  if (!value) return null;
  const cleaned = String(value).replace(",", ".").replace(/[^\d.]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let total = 0;
      const distance = 600;

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
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    await sleep(3000);
    await accept18PlusIfNeeded(page);
    await autoScroll(page);
    await sleep(2000);

    const rawItems = await page.evaluate(() => {
      function parsePrice(str) {
        if (!str) return null;
        const m = str.replace(',', '.').match(/\d+(\.\d+)?/);
        return m ? Number(m[0]) : null;
      }

      const cards = document.querySelectorAll('article.catalog-item');
      const result = [];

      cards.forEach(card => {
        const title =
          card.querySelector('a')?.innerText?.trim() ||
          '';

        if (!title) return;

        const priceBlock = [...card.querySelectorAll('*')]
          .find(el => el.innerText?.includes('грн/шт'));

        if (!priceBlock) return;

        const lines = priceBlock.innerText
          .split('\n')
          .map(t => t.trim())
          .filter(Boolean);

        const price = parsePrice(lines[0]);
        const oldPrice = parsePrice(lines[1]);

        const imageUrl =
          card.querySelector('img')?.currentSrc ||
          card.querySelector('img')?.src ||
          '';

        if (!price) return;

        result.push({
          title,
          price,
          oldPrice: oldPrice || price,
          imageUrl
        });
      });

      return result;
    });

    console.log("🔍 RAW:", rawItems.length);

    const items = rawItems.map((item, i) => ({
      id: String(i + 1),
      storeId: 1,
      title: item.title,
      price: item.price,
      oldPrice: item.oldPrice,
      discountPercent:
        item.oldPrice > item.price
          ? Math.round(((item.oldPrice - item.price) / item.oldPrice) * 100)
          : null,
      createdAt: Date.now(),
      imageUrl: item.imageUrl
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
