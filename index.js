const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

const catalog = [
  {
    category: "dairy",
    brand: "Яготинське",
    items: [
      { name: "молоко 2.5% 900мл", minOldPrice: 42, maxOldPrice: 56 },
      { name: "молоко 3.2% 900мл", minOldPrice: 44, maxOldPrice: 58 },
      { name: "кефір 2.5% 900г", minOldPrice: 38, maxOldPrice: 50 },
      { name: "сметана 15% 300г", minOldPrice: 34, maxOldPrice: 46 },
      { name: "ряжанка 4% 500г", minOldPrice: 32, maxOldPrice: 42 }
    ]
  },
  {
    category: "dairy",
    brand: "Галичина",
    items: [
      { name: "молоко 3.2% 900мл", minOldPrice: 43, maxOldPrice: 57 },
      { name: "кефір 2.5% 850г", minOldPrice: 37, maxOldPrice: 49 },
      { name: "сметана 20% 300г", minOldPrice: 36, maxOldPrice: 48 },
      { name: "ряжанка 2.5% 850г", minOldPrice: 38, maxOldPrice: 50 },
      { name: "йогурт персик 250г", minOldPrice: 24, maxOldPrice: 34 }
    ]
  },
  {
    category: "dairy",
    brand: "Простоквашино",
    items: [
      { name: "молоко 1% 900мл", minOldPrice: 41, maxOldPrice: 54 },
      { name: "кефір 1% 900г", minOldPrice: 36, maxOldPrice: 48 },
      { name: "сметана 20% 300г", minOldPrice: 35, maxOldPrice: 47 },
      { name: "ряжанка 2.5% 850г", minOldPrice: 37, maxOldPrice: 49 },
      { name: "йогурт натуральний 270г", minOldPrice: 25, maxOldPrice: 35 }
    ]
  },
  {
    category: "bread",
    brand: "Київхліб",
    items: [
      { name: "хліб білий 500г", minOldPrice: 22, maxOldPrice: 32 },
      { name: "хліб житній 600г", minOldPrice: 24, maxOldPrice: 34 },
      { name: "батон нарізний 500г", minOldPrice: 21, maxOldPrice: 30 }
    ]
  },
  {
    category: "bread",
    brand: "Кулиничі",
    items: [
      { name: "хліб білий 500г", minOldPrice: 21, maxOldPrice: 31 },
      { name: "батон нарізний 450г", minOldPrice: 20, maxOldPrice: 29 },
      { name: "лаваш 250г", minOldPrice: 20, maxOldPrice: 28 }
    ]
  },
  {
    category: "bread",
    brand: "Хлібодар",
    items: [
      { name: "хліб житній 600г", minOldPrice: 23, maxOldPrice: 33 },
      { name: "хліб білий 650г", minOldPrice: 24, maxOldPrice: 35 },
      { name: "булочки для бургерів 320г", minOldPrice: 24, maxOldPrice: 34 }
    ]
  },
  {
    category: "chicken",
    brand: "Наша Ряба",
    items: [
      { name: "філе куряче 1кг", minOldPrice: 155, maxOldPrice: 189 },
      { name: "стегно куряче 1кг", minOldPrice: 118, maxOldPrice: 149 },
      { name: "гомілка куряча 1кг", minOldPrice: 102, maxOldPrice: 132 }
    ]
  },
  {
    category: "chicken",
    brand: "Гаврилівські курчата",
    items: [
      { name: "філе куряче 900г", minOldPrice: 145, maxOldPrice: 178 },
      { name: "крило куряче 1кг", minOldPrice: 92, maxOldPrice: 122 },
      { name: "тушка куряча 1.7кг", minOldPrice: 132, maxOldPrice: 166 }
    ]
  },
  {
    category: "ketchup",
    brand: "Чумак",
    items: [
      { name: "кетчуп класичний 300г", minOldPrice: 28, maxOldPrice: 40 },
      { name: "кетчуп шашличний 300г", minOldPrice: 30, maxOldPrice: 42 },
      { name: "кетчуп томатний 500г", minOldPrice: 36, maxOldPrice: 49 }
    ]
  },
  {
    category: "ketchup",
    brand: "Торчин",
    items: [
      { name: "кетчуп лагідний 300г", minOldPrice: 27, maxOldPrice: 39 },
      { name: "кетчуп класичний 300г", minOldPrice: 28, maxOldPrice: 40 },
      { name: "кетчуп шашличний 270г", minOldPrice: 29, maxOldPrice: 41 }
    ]
  },
  {
    category: "oil",
    brand: "Олейна",
    items: [
      { name: "олія соняшникова 850мл", minOldPrice: 62, maxOldPrice: 79 },
      { name: "олія рафінована 1л", minOldPrice: 66, maxOldPrice: 84 }
    ]
  },
  {
    category: "oil",
    brand: "Щедрий Дар",
    items: [
      { name: "олія соняшникова 1л", minOldPrice: 64, maxOldPrice: 82 },
      { name: "олія дезодорована 1л", minOldPrice: 65, maxOldPrice: 83 }
    ]
  },
  {
    category: "chocolate",
    brand: "Корона",
    items: [
      { name: "шоколад молочний 90г", minOldPrice: 36, maxOldPrice: 52 },
      { name: "шоколад чорний 85г", minOldPrice: 38, maxOldPrice: 54 }
    ]
  },
  {
    category: "chocolate",
    brand: "Roshen",
    items: [
      { name: "шоколад молочний 90г", minOldPrice: 34, maxOldPrice: 49 },
      { name: "шоколад з горіхами 100г", minOldPrice: 38, maxOldPrice: 55 }
    ]
  },
  {
    category: "chocolate",
    brand: "Millennium",
    items: [
      { name: "шоколад чорний 90г", minOldPrice: 35, maxOldPrice: 50 },
      { name: "шоколад білий 90г", minOldPrice: 34, maxOldPrice: 48 }
    ]
  },
  {
    category: "water",
    brand: "Моршинська",
    items: [
      { name: "вода негазована 1.5л", minOldPrice: 19, maxOldPrice: 28 },
      { name: "вода слабогазована 1.5л", minOldPrice: 19, maxOldPrice: 28 }
    ]
  },
  {
    category: "water",
    brand: "BonAqua",
    items: [
      { name: "вода негазована 2л", minOldPrice: 23, maxOldPrice: 34 },
      { name: "вода сильногазована 1.5л", minOldPrice: 21, maxOldPrice: 31 }
    ]
  },
  {
    category: "water",
    brand: "Карпатська Джерельна",
    items: [
      { name: "вода негазована 1.5л", minOldPrice: 18, maxOldPrice: 27 },
      { name: "вода мінеральна негазована 1.5л", minOldPrice: 20, maxOldPrice: 29 }
    ]
  },
  {
    category: "alcohol",
    brand: "Оболонь",
    items: [
      { name: "пиво світле 0.5л", minOldPrice: 30, maxOldPrice: 42 },
      { name: "пиво нефільтроване 0.5л", minOldPrice: 32, maxOldPrice: 45 }
    ]
  },
  {
    category: "alcohol",
    brand: "Чернігівське",
    items: [
      { name: "пиво світле 0.5л", minOldPrice: 31, maxOldPrice: 44 },
      { name: "пиво lager 0.5л", minOldPrice: 33, maxOldPrice: 46 }
    ]
  },
  {
    category: "alcohol",
    brand: "Львівське",
    items: [
      { name: "пиво світле 0.5л", minOldPrice: 30, maxOldPrice: 43 },
      { name: "пиво нефільтроване 0.5л", minOldPrice: 32, maxOldPrice: 45 }
    ]
  },
  {
    category: "alcohol",
    brand: "Stella Artois",
    items: [
      { name: "пиво lager 0.5л", minOldPrice: 42, maxOldPrice: 58 }
    ]
  },
  {
    category: "alcohol",
    brand: "Corona Extra",
    items: [
      { name: "пиво світле 0.33л", minOldPrice: 46, maxOldPrice: 64 }
    ]
  },
  {
    category: "alcohol",
    brand: "Garage",
    items: [
      { name: "сидр 0.44л", minOldPrice: 38, maxOldPrice: 54 }
    ]
  },
  {
    category: "alcohol",
    brand: "Revo",
    items: [
      { name: "напій слабоалкогольний 0.5л", minOldPrice: 39, maxOldPrice: 55 }
    ]
  },
  {
    category: "alcohol",
    brand: "Shabo",
    items: [
      { name: "вино біле сухе 0.75л", minOldPrice: 155, maxOldPrice: 260 },
      { name: "вино червоне напівсолодке 0.75л", minOldPrice: 165, maxOldPrice: 270 }
    ]
  },
  {
    category: "alcohol",
    brand: "Koblevo",
    items: [
      { name: "вино біле сухе 0.75л", minOldPrice: 145, maxOldPrice: 235 },
      { name: "вино червоне напівсолодке 0.75л", minOldPrice: 150, maxOldPrice: 245 }
    ]
  },
  {
    category: "alcohol",
    brand: "Nemiroff",
    items: [
      { name: "горілка класична 0.5л", minOldPrice: 180, maxOldPrice: 285 },
      { name: "горілка premium 0.5л", minOldPrice: 220, maxOldPrice: 340 }
    ]
  },
  {
    category: "alcohol",
    brand: "Хортиця",
    items: [
      { name: "горілка класична 0.5л", minOldPrice: 170, maxOldPrice: 275 },
      { name: "горілка premium 0.5л", minOldPrice: 210, maxOldPrice: 330 }
    ]
  },
  {
    category: "alcohol",
    brand: "Absolut",
    items: [
      { name: "горілка premium 0.7л", minOldPrice: 520, maxOldPrice: 760 }
    ]
  },
  {
    category: "alcohol",
    brand: "Jameson",
    items: [
      { name: "віскі 0.7л", minOldPrice: 780, maxOldPrice: 1150 }
    ]
  },
  {
    category: "alcohol",
    brand: "Jack Daniel's",
    items: [
      { name: "віскі 0.7л", minOldPrice: 820, maxOldPrice: 1220 }
    ]
  }
];

