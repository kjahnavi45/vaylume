"""
Pydantic schemas for request validation and response serialisation.
All schemas are immutable (frozen) where appropriate to prevent accidental mutation.
"""

from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


# ─────────────────────────────────────────────────────────────────────────────
# Enumerations
# ─────────────────────────────────────────────────────────────────────────────

class DocumentCategory(str, Enum):
    IDENTITY = "Identity"
    EDUCATION = "Education"
    CERTIFICATES = "Certificates"
    CAREER = "Career"
    PERSONAL = "Personal"
    OTHER = "Other"


class NoteLanguage(str, Enum):
    AUTO = "Auto"
    ENGLISH = "English"
    TELUGU = "Telugu"
    HINDI = "Hindi"
    GUJARATI = "Gujarati"
    MARATHI = "Marathi"
    KANNADA = "Kannada"
    TAMIL = "Tamil"
    MALAYALAM = "Malayalam"
    BENGALI = "Bengali"
    PUNJABI = "Punjabi"


class NoteDifficulty(str, Enum):
    BEGINNER = "Beginner"
    INTERMEDIATE = "Intermediate"
    ADVANCED = "Advanced"


class NoteFormat(str, Enum):
    PLAIN = "Plain"
    BULLETS = "Bullets"
    DETAILED = "Detailed"
    SUMMARY_ONLY = "Summary Only"


# ─────────────────────────────────────────────────────────────────────────────
# Auth & User Profile
# ─────────────────────────────────────────────────────────────────────────────

class SignUpRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, description="Minimum 8 characters")
    full_name: str = Field(..., min_length=1, max_length=120)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: Optional[datetime] = None


class UserProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=120)
    phone: Optional[str] = Field(None, max_length=20)
    bio: Optional[str] = Field(None, max_length=500)
    avatar_url: Optional[str] = None


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class MessageResponse(BaseModel):
    message: str


class AccountDeleteRequest(BaseModel):
    confirm_text: str = Field(..., description="Must exactly match 'DELETE MY ACCOUNT'")
    password: Optional[str] = None


class DataExportResponse(BaseModel):
    user: UserResponse
    preferences: Optional[Dict[str, Any]] = None
    memories: List[Dict[str, Any]] = Field(default_factory=list)
    notes: List[Dict[str, Any]] = Field(default_factory=list)
    documents: List[Dict[str, Any]] = Field(default_factory=list)
    conversations: List[Dict[str, Any]] = Field(default_factory=list)
    messages: List[Dict[str, Any]] = Field(default_factory=list)
    exported_at: datetime
    disclaimer: str = (
        "This export contains your personal digital records stored in VAYLUME. "
        "Sensitive documents and photos should be downloaded separately via your private locker."
    )


# ─────────────────────────────────────────────────────────────────────────────
# Themes & Personalization
# ─────────────────────────────────────────────────────────────────────────────

class UserPreferencesRequest(BaseModel):
    preferred_language: Optional[str] = "English"
    theme: Optional[str] = "dark" # "dark", "light", "preset"
    preset_theme: Optional[str] = "cyan" # "cyan", "purple", "emerald", "amber", "minimal"
    custom_accent: Optional[str] = "#00f2fe"
    wallpaper_url: Optional[str] = None
    wallpaper_blur: Optional[int] = Field(0, ge=0, le=30)
    wallpaper_brightness: Optional[int] = Field(100, ge=20, le=150)
    wallpaper_overlay_opacity: Optional[int] = Field(40, ge=0, le=95)
    auto_lock_minutes: Optional[int] = Field(5, ge=0, le=120)


class UserPreferencesResponse(UserPreferencesRequest):
    id: UUID
    user_id: str
    created_at: datetime
    updated_at: datetime


# ─────────────────────────────────────────────────────────────────────────────
# Vault Security (Two-Step Lock: Biometric/Passkey + 3x3 Pattern Lock)
# ─────────────────────────────────────────────────────────────────────────────

class VaultStatusResponse(BaseModel):
    is_setup: bool
    has_webauthn: bool = False
    has_fallback_pin: bool = False


class VaultSetupRequest(BaseModel):
    pattern_hash: str = Field(..., min_length=16, max_length=128, description="SHA-256 hash of pattern sequence")
    webauthn_credential_id: Optional[str] = None
    webauthn_public_key: Optional[str] = None
    has_webauthn: bool = False
    fallback_pin_hash: Optional[str] = None


class VaultVerifyBiometricRequest(BaseModel):
    credential_id: Optional[str] = None
    authenticator_data: Optional[str] = None
    client_data_json: Optional[str] = None
    signature: Optional[str] = None
    fallback_pin_hash: Optional[str] = None


