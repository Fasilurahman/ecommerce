const User = require("../../models/userSchema");
const env = require("dotenv").config();
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const Cart = require("../../models/cartSchema");
const Wallet = require("../../models/walletSchema");
const mongoose = require("mongoose");
const Category = require("../../models/categorySchema");
const Coupon = require("../../models/couponSchema");
const Razorpay = require("razorpay");
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

    const products = await Product.find({})
      .populate("brand")
      .populate("category")
      .populate("offers");

    console.log("Cookie User ID:", userId);
    if (userId) {
      const userData = await User.findOne({ _id: userId });
      if (userData.isBlocked) {
        console.log("User is blocked, redirecting to login");
        return res.redirect("/login");
      }

      if (!userData) {
        console.log("User not found in the database");
        return res.render("home", {
          message: "User not found",
          user: null,
          products,
        });
      }

      return res.render("home", { user: userData.username, products });
    } else {
      console.log("User not logged in");
      return res.render("home", { user: null, products });
    }
  } catch (error) {
    console.log("Home page error:", error);
    res.status(500).send("Server error");
  }
};

const loadSignup = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.render("signup");
    }
    return res.render("signup");
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

const otpPage = async (req, res) => {
  try {
    const { otp } = req.body;

    if (otp === req.session.userOtp) {
      const user = req.session.userData;
      const passwordHash = await securePassword(user.password);

      const saveUserData = new User({
        username: user.username,
        email: user.email,
        phone: user.phone,
        password: passwordHash,
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
    const { email, password } = req.body;
    console.log(email, password);

    const findUser = await User.findOne({ email: email });

    if (!findUser) {
      return res.render("login", { message: "User is not Found" });
    }

    if (findUser.isBlocked) {
      return res.render("login", { message: "User is Blocked by admin" });
    }

    const passwordMatch = await bcrypt.compare(password, findUser.password);

    if (!passwordMatch) {
      return res.render("login", { message: "Incorrect password" });
    }
    if (findUser.isAdmin == true) {
      const passwordMatch = await bcrypt.compare(password, findUser.password);
      if (passwordMatch) {
        req.session.admin = true;
        return res.redirect("/admin");
      }
    } else {
      req.session.user = findUser._id;
      req.session.username = findUser.username;

      res.cookie("user", req.session.user, { httpOnly: true, secure: true });
      res.redirect("/");
    }
  } catch (error) {
    console.log("login error", error);
    res.render("login", { message: "Login failed, Please try again" });
  }
};

const logout = async (req, res) => {
  try {
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

// const forgotPassword = async (req,res)=>{
//   try {
//     const {email} = req.body;
//     const user = await User.findOne({email:email});
//     if(!user){
//       return res.status(400).send("user not found");
//     }
//     const token = crypto.randomBytes(32).toString('hex');
//     user.resetToken = token;
//     user.resetPasswordExpires = Date.now() + 3600000
//     await user.save();

//     const transporter = nodemailer.createTransport({
//       service: 'gmail',
//       auth: {
//         user: process.env.EMAIL,
//         pass: process.env.PASSWORD
//       }
//     });
//     const mailOptions = {
//       to : user.email,
//       from: process.env.EMAIL,
//       subject: 'Password Reset',
//       text: `You are receiving this email because you (or someone else) has requested a password reset for your account.\n\n
//       Please click on the following link, or paste it into your browser to complete the process:\n\n
//       http://${req.headers.host}/reset/${token}\n\n
//       If you did not request this, please ignore this email and your password will remain unchanged.\n`
//     }
//     await transporter.sendMail(mailOptions);
//     res.redirect('/forgotpassword');
//   } catch (error) {
//     console.error("Error in forgot password:", error);
//     res.status(500).send("Server error");
//   }
// }

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
  console.log("Entering addToCart function");

  try {
    const productId = req.params.productId || req.body.productId;
    const variantId = req.query.variant || req.body.variantId;
    const userId = req.session.user;

    console.log(
      `Product ID: ${productId}, Variant ID: ${variantId}, User ID: ${userId}`
    );

    // Check if the user is logged in
    if (!userId) {
      return res.status(401).json({ message: "Please login first" });
    }

    // Find the product and variant
    const product = await Product.findById(productId).populate("offers");
    const variant = product.variants.find(
      (v) => v._id.toString() === variantId
    );

    // If product or variant not found, return 404
    if (!product || !variant) {
      return res.status(404);
    }

    // If out of stock, return 400
    if (variant.stock <= 0) {
      return res.status(400).json({ message: "This product is out of stock" });
    }

    // Find or create the user's cart
    let cart = await Cart.findOne({ userId: userId });

    console.log("m");
    

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
    return res.status(200).json({added:true});
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

    const cart = await Cart.findOne({ userId: userId }).populate(
      "items.productId"
    );

    if (!cart) {
      console.log("No cart found for user:", userId);
      return res.render("cart", {
        cart: { items: [] },
        hasOutOfStockItems: false,
      });
    }

    // Filter out any items where productId is null (product might have been deleted)
    cart.items = cart.items.filter((item) => item.productId !== null);

    // Check for out-of-stock items (only for valid products)
    let hasOutOfStockItems = cart.items.some(
      (item) => item.productId.stock <= 0
    );

    res.render("cart", { cart, hasOutOfStockItems });
  } catch (error) {
    console.error("Error loading cart:", error);
    res.status(500).send("Internal Server Error");
  }
};

const removeFromCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const itemId = req.params.itemId;
    console.log(userId, itemId, "user id and item id");

    if (!userId) {
      return res.redirect("/login");
    }

    const cart = await Cart.findOne({ userId: userId });

    if (!cart) {
      return res.status(404).send("Cart not found");
    }

    cart.items = cart.items.filter((item) => item._id.toString() !== itemId);

    await cart.save();

    console.log("Item removed from cart:", itemId);
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
    console.log(newQuantity, "new quantity");

    if (isNaN(newQuantity) || newQuantity < 1) {
      return res.status(400).send("Invalid quantity.");
    }

    if (!userId) {
      return res.redirect("/login");
    }

    let cart = await Cart.findOne({ userId: userId }).populate(
      "items.productId"
    );
    console.log(cart, "cart");

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
    console.log(product, "product");

    if (!product) {
      return res.status(404).send("Product not found");
    }

    let priceToUse = product.price;
    console.log(priceToUse, "priceToUse");

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

    console.log(cartItem.quantity, "1");
    console.log(cartItem.price, "2");
    console.log(cartItem.totalPrice, "3");

    if (isNaN(cartItem.totalPrice)) {
      return res.status(400).send("Total price calculation failed.");
    }

    await cart.save();

    res.redirect("/cart");
  } catch (error) {
    console.error("Error updating cart quantity:", error);
    res.status(500).send("Internal Server Error");
  }
};

const loadCheckout = async (req, res) => {
  try {
    const user = req.user;

    const coupons = await Coupon.find({ isActive: true });

    // Fetch the cart and populate product details
    let cart = await Cart.findOne({ userId: user._id }).populate({
      path: "items.productId",
      populate: {
        path: "offers",
        model: "Offer",
      },
    });

    if (cart && cart.items.length > 0) {
      // Filter out items where productId is null (product might have been deleted)
      cart.items = cart.items.filter((item) => item.productId !== null);

      // Calculate total price
      cart.totalPrice = cart.items.reduce((total, item) => {
        const product = item.productId;
        let itemTotalPrice = product.price * item.quantity;

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
            const discountAmount = (product.price * discount) / 100;
            const offerPrice = product.price - discountAmount;

            itemTotalPrice = offerPrice * item.quantity;
            item.offerPrice = offerPrice;
          }
        }

        item.totalPrice = itemTotalPrice;
        return total + itemTotalPrice;
      }, 0);
    } else {
      if (!cart) {
        cart = {
          items: [],
          totalPrice: 0,
        };
      } else {
        cart.totalPrice = 0;
      }
    }

    const discount = 0;
    const finalPrice = cart.totalPrice - discount;

    // Render checkout page with necessary data
    res.render("checkout", {
      cart,
      user,
      userId: user._id,
      addresses: await Address.find({ userId: user._id }),
      selectedAddressId: null,
      coupons,
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

const placeOrder = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const { addressId, totalPrice, finalPrice, ordereditems, paymentMethod } =
      req.body;

    const userId = req.cookies.user;

    if (!userId) {
      throw new Error("User ID is missing");
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (!addressId) {
      throw new Error("Invalid address ID");
    }

    const addressDoc = await Address.findById(addressId);
    if (!addressDoc || !addressDoc.address || addressDoc.address.length === 0) {
      throw new Error("Address not found");
    }

    const fullAddress = addressDoc.address[0];

    let parsedOrderedItems =
      typeof ordereditems === "string"
        ? JSON.parse(ordereditems)
        : ordereditems;

    if (
      !parsedOrderedItems ||
      !Array.isArray(parsedOrderedItems) ||
      parsedOrderedItems.length === 0
    ) {
      throw new Error("No ordered items found");
    }

    const formattedItems = [];

    // Handle each ordered item
    for (const item of parsedOrderedItems) {
      const product = await Product.findById(item.productId);

      if (!product) {
        throw new Error(`Product with ID ${item.productId} not found`);
      }

      let variant = null;

      if (item.variantId) {
        variant = product.variants.id(item.variantId);

        if (!variant) {
          throw new Error(`Variant with ID ${item.variantId} not found`);
        }

        if (variant.stock < item.quantity) {
          throw new Error(`Not enough stock for variant ${item.variantId}`);
        }

        variant.stock -= item.quantity;

        await Product.updateOne(
          { _id: product._id, "variants._id": variant._id },
          { $set: { "variants.$.stock": variant.stock } }
        );
      } else {
        if (product.stock < item.quantity) {
          throw new Error(`Not enough stock for product ${item.productId}`);
        }

        product.stock -= item.quantity;

        await product.save();
      }

      formattedItems.push({
        productId: product._id,
        quantity: item.quantity,
        price: item.price,
      });
    }

    let paymentStatus = "pending";
    if (paymentMethod === "wallet") {
      const wallet = await Wallet.findOne({ userId });

      if (!wallet || wallet.balance < finalPrice) {
        throw new Error("Insufficient wallet balance");
      }

      wallet.balance -= finalPrice;

      wallet.transactions.push({
        amount: finalPrice,
        type: "debit",
        description: "Order payment",
        orderId: orderId,
      });

      await wallet.save();
      paymentStatus = "paid";
    }

    if (paymentMethod === "razorpay") {
      paymentStatus = "paid";
    }

    // Create and save the order
    const order = new Order({
      userId,
      address: fullAddress,
      totalPrice,
      finalPrice,
      ordereditems: formattedItems,
      paymentMethod,
      status: paymentStatus === "paid" ? "Processing" : "Pending",
    });

    await order.save();
    await Cart.deleteOne({ userId });

    req.session.orderSuccess = true;
    res
      .status(200)
      .json({ message: "Order placed successfully", orderId: order._id });
  } catch (error) {
    console.error("Error placing order:", error);
    res.status(500).json({ message: error.message || "Internal Server Error" });
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
const returnOrder = async (req, res) => {
  const userId = req.cookies.user; // Get user ID from cookies
  const orderId = req.params.orderId; // Get order ID from request parameters

  // Check if user is logged in
  if (!userId) {
    return res
      .status(400)
      .json({ error: "User not logged in or session expired" });
  }

  try {
    // Find the order by ID
    const order = await Order.findById(orderId);

    // Check if the order exists and belongs to the user
    if (!order || order.userId.toString() !== userId.toString()) {
      return res
        .status(404)
        .json({ error: "Order not found or does not belong to user" });
    }

    // Check if the order has already been returned
    if (order.status === "Returned") {
      return res.status(400).json({ error: "Order has already been returned" });
    }

    // Update the order status to "Returned"
    order.status = "Returned";
    await order.save();

    // Increase the stock for each item in the order
    for (const item of order.ordereditems) {
      const product = await Product.findById(item.productId);

      if (product) {
        if (item.variantId) {
          const variant = product.variants.id(item.variantId);

          if (variant) {
            variant.stock += item.quantity; // Increase variant stock
            await product.save();
          } else {
            console.error(
              `Variant with ID ${item.variantId} not found in product ${product._id}`
            );
          }
        } else {
          product.stock += item.quantity; // Increase product stock if no variant
          await product.save();
        }
      }
    }

    // Process refund to the user's wallet
    const wallet = await Wallet.findOne({ userId: order.userId });
    if (wallet) {
      const refundAmount = order.finalPrice; // Amount to refund

      // Increase the wallet balance
      wallet.balance += refundAmount;

      // Record the transaction
      wallet.transactions.push({
        amount: refundAmount,
        type: "credit",
        description: `Refund for returned order ${order._id}`,
        orderId: order._id,
        date: new Date(),
      });

      await wallet.save();
    }

    res.redirect("/orders");
  } catch (err) {
    console.error("Error processing return:", err);
    res.status(500).json({ error: "Error processing return" });
  }
};

const loadShop = async (req, res) => {
  const sortOption = req.query.sortby || "popularity";
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 6;

  const searchQuery = req.query.q || ""; // Capture search query

  let sortCriteria;

  // Sorting criteria logic as before
  switch (
    sortOption
    // ... same sorting logic
  ) {
  }

  // Category and size filtering logic as before
  let selectedCategories = req.query.categories || [];
  let selectedSizes = req.query.sizes || [];
  if (!Array.isArray(selectedCategories))
    selectedCategories = [selectedCategories];
  if (!Array.isArray(selectedSizes)) selectedSizes = [selectedSizes];

  let filterCriteria = {};

  // Search filtering
  if (searchQuery) {
    filterCriteria.name = { $regex: new RegExp(searchQuery, "i") };
  }

  // Category filtering as before
  if (selectedCategories.length > 0) {
    const categories = await Category.find({
      name: { $regex: new RegExp(selectedCategories.join("|"), "i") },
    });
    const categoryIds = categories.map((category) => category._id);
    if (categoryIds.length > 0) filterCriteria.category = { $in: categoryIds };
  }

  // Size filtering as before
  if (selectedSizes.length > 0) {
    filterCriteria.variants = {
      $elemMatch: {
        quantity: { $in: selectedSizes.map((size) => `${size} ml`) },
      },
    };
  }

  try {
    const totalProducts = await Product.countDocuments(filterCriteria);
    const products = await Product.find(filterCriteria)
      .sort(sortCriteria)
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    const totalPages = Math.ceil(totalProducts / limit);

    res.render("shop", {
      products,
      currentPage: page,
      totalPages,
      sortOption,
      selectedSizes,
      selectedCategories,
      searchQuery, // Send search query to the front-end
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

module.exports = { loadShop };

const readData = () => {
  console.log("0");

  if (fs.existsSync("orders.json")) {
    const data = fs.readFileSync("orders.json");
    return JSON.parse(data);
  }
  return [];
};

// Function to write data to JSON file
const writeData = (data) => {
  console.log("1");

  fs.writeFileSync("orders.json", JSON.stringify(data, null, 2));
};

// Initialize orders.json if it doesn't exist
if (!fs.existsSync("orders.json")) {
  writeData([]);
}

const createOrder = async (req, res) => {
  console.log("create-order request");

  const razorpay = new Razorpay({
    key_id: "rzp_test_l1wDTzBK3cxTc4",
    key_secret: "ue64Gl5uxUC9BKW2hynXE3DD",
  });

  const readData = () => {
    console.log("3");

    if (fs.existsSync("orders.json")) {
      const data = fs.readFileSync("orders.json");
      return JSON.parse(data);
    }
    return [];
  };

  // Function to write data to JSON file
  const writeData = (data) => {
    console.log("4");

    fs.writeFileSync("orders.json", JSON.stringify(data, null, 2));
  };

  // Initialize orders.json if it doesn't exist
  if (!fs.existsSync("orders.json")) {
    writeData([]);
  }
  try {
    console.log("5");

    console.log(req.body);
    const { amount, currency, receipt, notes } = req.body;
    const options = {
      amount: amount * 100,
      currency,
      receipt,
      notes,
    };

    const order = await razorpay.orders.create(options);

    // Read current orders, add new order, and write back to the file
    const orders = readData();
    orders.push({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      status: "created",
    });
    writeData(orders);
    console.log(order, "order response");
    res.json(order); // Send order details to frontend, including order ID
  } catch (error) {
    console.error(error);
    res.status(500).send("Error creating order");
  }
};

const applyCoupon = async (req, res) => {
  const { couponCode, totalAmount } = req.body;
  const userId = req.cookies.user; // Assuming req.cookies.user contains the user's ObjectId as a string

  try {
    // Find the coupon by code
    const coupon = await Coupon.findOne({
      code: couponCode.trim(),
      isActive: true,
    });

    console.log("Checking coupon:", couponCode); // Debugging log
    console.log("Found coupon:", coupon); // Debugging log

    if (!coupon) {
      return res.json({ success: false, message: "Coupon does not exist" });
    }

    if (new Date(coupon.expiryDate) < new Date()) {
      return res.json({ success: false, message: "Coupon has expired" });
    }

    // Convert userId from cookie to a Mongoose ObjectId
    const mongooseUserId = new mongoose.Types.ObjectId(userId);

    // Check if the user has already used this coupon
    const hasUsedCoupon = coupon.userId.some((id) => id.equals(mongooseUserId));

    if (hasUsedCoupon) {
      return res.json({
        success: false,
        message: "Coupon has already been used by you",
      });
    }

    // Check if total amount meets coupon requirements
    if (
      totalAmount < coupon.minOrderAmount ||
      totalAmount > coupon.maxOrderAmount
    ) {
      return res.json({
        success: false,
        message: `Order total must be between ${coupon.minOrderAmount} and ${coupon.maxOrderAmount}`,
      });
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.discountType === "percentage") {
      discountAmount = totalAmount * (coupon.discountValue / 100);
    } else if (coupon.discountType === "fixed") {
      discountAmount = coupon.discountValue;
    }

    // Ensure discount does not exceed totalAmount
    discountAmount = Math.min(discountAmount, totalAmount);

    const newTotal = totalAmount - discountAmount;

    // Mark coupon as used by this user
    coupon.userId.push(mongooseUserId); // Add userId to the coupon
    await coupon.save(); // Save the updated coupon with the user ID

    res.json({ success: true, discountAmount, newTotal });
  } catch (error) {
    console.error("Error applying coupon:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const paymentSuccess = async (req, res) => {
  console.log("6");

  try {
    console.log("7");

    const userId = req.cookies.user;
    const orderId = req.params.id;
    console.log("userId,orderId", userId, orderId);

    if (!userId) {
      return res.status(401).send("Unauthorized");
    }

    const order = await Order.findById(orderId)
      .populate("address")
      .populate("ordereditems.productId");
    console.log(order, "order");

    if (!order) {
      return res.status(404).send("Order not found");
    }

    res.render("order-success", { order });
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).send("Error fetching order details");
  }
};

const verifyPayment = async (req, res) => {
  console.log(req.body, "verify peyment");
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    req.body;

  const secret = "ue64Gl5uxUC9BKW2hynXE3DD";
  const body = razorpay_order_id + "|" + razorpay_payment_id;

  try {
    const isValidSignature = validateWebhookSignature(
      body,
      razorpay_signature,
      secret
    );
    if (isValidSignature) {
      // Update the order with payment details
      const orders = readData();
      const order = orders.find((o) => o.order_id === razorpay_order_id);
      if (order) {
        order.status = "paid";
        order.payment_id = razorpay_payment_id;
        writeData(orders);
      }
      res.status(200).json({ status: "ok" });
      console.log("Payment verification successful");
    } else {
      res.status(400).json({ status: "verification_failed" });
      console.log("Payment verification failed");
    }
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ status: "error", message: "Error verifying payment" });
  }
};

module.exports = {
  loadHomePage,
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
  returnOrder,
  createOrder,
  applyCoupon,
  paymentSuccess,
  verifyPayment,
};
