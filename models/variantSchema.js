const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema({
  
  quantity: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  stock: {
    type: Number,
    required: true
  }
});

module.exports = variantSchema; 
