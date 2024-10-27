const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const Brand = require('../../models/brandSchema');


// Get top-selling products
exports.getTopProducts = async () => {
    
    try {
        const topProducts = await Order.aggregate([
            { $unwind: "$ordereditems" },
            { $group: { _id: "$ordereditems.productId", totalSold: { $sum: "$ordereditems.quantity" } } },
            { $sort: { totalSold: -1 } },
            { $limit: 10 },
            { $lookup: { from: "products", localField: "_id", foreignField: "_id", as: "product" } },
            { $unwind: "$product" },
            { $project: { _id: 0, name: "$product.name", totalSold: 1, price: "$product.price" } } // Added price
        ]);

        return topProducts;
    } catch (error) {
        throw new Error('Error fetching top products: ' + error.message);
    }
};

// Get top-selling categories
exports.getTopCategories = async () => {
    try {
        const topCategories = await Order.aggregate([
            { $unwind: "$ordereditems" },
            { $lookup: { from: "products", localField: "ordereditems.productId", foreignField: "_id", as: "product" } },
            { $unwind: "$product" },
            { $group: { _id: "$product.category", totalSold: { $sum: "$ordereditems.quantity" } } },
            { $sort: { totalSold: -1 } },
            { $limit: 10 },
            { $lookup: { from: "categories", localField: "_id", foreignField: "_id", as: "category" } },
            { $unwind: "$category" },
            { $project: { _id: 0, name: "$category.name", totalSold: 1 } }
        ]);
        return topCategories;
    } catch (error) {
        throw new Error('Error fetching top categories: ' + error.message);
    }
};

// Get top-selling brands
exports.getTopBrands = async () => {
    try {
        const topBrands = await Order.aggregate([
            { $unwind: "$ordereditems" },
            { $lookup: { from: "products", localField: "ordereditems.productId", foreignField: "_id", as: "product" } },
            { $unwind: "$product" },
            { $group: { _id: "$product.brand", totalSold: { $sum: "$ordereditems.quantity" } } },
            { $sort: { totalSold: -1 } },
            { $limit: 10 },
            { $lookup: { from: "brands", localField: "_id", foreignField: "_id", as: "brand" } },
            { $unwind: "$brand" },
            { $project: { _id: 0, name: "$brand.brandName", totalSold: 1 } } // Correcting the name field reference
        ]);
        return topBrands;
    } catch (error) {
        throw new Error('Error fetching top brands: ' + error.message);
    }
};

// Make sure to define this function in the same file or import it correctly if it's in another file
exports.getMonthlySales = async () => {
    
    try {
        const salesData = await Order.aggregate([
            {
                $group: {
                    _id: { $month: "$orderDate" }, // Group by month
                    totalSales: { $sum: "$totalAmount" } // Sum total sales
                }
            },
            { $sort: { _id: 1 } } // Sort by month
        ]);
        

        return salesData;
    } catch (error) {
        throw new Error('Error fetching sales trend: ' + error.message);
    }
};

exports.getSalesData = async (req, res) => {
    const filter = req.query.filter;
    let groupBy;
    
    // Determine how to group data based on the filter
    switch (filter) {
        case 'daily':
            groupBy = { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } };
            break;
        case 'weekly':
            groupBy = { $isoWeek: "$orderDate" }; // Using ISO week format
            break;
        case 'monthly':
            groupBy = { $dateToString: { format: "%Y-%m", date: "$orderDate" } };
            break;
        case 'yearly':
            groupBy = { $dateToString: { format: "%Y", date: "$orderDate" } };
            break;
        default:
            return res.status(400).json({ error: 'Invalid filter' });
    }

    try {
        const salesData = await Order.aggregate([
            {
                $group: {
                    _id: groupBy,
                    totalSales: { $sum: "$totalAmount" }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        if (!salesData.length) {
            console.log("No sales data found for the specified filter.");
        }

        const dates = salesData.map(item => item._id);
        const data = salesData.map(item => item.totalSales);

        return res.json({ dates, data });
    } catch (error) {
        console.error('Error during aggregation:', error);
        return res.status(500).json({ error: 'Error fetching sales data: ' + error.message });
    }
};


// The existing renderDashboard function
exports.renderDashboard = async (req, res) => {

    
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
