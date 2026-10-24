"""
Memories routes.

POST   /memories           — Create a new memory (with optional photo)
POST   /memories/batch     — Batch upload multiple memory photos
GET    /memories           — List all memories for the authenticated user
GET    /memories/{id}      — Get a specific memory
PUT    /memories/{id}      — Update a memory's metadata
DELETE /memories/{id}      — Delete a memory and its photo
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import List, Optional
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
    BatchMemoryResponse,
    MemoryListResponse,
    MemoryResponse,
    MemoryUpdate,
    MessageResponse,
)
from services.auth_service import get_current_user
from services.database_service import DatabaseService, get_authed_client
from services.storage_service import StorageService
from utils.dependencies import get_current_user_jwt
from utils.vault_dependency import require_vault_unlocked

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/memories", tags=["Memories"])
settings = get_settings()

TABLE = "memories"


def _db(jwt: str) -> DatabaseService:
    return DatabaseService(get_authed_client(jwt))


def _storage(jwt: str) -> StorageService:
    return StorageService(get_authed_client(jwt))


def _parse_tags(tags_input: Optional[str]) -> list:
    if not tags_input:
        return []
    try:
        parsed = json.loads(tags_input)
        if isinstance(parsed, list):
            return [str(t).lstrip("#").strip() for t in parsed if str(t).strip()]
    except Exception:
        pass
    return [t.strip().lstrip("#") for t in tags_input.split(",") if t.strip()]


# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "",
    response_model=MemoryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new memory",
    description="Upload a photo and provide title, description, date, category, and tags.",
)
async def create_memory(
    title: str = Form(..., min_length=1, max_length=200),
    description: Optional[str] = Form(None, max_length=2000),
    memory_date: Optional[str] = Form(None, description="ISO date string, e.g. 2026-10-24"),
    category: Optional[str] = Form("Personal", max_length=50),
    tags: Optional[str] = Form(None, description="JSON array or comma-separated tags"),
    photo: Optional[UploadFile] = File(None),
    jwt: str = Depends(get_current_user_jwt),
    _vault: str = Depends(require_vault_unlocked),
):
    user = get_current_user(jwt)
    db = _db(jwt)
    storage = _storage(jwt)

    photo_path: Optional[str] = None
    if photo and photo.filename:
        photo_path, _, _ = storage.upload_memory_photo(user.id, photo)

    now = datetime.now(timezone.utc).isoformat()
    parsed_tags = _parse_tags(tags)

    record = {
        "user_id": user.id,
        "title": title,
        "description": description,
        "memory_date": memory_date,
        "category": category or "Personal",
        "tags": parsed_tags,
        "photo_path": photo_path,
        "created_at": now,
        "updated_at": now,
    }

    try:
        inserted = db.insert(TABLE, record)
    except Exception as exc:
        if photo_path:
            storage.delete_file(settings.STORAGE_BUCKET_MEMORIES, photo_path)
        logger.error("Failed to insert memory: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "DB_ERROR", "message": "Failed to save memory"},
        )

    return _to_response(inserted, storage)


@router.post(
    "/batch",
    response_model=BatchMemoryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Batch upload multiple memory photos",
    description="Upload multiple photos from gallery or computer with progress and per-photo metadata.",
)
async def create_memories_batch(
    photos: List[UploadFile] = File(..., description="Array of photo files"),
    metadata: Optional[str] = Form(None, description="JSON array of metadata objects per photo"),
    jwt: str = Depends(get_current_user_jwt),
    _vault: str = Depends(require_vault_unlocked),
):
    user = get_current_user(jwt)
    db = _db(jwt)
    storage = _storage(jwt)

    meta_list = []
    if metadata:
        try:
            parsed = json.loads(metadata)
            if isinstance(parsed, list):
                meta_list = parsed
        except Exception:
            pass

    created_memories = []
    errors = []
    now = datetime.now(timezone.utc).isoformat()

    for idx, photo in enumerate(photos):
        meta = meta_list[idx] if idx < len(meta_list) and isinstance(meta_list[idx], dict) else {}
        title = meta.get("title") or (photo.filename.rsplit(".", 1)[0] if photo.filename else f"Memory {idx + 1}")
        description = meta.get("description")
        memory_date = meta.get("memory_date") or meta.get("date") or datetime.now().date().isoformat()
        category = meta.get("category") or "Personal"
        parsed_tags = meta.get("tags") or []
        if isinstance(parsed_tags, str):
            parsed_tags = _parse_tags(parsed_tags)

        photo_path = None
        try:
            if photo and photo.filename:
                photo_path, _, _ = storage.upload_memory_photo(user.id, photo)

            record = {
                "user_id": user.id,
                "title": title[:200],
                "description": description[:2000] if description else None,
                "memory_date": str(memory_date),
                "category": category,
                "tags": parsed_tags,
                "photo_path": photo_path,
                "created_at": now,
                "updated_at": now,
            }

            inserted = db.insert(TABLE, record)
            created_memories.append(_to_response(inserted, storage))
        except Exception as exc:
            if photo_path:
                storage.delete_file(settings.STORAGE_BUCKET_MEMORIES, photo_path)
            err_msg = f"Failed to upload '{photo.filename}': {str(exc)}"
            logger.warning(err_msg)
            errors.append(err_msg)

    return BatchMemoryResponse(
        memories=created_memories,
        total_uploaded=len(created_memories),
        errors=errors,
    )


@router.get(
    "",
    response_model=MemoryListResponse,
    summary="List all memories for the current user",
)
def list_memories(
    jwt: str = Depends(get_current_user_jwt),
    _vault: str = Depends(require_vault_unlocked),
):
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
def get_memory(
    memory_id: UUID,
    jwt: str = Depends(get_current_user_jwt),
    _vault: str = Depends(require_vault_unlocked),
):
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
    _vault: str = Depends(require_vault_unlocked),
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
    if "memory_date" in updates and updates["memory_date"]:
        updates["memory_date"] = str(updates["memory_date"])
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    updated = db.update(TABLE, memory_id, updates)
    return _to_response(updated, storage)


@router.delete(
    "/{memory_id}",
    response_model=MessageResponse,
    summary="Delete a memory",
)
def delete_memory(
    memory_id: UUID,
    jwt: str = Depends(get_current_user_jwt),
    _vault: str = Depends(require_vault_unlocked),
):
    user = get_current_user(jwt)
    db = _db(jwt)
    storage = _storage(jwt)

    existing = db.fetch_filtered(TABLE, filters={"user_id": user.id}, record_id=memory_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Memory not found"},
        )

    # Delete photo from private storage
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

    tags = row.get("tags") or []
    if isinstance(tags, str):
        try:
            tags = json.loads(tags)
        except Exception:
            tags = [t.strip() for t in tags.split(",") if t.strip()]

    return MemoryResponse(
        id=row["id"],
        user_id=row["user_id"],
        title=row["title"],
        description=row.get("description"),
        memory_date=row.get("memory_date"),
        category=row.get("category") or "Personal",
        tags=tags,
        photo_url=photo_url,
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )
