/**
 * controllers/initController.js
 *
 * Exact port of src/controllers/init_controller.rs
 *
 * Route:  POST /api/init  (public — no auth required)
 *
 * Rust behavior:
 *   1. Generate a UUID v4 api_token
 *   2. Insert it into state.api_tokens (in-memory HashSet)
 *   3. Return JSON: { api_token: "<uuid>", jwt: null }
 *
 * Node equivalent:
 *   1. uuid.v4() → same as Uuid::new_v4().to_string()
 *   2. state.apiTokens.add(token) → same as HashSet::insert()
 *   3. Return { api_token: token, jwt: null }
 *
 * TokenResponse shape matches models.rs:
 *   { api_token: Option<String>, jwt: Option<String> }
 *   → null fields are omitted by JSON serialization in Rust,
 *     but we include them explicitly here to match the shape exactly.
 */

const { v4: uuidv4 } = require("uuid");
const state = require("../state");

/**
 * POST /api/init
 * Rust equivalent: async fn init(state: web::Data<AppState>) -> HttpResponse
 */
async function init(req, res) {
  const apiToken = uuidv4(); // Matches Rust: Uuid::new_v4().to_string()

  state.apiTokens.add(apiToken); // Matches Rust: state.api_tokens.lock().unwrap().insert(api_token)

  console.info("Init API called, issued token:", apiToken);

  // Matches Rust: TokenResponse { api_token: Some(api_token), jwt: None }
  return res.status(200).json({
    api_token: apiToken,
    jwt: null,
  });
}

module.exports = { init };
