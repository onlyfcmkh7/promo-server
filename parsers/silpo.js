const puppeteer = require("puppeteer");

const SILPO_URL = "https://silpo.ua/offers";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePrice(value) {
  if (!value) return null;

  const cleaned = String(value)
    .replace(/\s+/g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");

  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function normalizeImageUrl(url) {
  if (!url) return "";
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `https://silpo.ua${url}`;
  return url;
}

function detectBrand(title) {
  const safeTitle = String(title || "").trim();

  const quoted = safeTitle.match(/[«"](.*?)[»"]/);
  if (quoted && quoted[1]) {
    return quoted[1].trim();
  }

  return safeTitle.split(" ")[0] || "";
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let total = 0;
      const distance = 700;

      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        total += distance;

        if (total >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 250);
    });
  });
}

async function acceptCookies(page) {
  const buttons = await page.$$("button, a, div[role='button']");

  for (const button of buttons) {
    try {
      const text = await page.evaluate(
        (el) => (el.innerText || el.textContent || "").trim(),
        button
      );

      if (/прийняти|accept|добре|ok|зрозуміло/i.test(text)) {
        await button.click({ delay: 50 }).catch(() => {});
        await sleep(1000);
        break;
      }
    } catch (_) {}
  }
}

async function scrapeSilpo() {
  console.log("🚀 START SCRAPING SILPO");

  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage"
    ]
  });

  try {
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );

    await page.goto(SILPO_URL, {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    console.log("SILPO PAGE URL:", page.url());

    await sleep(3000);
    await acceptCookies(page);
    await autoScroll(page);
    await sleep(3000);

    const rawItems = await page.evaluate(() => {
      function txt(el) {
        return (el?.innerText || el?.textContent || "")
          .replace(/\s+/g, " ")
          .trim();
      }

      function normalizeTitle(value) {
        return String(value || "")
          .replace(/\s+/g, " ")
          .replace(/\s+-\s+\d+$/, "")
          .trim();
      }

      function isBadAlt(value) {
        const alt = String(value || "").trim().toLowerCase();

        return [
          "",
          "header logo",
          "logo",
          "only_online",
          "additional",
          "national-cashback",
          "cinotyzhyky",
          "цінодіжики",
          "cinodidjiky",
          "katalogh-asortyment",
          "velykden",
          "melkoopt"
        ].includes(alt);
      }

      function getImgUrl(img) {
        return (
          img.currentSrc ||
          img.src ||
          img.getAttribute("src") ||
          img.getAttribute("data-src") ||
          img.getAttribute("data-lazy-src") ||
          ""
        );
      }

      function isProductImage(url) {
        const value = String(url || "").trim().toLowerCase();

        if (!value) return false;
        if (value.includes("content.silpo.ua/hermes/")) return false;
        if (value.includes("logotype.svg")) return false;
        if (value.includes(".svg")) return false;

        return (
          value.includes("images.silpo.ua") &&
          (value.includes("/products/") || value.includes("/v2/products/"))
        );
      }

      function findPromoCard(startNode) {
        let current = startNode;

        while (current) {
          const text = txt(current);

          if (
            /(\d[\d\s.,]*)\s*грн/i.test(text) &&
            /(\d[\d\s.,]*)\s*грн[\s\S]*?(\d[\d\s.,]*)\s*грн/i.test(text) &&
            /-\s*\d+%/i.test(text)
          ) {
            return current;
          }

          current = current.parentElement;
        }

        return null;
      }

      const images = [...document.querySelectorAll("img[alt]")];
      const result = [];
      const seen = new Set();

      for (const img of images) {
        const title = normalizeTitle(img.getAttribute("alt"));
        const imageUrl = getImgUrl(img);

        if (!title || title.length < 5) continue;
        if (isBadAlt(title)) continue;
        if (!/[а-яіїєґa-z0-9]/i.test(title)) continue;
        if (!isProductImage(imageUrl)) continue;

        const card = findPromoCard(img);
        if (!card) continue;

        const text = txt(card);
        const match = text.match(
          /(\d[\d\s.,]*)\s*грн[\s\S]*?(\d[\d\s.,]*)\s*грн[\s\S]*?-\s*(\d+)%/i
        );

        if (!match) continue;

        const priceText = match[1];
        const oldPriceText = match[2];

        const key = `${title}|${priceText}|${oldPriceText}|${imageUrl}`;
        if (seen.has(key)) continue;
        seen.add(key);

        result.push({
          title,
          priceText,
          oldPriceText,
          imageUrl
        });
      }

      return result;
    });

    console.log("🔍 FOUND SILPO RAW:", rawItems.length);
    console.log("🔍 SAMPLE SILPO RAW:", rawItems.slice(0, 10));

    const items = rawItems
      .map((item, i) => {
        const price = parsePrice(item.priceText);
        const oldPrice = parsePrice(item.oldPriceText);

        if (!price || !oldPrice || !(oldPrice > price)) return null;

        return {
          id: String(i + 1),
          storeId: 2,
          title: item.title,
          brand: detectBrand(item.title),
          price,
          oldPrice,
          discountPercent: Math.round(((oldPrice - price) / oldPrice) * 100),
          imageUrl: normalizeImageUrl(item.imageUrl)
        };
      })
      .filter(Boolean);

    console.log("✅ FINAL SILPO:", items.length);

    return items;
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeSilpo };
