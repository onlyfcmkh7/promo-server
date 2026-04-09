const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

const categoryConfigs = [
  {
    key: "dairy",
    brands: ["Яготинське", "Галичина", "Простоквашино"],
    products: [
      { type: "молоко", variants: ["2.5% 900мл", "3.2% 900мл", "1% 900мл", "2.6% 870мл"] },
      { type: "кефір", variants: ["1% 900г", "2.5% 900г", "2.5% 850г"] },
      { type: "сметана", variants: ["15% 300г", "20% 300г", "21% 350г"] },
      { type: "ряжанка", variants: ["4% 500г", "2.5% 850г"] },
      { type: "йогурт", variants: ["натуральний 270г", "полуниця 250г", "персик 250г"] }
    ]
  },
  {
    key: "bread",
    brands: ["Київхліб", "Кулиничі", "Хлібодар"],
    products: [
      { type: "хліб білий", variants: ["500г", "650г"] },
      { type: "хліб житній", variants: ["600г", "700г"] },
      { type: "батон нарізний", variants: ["450г", "500г"] },
      { type: "лаваш", variants: ["200г", "250г"] },
      { type: "булочки для бургерів", variants: ["300г", "320г"] }
    ]
  },
  {
    key: "chicken",
    brands: ["Наша Ряба", "Гаврилівські курчата"],
    products: [
      { type: "філе куряче", variants: ["1кг", "900г"] },
      { type: "стегно куряче", variants: ["1кг"] },
      { type: "гомілка куряча", variants: ["1кг"] },
      { type: "крило куряче", variants: ["1кг"] },
      { type: "тушка куряча", variants: ["1.5кг", "1.7кг"] }
    ]
  },
  {
    key: "ketchup",
    brands: ["Чумак", "Торчин"],
    products: [
      { type: "кетчуп класичний", variants: ["300г", "500г"] },
      { type: "кетчуп лагідний", variants: ["300г"] },
      { type: "кетчуп шашличний", variants: ["270г", "300г"] },
      { type: "кетчуп томатний", variants: ["500г"] }
    ]
  },
  {
    key: "oil",
    brands: ["Олейна", "Щедрий Дар"],
    products: [
      { type: "олія соняшникова", variants: ["850мл", "1л"] },
      { type: "олія рафінована", variants: ["850мл", "1л"] },
      { type: "олія дезодорована", variants: ["850мл", "1л"] }
    ]
  },
  {
    key: "chocolate",
    brands: ["Корона", "Roshen", "Millennium"],
    products: [
      { type: "шоколад молочний", variants: ["90г", "100г"] },
      { type: "шоколад чорний", variants: ["85г", "90г"] },
      { type: "шоколад білий", variants: ["90г"] },
      { type: "шоколад з горіхами", variants: ["90г", "100г"] }
    ]
  },
  {
    key: "water",
    brands: ["Моршинська", "BonAqua", "Карпатська Джерельна"],
    products: [
      { type: "вода негазована", variants: ["1.5л", "2л"] },
      { type: "вода слабогазована", variants: ["1.5л"] },
      { type: "вода сильногазована", variants: ["1.5л"] },
      { type: "вода мінеральна негазована", variants: ["1.5л"] }
    ]
  }
];

const alcoholCatalog = [
  {
    brand: "Оболонь",
    products: [
      { type: "пиво світле", variants: ["0.5л", "1л"] },
      { type: "пиво нефільтроване", variants: ["0.5л"] }
    ]
  },
  {
    brand: "Чернігівське",
    products: [
      { type: "пиво світле", variants: ["0.5л", "1л"] },
      { type: "пиво lager", variants: ["0.5л"] }
    ]
  },
  {
    brand: "Львівське",
    products: [
      { type: "пиво світле", variants: ["0.5л", "1л"] },
      { type: "пиво нефільтроване", variants: ["0.5л"] }
    ]
  },
  {
    brand: "Stella Artois",
    products: [
      { type: "пиво lager", variants: ["0.5л"] }
    ]
  },
  {
    brand: "Corona Extra",
    products: [
      { type: "пиво світле", variants: ["0.33л", "0.5л"] }
    ]
  },
  {
    brand: "Garage",
    products: [
      { type: "сидр", variants: ["0.4л", "0.5л"] }
    ]
  },
  {
    brand: "Revo",
    products: [
      { type: "напій слабоалкогольний", variants: ["0.33л", "0.5л"] }
    ]
  },
  {
    brand: "Shabo",
    products: [
      { type: "вино біле сухе", variants: ["0.75л"] },
      { type: "вино червоне напівсолодке", variants: ["0.75л"] }
    ]
  },
  {
    brand: "Koblevo",
    products: [
      { type: "вино біле сухе", variants: ["0.75л"] },
      { type: "вино червоне напівсолодке", variants: ["0.75л"] }
    ]
  },
  {
    brand: "Nemiroff",
    products: [
      { type: "горілка класична", variants: ["0.5л", "0.7л"] },
      { type: "горілка premium", variants: ["0.5л"] }
    ]
  },
  {
    brand: "Хортиця",
    products: [
      { type: "горілка класична", variants: ["0.5л", "0.7л"] },
      { type: "горілка premium", variants: ["0.5л"] }
    ]
  },
  {
    brand: "Absolut",
    products: [
      { type: "горілка premium", variants: ["0.5л", "0.7л"] }
    ]
  },
  {
    brand: "Jameson",
    products: [
      { type: "віскі", variants: ["0.5л", "0.7л"] }
    ]
  },
  {
    brand: "Jack Daniel's",
    products: [
      { type: "віскі", variants: ["0.5л", "0.7л"] }
    ]
  }
];

