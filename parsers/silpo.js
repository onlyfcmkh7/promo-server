const puppeteer = require("puppeteer");

const SILPO_OFFERS_URL = "https://silpo.ua/offers";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeImage(url) {
  if (!url) return "";
  if (url.startsWith("//")) return "https:" + url;
  if (url.startsWith("/")) return "https://silpo.ua" + url;
  return url;
}

function cleanupTitle(title) {
  return String(title || "")
    .replace(/^\-\s*\d+%\s*/i, "")
    .replace(/\s+\d+(?:[.,]\d+)?\s?(г|кг|мл|л|шт)\s+\d+(?:[.,]\d+)?(?:\s*\/5)?$/i, "")
    .replace(/\s+\d+(?:[.,]\d+)?\s?(г|кг|мл|л|шт)$/i, "")
    .replace(/\s+\d+(?:[.,]\d+)?\s*\/5$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function detectCategory(title) {
  const t = String(title || "").toLowerCase();

  if (/\b(молоко|кефір|ряжанка|йогурт|сир|творог|кисломолочн|сметан|вершк|масло\b|моцарел|бринз|фет[аи]?|гауд|чедер|пармезан|маскарпоне|рікот|айран|крем-сир)\b/i.test(t)) {
    return "dairy";
  }

  if (/\b(хліб|батон|багет|лаваш|булочк|чіабат|бріош|тостов|паляниц|круасан|паск|панеттоне|кекс|тістечко|чизкейк)\b/i.test(t)) {
    return "bread";
  }

  if (/\b(курк|куряч|філе кур|стегно кур|гомілка кур|крило кур|стріпс)\b/i.test(t)) {
    return "chicken";
  }

  if (/\b(свинин|свиняч|ошийок|ребра свин|лопатка свин|корейка свин|голубці зі свининою)\b/i.test(t)) {
    return "pork";
  }

  if (/\b(телятина|теляч|теляче|ялович|бограч)\b/i.test(t)) {
    return "veal";
  }

  if (/\b(риба|лосос|форел|оселед|скумбр|тунец|тунець|хек|минтай|дорадо|сибас|короп)\b/i.test(t)) {
    return "fish";
  }

  if (/\b(кревет|міді|миді|кальмар|морепродукт|восьмин|лангустин|рапан)\b/i.test(t)) {
    return "seafood";
  }

  if (/\b(соус|кетчуп|майонез|гірчиц|гірчичн|теріякі|барбекю|bbq|песто|сацебелі|аджика|соєвий)\b/i.test(t)) {
    return "sauces";
  }

  if (/\b(олія|оливкова олія|соняшникова олія|кукурудзяна олія|рапсова олія|масло оливкове)\b/i.test(t)) {
    return "oil";
  }

  if (/\b(шоколад|шоколадка|chocolate)\b/i.test(t)) {
    return "chocolate";
  }

  if (/\b(вода|мінеральна вода|газована вода|негазована вода|питна вода)\b/i.test(t)) {
    return "water";
  }

  if (/\b(пиво|lager|ale|stout|ipa|porter|пшеничне пиво)\b/i.test(t)) {
    return "beer";
  }

  if (/\b(сидр|слабоалкоголь|hard seltzer|алкогольний коктейль|коктейль алкогольний|соджу)\b/i.test(t)) {
    return "low_alcohol";
  }

  if (/\b(горілка|віскі|коньяк|ром|джин|текіла|бренді|лікер|настоянка|бурбон)\b/i.test(t)) {
    return "strong_alcohol";
  }

  return "other";
}

function detectBrand(title) {
  const safeTitle = String(title || "").trim();
  const quoted = safeTitle.match(/[«"]([^"»]+)[»"]/);

  if (quoted && quoted[1]) {
    return quoted[1].trim();
  }

  return safeTitle.split(" ")[0] || "";
}

async function acceptCookies(page) {
  const buttons = await page.$$("button, a, [role='button']");

  for (const btn of buttons) {
    try {
      const text = await page.evaluate(
        (el) => (el.innerText || "").trim(),
        btn
      );

      if (/прийняти|accept|ok|добре|зрозуміло/i.test(text)) {
        await btn.click().catch(() => {});
        await sleep(1000);
        return;
      }
    } catch (_) {}
  }
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let total = 0;
      const step = 800;
      let idle = 0;
      let lastHeight = document.body.scrollHeight;

      const timer = setInterval(() => {
        window.scrollBy(0, step);
        total += step;

        const currentHeight = document.body.scrollHeight;

        if (currentHeight === lastHeight) {
          idle += 1;
        } else {
          idle = 0;
          lastHeight = currentHeight;
        }

        if (idle >= 4 || total > currentHeight + 1500) {
          clearInterval(timer);
          resolve();
        }
      }, 400);
    });
  });
}

