"""
Digital Locker routes.

POST   /locker/upload        — Upload a private document (Vault-protected)
GET    /locker/files         — List all files for current user (Vault-protected)
GET    /locker/files/{id}    — Get metadata + signed download URL (Vault-protected)
DELETE /locker/files/{id}    — Delete a file permanently (Vault-protected)
"""

from __future__ import annotations

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
    DocumentCategory,
    LockerFileListResponse,
    LockerFileResponse,
    MessageResponse,
)
from services.auth_service import get_current_user
from services.database_service import DatabaseService, get_authed_client
from services.storage_service import StorageService
from utils.dependencies import get_current_user_jwt
from utils.vault_dependency import require_vault_unlocked

router = APIRouter(prefix="/locker", tags=["Digital Locker (Secure Document Vault)"])
settings = get_settings()

TABLE = "documents"


def _db(jwt: str) -> DatabaseService:
    return DatabaseService(get_authed_client(jwt))


def _storage(jwt: str) -> StorageService:
    return StorageService(get_authed_client(jwt))


# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/upload",
    response_model=LockerFileResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a document to the Secure Document Vault",
    description=(
        "Uploads a private document. Protected by Two-Step Vault Lock. "
        "Allowed categories: Identity, Education, Certificates, Career, Personal, Other. "
        "Max file size is configurable via MAX_LOCKER_FILE_SIZE_MB."
    ),
)
async def upload_file(
    category: DocumentCategory = Form(...),
    file: UploadFile = File(...),
    jwt: str = Depends(get_current_user_jwt),
    _vault: str = Depends(require_vault_unlocked),
):
    user = get_current_user(jwt)
    db = _db(jwt)
    storage = _storage(jwt)

    original_name = file.filename or "document"
    storage_path, unique_name, mime_type, size_bytes = storage.upload_locker_file(
        user.id, file
    )

    now = datetime.now(timezone.utc).isoformat()
    record = {
        "user_id": user.id,
        "file_name": unique_name,
        "original_name": original_name,
        "category": category.value,
        "mime_type": mime_type,
        "size_bytes": size_bytes,
        "storage_path": storage_path,
        "created_at": now,
    }

    try:
        inserted = db.insert(TABLE, record)
    except Exception as exc:
        storage.delete_file(settings.STORAGE_BUCKET_LOCKER, storage_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "DB_ERROR", "message": "Failed to save file record"},
        )

    return _to_response(inserted, storage)


@router.get(
    "/files",
    response_model=LockerFileListResponse,
    summary="List all vault documents for the current user",
)
def list_files(
    jwt: str = Depends(get_current_user_jwt),
    _vault: str = Depends(require_vault_unlocked),
):
    user = get_current_user(jwt)
    db = _db(jwt)
    storage = _storage(jwt)

    rows = db.fetch_all(TABLE, filters={"user_id": user.id}, order_by="created_at")
    files = [_to_response(r, storage) for r in rows]
    return LockerFileListResponse(files=files, total=len(files))


@router.get(
    "/files/{file_id}",
    response_model=LockerFileResponse,
    summary="Get a specific locker file with a short-lived signed download URL",
)
def get_file(
    file_id: UUID,
    jwt: str = Depends(get_current_user_jwt),
    _vault: str = Depends(require_vault_unlocked),
):
    user = get_current_user(jwt)
    db = _db(jwt)
    storage = _storage(jwt)

    row = db.fetch_filtered(TABLE, filters={"user_id": user.id}, record_id=file_id)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Document not found"},
        )
    return _to_response(row, storage)


@router.delete(
    "/files/{file_id}",
    response_model=MessageResponse,
    summary="Delete a locker file permanently",
)
def delete_file(
    file_id: UUID,
    jwt: str = Depends(get_current_user_jwt),
    _vault: str = Depends(require_vault_unlocked),
):
    user = get_current_user(jwt)
    db = _db(jwt)
    storage = _storage(jwt)

    row = db.fetch_filtered(TABLE, filters={"user_id": user.id}, record_id=file_id)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Document not found"},
        )

    storage.delete_file(settings.STORAGE_BUCKET_LOCKER, row["storage_path"])
    db.delete(TABLE, file_id)

    return MessageResponse(message="Document deleted permanently from secure vault")


# ─────────────────────────────────────────────────────────────────────────────
# Helper
# ─────────────────────────────────────────────────────────────────────────────

def _to_response(row: dict, storage: StorageService) -> LockerFileResponse:
    """Convert a DB row to LockerFileResponse with a short-lived signed URL."""
    download_url = storage.get_signed_url(
        settings.STORAGE_BUCKET_LOCKER, row["storage_path"]
    )
    return LockerFileResponse(
        id=row["id"],
        user_id=row["user_id"],
        file_name=row["file_name"],
        original_name=row["original_name"],
        category=row["category"],
        mime_type=row["mime_type"],
        size_bytes=row["size_bytes"],
        storage_path=row["storage_path"],
        download_url=download_url,
        created_at=row["created_at"],
    )
