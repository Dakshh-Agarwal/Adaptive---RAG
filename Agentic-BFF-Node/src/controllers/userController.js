/**
 * controllers/userController.js
 *
 * Modified to use MongoDB (Atlas) for persistent data storage across restarts.
 *
 * Routes:
 *   POST /api/create_user  — create a new user (requires api_token, no JWT)
 *   POST /api/login        — authenticate user, returns JWT (requires api_token, no JWT)
 */

const state = require("../state");
const { hashPassword, verifyPassword, generateJwt } = require("../auth");

/**
 * POST /api/create_user
 * Body: { username: string, password: string }
 */
async function createUser(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "username and password are required" });
  }

  const hashed = await hashPassword(password);

  console.info("Creating user:", username);

  try {
    const db = state.getDb();
    if (!db) {
       return res.status(500).json({ error: "Database connection not initialized" });
    }
    
    const users = db.collection("users");
    
    // Insert document into MongoDB
    // Using try-catch to silently handle E11000 duplicate key errors (to match previous INSERT OR IGNORE behavior)
    try {
      await users.insertOne({ username, password_hash: hashed });
    } catch (insertErr) {
      if (insertErr.code !== 11000) {
        throw insertErr; // Re-throw if it's not a duplicate key error
      }
    }

    return res.status(200).json({ status: "created" });
  } catch (err) {
    console.error("Error creating user:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /api/login
 * Body: { username: string, password: string }
 */
async function login(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "username and password are required" });
  }

  try {
    const db = state.getDb();
    if (!db) {
       return res.status(500).json({ error: "Database connection not initialized" });
    }
    
    const users = db.collection("users");
    const userDoc = await users.findOne({ username });

    if (userDoc) {
      const valid = await verifyPassword(password, userDoc.password_hash);
      if (valid) {
        const jwtToken = generateJwt(username, state.jwtSecret);

        console.info("Login successful for user:", username);

        return res.status(200).json({
          api_token: null,
          jwt: jwtToken,
        });
      }
    }

    return res.status(401).end();
  } catch (err) {
    console.error("Error logging in:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = { createUser, login };
