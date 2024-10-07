const Wallet = require("../../models/walletSchema");

const loadWalletPage = async (req, res) => {
    console.log('1111');
    
    try {
        console.log('2222');

        console.log('Session User:', req.cookies.user);
        const user = req.cookies.user;
        let wallet = await Wallet.findOne({ userId: user }); 
        console.log(wallet,' wallet');
        
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
            transactions: wallet.transactions
        }); 
    } catch (error) {
        console.log('Error while loading wallet page', error);
        res.redirect("/pageNotfound")
    }
}

module.exports = {
    loadWalletPage
}

