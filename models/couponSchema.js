const mongoose = require('mongoose');
const { Schema } = mongoose;

const couponSchema = new Schema({
    code: {
        type: String,
        required: true,
        unique: true
    },
    discountType: {
        type: String,
        enum: ['percentage', 'fixed'],
        required: true
    },
    discountValue: {
        type: Number,
        required: true
    },
    expiryDate: {
        type: Date,
        required: true
    },
    minOrderAmount: {
        type: Number,
        required: true
    },
    maxOrderAmount: {
        type: Number,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    createdOn: {
        type: Date,
        default: Date.now
    },
    isActive: {
        type: Boolean,
        default: true
    },
    userId: [{
        type: Schema.Types.ObjectId,
        ref: "User"
    }]
});

const Coupon = mongoose.model('coupon', couponSchema);

module.exports = Coupon;
