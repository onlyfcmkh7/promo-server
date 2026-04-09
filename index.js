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

  if (/(молоко|кефір|йогурт|сметан|сир\b|сирок|масло|вершки)/.test(t)) return "dairy";
  if (/(ковбас|сосиск|курка|свинина|ялович|м'яс|бекон|шинка)/.test(t)) return "meat";
  if (/(риба|лосось|оселед|тунець)/.test(t)) return "fish";
  if (/(хліб|батон|лаваш|печиво|торт)/.test(t)) return "bakery";
  if (/(вода|сік|напій|чай|кава|кола|енергетич)/.test(t)) return "drinks";
  if (/(пиво|вино|горілка|бренді|коньяк|віскі|ром)/.test(t)) return "alcohol";
  if (/(чипси|снеки|горішк|попкорн)/.test(t)) return "snacks";
  if (/(цукерк|шоколад|десерт|батончик)/.test(t)) return "sweets";
  if (/(gerber|дитяч|пюре)/.test(t)) return "baby";
  if (/(порошок|шампунь|мило|крем|серветки)/.test(t)) return "household";
  if (/(консерви|крупи|макарон|соус|олія|рис|греч)/.test(t)) return "groceries";

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

  for (const brand of brands) {
    if (title.toLowerCase().includes(brand.toLowerCase())) {
      return brand;
    }
  }

  return title.split(" ")[0] || "";
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

async function scrapeATB() {
  console.log("🚀 START SCRAPING ATB");

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();

    await page.goto(ATB_URL, {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    await sleep(3000);
    await autoScroll(page);
    await sleep(2000);

    const rawItems = await page.evaluate(() => {
      function txt(el) {
        return (el?.innerText || "").replace(/\s+/g, " ").trim();
      }

      function getImage(card) {
        const img = card.querySelector("img");
        return img?.src || img?.currentSrc || "";
      }

      function findCard(el) {
        let current = el;
        while (current) {
          const t = txt(current);
          if (/грн\/шт/i.test(t)) return current;
          current = current.parentElement;
        }
        return el.parentElement;
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

app.get("/promotions/atb", async (req, res) => {
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
