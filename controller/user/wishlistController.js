const Wishlist = require("../../models/wishlistSchema");
const Product = require("../../models/productSchema");
const Brand = require("../../models/brandSchema");

// Add product to wishlist
const addToWishlist = async (req, res) => {
  const { productId } = req.body;
  const userId = req.cookies.user;

  try {
    let wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      wishlist = new Wishlist({ userId, products: [] });
    }

    // Check if the product already exists in the wishlist
    const existingProduct = wishlist.products.find((item) =>
      item.productId.equals(productId)
    );
    if (!existingProduct) {
      wishlist.products.push({ productId });
      await wishlist.save();
      return res.status(201).json({
        success: true,
        message: "Product added to wishlist",
        wishlist,
      });
    } else {
      // Return a message indicating the product is already in the wishlist
      return res
        .status(400)
        .json({ message: "Product is already in the wishlist" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Remove product from wishlist
const removeFromWishlist = async (req, res) => {
  const userId = req.cookies.user;
  const { productId } = req.body;

  try {
    const wishlist = await Wishlist.findOneAndUpdate(
      { userId },
      { $pull: { products: { productId } } },
      { new: true }
    );

    if (!wishlist) {
      return res.status(404).json({ message: "Wishlist not found" });
    }

    res.json({ message: "Product removed from wishlist", wishlist });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getWishlist = async (req, res) => {
  const userId = req.cookies.user;
  try {
    const wishlist = await Wishlist.findOne({ userId }).populate(
      "products.productId"
    );
    const brands = await Brand.find({})
    res.render("wishlist", { wishlist,brands });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  addToWishlist,
  removeFromWishlist,
  getWishlist,
};
