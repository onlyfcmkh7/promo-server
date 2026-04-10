const puppeteer = require("puppeteer");

const VOSTORG_URL = "https://vostorg.zakaz.ua/en/offers";

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
  if (url.startsWith("/")) return `https://vostorg.zakaz.ua${url}`;
  return url;
}

async function scrapeVostorg() {
  console.log("🚀 START VOSTORG OFFERS");

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

    await page.goto(VOSTORG_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    await sleep(5000);

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
          img.getAttribute("src") ||
          img.getAttribute("data-src") ||
          ""
        );
      }

      const cards = [...document.querySelectorAll("a, article, div")];
      const results = [];
      const seen = new Set();

      for (const card of cards) {
        const text = txt(card);

        if (!text) continue;
        if (!/%/.test(text)) continue;
        if (!/₴|грн/i.test(text)) continue;

        const discountMatch = text.match(/-\s*(\d+)\s*%/i);
        const prices = [...text.matchAll(/(\d[\d\s.,]*)\s*(?:₴|грн)/gi)].map(m => m[1]);

        if (!discountMatch || prices.length < 2) continue;

        const titleEl =
          card.querySelector("h1,h2,h3,h4,h5,h6") ||
          card.querySelector("[alt]") ||
          card.querySelector("img[alt]");

        let title = "";

        if (titleEl) {
          title =
            titleEl.getAttribute?.("alt") ||
            txt(titleEl);
        }

        if (!title) {
          const cleaned = text
            .replace(/-\s*\d+\s*%/i, "")
            .replace(/till\s+\d{2}\.\d{2}/i, "")
            .trim();
          title = cleaned.split(/₴|грн/i)[cleaned.split(/₴|грн/i).length - 1]?.trim() || "";
        }

        if (!title || title.length < 3) continue;

        const key = `${title}|${prices[0]}|${prices[1]}`;
        if (seen.has(key)) continue;
        seen.add(key);

        results.push({
          title,
          oldPriceText: prices[0],
          priceText: prices[1],
          discountText: discountMatch[1],
          imageUrl: getImg(card)
        });
      }

      return results;
    });

    const items = rawItems
      .map((item, i) => {
        const price = parsePrice(item.priceText);
        const oldPrice = parsePrice(item.oldPriceText);

        if (!price || !oldPrice || !(oldPrice > price)) return null;

        return {
          id: String(i + 1),
          storeId: 5,
          title: item.title,
          price,
          oldPrice,
          discountPercent: Math.round(((oldPrice - price) / oldPrice) * 100),
          imageUrl: normalizeImageUrl(item.imageUrl),
          createdAt: Date.now()
        };
      })
      .filter(Boolean);

    console.log("✅ FINAL VOSTORG:", items.length);
    return items;
  } catch (e) {
    console.log("❌ VOSTORG ERROR:", e.message);
    return [];
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeVostorg };
