const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const multer = require("multer");
const path = require("path");
const category = require("../../models/categorySchema");
const variantSchema = require("../../models/variantSchema");
const mongoose = require('mongoose');

const productInfo = async (req, res) => {
  try {
    const { page = 1, limit = 5 } = req.query; // Default to page 1, 10 items per page

    const products = await Product.find()
      .populate("category")
      .populate("brand")
      .skip((page - 1) * limit) // Skip previous pages
      .limit(Number(limit)); // Limit the number of products per page

    const totalProducts = await Product.countDocuments(); // Total number of products
    const totalPages = Math.ceil(totalProducts / limit); // Calculate total pages

    res.render("products", {
      products,
      currentPage: Number(page),
      totalPages,
      limit: Number(limit),
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).send("Internal Server Error");
  }
};

const showAddProductPage = async (req, res) => {
  try {
    const categories = await category.find();
    const brands = await Brand.find();
    res.render("addProduct", { categories, brands });
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).send("Internal Server Error");
  }
};

const addProduct = async (req, res) => {
  try {
    const variants = (req.body.variants || []).map((variant) => ({
      quantity: variant.quantity,
      price: parseFloat(variant.price),
      stock: parseInt(variant.stock, 10),
    }));

    const images = req.files ? req.files.map((file) => file.filename) : [];

    const newProduct = {
      name: req.body.name,
      description: req.body.description,
      category: req.body.category,
      brand: req.body.brand,
      variants,
      images,
      price: parseFloat(req.body.variants[0].price),
    };

    const product = new Product(newProduct);
    await product.save();

    res.json({ success: true, message: "Product added successfully!" });
  } catch (err) {
    console.error("Error adding product:", err);
    res
      .status(500)
      .json({
        success: false,
        message: "An error occurred while adding the product.",
      });
  }
};

const showEditProductPage = async (req, res) => {
  const productId = req.params.id;
  try {
      const product = await Product.findById(productId)
          .populate("category")
          .populate("brand")
          .populate("variants");
      const categories = await Category.find();
      const brands = await Brand.find();
      console.log(product,' product');
      
      
      res.render("editProduct", { product, categories, brands });
  } catch (error) {
      console.error("Error fetching data:", error);
      res.status(500).send("Internal Server Error");
  }
};


const editProduct = async (req, res) => {
  const productId = req.params.id;
  const { name, description, category, brand, variants } = req.body;
  console.log(req.body,'req.body');
  console.log(variants._id,'varaint idddd');
  
  

  try {
      const product = await Product.findById(productId);

      if (!product) {
          return res.status(404).json({ success: false, message: "Product not found" });
      }

      // Update basic fields of the product
      product.name = name;
      product.description = description;
      product.category = category;
      product.brand = brand;

      // Update or create variants
      const updatedVariants = variants.map(variant => {
          if (variant._id) {
              const existingVariant = product.variants.id(variant._id); // Use the id() method to find existing variant by _id
              console.log(existingVariant, ' existing variant');
              
              if (existingVariant) {
                  existingVariant.quantity = variant.quantity;
                  existingVariant.price = variant.price;
                  existingVariant.stock = variant.stock;
                  return existingVariant;
              }
          }
          // Create new variant if no _id found
          return {
              quantity: variant.quantity,
              price: variant.price,
              stock: variant.stock,
              _id: new mongoose.Types.ObjectId(), // New ObjectId for new variants
          };
      }).filter(v => v); // Ensure to filter out any undefined entries

      // Replace the product variants with the updated list
      product.variants = updatedVariants.filter(v => v._id); // Only keep variants with _id

      // Handle image updates (if files are uploaded)
      const images = [];
      if (req.files) {
          images[0] = req.files.image1?.[0]?.filename || product.images[0];
          images[1] = req.files.image2?.[0]?.filename || product.images[1];
          images[2] = req.files.image3?.[0]?.filename || product.images[2];
          images[3] = req.files.image4?.[0]?.filename || product.images[3];

          product.images = images;
      }

      // Save the updated product with updated variants
      await product.save();

      res.json({ success: true, message: "Product updated successfully" });
  } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};





const showProductDetailPage = async (req, res) => {
  console.log('1225678');
  
  try {
    const productId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(404).render("page-404.ejs");
    }

    const product = await Product.findById(productId).populate("offers");

    if (!product) {
      return res.status(404).render("404", { message: "Product not found" });
    }

    // Check if the product is blocked
    if (product.isBlocked) {
      return res.status(403).render("403", { message: "This product is currently unavailable." });
    }

    // Calculate offer prices for each variant
    product.variants.forEach(variant => {
      if (variant.offers && variant.offers.length > 0) {
        const validOffer = variant.offers.find((offer) => {
          const now = new Date();
          return !offer.isBlocked && offer.validFrom <= now && offer.validTo >= now;
        });

        if (validOffer) {
          const discount = validOffer.discount || 0;
          const discountAmount = (variant.price * discount) / 100;
          variant.offerPrice = variant.price - discountAmount; // Calculate offer price
        } else {
          variant.offerPrice = variant.price; // No offer available
        }
      } else {
        variant.offerPrice = variant.price; // No offers associated with this variant
      }
    });

    const relatedProducts = await Product.find({
      category: product.category,
    }).populate("offers");

    res.render("shopping", { product, relatedProducts });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
};



const deleteProduct = async (req, res) => {
  const productId = req.params.id;
  try {
    await Product.findByIdAndDelete(productId);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error deleting product:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to delete product" });
  }
};

const blockProduct = async (req, res) => {
  const productId = req.params.id;
  try {
    const product = await Product.findByIdAndUpdate(productId, {
      status: "blocked",
    });
    if (product) {
      res.json({ success: true, message: "Product blocked successfully" });
    } else {
      res.json({ success: false, message: "Product not found" });
    }
  } catch (error) {
    console.error("Error blocking product:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to block product" });
  }
};

const unblockProduct = async (req, res) => {
  const productId = req.params.id;
  try {
    const product = await Product.findByIdAndUpdate(productId, {
      status: "active",
    });
    if (product) {
      res.json({ success: true, message: "Product unblocked successfully" });
    } else {
      res.json({ success: false, message: "Product not found" });
    }
  } catch (error) {
    console.error("Error unblocking product:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to unblock product" });
  }
};

module.exports = {
  productInfo,
  showAddProductPage,
  addProduct,
  showEditProductPage,
  editProduct,
  showProductDetailPage,
  deleteProduct,
  blockProduct,
  unblockProduct,
};
