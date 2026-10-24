"""
Authentication & Profile routes.

POST   /auth/signup               — Register a new user
POST   /auth/login                — Login with email + password
POST   /auth/logout               — Invalidate current session
POST   /auth/forgot-password      — Trigger password-reset email
GET    /auth/me                   — Return authenticated user
PUT    /auth/me                   — Update user profile
GET    /auth/preferences          — Get user themes, accent, wallpaper & vault timer
PUT    /auth/preferences          — Save user personalization settings
POST   /auth/preferences/wallpaper — Upload custom background wallpaper
GET    /auth/export               — Export complete digital life data archive
DELETE /auth/me                   — Permanently delete user account and all data
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

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
from services import auth_service
from services.storage_service import StorageService
from services.database_service import get_authed_client
from utils.dependencies import get_current_user_jwt

router = APIRouter(prefix="/auth", tags=["Authentication & Profile"])


@router.post(
    "/signup",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
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


@router.put(
    "/me",
    response_model=UserResponse,
    summary="Update user profile information",
)
def update_profile(
    payload: UserProfileUpdateRequest,
    jwt: str = Depends(get_current_user_jwt),
):
    return auth_service.update_profile(jwt, payload)


@router.get(
    "/preferences",
    response_model=UserPreferencesResponse,
    summary="Get user theme, accent, and personalization settings",
)
def get_preferences(jwt: str = Depends(get_current_user_jwt)):
    return auth_service.get_preferences(jwt)


@router.put(
    "/preferences",
    response_model=UserPreferencesResponse,
    summary="Save user theme, wallpaper and personalization settings",
)
def update_preferences(
    payload: UserPreferencesRequest,
    jwt: str = Depends(get_current_user_jwt),
):
    return auth_service.update_preferences(jwt, payload)


@router.post(
    "/preferences/wallpaper",
    response_model=UserPreferencesResponse,
    summary="Upload custom background wallpaper image",
)
def upload_wallpaper(
    file: UploadFile = File(...),
    jwt: str = Depends(get_current_user_jwt),
):
    user = auth_service.get_current_user(jwt)
    storage = StorageService(get_authed_client(jwt))

    path, _, _ = storage.upload_wallpaper(user.id, file)
    wallpaper_url = storage.get_signed_url("wallpapers", path)

    # Save to user preferences
    req = UserPreferencesRequest(wallpaper_url=wallpaper_url)
    return auth_service.update_preferences(jwt, req)


@router.get(
    "/export",
    response_model=DataExportResponse,
    summary="Export all personal digital life data",
)
def export_my_data(jwt: str = Depends(get_current_user_jwt)):
    return auth_service.export_user_data(jwt)


@router.delete(
    "/me",
    response_model=MessageResponse,
    summary="Permanently delete user account and all personal records",
)
def delete_account(
    payload: AccountDeleteRequest,
    jwt: str = Depends(get_current_user_jwt),
):
    return auth_service.delete_account(jwt, payload)
