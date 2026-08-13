/**
 * state.js
 *
 * AppState for the Node.js BFF:
 *
 * Modified to use MongoDB (Atlas) for persistent data storage across restarts.
 * The original SQLite database was ephemeral in Docker, leading to data loss.
 *
 * Uses official mongodb driver.
 */

const { MongoClient } = require("mongodb");

// JWT secret — matches Rust hardcoded "super_secret_jwt_key"
const JWT_SECRET = process.env.JWT_SECRET || "super_secret_jwt_key";

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://adaptive_rag_user:19aug2019@adaptive-rag.trgnb0j.mongodb.net/adaptive_rag?appName=adaptive-rag";
const DB_NAME = "adaptive_rag";

let db = null;
const client = new MongoClient(MONGODB_URI);

async function connectDb() {
  try {
    await client.connect();
    db = client.db(DB_NAME);
    
    // Ensure unique index on username
    await db.collection("users").createIndex({ username: 1 }, { unique: true });
    
    console.info("Connected to MongoDB");
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  }
}

// Initiate connection immediately, but it's asynchronous.
connectDb();

/**
 * Application state — shared across all route handlers.
 *
 * apiTokens: Set<string>  — in-memory set of valid API tokens
 * getDb: function         — returns the connected MongoDB db instance
 * jwtSecret: string       — HMAC secret for JWT signing/validation
 */
const appState = {
  apiTokens: new Set(),
  getDb: () => db,
  jwtSecret: JWT_SECRET,
};

module.exports = appState;
