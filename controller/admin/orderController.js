const Order = require('../../models/orderSchema');
const Wallet = require('../../models/walletSchema');
const Product = require('../../models/productSchema');

const orderDetails = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // Default to page 1
        const limit = parseInt(req.query.limit) || 3; // Default to 10 items per page
        const skip = (page - 1) * limit; // Calculate items to skip for pagination

        // Fetch total number of orders for pagination calculation
        const totalOrders = await Order.countDocuments();
        const totalPages = Math.ceil(totalOrders / limit); // Calculate total number of pages

        // Fetch orders for the current page
        const orders = await Order.find({})
            .populate('userId', 'name email')
            .populate('ordereditems.productId', 'name')
            .populate('address')
            .sort({ createdOn: -1 }) // Sort by latest
            .skip(skip)
            .limit(limit)
            .lean();

        // Debugging: log important values to check if pagination works
        console.log({ page, limit, totalOrders, totalPages, skip });

        // Render the orders page with the pagination data
        res.render('order', { 
            orders, 
            currentPage: page, 
            totalPages,
            query: req.query // Pass the query for URL limit handling
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).send('Server Error');
    }
};





// Function to update order status
const updateOrderStatus = async (req, res) => {
    const orderId = req.params.orderId;
    const newStatus = req.body.status;

    try {
        // Fetch the order by ID
        const order = await Order.findById(orderId).populate('ordereditems.productId');

        if (!order) {
            return res.status(404).send('Order not found');
        }

        // Prevent admin from updating if the user has already cancelled
        if (order.status === 'Cancelled') {
            return res.status(400).send('Cannot update a cancelled order');
        }

        // If admin cancels the order, initiate a refund
        if (newStatus === 'Cancelled') {
            order.status = 'Cancelled';
            await order.save();

            // Restore product stock
            for (const item of order.ordereditems) {
                const product = await Product.findById(item.productId);
                if (product) {
                    const variant = product.variants.id(item.variantId);
                    if (variant) {
                        variant.stock += item.quantity; // Increment variant stock
                    } else {
                        product.stock += item.quantity; // Increment general product stock
                    }
                    await product.save();
                } else {
                    console.error(`Product not found for ID: ${item.productId}`);
                }
            }

            // Refund the amount to user's wallet
            const wallet = await Wallet.findOne({ userId: order.userId });

            if (wallet) {
                const refundAmount = order.finalPrice; // Refund full amount

                wallet.balance += refundAmount; // Increment wallet balance

                // Push transaction details
                wallet.transactions.push({
                    amount: refundAmount,
                    type: 'credit',
                    description: `Refund for cancelled order ${order._id}`,
                    orderId: order._id,
                    date: new Date()
                });

                await wallet.save(); 
            } else {
                console.error(`No wallet found for user: ${order.userId}`);
                // Handle this case, e.g., create a new wallet or notify the user/admin
            }
        } else {
            // If the status is anything other than "Cancelled", just update the order status
            order.status = newStatus; // Update order status
            await order.save(); // Save changes to the order
        }

        res.redirect('/admin/order'); // Redirect to the order page
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).send('Server Error'); // Send error response
    }
};

// Controller function to handle return request
const requestReturn = async (req, res) => {
    console.log('request to return');
    
    const orderId = req.params.orderId;
    const reason = req.body.reason;

    try {
        const order = await Order.findById(orderId);

        if (!order) {
            return res.redirect(`/orders/${orderId}?error=Order not found`);
        }

        // Check if a return request has already been made
        if (order.returnRequest.requested) {
            return res.redirect(`/orders/${orderId}?error=Return request already submitted`);
        }

        // Update the return request details
        order.returnRequest.requested = true;
        order.returnRequest.reason = reason;
        await order.save();

        // Redirect with a success message
        res.redirect(`/orders/${orderId}?success=Return request submitted successfully`);
    } catch (error) {
        console.error("Error requesting return:", error);
        res.redirect(`/orders/${orderId}?error=Server error`);
    }
};



const viewReturnRequests = async (req, res) => {
    try {
        // Fetch all orders with a return request
        const orders = await Order.find({ "returnRequest.requested": true });

        // Render the admin returnRequests view with the orders and query params
        res.render('returnRequests', { orders, query: req.query });
    } catch (error) {
        console.error("Error fetching return requests:", error);
        res.redirect('/admin/return-requests?error=Server error');
    }
};

// Approve return request function
const approveReturn = async (req, res) => {
    const orderId = req.params.orderId;

    try {
        const order = await Order.findById(orderId);
        if (!order) {
            return res.redirect('/admin/return-requests?error=Order not found');
        }

        // Approve the return request
        order.returnRequest.approved = true;
        order.status = 'Returned'; // Update order status to 'Returned'
        await order.save();

        // Calculate the refund amount using the final price instead of item prices
        let refundAmount = order.finalPrice; // Use final price for refund

        if (refundAmount > 0) {
            // Find the wallet of the user
            let wallet = await Wallet.findOne({ userId: order.userId });

            // Create a new wallet if it doesn't exist
            if (!wallet) {
                wallet = new Wallet({ userId: order.userId, balance: 0 });
            }

            // Update the wallet balance with the refund amount
            wallet.balance += refundAmount;

            // Record the transaction in the wallet's history
            wallet.transactions.push({
                amount: refundAmount,
                type: 'credit',
                description: `Refund for returned order ${order._id}`,
                orderId: order._id,
                date: new Date(),
            });

            await wallet.save();

            res.redirect('/admin/return-requests?success=Return request approved and refund processed');
        } else {
            console.log("No refund due as final price is zero.");
            res.redirect('/admin/return-requests?success=Return request approved but no refund due');
        }

    } catch (error) {
        console.error("Error approving return:", error);
        res.redirect('/admin/return-requests?error=Server error');
    }
};






// Reject return request function
const rejectReturn = async (req, res) => {
    const orderId = req.params.orderId;

    try {
        const order = await Order.findById(orderId);
        if (!order) {
            return res.redirect('/admin/return-requests?error=Order not found');
        }

        // Reject the return request
        order.returnRequest.approved = false; // Just keeping it as false
        await order.save();

        res.redirect('/admin/return-requests?success=Return request rejected');
    } catch (error) {
        console.error("Error rejecting return:", error);
        res.redirect('/admin/return-requests?error=Server error');
    }
};

const viewOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await Order.findById(orderId).populate('userId'); // Populate user details if needed
        if (!order) {
            return res.status(404).send('Order not found');
        }
        res.render('orderView', { order }); // Render the order view page
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
}




module.exports = { orderDetails, updateOrderStatus, requestReturn, approveReturn, rejectReturn, viewReturnRequests, viewOrder };


