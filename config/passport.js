const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/userSchema');
const passport = require('passport');
const env = require('dotenv').config();
const { generateUniqueReferralCode } = require('../config/referralCode'); // Import the unique referral code generator

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: 'https://fasilurahman.site/auth/google/callback'
},

async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ googleId: profile.id });
        if (user) {
            // User already exists
            return done(null, user);
        } else {
            // Create a new user with a unique referral code
            const referralCode = await generateUniqueReferralCode(); // Generate a unique referral code
            user = new User({
                username: profile.displayName,
                email: profile.emails[0].value,
                googleId: profile.id,
                referralCode // Save the unique referral code
            });
            await user.save();
            return done(null, user);
        }
    } catch (error) {
        return done(error, null);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    User.findById(id)
        .then(user => {
            done(null, user);
        })
        .catch(err => {
            done(err, null);
        });
});

module.exports = passport;
