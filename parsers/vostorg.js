const axios = require("axios");

const STORE_ID = "482320001";

function parsePrice(value) {
  if (value === null || value === undefined) return null;

  const num = Number(value);
  if (!Number.isFinite(num)) return null;

  return num / 100;
}

function detectCategory(title) {
  const t = String(title || "").toLowerCase();

  if (/\b(молоко|кефір|йогурт|сметан|вершки|сир|сирок|моцарел|масло|ряжанка)\b/.test(t)) return "dairy";
  if (/\b(хліб|батон|лаваш|булоч|круасан|тісто|пиріг)\b/.test(t)) return "bread";
  if (/\b(курка|курятина|філе|гомілка|стегно)\b/.test(t)) return "chicken";
  if (/\b(кетчуп|соус|майонез|гірчиця)\b/.test(t)) return "ketchup";
  if (/\b(олія|масло соняшникове|оливкова олія)\b/.test(t)) return "oil";
  if (/\b(шоколад|цукерк|батончик|десерт)\b/.test(t)) return "chocolate";
  if (/\b(вода|мінеральна вода|газована вода|негазована вода)\b/.test(t)) return "water";
  if (/\b(пиво|вино|горілка|віскі|ром|джин|коньяк)\b/.test(t)) return "alcohol";

  return "other";
}

function detectBrand(title) {
  const safe = String(title || "").trim();
  const quoted = safe.match(/[«"](.*?)[»"]/);
  if (quoted && quoted[1]) return quoted[1].trim();
  return safe.split(" ")[0] || "";
}

async function scrapeVostorg(query = "молоко") {
  console.log("🚀 START VOSTORG API");

  try {
    const url = `https://stores-api.zakaz.ua/stores/${STORE_ID}/products/search?q=${encodeURIComponent(query)}`;

    const res = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json"
      },
      timeout: 30000
    });

    const products = Array.isArray(res.data?.results) ? res.data.results : [];

    const items = products
      .map((p, i) => {
        const title = p.title || "";
        const price = parsePrice(p.price);
        const oldPrice = parsePrice(p.old_price);

        if (!price) return null;

        const discountPercent =
          oldPrice && oldPrice > price
            ? Math.round(((oldPrice - price) / oldPrice) * 100)
            : null;

        return {
          id: String(p.id || i + 1),
          storeId: 5,
          category: detectCategory(title),
          brand: detectBrand(title),
          title,
          price,
          oldPrice,
          discountPercent,
          imageUrl: p.image_url || null,
          createdAt: Date.now()
        };
      })
      .filter(Boolean);

    console.log("✅ FINAL VOSTORG:", items.length);
    return items;
  } catch (e) {
    console.log("❌ VOSTORG ERROR:", e.message);
    return [];
  }
}

module.exports = { scrapeVostorg };
