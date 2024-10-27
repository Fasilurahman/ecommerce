const User = require('../../models/userSchema');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');


const pageerror = async (req,res)=>{
    res.render('page-404')
}

const loadadminLogin = async (req,res)=>{
    try {
        return res.render('adminlogin');
    } catch (error) {
        console.log('login error');
    }
}

const adminLogin = async (req, res) => {
    console.log('Entering admin login');
    
    try {
        const { email, password } = req.body;
        const admin = await User.findOne({ email, isAdmin: true });

        if (!admin) {
            return res.render("login", { message: "Admin not found" });
        }

        const passwordMatch = await bcrypt.compare(password, admin.password);
        if (!passwordMatch) {
            return res.render("adminlogin", { message: "Incorrect password" });
        }

        req.session.admin = true; // Set session for admin
        return res.redirect('/admin/dashboard'); // Redirect to admin dashboard
    } catch (error) {
        console.log("Login error:", error);
        return res.redirect('/pageerror');
    }
};


const loadDashboard = async (req,res)=>{
        try {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
            const topProducts = await exports.getTopProducts();
            
            const topCategories = await exports.getTopCategories();
            const topBrands = await exports.getTopBrands();
            const salesTrend = await exports.getMonthlySales(); // Make sure this is defined above
    
            // Prepare data for charts
            const productNames = topProducts.map(p => p.name);
            const productSales = topProducts.map(p => p.totalSold);
    
            const categoryNames = topCategories.map(c => c.name);
            const categorySales = topCategories.map(c => c.totalSold);
    
            const brandNames = topBrands.map(b => b.name);
            const brandSales = topBrands.map(b => b.totalSold);
    
            const earningsLabels = productNames;
            const earningsData = topProducts.map(p => p.totalSold * p.price);
    
            const earningsDates = months;
    
            const salesTrendLabels = months;
            const salesTrendData = Array(12).fill(0);
    
            salesTrend.forEach(sale => {
                const monthIndex = sale._id - 1;
                salesTrendData[monthIndex] = sale.totalSales;
            });
            const salesReport= await Order.find()
            
    
            res.render('dashboard', {
                topProducts,
                topCategories,
                topBrands,
                productNames,
                productSales,
                categoryNames,
                categorySales,
                brandNames,
                brandSales,
                earningsLabels,
                earningsData,
                earningsDates,
                salesTrendLabels,
                salesTrendData,
                salesReport
            });
        } catch (error) {
            res.status(500).send('Internal Server Error: ' + error.message);
        }
    };


const logout = async (req, res) => {
    
    try {
        console.log('before',req.session);
        
        req.session.destroy(err => {
            if (err) {
                console.log("Error destroying session:", err);
                return res.redirect('/pageerror');
            }
            res.clearCookie('admin');
            res.redirect('/admin/login');
        });
        console.log('after',req.session);


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