function pickByIndex(array, index) {
  return array[index % array.length];
}

function normalizeSpaces(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildProductTitle(brand, productType, variant) {
  const safeBrand = normalizeSpaces(brand);
  const safeType = normalizeSpaces(productType);
  const safeVariant = normalizeSpaces(variant);

  if (safeBrand && safeType && safeVariant) {
    return `${safeBrand} ${safeType} ${safeVariant}`;
  }

  if (safeBrand && safeType) {
    return `${safeBrand} ${safeType}`;
  }

  if (safeBrand && safeVariant) {
    return `${safeBrand} товар ${safeVariant}`;
  }

  if (safeBrand) {
    return `${safeBrand} товар`;
  }

  return "Товар";
}

function calculatePrices(categoryKey, index, productType = "") {
  const seed = index * 13;
  let oldPrice;

  switch (categoryKey) {
    case "dairy":
      oldPrice = 34 + (seed % 18);
      break;
    case "bread":
      oldPrice = 20 + (seed % 16);
      break;
    case "chicken":
      oldPrice = 109 + (seed % 70);
      break;
    case "ketchup":
      oldPrice = 28 + (seed % 18);
      break;
    case "oil":
      oldPrice = 55 + (seed % 25);
      break;
    case "chocolate":
      oldPrice = 32 + (seed % 24);
      break;
    case "water":
      oldPrice = 18 + (seed % 14);
      break;
    case "alcohol":
      if (productType.includes("віскі")) {
        oldPrice = 520 + (seed % 380);
      } else if (productType.includes("горілка")) {
        oldPrice = 160 + (seed % 220);
      } else if (productType.includes("вино")) {
        oldPrice = 140 + (seed % 180);
      } else if (productType.includes("сидр") || productType.includes("слабоалкогольний")) {
        oldPrice = 38 + (seed % 45);
      } else {
        oldPrice = 30 + (seed % 55);
      }
      break;
    default:
      oldPrice = 25 + (seed % 20);
      break;
  }

  const discountPercent = 10 + (seed % 26);
  const price = Number((oldPrice * (1 - discountPercent / 100)).toFixed(2));

  return {
    oldPrice: Number(oldPrice.toFixed(2)),
    price,
    discountPercent
  };
}

function buildRegularPromotions(startId = 1) {
  const items = [];
  let id = startId;

  categoryConfigs.forEach((category, categoryIndex) => {
    category.brands.forEach((brand, brandIndex) => {
      category.products.forEach((product, productIndex) => {
        const variant = pickByIndex(
          product.variants,
          categoryIndex + brandIndex + productIndex
        );

        const title = buildProductTitle(brand, product.type, variant);
        const { oldPrice, price, discountPercent } = calculatePrices(category.key, id, product.type);

        items.push({
          id: String(id),
          storeId: 1,
          category: category.key,
          brand,
          title,
          price,
          oldPrice,
          discountPercent,
          imageUrl: null
        });

        id++;
      });
    });
  });

  return { items, nextId: id };
}

function buildAlcoholPromotions(startId = 1) {
  const items = [];
  let id = startId;

  alcoholCatalog.forEach((entry, brandIndex) => {
    entry.products.forEach((product, productIndex) => {
      const variant = pickByIndex(product.variants, brandIndex + productIndex);
      const title = buildProductTitle(entry.brand, product.type, variant);
      const { oldPrice, price, discountPercent } = calculatePrices("alcohol", id, product.type);

      items.push({
        id: String(id),
        storeId: 1,
        category: "alcohol",
        brand: entry.brand,
        title,
        price,
        oldPrice,
        discountPercent,
        imageUrl: null
      });

      id++;
    });
  });

  return { items, nextId: id };
}

function buildAtbPromotions() {
  const regular = buildRegularPromotions(1);
  const alcohol = buildAlcoholPromotions(regular.nextId);

  return [...regular.items, ...alcohol.items];
}

app.get("/promotions/atb", (req, res) => {
  res.json(buildAtbPromotions());
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
