const puppeteer = require("puppeteer");

const KLASS_URL = "https://klassmarket.ua/aktsii/";

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

function normalizeTitle(title) {
  return String(title || "")
    .replace(/\s+/g, " ")
    .trim();
}

function detectBrand(title) {
  const safeTitle = normalizeTitle(title);
  return safeTitle.split(" ")[0] || "";
}

function normalizeImageUrl(url) {
  if (!url) return "";
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `https://klassmarket.ua${url}`;
  return url;
}

function getImageScore(url) {
  const value = String(url || "").toLowerCase();

  if (value.includes("-600x600")) return 4;
  if (value.includes("-300x300")) return 3;
  if (value.includes("-150x150")) return 2;
  if (value.includes("webp")) return 1;

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

async function scrapeKlass() {
  console.log("🚀 START SCRAPING KLASS");

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
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );

    await page.goto(KLASS_URL, {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    await sleep(3000);
    await autoScroll(page);
    await sleep(2500);

    // беремо посилання на окремі акції
    const promoLinks = await page.evaluate(() => {
      const links = [...document.querySelectorAll("a[href]")];

      return [...new Set(
        links
          .map((a) => a.href)
          .filter((href) =>
            href &&
            href.startsWith("https://klassmarket.ua/") &&
            !href.includes("/product/") &&
            !href.includes("/page/") &&
            !href.includes("/kategoriya/") &&
            !href.includes("/tag/") &&
            href !== "https://klassmarket.ua/aktsii/" &&
            href !== "https://klassmarket.ua/aktsii"
          )
      )];
    });

    const limitedLinks = promoLinks.slice(0, 12);
    let allRawItems = [];

    for (const link of limitedLinks) {
      try {
        await page.goto(link, {
          waitUntil: "networkidle2",
          timeout: 60000
        });

        await sleep(2000);
        await autoScroll(page);
        await sleep(1500);

        const rawItems = await page.evaluate(() => {
          function txt(el) {
            return (el?.innerText || el?.textContent || "")
              .replace(/\s+/g, " ")
              .trim();
          }

          function getImg(el) {
            const img = el.querySelector("img");
            if (!img) return "";

            return (
              img.currentSrc ||
              img.src ||
              img.getAttribute("data-src") ||
              img.getAttribute("data-lazy-src") ||
              ""
            );
          }

          const result = [];
          const cards = [...document.querySelectorAll("li.product, .product, .products li")];

          for (const card of cards) {
            const title =
              txt(card.querySelector(".woocommerce-loop-product__title")) ||
              txt(card.querySelector("h2")) ||
              txt(card.querySelector("h3")) ||
              txt(card.querySelector("a"));

            const text = txt(card);

            const prices = text.match(/(\d[\d\s.,]*)\s*грн(?:\/\S+)?/gi);
            if (!title || !prices || prices.length < 2) continue;

            const oldPriceText = prices[0];
            const priceText = prices[1];

            result.push({
              title,
              priceText,
              oldPriceText,
              imageUrl: getImg(card)
            });
          }

          return result;
        });

        allRawItems = allRawItems.concat(rawItems);
      } catch (e) {
        console.log("KLASS PAGE SKIP:", link);
      }
    }

    const parsedItems = allRawItems
      .map((item) => {
        const title = normalizeTitle(item.title);
        const price = parsePrice(item.priceText);
        const oldPrice = parsePrice(item.oldPriceText);
        const imageUrl = normalizeImageUrl(item.imageUrl);

        if (!title) return null;
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

      if (!existing) {
        deduped.set(key, item);
        continue;
      }

      if (getImageScore(item.imageUrl) > getImageScore(existing.imageUrl)) {
        deduped.set(key, item);
      }
    }

    const items = [...deduped.values()].map((item, i) => ({
      id: String(i + 1),
      storeId: 4,
      title: item.title,
      brand: detectBrand(item.title),
      price: item.price,
      oldPrice: item.oldPrice,
      discountPercent: Math.round(((item.oldPrice - item.price) / item.oldPrice) * 100),
      imageUrl: item.imageUrl
    }));

    console.log("✅ FINAL KLASS:", items.length);

    return items;
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeKlass };
