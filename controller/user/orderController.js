const Product = require('../../models/productSchema');
const Order = require('../../models/orderSchema');
const Offer = require('../../models/offerSchema')
const User = require('../../models/userSchema');
const Address = require('../../models/addressSchema'); 
const Cart = require('../../models/cartSchema');
const Wallet = require('../../models/walletSchema');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const Razorpay = require('razorpay');


const registerUser = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const referralCode = generateReferralCode(); 
        const newUser = new User({
            username,
            email,
            password: await bcrypt.hash(password, 10),
            referralCode, 
        });

        await newUser.save();
        res.status(201).json({ message: 'User registered successfully', user: newUser });
    } catch (error) {
        res.status(400).json({ message: 'Error registering user', error });
    }
};

const razorpay = new Razorpay({
    key_id: 'YOUR_RAZORPAY_KEY_ID',
    key_secret: 'YOUR_RAZORPAY_SECRET'
});


const updateProfile = async (req, res) => {
    try {

        if (!req.cookies.user) {
            return res.status(401).send('Unauthorized: No user logged in');
        }

        const user = await User.findById(req.cookies.user); 
        if (!user) {
            return res.status(404).send('User not found');
        }

    
        user.username = req.body.username || user.username; 
        user.email = req.body.email || user.email; 
        user.phone = req.body.phone || user.phone; 

        if (req.file) {
            user.profilePicture = req.file.path; 
        }

        await user.save();

        res.redirect('/profile'); 
    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).send('Error updating user profile');
    }
};






const loadUserAddresses = async (req, res) => {
    try {
        const user = await User.findOne({ _id: req.cookies.user });
        const addresses = await Address.find({ userId: user._id });
        
        res.render('address', { addresses, user });
    } catch (error) {
        console.error('Error loading user addresses:', error);
        res.status(500).send('Error loading user addresses');
    }
}



const addaddress = async (req, res) => {
    try {
        const { name, landMark, city, state, pincode, phone} = req.body;
        
        const user = await User.findById(req.cookies.user);
       
        const newAddress = new Address({
          userId: user._id,
          address: [{
            name: name,
            landMark: landMark,
            city: city,
            state: state,
            pincode: pincode,
            phone: phone
          }]
        });
    
        
        await newAddress.save();
        return res.redirect('/addresses');
        
      } catch (error) {
        console.error("Error adding address:", error);
        res.status(500).send("Server error");
      }
}

const editaddress = async (req, res) => {
    try {
        const addressId = req.params.id;
        const { name, landmark, city, state, zip, phone } = req.body;

        if (!name || !landmark || !city || !state || !zip || !phone) {
            return res.status(400).send("All required fields must be provided.");
        }

        const phonePattern = /^\d{10}$/;
        const zipPattern = /^\d{5}$/;

        if (!phonePattern.test(phone)) {
            return res.status(400).send("Phone number must be exactly 10 digits.");
        }

        if (!zipPattern.test(zip)) {
            return res.status(400).send("Zip code must be exactly 5 digits.");
        }

        const findaddress = await Address.findOne({ 'address._id': addressId });

        if (!findaddress) {
            return res.status(404).send("Address not found.");
        }

        const addr = findaddress.address.id(addressId);

        if (!addr) {
            return res.status(404).send("Address not found in document.");
        }

        // Update the address details
        addr.name = name;
        addr.city = city;
        addr.state = state;
        addr.pincode = zip;
        addr.landMark = landmark;
        addr.phone = phone;

        await findaddress.save();

        return res.redirect('/profile');
    } catch (error) {
        console.error("Error editing address:", error);
        res.status(500).send("Server error");
    }
};

