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
router.get("/blog", userController.loadBlog);
router.get('/brands/:brandId', userController.getProductsByBrand);
router.get("/signup",userController.loadSignup);
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
router.get("/logout",userAuth, userController.logout);


const multer = require('multer');
const path = require('path');
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
      cb(null, 'uploads/'); // Set the destination for uploaded files
  },
  filename: function (req, file, cb) {
      cb(null, Date.now() + '-' + file.originalname); // Set the file name
  }
});

const upload = multer({ storage: storage });

router.get("/profile", userAuth, userController.loadUserProfile);
router.post('/register', userAuth, orderController.registerUser);
router.post("/profile", userAuth,upload.single('profilePicture'), orderController.updateProfile);
router.get("/addresses", userAuth, orderController.loadUserAddresses);
router.post("/addaddress", userAuth, orderController.addaddress);
router.get("/edit-address/:id", userAuth, orderController.getAddressData); // Route to load the edit form
router.post("/edit-address/:id", userAuth, orderController.editaddress);   // Route to update the address

router.post(
  "/deleteaddress/:addressId",
  userAuth,
  orderController.deleteaddress
);
router.get("/orders", userAuth, orderController.loadUserOrders);
router.get("/orders/:orderId", userAuth, orderController.UserOrders);
router.get('/orders/invoice/:orderId',userAuth, orderController. downloadInvoice);
router.post("/orders/cancel/:orderId", userAuth, orderController.cancelOrder);
router.post('/orders/cancel-item/:orderId/:productId', userAuth, orderController.cancelItem);
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

router.get("/shop", userController.loadShop);
router.get("/checkout", userAuth, userController.loadCheckout);
router.post("/order", userAuth, userController.placeOrder);
router.get('/orderSuccess/:id', userAuth, userController.paymentSuccess);
router.post('/order/repayment-razorpay', userAuth,userController.repayment_razorpayPOST)
router.post('/order/verifyRepayment', userAuth,userController.verifyRepaymentPOST);
router.get('/orders/:orderId/failed', userController.paymentFailed);
router.get("/orders", userAuth, userController.getOrderPage);
// router.post("/orders/return/:orderId", userAuth, userController.returnOrder);
router.post("/create-order", userAuth, userController.createOrder);
router.post("/verify-payment", userAuth, userController.verifyPayment);
router.post("/apply-coupon", userAuth, userController.applyCoupon);
router.post("/remove-coupon", userAuth, userController.removeCoupon)

router.get("/wallet", walletController.loadWalletPage);

module.exports = router;
