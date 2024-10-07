const User = require('../../models/userSchema');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');


const pageerror = async (req,res)=>{
    res.render('page-404')
}

const loadadminLogin = async (req,res)=>{
    try {
        return res.render('login');
    } catch (error) {
        console.log('login error');
    }
}

const adminLogin = async (req,res)=>{
    try {
        const {email,password} = req.body;
        console.log(email,password,"hgjfgjgfhdgfg")
        const admin = await User.findOne({email,isAdmin:true});
        if(admin){
            const passwordMatch = await bcrypt.compare(password, admin.password);
            if(passwordMatch){
                req.session.admin = true;
                return res.redirect('/admin');
            }else{
                return res.redirect('/login');
            }
        }else{
            return res.redirect('/login');
        }
    } catch (error) {
        console.log("login error",error);
        return redirect('/pageerror'); 
    }
}

const loadDashboard = async (req,res)=>{
     if(req.session.admin){
        try {
            res.render('dashboard')
        } catch (error) {
            res.redirect('/pageerror');
        }
     }
}

const logout = async (req, res) => {
    try {
        req.session.destroy(err => {
            if (err) {
                console.log("Error destroying session:", err);
                return res.redirect('/pageerror');
            }
            res.redirect('/login');
        });
    } catch (error) {
        console.log("Unexpected error during logout:", error);
        res.redirect('/pageerror');
    }
};
module.exports = {
    adminLogin,
    loadadminLogin,
    loadDashboard,
    pageerror,
    logout
}