const Product = require("../models/Product");
const { uploadFileToGCS } = require("../services/s3Uploader");

const isJSONString = (value) => {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return Array.isArray(value) ? value : [];
  }
};

// exports.createProduct = async (req, res) => {
//   try {
//     const { name, description, price, stock, ingredients, benefits } = req.body;
//     const imageUrl = req.file["imageUrl"];

//     // Validate required fields
//     if (!name || !price || !stock) {
//       return res
//         .status(400)
//         .json({ message: "Name, price, and stock are required" });
//     }

//     // Check if file is present
//     // if (!req.file) {
//     //   return res.status(400).json({ message: "Image file is required" });
//     // }

//     // Upload file to S3
//     try {
//       imageUrl = await uploadFileToGCS(req.file, "product-images");
//     } catch (uploadError) {
//       console.error("S3 upload error:", uploadError);
//       return res.status(500).json({
//         message: "Failed to upload image to S3",
//         error: uploadError.message,
//       });
//     }

//     // Verify imageUrl
//     if (!imageUrl) {
//       return res
//         .status(500)
//         .json({ message: "Image upload succeeded but no URL was returned" });
//     }

//     const product = new Product({
//       name,
//       description,
//       price,
//       stock,
//       imageUrl,
//       status:
//         stock === 0 ? "Out of Stock" : stock < 10 ? "Low Stock" : "In Stock",
//       ingredients: isJSONString(ingredients),
//       benefits: isJSONString(benefits),
//     });

//     await product.save();
//     res.status(201).json({ message: "Product created successfully", product });
//   } catch (err) {
//     console.error("Error creating product:", err);
//     res
//       .status(500)
//       .json({ message: "Product creation failed", error: err.message });
//   }
// };
exports.createProduct = async (req, res) => {
  try {
    const { name, description, price, stock, ingredients, benefits } = req.body;

    // Validate required fields
    if (!name || !price || !stock) {
      return res
        .status(400)
        .json({ message: "Name, price, and stock are required" });
    }

    // Check if file exists in req.files.image
    if (!req.files || !req.files.image || !req.files.image[0]) {
      return res.status(400).json({ message: "Image file is required" });
    }

    const file = req.files.image[0]; // Access the uploaded file

    // Log file details for debugging
    console.log("Received file:", {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    });

    // Upload file to S3
    let imageUrl;
    try {
      imageUrl = await uploadFileToGCS(file, "product-images");
      console.log("S3 upload successful, URL:", imageUrl);
    } catch (uploadError) {
      console.error("S3 upload error:", uploadError);
      return res
        .status(500)
        .json({
          message: "Failed to upload image to S3",
          error: uploadError.message,
        });
    }

    // Verify imageUrl
    if (!imageUrl) {
      return res
        .status(500)
        .json({ message: "Image upload succeeded but no URL was returned" });
    }

    const product = new Product({
      name,
      description,
      price,
      stock,
      imageUrl,
      status:
        stock === 0 ? "Out of Stock" : stock < 10 ? "Low Stock" : "In Stock",
      ingredients: isJSONString(ingredients),
      benefits: isJSONString(benefits),
    });

    await product.save();
    res.status(201).json({ message: "Product created successfully", product });
  } catch (err) {
    console.error("Error creating product:", err);
    res
      .status(500)
      .json({ message: "Product creation failed", error: err.message });
  }
};
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res
      .status(200)
      .json({ message: "Products fetched successfully", products });
  } catch (err) {
    console.error("Error fetching products:", err);
    res
      .status(500)
      .json({ message: "Failed to fetch products", error: err.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedProduct = await Product.findByIdAndDelete(id);

    if (!deletedProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json({
      message: "Product deleted successfully",
      product: deletedProduct,
    });
  } catch (err) {
    console.error("Error deleting product:", err);
    res
      .status(500)
      .json({ message: "Failed to delete product", error: err.message });
  }
};