class VaultVerifyBiometricResponse(BaseModel):
    biometric_token: str
    message: str = "Biometric passkey verified"


class VaultVerifyPatternRequest(BaseModel):
    pattern_hash: str = Field(..., min_length=16, max_length=128)
    biometric_token: Optional[str] = None


class VaultTokenResponse(BaseModel):
    vault_token: str
    expires_in: int = 3600
    message: str = "Vault unlocked successfully"


# ─────────────────────────────────────────────────────────────────────────────
# Memories
# ─────────────────────────────────────────────────────────────────────────────

class MemoryCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    memory_date: Optional[date] = None
    category: Optional[str] = Field("Personal", max_length=50)
    tags: Optional[List[str]] = Field(default_factory=list)


class MemoryUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    memory_date: Optional[date] = None
    category: Optional[str] = Field(None, max_length=50)
    tags: Optional[List[str]] = None


class MemoryResponse(BaseModel):
    id: UUID
    user_id: str
    title: str
    description: Optional[str] = None
    memory_date: Optional[date] = None
    category: Optional[str] = "Personal"
    tags: Optional[List[str]] = Field(default_factory=list)
    photo_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class MemoryListResponse(BaseModel):
    memories: List[MemoryResponse]
    total: int


class BatchMemoryResponse(BaseModel):
    memories: List[MemoryResponse]
    total_uploaded: int
    errors: List[str] = Field(default_factory=list)


# ─────────────────────────────────────────────────────────────────────────────
# AI Notes & Cloud Persistence
# ─────────────────────────────────────────────────────────────────────────────

class NoteGenerateRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=300)
    language: NoteLanguage = NoteLanguage.AUTO
    detected_language: Optional[str] = Field(None, description="Client or server detected language")
    interest: Optional[str] = Field(None, max_length=200, description="User's interest area for personalised examples")
    difficulty: NoteDifficulty = NoteDifficulty.INTERMEDIATE
    format: NoteFormat = NoteFormat.BULLETS


class NoteResponse(BaseModel):
    title: str
    explanation: str
    key_points: List[str]
    examples: List[str]
    summary: str
    language: str
    detected_language: Optional[str] = None
    topic: str
    generated_at: datetime


class NoteSaveRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=300)
    title: str = Field(..., min_length=1, max_length=300)
    explanation: str
    key_points: List[str] = Field(default_factory=list)
    examples: List[str] = Field(default_factory=list)
    summary: str
    language: str = "English"
    difficulty: str = "Intermediate"
    format: str = "Bullets"
    tags: Optional[List[str]] = Field(default_factory=list)


class NoteSavedResponse(NoteResponse):
    id: UUID
    user_id: str
    tags: Optional[List[str]] = Field(default_factory=list)
    created_at: datetime


class NoteListResponse(BaseModel):
    notes: List[NoteSavedResponse]
    total: int


# ─────────────────────────────────────────────────────────────────────────────
# Digital Locker
# ─────────────────────────────────────────────────────────────────────────────

class LockerFileResponse(BaseModel):
    id: UUID
    user_id: str
    file_name: str
    original_name: str
    category: DocumentCategory
    mime_type: str
    size_bytes: int
    storage_path: str
    download_url: Optional[str] = None
    created_at: datetime


class LockerFileListResponse(BaseModel):
    files: List[LockerFileResponse]
    total: int


# ─────────────────────────────────────────────────────────────────────────────
# Private 1-on-1 User-to-User Chat
# ─────────────────────────────────────────────────────────────────────────────

class ConversationCreateRequest(BaseModel):
    recipient_email: Optional[EmailStr] = None
    recipient_id: Optional[str] = None


class MessageSendRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)


class MessageItemResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    sender_id: str
    recipient_id: str
    content: str
    status: str = "sent" # "sent", "delivered", "read"
    created_at: datetime


class ConversationResponse(BaseModel):
    id: UUID
    participant_id: str
    participant_email: str
    participant_name: Optional[str] = None
    status: str = "accepted" # "accepted", "pending", "blocked"
    last_message: Optional[str] = None
    last_message_at: datetime
    unread_count: int = 0
    created_at: datetime


class ConversationListResponse(BaseModel):
    conversations: List[ConversationResponse]
    total: int


class MessageListResponse(BaseModel):
    messages: List[MessageItemResponse]
    conversation: ConversationResponse


class BlockUserRequest(BaseModel):
    user_id: str
    reason: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# Generic error
# ─────────────────────────────────────────────────────────────────────────────

class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Optional[Any] = None
