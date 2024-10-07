const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
    offerType: {
        type: String,
        enum: ['Product', 'Brand'],
        required: true
    },
    entity: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'offerType' 
    },
    discount: {
        type: Number,
        required: true
    },
    validFrom: {
        type: Date,
        required: true
    },
    validTo: {
        type: Date,
        required: true
    },
    isBlocked: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model('Offer', offerSchema);
