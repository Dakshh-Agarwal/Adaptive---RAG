/**
 * controllers/chatController.js
 *
 * Exact port of src/controllers/chat_controller.rs
 *
 * Route: POST /api/chat  (requires both api_token AND JWT)
 *
 * Rust behavior:
 *   1. Extract session_id from "Authorization: Bearer <token>" header
 *      (strips "Bearer " prefix → uses raw JWT as session_id)
 *   2. Build request body: { query: payload.query, session_id: <token> }
 *   3. Forward POST to Python service at "http://127.0.0.1:8000/rag/query"
 *   4. On success: parse PythonResponse, extract AI answer via extract_ai_answer()
 *      - If type == "ai" → return { answer: content }
 *      - Else            → return { answer: "No AI response found" }
 *   5. On Python error → 502 Bad Gateway "Python service returned an error"
 *   6. On network error → 500 "Failed to contact Python service: <err>"
 *   7. On parse error → 500 "Failed to parse Python response: <err>"
 *
 * Python URL matches Rust hardcoded: "http://127.0.0.1:8000/rag/query"
 */

const axios = require("axios");
const { extractAiAnswer } = require("../services/chatService");

const PYTHON_URL = "http://127.0.0.1:8000/rag/query";

/**
 * POST /api/chat
 * Body: { query: string }
 * Headers: Authorization: Bearer <jwt>
 *
 * Rust equivalent:
 *   async fn chat(req: HttpRequest, payload: Json<ChatRequest>) -> HttpResponse
 */
async function chat(req, res) {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: "query is required" });
  }

  // Extract session_id from Authorization header
  // Rust: req.headers().get("Authorization")
  //         .and_then(|h| h.to_str().ok())
  //         .map(|auth| auth.strip_prefix("Bearer ").unwrap_or(auth).to_string())
  const authHeader = req.headers["authorization"];
  let sessionId = null;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    sessionId = authHeader.slice(7); // strip "Bearer "
  }

  // Build request body — matches Rust:
  //   let mut request_body = json!({ "query": payload.query });
  //   if let Some(token) = session_id { request_body["session_id"] = json!(token); }
  const requestBody = { query };
  if (sessionId) {
    requestBody.session_id = sessionId;
  }

  console.info("Sending request to Python service:", requestBody);

  try {
    const response = await axios.post(PYTHON_URL, requestBody, {
      validateStatus: null, // Don't throw on non-2xx, handle manually
    });

    if (response.status >= 200 && response.status < 300) {
      // Matches Rust: resp.json::<PythonResponse>().await
      const pythonResp = response.data;

      // Matches Rust: extract_ai_answer(&python_resp)
      const answer = extractAiAnswer(pythonResp);

      console.info("Received response from Python service:", pythonResp);

      if (answer !== null) {
        // Matches Rust: HttpResponse::Ok().json(json!({ "answer": answer }))
        return res.status(200).json({ answer });
      } else {
        // Matches Rust: HttpResponse::Ok().json(json!({ "answer": "No AI response found" }))
        return res.status(200).json({ answer: "No AI response found" });
      }
    } else {
      // Matches Rust: HttpResponse::BadGateway().body("Python service returned an error")
      return res.status(502).send("Python service returned an error");
    }
  } catch (err) {
    // Matches Rust: Err(e) => HttpResponse::InternalServerError().body(format!("Failed to contact Python service: {e}"))
    if (err.code === "ECONNREFUSED" || err.request) {
      return res
        .status(500)
        .send(`Failed to contact Python service: ${err.message}`);
    }
    // Matches Rust: Err(e) => HttpResponse::InternalServerError().body(format!("Failed to parse Python response: {e}"))
    return res
      .status(500)
      .send(`Failed to parse Python response: ${err.message}`);
  }
}

module.exports = { chat };
