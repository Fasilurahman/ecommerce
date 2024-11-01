const Coupon = require('../../models/couponSchema');

// Load coupon page
const loadCoupon = async (req, res) => {
    try {
        // Get the current page and limit from the query params (default: page 1, limit 10)
        const { page = 1, limit = 2 } = req.query;
        const currentPage = parseInt(page);
        const couponsPerPage = parseInt(limit);

        // Fetch coupons for the current page
        const coupons = await Coupon.find()
            .skip((currentPage - 1) * couponsPerPage) // Skip coupons from previous pages
            .limit(couponsPerPage); // Limit the number of coupons per page

        // Get the total number of coupons
        const totalCoupons = await Coupon.countDocuments();
        const totalPages = Math.ceil(totalCoupons / couponsPerPage); // Calculate total pages

        // Render the coupon list page with pagination data
        res.render('coupon', {
            coupons,
            currentPage,
            totalPages,
            couponsPerPage
        });
    } catch (error) {
        console.log('Error loading coupons:', error);
        res.status(500).send('Internal Server Error');
    }
};



const addCoupon = async (req, res) => {
    try {
        const { code, discountType, discountValue, expiryDate, minOrderAmount, maxOrderAmount, description } = req.body;

        if (!code || !discountType || !discountValue || !expiryDate) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        if (discountValue <= 0 || (minOrderAmount && minOrderAmount < 0) || (maxOrderAmount && maxOrderAmount < 0)) {
            return res.status(400).json({ message: 'Discount and order amounts must be positive' });
        }

        const expiry = new Date(expiryDate);
        if (expiry <= new Date()) {
            return res.status(400).json({ message: 'Expiry date must be in the future' });
        }

        const existingCoupon = await Coupon.findOne({ code });
        if (existingCoupon) {
            return res.status(400).json({ message: 'Coupon code already exists' });
        }

        const newCoupon = new Coupon({
            code,
            discountType,
            discountValue,
            expiryDate,
            minOrderAmount,
            maxOrderAmount,
            description
        });

        await newCoupon.save();
        res.status(201).json({ message: 'Coupon added successfully', coupon: newCoupon });
    } catch (error) {
        console.log('Error adding coupon:', error);
        res.status(400).json({ message: 'Error adding coupon', error });
    }
};


const editCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const { code, discountType, discountValue, expiryDate, minOrderAmount, maxOrderAmount, description } = req.body;


        if (!code || !discountType || !discountValue || !expiryDate) {
            return res.status(400).json({ message: 'All fields are required' });
        }


        if (discountValue <= 0 || (minOrderAmount && minOrderAmount < 0) || (maxOrderAmount && maxOrderAmount < 0)) {
            return res.status(400).json({ message: 'Discount and order amounts must be positive' });
        }


        const expiry = new Date(expiryDate);
        if (expiry <= new Date()) {
            return res.status(400).json({ message: 'Expiry date must be in the future' });
        }


        const existingCoupon = await Coupon.findOne({ code, _id: { $ne: id } });
        if (existingCoupon) {
            return res.status(400).json({ message: 'Coupon code already exists' });
        }

        const updatedCoupon = await Coupon.findByIdAndUpdate(
            id,
            { code, discountType, discountValue, expiryDate, minOrderAmount, maxOrderAmount, description },
            { new: true }
        );

        if (!updatedCoupon) {
            return res.status(404).json({ message: 'Coupon not found' });
        }

        res.json({ message: 'Coupon updated successfully', coupon: updatedCoupon });
    } catch (error) {
        console.log('Error updating coupon:', error);
        res.status(400).json({ message: 'Error updating coupon', error });
    }
};




const deleteCoupon = async (req, res) => {
    try {
        const { id } = req.params;

        const deletedCoupon = await Coupon.findByIdAndDelete(id);
        if (!deletedCoupon) {
            return res.status(404).json({ message: 'Coupon not found' });
        }

        res.json({ message: 'Coupon deleted successfully' });
    } catch (error) {
        console.log('Error deleting coupon:', error);
        res.status(500).json({ message: 'Error deleting coupon', error });
    }
};

module.exports = { loadCoupon, 
    addCoupon, 
    editCoupon, 
    deleteCoupon 
};
