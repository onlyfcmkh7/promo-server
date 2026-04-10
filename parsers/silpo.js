const puppeteer = require("puppeteer");

const SILPO_OFFERS_URL = "https://silpo.ua/offers";
const STORE_NUMERIC_ID = 2;
const LIMIT_TOTAL = 200;

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
  chocolate: /\b(шоколад|шоколадка|chocolate|панеттоне|кекс)\b/i,
  water: /\b(вода|мінеральна вода|газована вода|негазована вода|питна вода)\b/i,
  beer: /\b(пиво|lager|ale|stout|ipa|porter|пшеничне пиво)\b/i,
  low_alcohol: /\b(сидр|слабоалкоголь|hard seltzer|алкогольний коктейль|коктейль алкогольний)\b/i,
  strong_alcohol: /\b(горілка|віскі|коньяк|ром|джин|текіла|бренді|лікер|настоянка|бурбон)\b/i
};

const BAD_TITLE_PATTERNS = [
  /^only_online$/i,
  /^melkoopt$/i,
  /^new$/i,
  /^chef$/i,
  /^logo$/i,
  /^facebook$/i,
  /^instagram$/i,
  /^telegram$/i,
  /^viber$/i,
  /^цінотижики$/i
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePrice(value) {
  if (!value && value !== 0) return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
  }

  const cleaned = String(value)
    .replace(/\s+/g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");

  if (!cleaned) return null;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : null;
}

function normalizeTitle(title) {
  return String(title || "")
    .replace(/\s+/g, " ")
    .replace(/[«»"]/g, '"')
    .replace(/\s*\|\s*/g, " ")
    .replace(/\s*-\s*$/g, "")
    .trim();
}

function isTrashTitle(title) {
  const value = normalizeTitle(title);

  if (!value) return true;
  if (value.length < 6) return true;

  for (const pattern of BAD_TITLE_PATTERNS) {
    if (pattern.test(value)) return true;
  }

  if (/^[a-z0-9_-]+$/i.test(value) && !/\s/.test(value)) {
    return true;
  }

  return false;
}

function detectCategory(title) {
  const normalized = normalizeTitle(title).toLowerCase();

  for (const category of CATEGORY_ORDER) {
    const regex = CATEGORY_REGEX[category];
    if (regex && regex.test(normalized)) {
      return category;
    }
  }

  return "other";
}

function normalizeImageUrl(url) {
  if (!url) return "";

  const value = String(url).trim();
  if (!value) return "";

  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("/")) return `https://silpo.ua${value}`;

  return value;
}

function detectBrand(title) {
  const safeTitle = normalizeTitle(title);
  const quoted = safeTitle.match(/"([^"]+)"/);

  if (quoted?.[1]) {
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

async function acceptCookies(page) {
  const selectors = ["button", "a", "[role='button']"];

  for (const selector of selectors) {
    const elements = await page.$$(selector);

    for (const element of elements) {
      try {
        const text = await page.evaluate(
          (node) => (node.innerText || node.textContent || "").trim(),
          element
        );

        if (/прийняти|accept|добре|ok|зрозуміло/i.test(text)) {
          await element.click({ delay: 50 }).catch(() => {});
          await sleep(1000);
          return;
        }
      } catch (_) {}
    }
  }
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      const distance = 900;
      let idleTicks = 0;
      let lastHeight = document.body.scrollHeight;

      const timer = setInterval(() => {
        window.scrollBy(0, distance);

        const currentHeight = document.body.scrollHeight;

        if (currentHeight === lastHeight) {
          idleTicks += 1;
        } else {
          idleTicks = 0;
          lastHeight = currentHeight;
        }

        if (idleTicks >= 5) {
          clearInterval(timer);
          resolve();
        }
      }, 500);
    });
  });
}

