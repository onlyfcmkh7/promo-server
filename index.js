const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const ATB_URL = "https://www.atbmarket.com/promo/sale_tovari";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePrice(value) {
  if (!value) return null;
  const cleaned = String(value).replace(",", ".").replace(/[^\d.]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function detectCategory(title) {
  const t = (title || "").toLowerCase();

  if (/(молоко|кефір|йогурт|сметан|сир\b|сирок|масло|вершки|ряжанка|моцарел)/.test(t)) {
    return "dairy";
  }

  if (/(ковбас|сосиск|сардель|курка|курятина|індич|свинина|ялович|м'яс|фарш|бекон|шинка|паштет|курица)/.test(t)) {
    return "meat";
  }

  if (/(риба|лосось|оселед|тунець|скумбр|сардин|морепродукт|морська капуста)/.test(t)) {
    return "fish";
  }

  if (/(хліб|батон|лаваш|булоч|круасан|тісто|пиріг|печиво|вафл|пряник|торт)/.test(t)) {
    return "bakery";
  }

  if (/(вода|сік|нектар|напій|лимонад|квас|чай|кава|какао|енергетич|кола)/.test(t)) {
    return "drinks";
  }

  if (/(пиво|вино|горілка|бренді|коньяк|віскі|ром|джин|лікер|вермут|lambrusco)/.test(t)) {
    return "alcohol";
  }

  if (/(чипси|снеки|горішк|попкорн|насіння|крекер|кукурудзян)/.test(t)) {
    return "snacks";
  }

  if (/(цукерк|шоколад|десерт|зефір|мармелад|драже|батончик)/.test(t)) {
    return "sweets";
  }

  if (/(gerber|galicia baby|дитяч|пюре|суміш)/.test(t)) {
    return "baby";
  }

  if (/(порошок|миюч|засіб|серветки|рушники|туалетний папір|дезодорант|шампунь|крем|мило|пластир)/.test(t)) {
    return "household";
  }

  if (/(консерви|крупи|макарон|майонез|соус|кетчуп|олія|оцет|приправ|булгур|рис|греч|борошно|цукор|сіль|суп|картопляне пюре)/.test(t)) {
    return "groceries";
  }

  return "other";
}

function detectBrand(title) {
  const brands = [
    "Своя Лінія",
    "Своя лінія",
    "Розумний вибір",
    "Gerber",
    "Galicia BABY",
    "Savex",
    "Dallmayr",
    "Tea Moments",
    "DAS IST",
    "Saint Remy",
    "Hyleys",
    "Jacobs",
    "Живчик",
    "Kaheturi",
    "Eilles",
    "Livity",
    "VALE",
    "Lambrusco Dell'Emilia",
    "Giacobazzi",
    "Коблево"
  ];

  const safeTitle = title || "";

  for (const brand of brands) {
    if (safeTitle.toLowerCase().includes(brand.toLowerCase())) {
      return brand;
    }
  }

  return safeTitle.split(" ")[0] || "";
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let total = 0;
      const distance = 500;

      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        total += distance;

        if (total >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 200);
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

      if (/Так мені вже є 18/i.test(text)) {
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
      "--disable-dev-shm-usage"
    ]
  });

  try {
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );

    await page.goto(ATB_URL, {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    await sleep(3000);
    await accept18PlusIfNeeded(page);
    await autoScroll(page);
    await sleep(2000);

    const rawItems = await page.evaluate(() => {
      function txt(el) {
        return (el?.innerText || el?.textContent || "")
          .replace(/\s+/g, " ")
          .trim();
      }

      function getImage(card) {
        const img = card.querySelector("img");
        if (!img) return "";

        return (
          img.currentSrc ||
          img.src ||
          img.getAttribute("data-src") ||
          img.getAttribute("data-lazy-src") ||
          ""
        );
      }

      function findCard(el) {
        let current = el;

        while (current) {
          const text = txt(current);

          if (
            /(\d+[.,]\d{2})\s*грн\/шт\s*(\d+[.,]\d{2})/i.test(text) ||
            /-\d+%/.test(text)
          ) {
            return current;
          }

          current = current.parentElement;
        }

        return el.parentElement || el;
      }

      const links = [...document.querySelectorAll("a[href*='/product/']")];
      const seen = new Set();
      const result = [];

      for (const link of links) {
        const href = link.href || link.getAttribute("href") || "";
        const title = txt(link);

        if (!href || !title) continue;

        const uniq = `${href}__${title}`;
        if (seen.has(uniq)) continue;
        seen.add(uniq);

        const card = findCard(link);
        const text = txt(card);

        const priceMatch = text.match(
          /(\d+[.,]\d{2})\s*грн\/шт\s*(\d+[.,]\d{2})/i
        );

        if (!priceMatch) continue;

        result.push({
          title,
          rawText: text,
          priceText: priceMatch[1],
          oldPriceText: priceMatch[2],
          imageUrl: getImage(card)
        });
      }

      return result;
    });

    console.log("🔍 PRODUCT LINKS FOUND:", rawItems.length);
    console.log("🧪 SAMPLE:", rawItems.slice(0, 3));

    const items = rawItems
      .map((item, i) => {
        const price = parsePrice(item.priceText);
        const oldPrice = parsePrice(item.oldPriceText);

        if (!item.title || !Number.isFinite(price) || !Number.isFinite(oldPrice)) {
          return null;
        }

        if (!(oldPrice > price)) {
          return null;
        }

        return {
          id: String(i + 1),
          storeId: 1,
          category: detectCategory(item.title),
          brand: detectBrand(item.title),
          title: item.title,
          price,
          oldPrice,
          discountPercent: Math.round(((oldPrice - price) / oldPrice) * 100),
          createdAt: Date.now(),
          imageUrl: item.imageUrl || ""
        };
      })
      .filter(Boolean);

    console.log("✅ VALID ITEMS:", items.length);

    if (!items.length) {
      console.log("❌ NO ITEMS FOUND");
    }

    return items;
  } finally {
    await browser.close();
  }
}

app.get("/promotions/atb", async (_req, res) => {
  try {
    const data = await scrapeATB();
    res.json(data);
  } catch (e) {
    console.error("🔥 ERROR:", e);
    res.status(500).json({
      error: "fail",
      details: e.message
    });
  }
});

app.listen(PORT, () => {
  console.log("Server running on", PORT);
});
