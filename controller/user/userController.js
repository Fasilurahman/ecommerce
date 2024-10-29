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

    // Fetch all brands and products
    const brands = await Brand.find({});
    const products = await Product.find({ status: "active" }) // Filter only active products
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
          brands, // Pass brands to the frontend
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

// Assuming you have the necessary imports at the top

const getProductsByBrand = async (req, res) => {
  try {
    const brandId = req.params.brandId;
    const sortOption = req.query.sortby || "popularity"; // Default sorting
    const page = parseInt(req.query.page) || 1; // Default page
    const limit = parseInt(req.query.limit) || 6; // Default limit
    const searchQuery = req.query.q || ""; // Capture search query

    let sortCriteria;

    // Define sorting criteria based on the sortOption
    switch (sortOption) {
      case "price":
        sortCriteria = { price: 1 }; // Ascending price
        break;
      case "popularity":
        sortCriteria = { popularity: -1 }; // Descending popularity
        break;
      // Add more cases for other sort options if needed
      default:
        sortCriteria = { popularity: -1 }; // Default to popularity
    }

    // Fetch the brand
    const brand = await Brand.findById(brandId);
    const brands = await Brand.find({});

    if (!brand) {
      return res.status(404).render("brand-products", {
        brand: null,
        products: [],
        message: "Brand not found",
      });
    }

    // Initialize filter criteria
    let filterCriteria = { brand: new ObjectId(brandId) };

    // Search filtering
    if (searchQuery) {
      filterCriteria.name = { $regex: new RegExp(searchQuery, "i") };
    }

    // Category filtering (if needed, based on the original loadShop logic)
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

    // Size filtering (if needed, based on the original loadShop logic)
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

const loadSignup = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.render("signup");
    }
    return res.redirect("/");
  } catch (error) {
    console.log("Signup page is not found");
    res.status(500).send("Server error");
  }
};

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });
    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Verify your account",
      html: `<b>Your OTP: ${otp}</b>`,
    });
    return info.accepted.length > 0;
  } catch (error) {
    console.error("Error in sending email", error);
    return false;
  }
}

// Signup function
const signup = async (req, res) => {
  const { username, phone, email, password } = req.body;
  try {
    const findUser = await User.findOne({ email });
    if (findUser) {
      return res.render("signup", {
        message: "User already exists with the same email",
      });
    }
    let otp = generateOtp();

    const sentEmail = await sendVerificationEmail(email, otp);

    if (!sentEmail) {
      return res.json("email-error");
    }

    req.session.userOtp = otp;
    req.session.userData = { username, phone, email, password };
    req.session.userEmail = email;

    res.redirect("otp");
    console.log("OTP is: ", otp);
  } catch (error) {
    console.log("Error in signup", error);
    res.redirect("/pageNotfoundServer");
  }
};

const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) {}
};

const loadotpPage = async (req, res) => {
  try {
    if (!req.session.user) {
      res.render("otp");
    } else {
      res.redirect("/");
    }
  } catch (error) {
    console.error("Error loading OTP page", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};



const generateReferralCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

const otpPage = async (req, res) => {
  try {
    const { otp } = req.body;
    console.log("sd", req.session.userOtp);
    console.log("sddsd", otp);

    if (otp === req.session.userOtp) {
      const user = req.session.userData;
      const passwordHash = await securePassword(user.password);
      const referralCode = generateReferralCode();
      const saveUserData = new User({
        username: user.username,
        email: user.email,
        phone: user.phone,
        password: passwordHash,
        referralCode,
      });

      await saveUserData.save();

      res
        .status(200)
        .json({ success: true, message: "Success", redirectUrl: "/login" });
    } else {
      res
        .status(400)
        .json({ success: false, message: "Invalid OTP, Please try again" });
    }
  } catch (error) {
    console.error("Error Verifying OTP", error);
    res.status(500).json({ success: false, message: "An error occurred" });
  }
};

const loadUserProfile = async (req, res) => {
  try {
      const user = await User.findOne({ _id: req.cookies.user });
      if (!user) {
          return res.status(404).send('User not found');
      }
      res.render('userprofile', { user });
  } catch (error) {
      console.error('Error loading user profile:', error);
      res.status(500).send('Error loading user profile');
  }
};


const resendOtp = async (req, res) => {
  try {
    const { email } = req.session.userData;
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email not found in session" });
    }
    const otp = generateOtp();
    req.session.userOtp = otp;

    const emailSent = await sendVerificationEmail(email, otp);
    if (emailSent) {
      console.log("resend otp :", otp);
      res
        .status(200)
        .json({ success: true, message: "OTP resended successfully" });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to resend otp. Please try again",
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error, Please try again",
    });
  }
};