async function scrapeSilpo() {
  console.log("🚀 SILPO STABLE PARSER START");

  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu"
    ]
  });

  try {
    const page = await browser.newPage();

    await page.setViewport({ width: 1400, height: 2000 });

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/135.0.0.0 Safari/537.36"
    );

    await page.setExtraHTTPHeaders({
      "Accept-Language": "uk-UA,uk;q=0.9,en;q=0.8"
    });

    await page.goto(SILPO_OFFERS_URL, {
      waitUntil: "domcontentloaded",
      timeout: 90000
    });

    await sleep(2500);
    await acceptCookies(page);
    await sleep(1000);

    await page.waitForFunction(
      () => /грн|₴/i.test(document.body?.innerText || ""),
      { timeout: 20000 }
    ).catch(() => {});

    await autoScroll(page);
    await sleep(2000);

    const items = await page.evaluate(() => {
      function text(el) {
        return String(el?.innerText || "")
          .replace(/\s+/g, " ")
          .trim();
      }

      function parsePrice(value) {
        const cleaned = String(value || "")
          .replace(/\s+/g, "")
          .replace(",", ".")
          .replace(/[^\d.]/g, "");

        const num = Number(cleaned);
        return Number.isFinite(num) ? Number(num.toFixed(2)) : null;
      }

      function getImage(node) {
        const imgs = Array.from(node.querySelectorAll("img"));

        for (const img of imgs) {
          const src =
            img.currentSrc ||
            img.src ||
            img.getAttribute("src") ||
            img.getAttribute("data-src") ||
            "";

          if (!src) continue;
          if (/\.svg/i.test(src)) continue;
          if (/MediaBubbles|Activities|site\.svg|hermes/i.test(src)) continue;

          return src;
        }

        return "";
      }

      const nodes = Array.from(document.querySelectorAll("a, article"));
      const result = [];
      const seen = new Set();

      for (const node of nodes) {
        const full = text(node);
        if (!/грн|₴/i.test(full)) continue;

        const match = full.match(
          /(\d[\d\s.,]*)\s*(?:грн|₴)\s+(\d[\d\s.,]*)\s*(?:грн|₴)\s+(.+)/
        );

        if (!match) continue;

        const price = parsePrice(match[1]);
        const oldPrice = parsePrice(match[2]);
        const title = match[3].trim();

        if (!price || !title) continue;

        const imageUrl = getImage(node);
        if (!imageUrl) continue;

        const key = `${title.toLowerCase()}|${price}|${oldPrice || price}`;
        if (seen.has(key)) continue;
        seen.add(key);

        result.push({
          title,
          price,
          oldPrice: oldPrice || price,
          imageUrl
        });
      }

      return result;
    });

    const normalized = items.map((item, index) => {
      const cleanTitle = cleanupTitle(item.title);

      return {
        id: String(index + 1),
        storeId: 2,
        title: cleanTitle,
        category: detectCategory(cleanTitle),
        brand: detectBrand(cleanTitle),
        price: item.price,
        oldPrice: item.oldPrice,
        discountPercent:
          item.oldPrice && item.oldPrice > item.price
            ? Math.round(((item.oldPrice - item.price) / item.oldPrice) * 100)
            : null,
        createdAt: Date.now(),
        imageUrl: normalizeImage(item.imageUrl)
      };
    });

    console.log("✅ SILPO ITEMS:", normalized.length);
    console.log("SAMPLE:", JSON.stringify(normalized.slice(0, 5), null, 2));

    return normalized;
  } catch (e) {
    console.error("❌ SILPO ERROR:", e.message);
    return [];
  } finally {
    await browser.close().catch(() => {});
  }
}

module.exports = {
  scrapeSilpo
};
