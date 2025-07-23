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

  let selectedCategories = req.query.categories || [];
  let selectedSizes = req.query.sizes || [];
  if (!Array.isArray(selectedCategories))
    selectedCategories = [selectedCategories];
  if (!Array.isArray(selectedSizes)) selectedSizes = [selectedSizes];

  let filterCriteria = { status: "active" };

  if (searchQuery) {
    filterCriteria.name = { $regex: new RegExp(searchQuery, "i") };
  }

  try {
    console.log("Selected Categories:", selectedCategories); 

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

      console.log("Matched Categories from DB:", categories);

      const categoryIds = categories.map((category) => category._id);
      if (categoryIds.length > 0) {
        filterCriteria.category = { $in: categoryIds };
      } else {
        console.warn("No categories found matching selected filters.");
      }
    }

    if (selectedSizes.length > 0) {
      filterCriteria.variants = {
        $elemMatch: {
          quantity: { $in: selectedSizes.map((size) => `${size} ml`) },
        },
      };
    }

    const brands = await Brand.find({});

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
  key_id: process.env.YOUR_RAZORPAY_KEY_ID, 
  key_secret: process.env.RAZORPAY_KEY_SECRET, 
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

  const user = await User.findById(req.session.user);
  console.log('12345678912345678',user, "user in place order");
  
  try {

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    if (user.orderInProgress) {
      return res.status(429).json({
        success: false,
        message: "An order is already being processed. Please wait.",
      });
    }

    user.orderInProgress = true;
    await user.save();
    console.log("orderInProgress updated for user:", user._id);
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

    if (paymentMethod === "cod" && finalPrice > 1000) {
      return res.status(400).json({
        success: false,
        message: "Cash on delivery is not allowed for orders below ₹1000.",
      });
    }

    for (let item of orderItems) {
      const product = await Product.findById(item.productId);

      if (!product || product.status !== "active") {
        return res.status(404).json({
          success: false,
          message: `Product with ID ${item.productId} not found or is blocked.`,
        });
      }

      const variant = product.variants.id(item.variantId);

      if (!variant) {
        return res.status(404).json({
          success: false,
          message: `Variant with ID ${item.variantId} not found in product ${item.productId}.`,
        });
      }

      if (variant.stock === 0) {
        return res.status(400).json({
          success: false,
          message: `No stock available for variant ${item.variantId}.`,
        });
      }

      if (variant.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for variant ${item.variantId}. Requested: ${item.quantity}, Available: ${variant.stock}`,
        });
      }

      await product.save();
    }

    let razorpayOrderId = null;

    if (paymentMethod === "wallet") {
      let wallet = await Wallet.findOne({ userId: user._id });

      if (!wallet) {
        wallet = new Wallet({
          userId: user._id,
          balance: 0,
          transactions: [],
        });
        await wallet.save();
      }

      if (wallet.balance < finalPrice) {
        return res
          .status(400)
          .json({ success: false, message: "Insufficient wallet balance." });
      }

      wallet.balance -= finalPrice;

      wallet.transactions.push({
        type: "debit",
        amount: finalPrice,
        description: `Purchase of products for order ${new Date().getTime()}`,
        date: new Date(),
      });

      await wallet.save();
    }

    if (paymentMethod === "razorpay") {
      const options = {
        amount: finalPrice * 100,
        currency: "INR",
        receipt: `receipt_order_${new Date().getTime()}`,
        payment_capture: 1,
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
          paymentStatus: "pending",
          status: "Pending",
        });
        console.log(
          razorpayOrder,
          finalPrice,
          " razorpay order id and final price"
        );

        await newOrder.save();
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

    cart.items = [];
    cart.totalPrice = 0;
    await cart.save();

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
    if (user) {
      user.orderInProgress = false;
      await user.save();
    }
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
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const validItemsTotal = order.ordereditems 
      .filter((item) => !item.isCancelled)
      .reduce((total, item) => total + item.price * item.quantity, 0);

    const amount = validItemsTotal * 100; 
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

      order.paymentStatus = "paid";
      order.razorpayOrderId = razorpay_order_id;

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
      const user = await User.findById(order.userId);
      if (user) {
        user.orderInProgress = false;
        await user.save();
      }

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

    const user = await User.findById(order.userId);
    if (user) {
      user.orderInProgress = false;
      await user.save();
    }

    res.redirect("/payment-failure");
  } catch (error) {
    console.error("Error updating payment status:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const writeData = (data) => {
  fs.writeFileSync("orders.json", JSON.stringify(data, null, 2));
};

if (!fs.existsSync("orders.json")) {
  writeData([]);
}

const razorpay = new Razorpay({
  key_id: "YOUR_RAZORPAY_KEY", 
  key_secret: "YOUR_RAZORPAY_SECRET", 
});

const createOrder = async (req, res) => {
  const { userId, totalPrice, finalPrice, ordereditems, addressId } = req.body;

  try {
    const newOrder = await Order.create({
      userId,
      totalPrice,
      finalPrice,
      orderedItems: ordereditems,
      addressId,
      paymentStatus: "Pending", 
    });

    const razorpayOrder = await razorpay.orders.create({
      amount: finalPrice * 100, 
      currency: "INR",
      receipt: newOrder._id.toString(),
      payment_capture: 1, 
    });

    if (!razorpayOrder) {
      return res
        .status(500)
        .json({ success: false, message: "Failed to create Razorpay order" });
    }

    res.json({
      success: true,
      order: {
        orderId: newOrder._id, 
        razorpayOrderId: razorpayOrder.id, 
        totalAmount: finalPrice, 
        paymentStatus: "Pending", 
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

    if (req.session.appliedCoupon) {
      const couponCode = req.session.appliedCoupon.toLowerCase();

      const coupon = await Coupon.findOne({ code: couponCode, isActive: true });

      if (coupon) {
        const userId = req.cookies.user;
        const mongooseUserId = new mongoose.Types.ObjectId(userId);

        if (Array.isArray(coupon.userId)) {
          coupon.userId.push(mongooseUserId);
          await coupon.save();
        } else {
          console.error("coupon.userId is not an array");
        }

        order.couponApplied = true;
      } else {
        console.error("Coupon not found or inactive");
      }

      delete req.session.appliedCoupon;
    }

    await order.save();
    const user = await User.findById(order.userId);
  if (user) {
    user.orderInProgress = false;
    await user.save();
  }

    res.render("orderSuccess", { order });
  } catch (error) {
    console.error("Error processing payment success:", error);
    res.status(500).render("error", { message: "Internal Server Error" });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });
    if (!order || order.paymentMethod !== "razorpay") {
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
      const cart = await Cart.findOne({ userId: order.userId });
      if (cart) {
        cart.items = [];
        cart.totalPrice = 0;
        await cart.save();
      }
      const user = await User.findById(order.userId);
      if (user) {
        user.orderInProgress = false;
      }
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

    console.log("Session Before Applying Coupon:", req.session);

    if (req.session.appliedCoupon) {
      return res.json({
        success: false,
        message: "A coupon has already been applied to this order.",
      });
    }

    const coupon = await Coupon.findOne({
      code: couponCode.trim(), 
      isActive: true,
    });

    if (!coupon) {
      return res.json({
        success: false,
        message: "Coupon does not exist or is inactive",
      });
    }

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

    req.session.appliedCoupon = couponCode.trim();
    console.log("Applied Coupon Stored in Session:", req.session.appliedCoupon);

    res.json({ success: true, discountAmount, newTotal });
  } catch (error) {
    console.error("Error applying coupon:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const removeCoupon = (req, res) => {
  try {
    delete req.session.appliedCoupon;
    res.json({ success: true, message: "Coupon removed from session." });
  } catch (error) {
    console.error("Error removing coupon:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  loadShop,
  editAddress,
  deleteAddress,
  placeOrder,
  getOrderPage,
  createOrder,
  applyCoupon,
  removeCoupon,
  paymentSuccess,
  verifyPayment,
  repayment_razorpayPOST,
  verifyRepaymentPOST,
  paymentFailed,
};
