const jwt = require("jsonwebtoken");

/**
 * Generate a signed JWT token
 * @param {Object} payload - Data to encode in token
 * @param {string} expiresIn - Token expiry (default: 7 days)
 * @returns {string} Signed JWT token
 */
const generateToken = (payload, expiresIn = "7d") => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

/**
 * Generate a short-lived token for password reset
 */
const generateResetToken = (userId) => {
  return jwt.sign({ userId, purpose: "password_reset" }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
};

module.exports = { generateToken, generateResetToken };
