const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { Schema } = mongoose;

const userSchema = new Schema({
  username: {
    type: String,
  },
  email: {
    type: String,
    unique: true,
    required: true,
  },
  phone: {
    type: String,
    required: false,
    sparse: true,
    default: null,
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true,
  },
  password: {
    type: String,
    required: false,
  },
  isBlocked: {
    type: Boolean,
    default: false,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  cart: [
    {
      type: Schema.Types.ObjectId,
      ref: "Cart",
    },
  ],
  wallet: {
    type: Number,
    default: 0,
  },
  wishlist: [
    {
      type: Schema.Types.ObjectId,
      ref: "Wishlist",
    },
  ],
  created_on: {
    type: Date,
    default: Date.now,
  },

  profilePicture: { type: String },
  order_history: [
    {
      type: Schema.Types.ObjectId,
      ref: "Order",
    },
  ],
  referralCode: {
    type: String,
    unique: true, 
    required: false,
  },
  isReferred: {
    type: Boolean,
    default: false,
  },
  referredUsers: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  redeemStatus: {
    type: Boolean,
    default: false,
  },
  orderInProgress: {
    type: Boolean,
    default: false, 
  },
});

const User = mongoose.model("User", userSchema);

module.exports = User;
