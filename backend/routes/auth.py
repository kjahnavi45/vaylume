"""
Authentication routes.

POST /auth/signup         — Register a new user
POST /auth/login          — Login with email + password
POST /auth/logout         — Invalidate the current session
POST /auth/forgot-password — Trigger password-reset email
GET  /auth/me             — Return the currently authenticated user
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, status

from models.schemas import (
    AuthResponse,
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    SignUpRequest,
    UserResponse,
)
from services import auth_service
from utils.dependencies import get_current_user_jwt

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/signup",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
    description=(
        "Creates a new user account. Supabase may send a confirmation email "
        "depending on your project settings. The access_token will be empty "
        "until the email is verified."
    ),
)
def signup(payload: SignUpRequest):
    return auth_service.signup(payload)


@router.post(
    "/login",
    response_model=AuthResponse,
    summary="Login with email and password",
)
def login(payload: LoginRequest):
    return auth_service.login(payload)


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Logout and invalidate session",
)
def logout(jwt: str = Depends(get_current_user_jwt)):
    return auth_service.logout(jwt)


@router.post(
    "/forgot-password",
    response_model=MessageResponse,
    summary="Send password reset email",
    description=(
        "Sends a password reset email if the address exists. "
        "Always returns the same message to prevent email enumeration."
    ),
)
def forgot_password(payload: ForgotPasswordRequest):
    return auth_service.forgot_password(payload)


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get currently authenticated user",
)
def me(jwt: str = Depends(get_current_user_jwt)):
    return auth_service.get_current_user(jwt)
