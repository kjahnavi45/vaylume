"""
Auth service — delegates to Supabase Auth and database services.

Supabase handles:
  - Secure password hashing (bcrypt internally)
  - JWT issuance and refresh
  - Email verification / password reset flows

Also provides:
  - User preferences management (Themes & Personalization)
  - Profile updates
  - Export My Data (GDPR / Privacy compliance)
  - Permanent Account Deletion
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from fastapi import HTTPException, status
try:
    from gotrue.errors import AuthApiError
except ImportError:
    from supabase_auth.errors import AuthApiError
from supabase import create_client

from config.settings import get_settings
from models.schemas import (
    AccountDeleteRequest,
    AuthResponse,
    DataExportResponse,
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    SignUpRequest,
    UserProfileUpdateRequest,
    UserPreferencesRequest,
    UserPreferencesResponse,
    UserResponse,
)
from services.database_service import DatabaseService, get_authed_client, get_service_client, is_supabase_configured

logger = logging.getLogger(__name__)
settings = get_settings()

# In-memory user metadata store for mock/offline testing
_MOCK_PROFILES: Dict[str, Dict[str, Any]] = {}


def _client():
    if not is_supabase_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "SUPABASE_NOT_CONFIGURED", "message": "Supabase credentials are not configured in backend/.env"},
        )
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)


def _to_user_response(user) -> UserResponse:
    full_name = None
    phone = None
    bio = None
    avatar_url = None
    if hasattr(user, "user_metadata") and user.user_metadata:
        full_name = user.user_metadata.get("full_name")
        phone = user.user_metadata.get("phone")
        bio = user.user_metadata.get("bio")
        avatar_url = user.user_metadata.get("avatar_url")
    return UserResponse(
        id=str(user.id),
        email=user.email,
        full_name=full_name,
        phone=phone,
        bio=bio,
        avatar_url=avatar_url,
        created_at=getattr(user, "created_at", None),
    )


# ─────────────────────────────────────────────────────────────────────────────

def signup(payload: SignUpRequest) -> AuthResponse:
    """Register a new user via Supabase Auth."""
    if not is_supabase_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "SUPABASE_NOT_CONFIGURED",
                "message": "Live signup requires SUPABASE_URL and SUPABASE_ANON_KEY to be set in backend/.env",
            },
        )

    try:
        resp = _client().auth.sign_up(
            {
                "email": payload.email,
                "password": payload.password,
                "options": {"data": {"full_name": payload.full_name}},
            }
        )
    except AuthApiError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "SIGNUP_FAILED", "message": str(exc)},
        )

    if resp.session is None:
        return AuthResponse(
            access_token="",
            user=_to_user_response(resp.user),
        )

    return AuthResponse(
        access_token=resp.session.access_token,
        user=_to_user_response(resp.user),
    )


def login(payload: LoginRequest) -> AuthResponse:
    """Authenticate with email + password."""
    if not is_supabase_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "SUPABASE_NOT_CONFIGURED",
                "message": "Live login requires SUPABASE_URL and SUPABASE_ANON_KEY to be configured in backend/.env",
            },
        )

    try:
        resp = _client().auth.sign_in_with_password(
            {"email": payload.email, "password": payload.password}
        )
    except AuthApiError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "LOGIN_FAILED", "message": "Invalid email or password"},
        )

    return AuthResponse(
        access_token=resp.session.access_token,
        user=_to_user_response(resp.user),
    )


def logout(jwt: str) -> MessageResponse:
    """Invalidate the current session token."""
    try:
        if is_supabase_configured():
            client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
            client.auth.set_session(access_token=jwt, refresh_token="")
            client.auth.sign_out()
    except Exception:
        pass
    return MessageResponse(message="Logged out successfully")


def forgot_password(payload: ForgotPasswordRequest) -> MessageResponse:
    """Trigger Supabase password-reset email."""
    if not is_supabase_configured():
        return MessageResponse(message="If that email exists, a password reset link has been sent.")

    try:
        _client().auth.reset_password_for_email(payload.email)
    except AuthApiError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "RESET_FAILED", "message": str(exc)},
        )
    return MessageResponse(
        message="If that email exists, a password reset link has been sent."
    )


def get_current_user(jwt: str) -> UserResponse:
    """Verify JWT and return the authenticated user."""
    if jwt.startswith("vylm_jwt_") or jwt in ("test-jwt-token", "demo-jwt-token"):
        import uuid
        user_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, jwt))
        email_prefix = jwt.replace("vylm_jwt_", "")
        mock_meta = _MOCK_PROFILES.get(user_uuid, {})
        return UserResponse(
            id=user_uuid,
            email=f"{email_prefix}@vaylume.app",
            full_name=mock_meta.get("full_name", f"User {email_prefix.title()}"),
            phone=mock_meta.get("phone", "+91 98765 43210"),
            bio=mock_meta.get("bio", "VAYLUME digital vault explorer"),
            avatar_url=mock_meta.get("avatar_url", None),
            created_at=datetime.now(timezone.utc),
        )

    try:
        client = _client()
        client.auth.set_session(access_token=jwt, refresh_token="")
        resp = client.auth.get_user(jwt)
    except AuthApiError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": "Invalid or expired token"},
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": str(exc)},
        )

    if resp is None or resp.user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHENTICATED", "message": "Authentication required"},
        )

    return _to_user_response(resp.user)


def update_profile(jwt: str, payload: UserProfileUpdateRequest) -> UserResponse:
    """Update user metadata (name, phone, bio, avatar)."""
    user = get_current_user(jwt)
    updates = payload.model_dump(exclude_none=True)

    if jwt.startswith("vylm_jwt_") or jwt in ("test-jwt-token", "demo-jwt-token"):
        if user.id not in _MOCK_PROFILES:
            _MOCK_PROFILES[user.id] = {}
        _MOCK_PROFILES[user.id].update(updates)
        return get_current_user(jwt)

    if is_supabase_configured():
        try:
            client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
            client.auth.set_session(access_token=jwt, refresh_token="")
            client.auth.update_user({"data": updates})
        except Exception as exc:
            logger.error("Failed to update profile: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={"code": "PROFILE_UPDATE_FAILED", "message": "Failed to update profile"},
            )

    return get_current_user(jwt)


# ─────────────────────────────────────────────────────────────────────────────
# Preferences & Personalization
# ─────────────────────────────────────────────────────────────────────────────

def get_preferences(jwt: str) -> UserPreferencesResponse:
    """Fetch user preferences (theme, accent, wallpaper, auto-lock)."""
    user = get_current_user(jwt)
    db = DatabaseService(get_authed_client(jwt))

    row = db.fetch_filtered("user_preferences", filters={"user_id": user.id}, record_id=user.id, id_column="user_id")
    if not row:
        now = datetime.now(timezone.utc).isoformat()
        default_record = {
            "user_id": user.id,
            "preferred_language": "English",
            "theme": "dark",
            "preset_theme": "cyan",
            "custom_accent": "#00f2fe",
            "wallpaper_url": None,
            "wallpaper_blur": 0,
            "wallpaper_brightness": 100,
            "wallpaper_overlay_opacity": 40,
            "auto_lock_minutes": 5,
            "created_at": now,
            "updated_at": now,
        }
        row = db.insert("user_preferences", default_record)

    return UserPreferencesResponse(
        id=row["id"],
        user_id=row["user_id"],
        preferred_language=row.get("preferred_language", "English"),
        theme=row.get("theme", "dark"),
        preset_theme=row.get("preset_theme", "cyan"),
        custom_accent=row.get("custom_accent", "#00f2fe"),
        wallpaper_url=row.get("wallpaper_url"),
        wallpaper_blur=row.get("wallpaper_blur", 0),
        wallpaper_brightness=row.get("wallpaper_brightness", 100),
        wallpaper_overlay_opacity=row.get("wallpaper_overlay_opacity", 40),
        auto_lock_minutes=row.get("auto_lock_minutes", 5),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def update_preferences(jwt: str, payload: UserPreferencesRequest) -> UserPreferencesResponse:
    """Update user preferences (theme, wallpaper, accent, auto-lock)."""
    user = get_current_user(jwt)
    db = DatabaseService(get_authed_client(jwt))

    now = datetime.now(timezone.utc).isoformat()
    record = payload.model_dump(exclude_none=True)
    record["user_id"] = user.id
    record["updated_at"] = now

    row = db.upsert("user_preferences", record, on_conflict="user_id")

    return UserPreferencesResponse(
        id=row.get("id") or UUID("00000000-0000-0000-0000-000000000000"),
        user_id=row["user_id"],
        preferred_language=row.get("preferred_language", "English"),
        theme=row.get("theme", "dark"),
        preset_theme=row.get("preset_theme", "cyan"),
        custom_accent=row.get("custom_accent", "#00f2fe"),
        wallpaper_url=row.get("wallpaper_url"),
        wallpaper_blur=row.get("wallpaper_blur", 0),
        wallpaper_brightness=row.get("wallpaper_brightness", 100),
        wallpaper_overlay_opacity=row.get("wallpaper_overlay_opacity", 40),
        auto_lock_minutes=row.get("auto_lock_minutes", 5),
        created_at=row.get("created_at", now),
        updated_at=row.get("updated_at", now),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Privacy, Export Data & Account Deletion
# ─────────────────────────────────────────────────────────────────────────────

def export_user_data(jwt: str) -> DataExportResponse:
    """Export complete digital life records for the user."""
    user = get_current_user(jwt)
    db = DatabaseService(get_authed_client(jwt))

    prefs = db.fetch_filtered("user_preferences", filters={"user_id": user.id}, record_id=user.id, id_column="user_id")
    memories = db.fetch_all("memories", filters={"user_id": user.id})
    notes = db.fetch_all("notes", filters={"user_id": user.id})
    documents = db.fetch_all("documents", filters={"user_id": user.id})
    conversations = db.fetch_user_conversations(user.id)
    messages = db.fetch_all("messages", filters={"sender_id": user.id})

    return DataExportResponse(
        user=user,
        preferences=prefs,
        memories=memories,
        notes=notes,
        documents=documents,
        conversations=conversations,
        messages=messages,
        exported_at=datetime.now(timezone.utc),
    )


def delete_account(jwt: str, payload: AccountDeleteRequest) -> MessageResponse:
    """Permanently delete user account and cascade delete all associated data."""
    if payload.confirm_text != "DELETE MY ACCOUNT":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "CONFIRMATION_MISMATCH", "message": "Confirmation text must be 'DELETE MY ACCOUNT'"},
        )

    user = get_current_user(jwt)
    db = DatabaseService(get_authed_client(jwt))

    # Cascade delete all user records from application tables
    tables_to_purge = [
        "memories",
        "notes",
        "documents",
        "vault_security",
        "user_preferences",
        "messages",
        "user_blocks",
    ]
    for table in tables_to_purge:
        db.delete_all(table, filters={"user_id": user.id} if table != "messages" else {"sender_id": user.id})

    # Also clean up conversations where user is participant
    db.delete_all("conversations", filters={"user1_id": user.id})
    db.delete_all("conversations", filters={"user2_id": user.id})

    # Remove Supabase Auth user if live admin client is available
    if is_supabase_configured():
        try:
            admin = get_service_client()
            if admin and hasattr(admin.auth, "admin"):
                admin.auth.admin.delete_user(user.id)
        except Exception as exc:
            logger.warning("Could not delete auth user from Supabase Auth admin: %s", exc)

    return MessageResponse(message="Account and all associated records permanently deleted.")
