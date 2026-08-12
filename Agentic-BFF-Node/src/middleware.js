/**
 * middleware.js
 *
 * Exact port of src/middleware.rs — two middleware layers:
 *
 * 1. apiTokenMiddleware  → ApiTokenMiddlewareFactory / ApiTokenMiddleware
 *    - All routes except /api/init require a valid "x-api-token" header
 *    - Checks if token exists in appState.apiTokens (in-memory Set)
 *    - Returns 401 "Invalid API token" if missing/invalid
 *
 * 2. jwtMiddleware       → JwtMiddlewareFactory / JwtMiddleware
 *    - Routes /api/login and /api/create_user are exempted (no JWT needed)
 *    - All other routes require "Authorization: Bearer <token>" header
 *    - Validates JWT using the app's jwt_secret
 *    - Returns 401 "Invalid JWT" if missing/invalid
 *
 * Rust middleware was layered:
 *   ApiTokenMiddleware wraps all routes under /api (except /init)
 *   JwtMiddleware wraps only /api/chat
 */

const { validateJwt } = require("./auth");
const state = require("./state");

/**
 * apiTokenMiddleware
 *
 * Rust equivalent: ApiTokenMiddleware::call()
 *
 * Skips check for /api/init (matches: req.path().ends_with("/init"))
 * Reads "x-api-token" header and checks it against state.apiTokens Set.
 */
function apiTokenMiddleware(req, res, next) {
  // Allow /init without api token — matches Rust: if req.path().ends_with("/init")
  if (req.path.endsWith("/init")) {
    return next();
  }

  const token = req.headers["x-api-token"];

  if (token && state.apiTokens.has(token)) {
    return next();
  }

  // Matches Rust: ErrorUnauthorized("Invalid API token")
  return res.status(401).json({ error: "Invalid API token" });
}

/**
 * jwtMiddleware
 *
 * Rust equivalent: JwtMiddleware::call()
 *
 * Skips check for /login and /create_user:
 *   Matches Rust: req.path().ends_with("/login") || req.path().ends_with("/create_user")
 *
 * Reads "Authorization: Bearer <token>" header.
 * Validates using validateJwt() which wraps jwt.verify() — same as Rust's decode::<Claims>()
 */
function jwtMiddleware(req, res, next) {
  // Allow login and create_user without JWT
  // Matches Rust: req.path().ends_with("/login") || req.path().ends_with("/create_user")
  if (
    req.path.endsWith("/login") ||
    req.path.endsWith("/create_user")
  ) {
    return next();
  }

  const authHeader = req.headers["authorization"];

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7); // strip "Bearer "
    if (validateJwt(token, state.jwtSecret)) {
      return next();
    }
  }

  // Matches Rust: ErrorUnauthorized("Invalid JWT")
  return res.status(401).json({ error: "Invalid JWT" });
}

module.exports = { apiTokenMiddleware, jwtMiddleware };
