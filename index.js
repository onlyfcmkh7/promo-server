const express = require("express");

const app = express();

// ❗ ВАЖЛИВО
const PORT = process.env.PORT || 3000;

app.get("/promotions/atb", (req, res) => {
  res.json([
    {
      id: "1",
      storeId: 1,
      title: "Молоко 2.5%",
      price: 39.9,
      oldPrice: 49.9,
      imageUrl: null
    },
    {
      id: "2",
      storeId: 1,
      title: "Хліб білий",
      price: 22.5,
      oldPrice: 28.0,
      imageUrl: null
    }
  ]);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
