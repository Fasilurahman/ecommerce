const express = require('express');
const router = express.Router();
const adminController = require('../controller/admin/adminController');
const customerController = require('../controller/admin/customerController');
const categoryController = require('../controller/admin/categoryController');
const productController = require('../controller/admin/productController');
const brandController = require('../controller/admin/brandController');
const orderController = require('../controller/admin/orderController');
const couponController = require('../controller/admin/couponController');
const offerController = require('../controller/admin/offerController');
const salesController = require('../controller/admin/salesController');
const dashboardController = require('../controller/admin/dashboardController');
const {userAuth,adminAuth} = require('../middlewares/auth');



router.get('/pageerror', adminController.pageerror);
router.get('/login', adminAuth,adminController.loadadminLogin);
router.post("/login", adminAuth,adminController.adminLogin);
router.get('/', adminAuth, adminController.loadDashboard);
router.get('/logout',adminAuth, adminController.logout);
router.get('/users', adminAuth, customerController.customerInfo);
router.get('/users/block/:id', adminAuth, customerController.blockUser);
router.get('/users/unblock/:id', adminAuth, customerController.unblockUser);
router.get('/category', adminAuth, categoryController.categoryInfo);
router.post('/category/add', adminAuth, categoryController.addCategory);
router.post('/editcategory', adminAuth, categoryController.editCategory);
router.post('/category/deletecategory/:id',adminAuth, categoryController.deleteCategory);
router.post('/category/block/:id', adminAuth, categoryController.blockCategory);
router.post('/category/unblock/:id', adminAuth, categoryController.unblockCategory);

router.get('/brand',adminAuth, brandController.brandInfo);
router.post('/brand/add',adminAuth, brandController.addBrand);
router.post('/editbrand',adminAuth, brandController.editBrand);
router.post('/deleteBrand',adminAuth, brandController.deleteBrand);




const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

router.get('/dashboard',)
router.get('/products',adminAuth, productController.productInfo);
router.get('/addProduct',adminAuth, productController.showAddProductPage);
router.post('/addProduct',adminAuth, upload.array('images', 4), productController.addProduct);
router.get('/editProduct/:id',adminAuth, productController.showEditProductPage);





// In your route, make sure you handle file uploads correctly
router.post('/editProduct/:id', upload.fields([
  { name: 'image1', maxCount: 1 },
  { name: 'image2', maxCount: 1 },
  { name: 'image3', maxCount: 1 },
  { name: 'image4', maxCount: 1 }
]),adminAuth, productController.editProduct);

router.get('/product/:id',adminAuth, productController.showProductDetailPage);
router.delete('/products/:id',adminAuth, productController.deleteProduct);
router.post('/blockProduct/:id', adminAuth, productController.blockProduct);
router.post('/unblockProduct/:id', adminAuth,productController.unblockProduct);


router.get('/order',adminAuth, orderController.orderDetails);
router.post('/order/update/:orderId',adminAuth, orderController.updateOrderStatus);
router.post('/orders/return/:orderId', orderController.requestReturn);
// admin routes (router/admin.js or wherever you configure admin routes)
router.get('/return-requests', orderController.viewReturnRequests);
router.post('/approve-return/:orderId', orderController.approveReturn);
router.post('/reject-return/:orderId', orderController.rejectReturn);
router.get('/order/view/:id', orderController.viewOrder);





router.get('/coupon',adminAuth,couponController.loadCoupon)
router.post('/coupon/add',adminAuth, couponController.addCoupon);
router.post('/coupon/edit/:id',adminAuth, couponController.editCoupon);
router.post('/coupon/delete/:id',adminAuth, couponController.deleteCoupon);


router.get('/offer',adminAuth, offerController.getAllOffers);
router.post('/offer/add',adminAuth, offerController.addOffer);
router.post('/offer/add',adminAuth, offerController.addOffer);
router.get('/entities/:type',adminAuth, offerController.getEntitiesByType);
router.put('/offer/:id',adminAuth, offerController.editOffer);
router.patch('/offer/:id/block',adminAuth, offerController.blockOffer);
router.delete('/offer/:id',adminAuth, offerController.deleteOffer);

router.get('/sales-report',adminAuth,salesController.getSalesReport)
router.get('/sales-report/pdf',adminAuth, salesController.generatePDF);

router.get('/admin/dashboard',adminAuth, dashboardController.renderDashboard); // Route to render the dashboard
router.get('/top-products',adminAuth, async (req, res) => {
  const products = await dashboardController.getTopProducts();
  res.json(products);
});
router.get('/top-categories',adminAuth, async (req, res) => {
  const categories = await dashboardController.getTopCategories();
  res.json(categories);
});
router.get('/top-brands',adminAuth, async (req, res) => {
  const brands = await dashboardController.getTopBrands();
  res.json(brands);
});
router.get('/sales',adminAuth, dashboardController.getSalesData);

module.exports = router

