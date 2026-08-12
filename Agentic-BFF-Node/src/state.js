/**
 * state.js
 *
 * Exact port of src/state.rs — AppState:
 *
 * Rust had:
 *   - api_tokens: Arc<Mutex<HashSet<String>>>   → JS Set (apiTokens)
 *   - db_conn:    Arc<Mutex<Connection>>         → node:sqlite DatabaseSync instance (db)
 *   - jwt_secret: Arc<String>                   → plain string constant (jwtSecret)
 *
 * SQLite setup matches Rust:
 *   - Opens/creates "users.db" file
 *   - Creates table: users(username TEXT PRIMARY KEY, password_hash TEXT NOT NULL)
 *
 * Uses Node.js built-in node:sqlite (available since Node.js v22.5.0).
 * No native compilation required — it's part of Node.js itself.
 * DatabaseSync is synchronous, matching the blocking behavior of rusqlite in Rust.
 */

const { DatabaseSync } = require("node:sqlite");
const path = require("path");

// JWT secret — matches Rust hardcoded "super_secret_jwt_key" in state.rs
// In production, read from process.env.JWT_SECRET
const JWT_SECRET = process.env.JWT_SECRET || "super_secret_jwt_key";

/**
 * Initializes the SQLite database and creates the users table if it doesn't exist.
 * Rust equivalent: AppState::new() with Connection::open("users.db")
 *
 * @returns {DatabaseSync} node:sqlite DatabaseSync instance
 */
function initDb() {
  const dbPath = path.resolve(process.cwd(), "users.db");
  const db = new DatabaseSync(dbPath);

  // Matches Rust:
  // CREATE TABLE IF NOT EXISTS users (
  //   username TEXT PRIMARY KEY,
  //   password_hash TEXT NOT NULL
  // )
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL
    )
  `);

  return db;
}

/**
 * Application state — shared across all route handlers.
 * Rust equivalent: AppState { api_tokens, db_conn, jwt_secret }
 *
 * apiTokens: Set<string>  — in-memory set of valid API tokens (UUID strings)
 *                           Cleared on restart (matches Rust in-memory HashSet behavior)
 * db: DatabaseSync        — SQLite connection (node:sqlite built-in)
 * jwtSecret: string       — HMAC secret for JWT signing/validation
 */
const appState = {
  apiTokens: new Set(),
  db: initDb(),
  jwtSecret: JWT_SECRET,
};

module.exports = appState;
