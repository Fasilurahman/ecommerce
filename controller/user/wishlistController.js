const Wishlist = require('../../models/wishlistSchema');
const Product = require('../../models/productSchema');

// Add product to wishlist
const addToWishlist = async (req, res) => {
    const {  productId } = req.body;
    const userId = req.cookies.user;
    console.log(req.body,'fasssssssssssss');
    console.log(userId,'fffffffffffffff');
    
    
    try {
        let wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            wishlist = new Wishlist({ userId, products: [] });
        }

        // Check if the product already exists in the wishlist
        const existingProduct = wishlist.products.find(item => item.productId.equals(productId));
        if (!existingProduct) {
            wishlist.products.push({ productId });
            console.log(wishlist,'wishlist');
            
            await wishlist.save();
            return res.status(201).json({ message: 'Product added to wishlist', wishlist });
        } else {
            return res.status(400).json({ message: 'Product is already in the wishlist' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Remove product from wishlist
const removeFromWishlist = async (req, res) => {
    const  userId  = req.cookies.user;
    const { productId } = req.body;

    console.log(userId, 'userId');
    console.log(productId,'product');
    
    

    try {
        const wishlist = await Wishlist.findOneAndUpdate(
            { userId },
            { $pull: { products: { productId } } },
            { new: true }
        );

        if (!wishlist) {
            return res.status(404).json({ message: 'Wishlist not found' });
        }

        res.json({ message: 'Product removed from wishlist', wishlist });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get user's wishlist
const getWishlist = async (req, res) => {
    const userId  = req.cookies.user;
    console.log(userId,'user id');
    

    try {
        const wishlist = await Wishlist.findOne({ userId }).populate('products.productId');
        console.log(wishlist,'wishlist');
        
        res.render('wishlist',{wishlist})
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    addToWishlist,
    removeFromWishlist,
    getWishlist,
};