const loadLogin = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.render("login");
    } else {
      res.redirect("/");
    }
  } catch (error) {
    res.redirect("pageNotFount");
  }
};

const login = async (req, res) => {
  console.log(req.body);
  try {
    const { email, password, referralCode } = req.body;

    const findUser = await User.findOne({ email: email });

    if (!findUser) {
      return res.render("login", { message: "User not found" });
    }

    if (findUser.isBlocked) {
      return res.render("login", { message: "User is blocked by admin" });
    }

    const passwordMatch = await bcrypt.compare(password, findUser.password);

    if (!passwordMatch) {
      return res.render("login", { message: "Incorrect password" });
    }

    // Check for referral code
    if (referralCode) {
      // Prevent user from redeeming their own code
      if (referralCode === findUser.referralCode) {
        return res.render("login", {
          message: "You cannot redeem your own referral code",
        });
      }

      // Check if the referral code is valid and if it hasn't been redeemed already
      if (!findUser.redeemStatus) {
        const referrer = await User.findOne({ referralCode: referralCode });

        if (!referrer) {
          return res.render("login", { message: "Invalid referral code" });
        }

        // Update referrer's wallet
        await Wallet.updateOne(
          { userId: referrer._id },
          {
            $inc: { balance: 500 },
            $push: {
              transactions: {
                date: new Date(),
                type: "credit",
                amount: 500,
                description: "Referral reward",
              },
            },
          },
          { upsert: true }
        );

        await Wallet.updateOne(
          { userId: findUser._id },
          {
            $inc: { balance: 100 },
            $push: {
              transactions: {
                date: new Date(),
                type: "credit",
                amount: 100,
                description: "Referral reward",
              },
            },
          },
          { upsert: true }
        );

        // Set redeemStatus to true and add referred user ID to referrer's referredUsers
        await User.findByIdAndUpdate(findUser._id, {
          redeemStatus: true,
          isReferred: true,
        });
        await User.findByIdAndUpdate(referrer._id, {
          $push: { referredUsers: findUser._id },
        });
      } else {
        return res.render("login", {
          message: "Referral code can only be used once",
        });
      }
    }

    // For admin login
    if (findUser.isAdmin) {
      req.session.admin = true;
      return res.redirect("/admin/dashboard");
    } else {
      req.session.user = findUser._id;
      req.session.username = findUser.username;

      res.cookie("user", req.session.user, { httpOnly: true, secure: true });
      res.redirect("/");
    }
  } catch (error) {
    console.log("login error", error);
    res.render("login", { message: "Login failed, please try again" });
  }
};

const logout = async (req, res) => {
  try {
    console.log("logout");

    req.session.destroy((err) => {
      if (err) {
        console.log("Session destruction error:", err.message);
        return res.redirect("/pageNotFound");
      }

      res.clearCookie("user");

      return res.redirect("/login");
    });
  } catch (error) {
    console.log("Logout error:", error);
    res.redirect("/pageNotFound");
  }
};

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Reset your password",
      html: `<b>Your OTP for password reset: ${otp}</b>`,
    });

    return true;
  } catch (error) {
    console.error("Error in sending email", error);
    return false;
  }
}

const loadForgotPassword = (req, res) => {
  const error = req.session.forgotPasswordError || null;
  req.session.forgotPasswordError = null; // Clear the error after displaying it
  res.render("forgotpassword", { error });
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      // Set error message in session and redirect back to the form
      req.session.forgotPasswordError = "User not found";
      return res.redirect("/forgotpassword");
    }

    const otp = generateOtp();
    req.session.forgotOtp = otp;
    req.session.userEmail = email;

    const emailSent = await sendVerificationEmail(email, otp);
    console.log("Enter your OTP:", otp);

    if (!emailSent) return res.status(500).send("Failed to send OTP email");

    res.render("forgototp"); // Render OTP page
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Server error");
  }
};

const verifyForgotOtp = (req, res) => {
  const { otp } = req.body;
  if (otp === req.session.forgotOtp) {
    return res.json({
      success: true,
      redirectUrl: "/resetpassword?email=" + req.session.userEmail,
    });
  }
  res.status(400).json({ success: false, message: "Invalid OTP" });
};

