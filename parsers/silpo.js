const axios = require("axios");

const STORE_NUMERIC_ID = 2;
const BASE_URL = "https://silpo.ua/search";
const LIMIT_PER_CATEGORY = 10;

const CATEGORY_ORDER = [
  "dairy",
  "bread",
  "chicken",
  "pork",
  "veal",
  "fish",
  "seafood",
  "sauces",
  "oil",
  "chocolate",
  "water",
  "beer",
  "low_alcohol",
  "strong_alcohol"
];

const CATEGORY_QUERIES = {
  dairy: ["молоко", "кефір", "йогурт", "сир", "масло", "сметана"],
  bread: ["хліб", "батон", "багет", "лаваш", "булочка"],
  chicken: ["курка", "куряче філе", "стегно куряче", "гомілка куряча"],
  pork: ["свинина", "свинячий ошийок", "свиняча лопатка", "свинячі ребра"],
  veal: ["телятина", "теляче м'ясо", "теляча вирізка"],
  fish: ["риба", "лосось", "форель", "оселедець", "скумбрія"],
  seafood: ["креветки", "мідії", "кальмар", "морепродукти"],
  sauces: ["кетчуп", "майонез", "соус", "гірчиця", "соєвий соус"],
  oil: ["олія", "оливкова олія", "соняшникова олія"],
  chocolate: ["шоколад", "шоколадка"],
  water: ["вода", "мінеральна вода", "газована вода", "негазована вода"],
  beer: ["пиво", "lager", "ale"],
  low_alcohol: ["сидр", "слабоалкогольний напій", "hard seltzer", "коктейль алкогольний"],
  strong_alcohol: ["горілка", "віскі", "коньяк", "ром", "джин", "текіла", "бренді", "лікер"]
};

const CATEGORY_REGEX = {
  dairy: /\b(молоко|кефір|ряжанка|йогурт|сир|творог|кисломолочн|сметан|вершк|масло\b|моцарел|бринз|фет[аи]?|гауд|чедер|пармезан|маскарпоне|рікот|айран)\b/i,
  bread: /\b(хліб|батон|багет|лаваш|булочк|чіабат|бріош|тостов|паляниц|круасан)\b/i,
  chicken: /\b(курк|куряч|філе кур|стегно кур|гомілка кур|крило кур)\b/i,
  pork: /\b(свинин|свиняч|ошийок|ребра свин|лопатка свин|корейка свин)\b/i,
  veal: /\b(телятина|теляч|теляче)\b/i,
  fish: /\b(риба|лосос|форел|оселед|скумбр|тунец|хек|минтай|дорадо|сибас|короп)\b/i,
  seafood: /\b(кревет|міді|миді|кальмар|морепродукт|восьмин|лангустин|рапан)\b/i,
  sauces: /\b(соус|кетчуп|майонез|гірчиц|гірчичн|теріякі|барбекю|bbq|песто|сацебелі|аджика|соєвий)\b/i,
  oil: /\b(олія|оливкова олія|соняшникова олія|кукурудзяна олія|рапсова олія|масло оливкове)\b/i,
  chocolate: /\b(шоколад|шоколадка|chocolate)\b/i,
  water: /\b(вода|мінеральна вода|газована вода|негазована вода|питна вода)\b/i,
  beer: /\b(пиво|lager|ale|stout|ipa|porter|пшеничне пиво)\b/i,
  low_alcohol: /\b(сидр|слабоалкоголь|hard seltzer|алкогольний коктейль|коктейль алкогольний)\b/i,
  strong_alcohol: /\b(горілка|віскі|коньяк|ром|джин|текіла|бренді|лікер|настоянка|бурбон)\b/i
};

function parsePrice(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return null;
    }

    if (value > 1000) {
      return Number((value / 100).toFixed(2));
    }

    return Number(value.toFixed(2));
  }

  const cleaned = String(value)
    .replace(/\s+/g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");

  if (!cleaned) {
    return null;
  }

  const parsed = Number(cleaned);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  if (parsed > 1000) {
    return Number((parsed / 100).toFixed(2));
  }

  return Number(parsed.toFixed(2));
}

