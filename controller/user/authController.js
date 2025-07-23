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
        user: "fasilu707@gmail.com",
        pass: "pfel wwtg uled vlxf",
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
    console.log(req.body, "signup body data");
    const findUser = await User.findOne({ email });
    if (findUser) {
      return res.render("signup", {
        message: "User already exists with the same email",
      });
    }
    let otp = generateOtp();
    console.log("top generating otp", otp);

    console.log(
      "Using email:",
      process.env.NODEMAILER_EMAIL,
      "Pass length:",
      process.env.NODEMAILER_PASSWORD
    );
    const sentEmail = await sendVerificationEmail(email, otp);
    console.log(sentEmail, " 1101fasilu sent email checking");
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
      return res.status(404).send("User not found");
    }
    res.render("userprofile", { user });
  } catch (error) {
    console.error("Error loading user profile:", error);
    res.status(500).send("Error loading user profile");
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
    console.log(findUser, "find user");

    if (!findUser) {
      return res.render("login", { message: "User not found" });
    }

    if (findUser.isBlocked) {
      return res.render("login", { message: "User is blocked by admin" });
    }

    const passwordMatch = await bcrypt.compare(password, findUser.password);
    console.log(passwordMatch);

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

const loadForgotPassword = (req, res) => {
  const error = req.session.forgotPasswordError || null;
  req.session.forgotPasswordError = null; 
  res.render("forgotpassword", { error });
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      req.session.forgotPasswordError = "User not found";
      return res.redirect("/forgotpassword");
    }

    const otp = generateOtp();
    req.session.forgotOtp = otp;
    req.session.userEmail = email;

    const emailSent = await sendVerificationEmail(email, otp);
    console.log("Enter your OTP:", otp);

    if (!emailSent) return res.status(500).send("Failed to send OTP email");

    res.render("forgototp"); 
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


module.exports = {
  loadSignup,
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
  loadUserProfile,
  generateReferralCode,
};