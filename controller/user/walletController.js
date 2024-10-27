const Wallet = require("../../models/walletSchema");
const User = require("../../models/userSchema");

const loadWalletPage = async (req, res) => {
    try {
        const users = req.cookies.user;
        const user = await User.findById(users);
        let wallet = await Wallet.findOne({ userId: user }); 
        
        if (!wallet) {
            wallet = new Wallet({
                userId: user,
                balance: 0,
                transactions: [] 
            });
            await wallet.save();
        }else{
            wallet.transactions.sort((a, b) => b.createdAt - a.createdAt);
        }
        res.render('wallet', {
            wallet,
            transactions: wallet.transactions,
            user
        }); 
    } catch (error) {
        console.log('Error while loading wallet page', error);
        res.redirect("/pageNotfound")
    }
}

module.exports = {
    loadWalletPage
}

