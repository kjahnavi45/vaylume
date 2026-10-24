"""
Vault authentication dependency.

Ensures that if a user has configured their Two-Step Lock (WebAuthn + 3x3 Pattern),
they must supply a valid, non-expired X-Vault-Token to access Memories.
"""

from __future__ import annotations

from typing import Optional

from fastapi import Depends, Header, HTTPException, status

from services.auth_service import get_current_user
from services.database_service import DatabaseService, get_authed_client
from utils.dependencies import get_current_user_jwt
from utils.vault_crypto import verify_vault_token


def require_vault_unlocked(
    x_vault_token: Optional[str] = Header(None, alias="X-Vault-Token"),
    jwt: str = Depends(get_current_user_jwt),
) -> str:
    """
    Dependency that enforces Two-Step Lock validation on protected vault resources.

    If the user has completed vault security setup, a valid X-Vault-Token is strictly required.
    """
    user = get_current_user(jwt)
    db = DatabaseService(get_authed_client(jwt))

    # Check if user has configured vault security
    row = db.fetch_filtered("vault_security", filters={"user_id": user.id}, record_id=user.id, id_column="user_id")

    if row and row.get("is_setup_complete", False):
        if not x_vault_token:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "VAULT_LOCKED",
                    "message": "Vault is locked. Two-step authentication (Biometric + Pattern) is required.",
                },
            )
        if not verify_vault_token(x_vault_token, user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "VAULT_TOKEN_INVALID",
                    "message": "Vault session expired or invalid. Please re-authenticate.",
                },
            )

    return user.id
