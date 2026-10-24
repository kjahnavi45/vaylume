"""
Memories routes.

POST   /memories           — Create a new memory (with optional photo)
GET    /memories           — List all memories for the authenticated user
GET    /memories/{id}      — Get a specific memory
PUT    /memories/{id}      — Update a memory's metadata
DELETE /memories/{id}      — Delete a memory and its photo
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)

from config.settings import get_settings
from models.schemas import (
    MemoryListResponse,
    MemoryResponse,
    MemoryUpdate,
    MessageResponse,
)
from services.auth_service import get_current_user
from services.database_service import DatabaseService, get_authed_client, get_service_client
from services.storage_service import StorageService
from utils.dependencies import get_current_user_jwt

router = APIRouter(prefix="/memories", tags=["Memories"])
settings = get_settings()

TABLE = "memories"


def _db(jwt: str) -> DatabaseService:
    return DatabaseService(get_authed_client(jwt))


def _storage(jwt: str) -> StorageService:
    return StorageService(get_authed_client(jwt))


# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "",
    response_model=MemoryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new memory",
    description="Upload a photo and provide title, description, and date to create a memory.",
)
async def create_memory(
    title: str = Form(..., min_length=1, max_length=200),
    description: Optional[str] = Form(None, max_length=2000),
    memory_date: Optional[str] = Form(None, description="ISO date string, e.g. 2024-01-15"),
    photo: Optional[UploadFile] = File(None),
    jwt: str = Depends(get_current_user_jwt),
):
    user = get_current_user(jwt)
    db = _db(jwt)
    storage = _storage(jwt)

    photo_path: Optional[str] = None
    if photo and photo.filename:
        photo_path, _, _ = storage.upload_memory_photo(user.id, photo)

    now = datetime.now(timezone.utc).isoformat()
    record = {
        "user_id": user.id,
        "title": title,
        "description": description,
        "memory_date": memory_date,
        "photo_path": photo_path,
        "created_at": now,
        "updated_at": now,
    }

    try:
        inserted = db.insert(TABLE, record)
    except Exception as exc:
        # Roll back orphaned photo on DB failure
        if photo_path:
            storage.delete_file(settings.STORAGE_BUCKET_MEMORIES, photo_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "DB_ERROR", "message": "Failed to save memory"},
        )

    return _to_response(inserted, storage)


@router.get(
    "",
    response_model=MemoryListResponse,
    summary="List all memories for the current user",
)
def list_memories(jwt: str = Depends(get_current_user_jwt)):
    user = get_current_user(jwt)
    db = _db(jwt)
    storage = _storage(jwt)

    rows = db.fetch_all(TABLE, filters={"user_id": user.id}, order_by="created_at")
    memories = [_to_response(r, storage) for r in rows]
    return MemoryListResponse(memories=memories, total=len(memories))


@router.get(
    "/{memory_id}",
    response_model=MemoryResponse,
    summary="Get a specific memory",
)
def get_memory(memory_id: UUID, jwt: str = Depends(get_current_user_jwt)):
    user = get_current_user(jwt)
    db = _db(jwt)
    storage = _storage(jwt)

    row = db.fetch_filtered(TABLE, filters={"user_id": user.id}, record_id=memory_id)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Memory not found"},
        )
    return _to_response(row, storage)


@router.put(
    "/{memory_id}",
    response_model=MemoryResponse,
    summary="Update a memory",
)
def update_memory(
    memory_id: UUID,
    payload: MemoryUpdate,
    jwt: str = Depends(get_current_user_jwt),
):
    user = get_current_user(jwt)
    db = _db(jwt)
    storage = _storage(jwt)

    # Verify ownership first
    existing = db.fetch_filtered(TABLE, filters={"user_id": user.id}, record_id=memory_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Memory not found"},
        )

    updates = payload.model_dump(exclude_none=True)
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    updated = db.update(TABLE, memory_id, updates)
    return _to_response(updated, storage)


@router.delete(
    "/{memory_id}",
    response_model=MessageResponse,
    summary="Delete a memory",
)
def delete_memory(memory_id: UUID, jwt: str = Depends(get_current_user_jwt)):
    user = get_current_user(jwt)
    db = _db(jwt)
    storage = _storage(jwt)

    existing = db.fetch_filtered(TABLE, filters={"user_id": user.id}, record_id=memory_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Memory not found"},
        )

    # Delete photo from storage first
    if existing.get("photo_path"):
        storage.delete_file(settings.STORAGE_BUCKET_MEMORIES, existing["photo_path"])

    db.delete(TABLE, memory_id)
    return MessageResponse(message="Memory deleted successfully")


# ─────────────────────────────────────────────────────────────────────────────
# Helper
# ─────────────────────────────────────────────────────────────────────────────

def _to_response(row: dict, storage: StorageService) -> MemoryResponse:
    """Convert a DB row to MemoryResponse, attaching a signed photo URL if present."""
    photo_url: Optional[str] = None
    if row.get("photo_path"):
        photo_url = storage.get_signed_url(settings.STORAGE_BUCKET_MEMORIES, row["photo_path"])

    return MemoryResponse(
        id=row["id"],
        user_id=row["user_id"],
        title=row["title"],
        description=row.get("description"),
        memory_date=row.get("memory_date"),
        photo_url=photo_url,
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )
