const puppeteer = require("puppeteer");

const SILPO_URL = "https://silpo.ua/search";

const STORE_NUMERIC_ID = 2;
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
      item.mainImage ||
      ""
  );

  return {
    id: String(
      item.id ||
        item.offerId ||
        item.externalProductId ||
        item.slug ||
        item.article ||
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

async function acceptCookies(page) {
  const candidates = [
    "button",
    "[role='button']",
    "a"
  ];

  for (const selector of candidates) {
    const elements = await page.$$(selector);

    for (const element of elements) {
      try {
        const text = await page.evaluate(
          (node) => (node.innerText || node.textContent || "").trim(),
          element
        );

        if (/прийняти|accept|ok|добре|зрозуміло/i.test(text)) {
          await element.click({ delay: 50 }).catch(() => {});
          await sleep(1000);
          return;
        }
      } catch (_) {}
    }
  }
}

async function extractItemsFromPage(page) {
  return page.evaluate(() => {
    function readStateScript() {
      const script = document.querySelector('#serverApp-state');
      if (!script) {
        return null;
      }

      const raw = script.textContent || script.innerHTML || "";
      if (!raw.trim()) {
        return null;
      }

      try {
        return JSON.parse(raw);
      } catch (_) {
        return null;
      }
    }

    function collectItems(node, collector) {
      if (!node) {
        return;
      }

      if (Array.isArray(node)) {
        for (const item of node) {
          collectItems(item, collector);
        }
        return;
      }

      if (typeof node !== "object") {
        return;
      }

      const title = node.title || node.name;
      const hasPrice =
        node.price !== undefined ||
        node.displayPrice !== undefined ||
        node.currentPrice !== undefined;

      if (title && hasPrice) {
        collector.push(node);
      }

      if (Array.isArray(node.items)) {
        for (const item of node.items) {
          if (item && typeof item === "object") {
            collector.push(item);
          }
        }
      }

      for (const value of Object.values(node)) {
        collectItems(value, collector);
      }
    }

    const state = readStateScript();
    if (!state) {
      return [];
    }

    const collected = [];
    collectItems(state, collected);

    const unique = new Map();

    for (const item of collected) {
      const key = String(
        item.id ||
          item.offerId ||
          item.externalProductId ||
          item.slug ||
          item.title ||
          item.name ||
          Math.random()
      );

      if (!unique.has(key)) {
        unique.set(key, item);
      }
    }

    return Array.from(unique.values());
  });
}

async function searchProducts(page, query) {
  try {
    const url = `${SILPO_URL}?find=${encodeURIComponent(query)}`;

    console.log("SILPO QUERY:", query);

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    await sleep(2500);
    await acceptCookies(page);
    await sleep(1500);

    await page.waitForSelector("#serverApp-state", {
      timeout: 15000
    }).catch(() => {});

    const items = await extractItemsFromPage(page);

    console.log(`QUERY "${query}" RAW PRODUCTS:`, items.length);

    return items;
  } catch (error) {
    console.error(`Silpo search error for query "${query}":`, error.message);
    return [];
  }
}

async function getCategoryProducts(page, category) {
  const queries = CATEGORY_QUERIES[category] || [category];
  const uniqueProducts = new Map();

  console.log(`CATEGORY START: ${category}`);

  for (const query of queries) {
    if (uniqueProducts.size >= LIMIT_PER_CATEGORY) {
      break;
    }

    const rawProducts = await searchProducts(page, query);

    for (const rawProduct of rawProducts) {
      const builtProduct = buildProductRecord(rawProduct, category);

      if (!builtProduct) {
        continue;
      }

      const detected = detectCategory(builtProduct.title);

      if (detected && detected !== category) {
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

  const result = Array.from(uniqueProducts.values()).slice(0, LIMIT_PER_CATEGORY);

  console.log(`CATEGORY DONE: ${category} =>`, result.length);

  return result;
}

async function scrapeSilpo() {
  console.log("scrapeSilpo started");

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
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36"
    );

    await page.setExtraHTTPHeaders({
      "Accept-Language": "uk-UA,uk;q=0.9,en;q=0.8"
    });

    const allProducts = [];
    const globalUnique = new Map();

    for (const category of CATEGORY_ORDER) {
      const categoryProducts = await getCategoryProducts(page, category);

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

    console.log("SILPO FINAL:", allProducts.length);

    return allProducts;
  } catch (error) {
    console.error("SILPO SCRAPE ERROR:", error.message);
    return [];
  } finally {
    await browser.close();
  }
}

module.exports = {
  parsePrice,
  normalizeTitle,
  detectCategory,
  getCategoryProducts,
  scrapeSilpo
};
