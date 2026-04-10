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
    .replace(/\s*-\s*\d+\s*$/, "")
    .trim();
}

function detectBrand(title) {
  const safeTitle = normalizeTitle(title);

  const quoted = safeTitle.match(/[«"](.*?)[»"]/);
  if (quoted && quoted[1]) return quoted[1].trim();

  return safeTitle.split(" ")[0] || "";
}

function isTrashTitle(title) {
  const value = normalizeTitle(title).toLowerCase();

  return [
    "",
    "header logo",
    "logo",
    "only_online",
    "additional"
  ].includes(value);
}

function getImageScore(url) {
  const value = String(url || "").toLowerCase();

  if (value.includes("/600x600/")) return 4;
  if (value.includes("/300x300/")) return 3;
  if (value.includes("/180x180/")) return 2;
  if (value.includes("/90x90/")) return 1;

  return 0;
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
    protocolTimeout: 120000, // ✅ FIX
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
      waitUntil: "domcontentloaded", // ✅ FIX
      timeout: 60000
    });

    await sleep(3000);
    await acceptCookies(page);
    await autoScroll(page);
    await sleep(2500);

    const rawItems = await page.evaluate(() => {
      try {
        function txt(el) {
          return (el?.innerText || el?.textContent || "")
            .replace(/\s+/g, " ")
            .trim();
        }

        const images = [...document.querySelectorAll("img[alt]")];
        const result = [];

        for (const img of images) {
          const title = (img.getAttribute("alt") || "").trim();
          if (!title || title.length < 5) continue;

          const card = img.closest("div");
          if (!card) continue;

          const text = txt(card);

          const match = text.match(
            /(\d[\d\s.,]*)\s*грн[\s\S]*?(\d[\d\s.,]*)\s*грн[\s\S]*?-\s*(\d+)%/i
          );

          if (!match) continue;

          const imageUrl =
            img.currentSrc ||
            img.src ||
            img.getAttribute("src") ||
            "";

          result.push({
            title,
            priceText: match[1],
            oldPriceText: match[2],
            imageUrl
          });
        }

        return result;
      } catch (e) {
        return [];
      }
    });

    const parsedItems = rawItems
      .map((item) => {
        const title = normalizeTitle(item.title);
        const price = parsePrice(item.priceText);
        const oldPrice = parsePrice(item.oldPriceText);
        const imageUrl = normalizeImageUrl(item.imageUrl);

        if (!title || isTrashTitle(title)) return null;
        if (!price || !oldPrice || !(oldPrice > price)) return null;

        return {
          title,
          price,
          oldPrice,
          imageUrl
        };
      })
      .filter(Boolean);

    const deduped = new Map();

    for (const item of parsedItems) {
      const key = `${item.title}|${item.price}|${item.oldPrice}`;
      const existing = deduped.get(key);

      if (!existing || getImageScore(item.imageUrl) > getImageScore(existing.imageUrl)) {
        deduped.set(key, item);
      }
    }

    const items = [...deduped.values()].map((item, i) => ({
      id: String(i + 1),
      storeId: 2,
      title: item.title,
      brand: detectBrand(item.title),
      price: item.price,
      oldPrice: item.oldPrice,
      discountPercent: Math.round(((item.oldPrice - item.price) / item.oldPrice) * 100),
      imageUrl: item.imageUrl,
      createdAt: Date.now()
    }));

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
