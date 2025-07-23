const User = require("../../models/userSchema");
const env = require("dotenv").config();
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const Product = require("../../models/productSchema");
const Brand = require("../../models/brandSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const Cart = require("../../models/cartSchema");
const Wallet = require("../../models/walletSchema");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const Category = require("../../models/categorySchema");
const Coupon = require("../../models/couponSchema");
const path = require("path");
const fs = require("fs");
const {
  validateWebhookSignature,
} = require("razorpay/dist/utils/razorpay-utils");


const pageNotFount = async (req, res) => {
  try {
    res.render("page-404");
  } catch (error) {
    res.render("/pageNotFound");
  }
};

const loadHomePage = async (req, res) => {
  try {
    const userId = req.cookies.user;

    const brands = await Brand.find({});
    const products = await Product.find({ status: "active" })
      .populate("brand")
      .populate("category")
      .populate("offers");

    if (userId) {
      const userData = await User.findOne({ _id: userId });

      if (userData?.isBlocked) {
        console.log("User is blocked, redirecting to login");
        req.session.destroy();
        return res.redirect("/login");
      }

      if (!userData) {
        console.log("User not found in the database");
        return res.render("home", {
          message: "User not found",
          user: null,
          products,
          brands,
        });
      }

      return res.render("home", { user: userData.username, products, brands });
    } else {
      console.log("User not logged in");
      return res.render("home", { user: null, products, brands });
    }
  } catch (error) {
    console.log("Home page error:", error);
    res.status(500).send("Server error");
  }
};

const loadBlog = async (req, res) => {
  try {
    const brands = await Brand.find({});
    res.render("blog", { brands });
  } catch (error) {
    console.log("error", error);
  }
};

const getProductsByBrand = async (req, res) => {
  try {
    const brandId = req.params.brandId;
    const sortOption = req.query.sortby || "popularity";
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;
    const searchQuery = req.query.q || "";

    let sortCriteria;

    switch (sortOption) {
      case "price":
        sortCriteria = { price: 1 };
        break;
      case "popularity":
        sortCriteria = { popularity: -1 };
        break;
      default:
        sortCriteria = { popularity: -1 };
    }

    const brand = await Brand.findById(brandId);
    const brands = await Brand.find({});

    if (!brand) {
      return res.status(404).render("brand-products", {
        brand: null,
        products: [],
        message: "Brand not found",
      });
    }

    let filterCriteria = { brand: new ObjectId(brandId) };

    if (searchQuery) {
      filterCriteria.name = { $regex: new RegExp(searchQuery, "i") };
    }

    let selectedCategories = req.query.categories || [];
    if (!Array.isArray(selectedCategories)) {
      selectedCategories = [selectedCategories];
    }

    if (selectedCategories.length > 0) {
      const categories = await Category.find({
        name: { $regex: new RegExp(selectedCategories.join("|"), "i") },
      });
      const categoryIds = categories.map((category) => category._id);
      if (categoryIds.length > 0)
        filterCriteria.category = { $in: categoryIds };
    }

    let selectedSizes = req.query.sizes || [];
    if (!Array.isArray(selectedSizes)) {
      selectedSizes = [selectedSizes];
    }

    if (selectedSizes.length > 0) {
      filterCriteria.variants = {
        $elemMatch: {
          quantity: { $in: selectedSizes.map((size) => `${size} ml`) },
        },
      };
    }

    const totalProducts = await Product.countDocuments(filterCriteria);
    const products = await Product.find(filterCriteria)
      .sort(sortCriteria)
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    const totalPages = Math.ceil(totalProducts / limit);

    return res.render("brand-products", {
      brand: brand.brandName,
      products,
      brands,
      currentPage: page,
      totalPages,
      sortOption,
      selectedSizes,
      selectedCategories,
      searchQuery,
    });
  } catch (error) {
    console.error("Error fetching products for brand:", error);
    return res.status(500).send("Server error");
  }
};



const loadShopping = async (req, res) => {
  try {
    return res.render("shopping");
  } catch (error) {
    console.log("shopping page is not found");
    res.status(500).send("server error");
  }
};

const addToCart = async (req, res) => {
  try {
    const productId = req.params.productId || req.body.productId;
    const variantId = req.query.variant || req.body.variantId;
    const userId = req.session.user;

    if (!userId) {
      return res.status(401).json({ message: "Please login first" });
    }

    const product = await Product.findById(productId).populate("offers");

    if (!product || product.isDeleted) {
      return res.status(404).json({ message: "Product not found" });
    }
    const variant = product.variants.find(
      (v) => v._id.toString() === variantId
    );

    if (!product || !variant) {
      return res.status(404);
    }

    if (variant.stock <= 0) {
      return res.status(400).json({ message: "This product is out of stock" });
    }

    let cart = await Cart.findOne({ userId: userId });

    if (!cart) {
      cart = new Cart({ userId: userId, items: [] });
    }

    const cartItemIndex = cart.items.findIndex(
      (item) =>
        item.productId.toString() === productId &&
        item.variantId.toString() === variantId
    );

    if (cartItemIndex > -1) {
      cart.items[cartItemIndex].quantity += 1;

      const offer = product.offers[0];
      let itemTotalPrice;

      if (offer) {
        const discount = offer.discount || 0;
        const discountAmount = (variant.price * discount) / 100;
        const discountedPrice = variant.price - discountAmount;

        itemTotalPrice = discountedPrice * cart.items[cartItemIndex].quantity;
      } else {
        itemTotalPrice = variant.price * cart.items[cartItemIndex].quantity;
      }

      cart.items[cartItemIndex].totalPrice = itemTotalPrice;
    } else {
      const offer = product.offers[0];
      let totalPrice;

      if (offer) {
        const discount = offer.discount || 0;
        const discountAmount = (variant.price * discount) / 100;
        const discountedPrice = variant.price - discountAmount;

        totalPrice = discountedPrice;
      } else {
        totalPrice = variant.price;
      }

      cart.items.push({
        productId: productId,
        variantId: variantId,
        quantity: 1,
        price: variant.price,
        totalPrice: totalPrice,
      });
    }

    await cart.save();
    return res.status(200).json({ added: true });
  } catch (error) {
    console.error("Error adding product to cart:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const loadCart = async (req, res) => {
  try {
    const userId = req.session.user;

    if (!userId) {
      return res.redirect("/login");
    }

    const brands = await Brand.find({});

    const cart = await Cart.findOne({ userId: userId }).populate(
      "items.productId"
    );

    if (!cart) {
      console.log("No cart found for user:", userId);
      return res.render("cart", {
        cart: { items: [] },
        hasOutOfStockItems: false,
        totalDiscountedPrice: 0,
        brands, 
      });
    }

    cart.items = cart.items.filter(
      (item) => item.productId !== null && item.productId.status === "active"
    );

    let hasOutOfStockItems = cart.items.some((item) => {
      return item.productId.variants.some((variant) => variant.stock <= 0);
    });

    let totalDiscountedPrice = 0;

    cart.items.forEach((item) => {
      let priceToUse = item.productId.price; 

      if (item.productId.offers && item.productId.offers.length > 0) {
        const offer = item.productId.offers[0];
        const currentDate = new Date();
        if (
          currentDate >= offer.validFrom &&
          currentDate <= offer.validTo &&
          !offer.isBlocked
        ) {
          const discountPercentage = offer.discount;
          console.log(discountPercentage, "discount percentage");

          const discountAmount = (priceToUse * discountPercentage) / 100;
          priceToUse -= discountAmount;
        }
      }

      const itemTotal = item.quantity * priceToUse;
      totalDiscountedPrice += itemTotal;
    });

    res.render("cart", {
      cart,
      brands,
      hasOutOfStockItems,
      totalDiscountedPrice: totalDiscountedPrice, // Pass as a number
    });
  } catch (error) {
    console.error("Error loading cart:", error);
    res.status(500).send("Internal Server Error");
  }
};

const removeFromCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const itemId = req.params.itemId;

    if (!userId) {
      if (req.xhr || req.headers["x-requested-with"] === "XMLHttpRequest") {
        return res.status(401).json({ error: "Not logged in" });
      }
      return res.redirect("/login");
    }

    const cart = await Cart.findOne({ userId: userId });

    if (!cart) {
      if (req.xhr || req.headers["x-requested-with"] === "XMLHttpRequest") {
        return res.status(404).json({ error: "Cart not found" });
      }
      return res.status(404).send("Cart not found");
    }

    // Remove the item
    cart.items = cart.items.filter((item) => item._id.toString() !== itemId);
    await cart.save();

    // Recalculate subtotal and total
    const subtotal = cart.items.reduce((total, item) => total + item.totalPrice, 0);

    // You can apply your discount logic here if applicable
    const totalDiscountedPrice = subtotal; // Replace with actual discount logic if any

    if (req.xhr || req.headers["x-requested-with"] === "XMLHttpRequest") {
      return res.json({
        success: true,
        message: "Item removed",
        updatedCart: {
          subtotal: subtotal.toFixed(2),
          total: totalDiscountedPrice.toFixed(2),
          isEmpty: cart.items.length === 0
        }
      });
    }

    res.redirect("/cart");
  } catch (error) {
    console.error("Error removing item from cart:", error);

    if (req.xhr || req.headers["x-requested-with"] === "XMLHttpRequest") {
      return res.status(500).json({ error: "Internal Server Error" });
    }

    res.status(500).send("Internal Server Error");
  }
};


const updateQuantity = async (req, res) => {
  try {
    const userId = req.session.user;
    const itemId = req.params.itemId;
    const newQuantity = parseInt(req.body.newQuantity);

    if (isNaN(newQuantity) || newQuantity < 1) {
      return res.status(400).send("Invalid quantity.");
    }

    if (!userId) {
      return res.redirect("/login");
    }

    let cart = await Cart.findOne({ userId: userId }).populate(
      "items.productId"
    );

    if (!cart) {
      return res.status(404).send("Cart not found");
    }

    const cartItem = cart.items.id(itemId);

    if (!cartItem) {
      return res.status(404).send("Item not found in cart");
    }

    const product = await Product.findById(cartItem.productId).populate(
      "offers"
    );

    if (!product) {
      return res.status(404).send("Product not found");
    }

    let priceToUse = product.price;

    if (product.offers && product.offers.length > 0) {
      const offer = product.offers[0];
      const currentDate = new Date();
      if (
        currentDate >= offer.validFrom &&
        currentDate <= offer.validTo &&
        !offer.isBlocked
      ) {
        const discountPercentage = offer.discount;
        const discountAmount = (priceToUse * discountPercentage) / 100;
        priceToUse = priceToUse - discountAmount;
      }
    }

    if (newQuantity > product.stock) {
      return res.status(400).send("Quantity exceeds available stock");
    }

    cartItem.quantity = newQuantity;
    cartItem.price = priceToUse;
    cartItem.totalPrice = newQuantity * priceToUse;

    await cart.save();

    res.json({ totalPrice: cartItem.totalPrice });
  } catch (error) {
    console.error("Error updating cart quantity:", error);
    res.status(500).send("Internal Server Error");
  }
};

const loadCheckout = async (req, res) => {
  try {
    delete req.session.appliedCoupon;
    const user = req.user;

    let cart = await Cart.findOne({ userId: user._id }).populate({
      path: "items.productId",
      populate: {
        path: "offers",
        model: "Offer",
      },
    });

    if (!cart || cart.items.length === 0) {
      return res.redirect("/cart");
    }

    cart.items = cart.items.filter(
      (item) => item.productId !== null && item.productId.status === "active"
    );

    if (cart.items.length === 0) {
      return res.redirect("/cart");
    }

    cart.totalPrice = cart.items.reduce((total, item) => {
      const product = item.productId;
      let itemTotalPrice = item.variantId
        ? product.variants.id(item.variantId).price * item.quantity
        : product.price * item.quantity;

      if (product.offers && product.offers.length > 0) {
        const validOffer = product.offers.find((offer) => {
          const now = new Date();
          return (
            !offer.isBlocked && offer.validFrom <= now && offer.validTo >= now
          );
        });

        if (validOffer) {
          const discount = validOffer.discount || 0;
          const discountAmount =
            ((item.variantId
              ? product.variants.id(item.variantId).price
              : product.price) *
              discount) /
            100;
          const offerPrice =
            (item.variantId
              ? product.variants.id(item.variantId).price
              : product.price) - discountAmount;

          itemTotalPrice = offerPrice * item.quantity;
          item.offerPrice = offerPrice;
        }
      }

      item.totalPrice = itemTotalPrice;
      return total + itemTotalPrice;
    }, 0);

    let coupons = [];
    let discount = 0;

    if (!cart.appliedCoupon) {
      coupons = await Coupon.find({ isActive: true });

      coupons = coupons.filter(
        (coupon) => !coupon.userId.includes(user._id.toString())
      );
    } else {
      const appliedCoupon = await Coupon.findOne({ code: cart.appliedCoupon });
      if (appliedCoupon) {
        discount = (cart.totalPrice * appliedCoupon.discountValue) / 100;
      }
    }

    const finalPrice = cart.totalPrice - discount;

    res.render("checkout", {
      cart,
      user,
      userId: user._id,
      addresses: await Address.find({ userId: user._id }),
      selectedAddressId: null,
      coupons, 
      finalPrice,
    });
  } catch (error) {
    console.error("Error loading checkout page:", error);
    res.status(500).send("Server error");
  }
};

module.exports = {
  loadHomePage,
  getProductsByBrand,
  loadShopping,
  pageNotFount,
  loadCart,
  addToCart,
  removeFromCart,
  updateQuantity,
  loadCheckout,
  loadBlog,
};