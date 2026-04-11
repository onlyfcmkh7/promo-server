const puppeteer = require("puppeteer");

const ATB_URL = "https://www.atbmarket.com/promo/sale_tovari";

const Category = {
  DAIRY: "dairy",
  BREAD: "bread",
  CHICKEN: "chicken",
  PORK: "pork",
  VEAL: "veal",
  FISH: "fish",
  SEAFOOD: "seafood",
  SAUCES: "sauces",
  OIL: "oil",
  CHOCOLATE: "chocolate",
  WATER: "water",
  BEER: "beer",
  LOW_ALCOHOL: "low_alcohol",
  STRONG_ALCOHOL: "strong_alcohol",
  OTHER: "other",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePrice(value) {
  if (!value) return null;

  const cleaned = String(value)
    .replace(",", ".")
    .replace(/[^\d.]/g, "");

  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function normalizeText(input) {
  return String(input || "")
    .toLowerCase()
    .replace(/['`’ʼ"]/g, "")
    .replace(/ё/g, "е")
    .replace(/ґ/g, "г")
    .replace(/[.,;:!?(){}\[\]+*№%/\\|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSearchText(title, imageUrl) {
  return `${normalizeText(title)} ${normalizeText(imageUrl)}`.trim();
}

function hasAny(text, patterns) {
  return patterns.some((re) => re.test(text));
}

function hasNone(text, patterns) {
  return patterns.every((re) => !re.test(text));
}

const CATEGORY_RULES = [
  {
    category: Category.BEER,
    include: [
      /\bпив[оауіе]?\b/,
      /\bлагер\b/,
      /\bель\b/,
      /\bipa\b/,
      /\bстаут\b/,
      /\bstout\b/,
      /\bporter\b/,
      /\bпортер\b/,
      /\bпшеничн\w*\s+пив\w*\b/,
      /\bбезалкогольн\w*\s+пив\w*\b/,
      /\bbeer\b/,
      /\bale\b/,
      /\blager\b/,
    ],
    exclude: [
      /\bпивн(і|ий|а)\s+дріжджі\b/,
      /\bпивний\s+напій\b/,
      /\bсмак\w*\s+пива\b/,
    ],
  },

  {
    category: Category.LOW_ALCOHOL,
    include: [
      /\bслабоалкогольн\w*\b/,
      /\bалко\s*коктейл\w*\b/,
      /\bкоктейл\w*\s+алкогольн\w*\b/,
      /\bнап(ій|ою|оєм)\s+алкогольн\w*\b/,
      /\bпивний\s+напій\b/,
      /\bсидр\b/,
      /\bcider\b/,
      /\bhard\s+seltzer\b/,
      /\bseltzer\b/,
      /\bмедовух\w*\b/,
      /\bджин\s*тонік\b/,
      /\bром\s*кола\b/,
      /\blonger\b/,
      /\bлонгер\b/,
      /\brevo\b/,
    ],
    exclude: [
      /\bпив[оауіе]?\b/,
    ],
  },

  {
    category: Category.STRONG_ALCOHOL,
    include: [
      /\bгорілк\w*\b/,
      /\bводк\w*\b/,
      /\bвіскі\b/,
      /\bwhisk(e)?y\b/,
      /\bконьяк\w*\b/,
      /\bбренді\b/,
      /\bром\b/,
      /\bджин\b/,
      /\bтекіл\w*\b/,
      /\btequila\b/,
      /\bлікер\b/,
      /\bликер\b/,
      /\bнастоянк\w*\b/,
      /\bбальзам\b/,
      /\bсамогон\b/,
      /\bабсент\b/,
      /\bвермут\b/,
      /\bmartini\b/,
      /\bмартіні\b/,
      /\bвин[оауюі]\b/,
      /\bігрист\w*\b/,
      /\bшампанськ\w*\b/,
      /\bprosecco\b/,
      /\bпросекко\b/,
      /\bбрют\b/,
    ],
    exclude: [
      /\bвинний\s+оцет\b/,
      /\bвиноградн\w*\s+сік\b/,
      /\bсоус\s+винн\w*\b/,
    ],
  },

  {
    category: Category.WATER,
    include: [
      /\bвода\b/,
      /\bвода\s+питна\b/,
      /\bмінеральн\w*\s+вод\w*\b/,
      /\bпитн\w*\s+вод\w*\b/,
      /\bгазован\w*\s+вод\w*\b/,
      /\bнегазован\w*\s+вод\w*\b/,
      /\bслабогазован\w*\s+вод\w*\b/,
      /\bартезіанськ\w*\s+вод\w*\b/,
      /\bджерельн\w*\s+вод\w*\b/,
    ],
    exclude: [
      /\bгорілк\w*\b/,
      /\bводк\w*\b/,
      /\bтуалетн\w*\s+вода\b/,
      /\bміцелярн\w*\s+вода\b/,
      /\bтонік\b/,
      /\bпив[оауіе]?\b/,
      /\bалкогольн\w*\b/,
    ],
  },

  {
    category: Category.CHICKEN,
    include: [
      /\bкур\w*\b/,
      /\bкуряч\w*\b/,
      /\bбройлер\w*\b/,
      /\bфіле\s+куряч\w*\b/,
      /\bстегн\w*\s+куряч\w*\b/,
      /\bгомілк\w*\s+куряч\w*\b/,
      /\bкрил\w*\s+куряч\w*\b/,
      /\bтушка\s+куряч\w*\b/,
      /\bчетвертина\s+куряч\w*\b/,
    ],
    exclude: [
      /\bяйц\w*\b/,
      /\bбульйон\s+куряч\w*\b/,
      /\bкорм\s+для\s+(кішок|собак)\b/,
      /\bсмак\w*\s+курк\w*\b/,
    ],
  },

  {
    category: Category.PORK,
    include: [
      /\bсвин\w*\b/,
      /\bсвинин\w*\b/,
      /\bошийок\b/,
      /\bкорейк\w*\b/,
      /\bпідчеревин\w*\b/,
      /\bгрудинк\w*\s+свин\w*\b/,
      /\bребр\w*\s+свин\w*\b/,
      /\bлопатк\w*\s+свин\w*\b/,
      /\bбекон\b/,
      /\bрульк\w*\b/,
      /\bшинка\s+свин\w*\b/,
    ],
    exclude: [
      /\bчипс\w*\s+бекон\b/,
      /\bсмак\w*\s+бекон\b/,
      /\bсоус\b/,
      /\bкорм\s+для\s+(кішок|собак)\b/,
    ],
  },

  {
    category: Category.VEAL,
    include: [
      /\bтеляч\w*\b/,
      /\bтелятин\w*\b/,
      /\bялович\w*\b/,
      /\bговядин\w*\b/,
      /\bbeef\b/,
      /\bантрекот\b/,
      /\bвирізк\w*\s+ялович\w*\b/,
    ],
    exclude: [
      /\bкорм\s+для\s+(кішок|собак)\b/,
    ],
  },

  {
    category: Category.SEAFOOD,
    include: [
      /\bморепродукт\w*\b/,
      /\bкревет\w*\b/,
      /\bкальмар\w*\b/,
      /\bміді\w*\b/,
      /\bмиді\w*\b/,
      /\bвосьмин\w*\b/,
      /\bлангуст\w*\b/,
      /\bомар\w*\b/,
      /\bрапан\w*\b/,
      /\bморськ\w*\s+коктейл\b/,
      /\bкрабов\w*\s+палички\b/,
      /\bкрабов\w*\s+палочк\w*\b/,
      /\bсурімі\b/,
      /\bікра\b/,
    ],
    exclude: [],
  },

  {
    category: Category.FISH,
    include: [
      /\bриб\w*\b/,
      /\bфіле\s+риб\w*\b/,
      /\bоселед\w*\b/,
      /\bлосос\w*\b/,
      /\bсьомг\w*\b/,
      /\bфорел\w*\b/,
      /\bскумбр\w*\b/,
      /\bхек\b/,
      /\bминтай\b/,
      /\bтріск\w*\b/,
      /\bтунец\w*\b/,
      /\bтунець\b/,
      /\bсардин\w*\b/,
      /\bкільк\w*\b/,
      /\bшпрот\w*\b/,
      /\bмойв\w*\b/,
      /\bкамбал\w*\b/,
      /\bпангасіус\b/,
      /\bдорадо\b/,
      /\bсибас\b/,
      /\bкороп\b/,
      /\bкарась\b/,
    ],
    exclude: [
      /\bкрабов\w*\s+палички\b/,
      /\bкрабов\w*\s+палочк\w*\b/,
      /\bкревет\w*\b/,
      /\bкальмар\w*\b/,
      /\bміді\w*\b/,
      /\bмиді\w*\b/,
      /\bвосьмин\w*\b/,
      /\bікра\b/,
      /\bморськ\w*\s+коктейл\b/,
    ],
  },

  {
    category: Category.DAIRY,
    include: [
      /\bмолок\w*\b/,
      /\bкефір\w*\b/,
      /\bряжанк\w*\b/,
      /\bйогурт\w*\b/,
      /\bйог\w*\b/,
      /\bсметан\w*\b/,
      /\bвершк\w*\b/,
      /\bсир\b/,
      /\bсир\w*\b/,
      /\bсирок\b/,
      /\bтворог\b/,
      /\bкисломолочн\w*\b/,
      /\bмасл[оауіе]\b/,
      /\bмасло\s+вершкове\b/,
      /\bмоцарел\w*\b/,
      /\bбринз\w*\b/,
      /\bфет\w*\b/,
      /\bмацарел\w*\b/,
    ],
    exclude: [
      /\bолія\b/,
      /\bшоколадн\w*\s+молок\w*\b/,
      /\bрослинне\s+молоко\b/,
      /\bкокосове\s+молоко\b/,
      /\bмигдальне\s+молоко\b/,
      /\bвівсяне\s+молоко\b/,
      /\bсоєве\s+молоко\b/,
      /\bсоус\s+сирн\w*\b/,
    ],
  },

  {
    category: Category.BREAD,
    include: [
      /\bхліб\b/,
      /\bбатон\b/,
      /\bбулк\w*\b/,
      /\bбагет\b/,
      /\bлаваш\b/,
      /\bчіабат\w*\b/,
      /\bтостов\w*\b/,
      /\bпаляниц\w*\b/,
      /\bкорж\b/,
      /\bбулочк\w*\b/,
      /\bздоб\w*\b/,
      /\bкруасан\b/,
      /\bкруассан\b/,
    ],
    exclude: [
      /\bсухарик\w*\b/,
      /\bпанірувальн\w*\b/,
      /\bкорм\b/,
    ],
  },

  {
    category: Category.SAUCES,
    include: [
      /\bсоус\b/,
      /\bкетчуп\b/,
      /\bмайонез\b/,
      /\bгірчиц\w*\b/,
      /\bгорчиц\w*\b/,
      /\bаджик\w*\b/,
      /\bдресинг\b/,
      /\bзаправк\w*\b/,
      /\bсальс\w*\b/,
      /\bпесто\b/,
      /\bтеріяк\w*\b/,
      /\bбарбекю\b/,
      /\bbbq\b/,
      /\bтоматн\w*\s+соус\b/,
      /\bсоєв\w*\s+соус\b/,
      /\bтартар\b/,
      /\bцезар\b/,
    ],
    exclude: [
      /\bсоусник\b/,
      /\bсоус\s+для\s+прання\b/,
    ],
  },

  {
    category: Category.OIL,
    include: [
      /\bолія\b/,
      /\bоливков\w*\s+ол\w*\b/,
      /\bсоняшников\w*\s+ол\w*\b/,
      /\bкукурудзян\w*\s+ол\w*\b/,
      /\bрафінован\w*\s+ол\w*\b/,
      /\bнерафінован\w*\s+ол\w*\b/,
      /\bмасло\s+оливкове\b/,
      /\bмасло\s+соняшникове\b/,
    ],
    exclude: [
      /\bмасло\s+вершкове\b/,
      /\bвершков\w*\b/,
    ],
  },

  {
    category: Category.CHOCOLATE,
    include: [
      /\bшоколад\b/,
      /\bшоколадк\w*\b/,
      /\bбатончик\b/,
      /\bцукерк\w*\s+шоколадн\w*\b/,
      /\bмолочн\w*\s+шоколад\b/,
      /\bчорн\w*\s+шоколад\b/,
      /\bбілий\s+шоколад\b/,
      /\bкакао\b/,
      /\bnutella\b/,
      /\bшоколадн\w*\s+паст\w*\b/,
    ],
    exclude: [
      /\bгарячий\s+шоколад\b/,
      /\bшоколадн\w*\s+молок\w*\b/,
      /\bшоколадн\w*\s+сирок\b/,
    ],
  },
];

function resolveCategory(product) {
  const text = buildSearchText(product?.title, product?.imageUrl);

  for (const rule of CATEGORY_RULES) {
    if (hasAny(text, rule.include) && hasNone(text, rule.exclude || [])) {
      return rule.category;
    }
  }

  return Category.OTHER;
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let lastHeight = 0;
      let sameCount = 0;

      const timer = setInterval(() => {
        window.scrollBy(0, 700);

        const newHeight = document.body.scrollHeight;

        if (newHeight === lastHeight) {
          sameCount += 1;
        } else {
          sameCount = 0;
          lastHeight = newHeight;
        }

        if (sameCount >= 3) {
          clearInterval(timer);
          resolve();
        }
      }, 400);
    });
  });
}

async function accept18PlusIfNeeded(page) {
  const buttons = await page.$$("button, a, div[role='button']");

  for (const button of buttons) {
    try {
      const text = await page.evaluate(
        (el) => (el.innerText || el.textContent || "").trim(),
        button
      );

      if (/так мені вже є 18/i.test(text)) {
        await button.click({ delay: 50 });
        await sleep(1000);
        break;
      }
    } catch (_) {}
  }
}

async function scrapeATB() {
  console.log("🚀 START SCRAPING ATB");

  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  try {
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36"
    );

    await page.goto(ATB_URL, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    await sleep(3000);
    await accept18PlusIfNeeded(page);
    await autoScroll(page);
    await sleep(2000);

    const rawItems = await page.evaluate(() => {
      function parsePrice(str) {
        if (!str) return null;

        const valueAttr = String(str).match(/^\d+(\.\d+)?$/);
        if (valueAttr) return Number(valueAttr[0]);

        const cleaned = String(str)
          .replace(",", ".")
          .replace(/[^\d.]/g, "");

        const num = Number(cleaned);
        return Number.isFinite(num) ? num : null;
      }

      const cards = [...document.querySelectorAll(".catalog-item")];
      const result = [];
      const seen = new Set();

      for (const card of cards) {
        const title = card
          .querySelector(".catalog-item__title a")
          ?.innerText?.replace(/\s+/g, " ")
          .trim();

        const priceText =
          card.querySelector(".product-price__top")?.getAttribute("value") ||
          card.querySelector(".product-price__top")?.textContent ||
          "";

        const oldPriceText =
          card.querySelector(".product-price__bottom")?.getAttribute("value") ||
          card.querySelector(".product-price__bottom")?.textContent ||
          "";

        const imageUrl =
          card.querySelector(".catalog-item__img")?.currentSrc ||
          card.querySelector(".catalog-item__img")?.src ||
          "";

        const price = parsePrice(priceText);
        const oldPrice = parsePrice(oldPriceText);

        if (!title || !price) continue;

        const key = `${title}_${price}`;
        if (seen.has(key)) continue;
        seen.add(key);

        result.push({
          title,
          price,
          oldPrice: oldPrice || price,
          imageUrl,
        });
      }

      return result;
    });

    console.log("🔍 RAW:", rawItems.length);

    const items = rawItems.map((item, i) => ({
      id: String(i + 1),
      storeId: 1,
      category: resolveCategory(item),
      title: item.title,
      price: item.price,
      oldPrice: item.oldPrice ?? null,
      imageUrl: item.imageUrl || null,
    }));

    console.log("✅ FINAL:", items.length);

    const stats = items.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {});

    console.log("📊 CATEGORY STATS:", stats);

    return items;
  } catch (e) {
    console.error("❌ ERROR:", e.message);
    return [];
  } finally {
    await browser.close().catch(() => {});
  }
}

module.exports = {
  scrapeATB,
  resolveCategory,
};
