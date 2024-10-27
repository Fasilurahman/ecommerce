const mongoose = require('mongoose');
const variantSchema = require('./variantSchema'); 

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  variants: [variantSchema], 
  description:{
    type:String,
    required:false
  },
  status: { type: String, enum: ['active', 'blocked'], default: 'active' },
  images: {
    type: [String],
    required: true
  },
  category: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'category' 
  },
  brand: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Brand' 
  },
  price: {  
    type: Number,
    required: true
  },
  offers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Offer' 
  }]
});

const Product = mongoose.model('Product', productSchema);
module.exports = Product;
