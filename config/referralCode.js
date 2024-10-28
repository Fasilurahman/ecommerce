const User = require('../models/userSchema') // Adjust the path as necessary

const generateReferralCode = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) { // Example: generating a 6-character code
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
};

const generateUniqueReferralCode = async () => {
    let code;
    let isUnique = false;
    while (!isUnique) {
        code = generateReferralCode(); // Generate a code
        const existingCode = await User.findOne({ referralCode: code }); // Check for uniqueness
        if (!existingCode) {
            isUnique = true; // Code is unique
        }
    }
    return code; // Return the unique code
};

module.exports = { generateUniqueReferralCode };
