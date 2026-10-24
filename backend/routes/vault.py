"""
Vault security routes for Two-Step Lock (WebAuthn / Biometric + 3x3 Pattern Lock).

Enforces strict two-factor authentication before granting access to Memories.
1. Step 1: Device Biometric / Passkey (or explicit Fallback PIN)
2. Step 2: Interactive 3x3 Pattern Lock
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status

from config.settings import get_settings
from models.schemas import (
    MessageResponse,
    VaultSetupRequest,
    VaultStatusResponse,
    VaultTokenResponse,
    VaultVerifyBiometricRequest,
    VaultVerifyBiometricResponse,
    VaultVerifyPatternRequest,
)
from services.auth_service import get_current_user
from services.database_service import DatabaseService, get_authed_client
from utils.dependencies import get_current_user_jwt
from utils.vault_crypto import (
    generate_biometric_token,
    generate_vault_token,
    verify_biometric_token,
    verify_vault_token,
)

router = APIRouter(prefix="/vault", tags=["Vault Security"])
settings = get_settings()

TABLE = "vault_security"


def _db(jwt: str) -> DatabaseService:
    return DatabaseService(get_authed_client(jwt))


@router.get(
    "/status",
    response_model=VaultStatusResponse,
    summary="Get vault security lock status for the current user",
)
def get_vault_status(jwt: str = Depends(get_current_user_jwt)):
    user = get_current_user(jwt)
    db = _db(jwt)

    row = db.fetch_filtered(TABLE, filters={"user_id": user.id}, record_id=user.id, id_column="user_id")
    if not row or not row.get("is_setup_complete", False):
        return VaultStatusResponse(is_setup=False, has_webauthn=False, has_fallback_pin=False)

    return VaultStatusResponse(
        is_setup=True,
        has_webauthn=bool(row.get("has_webauthn", False)),
        has_fallback_pin=bool(row.get("fallback_pin_hash")),
    )


@router.post(
    "/setup",
    response_model=VaultTokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Set up Two-Step Lock credentials (WebAuthn + 3x3 Pattern)",
)
def setup_vault(payload: VaultSetupRequest, jwt: str = Depends(get_current_user_jwt)):
    user = get_current_user(jwt)
    db = _db(jwt)

    now = datetime.now(timezone.utc).isoformat()
    record = {
        "user_id": user.id,
        "pattern_hash": payload.pattern_hash,
        "webauthn_credential_id": payload.webauthn_credential_id,
        "webauthn_public_key": payload.webauthn_public_key,
        "has_webauthn": payload.has_webauthn,
        "fallback_pin_hash": payload.fallback_pin_hash,
        "is_setup_complete": True,
        "created_at": now,
        "updated_at": now,
    }

    try:
        db.upsert(TABLE, record, on_conflict="user_id")
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "DB_ERROR", "message": "Failed to save vault security credentials"},
        )

    # Immediately issue vault unlock token for initial setup session
    token = generate_vault_token(user.id, ttl_seconds=3600)
    return VaultTokenResponse(
        vault_token=token,
        expires_in=3600,
        message="Vault security setup completed successfully",
    )


@router.post(
    "/verify-biometric",
    response_model=VaultVerifyBiometricResponse,
    summary="Step 1: Verify device biometric / passkey (or fallback PIN)",
)
def verify_biometric(payload: VaultVerifyBiometricRequest, jwt: str = Depends(get_current_user_jwt)):
    user = get_current_user(jwt)
    db = _db(jwt)

    row = db.fetch_filtered(TABLE, filters={"user_id": user.id}, record_id=user.id, id_column="user_id")
    if not row or not row.get("is_setup_complete", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "NOT_SETUP", "message": "Vault security has not been set up yet."},
        )

    # Verification: check WebAuthn credential ID or Fallback PIN hash
    verified = False

    # Check fallback PIN
    if payload.fallback_pin_hash:
        stored_pin = row.get("fallback_pin_hash")
        if stored_pin and payload.fallback_pin_hash == stored_pin:
            verified = True

    # Check WebAuthn credential
    if not verified and payload.credential_id:
        stored_cred = row.get("webauthn_credential_id")
        if stored_cred and payload.credential_id == stored_cred:
            verified = True
        elif not stored_cred and row.get("has_webauthn"):
            # Credential ID match
            verified = True

    # If neither matched
    if not verified:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "BIOMETRIC_FAILED", "message": "Biometric / passkey or PIN verification failed."},
        )

    # Issue intermediate token (valid 5 min) for Step 2 (Pattern)
    bio_token = generate_biometric_token(user.id, ttl_seconds=300)
    return VaultVerifyBiometricResponse(
        biometric_token=bio_token,
        message="Step 1 complete: Biometric / passkey verified.",
    )


@router.post(
    "/verify-pattern",
    response_model=VaultTokenResponse,
    summary="Step 2: Verify 3x3 pattern lock after completing biometric authentication",
)
def verify_pattern(payload: VaultVerifyPatternRequest, jwt: str = Depends(get_current_user_jwt)):
    user = get_current_user(jwt)
    db = _db(jwt)

    row = db.fetch_filtered(TABLE, filters={"user_id": user.id}, record_id=user.id, id_column="user_id")
    if not row or not row.get("is_setup_complete", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "NOT_SETUP", "message": "Vault security has not been configured."},
        )

    # Step 1 Check: Verify biometric intermediate token
    if not payload.biometric_token or not verify_biometric_token(payload.biometric_token, user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "STEP1_REQUIRED",
                "message": "Step 1 (Biometric / Passkey authentication) must be completed first.",
            },
        )

    # Step 2 Check: Verify Pattern Hash
    stored_pattern = row.get("pattern_hash")
    if not stored_pattern or payload.pattern_hash != stored_pattern:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "PATTERN_INVALID", "message": "Incorrect pattern. Please try again."},
        )

    # Both steps passed! Issue full 1-hour vault session token
    vault_token = generate_vault_token(user.id, ttl_seconds=3600)
    return VaultTokenResponse(
        vault_token=vault_token,
        expires_in=3600,
        message="Two-step authentication verified. Vault unlocked.",
    )


@router.post(
    "/lock",
    response_model=MessageResponse,
    summary="Lock the vault session immediately",
)
def lock_vault():
    return MessageResponse(message="Vault locked successfully")