function normalizeSpaces(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function buildProductTitle(brand, itemName) {
  return normalizeSpaces(`${brand} ${itemName}`);
}

function seededNumber(seed, min, max) {
  const value = Math.abs(Math.sin(seed)) * 10000;
  const normalized = value - Math.floor(value);
  return min + normalized * (max - min);
}

function buildPrices(minOldPrice, maxOldPrice, seed) {
  const oldPriceRaw = seededNumber(seed, minOldPrice, maxOldPrice);
  const oldPrice = Math.round(oldPriceRaw * 100) / 100;

  const discountPercent = 10 + Math.floor(seededNumber(seed + 17, 0, 26));
  const price = Math.round((oldPrice * (1 - discountPercent / 100)) * 100) / 100;

  return {
    oldPrice,
    price,
    discountPercent
  };
}

function buildCreatedAt(id) {
  const now = Date.now();
  const maxAge = 14 * 24 * 60 * 60 * 1000;
  const offset = (id * 987654) % maxAge;
  return now - offset;
}

function buildAtbPromotions() {
  const items = [];
  let id = 1;

  catalog.forEach((entry, entryIndex) => {
    entry.items.forEach((item, itemIndex) => {
      const seed = id * 31 + entryIndex * 17 + itemIndex * 13;
      const { oldPrice, price, discountPercent } = buildPrices(
        item.minOldPrice,
        item.maxOldPrice,
        seed
      );

      items.push({
        id: String(id),
        storeId: 1,
        category: entry.category,
        brand: entry.brand,
        title: buildProductTitle(entry.brand, item.name),
        price,
        oldPrice,
        discountPercent,
        createdAt: buildCreatedAt(id),
        imageUrl: null
      });

      id++;
    });
  });

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  return items.filter(item => item.createdAt >= sevenDaysAgo);
}

app.get("/promotions/atb", (req, res) => {
  res.json(buildAtbPromotions());
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
