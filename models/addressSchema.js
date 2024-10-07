const mongoose = require('mongoose');
const {Schema} = mongoose;

const addressSChema = new Schema({
    userId:{
        type:Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    address:[{
        // _id: {
        //     type: mongoose.Schema.Types.ObjectId, // Ensure _id is of type ObjectId
        //     auto: true
        //   },
        name:{
            type:String,
            required:true
        },
        state:{
            type:String,
            required:true
        },
        landMark:{
            type:String,
            required:true
        },
        city:{
            type:String,
            required:true
        },
        pincode:{
            type:Number,
            required:true
        },
        phone:{
            type:String,
            required:true
        }
    }]
})

const Address = mongoose.model('Address',addressSChema);

module.exports = Address