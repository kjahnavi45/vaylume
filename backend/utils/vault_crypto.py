"""
Vault cryptographic token utilities.

Issues and verifies tamper-proof, HMAC-SHA256 signed tokens for:
1. Biometric/passkey verification (Step 1 -> Step 2 transition token, 5 min TTL)
2. Full vault session unlock (X-Vault-Token, 1 hour TTL)
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from typing import Optional

from config.settings import get_settings

settings = get_settings()

# Secret key derivation: use SUPABASE_ANON_KEY or a secure fallback
_SECRET = (
    settings.SUPABASE_ANON_KEY
    if settings.SUPABASE_ANON_KEY and "your-anon-key" not in settings.SUPABASE_ANON_KEY
    else "vaylume_vault_internal_secure_hmac_secret_key_2026"
).encode("utf-8")


def _sign(payload_str: str) -> str:
    h = hmac.new(_SECRET, payload_str.encode("utf-8"), hashlib.sha256)
    return base64.urlsafe_b64encode(h.digest()).decode("utf-8").rstrip("=")


def _create_token(user_id: str, token_type: str, ttl_seconds: int) -> str:
    now = int(time.time())
    payload = {
        "sub": user_id,
        "type": token_type,
        "iat": now,
        "exp": now + ttl_seconds,
    }
    payload_json = json.dumps(payload, separators=(",", ":"))
    payload_b64 = base64.urlsafe_b64encode(payload_json.encode("utf-8")).decode("utf-8").rstrip("=")
    signature = _sign(payload_b64)
    return f"{payload_b64}.{signature}"


def _verify_token(token: str, expected_user_id: str, expected_type: str) -> bool:
    if not token or "." not in token:
        return False
    parts = token.split(".")
    if len(parts) != 2:
        return False
    payload_b64, signature = parts
    # Check HMAC
    expected_sig = _sign(payload_b64)
    if not hmac.compare_digest(signature, expected_sig):
        return False

    # Decode JSON payload
    try:
        # Re-pad b64 if needed
        padded = payload_b64 + "=" * (-len(payload_b64) % 4)
        raw = base64.urlsafe_b64decode(padded.encode("utf-8")).decode("utf-8")
        data = json.loads(raw)
    except Exception:
        return False

    if data.get("sub") != expected_user_id:
        return False
    if data.get("type") != expected_type:
        return False
    if data.get("exp", 0) < int(time.time()):
        return False

    return True


def generate_biometric_token(user_id: str, ttl_seconds: int = 300) -> str:
    """Generate a 5-minute intermediate token proving biometric/PIN passed."""
    return _create_token(user_id, "bio_verified", ttl_seconds)


def verify_biometric_token(token: str, user_id: str) -> bool:
    """Verify that the biometric intermediate token is valid and not expired."""
    return _verify_token(token, user_id, "bio_verified")


def generate_vault_token(user_id: str, ttl_seconds: int = 3600) -> str:
    """Generate a 1-hour session token for unlocked vault access."""
    return _create_token(user_id, "vault_session", ttl_seconds)


def verify_vault_token(token: str, user_id: str) -> bool:
    """Verify that the vault unlock session token is valid and not expired."""
    return _verify_token(token, user_id, "vault_session")
