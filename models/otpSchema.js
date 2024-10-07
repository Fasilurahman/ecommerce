let mongoose=require('mongoose')
const schema=mongoose.Schema;
let userOtpVerification=new schema({
    otp:{
      type:String,
      required:true
    },
    email:{
        type:String,
        required:true
    },
    createdAt:{
        type:Date,
        default:Date.now(),
        
    },
    expireAt:{
        type:Date,
        required:true
    }
})

module.exports=mongoose.model('otp',userOtpVerification)