"""
Shared FastAPI dependencies.

Centralise JWT extraction so every route uses the same
Bearer-token parsing logic.
"""

from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

_bearer = HTTPBearer(auto_error=False)


def get_current_user_jwt(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> str:
    """
    Extract the JWT from the Authorization: Bearer <token> header.

    Raises 401 if the header is missing or malformed.
    Token validity is verified by Supabase in each service call.
    """
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "MISSING_TOKEN", "message": "Authentication token required"},
            headers={"WWW-Authenticate": "Bearer"},
        )
    return credentials.credentials
