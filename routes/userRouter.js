const express = require("express");
const router = express.Router();
const flash = require("connect-flash");
const userController = require("../controller/user/userController");
const passport = require("passport");
const { userAuth, adminAuth } = require("../middlewares/auth");
const productController = require("../controller/admin/productController");
const orderController = require("../controller/user/orderController");
const wishlistController = require("../controller/user/wishlistController");
const walletController = require("../controller/user/walletController");
 
router.get("/product/:id", productController.showProductDetailPage);
router.get("/pageNotFount", userController.pageNotFount);
router.get("/", userController.loadHomePage);
router.get("/signup", userController.loadSignup);
router.post("/signup", userController.signup);
router.get("/otp", userController.loadotpPage);
router.post("/otp", userController.otpPage);
router.post("/resend-otp", userController.resendOtp);
router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/signup" }),
  (req, res) => {
    if (req.user) {
      req.session.user = req.user._id;
      req.session.username = req.user.username;
      res.cookie("user", req.session.user, { httpOnly: true, secure: true });
      res.redirect("/"); 
    }
  }
);
router.get("/login", userController.loadLogin);
router.post("/login", userController.login);
router.get("/forgotpassword", userController.loadForgotPassword);
router.post("/forgotpassword", userController.forgotPassword);
router.post("/verify-forgototp", userController.verifyForgotOtp);
router.post("/resend-forgototp", userController.resendForgotOtp);
router.get("/resetpassword", (req, res) =>
  res.render("resetpassword", { email: req.query.email })
);
router.post("/resetpassword", userController.resetPassword);
router.get("/logout", userController.logout);

router.get("/profile", userAuth, orderController.loadUserProfile);
router.post("/profile", userAuth, orderController.updateProfile);
router.get("/addresses", userAuth, orderController.loadUserAddresses);
router.post("/addaddress", userAuth, orderController.addaddress);
router.get("/getAddressData/:id", userAuth, orderController.getAddressData);
router.post("/editaddress/:id", userAuth, orderController.editaddress);
router.post(
  "/deleteaddress/:addressId",
  userAuth,
  orderController.deleteaddress
);
router.get("/orders", userAuth, orderController.loadUserOrders);
router.get("/orders/:orderId", userAuth, orderController.UserOrders);
router.post("/orders/cancel/:orderId", userAuth, orderController.cancelOrder);
router.get("/changepassword", userAuth, orderController.loadchangepassword);
router.post("/changepassword", userAuth, orderController.changepassword);

router.get("/shopping", userController.loadShopping);
router.get("/add-to-cart/:productId", userAuth, userController.addToCart);
router.post("/add-to-cart/:productId", userAuth, userController.addToCart);
router.get("/cart", userAuth, userController.loadCart);
router.post("/cart/remove/:itemId", userAuth, userController.removeFromCart);
router.post(
  "/cart/update-quantity/:itemId",
  userAuth,
  userController.updateQuantity
);

router.post("/wishlist/add", userAuth, wishlistController.addToWishlist);
router.delete(
  "/wishlist/:productId",
  userAuth,
  wishlistController.removeFromWishlist
);
router.get("/wishlist", userAuth, wishlistController.getWishlist);

router.get("/shop", userAuth, userController.loadShop);
router.get("/checkout", userAuth, userController.loadCheckout);
router.post("/order", userAuth, userController.placeOrder);
router.get("/order-success/:id", userAuth, userController.paymentSuccess);
router.get("/orders", userAuth, userController.getOrderPage);
router.post("/orders/return/:orderId", userAuth, userController.returnOrder);
router.post("/create-order", userAuth, userController.createOrder);
router.post("/apply-coupon", userAuth, userController.applyCoupon);
router.post("/verify-payment", userAuth, userController.verifyPayment);

router.get("/wallet", walletController.loadWalletPage);

module.exports = router;
