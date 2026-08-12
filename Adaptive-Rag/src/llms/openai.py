"""
Gemini LLM initialization.

Using gemini-2.5-flash:
  - Free tier: 10 RPM, 250 req/day (as of 2025)
  - Supports with_structured_output() and tool calling
  - GOOGLE_API_KEY read from .env
"""

import os

from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()
os.environ["GOOGLE_API_KEY"] = os.getenv("GOOGLE_API_KEY", "")

# gemini-1.5-flash: latest free tier model, fast, supports structured output
llm = ChatGoogleGenerativeAI(
    model="gemini-1.5-flash",
    temperature=0,
)