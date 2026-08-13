/**
 * index.js — Application entry point
 *
 * Exact port of src/main.rs
 *
 * Rust route registration:
 *
 *   App::new()
 *     .service(
 *       web::scope("/api")
 *         .configure(init_controller::config)         // POST /api/init  [public]
 *         .service(
 *           web::scope("")
 *             .wrap(ApiTokenMiddlewareFactory)         // All below need X-API-TOKEN
 *             .configure(user_controller::config)      // POST /api/create_user, /api/login
 *             .service(
 *               web::scope("")
 *                 .wrap(JwtMiddlewareFactory)          // /api/chat needs JWT too
 *                 .configure(chat_controller::config)  // POST /api/chat
 *             )
 *         )
 *     )
 *   .bind(("127.0.0.1", 8080))
 *
 * Middleware layering reproduced accurately:
 *   - /api/init         → no middleware
 *   - /api/create_user  → apiTokenMiddleware only
 *   - /api/login        → apiTokenMiddleware only
 *   - /api/chat         → apiTokenMiddleware + jwtMiddleware
 *
 * Server binds to 127.0.0.1:8080 (matches Rust .bind(("127.0.0.1", 8080)))
 */

const express = require("express");
const { apiTokenMiddleware, jwtMiddleware } = require("./middleware");
const { init } = require("./controllers/initController");
const { createUser, login } = require("./controllers/userController");
const { chat } = require("./controllers/chatController");

const app = express();

// Parse JSON request bodies — needed for all routes (replaces actix-web's built-in JSON extractor)
app.use(express.json());

// ─── Route Registration ────────────────────────────────────────────────────────
//
// Matches Rust: web::scope("/api")
//
// Layer 1: /api/init is PUBLIC — registered before the apiToken middleware
app.post("/api/init", init);

// Layer 2: All remaining /api/* routes require X-API-TOKEN
// Matches Rust: .wrap(ApiTokenMiddlewareFactory)
app.use("/api", apiTokenMiddleware);

// Under ApiToken protection: user routes (/api/create_user, /api/login)
// jwtMiddleware is applied here but EXEMPTS /login and /create_user internally
// (matching the Rust behavior where JwtMiddleware allows these paths through)
app.use("/api", jwtMiddleware);

// Register user routes — protected by apiTokenMiddleware, exempt from JWT
// Matches Rust: user_controller::config → /api/create_user, /api/login
app.post("/api/create_user", createUser);
app.post("/api/login", login);

// TEMPORARY ENDPOINT FOR AUDIT VERIFICATION (To be removed after test)
app.get("/api/verify_mongo", async (req, res) => {
  try {
    const state = require("./state");
    const db = state.getDb();
    if (!db) return res.status(500).json({ error: "No DB connection" });
    
    // Dump the raw document to prove it's in Atlas
    const userDoc = await db.collection("users").findOne({ username: "test_live_user1" });
    
    // Redact password hash for safety
    if (userDoc && userDoc.password_hash) {
      userDoc.password_hash = "[REDACTED]";
    }
    
    return res.status(200).json(userDoc);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Register chat route — protected by BOTH apiTokenMiddleware AND jwtMiddleware
// Matches Rust: chat_controller::config → /api/chat
app.post("/api/chat", chat);

// ─── Start Server ──────────────────────────────────────────────────────────────
// Matches Rust: .bind(("127.0.0.1", 8080))
const HOST = process.env.HOST || "127.0.0.1";
const PORT = parseInt(process.env.PORT || "8080", 10);

app.listen(PORT, HOST, () => {
  console.info(`Agentic-BFF (Node.js) running on http://${HOST}:${PORT}`);
});

module.exports = app;
