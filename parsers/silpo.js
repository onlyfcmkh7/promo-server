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

  if (/\b(молоко|кефір|ряжанка|йогурт|сир|творог|кисломолочн|сметан|вершк|масло\b|моцарел|бринз|фет[аи]?|гауд|чедер|пармезан|маскарпоне|рікот|айран|крем-сир)\b/i.test(t)) {
    return "dairy";
  }

  if (/\b(хліб|батон|багет|лаваш|булочк|чіабат|бріош|тостов|паляниц|круасан|паск|панеттоне|кекс|тістечко|чизкейк)\b/i.test(t)) {
    return "bread";
  }

  if (/\b(курк|куряч|філе кур|стегно кур|гомілка кур|крило кур|стріпс)\b/i.test(t)) {
    return "chicken";
  }

  if (/\b(свинин|свиняч|ошийок|ребра свин|лопатка свин|корейка свин)\b/i.test(t)) {
    return "pork";
  }

  if (/\b(телятина|теляч|теляче|ялович)\b/i.test(t)) {
    return "veal";
  }

  if (/\b(риба|лосос|форел|оселед|скумбр|тунец|тунець|хек|минтай|дорадо|сибас|короп)\b/i.test(t)) {
    return "fish";
  }

  if (/\b(кревет|міді|миді|кальмар|морепродукт|восьмин|лангустин|рапан)\b/i.test(t)) {
    return "seafood";
  }

  if (/\b(соус|кетчуп|майонез|гірчиц|теріякі|барбекю|bbq|песто|сацебелі|аджика|соєвий)\b/i.test(t)) {
    return "sauces";
  }

  if (/\b(олія|оливкова олія|соняшникова олія|кукурудзяна олія|рапсова олія)\b/i.test(t)) {
    return "oil";
  }

  if (/\b(шоколад|шоколадка|chocolate)\b/i.test(t)) {
    return "chocolate";
  }

  if (/\b(вода|мінеральна вода|газована вода|негазована вода|питна вода)\b/i.test(t)) {
    return "water";
  }

  if (/\b(пиво|lager|ale|stout|ipa|porter)\b/i.test(t)) {
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
        (el) => (el.innerText || el.textContent || "").trim(),
        btn
      );

      if (/прийняти|accept|ok|добре|зрозуміло|погоджуюсь|я погоджуюсь/i.test(text)) {
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
      let lastHeight = 0;
      let sameCount = 0;

      const timer = setInterval(() => {
        window.scrollBy(0, 900);

        const newHeight = document.body.scrollHeight;

        if (newHeight === lastHeight) {
          sameCount += 1;
        } else {
          sameCount = 0;
          lastHeight = newHeight;
        }

        if (sameCount >= 4) {
          clearInterval(timer);
          resolve();
        }
      }, 450);
    });
  });
}

async function scrapeSilpo() {
  console.log("🚀 SILPO PARSER START");

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
    console.log("[SILPO] browser launch");

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
        return /грн|₴|ціна|акц/i.test(text);
      },
      { timeout: 20000 }
    ).catch(() => {});

    console.log("[SILPO] scroll");
    await autoScroll(page);
    await sleep(2500);

    console.log("[SILPO] evaluate");

    const items = await page.evaluate(() => {
      function text(el) {
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
        const selectors = [
          "[data-testid*='title']",
          "[class*='title'] a",
          "[class*='title']",
          "h1",
          "h2",
          "h3",
          "h4",
          "a[title]",
          "img[alt]"
        ];

        for (const selector of selectors) {
          const el = node.querySelector(selector);
          if (!el) continue;

          const value =
            el.getAttribute?.("title") ||
            el.getAttribute?.("alt") ||
            text(el);

          if (!value) continue;
          if (value.length < 3) continue;
          if (/грн|₴|купити|додати|акція/i.test(value)) continue;

          return value;
        }

        const lines = text(node)
          .split(/(?<=\D)\n| {2,}/)
          .map((s) => s.trim())
          .filter(Boolean);

        for (const line of lines) {
          if (line.length < 3) continue;
          if (/грн|₴|\d+[.,]\d{2}/.test(line)) continue;
          if (/купити|додати|акція|знижка/i.test(line)) continue;
          return line;
        }

        return "";
      }

      function getPrices(node) {
        const values = new Set();

        const valueNodes = Array.from(node.querySelectorAll("[value]"));
        for (const el of valueNodes) {
          const v = parsePrice(el.getAttribute("value"));
          if (v && v > 0) values.add(v);
        }

        const fullText = text(node);
        const matches = fullText.match(/\d{1,4}(?:[\s]\d{3})*(?:[.,]\d{2})/g) || [];

        for (const raw of matches) {
          const v = parsePrice(raw);
          if (v && v > 0) values.add(v);
        }

        const prices = Array.from(values)
          .filter((n) => n > 0 && n < 100000)
          .sort((a, b) => a - b);

        if (prices.length === 0) return { price: null, oldPrice: null };
        if (prices.length === 1) return { price: prices[0], oldPrice: null };

        return {
          price: prices[0],
          oldPrice: prices[prices.length - 1]
        };
      }

      const candidateSelectors = [
        "article",
        "li",
        "[class*='product']",
        "[class*='card']",
        "[class*='item']",
        "a[href]"
      ];

      const nodes = Array.from(
        new Set(
          candidateSelectors.flatMap((selector) =>
            Array.from(document.querySelectorAll(selector))
          )
        )
      );

      const result = [];
      const seen = new Set();

      for (const node of nodes) {
        const full = text(node);
        if (!/грн|₴/.test(full)) continue;

        const title = getTitle(node);
        const { price, oldPrice } = getPrices(node);
        const imageUrl = getImage(node);

        if (!title || title.length < 3) continue;
        if (!price) continue;
        if (!imageUrl) continue;

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