async function extractOfferItems(page) {
  return page.evaluate(() => {
    function text(node) {
      return String(node?.innerText || node?.textContent || "")
        .replace(/\s+/g, " ")
        .trim();
    }

    function normalize(value) {
      return String(value || "")
        .replace(/\s+/g, " ")
        .trim();
    }

    function parseLocalPrice(value) {
      const cleaned = String(value || "")
        .replace(/\s+/g, "")
        .replace(",", ".")
        .replace(/[^\d.]/g, "");

      if (!cleaned) return null;

      const parsed = Number(cleaned);
      return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : null;
    }

    function hasMoney(value) {
      return /\d[\d\s.,]{0,20}\s*(грн|₴)/i.test(String(value || ""));
    }

    function isOldPriceLine(value) {
      const v = normalize(value);
      return /^\d[\d\s.,]{0,20}\s*(грн|₴)$/i.test(v);
    }

    function isWeightLine(value) {
      const v = normalize(value);
      return /^\d+([.,]\d+)?\s?(г|кг|мл|л|шт)$/i.test(v);
    }

    function isRatingLine(value) {
      const v = normalize(value);
      return /^★\s?\d([.,]\d)?$/i.test(v) || /^\d([.,]\d)?$/i.test(v);
    }

    function isDiscountLine(value) {
      const v = normalize(value);
      return /^-\d+%$/i.test(v);
    }

    function isTrashTitle(value) {
      const v = normalize(value);

      if (!v) return true;
      if (v.length < 6) return true;
      if (/^only_online$/i.test(v)) return true;
      if (/^melkoopt$/i.test(v)) return true;
      if (/^new$/i.test(v)) return true;
      if (/^logo$/i.test(v)) return true;
      if (/^[a-z0-9_-]+$/i.test(v) && !/\s/.test(v)) return true;
      if (hasMoney(v)) return true;
      if (isWeightLine(v)) return true;
      if (isRatingLine(v)) return true;
      if (isDiscountLine(v)) return true;
      if (/facebook|instagram|telegram|viber|цінотижики/i.test(v)) return true;

      return false;
    }

    function getImageUrl(node) {
      if (!node) return "";
      return (
        node.currentSrc ||
        node.src ||
        node.getAttribute("src") ||
        node.getAttribute("data-src") ||
        ""
      );
    }

    function getAllTextLines(card) {
      const nodes = Array.from(card.querySelectorAll("div, span, p, a, h2, h3, h4, h5"));
      const values = [];

      for (const node of nodes) {
        const v = normalize(text(node));
        if (!v) continue;
        if (v.length > 180) continue;
        values.push(v);
      }

      return Array.from(new Set(values));
    }

    function extractPrices(card) {
      const nodes = Array.from(card.querySelectorAll("div, span, p, a, strong, b"));
      const raw = [];

      for (const node of nodes) {
        const v = normalize(text(node));
        if (!v) continue;
        if (v.length > 30) continue;
        if (!isOldPriceLine(v)) continue;
        raw.push(v);
      }

      const numeric = Array.from(
        new Set(
          raw.map(parseLocalPrice).filter((v) => v !== null && v > 0)
        )
      ).sort((a, b) => a - b);

      if (numeric.length === 0) return { price: null, oldPrice: null };

      return {
        price: numeric[0],
        oldPrice: numeric.length > 1 ? numeric[numeric.length - 1] : numeric[0]
      };
    }

    function extractDiscountPercent(card) {
      const fullText = text(card);
      const match = fullText.match(/-\s*(\d+)%/i);
      return match ? Number(match[1]) : null;
    }

    function extractTitle(card) {
      const lines = getAllTextLines(card);

      const candidates = lines.filter((line) => !isTrashTitle(line));

      if (!candidates.length) {
        return "";
      }

      const titleCandidates = candidates.filter((line) => {
        const words = line.split(/\s+/).filter(Boolean);
        return words.length >= 2;
      });

      const sorted = (titleCandidates.length ? titleCandidates : candidates)
        .sort((a, b) => a.length - b.length);

      return sorted[0] || "";
    }

    function isProbablyProductCard(node) {
      if (!node) return false;

      const img = node.querySelector("img");
      if (!img) return false;

      const fullText = text(node);
      if (!hasMoney(fullText)) return false;

      const prices = extractPrices(node);
      if (!prices.price) return false;

      const title = extractTitle(node);
      if (!title) return false;

      return true;
    }

    const candidateNodes = Array.from(document.querySelectorAll("article, li, div, section"));
    const cards = candidateNodes.filter(isProbablyProductCard);

    const result = [];
    const seen = new Set();

    for (const card of cards) {
      const { price, oldPrice } = extractPrices(card);
      const title = extractTitle(card);

      if (!title || !price) continue;

      const imageNode = card.querySelector("img");
      const imageUrl = getImageUrl(imageNode);

      const key = `${title.toLowerCase()}|${price}|${oldPrice}`;
      if (seen.has(key)) continue;
      seen.add(key);

      result.push({
        title,
        price,
        oldPrice,
        discountPercent: extractDiscountPercent(card),
        imageUrl
      });
    }

    return result;
  });
}

function mapOfferItem(rawItem, index) {
  const title = normalizeTitle(rawItem.title);

  if (!title || isTrashTitle(title)) {
    return null;
  }

  const price = parsePrice(rawItem.price);
  if (price === null || price <= 0) {
    return null;
  }

  let oldPrice = parsePrice(rawItem.oldPrice);
  if (oldPrice === null || oldPrice <= 0) {
    oldPrice = price;
  }

  if (oldPrice < price) {
    oldPrice = price;
  }

  return {
    id: String(index + 1),
    storeId: STORE_NUMERIC_ID,
    category: detectCategory(title),
    brand: detectBrand(title),
    title,
    price,
    oldPrice,
    discountPercent:
      rawItem.discountPercent && rawItem.discountPercent > 0
        ? rawItem.discountPercent
        : calculateDiscountPercent(price, oldPrice),
    imageUrl: normalizeImageUrl(rawItem.imageUrl),
    createdAt: Date.now()
  };
}

async function scrapeSilpo() {
  console.log("🚀 START SILPO OFFERS");

  const browser = await puppeteer.launch({
    headless: "new",
    protocolTimeout: 180000,
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
      timeout: 60000
    });

    await sleep(3000);
    await acceptCookies(page);
    await autoScroll(page);
    await sleep(2500);

    const rawItems = await extractOfferItems(page);

    console.log("SILPO RAW OFFERS:", rawItems.length);

    const deduped = new Map();

    rawItems.forEach((rawItem, index) => {
      const item = mapOfferItem(rawItem, index);
      if (!item) return;

      const key = `${item.title.toLowerCase()}|${item.price}|${item.oldPrice}`;
      if (!deduped.has(key)) {
        deduped.set(key, item);
      }
    });

    const items = Array.from(deduped.values()).slice(0, LIMIT_TOTAL);

    console.log("SILPO FINAL OFFERS:", items.length);

    return items;
  } catch (error) {
    console.error("SILPO OFFERS ERROR:", error.message);
    return [];
  } finally {
    await browser.close();
  }
}

module.exports = {
  parsePrice,
  normalizeTitle,
  detectCategory,
  scrapeSilpo
};
