"""
AI Notes routes & Cloud Persistence.

POST   /notes/generate   — Generate structured study notes via Gemini AI
POST   /notes/save       — Save a note to the cloud database (public.notes)
GET    /notes            — List all saved notes for the current user
GET    /notes/{id}       — Get a specific saved note
DELETE /notes/{id}       — Delete a saved note permanently
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from config.settings import get_settings
from models.schemas import (
    MessageResponse,
    NoteGenerateRequest,
    NoteListResponse,
    NoteResponse,
    NoteSaveRequest,
    NoteSavedResponse,
)
from services import ai_service
from services.auth_service import get_current_user
from services.database_service import DatabaseService, get_authed_client
from utils.dependencies import get_current_user_jwt

router = APIRouter(prefix="/notes", tags=["AI Notes & Knowledge Library"])
settings = get_settings()

TABLE = "notes"


def _db(jwt: str) -> DatabaseService:
    return DatabaseService(get_authed_client(jwt))


@router.post(
    "/generate",
    response_model=NoteResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate AI study notes via Google Gemini",
)
def generate_notes(
    payload: NoteGenerateRequest,
    jwt: str = Depends(get_current_user_jwt),
):
    """
    Generate structured notes on any topic in 10 Indic languages or English.
    Requires GEMINI_API_KEY configured in backend/.env.
    """
    return ai_service.generate_notes(payload)


@router.post(
    "/save",
    response_model=NoteSavedResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Save a note to the user's private cloud knowledge library",
)
def save_note(
    payload: NoteSaveRequest,
    jwt: str = Depends(get_current_user_jwt),
):
    user = get_current_user(jwt)
    db = _db(jwt)

    now = datetime.now(timezone.utc).isoformat()
    record = {
        "user_id": user.id,
        "topic": payload.topic,
        "title": payload.title,
        "explanation": payload.explanation,
        "key_points": payload.key_points,
        "examples": payload.examples,
        "summary": payload.summary,
        "language": payload.language,
        "difficulty": payload.difficulty,
        "format": payload.format,
        "tags": payload.tags or [],
        "generated_at": now,
        "created_at": now,
        "updated_at": now,
    }

    try:
        inserted = db.insert(TABLE, record)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "DB_ERROR", "message": "Failed to save note to database"},
        )

    return NoteSavedResponse(
        id=inserted["id"],
        user_id=inserted["user_id"],
        title=inserted["title"],
        explanation=inserted["explanation"],
        key_points=inserted.get("key_points", []),
        examples=inserted.get("examples", []),
        summary=inserted["summary"],
        language=inserted.get("language", "English"),
        topic=inserted["topic"],
        tags=inserted.get("tags", []),
        generated_at=inserted["generated_at"],
        created_at=inserted["created_at"],
    )


@router.get(
    "",
    response_model=NoteListResponse,
    summary="List all cloud-saved notes for the authenticated user",
)
def list_saved_notes(jwt: str = Depends(get_current_user_jwt)):
    user = get_current_user(jwt)
    db = _db(jwt)

    rows = db.fetch_all(TABLE, filters={"user_id": user.id}, order_by="created_at", ascending=False)
    notes = [
        NoteSavedResponse(
            id=r["id"],
            user_id=r["user_id"],
            title=r["title"],
            explanation=r["explanation"],
            key_points=r.get("key_points", []),
            examples=r.get("examples", []),
            summary=r["summary"],
            language=r.get("language", "English"),
            topic=r.get("topic", r["title"]),
            tags=r.get("tags", []),
            generated_at=r["created_at"],
            created_at=r["created_at"],
        )
        for r in rows
    ]
    return NoteListResponse(notes=notes, total=len(notes))


@router.get(
    "/{note_id}",
    response_model=NoteSavedResponse,
    summary="Get a specific saved note",
)
def get_saved_note(note_id: UUID, jwt: str = Depends(get_current_user_jwt)):
    user = get_current_user(jwt)
    db = _db(jwt)

    row = db.fetch_filtered(TABLE, filters={"user_id": user.id}, record_id=note_id)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Note not found"},
        )

    return NoteSavedResponse(
        id=row["id"],
        user_id=row["user_id"],
        title=row["title"],
        explanation=row["explanation"],
        key_points=row.get("key_points", []),
        examples=row.get("examples", []),
        summary=row["summary"],
        language=row.get("language", "English"),
        topic=row.get("topic", row["title"]),
        tags=row.get("tags", []),
        generated_at=row["created_at"],
        created_at=row["created_at"],
    )


@router.delete(
    "/{note_id}",
    response_model=MessageResponse,
    summary="Delete a saved note permanently",
)
def delete_saved_note(note_id: UUID, jwt: str = Depends(get_current_user_jwt)):
    user = get_current_user(jwt)
    db = _db(jwt)

    existing = db.fetch_filtered(TABLE, filters={"user_id": user.id}, record_id=note_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Note not found"},
        )

    db.delete(TABLE, note_id)
    return MessageResponse(message="Note deleted successfully")
