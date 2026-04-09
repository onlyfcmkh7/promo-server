const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

const brands = [
  "Яготинське",
  "Галичина",
  "Чумак",
  "Олейна",
  "Повна Чаша"
];

const categoryConfigs = [
  { key: "milk", specs: ["2.5% 900ml", "3.2% 900ml", "1% 900ml", "2.5% 1L", "3.2% 1L"] },
  { key: "bread", specs: ["500g", "650g", "toast 500g", "white 600g", "rye 550g"] },
  { key: "sour cream", specs: ["15% 300g", "20% 300g", "15% 350g", "20% 400g", "10% 300g"] },
  { key: "kefir", specs: ["1% 900ml", "2.5% 900ml", "3.2% 900ml", "1% 1L", "2.5% 1L"] },
  { key: "butter", specs: ["72.5% 180g", "73% 200g", "82% 180g", "82% 200g", "63% 180g"] },
  { key: "cheese", specs: ["45% 150g", "50% 180g", "45% 200g", "50% 250g", "40% 180g"] },
  { key: "yogurt", specs: ["2% 250g", "2.5% 300g", "strawberry 270g", "peach 270g", "classic 300g"] },
  { key: "eggs", specs: ["10pcs", "18pcs", "C1 10pcs", "C0 10pcs", "XL 10pcs"] },
  { key: "chicken", specs: ["fillet 1kg", "thigh 1kg", "drumstick 1kg", "wing 1kg", "whole 1.5kg"] },
  { key: "pork", specs: ["neck 1kg", "ham 1kg", "shoulder 1kg", "ribs 1kg", "minced 500g"] },
  { key: "beef", specs: ["goulash 1kg", "minced 500g", "steak 1kg", "liver 1kg", "bone 1kg"] },
  { key: "potato", specs: ["1kg", "2kg", "young 1kg", "washed 2kg", "selected 1kg"] },
  { key: "banana", specs: ["1kg", "premium 1kg", "mini 500g", "selected 1kg", "sweet 1kg"] },
  { key: "apple", specs: ["1kg", "green 1kg", "red 1kg", "gala 1kg", "golden 1kg"] },
  { key: "carrot", specs: ["1kg", "washed 1kg", "baby 500g", "selected 1kg", "2kg"] },
  { key: "onion", specs: ["1kg", "yellow 1kg", "red 1kg", "white 1kg", "2kg"] },
  { key: "tomato", specs: ["1kg", "cherry 250g", "cream 1kg", "pink 1kg", "vine 1kg"] },
  { key: "cucumber", specs: ["1kg", "short 1kg", "long 1kg", "greenhouse 1kg", "mini 500g"] },
  { key: "pepper", specs: ["red 1kg", "yellow 1kg", "green 1kg", "mix 1kg", "sweet 1kg"] },
  { key: "cabbage", specs: ["1kg", "white 1kg", "young 1kg", "red 1kg", "2kg"] },
  { key: "rice", specs: ["800g", "1kg", "round 800g", "long 1kg", "steamed 800g"] },
  { key: "buckwheat", specs: ["800g", "1kg", "selected 800g", "roasted 800g", "premium 1kg"] },
  { key: "pasta", specs: ["400g", "500g", "spirals 400g", "shells 400g", "feathers 500g"] },
  { key: "spaghetti", specs: ["400g", "500g", "durum 400g", "premium 500g", "thin 400g"] },
  { key: "flour", specs: ["1kg", "2kg", "premium 1kg", "extra 2kg", "wheat 1kg"] },
  { key: "sugar", specs: ["1kg", "2kg", "white 1kg", "crystal 1kg", "extra 1kg"] },
  { key: "salt", specs: ["1kg", "iodized 1kg", "sea 500g", "extra 1kg", "rock 1kg"] },
  { key: "oil", specs: ["850ml", "1L", "refined 850ml", "deodorized 1L", "sunflower 850ml"] },
  { key: "mayonnaise", specs: ["67% 300g", "72% 300g", "50% 400g", "classic 300g", "provence 300g"] },
  { key: "ketchup", specs: ["300g", "500g", "classic 300g", "barbecue 300g", "mild 500g"] },
  { key: "mustard", specs: ["130g", "160g", "classic 130g", "hot 160g", "grainy 150g"] },
  { key: "sausage", specs: ["500g", "700g", "boiled 500g", "smoked 400g", "classic 600g"] },
  { key: "ham", specs: ["300g", "400g", "sliced 150g", "classic 300g", "smoked 350g"] },
  { key: "bacon", specs: ["200g", "250g", "sliced 150g", "smoked 200g", "classic 250g"] },
  { key: "sausages", specs: ["450g", "500g", "milk 450g", "classic 500g", "grill 500g"] },
  { key: "fish", specs: ["1kg", "frozen 1kg", "fillet 800g", "steak 600g", "selected 1kg"] },
  { key: "herring", specs: ["300g", "500g", "fillet 300g", "pieces 500g", "lightly salted 300g"] },
  { key: "mackerel", specs: ["1kg", "smoked 400g", "frozen 1kg", "fillet 300g", "salted 350g"] },
  { key: "shrimp", specs: ["400g", "500g", "cooked 400g", "frozen 500g", "cleaned 400g"] },
  { key: "bread", specs: ["white 500g", "black 500g", "toast 500g", "rye 550g", "baguette 250g"] },
  { key: "cookies", specs: ["180g", "250g", "classic 180g", "chocolate 200g", "butter 250g"] },
  { key: "waffles", specs: ["140g", "200g", "vanilla 140g", "chocolate 200g", "classic 180g"] },
  { key: "chocolate", specs: ["90g", "100g", "milk 90g", "dark 90g", "white 90g"] },
  { key: "candy", specs: ["200g", "250g", "assorted 250g", "caramel 200g", "chocolate 250g"] },
  { key: "chips", specs: ["133g", "120g", "sour cream 133g", "cheese 120g", "bacon 133g"] },
  { key: "nuts", specs: ["150g", "200g", "mix 150g", "salted 200g", "roasted 150g"] },
  { key: "oatmeal", specs: ["400g", "500g", "flakes 400g", "instant 500g", "classic 400g"] },
  { key: "muesli", specs: ["300g", "400g", "fruit 300g", "nuts 400g", "classic 350g"] },
  { key: "beans", specs: ["400g", "500g", "white 400g", "red 500g", "selected 400g"] },
  { key: "corn", specs: ["340g", "400g", "sweet 340g", "canned 400g", "selected 340g"] },
  { key: "peas", specs: ["400g", "450g", "green 400g", "canned 450g", "selected 400g"] },
  { key: "juice", specs: ["1L", "950ml", "orange 1L", "apple 1L", "multivitamin 950ml"] },
  { key: "water", specs: ["1.5L", "2L", "still 1.5L", "sparkling 1.5L", "mineral 1.5L"] },
  { key: "tea", specs: ["25bags", "50bags", "black 25bags", "green 25bags", "herbal 20bags"] },
  { key: "coffee", specs: ["250g", "100g", "ground 250g", "instant 100g", "beans 250g"] },
  { key: "cocoa", specs: ["150g", "200g", "classic 150g", "premium 200g", "instant 150g"] },
  { key: "baby food", specs: ["90g", "125g", "puree 90g", "fruit 125g", "vegetable 90g"] },
  { key: "pickles", specs: ["680g", "720g", "classic 680g", "marinated 720g", "crispy 680g"] },
  { key: "spices", specs: ["20g", "30g", "mix 20g", "pepper 30g", "universal 25g"] },
  { key: "vanilla sugar", specs: ["10g", "20g", "classic 10g", "premium 20g", "sweet 10g"] }
];

function buildAtbPromotions() {
  const items = [];
  let id = 1;

  for (const category of categoryConfigs) {
    for (let i = 0; i < brands.length; i++) {
      const brand = brands[i];
      const spec = category.specs[i % category.specs.length];

      const basePrice = 18 + (id % 17) * 4 + i * 3;
      const oldPrice = Number((basePrice + 8 + (id % 5) * 2).toFixed(1));
      const price = Number((oldPrice - (6 + (id % 4) * 1.5)).toFixed(1));

      items.push({
        id: String(id),
        storeId: 1,
        title: `${brand} ${category.key} ${spec}`,
        price,
        oldPrice,
        imageUrl: null
      });

      id++;
    }
  }

  return items.slice(0, 300);
}

app.get("/promotions/atb", (req, res) => {
  res.json(buildAtbPromotions());
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
