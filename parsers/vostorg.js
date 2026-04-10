const axios = require("axios");

const STORE_ID = "482320001";

function parsePrice(value) {
  if (!value) return null;
  return Number(value) / 100;
}

async function scrapeVostorg() {
  console.log("🚀 START VOSTORG PROMOTIONS");

  try {
    const url = `https://stores-api.zakaz.ua/stores/${STORE_ID}/custom-categories/promotions/products/`;

    const res = await axios.get(url);

    const products = res.data.results || [];

    console.log("🔍 FOUND RAW:", products.length);

    const items = products
      .map((p, i) => {
        const price = parsePrice(p.price);
        const oldPrice = parsePrice(p.old_price);

        if (!price) return null;

        const discountPercent =
          oldPrice && oldPrice > price
            ? Math.round(((oldPrice - price) / oldPrice) * 100)
            : null;

        return {
          id: p.id || String(i + 1),
          storeId: 5,
          title: p.title,
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
