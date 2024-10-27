const env = require('dotenv').config;
const express = require('express');
const app = express();
const path = require('path');
const connectDB = require("./config/db");
const userRouter = require('./routes/userRouter');
const adminRouter = require('./routes/adminRouter');
const dashboardRoutes = require('./routes/adminRouter');
const flash = require('connect-flash');
const session = require('express-session');
const passport = require('./config/passport');
const cookieParser = require('cookie-parser');


connectDB();

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure session
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 72 * 60 * 60 * 1000
    }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
    res.set('cache-control', 'no-store');
    next();
});


app.set('view engine', 'ejs');
app.set('views', [
    path.join(__dirname, 'views/user'),
    path.join(__dirname, 'views/admin'),
    path.join(__dirname, 'views/partials')
]);

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/', userRouter);
app.use('/admin', adminRouter);
app.use('/', dashboardRoutes);

app.use((req,res,next)=>{
 res.render('page-404.ejs')
})

app.listen(process.env.PORT, () => {
    console.log("SERVER IS RUNNING");
});

module.exports = app;

