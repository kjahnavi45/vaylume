"""
AI Service — generates structured study notes via Google Gemini.

Responsibilities:
  - Build a language-specific, safety-aware prompt.
  - Call Gemini API.
  - Parse and validate the structured JSON response.
  - Never expose the raw API key or model internals in errors.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict

import google.generativeai as genai
from fastapi import HTTPException, status

from config.settings import get_settings
from models.schemas import NoteGenerateRequest, NoteResponse

logger = logging.getLogger(__name__)
settings = get_settings()

# Configure Gemini once at module load (key comes from env)
genai.configure(api_key=settings.GEMINI_API_KEY)

_MODEL_NAME = "gemini-1.5-flash"

# ── Language-native prompting instructions ────────────────────────────────────
_LANGUAGE_INSTRUCTIONS: Dict[str, str] = {
    "English":   "Respond entirely in English.",
    "Telugu":    "మొత్తం సమాధానం తెలుగులో ఇవ్వండి.",
    "Hindi":     "पूरा जवाब हिंदी में दें।",
    "Gujarati":  "સમગ્ર જવાબ ગુજરાતીમાં આપો.",
    "Marathi":   "संपूर्ण उत्तर मराठीत द्या.",
    "Kannada":   "ಸಂಪೂರ್ಣ ಉತ್ತರವನ್ನು ಕನ್ನಡದಲ್ಲಿ ನೀಡಿ.",
    "Tamil":     "முழு பதிலையும் தமிழில் தரவும்.",
    "Malayalam": "മുഴുവൻ ഉത്തരവും മലയാളത്തിൽ നൽകുക.",
    "Bengali":   "সম্পূর্ণ উত্তর বাংলায় দিন।",
    "Punjabi":   "ਪੂਰਾ ਜਵਾਬ ਪੰਜਾਬੀ ਵਿੱਚ ਦਿਓ।",
}

_FORMAT_INSTRUCTIONS: Dict[str, str] = {
    "Plain":        "Write in plain prose paragraphs.",
    "Bullets":      "Use bullet points for key points and examples.",
    "Detailed":     "Provide thorough, in-depth explanations with sub-sections.",
    "Summary Only": "Keep each section very concise — 2-3 sentences maximum.",
}

_DIFFICULTY_CONTEXT: Dict[str, str] = {
    "Beginner":     "Assume the reader has no prior knowledge. Use simple words.",
    "Intermediate": "Assume basic familiarity with the subject.",
    "Advanced":     "Assume strong background knowledge; use technical depth.",
}


def _build_prompt(req: NoteGenerateRequest) -> str:
    lang_instruction = _LANGUAGE_INSTRUCTIONS.get(req.language.value, "Respond in English.")
    format_instruction = _FORMAT_INSTRUCTIONS.get(req.format.value, "")
    difficulty_context = _DIFFICULTY_CONTEXT.get(req.difficulty.value, "")
    interest_context = (
        f"Personalise examples to the field of '{req.interest}'." if req.interest else ""
    )

    return f"""
You are an expert educational content generator.
{lang_instruction}
{difficulty_context}
{format_instruction}
{interest_context}

Generate comprehensive study notes for the topic: "{req.topic}"

Return ONLY a valid JSON object — no markdown fences, no extra text — with this exact structure:
{{
  "title": "A clear, descriptive title for the topic",
  "explanation": "A thorough explanation of the topic",
  "key_points": ["point 1", "point 2", "point 3", "point 4", "point 5"],
  "examples": ["example 1", "example 2", "example 3"],
  "summary": "A concise summary of the most important takeaways"
}}

All string values must be in {req.language.value}.
The key_points array must have at least 3 items.
The examples array must have at least 2 items.
""".strip()


def _safe_parse(raw: str) -> Dict[str, Any]:
    """Strip any accidental markdown fences and parse JSON."""
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        cleaned = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return json.loads(cleaned)


def generate_notes(req: NoteGenerateRequest) -> NoteResponse:
    """
    Call Gemini and return a structured NoteResponse.
    Raises HTTPException on AI or parsing failure.
    """
    prompt = _build_prompt(req)

    try:
        model = genai.GenerativeModel(
            model_name=_MODEL_NAME,
            generation_config=genai.types.GenerationConfig(
                temperature=0.7,
                max_output_tokens=2048,
                response_mime_type="application/json",
            ),
        )
        response = model.generate_content(prompt)
        raw_text = response.text
    except Exception as exc:
        logger.error("Gemini API error: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "AI_ERROR", "message": "AI service is temporarily unavailable"},
        )

    try:
        parsed = _safe_parse(raw_text)
    except (json.JSONDecodeError, ValueError) as exc:
        logger.error("Failed to parse Gemini response: %s — raw: %.500s", exc, raw_text)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "AI_PARSE_ERROR", "message": "AI returned an unexpected format"},
        )

    # Validate required keys
    required_keys = {"title", "explanation", "key_points", "examples", "summary"}
    missing = required_keys - set(parsed.keys())
    if missing:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "AI_INCOMPLETE", "message": f"AI response missing fields: {missing}"},
        )

    return NoteResponse(
        title=parsed["title"],
        explanation=parsed["explanation"],
        key_points=parsed["key_points"],
        examples=parsed["examples"],
        summary=parsed["summary"],
        language=req.language.value,
        topic=req.topic,
        generated_at=datetime.now(timezone.utc),
    )
