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

function detectCategory(title) {
  const t = String(title || "").toLowerCase();

  if (/\b(молоко|кефір|йогурт|сир|сметан|вершк|масло|моцарел|бринз)\b/.test(t)) {
    return "dairy";
  }

  if (/\b(хліб|батон|лаваш|булоч|круасан|паск|кекс|панеттоне)\b/.test(t)) {
    return "bread";
  }

  if (/\b(курк|куряч)\b/.test(t)) {
    return "chicken";
  }

  if (/\b(свинин|свиняч)\b/.test(t)) {
    return "pork";
  }

  if (/\b(телятина|ялович)\b/.test(t)) {
    return "veal";
  }

  if (/\b(риба|лосос|тунец|тунець|хек)\b/.test(t)) {
    return "fish";
  }

  if (/\b(кревет|міді|кальмар)\b/.test(t)) {
    return "seafood";
  }

  if (/\b(соус|кетчуп|майонез)\b/.test(t)) {
    return "sauces";
  }

  if (/\b(олія)\b/.test(t)) {
    return "oil";
  }

  if (/\b(шоколад)\b/.test(t)) {
    return "chocolate";
  }

  if (/\b(вода)\b/.test(t)) {
    return "water";
  }

  if (/\b(пиво)\b/.test(t)) {
    return "beer";
  }

  if (/\b(сидр|коктейль)\b/.test(t)) {
    return "low_alcohol";
  }

  if (/\b(горілка|віскі|коньяк|ром)\b/.test(t)) {
    return "strong_alcohol";
  }

  return "other";
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
        const m = str.replace(",", ".").match(/\d+(\.\d+)?/);
        return m ? Number(m[0]) : null;
      }

      function getImage(node) {
        const img = node.querySelector("img");
        return (
          img?.currentSrc ||
          img?.src ||
          img?.getAttribute("data-src") ||
          ""
        );
      }

      const nodes = [...document.querySelectorAll("a, div, section")];
      const result = [];
      const seen = new Set();

      for (const node of nodes) {
        const text = (node.innerText || "")
          .replace(/\s+/g, " ")
          .trim();

        const match = text.match(
          /(\d+[.,]\d{2})\s*грн\/шт\s*(\d+[.,]\d{2})/
        );

        if (!match) continue;

        const price = parsePrice(match[1]);
        const oldPrice = parsePrice(match[2]);

        if (!price) continue;

        const title = text
          .replace(match[0], "")
          .replace(/-\d+%/g, "")
          .trim()
          .slice(0, 160);

        if (!title) continue;

        const key = `${title}|${price}|${oldPrice || price}`;
        if (seen.has(key)) continue;
        seen.add(key);

        result.push({
          title,
          price,
          oldPrice: oldPrice || price,
          imageUrl: getImage(node) || null
        });
      }

      return result;
    });

    console.log("🔍 RAW:", rawItems.length);

    const items = rawItems.map((item, i) => ({
      id: String(i + 1),
      storeId: 1,
      category: detectCategory(item.title),
      brand: null,
      title: item.title,
      price: item.price,
      oldPrice: item.oldPrice,
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
