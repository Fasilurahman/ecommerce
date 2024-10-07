const Product = require('../../models/productSchema');
const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Address = require('../../models/addressSchema'); 
const Cart = require('../../models/cartSchema');
const Wallet = require('../../models/walletSchema');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');


const loadUserProfile  = async (req, res) => {
    const user = await User.findOne({ _id: req.cookies.user });
    res.render('userProfile', { user });
}

const updateProfile = async (req, res) => {

    try {
        const { username, email, phone, password} = req.body;
        
        
        const user = await User.findById(req.session.user);
        
        
        if (!req.cookies.user) {
            return res.status(401).send('Unauthorized: No user logged in');
        }

        if (!user) {
            res.status(404).send('User not found');
            res.redirect('/login');
        }

       
        user.username = req.body.username;
        user.email = req.body.email;
        user.phone = req.body.phone;

        await user.save();

        res.redirect('/profile');
    } catch (error) {

        console.error('Error updating user profile:', error);
        res.status(500).send('Error updating user profile');
    }
};


const loadUserAddresses   = async (req, res) => {
    const user = await User.findOne({ _id: req.cookies.user });
    try {
        const addresses = await Address.find({ userId: user._id });
        res.render('address', { addresses });
    } catch (error) {
        console.error('Error loading user addresses:', error);
        // Handle error appropriately
        res.status(500).send('Error loading user addresses');
    }
}


const addaddress = async (req, res) => {
    try {
        const { name, landMark, city, state, pincode, phone} = req.body;
        
        const user = await User.findById(req.cookies.user);
        console.log('kkkkkkkkkkkkkkkkkkk',user);
        
        
       
       
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
        const { name, addressType, landMark, city, state, pincode, phone } = req.body;
        
        if (!name || !landMark || !city || !state || !pincode || !phone) {
            return res.status(400).send("All required fields must be provided.");
        }

        const findaddress = await Address.findOne({ 'address._id': addressId });

        if (!findaddress) {
            return res.status(404).send("Address not found");
        }

        const address = findaddress.address.id(addressId);

        if (!address) {
            return res.status(404).send("Address not found in document");
        }

        address.name = name;
        address.addressType = addressType; 
        address.landMark = landMark;
        address.city = city;
        address.state = state;
        address.pincode = pincode;
        address.phone = phone;

   
        await findaddress.save();

     
        return res.redirect('/profile');
    } catch (error) {
        console.error("Error editing address:", error);
        if (error.name === 'ValidationError') {
            return res.status(400).send("Validation error: " + error.message);
        }
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
        console.log(addressId,address,'111111111111111111111');
        
        if (!address) {
            return res.status(404).send('Address not found');
        }
        const addressData = address.address.id(addressId);
        res.json(addressData); 
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

        const orders = await Order.find({ userId: user._id })
            .populate('address')
            .sort({ createdOn: -1 });

        res.render('orders', {
            orders,
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
        
        const order = await Order.findById(orderId)
            .populate('address')
            .populate('ordereditems.productId');
       
        
        
        if (!order) {
            return res.status(404).send("No orders found");
        }

    
        res.render('ordersview', { order });
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).send("Server error");
    }
}

const cancelOrder = async (req, res) => {
    console.log('1');
    
    try {
        console.log('2');
        
        const orderId = req.params.orderId;
        
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).send("Invalid order ID format");
        }

        const order = await Order.findById(orderId);
        
        // Check if the order exists
        if (!order) {
            return res.status(404).send("Order not found");
        }


        if (order.status === 'Cancelled' || order.status === 'Returned') {
            return res.status(400).send("Order already cancelled");
        }

        // Update the order status to 'Cancelled'
        order.status = 'Cancelled';
        await order.save();

        // Increase the stock for each item in the order
        for (const item of order.ordereditems) {
            const product = await Product.findById(item.productId);
            console.log(item.productId,'ttttttttttttttttttttttttttttttt');
            

            if (product) {
                console.log('0');
                
                if (item.variantId) {

                    const variant = product.variants.id(item.variantId);
                    console.log('variant',variant,'variant');
                    
                    if (variant) {

                        variant.stock += item.quantity;
                        await product.save();
                    } else {
                        console.error(`Variant with ID ${item.variantId} not found in product ${product._id}`);
                    }
                } else {
                    // Increase the product's stock if there's no variant
                    product.stock += item.quantity;
                    await product.save();
                }
            }
        }

        // Process refund to the user's wallet
        const wallet = await Wallet.findOne({ userId: order.userId });
        if (wallet) {
            const refundAmount = order.finalPrice; 

            // Increase the wallet balance
            wallet.balance += refundAmount;

            // Record the transaction
            wallet.transactions.push({
                amount: refundAmount,
                type: 'credit',
                description: `Refund for cancelled order ${order._id}`,
                orderId: order._id,
                date: new Date()
            });

            await wallet.save();
        }

        // Redirect to the orders page
        res.redirect('/orders'); 
    } catch (error) {
        console.error("Error cancelling order:", error);
        res.status(500).send("Server error");
    }
};


const loadchangepassword = async (req, res) => {
    try {
        const userId = req.cookies.user; 
        console.log('Cookie User ID:', userId);
        
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
        console.log(req.body, 'req.body11111111111111111111111');
        
    
        if (newPassword !== confirmPassword) {
          return res.status(400).send("Passwords do not match");
        }
    
        // Find user by email
        const user = await User.findOne({ email: email });
        console.log("user", user);
        
        if (!user) {
          return res.status(404).send("User not found");
        }
    
        // Check current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
          return res.status(400).send("Current password is incorrect");
        }
    
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();
        req.session.passwordChanged = true;
        res.redirect('/profile');
      } catch (error) {
        console.error("Error changing password:", error);
        res.status(500).send("Server error");
      }
};



module.exports = {
     loadUserProfile,
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
     cancelOrder
}