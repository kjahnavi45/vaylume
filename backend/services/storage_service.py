"""
Storage service — manages file uploads/downloads via Supabase Storage.

Security model:
  - Files are stored at  <bucket>/<user_id>/<filename>  so paths are namespaced per user.
  - Buckets must be configured as PRIVATE in Supabase (no public URLs).
  - Download access is granted via short-lived signed URLs (1 hour).
  - File type and size are validated BEFORE upload.
  - In-memory fallback provided when running offline or in tests.
"""

from __future__ import annotations

import base64
import io
import logging
import mimetypes
import uuid
from typing import Dict, Optional, Tuple

from fastapi import HTTPException, UploadFile, status
from supabase import Client

from config.settings import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Allowed MIME types
ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/heic",
    "image/heif",
}

ALLOWED_LOCKER_TYPES = {
    # Documents
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    # Images (IDs, scans)
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/tiff",
    # Plain text / data
    "text/plain",
    "text/csv",
}

SIGNED_URL_EXPIRY_SECONDS = 3600  # 1 hour

# Thread-safe in-memory file cache for mock/offline mode
_MOCK_STORAGE: Dict[str, Tuple[bytes, str]] = {}


class StorageService:
    def __init__(self, client: Optional[Client]):
        self._storage = client.storage if client is not None else None

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _validate_file(
        self,
        file: UploadFile,
        allowed_types: set[str],
        max_size_mb: int,
    ) -> Tuple[str, int]:
        """
        Validate MIME type and file size.
        Returns (mime_type, size_bytes) on success or raises HTTPException.
        """
        mime = file.content_type or ""
        if not mime or mime == "application/octet-stream":
            guessed, _ = mimetypes.guess_type(file.filename or "")
            mime = guessed or "application/octet-stream"

        if mime not in allowed_types:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail={
                    "code": "INVALID_FILE_TYPE",
                    "message": f"File type '{mime}' is not allowed. Supported formats: JPG, PNG, WebP.",
                },
            )

        max_bytes = max_size_mb * 1024 * 1024
        content = file.file.read(max_bytes + 1)
        size = len(content)

        if size > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail={
                    "code": "FILE_TOO_LARGE",
                    "message": f"File exceeds the {max_size_mb} MB limit.",
                },
            )

        file.file = io.BytesIO(content)
        return mime, size

    def _storage_path(self, user_id: str, original_filename: str) -> Tuple[str, str]:
        """Generate a collision-safe storage path and a sanitised file name."""
        ext = ""
        if original_filename and "." in original_filename:
            ext = "." + original_filename.rsplit(".", 1)[-1].lower()
        unique_name = f"{uuid.uuid4().hex}{ext}"
        path = f"{user_id}/{unique_name}"
        return path, unique_name

    # ── Public API ────────────────────────────────────────────────────────────

    def upload_memory_photo(
        self, user_id: str, file: UploadFile
    ) -> Tuple[str, str, int]:
        """Upload a memory photo."""
        mime, size = self._validate_file(
            file,
            ALLOWED_IMAGE_TYPES,
            settings.MAX_MEMORY_IMAGE_SIZE_MB,
        )
        path, unique_name = self._storage_path(user_id, file.filename or "photo.jpg")
        content = file.file.read()

        if self._storage is not None:
            try:
                self._storage.from_(settings.STORAGE_BUCKET_MEMORIES).upload(
                    path=path,
                    file=content,
                    file_options={"content-type": mime, "upsert": "false"},
                )
            except Exception as exc:
                logger.error("Memory photo upload failed: %s", exc, exc_info=True)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail={"code": "UPLOAD_FAILED", "message": "Photo upload failed"},
                )
        else:
            _MOCK_STORAGE[f"{settings.STORAGE_BUCKET_MEMORIES}/{path}"] = (content, mime)

        return path, unique_name, size

    def upload_wallpaper(
        self, user_id: str, file: UploadFile
    ) -> Tuple[str, str, int]:
        """Upload a custom wallpaper photo."""
        mime, size = self._validate_file(
            file,
            ALLOWED_IMAGE_TYPES,
            settings.MAX_MEMORY_IMAGE_SIZE_MB,
        )
        path, unique_name = self._storage_path(user_id, file.filename or "wallpaper.jpg")
        content = file.file.read()

        bucket = getattr(settings, "STORAGE_BUCKET_WALLPAPERS", "wallpapers")
        if self._storage is not None:
            try:
                self._storage.from_(bucket).upload(
                    path=path,
                    file=content,
                    file_options={"content-type": mime, "upsert": "false"},
                )
            except Exception as exc:
                logger.error("Wallpaper upload failed: %s", exc, exc_info=True)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail={"code": "UPLOAD_FAILED", "message": "Wallpaper upload failed"},
                )
        else:
            _MOCK_STORAGE[f"{bucket}/{path}"] = (content, mime)

        return path, unique_name, size

    def upload_locker_file(
        self, user_id: str, file: UploadFile
    ) -> Tuple[str, str, str, int]:
        """Upload a locker document."""
        mime, size = self._validate_file(
            file,
            ALLOWED_LOCKER_TYPES,
            settings.MAX_LOCKER_FILE_SIZE_MB,
        )
        path, unique_name = self._storage_path(user_id, file.filename or "document")
        content = file.file.read()

        if self._storage is not None:
            try:
                self._storage.from_(settings.STORAGE_BUCKET_LOCKER).upload(
                    path=path,
                    file=content,
                    file_options={"content-type": mime, "upsert": "false"},
                )
            except Exception as exc:
                logger.error("Locker file upload failed: %s", exc, exc_info=True)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail={"code": "UPLOAD_FAILED", "message": "File upload failed"},
                )
        else:
            _MOCK_STORAGE[f"{settings.STORAGE_BUCKET_LOCKER}/{path}"] = (content, mime)

        return path, unique_name, mime, size

    def get_signed_url(self, bucket: str, path: str) -> Optional[str]:
        """Generate a short-lived signed URL for private file access."""
        if self._storage is not None:
            try:
                resp = self._storage.from_(bucket).create_signed_url(
                    path=path,
                    expires_in=SIGNED_URL_EXPIRY_SECONDS,
                )
                return resp.get("signedURL") or resp.get("signedUrl")
            except Exception as exc:
                logger.warning("Could not generate signed URL for %s/%s: %s", bucket, path, exc)
                return None
        else:
            key = f"{bucket}/{path}"
            if key in _MOCK_STORAGE:
                content, mime = _MOCK_STORAGE[key]
                b64 = base64.b64encode(content).decode("utf-8")
                return f"data:{mime};base64,{b64}"
            return f"https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80"

    def delete_file(self, bucket: str, path: str) -> bool:
        """Delete a file from a storage bucket."""
        if self._storage is not None:
            try:
                self._storage.from_(bucket).remove([path])
                return True
            except Exception as exc:
                logger.error("Storage delete failed for %s/%s: %s", bucket, path, exc)
                return False
        else:
            key = f"{bucket}/{path}"
            _MOCK_STORAGE.pop(key, None)
            return True
