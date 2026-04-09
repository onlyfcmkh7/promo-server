const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

const ATB_URL = "https://www.atbmarket.com/promo/sale_tovari";

const STORE_ID = 1;
const CACHE_TTL = 10 * 60 * 1000;

let cache = { at: 0, data: [] };

function parsePrice(v) {
  if (!v) return null;
  return Number(String(v).replace(",", "."));
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function scrapeATB() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();

  let products = [];

  // 🔥 ЛОВИМО JSON
  page.on("response", async (response) => {
    try {
      const url = response.url();
      const contentType = response.headers()["content-type"] || "";

      if (!contentType.includes("application/json")) return;

      const data = await response.json();

      // 🔥 шукаємо масив товарів
      if (Array.isArray(data)) {
        products = products.concat(data);
      }

      if (data?.items) {
        products = products.concat(data.items);
      }

      if (data?.data?.items) {
        products = products.concat(data.data.items);
      }

    } catch (e) {}
  });

  await page.goto(ATB_URL, {
    waitUntil: "networkidle2",
    timeout: 60000
  });

  await sleep(5000);

  await browser.close();

  if (!products.length) {
    throw new Error("No products найдено через JSON");
  }

  // 🔥 нормалізація
  const result = [];

  for (const item of products) {
    const title =
      item.name ||
      item.title ||
      item.product_name ||
      item?.attributes?.name;

    const price =
      parsePrice(item.price) ||
      parsePrice(item?.price?.value) ||
      parsePrice(item?.currentPrice);

    const oldPrice =
      parsePrice(item.old_price) ||
      parsePrice(item?.price_old) ||
      parsePrice(item?.oldPrice);

    const image =
      item.image ||
      item.image_url ||
      item?.media?.url;

    if (!title || !price || !oldPrice) continue;
    if (!(oldPrice > price)) continue;

    result.push({
      id: String(result.length + 1),
      storeId: STORE_ID,
      category: "other",
      brand: title.split(" ")[0],
      title,
      price,
      oldPrice,
      discountPercent: Math.round(((oldPrice - price) / oldPrice) * 100),
      createdAt: Date.now(),
      imageUrl: image || ""
    });
  }

  return result;
}

app.get("/promotions/atb", async (req, res) => {
  try {
    const now = Date.now();

    if (cache.data.length && now - cache.at < CACHE_TTL) {
      return res.json(cache.data);
    }

    const data = await scrapeATB();

    cache = { at: now, data };

    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "fail", details: e.message });
  }
});

app.listen(PORT, () => {
  console.log("Server started on", PORT);
});
