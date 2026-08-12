/**
 * services/chatService.js
 *
 * Exact port of src/services/chat_service.rs
 *
 * Rust function:
 *   pub fn extract_ai_answer(resp: &PythonResponse) -> Option<String>
 *
 * Logic:
 *   If resp.result.type == "ai" → return Some(resp.result.content)
 *   Else                        → return None
 *
 * The PythonResponse shape (from models.rs):
 *   { result: { content: string, type: string } }
 *
 * Note: Rust field is #[serde(rename = "type")] on msg_type,
 *   meaning the JSON key is "type" — we use resp.result.type here.
 */

/**
 * Extract AI answer from the Python RAG backend response.
 * Rust equivalent: extract_ai_answer(resp: &PythonResponse) -> Option<String>
 *
 * @param {{ result: { content: string, type: string } }} pythonResponse
 * @returns {string|null} content string if type is "ai", else null
 */
function extractAiAnswer(pythonResponse) {
  // Matches Rust: if resp.result.msg_type == "ai"
  if (pythonResponse?.result?.type === "ai") {
    return pythonResponse.result.content; // Some(resp.result.content.clone())
  }
  return null; // None
}

module.exports = { extractAiAnswer };
