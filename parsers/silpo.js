const puppeteer = require("puppeteer");

const SILPO_OFFERS_URL = "https://silpo.ua/offers";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePrice(value) {
  const cleaned = String(value || "")
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
  const buttons = await page.$$("button, a, [role='button']");

  for (const btn of buttons) {
    try {
      const text = await page.evaluate(
        (el) => (el.innerText || "").trim(),
        btn
      );

      if (/прийняти|accept|ok|добре|зрозуміло/i.test(text)) {
        await btn.click().catch(() => {});
        await sleep(1000);
        return;
      }
    } catch (_) {}
  }
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let total = 0;
      const step = 800;
      let idle = 0;
      let lastHeight = document.body.scrollHeight;

      const timer = setInterval(() => {
        window.scrollBy(0, step);
        total += step;

        const currentHeight = document.body.scrollHeight;
        if (currentHeight === lastHeight) {
          idle += 1;
        } else {
          idle = 0;
          lastHeight = currentHeight;
        }

        if (idle >= 4 || total > currentHeight + 1600) {
          clearInterval(timer);
          resolve();
        }
      }, 450);
    });
  });
}

async function waitForPrices(page) {
  try {
    await page.waitForFunction(
      () => /грн|₴/i.test(document.body?.innerText || ""),
      { timeout: 20000 }
    );
    return true;
  } catch (_) {
    return false;
  }
}

async function scrapeSilpo() {
  console.log("🚀 SILPO NEW PARSER START");

  const browser = await puppeteer.launch({
    headless: "new",
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
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36"
    );

    await page.setExtraHTTPHeaders({
      "Accept-Language": "uk-UA,uk;q=0.9,en;q=0.8"
    });

    await page.setRequestInterception(true);

    page.on("request", (request) => {
      const resourceType = request.resourceType();
      const url = request.url();

      if (
        resourceType === "font" ||
        resourceType === "media" ||
        resourceType === "websocket" ||
        url.includes("doubleclick.net") ||
        url.includes("google-analytics.com") ||
        url.includes("googletagmanager.com") ||
        url.includes("facebook.net") ||
        url.includes("clarity.ms")
      ) {
        request.abort();
        return;
      }

      request.continue();
    });

    await page.goto(SILPO_OFFERS_URL, {
      waitUntil: "domcontentloaded",
      timeout: 90000
    });

    await sleep(2500);
    await acceptCookies(page);
    await sleep(1000);

    const hasPricesEarly = await waitForPrices(page);

    if (!hasPricesEarly) {
      await autoScroll(page);
      await sleep(2000);
      await waitForPrices(page);
    } else {
      await autoScroll(page);
      await sleep(1500);
    }

    const items = await page.evaluate(() => {
      function text(el) {
        return String(el?.innerText || "")
          .replace(/\s+/g, " ")
          .trim();
      }

      function parsePrice(value) {
        const cleaned = String(value || "")
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
            img.getAttribute("data-src") ||
            "";

          if (!src) continue;
          if (/\.svg(\?|$)/i.test(src)) continue;
          if (/MediaBubbles|Activities|site\.svg|hermes/i.test(src)) continue;

          return src;
        }

        return "";
      }

      function cleanupTitle(title) {
        return String(title || "")
          .replace(/\s+/g, " ")
          .replace(
            /\s+\d+(?:[.,]\d+)?\s?(г|кг|мл|л|шт)\s+\d+(?:[.,]\d+)?(?:\s*\/5)?$/i,
            ""
          )
          .replace(/\s+\d+(?:[.,]\d+)?\s?(г|кг|мл|л|шт)$/i, "")
          .trim();
      }

      const patterns = [
        /(\d[\d\s.,]*)\s*(?:грн|₴)\s+(\d[\d\s.,]*)\s*(?:грн|₴)\s+-\s*(\d+)%\s+(.+?)\s+(\d+(?:[.,]\d+)?\s?(?:г|кг|мл|л|шт))(?:\s+\d+(?:[.,]\d+)?(?:\s*\/5)?)?$/i,
        /(\d[\d\s.,]*)\s*(?:грн|₴)\s+Роздріб\s+(\d[\d\s.,]*)\s*(?:грн|₴)\s+від\s+(\d+)\s+шт\s+(.+?)\s+(\d+(?:[.,]\d+)?\s?(?:г|кг|мл|л|шт))(?:\s+\d+(?:[.,]\d+)?(?:\s*\/5)?)?$/i,
        /(\d[\d\s.,]*)\s*(?:грн|₴)\s+(\d[\d\s.,]*)\s*(?:грн|₴)\s+(.+?)\s+(\d+(?:[.,]\d+)?\s?(?:г|кг|мл|л|шт))(?:\s+\d+(?:[.,]\d+)?(?:\s*\/5)?)?$/i
      ];

      const nodes = Array.from(document.querySelectorAll("a, article"));
      const result = [];
      const seen = new Set();

      for (const node of nodes) {
        const full = text(node);
        if (!/грн|₴/i.test(full)) continue;

        const imageUrl = getImage(node);
        if (!imageUrl) continue;

        let parsed = null;

        for (const pattern of patterns) {
          const m = full.match(pattern);
          if (!m) continue;

          if (/Роздріб/i.test(full) && /від\s+\d+\s+шт/i.test(full)) {
            parsed = {
              price: parsePrice(m[2]),
              oldPrice: parsePrice(m[1]),
              title: cleanupTitle(m[4])
            };
          } else if (m.length >= 6) {
            parsed = {
              price: parsePrice(m[1]),
              oldPrice: parsePrice(m[2]),
              title: cleanupTitle(m[4] || m[3])
            };
          }

          if (parsed?.price && parsed?.title) {
            break;
          }
        }

        if (!parsed || !parsed.price || !parsed.title) continue;
        if (/^\d+(г|кг|мл|л|шт)/i.test(parsed.title)) continue;

        const key = `${parsed.title.toLowerCase()}|${parsed.price}|${parsed.oldPrice}`;
        if (seen.has(key)) continue;
        seen.add(key);

        result.push({
          title: parsed.title,
          price: parsed.price,
          oldPrice: parsed.oldPrice || parsed.price,
          imageUrl: normalizeImage(imageUrl)
        });
      }

      return result;
    });

    console.log("✅ SILPO ITEMS:", items.length);
    console.log("SAMPLE:", JSON.stringify(items.slice(0, 10), null, 2));

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
