const mongoose = require('mongoose');
const {Schema} = mongoose;
const {v4:uuidv4} = require('uuid');
const product = require('./productSchema');

const orderSchema = new Schema({
    userId:{
        type:Schema.Types.ObjectId,
        ref:"User",
    },
    orderId:{
        type:String,
        default:()=> uuidv4(),
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
        enum:["Pending","Processing","Shipped","Delivered","Cancelled","Returned"],
        default: "Pending"
    },
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
    }


})

const Order = mongoose.model('order',orderSchema);

module.exports = Order;