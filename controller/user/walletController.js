const Wallet = require("../../models/walletSchema");
const User = require("../../models/userSchema");

const loadWalletPage = async (req, res) => {
  try {
    const users = req.cookies.user;
    const user = await User.findById(users);

    // Get page from query (default = 1)
    const page = parseInt(req.query.page) || 1;
    const limit = 5; // Number of transactions per page
    const skip = (page - 1) * limit;

    // Find or create wallet
    let wallet = await Wallet.findOne({ userId: user });

    if (!wallet) {
      wallet = new Wallet({
        userId: user,
        balance: 0,
        transactions: []
      });
      await wallet.save();
    }


const sortedTransactions = wallet.transactions.sort(
  (a, b) => new Date(b.date) - new Date(a.date) 
);


    // Paginate transactions
    const totalTransactions = sortedTransactions.length;
    const totalPages = Math.ceil(totalTransactions / limit);
    const paginatedTransactions = sortedTransactions.slice(skip, skip + limit);

    res.render("wallet", {
      wallet,
      transactions: paginatedTransactions,
      user,
      currentPage: page,
      totalPages
    });
  } catch (error) {
    console.log("Error while loading wallet page", error);
    res.redirect("/pageNotfound");
  }
};

module.exports = {
  loadWalletPage
};
