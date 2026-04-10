const axios = require("axios");

const STORE_ID = "482320001";
const LIMIT_PER_CATEGORY = 10;

function parsePrice(value) {
  if (value === null || value === undefined) return null;

  if (typeof value === "number") {
    return value > 999 ? value / 100 : value;
  }

  const cleaned = String(value)
    .replace(/\s/g, "")
    .replace(",", ".")
    .trim();

  const num = Number(cleaned);
  if (!Number.isFinite(num)) return null;

  return num > 999 ? num / 100 : num;
}

function normalizeTitle(title) {
  return String(title || "")
    .replace(/\s+/g, " ")
    .replace(/[«»]/g, '"')
    .trim();
}

function detectCategory(title) {
  const t = normalizeTitle(title).toLowerCase();

  if (/\b(молоко|кефір|йогурт|сметан|вершки|сир|сирок|моцарел|ряжанка|айран)\b/.test(t)) return "dairy";
  if (/\b(хліб|батон|лаваш|булоч|круасан|тісто|пиріг|багет|хлеб)\b/.test(t)) return "bread";
  if (/\b(курка|курятина|куряче|філе кур|гомілка|стегно|крило|тушка кур|курица|куриное)\b/.test(t)) return "chicken";
  if (/\b(свинина|свин|ошийок|лопатка|ребра св|корейка|підчеревина|свини|свиная)\b/.test(t)) return "pork";
  if (/\b(телятина|теляче|теляч|вирізка тел|телятина|телячья)\b/.test(t)) return "veal";
  if (/\b(риба|лосось|сьомга|оселедець|хек|минтай|скумбр|тунець|форель|сардина|рыба|семга)\b/.test(t)) return "fish";
  if (/\b(кревет|мідії|кальмар|восьминіг|морепродукт|креветки|мидии)\b/.test(t)) return "seafood";
  if (/\b(кетчуп|соус|майонез|гірчиця|аджика|томатна паста|горчица)\b/.test(t)) return "sauces";
  if (/\b(олія|соняшникова олія|оливкова олія|масло подсолнечное|оливковое масло)\b/.test(t)) return "oil";
  if (/\b(шоколад|цукерк|батончик|десерт|конфеты)\b/.test(t)) return "chocolate";
  if (/\b(вода|мінеральна вода|газована вода|негазована вода|минеральная вода)\b/.test(t)) return "water";
  if (/\b(пиво|beer|lager|ale)\b/.test(t)) return "beer";
  if (/\b(сидр|слабоалкоголь|hard seltzer|коктейль алкогольний|алкогольный коктейль|ром-кола|джин-тонік|джин-тоник)\b/.test(t)) return "low_alcohol";
  if (/\b(горілка|віскі|ром|джин|коньяк|бренді|текіла|лікер|настоянка|водка|виски|бренди|текила)\b/.test(t)) return "strong_alcohol";

  return "other";
}

function detectBrand(title) {
  const safe = normalizeTitle(title);
  const quoted = safe.match(/[«"]([^"»]+)[»"]/);
  if (quoted && quoted[1]) return quoted[1].trim();
  return null;
}

async function searchVostorg(query) {
  const url = `https://stores-api.zakaz.ua/stores/${STORE_ID}/products/search?q=${encodeURIComponent(query)}`;

  const res = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json"
    },
    timeout: 30000
  });

  return Array.isArray(res.data?.results) ? res.data.results : [];
}

function mapProduct(product, index, forcedCategory = null) {
  const title = normalizeTitle(product.title);
  const price = parsePrice(product.price);
  const oldPrice = parsePrice(product.old_price);

  if (!title || price === null) return null;

  const discountPercent =
    oldPrice && oldPrice > price
      ? Math.round(((oldPrice - price) / oldPrice) * 100)
      : null;

  return {
    id: String(product.id || index + 1),
    storeId: 5,
    category: forcedCategory || detectCategory(title),
    brand: detectBrand(title),
    title,
    price,
    oldPrice,
    discountPercent,
    imageUrl: product.image_url || null,
    createdAt: Date.now()
  };
}

async function getCategoryProducts(category, queries, limit = LIMIT_PER_CATEGORY) {
  const collected = [];
  const seen = new Set();

  for (const query of queries) {
    const results = await searchVostorg(query);

    for (const product of results) {
      const item = mapProduct(product, collected.length, category);
      if (!item) continue;

      const key = `${item.title}|${item.price}`;
      if (seen.has(key)) continue;

      seen.add(key);
      collected.push(item);

      if (collected.length >= limit) break;
    }

    if (collected.length >= limit) break;
  }

  return collected.slice(0, limit);
}

async function scrapeVostorg() {
  console.log("🚀 START VOSTORG API");

  try {
    const categoryQueries = [
      { category: "dairy", queries: ["молоко", "кефір", "йогурт", "сир"] },
      { category: "bread", queries: ["хлеб", "батон", "лаваш", "булочка"] },
      { category: "chicken", queries: ["курица", "куриное филе", "куриная голень"] },
      { category: "pork", queries: ["свинина", "свиная шея", "свиные ребра"] },
      { category: "veal", queries: ["телятина", "телячья вырезка"] },
      { category: "fish", queries: ["рыба", "лосось", "хек", "скумбрия"] },
      { category: "seafood", queries: ["креветки", "мидии", "кальмар"] },
      { category: "sauces", queries: ["кетчуп", "соус", "майонез", "горчица"] },
      { category: "oil", queries: ["масло подсолнечное", "оливковое масло"] },
      { category: "chocolate", queries: ["шоколад", "конфеты", "батончик"] },
      { category: "water", queries: ["вода", "минеральная вода"] },
      { category: "beer", queries: ["пиво"] },
      { category: "low_alcohol", queries: ["сидр", "слабоалкогольный напиток", "алкогольный коктейль"] },
      { category: "strong_alcohol", queries: ["водка", "виски", "ром", "джин", "коньяк"] }
    ];

    const allItems = [];

    for (const config of categoryQueries) {
      const items = await getCategoryProducts(
        config.category,
        config.queries,
        LIMIT_PER_CATEGORY
      );

      console.log(`✅ ${config.category}: ${items.length}`);
      allItems.push(...items);
    }

    console.log("✅ FINAL VOSTORG:", allItems.length);
    return allItems;
  } catch (e) {
    console.log("❌ VOSTORG ERROR:", e.message);
    return [];
  }
}

module.exports = { scrapeVostorg };
