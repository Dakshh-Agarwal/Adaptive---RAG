"""
API routes for RAG operations.
"""

import logging

from fastapi import APIRouter, UploadFile, File, Header
from fastapi.responses import JSONResponse
from langchain_core.messages import HumanMessage, AIMessage

from src.memory.chat_history_mongo import ChatHistory
from src.models.query_request import QueryRequest
from src.rag.document_upload import documents
from src.rag.graph_builder import builder

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/rag/query")
async def rag_query(req: QueryRequest):
    """
    Process a RAG query and return the result.

    Args:
        req: The query request containing query text and session_id.

    Returns:
        The generated response from the RAG pipeline.
        On Gemini 429 rate limit: returns 200 with a friendly message so the
        Streamlit UI stays functional and does not crash or show a traceback.
    """
    try:
        chat_history = ChatHistory.get_session_history(req.session_id)
        await chat_history.add_message(HumanMessage(content=req.query))

        # Fetch full history
        messages = await chat_history.get_messages()
        result = builder.invoke({
            "messages": messages
        })
        output_text = result["messages"][-1].content

        # Save assistant message
        await chat_history.add_message(AIMessage(content=output_text))

        return {"result": result["messages"][-1]}

    except Exception as e:
        error_msg = str(e).lower()

        # Catch Gemini 429 / quota / resource_exhausted errors
        # Return 200 so Streamlit frontend doesn't crash or show red traceback
        if "429" in error_msg or "resource_exhausted" in error_msg or "quota" in error_msg:
            logger.warning(f"Gemini API rate limit hit: {e}")
            return JSONResponse(
                status_code=200,
                content={
                    "result": {
                        "content": "The server is currently busy right now! Please try again in a few moments.",
                        "type": "ai"
                    }
                }
            )

        # All other genuine backend failures → 500
        logger.error(f"Unexpected RAG pipeline error: {e}")
        return JSONResponse(
            status_code=500,
            content={"detail": "An internal server error occurred."}
        )


@router.post("/rag/documents/upload")
async def upload_file(
    file: UploadFile = File(...),
    description: str = Header(..., alias="X-Description")
):
    """
    Upload a document for RAG processing.

    Args:
        file: The file to upload (PDF or TXT).
        description: Document description provided via header.

    Returns:
        Upload status.
    """
    status_upload = documents(description, file)
    return {"status": status_upload}
