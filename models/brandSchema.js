// models/brandSchema.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const brandSchema = new Schema({
  brandName: {
    type: String,
    required: true,
  },
  is_Blocked: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  description:{
    type:String,
    required:false
  },
  offers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Offer' 
  }]
});

const Brand = mongoose.model('Brand', brandSchema);

module.exports = Brand;
