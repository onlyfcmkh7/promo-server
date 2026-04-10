const axios = require("axios");

const STORE_ID = "silpo_kyiv";
const STORE_NUMERIC_ID = 2;
const BASE_URL = `https://stores-api.zakaz.ua/stores/${STORE_ID}/products/search`;

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
  low_alcohol: ["сидр", "ріді", "reeni", "слабоалкогольний напій", "hard seltzer", "коктейль алкогольний"],
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
  low_alcohol: /\b(сидр|слабоалкоголь|hard seltzer|алкогольний коктейль|коктейль алкогольний|ріді|reeni)\b/i,
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

function detectBrand(title, product = {}) {
  const directBrand =
    product.brand ||
    product.manufacturer ||
    product.tm ||
    product.trade_mark ||
    product.tradeMark ||
    product.brand_title ||
    product.brandTitle;

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
    return `https://stores-api.zakaz.ua${value}`;
  }

  return value;
}

function extractId(product, fallbackTitle) {
  const possibleKeys = [
    "id",
    "sku",
    "ean",
    "product_id",
    "productId",
    "uuid",
    "external_id",
    "externalId"
  ];

  for (const key of possibleKeys) {
    const value = product[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  return normalizeTitle(fallbackTitle);
}

function extractTitle(product) {
  const possibleKeys = [
    "title",
    "name",
    "display_name",
    "displayName",
    "full_title",
    "fullTitle"
  ];

  for (const key of possibleKeys) {
    const value = product[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return normalizeTitle(value);
    }
  }

  return "";
}

function extractImageUrl(product) {
  const directKeys = [
    "img",
    "image",
    "image_url",
    "imageUrl",
    "thumbnail",
    "photo",
    "photo_url",
    "photoUrl"
  ];

  for (const key of directKeys) {
    const value = product[key];
    if (value) {
      const normalized = normalizeImageUrl(value);
      if (normalized) {
        return normalized;
      }
    }
  }

  if (Array.isArray(product.images)) {
    for (const image of product.images) {
      if (!image) {
        continue;
      }

      if (typeof image === "string") {
        const normalized = normalizeImageUrl(image);
        if (normalized) {
          return normalized;
        }
      }

      if (typeof image === "object") {
        const nested =
          image.url ||
          image.src ||
          image.original ||
          image.big ||
          image.medium ||
          image.small;

        if (nested) {
          const normalized = normalizeImageUrl(nested);
          if (normalized) {
            return normalized;
          }
        }
      }
    }
  }

  return "";
}

function extractCurrentPrice(product) {
  const candidates = [
    product.price,
    product.current_price,
    product.currentPrice,
    product.sell_price,
    product.sellPrice,
    product.price_value,
    product.priceValue,
    product.discount_price,
    product.discountPrice
  ];

  for (const candidate of candidates) {
    const parsed = parsePrice(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }

  if (product.price && typeof product.price === "object") {
    const nestedCandidates = [
      product.price.value,
      product.price.current,
      product.price.amount,
      product.price.price
    ];

    for (const candidate of nestedCandidates) {
      const parsed = parsePrice(candidate);
      if (parsed !== null) {
        return parsed;
      }
    }
  }

  return null;
}

function extractOldPrice(product, currentPrice) {
  const candidates = [
    product.old_price,
    product.oldPrice,
    product.price_before_discount,
    product.priceBeforeDiscount,
    product.original_price,
    product.originalPrice,
    product.regular_price,
    product.regularPrice,
    product.compare_at_price,
    product.compareAtPrice
  ];

  for (const candidate of candidates) {
    const parsed = parsePrice(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }

  if (product.old_price && typeof product.old_price === "object") {
    const nestedCandidates = [
      product.old_price.value,
      product.old_price.amount
    ];

    for (const candidate of nestedCandidates) {
      const parsed = parsePrice(candidate);
      if (parsed !== null) {
        return parsed;
      }
    }
  }

  if (product.price && typeof product.price === "object") {
    const nestedCandidates = [
      product.price.old,
      product.price.before_discount,
      product.price.regular,
      product.price.compare_at
    ];

    for (const candidate of nestedCandidates) {
      const parsed = parsePrice(candidate);
      if (parsed !== null) {
        return parsed;
      }
    }
  }

  if (currentPrice !== null && currentPrice !== undefined) {
    return currentPrice;
  }

  return null;
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

function buildProductRecord(product, forcedCategory) {
  const title = extractTitle(product);
  if (!title) {
    return null;
  }

  const detectedCategory = detectCategory(title);
  const category = forcedCategory || detectedCategory;

  if (!category) {
    return null;
  }

  const price = extractCurrentPrice(product);
  if (price === null || price <= 0) {
    return null;
  }

  let oldPrice = extractOldPrice(product, price);
  if (oldPrice === null || oldPrice <= 0) {
    oldPrice = price;
  }

  if (oldPrice < price) {
    oldPrice = price;
  }

  return {
    id: extractId(product, title),
    storeId: STORE_NUMERIC_ID,
    category,
    brand: detectBrand(title, product),
    title,
    price,
    oldPrice,
    discountPercent: calculateDiscountPercent(price, oldPrice),
    imageUrl: extractImageUrl(product),
    createdAt: Date.now()
  };
}

async function searchProducts(query) {
  try {
    const response = await axios.get(BASE_URL, {
      params: { q: query },
      timeout: 30000,
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; SilpoZakazParser/1.0)"
      }
    });

    const payload = response.data || {};
    const results = Array.isArray(payload.results) ? payload.results : [];

    return results;
  } catch (error) {
    console.error(`Silpo search error for query "${query}":`, error.message);
    return [];
  }
}

async function getCategoryProducts(category) {
  const queries = CATEGORY_QUERIES[category] || [category];
  const uniqueProducts = new Map();

  for (const query of queries) {
    if (uniqueProducts.size >= 10) {
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

      if (uniqueProducts.size >= 10) {
        break;
      }
    }
  }

  return Array.from(uniqueProducts.values()).slice(0, 10);
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
