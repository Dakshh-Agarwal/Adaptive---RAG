# Adaptive RAG

**A self-routing, self-correcting RAG pipeline built with LangGraph — automatically decides whether to answer from your documents, LLM general knowledge, or live web search, and rewrites the query on low-quality retrieval before giving up.**

[![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![LangGraph](https://img.shields.io/badge/LangGraph-0.5.4-FF6B35?logo=langchain&logoColor=white)](https://langchain-ai.github.io/langgraph/)
[![LangChain](https://img.shields.io/badge/LangChain-0.3.27-1C3C3C?logo=langchain&logoColor=white)](https://www.langchain.com/)
[![Gemini](https://img.shields.io/badge/Gemini_1.5_Flash-4285F4?logo=google&logoColor=white)](https://ai.google.dev/)
[![FAISS](https://img.shields.io/badge/FAISS-in--memory-00A1C1?logo=meta&logoColor=white)](https://faiss.ai/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://docs.docker.com/compose/)
[![Streamlit](https://img.shields.io/badge/Streamlit-Frontend-FF4B4B?logo=streamlit&logoColor=white)](https://streamlit.io/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 🌐 Live Demo

**→ [adaptiverag.streamlit.app](https://adaptiverag.streamlit.app/)**

---

## The Problem

Naive RAG retrieves documents and generates an answer regardless of whether retrieved chunks are actually relevant — no mechanism exists to detect retrieval failure, and the system has no fallback when the corpus doesn't cover the question. This produces confident-sounding hallucinations on out-of-distribution queries and silent failures when retrieval quality is poor.

## The Solution

This system adds a graded decision loop around every retrieval: after fetching documents, an LLM grades their relevance as a binary yes/no. A **no** triggers query rewriting and a second retrieval attempt before generating. If the question isn't in the corpus at all, the classifier routes it to Tavily web search or direct LLM general knowledge — before retrieval is even attempted.

---

## ✅ Key Features

- **Up-front query routing** — classifies every query as `index` / `general` / `search` before retrieval, skipping FAISS entirely for general-knowledge or real-time questions
- **LLM-graded retrieval** — `grade` node scores retrieved context with a structured binary output (`yes`/`no`); no heuristics or cosine thresholds
- **Query rewriting on retrieval failure** — `rewrite` node rewrites the original query with a dedicated prompt, then retries retrieval once (ReAct agent `max_iterations=2`)
- **Web search fallback** — `web_search` node calls Tavily API for queries classified as requiring real-time or external knowledge
- **ReAct agent for retrieval** — the `retriever` node runs a LangChain ReAct agent with a named tool (`retriever_customer_uploaded_documents`), not a raw similarity search
- **Per-session conversation memory** — full message history stored in MongoDB per `session_id`, passed to the graph on every request
- **Two-layer auth** — Node.js BFF with Argon2id password hashing, UUID API tokens, HS256 JWT (1hr) — separates auth concerns from the RAG API

---

## 🛠 Tech Stack

### LLM / Orchestration

| Component | Badge | Notes |
|---|---|---|
| LangGraph | [![LangGraph](https://img.shields.io/badge/LangGraph-0.5.4-FF6B35)](https://langchain-ai.github.io/langgraph/) | Graph compilation, `StateGraph`, conditional edges |
| LangChain | [![LangChain](https://img.shields.io/badge/LangChain-0.3.27-1C3C3C)](https://www.langchain.com/) | Chains, prompts, ReAct agent, retriever tools |
| Gemini 1.5 Flash | [![Gemini](https://img.shields.io/badge/Gemini_1.5_Flash-4285F4?logo=google)](https://ai.google.dev/) | All LLM calls — classification, grading, rewriting, generation |
| Tavily | [![Tavily](https://img.shields.io/badge/Tavily-Web_Search-orange)](https://app.tavily.com) | Real-time web search (`TavilySearchResults`) |

### Vectorstore & Embeddings

| Component | Badge | Notes |
|---|---|---|
| FAISS | [![FAISS](https://img.shields.io/badge/FAISS-CPU_in--memory-00A1C1)](https://faiss.ai/) | Active vectorstore; in-memory, lost on restart |
| Google Embeddings | [![Gemini](https://img.shields.io/badge/gemini--embedding--001-4285F4?logo=google)](https://ai.google.dev/) | `GoogleGenerativeAIEmbeddings` — `models/gemini-embedding-001` |
| Qdrant | [![Qdrant](https://img.shields.io/badge/Qdrant-coded_disabled-red)](https://qdrant.tech/) | Fully implemented, commented out in `retriever_setup.py` |

### Backend / Frontend / Deployment

| Component | Badge | Notes |
|---|---|---|
| FastAPI | [![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi)](https://fastapi.tiangolo.com/) | RAG API — port 8000 |
| Node.js / Express | [![Node](https://img.shields.io/badge/Node.js-BFF_Auth-339933?logo=node.js)](https://nodejs.org/) | Auth BFF — port 8080 |
| MongoDB | [![MongoDB](https://img.shields.io/badge/MongoDB-Chat_History-47A248?logo=mongodb)](https://www.mongodb.com/) | Per-session message history via Motor |
| Streamlit | [![Streamlit](https://img.shields.io/badge/Streamlit-Frontend-FF4B4B?logo=streamlit)](https://streamlit.io/) | Chat UI — port 8501 |
| Docker Compose | [![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](https://docs.docker.com/) | Orchestrates all 4 services |

---

## 🗺 Architecture — The Adaptive Graph

> Every node name and edge below maps 1:1 to `add_node` / `add_conditional_edges` calls in [`src/rag/graph_builder.py`](./Adaptive-Rag/src/rag/graph_builder.py).

```mermaid
flowchart TD
    START([START]) --> query_analysis

    query_analysis["query_analysis\n─────────────\nclassify_prompt → Gemini\noutput: RouteIdentifier.route"]

    query_analysis -->|routing_tool| C{route value?}
    C -->|"route == 'index'"| retriever
    C -->|"route == 'general'"| general_llm
    C -->|"route == 'search'"| web_search

    retriever["retriever\n─────────────\nReAct agent, max_iterations=2\ntool: retriever_customer_uploaded_documents\nFAISS similarity search"]

    grade["grade\n─────────────\ngrading_prompt → Gemini\noutput: Grade.binary_score\n'yes' or 'no'"]

    rewrite["rewrite\n─────────────\nrewrite_prompt → Gemini\noutput: updated latest_query"]

    generate["generate\n─────────────\ngenerate_prompt → Gemini\noutput: final assistant message"]

    web_search["web_search\n─────────────\nTavilySearchResults\noutput: joined content strings"]

    general_llm["general_llm\n─────────────\nllm.invoke messages\nno retrieval, no prompt template"]

    retriever --> grade
    grade -->|doc_tool| D{"binary_score?"}
    D -->|"'yes' — relevant"| generate
    D -->|"'no' — not relevant"| rewrite
    rewrite --> retriever

    web_search --> generate
    generate --> END([END])
    general_llm --> END([END])
```

**Conditional edge functions** (in [`src/tools/graph_tools.py`](./Adaptive-Rag/src/tools/graph_tools.py)):
- `routing_tool` — reads `state["route"]` → returns `"retriever"`, `"general_llm"`, or `"web_search"`
- `doc_tool` — reads `state["binary_score"]` → returns `"generate"` or `"rewrite"`

> **Note:** A `verify_answer` function exists in `graph_tools.py` (faithfulness check via `VerificationResult`) but is **not registered in the compiled graph** — it is dead code in the current build.

---

## 🔄 How It Works — One Query's Lifecycle

For a query classified as `"index"` (document-grounded):

```
1. POST /rag/query  →  FastAPI loads full MongoDB chat history for session_id

2. query_analysis
   ├─ Calls FAISS retriever to get context snippets
   └─ Sends question + context to Gemini with classify_prompt
      → RouteIdentifier.route = "index"

3. routing_tool  →  next node: "retriever"

4. retriever
   ├─ ReAct agent (max_iterations=2) receives latest_query
   └─ Calls tool: retriever_customer_uploaded_documents
      → FAISS.as_retriever().invoke(query) → top-k chunks

5. grade
   ├─ Sends question + retrieved content to Gemini with grading_prompt
   └─ Grade.binary_score = "yes" | "no"

6a. binary_score == "yes"  →  generate
    └─ Sends retrieved context to Gemini with generate_prompt → final answer → END

6b. binary_score == "no"  →  rewrite
    ├─ Sends original query to Gemini with rewrite_prompt → new query string
    └─ Loops back to retriever (one more attempt, then always proceeds to generate)
```

For `"general"`: skips retrieval entirely → `llm.invoke(messages)` → END

For `"search"`: `TavilySearchResults().invoke(latest_query)` → feeds results to `generate` → END

---

## 🚀 Getting Started

### Prerequisites

- Python 3.11
- Node.js 22+ (for the auth BFF)
- Docker (for MongoDB)
- `GOOGLE_API_KEY` and `TAVILY_API_KEY`

### 1. Clone & Configure

```bash
git clone <your-repo-url>
cd adaptive_rag

cp Adaptive-Rag/.env.example Adaptive-Rag/.env
# Fill in the values below
```

**Required `.env` variables** (in `Adaptive-Rag/`):

| Variable | Required | Where to get it |
|---|---|---|
| `GOOGLE_API_KEY` | ✅ | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) — Free: 15 RPM, 1500 req/day |
| `TAVILY_API_KEY` | ✅ | [app.tavily.com](https://app.tavily.com) — Free: 1000 searches/month |
| `MONGODB_URI` | ✅ | `mongodb://localhost:27017` for local Docker |
| `QDRANT_URL` | ❌ | Only needed if switching back to Qdrant |

### 2. Option A — Docker Compose (recommended)

```bash
docker compose up --build
```

| Service | Port | URL |
|---|---|---|
| Streamlit UI | 8501 | http://localhost:8501 |
| FastAPI RAG | 8000 | http://localhost:8000/docs |
| Node.js BFF | 8080 | http://localhost:8080 |
| MongoDB | 27017 | internal |

### 2. Option B — Manual (development)

```bash
# Terminal 1 — MongoDB
docker run -d -p 27017:27017 --name mongodb mongo:latest

# Terminal 2 — FastAPI RAG backend
cd Adaptive-Rag
pip install -r requirements.txt
uvicorn src.main:app --reload --host 127.0.0.1 --port 8000

# Terminal 3 — Node.js Auth BFF
cd Agentic-BFF-Node
npm install
node src/index.js

# Terminal 4 — Streamlit frontend
cd Adaptive-Rag
streamlit run streamlit_app/home.py
```

### 3. Ingest Documents

Via the Streamlit sidebar (after login): upload PDF or TXT + description.

Via API directly:
```bash
curl -X POST http://localhost:8000/rag/documents/upload \
  -H "X-Description: Product manual for Model X" \
  -F "file=@/path/to/your/document.pdf"
```

Chunking: `RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)`

---

## ⚖️ Trade-offs & Design Decisions

| Decision | Upside | Downside |
|---|---|---|
| **Single LLM (Gemini 1.5 Flash) for all roles** | Consistent context; free tier available | 3–4 sequential calls per query; single API failure point |
| **ReAct agent for retrieval (`max_iterations=2`)** | Agent self-corrects tool call format; intermediate steps logged | Hard 2-iteration cap; overhead vs. direct `.invoke()` |
| **FAISS in-memory vectorstore** | Zero infrastructure setup | All docs lost on Python server restart; no multi-replica support |
| **Binary yes/no grading (no confidence score)** | Cheap, decisive LLM call | Borderline relevance always resolves to rewrite |
| **Rewrite → single retry, not loop** | Bounded latency — max 2 retrieval attempts | Second attempt may also fail; goes to `generate` with bad context |
| **chunk_size=1000, overlap=150** | Fits Gemini's context window per chunk | Many chunks on large docs; precision depends on embedding granularity |
| **JWT token as MongoDB `session_id`** | No separate session table needed | Raw JWT in DB; JWT expiry doesn't purge history |
| **Classifier runs FAISS lookup on every query** | Sees actual retrieved content, not just query text | Extra FAISS call even for `"general"` / `"search"` paths |

---

## 📈 Advantages Over Vanilla RAG

| Vanilla RAG | This System |
|---|---|
| Always retrieves from corpus | Routes to web search or general LLM when corpus is irrelevant |
| Generates from whatever is retrieved | Grades retrieved docs; rewrites query on failure |
| No multi-turn memory | Full per-session history via MongoDB |
| Single fixed pipeline | Three distinct answer paths chosen per query |
| User description used as-is | LLM rewrites the description to a proper retriever tool instruction |

---

## ⚠️ Limitations / Known Issues

| Issue | Detail |
|---|---|
| **FAISS is in-memory** | Documents lost on Python server restart. Qdrant is fully coded in `retriever_setup.py` — just uncomment + set env vars |
| **3–4 LLM calls per query** | On Gemini free tier (15 RPM), high-traffic sessions will hit rate limits quickly |
| **`verify_answer` not wired in** | Faithfulness check (`VerificationResult`) exists in `graph_tools.py` but is not connected to any graph edge |
| **ReAct agent caps at 2 iterations** | Tool call format failures produce partial output with no further retry |
| **API tokens are ephemeral** | Node.js BFF stores tokens in memory — invalidated on BFF restart |
| **Streamlit bypasses BFF for chat** | `/rag/query` is called directly; BFF's `/api/chat` proxy is dead code for the Streamlit UI |
| **No streaming** | Graph runs synchronously — no SSE/token streaming to the frontend |
| **Tavily errors unhandled** | Web search failures propagate as 500s (Gemini 429s are caught and return friendly messages) |

---

## 🗺 Future Roadmap

- [ ] Wire `verify_answer` into the compiled graph as a post-`generate` faithfulness gate before `END`
- [ ] Swap FAISS for Qdrant persistent storage — code is already written, needs env vars + uncomment
- [ ] Add streaming responses via LangGraph `astream_events` + SSE to the Streamlit frontend
- [ ] Add a retry counter field to `State` to cap `rewrite → retriever` cycles and fall through to `web_search`
- [ ] Support multi-document indexing (currently a new upload replaces the existing FAISS store entirely)

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit with clear messages
4. Open a pull request against `main`

Please follow the code style guide in [`CODE_STYLE_GUIDE.md`](./Adaptive-Rag/CODE_STYLE_GUIDE.md).

---

## 📄 License

MIT — see [LICENSE](LICENSE) for details.
