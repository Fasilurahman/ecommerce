const mongoose = require('mongoose');
const {Schema} = mongoose;

const categorySchema = new Schema({
    name:{
        type:String,
        required:true,
        
    },
    description:{
        type:String,
        required:true
    },
    islisted:{
        type:Boolean,
        default:true
    },
    categoryoffer:{
        type:Number,
        default:0
    },
    createdAt:{
        type:Date,
        default:Date.now
    },
    isBlocked: { 
        type: Boolean,
        default: false
    }
})

const category = mongoose.model('category',categorySchema);

module.exports = category;