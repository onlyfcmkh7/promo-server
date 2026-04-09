const express = require("express");
const cheerio = require("cheerio");

const app = express();
const PORT = process.env.PORT || 3000;

const PROMO_URLS = [
  "https://www.atbmarket.com/promo/all?filter=0",
  "https://www.atbmarket.com/promo/sim_dniv",
  "https://promo.atbmarket.com/"
];

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "uk-UA,uk;q=0.9,en-US;q=0.8,en;q=0.7",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
  "Referer": "https://www.atbmarket.com/"
};

let cache = {
  updatedAt: 0,
  items: []
};

function normalizeSpaces(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function parsePrice(value) {
  if (!value) return null;

  const cleaned = String(value)
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, "")
    .replace(",", ".")
    .match(/\d+(?:\.\d+)?/);

  if (!cleaned) return null;

  const parsed = Number(cleaned[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function detectCategory(title) {
  const text = normalizeSpaces(title).toLowerCase();

  if (
    text.includes("молоко") ||
    text.includes("кефір") ||
    text.includes("сметана") ||
    text.includes("ряжанка") ||
    text.includes("йогурт") ||
    text.includes("сир")
  ) return "dairy";

  if (
    text.includes("хліб") ||
    text.includes("батон") ||
    text.includes("лаваш") ||
    text.includes("булоч")
  ) return "bread";

  if (
    text.includes("кур") ||
    text.includes("філе") ||
    text.includes("гомілка") ||
    text.includes("стегно") ||
    text.includes("крило")
  ) return "chicken";

  if (text.includes("кетчуп") || text.includes("соус")) return "ketchup";
  if (text.includes("олія")) return "oil";
  if (text.includes("шоколад")) return "chocolate";
  if (text.includes("вода")) return "water";

  if (
    text.includes("пиво") ||
    text.includes("сидр") ||
    text.includes("віскі") ||
    text.includes("горілка") ||
    text.includes("вино") ||
    text.includes("слабоалког")
  ) return "alcohol";

  return "other";
}

function extractBrand(title) {
  const text = normalizeSpaces(title);
  if (!text) return null;

  const knownBrands = [
    "Яготинське",
    "Галичина",
    "Простоквашино",
    "Київхліб",
    "Кулиничі",
    "Хлібодар",
    "Наша Ряба",
    "Гаврилівські курчата",
    "Чумак",
    "Торчин",
    "Олейна",
    "Щедрий Дар",
    "Корона",
    "Roshen",
    "Millennium",
    "Моршинська",
    "BonAqua",
    "Карпатська Джерельна",
    "Оболонь",
    "Чернігівське",
    "Львівське",
    "Stella Artois",
    "Corona Extra",
    "Garage",
    "Revo",
    "Shabo",
    "Koblevo",
    "Nemiroff",
    "Хортиця",
    "Absolut",
    "Jameson",
    "Jack Daniel's"
  ];

  const found = knownBrands.find((brand) =>
    text.toLowerCase().startsWith(brand.toLowerCase())
  );

  if (found) return found;

  return text.split(" ").slice(0, 2).join(" ").trim();
}

function buildPromotion(id, title, price, oldPrice, imageUrl) {
  const safeTitle = normalizeSpaces(title);
  if (!safeTitle || price == null) return null;

  return {
    id: String(id),
    storeId: 1,
    category: detectCategory(safeTitle),
    brand: extractBrand(safeTitle),
    title: safeTitle,
    price,
    oldPrice,
    discountPercent:
      oldPrice && oldPrice > price
        ? Math.round(((oldPrice - price) / oldPrice) * 100)
        : null,
    createdAt: Date.now(),
    imageUrl: imageUrl || null
  };
}

async function fetchHtml(url) {
  const response = await fetch(url, { headers: DEFAULT_HEADERS });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return await response.text();
}

function extractPromotionsFromHtml(html) {
  const $ = cheerio.load(html);
  const results = [];
  const seen = new Set();

  const selectors = [
    "[class*='promo']",
    "[class*='product']",
    "[class*='card']",
    "[class*='item']",
    "article",
    ".swiper-slide",
    "li"
  ];

  selectors.forEach((selector) => {
    $(selector).each((_, el) => {
      const root = $(el);

      const title = normalizeSpaces(
        root.find("h1,h2,h3,h4,[class*='title'],[class*='name']").first().text()
      );

      if (!title || title.length < 5) return;

      const priceCandidates = [];

      root.find("[class*='price'], [class*='old'], [class*='cost']").each((__, priceEl) => {
        const value = parsePrice($(priceEl).text());
        if (value != null) priceCandidates.push(value);
      });

      const textPriceMatches = normalizeSpaces(root.text()).match(/\d+[.,]?\d*/g) || [];
      textPriceMatches.forEach((p) => {
        const value = parsePrice(p);
        if (value != null) priceCandidates.push(value);
      });

      const uniquePrices = [...new Set(priceCandidates)].filter((v) => v > 0 && v < 5000);

      if (uniquePrices.length === 0) return;

      const price = Math.min(...uniquePrices);
      const oldPrice = uniquePrices.length > 1 ? Math.max(...uniquePrices) : null;

      const imageUrl =
        root.find("img").first().attr("src") ||
        root.find("img").first().attr("data-src") ||
        null;

      const key = `${title}_${price}_${oldPrice || "n"}`;
      if (seen.has(key)) return;
      seen.add(key);

      const promo = buildPromotion(seen.size, title, price, oldPrice, imageUrl);
      if (promo) results.push(promo);
    });
  });

  return results;
}

async function loadPromotions() {
  const now = Date.now();

  if (now - cache.updatedAt < 10 * 60 * 1000 && cache.items.length > 0) {
    return cache.items;
  }

  let all = [];

  for (const url of PROMO_URLS) {
    try {
      const html = await fetchHtml(url);
      const items = extractPromotionsFromHtml(html);
      all = all.concat(items);
    } catch (error) {
      console.error("PROMO FETCH ERROR:", url, error.message);
    }
  }

  const unique = new Map();

  all.forEach((item, index) => {
    const normalized = {
      ...item,
      id: String(index + 1)
    };

    const key = `${normalized.title}_${normalized.price}_${normalized.oldPrice || "n"}`;
    if (!unique.has(key)) {
      unique.set(key, normalized);
    }
  });

  const finalItems = [...unique.values()]
    .filter((item) => item.oldPrice == null || item.oldPrice > item.price);

  cache = {
    updatedAt: now,
    items: finalItems
  };

  return finalItems;
}

app.get("/promotions/atb", async (req, res) => {
  try {
    const promotions = await loadPromotions();
    res.json(promotions);
  } catch (error) {
    console.error("ATB ERROR:", error);
    res.status(500).json({
      error: "Failed to load ATB promotions"
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
