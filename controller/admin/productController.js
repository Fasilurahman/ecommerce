
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const Brand = require('../../models/brandSchema');
const multer = require('multer');
const path = require('path');
const category = require('../../models/categorySchema');
const variantSchema = require('../../models/variantSchema');


  const productInfo = async (req, res) => {
    try {
      const products = await Product.find().populate('category').populate('brand'); 
      res.render('products', { products });
    } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).send('Internal Server Error');
    }
  };
  

const showAddProductPage = async (req, res) => {
  try {
    const categories = await category.find(); 
    const brands = await Brand.find();
    res.render('addProduct', { categories, brands });
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).send('Internal Server Error');
  }
};

const addProduct = async (req, res) => {
  try {
      const variants = (req.body.variants || []).map(variant => ({
          quantity: variant.quantity,
          price: parseFloat(variant.price),
          stock: parseInt(variant.stock, 10),
      }));

      const images = req.files ? req.files.map(file => file.filename) : [];
      
      const newProduct = {
          name: req.body.name,
          description: req.body.description,
          category: req.body.category,
          brand: req.body.brand,
          variants,
          images,
          price: parseFloat(req.body.variants[0].price)
      };

      const product = new Product(newProduct);
      await product.save();

      console.log('Product saved successfully!');
      res.json({ success: true, message: 'Product added successfully!' });
  } catch (err) {
      console.error('Error adding product:', err);
      res.status(500).json({ success: false, message: 'An error occurred while adding the product.' });
  }
};


   
  

  const showEditProductPage = async (req, res) => {
    const productId = req.params.id;
  try {
    const product = await Product.findById(productId).populate('category').populate('brand');
    const categories = await Category.find();
    const brands = await Brand.find();
    res.render('editProduct', { product, categories, brands });
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).send('Internal Server Error');
  }
};


  

  const editProduct = async (req, res) => {
    const productId = req.params.id;
    const { name, description, category, brand, variants } = req.body;
    const images = [];
  
    try {
      const product = await Product.findById(productId);
  
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }
  
      product.name = name;
      product.description = description;
      product.variants = variants;
      product.category = category;
      product.brand = brand;
  
      if (req.files) {
        if (req.files.image1 && req.files.image1[0]) {
          images[0] = req.files.image1[0].filename;
        } else {
          images[0] = product.images[0];
        }
  
        if (req.files.image2 && req.files.image2[0]) {
          images[1] = req.files.image2[0].filename;
        } else {
          images[1] = product.images[1];
        }
  
        if (req.files.image3 && req.files.image3[0]) {
          images[2] = req.files.image3[0].filename;
        } else {
          images[2] = product.images[2];
        }
  
        if (req.files.image4 && req.files.image4[0]) {
          images[3] = req.files.image4[0].filename;
        } else {
          images[3] = product.images[3];
        }
  
        product.images = images;
      }
  
      await product.save();
  
      res.json({ success: true, message: 'Product updated successfully' });
    } catch (error) {
      console.error('Error updating product:', error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  };
  

  const showProductDetailPage = async (req, res) => {
    try {
      const productId = req.params.id;
  
      const product = await Product.findById(productId).populate('offers');
      console.log(product);
      
      
      if (!product) {
          return res.status(404).send('Product not found');
      }
      

      const relatedProducts = await Product.find({ category: product.category }).populate('offers'); 
      
      console.log('Related Products:', relatedProducts); 

      res.render('shopping', { product, relatedProducts });
  } catch (error) {
      console.error(error);
      res.status(500).send('Server error');
  }
    
  };
      
  
 
  const deleteProduct = async (req, res) => {
    const productId = req.params.id;
  try {
    await Product.findByIdAndDelete(productId);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ success: false, message: 'Failed to delete product' });
  }
  };
  
  module.exports = {
    productInfo,
    showAddProductPage,
    addProduct,
    showEditProductPage,
    editProduct,
    showProductDetailPage,
    deleteProduct
  };

