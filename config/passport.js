const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/userSchema');
const passport = require('passport');
const env = require('dotenv').config();

// Helper function to generate a unique referral code
const generateReferralCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: 'https://fasilurahman.site/auth/google/callback'
  },

  async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ googleId: profile.id });

      if (user) {
        // Existing Google user
        return done(null, user);
      } else {
        // New Google user
        const referralCode = await generateReferralCode();
        console.log(referralCode,'refferal codeeeee');
        

        user = new User({
          username: profile.displayName,
          email: profile.emails[0].value,
          googleId: profile.id,
          referralCode
        });

        await user.save();
        return done(null, user);
      }
    } catch (error) {
      return done(error, null);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id)
    .then(user => done(null, user))
    .catch(err => done(err, null));
});

module.exports = passport;
