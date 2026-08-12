/**
 * auth.js
 *
 * Exact port of src/auth.rs:
 *  - hash_password    → Argon2 hash with random salt   (argon2.hash)
 *  - verify_password  → Argon2 verify                  (argon2.verify)
 *  - generate_jwt     → HS256 JWT, 1-hour expiry       (jsonwebtoken.sign)
 *  - validate_jwt     → HS256 JWT verify               (jsonwebtoken.verify)
 *
 * The Rust code used Argon2::default() which maps to argon2id variant.
 * The JWT secret is read from AppState (passed in as parameter),
 * matching the Rust pattern where secret lives in AppState.jwt_secret.
 */

const { hash: argon2Hash, verify: argon2Verify } = require("@node-rs/argon2");
const jwt = require("jsonwebtoken");

/**
 * Hash a plain-text password using Argon2id.
 * Rust equivalent: hash_password(password: &str) -> String
 *
 * @param {string} password
 * @returns {Promise<string>} Argon2id hash string
 */
async function hashPassword(password) {
  // argon2Hash defaults to argon2id — same as Argon2::default() in Rust
  return await argon2Hash(password);
}

/**
 * Verify a plain-text password against an Argon2id hash.
 * Rust equivalent: verify_password(password: &str, hash: &str) -> bool
 *
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
async function verifyPassword(password, hash) {
  try {
    // @node-rs/argon2: verify(hashedPassword, password)
    return await argon2Verify(hash, password);
  } catch (e) {
    console.error("Failed to parse/verify password hash:", e.message);
    return false;
  }
}

/**
 * Generate a signed JWT token for the given userId.
 * Rust equivalent: generate_jwt(user_id: &str, secret: &str) -> String
 *
 * Claims: { sub: username, exp: now + 3600 seconds }
 * Algorithm: HS256 (same as jsonwebtoken::Header::default() in Rust)
 *
 * @param {string} userId
 * @param {string} secret
 * @returns {string} Signed JWT token
 */
function generateJwt(userId, secret) {
  // exp = current time + 3600 seconds (matches Rust Duration::from_secs(3600))
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const claims = { sub: userId, exp };
  return jwt.sign(claims, secret, { algorithm: "HS256" });
}

/**
 * Validate a JWT token against the given secret.
 * Rust equivalent: validate_jwt(token: &str, secret: &str) -> bool
 *
 * Uses Validation::default() in Rust which validates exp, iat, etc.
 * jsonwebtoken.verify() does the same by default.
 *
 * @param {string} token
 * @param {string} secret
 * @returns {boolean}
 */
function validateJwt(token, secret) {
  try {
    jwt.verify(token, secret, { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}

module.exports = { hashPassword, verifyPassword, generateJwt, validateJwt };