const resendForgotOtp = async (req, res) => {
  try {
    const email = req.session.userEmail;
    if (!email)
      return res
        .status(400)
        .json({ success: false, message: "Session expired" });

    const otp = generateOtp();
    req.session.forgotOtp = otp;
    const emailSent = await sendVerificationEmail(email, otp);
    console.log(otp);

    if (emailSent) {
      return res
        .status(200)
        .json({ success: true, message: "OTP resent successfully" });
    }
    res.status(500).json({ success: false, message: "Failed to resend OTP" });
  } catch (error) {
    console.error("Error resending OTP:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).send("User not found");

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    req.session.forgotOtp = undefined;
    req.session.userEmail = undefined;

    res.redirect("/login");
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).send("Server error");
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
        brands // Pass as a number
      });
    }

    // Filter out items with null productId
    cart.items = cart.items.filter(
      (item) => item.productId !== null && item.productId.status === "active"
    );

    // Check for out of stock items
    let hasOutOfStockItems = cart.items.some((item) => {
      return item.productId.variants.some((variant) => variant.stock <= 0);
    });

    // Calculate total discounted price
    let totalDiscountedPrice = 0;

    cart.items.forEach((item) => {
      let priceToUse = item.productId.price; // Base price

      // Apply discount if any offers are present
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

      // Calculate total for the item
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
      return res.redirect("/login");
    }

    const cart = await Cart.findOne({ userId: userId });

    if (!cart) {
      return res.status(404).send("Cart not found");
    }

    cart.items = cart.items.filter((item) => item._id.toString() !== itemId);

    await cart.save();

    res.redirect("/cart");
  } catch (error) {
    console.error("Error removing item from cart:", error);
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

    // Return the updated item with the new total price
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

    // Fetch the cart and populate product details
    let cart = await Cart.findOne({ userId: user._id }).populate({
      path: "items.productId",
      populate: {
        path: "offers",
        model: "Offer",
      },
    });

    // Check if the cart exists and has items, otherwise redirect to cart page
    if (!cart || cart.items.length === 0) {
      return res.redirect("/cart");
    }

    // Filter out inactive or deleted products
    cart.items = cart.items.filter(
      (item) => item.productId !== null && item.productId.status === "active"
    );

    // Check if the cart has any active items left, otherwise redirect to cart page
    if (cart.items.length === 0) {
      return res.redirect("/cart");
    }

    // Calculate total price
    cart.totalPrice = cart.items.reduce((total, item) => {
      const product = item.productId;
      let itemTotalPrice = item.variantId
        ? product.variants.id(item.variantId).price * item.quantity
        : product.price * item.quantity;

      // Check if the product has valid offers
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

    // If a coupon is already applied, do not show available coupons
    let coupons = [];
    let discount = 0;

    if (!cart.appliedCoupon) {
      // If no coupon applied, fetch active coupons
      coupons = await Coupon.find({ isActive: true });

      // Filter out coupons that the user has already used
      coupons = coupons.filter(
        (coupon) => !coupon.userId.includes(user._id.toString())
      );
    } else {
      // Calculate discount from the applied coupon
      const appliedCoupon = await Coupon.findOne({ code: cart.appliedCoupon });
      if (appliedCoupon) {
        discount = (cart.totalPrice * appliedCoupon.discountValue) / 100;
      }
    }

    const finalPrice = cart.totalPrice - discount;

    // Render checkout page with necessary data
    res.render("checkout", {
      cart,
      user,
      userId: user._id,
      addresses: await Address.find({ userId: user._id }),
      selectedAddressId: null,
      coupons, // Only show if no coupon is applied and not used by the user
      finalPrice, // Pass the final price to the view
    });
  } catch (error) {
    console.error("Error loading checkout page:", error);
    res.status(500).send("Server error");
  }
};

const editAddress = async (req, res) => {
  const { addressId, name, phone, state, city, landMark, pincode } = req.body;
  try {
    const updatedAddress = await Address.findByIdAndUpdate(
      addressId,
      {
        "address.name": name,
        "address.phone": phone,
        "address.state": state,
        "address.city": city,
        "address.landMark": landMark,
        "address.pincode": pincode,
      },
      { new: true }
    );

    if (!updatedAddress) {
      return res.status(404).send("Address not found");
    }

    res.json({ message: "Address updated successfully", updatedAddress });
  } catch (error) {
    console.error("Error updating address:", error);
    res.status(500).send("Server error");
  }
};

// Delete an address
const deleteAddress = async (req, res) => {
  const { id } = req.params;
  try {
    const deletedAddress = await Address.findByIdAndDelete(id);

    if (!deletedAddress) {
      return res.status(404).send("Address not found");
    }

    res.json({ message: "Address deleted successfully" });
  } catch (error) {
    console.error("Error deleting address:", error);
    res.status(500).send("Server error");
  }
};

const getOrderPage = async (req, res) => {
  const userId =
    req.session.user && req.session.user._id
      ? req.session.user._id
      : req.session.user;

  if (!userId) {
    return res
      .status(400)
      .json({ error: "User not logged in or session expired" });
  }

  try {
    const orders = await Order.find({ userId }).populate(
      "ordereditems.productId"
    );

    res.status(200).json({ orders });
  } catch (err) {
    console.error("Error fetching orders:", err);
    res.status(500).json({ error: "Error fetching orders" });
  }
};

// controllers/OrderController.js
// const returnOrder = async (req, res) => {
//   const userId = req.cookies.user;
//   const orderId = req.params.orderId;

//   if (!userId) {
//     return res
//       .status(400)
//       .json({ error: "User not logged in or session expired" });
//   }

//   try {
//     // Find the order by ID
//     const order = await Order.findById(orderId);

//     // Check if the order exists and belongs to the user
//     if (!order || order.userId.toString() !== userId.toString()) {
//       return res
//         .status(404)
//         .json({ error: "Order not found or does not belong to user" });
//     }

//     // Check if the order has already been returned
//     if (order.status === "Returned") {
//       return res.status(400).json({ error: "Order has already been returned" });
//     }

//     // Update the order status to "Returned"
//     order.status = "Returned";
//     await order.save();

//     // Increase the stock for each item in the order
//     for (const item of order.ordereditems) {
//       const product = await Product.findById(item.productId);

//       if (product) {
//         if (item.variantId) {
//           const variant = product.variants.id(item.variantId);

//           if (variant) {
//             variant.stock += item.quantity; // Increase variant stock
//             await product.save();
//           } else {
//             console.error(
//               `Variant with ID ${item.variantId} not found in product ${product._id}`
//             );
//           }
//         } else {
//           product.stock += item.quantity; // Increase product stock if no variant
//           await product.save();
//         }
//       }
//     }

//     // Process refund to the user's wallet
//     const wallet = await Wallet.findOne({ userId: order.userId });
//     if (wallet) {
//       const refundAmount = order.finalPrice; // Amount to refund

//       // Increase the wallet balance
//       wallet.balance += refundAmount;

//       // Record the transaction
//       wallet.transactions.push({
//         amount: refundAmount,
//         type: "credit",
//         description: `Refund for returned order ${order._id}`,
//         orderId: order._id,
//         date: new Date(),
//       });

//       await wallet.save();
//     }

//     res.redirect("/orders");
//   } catch (err) {
//     console.error("Error processing return:", err);
//     res.status(500).json({ error: "Error processing return" });
//   }
// };

const loadShop = async (req, res) => {
  const sortOption = req.query.sortby || "popularity";
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 6;
  const searchQuery = req.query.q || "";

  let sortCriteria;
  switch (sortOption) {
    case "priceAsc":
      sortCriteria = { price: 1 };
      break;
    case "priceDesc":
      sortCriteria = { price: -1 };
      break;
    case "averageRating":
      sortCriteria = { averageRating: -1 };
      break;
    case "featured":
      sortCriteria = { featured: -1 };
      break;
    case "newArrivals":
      sortCriteria = { createdAt: -1 };
      break;
    case "aToZ":
      sortCriteria = { name: 1 };
      break;
    case "zToA":
      sortCriteria = { name: -1 };
      break;
    default:
      sortCriteria = { popularity: -1 };
      break;
  }

  // Capture categories and sizes from query
  let selectedCategories = req.query.categories || [];
  let selectedSizes = req.query.sizes || [];
  if (!Array.isArray(selectedCategories))
    selectedCategories = [selectedCategories];
  if (!Array.isArray(selectedSizes)) selectedSizes = [selectedSizes];

  // Initialize filter criteria
  let filterCriteria = { status: "active" };

  // Search filtering
  if (searchQuery) {
    filterCriteria.name = { $regex: new RegExp(searchQuery, "i") };
  }

  try {
    console.log("Selected Categories:", selectedCategories); // Debugging

    // Category filtering
    if (selectedCategories.length > 0) {
      const categories = await Category.find({
        $or: [
          {
            _id: {
              $in: selectedCategories.filter((id) =>
                id.match(/^[0-9a-fA-F]{24}$/)
              ),
            },
          },
          {
            name: {
              $in: selectedCategories.map((cat) => new RegExp(`^${cat}$`, "i")),
            },
          },
        ],
        isBlocked: false,
      });

      console.log("Matched Categories from DB:", categories); // Debugging

      const categoryIds = categories.map((category) => category._id);
      if (categoryIds.length > 0) {
        filterCriteria.category = { $in: categoryIds };
      } else {
        console.warn("No categories found matching selected filters.");
      }
    }

    // Size filtering
    if (selectedSizes.length > 0) {
      filterCriteria.variants = {
        $elemMatch: {
          quantity: { $in: selectedSizes.map((size) => `${size} ml`) },
        },
      };
    }

    // Fetch brands for rendering
    const brands = await Brand.find({});

    // Fetch total products and products based on filter criteria
    const totalProducts = await Product.countDocuments(filterCriteria);
    const products = await Product.find(filterCriteria)
      .sort(sortCriteria)
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    const totalPages = Math.ceil(totalProducts / limit);

    // Render the shop view with products and filter data
    res.render("shop", {
      products,
      currentPage: page,
      totalPages,
      brands,
      sortOption,
      selectedSizes,
      selectedCategories,
      searchQuery,
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send("Server Error");
  }
};

module.exports = { loadShop };

const Razorpay = require("razorpay");

const razorpayInstance = new Razorpay({
  key_id: process.env.YOUR_RAZORPAY_KEY_ID, // Your Razorpay Key ID
  key_secret: process.env.RAZORPAY_KEY_SECRET, // Your Razorpay Secret Key
});

const placeOrder = async (req, res) => {
  const {
    selectedAddressId,
    paymentMethod,
    couponCode,
    finalPrice,
    discount,
    totalAmount,
  } = req.body;

  if (!finalPrice) {
    return res
      .status(400)
      .json({ success: false, message: "Final price is required" });
  }

  if (!selectedAddressId) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid address selected." });
  }

  try {
    const user = await User.findOne({ _id: req.session.user });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    const addressDoc = await Address.findById(selectedAddressId);
    if (!addressDoc || !addressDoc.address || addressDoc.address.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Selected address not found." });
    }

    const address = addressDoc.address[0];
    const cart = await Cart.findOne({ userId: user._id });

    const orderItems = cart.items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId, // Assuming variantId is stored in the cart
      quantity: item.quantity,
      price: item.price,
    }));

    if (paymentMethod === "cod" && finalPrice < 1000) {
      return res.status(400).json({
        success: false,
        message: "Cash on delivery is not allowed for orders below ₹1000.",
      });
    }

    // Loop through each ordered item to update stock of the specific product variant
    for (let item of orderItems) {
      const product = await Product.findById(item.productId);

      // Check if product exists and is active
      if (!product || product.status !== "active") {
        return res.status(404).json({
          success: false,
          message: `Product with ID ${item.productId} not found or is blocked.`,
        });
      }

      // Retrieve the variant based on the variantId
      const variant = product.variants.id(item.variantId);

      // Check if the variant exists
      if (!variant) {
        return res.status(404).json({
          success: false,
          message: `Variant with ID ${item.variantId} not found in product ${item.productId}.`,
        });
      }

      // Check if the stock exists or is zero
      if (variant.stock === 0) {
        return res.status(400).json({
          success: false,
          message: `No stock available for variant ${item.variantId}.`,
        });
      }

      // Check if the requested quantity can be fulfilled
      if (variant.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for variant ${item.variantId}. Requested: ${item.quantity}, Available: ${variant.stock}`,
        });
      }

      // Decrease the stock
      // variant.stock -= item.quantity;

      await product.save(); // Save the updated product with decreased variant stock
    }

    let razorpayOrderId = null;

    // Handle wallet payment method
    if (paymentMethod === "wallet") {
      let wallet = await Wallet.findOne({ userId: user._id });

      // If wallet does not exist, create a new one
      if (!wallet) {
        wallet = new Wallet({
          userId: user._id,
          balance: 0, // Initialize with 0 balance
          transactions: [],
        });
        await wallet.save(); // Save the new wallet
      }

      // Check if wallet has enough balance
      if (wallet.balance < finalPrice) {
        return res
          .status(400)
          .json({ success: false, message: "Insufficient wallet balance." });
      }

      // Deduct the final price from the wallet balance
      wallet.balance -= finalPrice;

      // Record the transaction in the wallet
      wallet.transactions.push({
        type: "debit",
        amount: finalPrice,
        description: `Purchase of products for order ${new Date().getTime()}`,
        date: new Date(),
      });

      await wallet.save(); // Save the wallet with the updated balance and transaction
    }

    if (paymentMethod === "razorpay") {
      const options = {
        amount: finalPrice * 100, // Amount in paise
        currency: "INR",
        receipt: `receipt_order_${new Date().getTime()}`,
        payment_capture: 1, // Auto capture payment
      };

      try {
        const razorpayOrder = await razorpayInstance.orders.create(options);
        razorpayOrderId = razorpayOrder.id;

        const newOrder = new Order({
          userId: user._id,
          address: address,
          paymentMethod: paymentMethod,
          ordereditems: orderItems,
          totalPrice: totalAmount,
          finalPrice: finalPrice,
          discount: discount,
          razorpayOrderId,
          paymentStatus: "pending", // Razorpay payment pending
          status: "Pending",
        });
        console.log(
          razorpayOrder,
          finalPrice,
          " razorpay order id and final price"
        );

        await newOrder.save();

        cart.items = [];
        cart.totalPrice = 0;
        await cart.save();

        return res.json({
          status: true,
          data: {
            razorpayOrder,
            finalPrice,
          },
        });
      } catch (err) {
        console.error("Error creating Razorpay order:", err);
        return res.status(500).json({
          success: false,
          message: "Failed to create Razorpay order.",
        });
      }
    }

    // Save the order for wallet or other payment methods
    const newOrder = new Order({
      userId: user._id,
      address: address,
      paymentMethod: paymentMethod,
      couponCode,
      ordereditems: orderItems,
      totalPrice: totalAmount,
      finalPrice: finalPrice,
      discount: discount,
      razorpayOrderId,
      paymentStatus: paymentMethod === "wallet" ? "success" : "pending",
      status: "Processing",
    });

    const order = await newOrder.save();

    // Clear the cart after order is placed
    cart.items = [];
    cart.totalPrice = 0;
    await cart.save();

    // Add order transaction to user's transaction history
    if (!user.transactions) {
      user.transactions = [];
    }

    user.transactions.push({
      type: "debit",
      amount: finalPrice,
      description: `Amount debited for purchasing product ${order._id}`,
    });

    await user.save();

    return res.json({
      success: true,
      orderId: order._id,
      razorpayOrderId,
      message: "Order placed successfully!",
    });
  } catch (error) {
    console.error("Error placing order:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to place order." });
  }
};

// controllers/userController.js
const repayment_razorpayPOST = async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Calculate the total amount excluding canceled items
    const validItemsTotal = order.ordereditems  // Adjusted to match the database field name
      .filter(item => !item.isCancelled)  // Using isCancelled instead of status
      .reduce((total, item) => total + item.price * item.quantity, 0);

    const amount = validItemsTotal * 100; // Convert to smallest currency unit (e.g., paise)
    const currency = "INR";
    const payment_capture = 1;

    const options = {
      amount,
      currency,
      receipt: `receipt_${orderId}`,
      payment_capture,
    };

    const response = await razorpayInstance.orders.create(options);

    res.status(200).json({
      success: true,
      orderId: response.id,
      amount: response.amount,
      currency: response.currency,
      key: process.env.YOUR_RAZORPAY_KEY_ID,
      name: "Trovup",
      description: "Repayment for Order",
      orderReceipt: orderId,
    });
  } catch (error) {
    console.error("Error:", error.response ? error.response : error);
    res.status(500).json({ success: false, message: "Server error occurred" });
  }
};



const verifyRepaymentPOST = async (req, res) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      orderId,
    } = req.body;
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature === razorpay_signature) {
      const order = await Order.findById(orderId);

      if (!order) {
        return res
          .status(404)
          .json({ success: false, message: "Order not found" });
      }

      // Update payment status to 'paid'
      order.paymentStatus = "paid";
      order.razorpayOrderId = razorpay_order_id;

      // Decrease the stock of each ordered variant
      for (const item of order.ordereditems) {
        const product = await Product.findById(item.productId);

        if (!product) {
          return res.status(404).json({
            success: false,
            message: `Product with ID ${item.productId} not found.`,
          });
        }

        const variant = product.variants.id(item.variantId);

        if (!variant) {
          return res.status(404).json({
            success: false,
            message: `Variant with ID ${item.variantId} not found in product ${item.productId}.`,
          });
        }

        // Check stock and decrease if sufficient stock exists
        if (variant.stock >= item.quantity) {
          variant.stock -= item.quantity;
        } else {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for variant ${item.variantId}.`,
          });
        }

        await product.save();
      }

      await order.save();

      res.status(200).json({
        success: true,
        message: "Payment successful and stock updated",
      });
    } else {
      res.status(400).json({ success: false, message: "Invalid signature" });
    }
  } catch (error) {
    console.error("Error verifying payment and updating stock:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const paymentFailed = async (req, res) => {
  const { razorpay_order_id } = req.query;

  try {
    // Find the order and update payment status to failed
    const order = await Order.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id },
      { paymentStatus: "Failed" },
      { new: true }
    );

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    // Redirect or respond with failure message
    res.redirect("/payment-failure"); // Change this to your payment failure page URL
  } catch (error) {
    console.error("Error updating payment status:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const readData = () => {
  if (fs.existsSync("orders.json")) {
    const data = fs.readFileSync("orders.json");
    return JSON.parse(data);
  }
  return [];
};

// Function to write data to JSON file
const writeData = (data) => {
  fs.writeFileSync("orders.json", JSON.stringify(data, null, 2));
};

// Initialize orders.json if it doesn't exist
if (!fs.existsSync("orders.json")) {
  writeData([]);
}

const razorpay = new Razorpay({
  key_id: "YOUR_RAZORPAY_KEY", // Replace with your Razorpay key
  key_secret: "YOUR_RAZORPAY_SECRET", // Replace with your Razorpay secret
});

const createOrder = async (req, res) => {
  const { userId, totalPrice, finalPrice, ordereditems, addressId } = req.body;

  try {
    // Create a new order entry in the database
    const newOrder = await Order.create({
      userId,
      totalPrice,
      finalPrice,
      orderedItems: ordereditems,
      addressId,
      paymentStatus: "Pending", // Initially set payment status to pending
    });

    // Create an order in Razorpay
    const razorpayOrder = await razorpay.orders.create({
      amount: finalPrice * 100, // Amount in paise
      currency: "INR",
      receipt: newOrder._id.toString(),
      payment_capture: 1, // Auto-capture the payment
    });

    if (!razorpayOrder) {
      return res
        .status(500)
        .json({ success: false, message: "Failed to create Razorpay order" });
    }

    // Respond with custom data
    res.json({
      success: true,
      order: {
        orderId: newOrder._id, // Your custom order ID
        razorpayOrderId: razorpayOrder.id, // Razorpay order ID
        totalAmount: finalPrice, // Amount in INR (formatted as needed)
        paymentStatus: "Pending", // Initial payment status
      },
    });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const paymentSuccess = async (req, res) => {
  const orderId = req.params.id;
  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).render("error", { message: "Order not found" });
    }

    // Log applied coupon code
    console.log("Applied Coupon:", req.session.appliedCoupon);
    console.log("Session Contents:", req.session);

    if (req.session.appliedCoupon) {
      const couponCode = req.session.appliedCoupon.toLowerCase();
      console.log("Querying with coupon code:", couponCode); // Log coupon code being queried

      const coupon = await Coupon.findOne({ code: couponCode, isActive: true });
      console.log("Retrieved Coupon:", coupon); // Log the retrieved coupon

      if (coupon) {
        const userId = req.cookies.user;
        const mongooseUserId = new mongoose.Types.ObjectId(userId);

        // Check if userId is valid and coupon.userId is an array
        if (Array.isArray(coupon.userId)) {
          coupon.userId.push(mongooseUserId);
          await coupon.save();
          console.log("Coupon updated:", coupon);
        } else {
          console.error("coupon.userId is not an array");
        }

        // Set couponApplied to true in the order
        order.couponApplied = true;
      } else {
        console.error("Coupon not found or inactive");
      }

      // Clear applied coupon from the session
      delete req.session.appliedCoupon;
    }

    // Save the updated order with couponApplied status
    await order.save();

    // Render the order success page or send a success response
    res.render("orderSuccess", { order });
  } catch (error) {
    console.error("Error processing payment success:", error);
    res.status(500).render("error", { message: "Internal Server Error" });
  }
};

