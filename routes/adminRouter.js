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
const {userAuth,adminAuth} = require('../middlewares/auth');



router.get('/pageerror', adminController.pageerror);
router.get('/login', adminController.loadadminLogin);
router.post('/login', adminController.adminLogin);
router.get('/', adminAuth, adminController.loadDashboard);
router.get('/logout', adminController.logout);
router.get('/users', adminAuth, customerController.customerInfo);
router.get('/users/block/:id', adminAuth, customerController.blockUser);
router.get('/users/unblock/:id', adminAuth, customerController.unblockUser);
router.get('/category', adminAuth, categoryController.categoryInfo);
router.post('/category/add', adminAuth, categoryController.addCategory);
router.post('/editcategory', adminAuth, categoryController.editCategory);
router.post('/category/deletecategory/:id',adminAuth, categoryController.deleteCategory);
router.post('/category/block/:id', adminAuth, categoryController.blockCategory);
router.post('/category/unblock/:id', adminAuth, categoryController.unblockCategory);

router.get('/brand', brandController.brandInfo);
router.get('/brand', brandController.brandInfo);
router.post('/brand/add', brandController.addBrand);
router.post('/editbrand', brandController.editBrand);
router.post('/deleteBrand', brandController.deleteBrand);




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
router.get('/products', productController.productInfo);
router.get('/addProduct', productController.showAddProductPage);
router.post('/addProduct', upload.array('images', 4), productController.addProduct);
router.get('/editProduct/:id', productController.showEditProductPage);





// In your route, make sure you handle file uploads correctly
router.post('/editProduct/:id', upload.fields([
  { name: 'image1', maxCount: 1 },
  { name: 'image2', maxCount: 1 },
  { name: 'image3', maxCount: 1 },
  { name: 'image4', maxCount: 1 }
]), productController.editProduct);

router.get('/product/:id', productController.showProductDetailPage);
router.delete('/products/:id', productController.deleteProduct);

router.get('/order',adminAuth, orderController.orderDetails);
router.post('/order/update/:orderId', orderController.updateOrderStatus);


router.get('/coupon',couponController.loadCoupon)
router.post('/coupon/add', couponController.addCoupon);
router.post('/coupon/edit/:id', couponController.editCoupon);
router.post('/coupon/delete/:id', couponController.deleteCoupon);


router.get('/offer', offerController.getAllOffers);
router.post('/offer/add', offerController.addOffer);
router.get('/entities/:type', offerController.getEntitiesByType);
router.put('/offer/:id', offerController.editOffer);
router.patch('/offer/:id/block', offerController.blockOffer);
router.delete('/offer/:id', offerController.deleteOffer);

router.get('/sales-report',salesController.getSalesReport)
router.get('/sales-report/pdf', salesController.generatePDF);



module.exports = router

