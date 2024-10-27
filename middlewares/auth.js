const User = require('../models/userSchema');
const userAuth = (req, res, next) => {
  if (req.session.user) {
    res.locals.username = req.session.username
    User.findById(req.session.user)
      .then(user => {
        if (user && !user.isBlocked) {
          req.user = user;
          console.log('User authenticated:', user);
          next();
        } else {
          res.redirect('/login');
        }
      })
      .catch(error => {
        console.log('Error in user auth middleware', error);
        res.status(500).send('Internal Server Error');
      });
  } else {
    res.redirect('/login');
  }
};


const adminAuth = (req, res, next) => {
  if (req.session.admin) {
      if (req.originalUrl === '/admin/login') {
          return res.redirect('/admin/dashboard');
      }
      next();
  } else {
      if (req.originalUrl === '/admin/login' || req.originalUrl === '/admin') {
          next(); 
      } else {
          res.redirect('/admin/login'); 
      }
  }
};



module.exports = {
  userAuth,
  adminAuth
}