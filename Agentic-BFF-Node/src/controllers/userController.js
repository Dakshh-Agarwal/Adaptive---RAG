/**
 * controllers/userController.js
 *
 * Exact port of src/controllers/user_controller.rs
 *
 * Routes:
 *   POST /api/create_user  — create a new user (requires api_token, no JWT)
 *   POST /api/login        — authenticate user, returns JWT (requires api_token, no JWT)
 *
 * ─── create_user ───────────────────────────────────────────────────────────
 * Rust behavior:
 *   1. Hash the password with Argon2
 *   2. INSERT OR IGNORE into users table (rusqlite ignores duplicate via PRIMARY KEY)
 *   3. Return 200 { status: "created" }  (even on duplicate — Rust ignores the error with let _)
 *
 * Note: Rust code does `let _ = conn.execute(...)` which silently ignores conflicts.
 * We replicate this: use INSERT OR IGNORE in SQLite to silently skip duplicates.
 *
 * ─── login ────────────────────────────────────────────────────────────────
 * Rust behavior:
 *   1. SELECT password_hash FROM users WHERE username = ?
 *   2. If found and verify_password passes → generate_jwt → return { jwt: "<token>" }
 *   3. Else → 401 Unauthorized (empty body, matches Rust HttpResponse::Unauthorized().finish())
 *
 * JWT Claims: { sub: username, exp: now + 3600 }
 * JWT Algorithm: HS256 (Rust Header::default())
 */

const state = require("../state");
const { hashPassword, verifyPassword, generateJwt } = require("../auth");

/**
 * POST /api/create_user
 * Body: { username: string, password: string }
 *
 * Rust equivalent:
 *   async fn create_user(state, payload: Json<CreateUserRequest>) -> HttpResponse
 */
async function createUser(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "username and password are required" });
  }

  const hashed = await hashPassword(password);

  console.info("Creating user:", username);
  console.info("Hashed password:", hashed);

  // Matches Rust: conn.execute("INSERT INTO users (username, password_hash) VALUES (?1, ?2)", ...)
  // The Rust code ignores errors with `let _`, so we use INSERT OR IGNORE to handle duplicates silently
  const stmt = state.db.prepare(
    "INSERT OR IGNORE INTO users (username, password_hash) VALUES (?, ?)"
  );
  stmt.run(username, hashed);

  // Matches Rust: HttpResponse::Ok().json(json!({"status": "created"}))
  return res.status(200).json({ status: "created" });
}

/**
 * POST /api/login
 * Body: { username: string, password: string }
 *
 * Rust equivalent:
 *   async fn login(state, payload: Json<LoginRequest>) -> HttpResponse
 */
async function login(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "username and password are required" });
  }

  // Matches Rust: conn.prepare("SELECT password_hash FROM users WHERE username=?1")
  const stmt = state.db.prepare(
    "SELECT password_hash FROM users WHERE username = ?"
  );
  const row = stmt.get(username);

  if (row) {
    const valid = await verifyPassword(password, row.password_hash);
    if (valid) {
      // Matches Rust: generate_jwt(&payload.username, &state.jwt_secret)
      const jwtToken = generateJwt(username, state.jwtSecret);

      console.info("Login successful for user:", username);

      // Matches Rust: TokenResponse { api_token: None, jwt: Some(jwt) }
      return res.status(200).json({
        api_token: null,
        jwt: jwtToken,
      });
    }
  }

  // Matches Rust: HttpResponse::Unauthorized().finish()
  return res.status(401).end();
}

module.exports = { createUser, login };
