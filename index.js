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

  if (/\bморська капуста\b/.test(t)) return "groceries";

  if (/\b(gerber|galicia baby|дитяч|пюре|суміш|пластир)\b/.test(t)) {
    return "baby";
  }

  if (/\b(порошок|шампунь|мило|крем|серветки|туалетний папір|рушники|миюч|засіб|дезодорант)\b/.test(t)) {
    return "household";
  }

  if (/\b(кава|чай|сік|нектар|напій|вода|лимонад|квас|кола|енергетич)\b/.test(t)) {
    return "drinks";
  }

  if (/\b(молоко|кефір|йогурт|сметан|вершки|сир|сирок|моцарел|масло|ряжанка)\b/.test(t)) {
    return "dairy";
  }

  if (/\b(ковбас|сосиск|сардель|бекон|шинка|м'яс|мяс|фарш|курка|курятина|індич|свинина|ялович|філе)\b/.test(t)) {
    return "meat";
  }

  if (/\b(риба|лосось|оселед|тунець|скумбр|сардин|морепродукт)\b/.test(t)) {
    return "fish";
  }

  if (/\b(хліб|батон|лаваш|булоч|круасан|тісто|пиріг|печиво|вафл|пряник|торт)\b/.test(t)) {
    return "bakery";
  }

  if (/\b(чипси|снеки|горішк|попкорн|насіння|крекер|кукурудзян)\b/.test(t)) {
    return "snacks";
  }

  if (/\b(цукерк|шоколад|десерт|зефір|мармелад|драже|батончик)\b/.test(t)) {
    return "sweets";
  }

  if (/\b(консерви|крупи|макарон|майонез|соус|кетчуп|олія|оцет|приправа|булгур|рис|греч|борошно|цукор|сіль|суп)\b/.test(t)) {
    return "groceries";
  }

  // ВАЖЛИВО: алкоголь В КІНЦІ
  if (/\b(бренді|коньяк|віскі|ром|джин|горілка|вино|пиво|вермут|лікер|ігристе)\b/.test(t)) {
    return "alcohol";
  }

  return "other";
}

function detectBrand(title) {
  const brands = [
    "Своя Лінія",
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
    "Livity"
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
            /(\d+[.,]\d{2})\s*грн\/шт\s*(\d+[.,]\d{2})/i.test(text)
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
        const title = txt(link);
        if (!title) continue;

        const key = title;
        if (seen.has(key)) continue;
        seen.add(key);

        const card = findCard(link);
        const text = txt(card);

        const priceMatch = text.match(
          /(\d+[.,]\d{2})\s*грн\/шт\s*(\d+[.,]\d{2})/i
        );

        if (!priceMatch) continue;

        result.push({
          title,
          priceText: priceMatch[1],
          oldPriceText: priceMatch[2],
          imageUrl: getImage(card)
        });
      }

      return result;
    });

    console.log("🔍 FOUND:", rawItems.length);

    const items = rawItems
      .map((item, i) => {
        const price = parsePrice(item.priceText);
        const oldPrice = parsePrice(item.oldPriceText);

        if (!price || !oldPrice || !(oldPrice > price)) return null;

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
          imageUrl: item.imageUrl
        };
      })
      .filter(Boolean);

    console.log("✅ FINAL:", items.length);

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
    console.error(e);
    res.status(500).json({ error: "fail" });
  }
});

app.listen(PORT, () => {
  console.log("Server running on", PORT);
});