const deleteaddress = async (req, res) => {
    try {
        const addressId = req.params.addressId;
    
        const result = await Address.deleteOne(
            { 'address._id': addressId },
            { $pull: { address: { _id: addressId } } }
        );
        
        
        if (result.modifiedCount === 0) {
          return res.status(404).send("Address not found");
        } 
    
        return res.redirect('/addresses');
      } catch (error) {
        console.error("Error deleting address:", error);
        res.status(500).send("Server error");
      }
    }


    const getAddressData = async (req, res) => {
        try {
            const addressId = req.params.id;
            const address = await Address.findOne({ 'address._id': addressId });
            const users = await User.findById(req.cookies.user);
            
            if (!address) {
                return res.status(404).send('Address not found');
            }
            const addressData = address.address.id(addressId);
            res.render('edit-address', { address: addressData, user: req.user,users  }); 
        } catch (error) {
            console.error('Error fetching address:', error);
            res.status(500).send('Server error');
        }
    };
    
    

    const loadUserOrders = async (req, res) => {
        try {
            const userId = req.cookies.user;
            const user = await User.findOne({ _id: userId });
    
            if (!user) {
                return res.status(404).send('User not found');
            }
    
            const page = parseInt(req.query.page) || 1; 
            const limit = 3; 
            const skip = (page - 1) * limit; 
    
            const totalOrders = await Order.countDocuments({ userId: user._id });
    
            const orders = await Order.find({ userId: user._id })
                .populate('address')
                .sort({ createdOn: -1 })
                .skip(skip)
                .limit(limit);
    
            const totalPages = Math.ceil(totalOrders / limit);
    
            const cart = await Cart.find({ userId: user._id }).populate('items.productId');
    
            res.render('orders', {
                orders,
                cart,
                currentPage: page,
                totalPages,
            });
        } catch (error) {
            console.error('Error loading user orders:', error);
            res.status(500).send('Error loading user orders');
        }
    };
    



    const UserOrders = async (req, res) => {
        try {
            const userId = req.cookies.user;
            const orderId = req.params.orderId;
    
            if (!userId) {
                return res.status(401).send("Unauthorized");
            }
    
            const user = await User.findById(userId);
    
            const order = await Order.findById(orderId)
                .populate('address')
                .populate('ordereditems.productId');
    
            if (!order) {
                return res.status(404).send("No orders found");
            }
    
            const activeItems = order.ordereditems.filter(item => !item.isCancelled);
            const updatedTotal = activeItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
            
    
            res.render('ordersview', { order, user, updatedTotal, query: req.query });
        } catch (error) {
            console.error("Error fetching orders:", error);
            res.status(500).send("Server error");
        }
    };


const PDFDocument = require('pdfkit');

const generateInvoicePDF = async (order) => {
    const doc = new PDFDocument({ margin: 50 });
    let buffers = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        return pdfData;
    });

    const shippingFee = order.shippingFee || 0;
    const taxAmount = order.taxAmount || 0;
    const discountAmount = order.discountAmount || 0;

    doc.image('public/assets/images/icons/1.png', 50, 45, { width: 50 })
        .fontSize(20)
        .text('Essence of Heaven', 110, 50)
        .fontSize(10)
        .text('Company Address', 110, 70)
        .text('City, State, ZIP', 110, 85)
        .text('Phone: (123) 456-7890', 110, 100)
        .moveDown();

    doc.fontSize(25)
        .fillColor('#0000ff')
        .text('Invoice', { align: 'center' })
        .moveDown(1.5);

    doc.fontSize(14).fillColor('black');
    const orderDate = new Date(order.createdOn).toLocaleDateString();
    doc.text(`Order ID: ${order.orderId}`, { align: 'left' });
    doc.text(`Order Date: ${orderDate}`, { align: 'left' });
    doc.text(`Order Status: ${order.status}`, { align: 'left' });
    doc.moveDown();

    doc.fontSize(12).fillColor('black');
    doc.text('Bill To:', { align: 'left', underline: true });
    doc.text(`${order.address.name}`, { align: 'left' });
    doc.text(`${order.address.state}, ${order.address.city}`, { align: 'left' });
    doc.text(`${order.address.landMark}, ${order.address.pincode}`, { align: 'left' });
    doc.text(`${order.address.city}`, { align: 'left' });
    doc.moveDown();

    doc.text('Ship To:', { align: 'left', underline: true });
    doc.text(`Fasilu`, { align: 'left' });
    doc.text(`Calicut, ${order.address.city}`, { align: 'left' });
    doc.text(`Kerala, ${order.address.zip}`, { align: 'left' });
    doc.text(``, { align: 'left' });
    doc.moveDown();

    const tableTop = doc.y + 10;
    const tableX = 50;
    const tableWidths = [200, 70, 80, 80, 100];

    doc.rect(tableX, tableTop, tableWidths[0], 25).fillAndStroke('#f2f2f2', '#000');
    doc.text('Essence of Heaven', tableX + 5, tableTop + 8);

    doc.rect(tableX + tableWidths[0], tableTop, tableWidths[1], 25).fillAndStroke('#f2f2f2', '#000');
    doc.text('SKU', tableX + tableWidths[0] + 5, tableTop + 8);

    doc.rect(tableX + tableWidths[0] + tableWidths[1], tableTop, tableWidths[2], 25).fillAndStroke('#f2f2f2', '#000');
    doc.text('Quantity', tableX + tableWidths[0] + tableWidths[1] + 5, tableTop + 8);

    doc.rect(tableX + tableWidths[0] + tableWidths[1] + tableWidths[2], tableTop, tableWidths[3], 25).fillAndStroke('#f2f2f2', '#000');
    doc.text('Price', tableX + tableWidths[0] + tableWidths[1] + tableWidths[2] + 5, tableTop + 8);

    doc.rect(tableX + tableWidths[0] + tableWidths[1] + tableWidths[2] + tableWidths[3], tableTop, tableWidths[4], 25).fillAndStroke('#f2f2f2', '#000');
    doc.text('Total', tableX + tableWidths[0] + tableWidths[1] + tableWidths[2] + tableWidths[3] + 5, tableTop + 8);

    let currentY = tableTop + 30;
    order.ordereditems.forEach((item, index) => {
        if (item.productId) {
            const totalPrice = (item.price * item.quantity).toFixed(2);
            const productSKU = item.productId.sku || 'N/A';

            if (index % 2 === 0) {
                doc.rect(tableX, currentY, tableWidths.reduce((a, b) => a + b, 0), 25).fill('#f0f0f0').stroke();
            } else {
                doc.rect(tableX, currentY, tableWidths.reduce((a, b) => a + b, 0), 25).stroke();
            }

            doc.fillColor('black')
                .text(item.productId.name, tableX + 5, currentY + 8)
                .text(productSKU, tableX + tableWidths[0] + 5, currentY + 8)
                .text(item.quantity, tableX + tableWidths[0] + tableWidths[1] + 5, currentY + 8)
                .text(`₹${item.price.toFixed(2)}`, tableX + tableWidths[0] + tableWidths[1] + tableWidths[2] + 5, currentY + 8)
                .text(`₹${totalPrice}`, tableX + tableWidths[0] + tableWidths[1] + tableWidths[2] + tableWidths[3] + 5, currentY + 8);

            currentY += 30;
        }
    });

    currentY += 30;
    doc.fontSize(12).fillColor('black');
    doc.text(`Shipping Fee: ₹${shippingFee.toFixed(2)}`, { align: 'right' });
    doc.text(`Tax: ₹${taxAmount.toFixed(2)}`, { align: 'right' });
    doc.text(`Discount: ₹${discountAmount.toFixed(2)}`, { align: 'right' });
    doc.moveDown();

    doc.fontSize(16).fillColor('#ff0000')
        .text(`Total Amount: ₹${order.finalPrice.toFixed(2)}`, { align: 'right', underline: true });

    doc.fontSize(10).fillColor('gray')
        .text('Thank you for shopping with us!', 50, doc.page.height - 50, { align: 'center' });

    doc.end();

    return new Promise((resolve, reject) => {
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err) => reject(err));
    });
};



