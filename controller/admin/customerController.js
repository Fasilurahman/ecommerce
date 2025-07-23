const User = require('../../models/userSchema');

const customerInfo = async (req, res) => {
  try {
    let search = "";
    if (req.query.search) {
      search = req.query.search;
    }
    let page = 1;
    if (req.query.page) {
      page = parseInt(req.query.page);
    }
    const limit = 3;

    const userData = await User.find({
      isAdmin: false,
      $or: [
        { username: { $regex: ".*" + search + ".*", $options: "i" } },
        { email: { $regex: ".*" + search + ".*", $options: "i" } },
      ],
    })
      .limit(limit)
      .skip((page - 1) * limit)
      .exec();

    const count = await User.countDocuments({
      isAdmin: false,
      $or: [
        { username: { $regex: ".*" + search + ".*", $options: "i" } },
        { email: { $regex: ".*" + search + ".*", $options: "i" } },
      ],
    });

    // If AJAX request, return JSON instead of full page render
    if (req.xhr || req.query.ajax === "true") {
      return res.json({
        users: userData,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
      });
    }

    res.render("customers", {
      users: userData,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      searchTerm: search,
    });
  } catch (error) {
    console.error("Error fetching user data:", error);
    res.redirect("/admin/pageerror");
  }
};


const blockUser = async (req, res) => {
    try {
        const userId = req.params.id;
        await User.findByIdAndUpdate(userId, { isBlocked: true });
        res.redirect('/admin/users'); 
    } catch (error) {
        console.error('Error blocking user:', error);
        res.redirect('/admin/pageerror');
    }
};

const unblockUser = async (req, res) => {
    try {
        const userId = req.params.id;
        await User.findByIdAndUpdate(userId, { isBlocked: false });
        res.redirect('/admin/users'); 
    } catch (error) {
        console.error('Error unblocking user:', error);
        res.redirect('/admin/pageerror');
    }
};

module.exports = {
    customerInfo,
    blockUser,
    unblockUser,
};
