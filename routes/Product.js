const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const uploadImage = require("../middlewares/imageUploadMiddleware");

// GET routes
router.get("/", productController.getAllProducts);

// POST routes (with upload middleware)
router.post("/", uploadImage, productController.createProduct);

// patch routes (with upload middleware)`
router.patch("/:id", uploadImage, productController.updateProduct);

// DELETE routes
router.delete("/:id", productController.deleteProduct);

module.exports = router;
