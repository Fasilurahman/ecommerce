const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/userSchema');
const passport = require('passport');
require('dotenv').config();

// Helper function to generate a unique referral code
const generateReferralCode = async () => {
  let code;
  let exists = true;

  while (exists) {
    code = Math.random().toString(36).substring(2, 8).toUpperCase(); // Generates a random 6-character code
    exists = await User.findOne({ referralCode: code });
  }

  return code;
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

        user = new User({
          username: profile.displayName,
          email: profile.emails[0].value,
          googleId: profile.id,
          referralCode: referralCode // Assign the generated referral code
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
