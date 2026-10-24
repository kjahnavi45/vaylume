"""
Auth service — delegates to Supabase Auth.

Supabase handles:
  - Secure password hashing (bcrypt internally)
  - JWT issuance and refresh
  - Email verification / password reset flows

We NEVER touch or store raw passwords.
"""

from __future__ import annotations

from typing import Optional, Tuple

from fastapi import HTTPException, status
from gotrue.errors import AuthApiError
from supabase import create_client

from config.settings import get_settings
from models.schemas import (
    AuthResponse,
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    SignUpRequest,
    UserResponse,
)

settings = get_settings()


def _client():
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)


def _to_user_response(user) -> UserResponse:
    full_name = None
    if user.user_metadata:
        full_name = user.user_metadata.get("full_name")
    return UserResponse(
        id=str(user.id),
        email=user.email,
        full_name=full_name,
        created_at=user.created_at,
    )


# ─────────────────────────────────────────────────────────────────────────────

def signup(payload: SignUpRequest) -> AuthResponse:
    """Register a new user via Supabase Auth."""
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
        # Email confirmation required — Supabase sends the link automatically
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
        client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
        client.auth.set_session(access_token=jwt, refresh_token="")
        client.auth.sign_out()
    except Exception:
        pass  # Always return success to the client
    return MessageResponse(message="Logged out successfully")


def forgot_password(payload: ForgotPasswordRequest) -> MessageResponse:
    """Trigger Supabase password-reset email."""
    try:
        _client().auth.reset_password_for_email(payload.email)
    except AuthApiError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "RESET_FAILED", "message": str(exc)},
        )
    # Always return a vague message to prevent email enumeration
    return MessageResponse(
        message="If that email exists, a password reset link has been sent."
    )


def get_current_user(jwt: str) -> UserResponse:
    """Verify JWT and return the authenticated user."""
    try:
        client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
        client.auth.set_session(access_token=jwt, refresh_token="")
        resp = client.auth.get_user(jwt)
    except AuthApiError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": "Invalid or expired token"},
        )

    if resp is None or resp.user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHENTICATED", "message": "Authentication required"},
        )

    return _to_user_response(resp.user)