// controllers/userController.js
const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });
    if (!order || order.paymentMethod !== "razorpay") {
      // const orderID = order._id;
      const response = "/orders";
      return res.status(400).json({
        success: false,
        message: "Invalid order or payment method.",
        response,
      });
    }

    const orderID = order._id;

    const isVerified = verifySignature({
      order_id: razorpay_order_id,
      payment_id: razorpay_payment_id,
      signature: razorpay_signature,
    });
    console.log(isVerified, " is verified");

    if (isVerified) {
      order.paymentStatus = "success";
      await order.save();
      return res.status(200).json({ success: true, orderID });
    } else {
      order.paymentStatus = "failed";
      await order.save();
      return res.status(400).json({
        success: false,
        message: "Payment verification failed.",
        orderID,
      });
    }
  } catch (error) {
    console.error("Payment verification error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error." });
  }
};

const verifySignature = ({ order_id, payment_id, signature }) => {
  const generatedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${order_id}|${payment_id}`)
    .digest("hex");
  return generatedSignature === signature;
};

const applyCoupon = async (req, res) => {
  const { couponCode, totalAmount } = req.body;
  const userId = req.cookies.user;

  try {
    const totalAmountNum = Number(totalAmount);

    // Log the initial session contents
    console.log("Session Before Applying Coupon:", req.session);

    // Check if a coupon has already been applied to this order
    if (req.session.appliedCoupon) {
      return res.json({
        success: false,
        message: "A coupon has already been applied to this order.",
      });
    }

    // Log the coupon code to be applied
    console.log("Coupon Code to be Applied:", couponCode);

    // Find the coupon by code
    const coupon = await Coupon.findOne({
      code: couponCode.trim(), // Ensure no extra spaces
      isActive: true,
    });

    if (!coupon) {
      return res.json({
        success: false,
        message: "Coupon does not exist or is inactive",
      });
    }

    // Check if the coupon has expired
    const currentDate = new Date();
    const expiryDate = new Date(coupon.expiryDate);
    if (expiryDate < currentDate) {
      return res.json({ success: false, message: "Coupon has expired" });
    }

    const mongooseUserId = new mongoose.Types.ObjectId(userId);
    const hasUserIdArray =
      Array.isArray(coupon.userId) && coupon.userId.length > 0;

    if (hasUserIdArray) {
      const hasUsedCoupon = coupon.userId.some((id) =>
        id.equals(mongooseUserId)
      );
      if (hasUsedCoupon) {
        return res.json({
          success: false,
          message: "Coupon has already been used by you",
        });
      }
    }

    if (totalAmountNum < coupon.minOrderAmount) {
      return res.json({
        success: false,
        message: `Order total must be at least ₹${coupon.minOrderAmount}`,
      });
    }

    if (totalAmountNum > coupon.maxOrderAmount) {
      return res.json({
        success: false,
        message: `Order total cannot exceed ₹${coupon.maxOrderAmount}`,
      });
    }

    let discountAmount = 0;
    if (coupon.discountType === "percentage") {
      discountAmount = totalAmountNum * (coupon.discountValue / 100);
    } else if (coupon.discountType === "fixed") {
      discountAmount = coupon.discountValue;
    }

    discountAmount = Math.min(discountAmount, totalAmountNum);
    const newTotal = totalAmountNum - discountAmount;

    // Store the applied coupon in the session, trimmed
    req.session.appliedCoupon = couponCode.trim();
    console.log("Applied Coupon Stored in Session:", req.session.appliedCoupon); // Log the stored coupon

    res.json({ success: true, discountAmount, newTotal });
  } catch (error) {
    console.error("Error applying coupon:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  loadHomePage,
  getProductsByBrand,
  loadSignup,
  loadShopping,
  loadLogin,
  signup,
  loadotpPage,
  login,
  loadForgotPassword,
  forgotPassword,
  verifyForgotOtp,
  resendForgotOtp,
  resetPassword,
  logout,
  otpPage,
  resendOtp,
  pageNotFount,
  loadCart,
  addToCart,
  removeFromCart,
  updateQuantity,
  loadShop,
  loadCheckout,
  editAddress,
  deleteAddress,
  placeOrder,
  getOrderPage,
  // returnOrder,
  createOrder,
  applyCoupon,
  paymentSuccess,
  verifyPayment,
  repayment_razorpayPOST,
  verifyRepaymentPOST,
  paymentFailed,
  loadBlog,
  loadUserProfile,
  generateReferralCode
};
