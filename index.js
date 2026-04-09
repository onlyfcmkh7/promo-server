const express = require("express");
const cheerio = require("cheerio");

const app = express();
const PORT = process.env.PORT || 3000;

const ATB_PROMO_URLS = [
  "https://www.atbmarket.com/promo/all?filter=0",
  "https://www.atbmarket.com/promo/sim_dniv",
  "https://www.atbmarket.com/promo/sale_tovari",
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
  "Referer": "https://www.atbmarket.com/",
  "Origin": "https://www.atbmarket.com"
};

function normalizeSpaces(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function parsePrice(value) {
  if (!value) return null;

  const cleaned = String(value)
    .replace(/\s/g, "")
    .replace(",", ".")
    .match(/\d+(?:\.\d+)?/);

  if (!cleaned) return null;

  const parsed = Number(cleaned[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractBrand(title) {
  const safeTitle = normalizeSpaces(title);
  if (!safeTitle) return null;
  return safeTitle.split(" ").slice(0, 2).join(" ").trim();
}

function detectCategory(title) {
  const value = normalizeSpaces(title).toLowerCase();

  if (
    value.includes("молоко") ||
    value.includes("кефір") ||
    value.includes("сметана") ||
    value.includes("ряжанка") ||
    value.includes("йогурт") ||
    value.includes("сир ")
  ) return "dairy";

  if (
    value.includes("хліб") ||
    value.includes("батон") ||
    value.includes("лаваш") ||
    value.includes("булочки")
  ) return "bread";

  if (
    value.includes("куря") ||
    value.includes("курче") ||
    value.includes("філе") ||
    value.includes("гомілка") ||
    value.includes("стегно") ||
    value.includes("крило")
  ) return "chicken";

  if (value.includes("кетчуп") || value.includes("соус")) return "ketchup";

  if (value.includes("олія")) return "oil";

  if (value.includes("шоколад")) return "chocolate";

  if (value.includes("вода")) return "water";

  if (
    value.includes("пиво") ||
    value.includes("сидр") ||
    value.includes("віскі") ||
    value.includes("горілка") ||
    value.includes("вино") ||
    value.includes("слабоалкоголь")
  ) return "alcohol";

  return "other";
}

function buildPromotion({
  id,
  title,
  price,
  oldPrice,
  imageUrl,
  createdAt,
  category
}) {
  const safeTitle = normalizeSpaces(title);
  if (!safeTitle || price == null) return null;

  return {
    id: String(id),
    storeId: 1,
    category: category || detectCategory(safeTitle),
    brand: extractBrand(safeTitle),
    title: safeTitle,
    price,
    oldPrice,
    discountPercent:
      oldPrice && oldPrice > price
        ? Math.round(((oldPrice - price) / oldPrice) * 100)
        : null,
    createdAt: createdAt || Date.now(),
    imageUrl: imageUrl || null
  };
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: DEFAULT_HEADERS
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.text();
}

function extractFromJsonScripts(html) {
  const $ = cheerio.load(html);
  const items = [];

  $("script").each((_, el) => {
    const text = $(el).html() || "";

    if (!text) return;

    const priceMatches = text.match(/"price"\s*:\s*"?\d+[.,]?\d*"?/g);
    const titleMatches = text.match(/"name"\s*:\s*"([^"]+)"/g);

    if (!priceMatches || !titleMatches) return;

    const names = titleMatches
      .map(x => x.match(/"name"\s*:\s*"([^"]+)"/)?.[1])
      .filter(Boolean);

    const prices = priceMatches
      .map(x => parsePrice(x))
      .filter(x => x != null);

    for (let i = 0; i < Math.min(names.length, prices.length); i++) {
      items.push({
        title: names[i],
        price: prices[i],
        oldPrice: null,
        imageUrl: null,
        createdAt: Date.now()
      });
    }
  });

  return items;
}

function extractFromDom(html) {
  const $ = cheerio.load(html);
  const items = [];

  const cardSelectors = [
    "[class*='product']",
    "[class*='promo']",
    "[class*='card']",
    "[class*='item']",
    "article",
    ".swiper-slide"
  ];

  const seen = new Set();

  cardSelectors.forEach(selector => {
    $(selector).each((_, el) => {
      const root = $(el);

      const title =
        normalizeSpaces(
          root.find("h1, h2, h3, h4, [class*='title'], [class*='name']").first().text()
        ) ||
        normalizeSpaces(root.text()).slice(0, 160);

      const rawPrices = [];
      root.find("[class*='price'], [class*='cost'], [class*='old']").each((__, priceEl) => {
        const price = parsePrice($(priceEl).text());
        if (price != null) rawPrices.push(price);
      });

      const uniqPrices = [...new Set(rawPrices)];
      const currentPrice = uniqPrices.length > 0 ? Math.min(...uniqPrices) : null;
      const oldPrice = uniqPrices.length > 1 ? Math.max(...uniqPrices) : null;

      const imageUrl =
        root.find("img").first().attr("src") ||
        root.find("img").first().attr("data-src") ||
        null;

      if (!title || currentPrice == null) return;

      const key = `${title}_${currentPrice}_${oldPrice || "n"}`;
      if (seen.has(key)) return;
      seen.add(key);

      items.push({
        title,
        price: currentPrice,
        oldPrice,
        imageUrl,
        createdAt: Date.now()
      });
    });
  });

  return items;
}

async function scrapeAtbPromotions() {
  let rawItems = [];

  for (const url of ATB_PROMO_URLS) {
    try {
      const html = await fetchHtml(url);
      const domItems = extractFromDom(html);
      const jsonItems = extractFromJsonScripts(html);
      rawItems = [...rawItems, ...domItems, ...jsonItems];
    } catch (error) {
      console.error(`Failed to fetch ${url}:`, error.message);
    }
  }

  const unique = new Map();

  rawItems.forEach((item, index) => {
    const promo = buildPromotion({
      id: index + 1,
      ...item
    });

    if (!promo) return;

    const key = `${promo.title}_${promo.price}_${promo.oldPrice || "n"}`;
    if (!unique.has(key)) {
      unique.set(key, promo);
    }
  });

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  return [...unique.values()]
    .filter(item => item.createdAt >= sevenDaysAgo)
    .filter(item => item.oldPrice == null || item.oldPrice > item.price);
}

app.get("/promotions/atb", async (req, res) => {
  try {
    const promotions = await scrapeAtbPromotions();
    res.json(promotions);
  } catch (error) {
    console.error("ATB scrape error:", error);
    res.status(500).json({
      error: "Failed to load ATB promotions",
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