const downloadInvoice = async (req, res) => {
    const orderId = req.params.orderId;

    try {
        const order = await Order.findById(orderId).populate('ordereditems.productId');

        if (!order) {
            return res.status(404).send('Order not found');
        }

        const pdfData = await generateInvoicePDF(order);

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="invoice-${orderId}.pdf"`,
        });

        res.send(pdfData);
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).send('Error generating invoice');
    }
};


const cancelOrder = async (req, res) => {
    try {
        const orderId = req.params.orderId;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).send("Invalid order ID format");
        }

        const order = await Order.findById(orderId).populate('ordereditems.productId');

        if (!order) {
            return res.status(404).send("Order not found");
        }

        if (order.status === 'Cancelled' || order.status === 'Returned') {
            return res.status(400).send("Order is already cancelled or returned.");
        }

        const hasCancelledItems = order.ordereditems.some(item => item.isCancelled);

        let totalRefund = (!hasCancelledItems || order.couponApplied) ? order.finalPrice : 0;

        for (const item of order.ordereditems) {
            if (item.isCancelled) continue;

            item.isCancelled = true;

            if (!order.couponApplied && hasCancelledItems) {
                let itemRefund = item.price * item.quantity;

                if (item.discount) {
                    itemRefund -= (itemRefund * item.discount) / 100;
                }

                totalRefund += itemRefund;
            }

            const product = await Product.findById(item.productId);
            if (product) {
                if (item.variantId) {
                    const variant = product.variants.id(item.variantId);
                    if (variant) {
                        variant.stock += item.quantity;
                    }
                } else {
                    product.stock += item.quantity;
                }
                await product.save();
            }
        }

        order.status = 'Cancelled';

        await order.save();

        if ((order.paymentStatus === 'success' || order.paymentStatus === 'paid') && totalRefund > 0) {
            const wallet = await Wallet.findOne({ userId: order.userId });

            if (wallet) {
                wallet.balance += totalRefund;

                wallet.transactions.push({
                    amount: totalRefund,
                    type: 'credit',
                    description: `Refund for cancelled order ${order._id}`,
                    orderId: order._id,
                    date: new Date()
                });

                await wallet.save();
            } else {
                console.error(`Wallet not found for user ${order.userId}`);
            }
        }

        res.redirect('/orders');
    } catch (error) {
        console.error("Error cancelling order:", error);
        res.status(500).send("Server error");
    }
};


const cancelItem = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const productId = req.params.productId;

        console.log(orderId, 'order ID');
        console.log(productId, 'product ID');

        if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).send("Invalid order or product ID format");
        }

        const order = await Order.findById(orderId);
        console.log(order, 'order');

        if (!order) return res.status(404).send("Order not found");

        const itemIndex = order.ordereditems.findIndex(item => 
            item.productId.toString() === productId && !item.isCancelled
        );

        console.log(itemIndex, 'item index');
        if (itemIndex === -1) {
            return res.status(400).send("Item not found or already canceled.");
        }

        const item = order.ordereditems[itemIndex];
        const product = await Product.findById(item.productId);

        if (product) {
            if (item.variantId) {
                const variant = product.variants.id(item.variantId);
                if (variant) variant.stock += item.quantity;
            } else {
                product.stock += item.quantity;
            }
            await product.save();
        } else {
            console.error(`Product with ID ${item.productId} not found.`);
            return res.status(404).send("Product not found.");
        }

        let priceToReturn = item.price * item.quantity;

        if (item.discount) {
            priceToReturn -= (priceToReturn * item.discount) / 100;
        }

        if (order.couponApplied) {
            const couponDiscount = order.couponDiscount || 0;
            priceToReturn -= (priceToReturn * couponDiscount) / 100;
        }

        const activeOffers = await Offer.find({ entity: product._id, isBlocked: false });
        if (activeOffers.length > 0) {
            activeOffers.forEach(offer => {
                const offerDiscount = offer.discount || 0;
                priceToReturn -= (priceToReturn * offerDiscount) / 100;
            });
        }

        order.ordereditems[itemIndex].isCancelled = true;
        await order.save();

        if (order.paymentStatus === 'success' || order.paymentStatus === 'paid') {
            const user = await User.findById(order.userId);

            if (user) {
                user.wallet += priceToReturn;

                const wallet = await Wallet.findOne({ userId: user._id });
                if (wallet) {
                    wallet.balance += priceToReturn;
                    wallet.transactions.push({
                        amount: priceToReturn,
                        type: 'credit',
                        description: `Refund for cancelled item from order ${orderId}`,
                        orderId: orderId,
                        date: new Date(),
                    });
                    await wallet.save();
                } else {
                    console.error(`Wallet not found for user ${user._id}`);
                }
                await user.save();
            } else {
                console.error(`User with ID ${order.userId} not found`);
                return res.status(404).send("User not found.");
            }
        }

        const allItemsCancelled = order.ordereditems.every(item => item.isCancelled);

        if (allItemsCancelled) {
            order.status = 'Cancelled';
            await order.save();
            console.log(`Order ${orderId} has been fully cancelled as all items are cancelled.`);
        }

        res.redirect(`/orders/${orderId}`);
    } catch (error) {
        console.error("Error cancelling item:", error);
        res.status(500).send("Server error");
    }
};


const loadchangepassword = async (req, res) => {
    try {
        const userId = req.cookies.user; 
        
        if (!userId) {
            console.log('No User ID found in cookies');
            return res.redirect('/login');
        }

 
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).send('User not found');
        }
        res.render('changePassword', { user: user });
    } catch (error) {
        console.error('Error loading change password page:', error);
        res.status(500).send('Error loading change password page');
    }
};

const changepassword = async (req, res) => {
    try {
        const { email, currentPassword, newPassword, confirmPassword } = req.body;
        

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ success: false, message: "Passwords do not match" });
        }

        const user = await User.findOne({ email: email });
        console.log(user,'useraaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa user');
        
        
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        
        
        
        if (!isMatch) {
            console.log(isMatch)
            return res.status(401).json({ success: false, message: "Current password is incorrect" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        req.session.passwordChanged = true;
        res.json({ success: true, message: "Password changed successfully" });
    } catch (error) {
        console.error("Error changing password:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};


module.exports = {
     updateProfile, 
     loadUserAddresses, 
     loadUserOrders,
     UserOrders,
     loadchangepassword,
     changepassword,
     addaddress,
     editaddress,
     deleteaddress,
     getAddressData,
     cancelOrder,
     cancelItem,
     downloadInvoice,
     registerUser

}