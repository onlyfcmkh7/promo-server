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
    .replace(/\s+/g, " ")
    .trim();
}

function detectCategory(title) {
  const t = String(title || "").toLowerCase();

  if (/\b(молоко|кефір|ряжанка|йогурт|сир|творог|кисломолочн|сметан|вершк|масло\b|моцарел|бринз|фет[аи]?|гауд|чедер|пармезан|маскарпоне|рікот|айран|крем-сир)\b/i.test(t)) return "dairy";
  if (/\b(хліб|батон|багет|лаваш|булочк|чіабат|бріош|тостов|паляниц|круасан|паск|панеттоне|кекс|тістечко|чизкейк)\b/i.test(t)) return "bread";
  if (/\b(курк|куряч|філе кур|стегно кур|гомілка кур|крило кур|стріпс)\b/i.test(t)) return "chicken";
  if (/\b(свинин|свиняч|ошийок|ребра свин|лопатка свин|корейка свин)\b/i.test(t)) return "pork";
  if (/\b(телятина|теляч|теляче|ялович)\b/i.test(t)) return "veal";
  if (/\b(риба|лосос|форел|оселед|скумбр|тунец|тунець|хек|минтай|дорадо|сибас|короп)\b/i.test(t)) return "fish";
  if (/\b(кревет|міді|миді|кальмар|морепродукт|восьмин|лангустин|рапан)\b/i.test(t)) return "seafood";
  if (/\b(соус|кетчуп|майонез|гірчиц|теріякі|барбекю|bbq|песто|сацебелі|аджика|соєвий)\b/i.test(t)) return "sauces";
  if (/\b(олія|оливкова олія|соняшникова олія|кукурудзяна олія|рапсова олія)\b/i.test(t)) return "oil";
  if (/\b(шоколад|шоколадка|chocolate)\b/i.test(t)) return "chocolate";
  if (/\b(вода|мінеральна вода|газована вода|негазована вода|питна вода)\b/i.test(t)) return "water";
  if (/\b(пиво|lager|ale|stout|ipa|porter)\b/i.test(t)) return "beer";
  if (/\b(сидр|слабоалкоголь|hard seltzer|алкогольний коктейль|коктейль алкогольний|соджу)\b/i.test(t)) return "low_alcohol";
  if (/\b(горілка|віскі|коньяк|ром|джин|текіла|бренді|лікер|настоянка|бурбон)\b/i.test(t)) return "strong_alcohol";

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
        (el) => (el.innerText || el.textContent || "").trim(),
        btn
      );

      if (/прийняти|accept|ok|добре|зрозуміло|погоджуюсь/i.test(text)) {
        await btn.click().catch(() => {});
        await sleep(1000);
        return;
      }
    } catch (_) {}
  }
}

async function autoScroll(page, steps = 10) {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel({ deltaY: 1200 });
    await sleep(700);
  }
}

async function scrapeSilpo() {
  console.log("🚀 SILPO PARSER START");

  const browser = await puppeteer.launch({
    headless: "new",
    protocolTimeout: 180000,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu"
    ]
  });

  try {
    const page = await browser.newPage();

    await page.setViewport({ width: 1440, height: 2200 });

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/135.0.0.0 Safari/537.36"
    );

    await page.setExtraHTTPHeaders({
      "Accept-Language": "uk-UA,uk;q=0.9,en;q=0.8"
    });

    console.log("[SILPO] goto offers");

    await page.goto(SILPO_OFFERS_URL, {
      waitUntil: "domcontentloaded",
      timeout: 90000
    });

    await sleep(3000);

    console.log("[SILPO] accept cookies");
    await acceptCookies(page);
    await sleep(1500);

    console.log("[SILPO] wait content");
    await page.waitForFunction(
      () => {
        const text = document.body?.innerText || "";
        return /грн|₴|акц|знижк/i.test(text);
      },
      { timeout: 20000 }
    ).catch(() => {});

    console.log("[SILPO] scroll");
    await autoScroll(page, 10);
    await sleep(2000);

    console.log("[SILPO] extract");

    const items = await page.$$eval("a[href]", (links) => {
      function txt(el) {
        return String(el?.innerText || el?.textContent || "")
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
            img.getAttribute("data-lazy-src") ||
            "";

          if (!src) continue;
          if (/\.svg(\?|$)/i.test(src)) continue;
          if (/placeholder|stub|icon|logo/i.test(src)) continue;

          return src;
        }

        return "";
      }

      function getTitle(node) {
        const candidates = [
          ...node.querySelectorAll("[title], h1, h2, h3, h4, h5, span, div, p, img")
        ];

        for (const el of candidates) {
          const value =
            el.getAttribute?.("title") ||
            el.getAttribute?.("alt") ||
            txt(el);

          if (!value) continue;
          if (value.length < 4) continue;
          if (/грн|₴|\d+[.,]\d{2}/.test(value)) continue;
          if (/купити|додати|акц|знижк/i.test(value)) continue;

          return value;
        }

        return "";
      }

      const result = [];
      const seen = new Set();

      for (const link of links) {
        const href = link.getAttribute("href") || "";
        const full = txt(link);

        if (!/грн|₴/.test(full)) continue;
        if (full.length > 800) continue;
        if (!href || href === "#" || href.startsWith("javascript:")) continue;

        const pricesRaw = full.match(/\d{1,4}(?:[\s]\d{3})*(?:[.,]\d{2})/g) || [];
        const prices = pricesRaw
          .map(parsePrice)
          .filter((n) => n && n > 0 && n < 100000)
          .sort((a, b) => a - b);

        if (!prices.length) continue;

        const price = prices[0];
        const oldPrice = prices.length > 1 ? prices[prices.length - 1] : null;

        const title = getTitle(link);
        const imageUrl = getImage(link);

        if (!title || !price || !imageUrl) continue;

        const key = `${title.toLowerCase()}|${price}|${oldPrice || ""}`;
        if (seen.has(key)) continue;
        seen.add(key);

        result.push({
          title,
          price,
          oldPrice: oldPrice && oldPrice > price ? oldPrice : null,
          imageUrl
        });
      }

      return result;
    });

    console.log("[SILPO] raw items:", items.length);

    const normalized = items.map((item, index) => {
      const cleanTitle = cleanupTitle(item.title);

      return {
        id: String(index + 1),
        storeId: 2,
        category: detectCategory(cleanTitle),
        brand: detectBrand(cleanTitle),
        title: cleanTitle,
        price: item.price,
        oldPrice: item.oldPrice ?? null,
        imageUrl: normalizeImage(item.imageUrl) || null
      };
    });

    console.log("✅ SILPO ITEMS:", normalized.length);
    console.log("SAMPLE:", JSON.stringify(normalized.slice(0, 3), null, 2));

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
