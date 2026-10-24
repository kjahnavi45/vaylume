"""
AI Notes routes.

POST /notes/generate — Generate structured study notes via Gemini AI
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, status

from models.schemas import NoteGenerateRequest, NoteResponse
from services import ai_service
from utils.dependencies import get_current_user_jwt

router = APIRouter(prefix="/notes", tags=["AI Notes"])


@router.post(
    "/generate",
    response_model=NoteResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate AI study notes",
    description=(
        "Uses Google Gemini to generate structured educational notes. "
        "The AI responds entirely in the requested language (English, Telugu, Hindi, "
        "Gujarati, Marathi, Kannada, Tamil, Malayalam, Bengali, Punjabi). "
        "Notes include a title, explanation, key points, examples, and a summary."
    ),
)
def generate_notes(
    payload: NoteGenerateRequest,
    jwt: str = Depends(get_current_user_jwt),
):
    """
    Generate notes on a topic. Authentication is required to prevent abuse.
    The notes are returned directly — optionally they can also be saved to the
    database by extending this endpoint.
    """
    return ai_service.generate_notes(payload)