function normalizeTitle(title) {
  return String(title || "")
    .replace(/\s+/g, " ")
    .replace(/[«»"]/g, '"')
    .replace(/\s*\|\s*/g, " ")
    .replace(/\s*-\s*$/g, "")
    .trim();
}

function detectCategory(title) {
  const normalized = normalizeTitle(title).toLowerCase();

  for (const category of CATEGORY_ORDER) {
    const regex = CATEGORY_REGEX[category];
    if (regex && regex.test(normalized)) {
      return category;
    }
  }

  return null;
}

function normalizeImageUrl(url) {
  if (!url) {
    return "";
  }

  const value = String(url).trim();

  if (!value) {
    return "";
  }

  if (value.startsWith("//")) {
    return `https:${value}`;
  }

  if (value.startsWith("/")) {
    return `https://silpo.ua${value}`;
  }

  return value;
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function detectBrand(title, item = {}) {
  const directBrand =
    item.brandTitle ||
    item.brand ||
    item.tm ||
    item.manufacturer ||
    item.tradeMark ||
    item.trade_mark;

  if (directBrand) {
    return String(directBrand).trim();
  }

  const safeTitle = normalizeTitle(title);
  const quoted = safeTitle.match(/"([^"]+)"/);

  if (quoted && quoted[1]) {
    return quoted[1].trim();
  }

  return safeTitle.split(" ")[0] || "";
}

function calculateDiscountPercent(price, oldPrice) {
  if (
    price === null ||
    oldPrice === null ||
    !Number.isFinite(price) ||
    !Number.isFinite(oldPrice) ||
    oldPrice <= 0 ||
    oldPrice <= price
  ) {
    return 0;
  }

  return Math.round(((oldPrice - price) / oldPrice) * 100);
}

function extractServerAppState(html) {
  const match = html.match(
    /<script[^>]+id="serverApp-state"[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/i
  );

  if (!match || !match[1]) {
    return null;
  }

  const rawJson = decodeHtmlEntities(match[1].trim());

  try {
    return JSON.parse(rawJson);
  } catch (error) {
    return null;
  }
}

function collectItemsFromNode(node, collector) {
  if (!node) {
    return;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      collectItemsFromNode(item, collector);
    }
    return;
  }

  if (typeof node !== "object") {
    return;
  }

  if (Array.isArray(node.items)) {
    for (const item of node.items) {
      if (item && typeof item === "object") {
        collector.push(item);
      }
    }
  }

  for (const value of Object.values(node)) {
    collectItemsFromNode(value, collector);
  }
}

function extractItemsFromState(state) {
  const collected = [];
  collectItemsFromNode(state, collected);

  const unique = new Map();

  for (const item of collected) {
    const rawId =
      item.id ||
      item.offerId ||
      item.externalProductId ||
      item.slug ||
      item.title;

    if (!rawId) {
      continue;
    }

    const key = String(rawId).trim();

    if (!unique.has(key)) {
      unique.set(key, item);
    }
  }

  return Array.from(unique.values());
}

function buildProductRecord(item, forcedCategory) {
  const title = normalizeTitle(item.title || item.name || "");
  if (!title) {
    return null;
  }

  const detectedCategory = detectCategory(title);
  const category = forcedCategory || detectedCategory;

  if (!category) {
    return null;
  }

  const price = parsePrice(
    item.displayPrice ??
      item.price ??
      item.currentPrice ??
      item.display_price
  );

  if (price === null || price <= 0) {
    return null;
  }

  let oldPrice = parsePrice(
    item.displayOldPrice ??
      item.oldPrice ??
      item.old_price ??
      item.displayOld_price
  );

  if (oldPrice === null || oldPrice <= 0) {
    oldPrice = price;
  }

  if (oldPrice < price) {
    oldPrice = price;
  }

  const imageUrl = normalizeImageUrl(
    item.iconPath ||
      item.image ||
      item.imageUrl ||
      item.photo ||
      ""
  );

  return {
    id: String(
      item.id ||
        item.offerId ||
        item.externalProductId ||
        item.slug ||
        title
    ).trim(),
    storeId: STORE_NUMERIC_ID,
    category,
    brand: detectBrand(title, item),
    title,
    price,
    oldPrice,
    discountPercent: calculateDiscountPercent(price, oldPrice),
    imageUrl,
    createdAt: Date.now()
  };
}

async function searchProducts(query) {
  try {
    const response = await axios.get(BASE_URL, {
      params: { find: query },
      timeout: 30000,
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 (compatible; SilpoHtmlParser/1.0)"
      }
    });

    const html = String(response.data || "");
    if (!html) {
      return [];
    }

    const state = extractServerAppState(html);
    if (!state) {
      return [];
    }

    return extractItemsFromState(state);
  } catch (error) {
    console.error(`Silpo search error for query "${query}":`, error.message);
    return [];
  }
}

async function getCategoryProducts(category) {
  const queries = CATEGORY_QUERIES[category] || [category];
  const uniqueProducts = new Map();

  for (const query of queries) {
    if (uniqueProducts.size >= LIMIT_PER_CATEGORY) {
      break;
    }

    const rawProducts = await searchProducts(query);

    for (const rawProduct of rawProducts) {
      const builtProduct = buildProductRecord(rawProduct, category);

      if (!builtProduct) {
        continue;
      }

      const detectedCategory = detectCategory(builtProduct.title);

      if (detectedCategory && detectedCategory !== category) {
        continue;
      }

      const uniqueKey = `${builtProduct.category}|${builtProduct.id}|${builtProduct.title.toLowerCase()}`;

      if (!uniqueProducts.has(uniqueKey)) {
        uniqueProducts.set(uniqueKey, builtProduct);
      }

      if (uniqueProducts.size >= LIMIT_PER_CATEGORY) {
        break;
      }
    }
  }

  return Array.from(uniqueProducts.values()).slice(0, LIMIT_PER_CATEGORY);
}

async function scrapeSilpo() {
  try {
    const allProducts = [];
    const globalUnique = new Map();

    for (const category of CATEGORY_ORDER) {
      const categoryProducts = await getCategoryProducts(category);

      for (const product of categoryProducts) {
        const uniqueKey = `${product.category}|${product.title.toLowerCase()}|${product.price}|${product.oldPrice}`;

        if (!globalUnique.has(uniqueKey)) {
          globalUnique.set(uniqueKey, product);
        }
      }
    }

    for (const product of globalUnique.values()) {
      allProducts.push(product);
    }

    return allProducts;
  } catch (error) {
    console.error("SILPO SCRAPE ERROR:", error.message);
    return [];
  }
}

module.exports = {
  parsePrice,
  normalizeTitle,
  detectCategory,
  getCategoryProducts,
  scrapeSilpo
};
