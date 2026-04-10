const puppeteer = require("puppeteer");

const PROMO_URLS = [
  "https://klassmarket.ua/aktsiia-kupui-vyhidno/",
  "https://klassmarket.ua/yarmarok-nyzkykh-tsin/",
  "https://klassmarket.ua/aktsiia-rybnyi-bazar/",
  "https://klassmarket.ua/aktsiia-pyvni-znyzhky/",
  "https://klassmarket.ua/aktsiia-chystyi-dim/",
  "https://klassmarket.ua/znyzhky-v-kozhnyi-dim/",
  "https://klassmarket.ua/aktsiia-kupui-do-postu/",
  "https://klassmarket.ua/aktsiia-kupui-do-velykodnia/",
  "https://klassmarket.ua/aktsiia-sviatkovi-napoi/"
];

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
      const distance = 600;

      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        total += distance;

        if (total >= document.body.scrollHeight + 2000) {
          clearInterval(timer);
          resolve();
        }
      }, 250);
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

      if (/погодитися|прийняти|accept|ok/i.test(text)) {
        await button.click({ delay: 50 }).catch(() => {});
        await sleep(1200);
        break;
      }
    } catch (_) {}
  }
}

async function scrapePromoPage(page, url) {
  await page.goto(url, {
    waitUntil: "networkidle2",
    timeout: 60000
  });

  await sleep(2500);
  await acceptCookies(page);
  await autoScroll(page);
  await sleep(1500);

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
        img.getAttribute("data-src") ||
        img.getAttribute("data-lazy-src") ||
        ""
      );
    }

    function extractFromCard(card) {
      const title =
        txt(card.querySelector(".woocommerce-loop-product__title")) ||
        txt(card.querySelector("h2")) ||
        txt(card.querySelector("h3")) ||
        txt(card.querySelector(".product-title")) ||
        txt(card.querySelector("a"));

      if (!title || title.length < 5) return null;

      const text = txt(card);

      // шукаємо дві ціни типу 35.50 грн/100 гр 24.90 грн/100 гр
      const matches = [
        ...text.matchAll(/(\d[\d\s.,]*)\s*грн(?:\/[^\s]+(?:\s*[^\s]+)?)?/gi)
      ].map((m) => m[1]);

      if (matches.length < 2) return null;

      return {
        title,
        oldPriceText: matches[0],
        priceText: matches[1],
        imageUrl: getImg(card)
      };
    }

    const result = [];
    const seen = new Set();

    const cardSelectors = [
      "li.product",
      ".product",
      ".products li",
      ".woocommerce ul.products li.product",
      "[class*='product']"
    ];

    const cards = cardSelectors.flatMap((selector) =>
      Array.from(document.querySelectorAll(selector))
    );

    for (const card of cards) {
      const item = extractFromCard(card);
      if (!item) continue;

      const key = `${item.title}|${item.oldPriceText}|${item.priceText}`;
      if (seen.has(key)) continue;
      seen.add(key);

      result.push(item);
    }

    return result;
  });

  return rawItems;
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

    let allRawItems = [];

    for (const url of PROMO_URLS) {
      try {
        const items = await scrapePromoPage(page, url);
        console.log("KLASS PAGE:", url, items.length);
        allRawItems = allRawItems.concat(items);
      } catch (e) {
        console.log("KLASS PAGE SKIP:", url);
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
      discountPercent: Math.round(
        ((item.oldPrice - item.price) / item.oldPrice) * 100
      ),
      imageUrl: item.imageUrl
    }));

    console.log("✅ FINAL KLASS:", items.length);

    return items;
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeKlass };
