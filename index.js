const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

const categoryConfigs = [
  {
    key: "milk",
    brands: ["Яготинське", "Галичина", "Простоквашино"],
    products: [
      { name: "молоко", variants: ["2.5% 900мл", "3.2% 900мл", "1% 900мл", "2.5% 1л"] },
      { name: "кефір", variants: ["2.5% 900г", "1% 900г", "2.5% 1л"] },
      { name: "сметана", variants: ["15% 300г", "20% 300г", "21% 350г"] },
      { name: "ряжанка", variants: ["4% 500г", "2.5% 850г"] },
      { name: "йогурт", variants: ["полуниця 250г", "персик 250г", "натуральний 270г"] }
    ]
  },
  {
    key: "bread",
    brands: ["Київхліб", "Кулиничі", "Хлібодар"],
    products: [
      { name: "хліб білий", variants: ["500г", "650г"] },
      { name: "хліб житній", variants: ["600г", "700г"] },
      { name: "батон нарізний", variants: ["450г", "500г"] },
      { name: "лаваш", variants: ["200г", "250г"] },
      { name: "булочки для бургерів", variants: ["300г", "320г"] }
    ]
  },
  {
    key: "chicken",
    brands: ["Наша Ряба", "Гаврилівські курчата"],
    products: [
      { name: "філе куряче", variants: ["1кг", "900г"] },
      { name: "стегно куряче", variants: ["1кг"] },
      { name: "гомілка куряча", variants: ["1кг"] },
      { name: "крило куряче", variants: ["1кг"] },
      { name: "тушка куряча", variants: ["1.5кг", "1.7кг"] }
    ]
  },
  {
    key: "ketchup",
    brands: ["Чумак", "Торчин"],
    products: [
      { name: "кетчуп класичний", variants: ["300г", "500г"] },
      { name: "кетчуп шашличний", variants: ["270г", "300г"] },
      { name: "кетчуп лагідний", variants: ["300г"] },
      { name: "кетчуп томатний", variants: ["500г"] }
    ]
  },
  {
    key: "oil",
    brands: ["Олейна", "Щедрий Дар"],
    products: [
      { name: "олія соняшникова", variants: ["850мл", "1л"] },
      { name: "олія рафінована", variants: ["850мл", "1л"] },
      { name: "олія дезодорована", variants: ["850мл", "1л"] }
    ]
  },
  {
    key: "chocolate",
    brands: ["Корона", "Roshen", "Millennium"],
    products: [
      { name: "шоколад молочний", variants: ["90г", "100г"] },
      { name: "шоколад чорний", variants: ["85г", "90г"] },
      { name: "шоколад білий", variants: ["90г"] },
      { name: "шоколад з горіхами", variants: ["90г", "100г"] }
    ]
  },
  {
    key: "water",
    brands: ["Моршинська", "BonAqua", "Карпатська Джерельна"],
    products: [
      { name: "вода негазована", variants: ["1.5л", "2л"] },
      { name: "вода слабогазована", variants: ["1.5л"] },
      { name: "вода сильногазована", variants: ["1.5л"] },
      { name: "вода мінеральна негазована", variants: ["1.5л"] }
    ]
  }
];

function pickFrom(array, index) {
  return array[index % array.length];
}

function buildTitle(brand, productName, variant) {
  return `${brand} ${productName} ${variant}`.trim();
}

function calculatePrices(index, categoryIndex, brandIndex) {
  const seed = index + categoryIndex * 7 + brandIndex * 5;

  let oldPrice = 0;

  if (categoryIndex === 0) oldPrice = 34 + (seed % 18); // milk
  else if (categoryIndex === 1) oldPrice = 22 + (seed % 16); // bread
  else if (categoryIndex === 2) oldPrice = 109 + (seed % 60); // chicken
  else if (categoryIndex === 3) oldPrice = 28 + (seed % 22); // ketchup
  else if (categoryIndex === 4) oldPrice = 54 + (seed % 26); // oil
  else if (categoryIndex === 5) oldPrice = 32 + (seed % 28); // chocolate
  else if (categoryIndex === 6) oldPrice = 18 + (seed % 15); // water
  else oldPrice = 25 + (seed % 20);

  const discountPercent = 10 + (seed % 26); // 10%..35%
  const price = Number((oldPrice * (1 - discountPercent / 100)).toFixed(2));

  return {
    oldPrice: Number(oldPrice.toFixed(2)),
    price,
    discountPercent
  };
}

function buildAtbPromotions() {
  const items = [];
  let id = 1;

  categoryConfigs.forEach((category, categoryIndex) => {
    category.brands.forEach((brand, brandIndex) => {
      category.products.forEach((product, productIndex) => {
        const variant = pickFrom(
          product.variants,
          brandIndex + productIndex + categoryIndex
        );

        const { oldPrice, price, discountPercent } = calculatePrices(
          id,
          categoryIndex,
          brandIndex
        );

        items.push({
          id: String(id),
          storeId: 1,
          brand,
          title: buildTitle(brand, product.name, variant),
          price,
          oldPrice,
          discountPercent,
          imageUrl: null
        });

        id++;
      });
    });
  });

  return items;
}

app.get("/promotions/atb", (req, res) => {
  res.json(buildAtbPromotions());
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
