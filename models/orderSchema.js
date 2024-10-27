const mongoose = require('mongoose');
const {Schema} = mongoose;
const {v4:uuidv4} = require('uuid');
const product = require('./productSchema');

const generateShortId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

const orderSchema = new Schema({
    userId:{
        type:Schema.Types.ObjectId,
        ref:"User",
    },
    orderId: {
        type: String,
        default: generateShortId, // Use the short ID generator function
    },
    ordereditems:[{
        productId:{
            type:Schema.Types.ObjectId,
            ref:"Product",
        },
        quantity:{
            type:Number,
        },
        price:{
            type:Number,
        },
        isCancelled: { 
            type: Boolean,
            default: false
        },
        variantId:{
            type:Schema.Types.ObjectId,
            ref:"Variant"
        }
    }],
    totalPrice:{
        type:Number,
    },
    discount:{
        type:Number,
        default:0
    },
    finalPrice:{
        type:Number,
    },
    address: {
        name: String,
        state: String,
        landMark: String,
        city: String,
        pincode: Number,
        phone: String
    },
    invoice:{
        type:Date,
        default: Date.now
    },
    status:{
        type:String,
        enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled", "Returned", "Failed"],
        default: "Pending"
    },
    paymentStatus: { 
        type: String, 
        enum: ['pending', 'failed', 'success', 'paid'], // Add 'pending' as a valid option
        default: 'pending'
      },
    razorpayOrderId: { type: String }, // Save Razorpay order ID
    createdOn:{
        type:Date,
        default:Date.now
    },
    couponApplied:{
        type:Boolean,
        default:false
    },
    paymentMethod: {
        type: String,
        enum: ["razorpay", "cod" , "wallet"],
        required: true,
    },
    returnRequest: {
        requested: { type: Boolean, default: false },
        reason: { type: String, default: '' },
        approved: { type: Boolean, default: false }
    },


})

const Order = mongoose.model('order',orderSchema);

module.exports = Order;