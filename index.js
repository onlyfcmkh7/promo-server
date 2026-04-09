/* server.js */
const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

/**
 * Офіційні сторінки АТБ з акційними товарами.
 * /promo/sale_tovari  -> "Акційні пропозиції"
 * /catalog/economy    -> "Акція Економія"
 * /catalog/388-aktsiya-7-dniv -> "Акція 7 днів"
 */
const ATB_PROMO_URLS = [
  "https://www.atbmarket.com/promo/sale_tovari",
  "https://www.atbmarket.com/catalog/economy",
  "https://www.atbmarket.com/catalog/388-aktsiya-7-dniv",
];

const STORE_ID = 1;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 хв
let cache = {
  at: 0,
  data: [],
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeWhitespace(value) {
  return (value || "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePrice(value) {
  if (!value) return null;
  const normalized = String(value).replace(",", ".").replace(/[^\d.]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampPercent(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.max(0, Math.min(100, Math.round(x)));
}

function computeDiscountPercent(price, oldPrice, fallback) {
  if (Number.isFinite(price) && Number.isFinite(oldPrice) && oldPrice > price && oldPrice > 0) {
    return Math.round(((oldPrice - price) / oldPrice) * 100);
  }
  return clampPercent(fallback);
}

function parseDdMm(ddmm) {
  if (!ddmm) return null;
  const match = ddmm.match(/^(\d{1,2})\.(\d{1,2})$/);
  if (!match) return null;

  const now = new Date();
  const year = now.getFullYear();
  const day = Number(match[1]);
  const month = Number(match[2]) - 1;

  const d = new Date(year, month, day, 12, 0, 0, 0);
  if (Number.isNaN(d.getTime())) return null;

  // Підстраховка на перехід року (грудень/січень)
  const diffDays = Math.round((d.getTime() - now.getTime()) / 86400000);
  if (diffDays < -330) {
    d.setFullYear(year + 1);
  } else if (diffDays > 330) {
    d.setFullYear(year - 1);
  }

  return d;
}

function isWithinNext7Days(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return false;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endLimit = startOfToday + 7 * 24 * 60 * 60 * 1000;
  return date.getTime() >= startOfToday && date.getTime() <= endLimit;
}

function inferCreatedAt(endDate) {
  if (endDate instanceof Date && !Number.isNaN(endDate.getTime())) {
    return endDate.getTime() - 7 * 24 * 60 * 60 * 1000;
  }
  return Date.now();
}

function detectCategory(title) {
  const t = (title || "").toLowerCase();

  const rules = [
    ["dairy", /(молоко|кефір|йогурт|сметан|вершки|сир\b|сирки|сирок|масло|ряжанка|закваска|молоч)/],
    ["meat", /(ковбас|сосиск|сардель|курка|курятина|індич|свинина|ялович|м'яс|фарш|бекон|шинка|паштет)/],
    ["fish", /(риба|лосось|оселед|тунець|скумбр|сардин|морепродукт|крабов|капуста морська|морська капуста)/],
    ["bakery", /(хліб|батон|лаваш|булоч|круасан|тісто|пиріг|печиво|вафл|пряник|сушка|сухар|торт|тістечк)/],
    ["drinks", /(вода|сік|нектар|напій|лимонад|квас|чай|кава|какао|енергетич|кола|мінеральна)/],
    ["alcohol", /(пиво|вино|горілка|бренді|коньяк|віскі|ром|джин|лікер|вермут|ігристе|слабоалкоголь)/],
    ["snacks", /(чипси|снеки|горішк|сухофрукт|крекер|батончик|попкорн|кукурудзян|насіння)/],
    ["sweets", /(цукерк|шоколад|десерт|зефір|мармелад|драже|паста шоколадно|печиво)/],
    ["baby", /(gerber|дитяч|пюре|підгузк|суміш)/],
    ["household", /(порошок|миюч|засіб|серветки|рушники|туалетний папір|пластир|ватні палички|дезодорант|шампунь|крем|мило)/],
    ["groceries", /(консерви|крупи|макарон|майонез|соус|кетчуп|олія|оцет|приправ|булгур|рис|греч|борошно|цукор|сіль|чай)/],
  ];

  for (const [category, regex] of rules) {
    if (regex.test(t)) return category;
  }

  return "other";
}

function extractBrand(title) {
  const original = normalizeWhitespace(title);
  if (!original) return "Unknown";

  // Спочатку спробуємо знайти відомі 2-3-слівні бренди
  const multiWordCandidates = [
    "Своя Лінія",
    "Розумний Вибір",
    "Revers Cosmetics",
    "Black Royal Tea",
  ];

  for (const candidate of multiWordCandidates) {
    const re = new RegExp(candidate, "i");
    if (re.test(original)) {
      return candidate.replace("Вибір", "вибір").replace("Лінія", "Лінія");
    }
  }

  // Витягаємо слова-кандидати з великої літери
  const genericWords = new Set([
    "Морська", "Капуста", "Напій", "Бренді", "Консерви", "Чай", "Добавка",
    "Кава", "Крем", "Пельмені", "Чипси", "Кульки", "Батончик", "Набір",
    "Пюре", "Порошок", "Горілка", "Вода", "Сік", "Молоко", "Йогурт",
    "Сметана", "Сир", "Сирок", "Цукерки", "Шоколад", "Печиво",
  ]);

  const matches = [...original.matchAll(/\b[А-ЯІЇЄҐA-Z][A-Za-zА-Яа-яІіЇїЄєҐґ'’.-]+(?:\s+[А-ЯІЇЄҐA-Z][A-Za-zА-Яа-яІіЇїЄєҐґ'’.-]+){0,2}/g)]
    .map((m) => normalizeWhitespace(m[0]))
    .filter(Boolean);

  const filtered = matches.filter((m) => {
    const first = m.split(" ")[0];
    return !genericWords.has(first);
  });

  if (filtered.length > 0) {
    filtered.sort((a, b) => b.length - a.length);
    return filtered[0];
  }

  // fallback: перше слово після ваги/об'єму
  const afterUnits = original
    .replace(/\b\d+[.,]?\d*\s?(кг|г|л|мл|шт|таб|капс|уп|пак|пет)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const word = afterUnits.split(" ").find((w) => /^[A-ZА-ЯІЇЄҐ]/.test(w));
  return word || "Unknown";
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let total = 0;
      const distance = 800;
      const timer = setInterval(() => {
        const maxScroll = document.body.scrollHeight;
        window.scrollBy(0, distance);
        total += distance;

        if (total >= maxScroll) {
          clearInterval(timer);
          resolve();
        }
      }, 250);
    });
  });
}

async function accept18PlusIfNeeded(page) {
  const buttons = await page.$$("button, a, div[role='button']");
  for (const button of buttons) {
    try {
      const text = await page.evaluate((el) => (el.innerText || el.textContent || "").trim(), button);
      if (/Так мені вже є 18/i.test(text)) {
        await button.click({ delay: 50 });
        await sleep(800);
        break;
      }
    } catch (_) {
      // ignore
    }
  }
}

async function extractPromoItemsFromPage(page, sourceUrl) {
  await page.goto(sourceUrl, {
    waitUntil: "networkidle2",
    timeout: 90000,
  });

  await sleep(2000);
  await accept18PlusIfNeeded(page);
  await autoScroll(page);
  await sleep(1500);

  const items = await page.evaluate(() => {
    function text(el) {
      return (el?.innerText || el?.textContent || "")
        .replace(/\u00A0/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    function attr(el, name) {
      return el?.getAttribute?.(name) || "";
    }

    function findCard(el) {
      let current = el;
      while (current) {
        const t = text(current);
        const hasPrice = /\d+[.,]\d{2}\s*грн\/шт/i.test(t);
        const hasDiscount = /-\d+%/.test(t);
        if (hasPrice || hasDiscount) return current;
        current = current.parentElement;
      }
      return el.parentElement || el;
    }

    function getImage(card) {
      const img = card.querySelector("img");
      if (!img) return "";
      return (
        img.currentSrc ||
        attr(img, "src") ||
        attr(img, "data-src") ||
        attr(img, "data-lazy-src") ||
        ""
      ).trim();
    }

    const links = [...document.querySelectorAll('a[href*="/product/"]')];
    const seen = new Set();
    const result = [];

    for (const link of links) {
      const href = link.href || attr(link, "href");
      const title = text(link);

      if (!href || !title) continue;

      const uniq = `${href}__${title}`;
      if (seen.has(uniq)) continue;
      seen.add(uniq);

      const card = findCard(link);
      const cardText = text(card);

      const priceMatch = cardText.match(/(\d+[.,]\d{2})\s*грн\/шт\s*(\d+[.,]\d{2})/i);
      const discountMatch = cardText.match(/-(\d+)%/);
      const endDateMatch = cardText.match(/до\s*(\d{2}\.\d{2})/i);

      if (!priceMatch && !discountMatch) continue;

      result.push({
        href,
        title,
        cardText,
        imageUrl: getImage(card),
        priceText: priceMatch ? priceMatch[1] : null,
        oldPriceText: priceMatch ? priceMatch[2] : null,
        discountText: discountMatch ? discountMatch[1] : null,
        endDateText: endDateMatch ? endDateMatch[1] : null,
      });
    }

    return result;
  });

  return items;
}

function normalizeAtbItems(rawItems) {
  const normalized = [];

  for (const raw of rawItems) {
    const title = normalizeWhitespace(raw.title);
    const price = parsePrice(raw.priceText);
    const oldPrice = parsePrice(raw.oldPriceText);
    const discountPercent = computeDiscountPercent(price, oldPrice, raw.discountText);

    if (!title) continue;
    if (!Number.isFinite(price) || !Number.isFinite(oldPrice)) continue;
    if (!(oldPrice > price)) continue;

    const endDate = parseDdMm(raw.endDateText);
    if (raw.endDateText && !isWithinNext7Days(endDate)) {
      continue;
    }

    normalized.push({
      id: raw.href || title,
      storeId: STORE_ID,
      category: detectCategory(title),
      brand: extractBrand(title),
      title,
      price,
      oldPrice,
      discountPercent,
      createdAt: inferCreatedAt(endDate),
      imageUrl: raw.imageUrl || "",
      sourceUrl: raw.href || "",
      promotionEndsAt: endDate ? endDate.getTime() : null,
    });
  }

  // dedupe by sourceUrl/title
  const map = new Map();
  for (const item of normalized) {
    const key = `${item.sourceUrl}__${item.title}`;
    if (!map.has(key)) {
      map.set(key, item);
    }
  }

  return [...map.values()]
    .sort((a, b) => {
      if ((b.discountPercent || 0) !== (a.discountPercent || 0)) {
        return (b.discountPercent || 0) - (a.discountPercent || 0);
      }
      return a.title.localeCompare(b.title, "uk");
    })
    .map((item, index) => ({
      id: String(index + 1),
      storeId: item.storeId,
      category: item.category,
      brand: item.brand,
      title: item.title,
      price: item.price,
      oldPrice: item.oldPrice,
      discountPercent: item.discountPercent,
      createdAt: item.createdAt,
      imageUrl: item.imageUrl,
      sourceUrl: item.sourceUrl,
    }));
}

async function scrapeAtbPromotions() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
    ],
    defaultViewport: {
      width: 1440,
      height: 2200,
    },
  });

  try {
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );

    await page.setExtraHTTPHeaders({
      "accept-language": "uk-UA,uk;q=0.9,en-US;q=0.8,en;q=0.7",
    });

    let allRaw = [];

    for (const url of ATB_PROMO_URLS) {
      try {
        const items = await extractPromoItemsFromPage(page, url);
        allRaw = allRaw.concat(items);
      } catch (err) {
        console.error(`ATB scrape failed for ${url}:`, err.message);
      }
    }

    const result = normalizeAtbItems(allRaw);

    if (!result.length) {
      throw new Error("ATB scraper returned 0 real promo items");
    }

    return result;
  } finally {
    await browser.close();
  }
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    cacheAgeMs: cache.at ? Date.now() - cache.at : null,
    cachedItems: cache.data.length,
  });
});

app.get("/promotions/atb", async (_req, res) => {
  try {
    const now = Date.now();

    if (cache.data.length && now - cache.at < CACHE_TTL_MS) {
      return res.json(cache.data);
    }

    const promotions = await scrapeAtbPromotions();

    cache = {
      at: now,
      data: promotions,
    };

    return res.json(promotions);
  } catch (error) {
    console.error("GET /promotions/atb error:", error);

    // ВАЖЛИВО: не повертаємо фейкові товари
    return res.status(502).json({
      error: "Failed to fetch real ATB promotions",
      details: error.message,
      data: [],
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
