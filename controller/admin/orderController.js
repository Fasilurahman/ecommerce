const Order = require('../../models/orderSchema');
const Wallet = require('../../models/walletSchema');

const orderDetails = async (req, res) => {
    try {
        // Fetch orders with populated fields
        const orders = await Order.find({})
            .populate('userId', 'name email')
            .populate('ordereditems.productId', 'name')
            .populate('address')
            .lean();
        
        // Render the orders page with fetched orders
        res.render('order', { orders });
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
        const order = await Order.findById(orderId);

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
                        variant.stock += item.quantity;
                    } else {
                        product.stock += item.quantity;
                    }
                    await product.save();
                }
            }

            // Refund the amount to user's wallet
            const wallet = await Wallet.findOne({ userId: order.userId });

            if (wallet) {
                const refundAmount = order.finalPrice; // Refund full amount

                wallet.balance += refundAmount;

                wallet.transactions.push({
                    amount: refundAmount,
                    type: 'credit',
                    description: `Refund for cancelled order ${order._id}`,
                    orderId: order._id,
                    date: new Date()
                });

                await wallet.save();
            }

            console.log('Order cancelled and refund processed');
        } else {
            // If the status is anything other than "Cancelled", just update the order status
            order.status = newStatus;
            await order.save();
            console.log('Order status updated successfully');
        }
        // res.json({ success: true });
        res.redirect('/admin/order');
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).send('Server Error');
    }
};

module.exports = { orderDetails, updateOrderStatus };


