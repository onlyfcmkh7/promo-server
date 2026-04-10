const fetch = require("node-fetch");

async function scrapeMetro() {
  console.log("🚀 METRO API");

  const url =
    "https://metro.zakaz.ua/api/stores/48215685/products/?promo=1&page=1&page_size=100";

  const res = await fetch(url);
  const data = await res.json();

  const items = data.results
    .map((item, i) => {
      const price = item.price;
      const oldPrice = item.old_price;

      if (!price || !oldPrice || oldPrice <= price) return null;

      return {
        id: String(i + 1),
        storeId: 3,
        title: item.title,
        brand: item.title.split(" ")[0],
        price: price,
        oldPrice: oldPrice,
        discountPercent: Math.round(((oldPrice - price) / oldPrice) * 100),
        imageUrl: item.image?.s350 || item.image?.s200 || ""
      };
    })
    .filter(Boolean);

  console.log("✅ METRO:", items.length);

  return items;
}

module.exports = { scrapeMetro };
