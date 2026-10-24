"""
Database service — thin wrapper around the Supabase Python client.

All database access goes through this service so that:
  1. The rest of the code never imports supabase directly.
  2. RLS (Row Level Security) is respected by using the user's JWT when possible.
  3. Admin operations use the service-role client, never the anon key.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from supabase import Client, create_client

from config.settings import get_settings

settings = get_settings()


def _get_anon_client() -> Client:
    """Anon client — respects Row Level Security. Use for user-scoped operations."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY or "your-project" in settings.SUPABASE_URL:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "SUPABASE_NOT_CONFIGURED", "message": "Supabase credentials are not configured in backend/.env"},
        )
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)


def _get_service_client() -> Client:
    """Service-role client — bypasses RLS. Use only for admin / server-side tasks."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY or "your-project" in settings.SUPABASE_URL:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "SUPABASE_NOT_CONFIGURED", "message": "Supabase credentials are not configured in backend/.env"},
        )
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


def get_authed_client(jwt: str) -> Client:
    """Return an anon client with the user's JWT injected so RLS applies."""
    client = _get_anon_client()
    client.auth.set_session(access_token=jwt, refresh_token="")
    return client


# ── Re-export service client for admin tasks ─────────────────────────────────
def get_service_client() -> Client:
    return _get_service_client()


# ─────────────────────────────────────────────────────────────────────────────
# Generic CRUD helpers
# ─────────────────────────────────────────────────────────────────────────────

class DatabaseService:
    """
    Stateless helper that wraps Supabase PostgREST queries.
    Pass the authed_client from get_authed_client() for user-scoped access.
    """

    def __init__(self, client: Client):
        self._db = client

    # ── Read ─────────────────────────────────────────────────────────────────

    def fetch_all(
        self,
        table: str,
        filters: Optional[Dict[str, Any]] = None,
        order_by: Optional[str] = None,
        ascending: bool = False,
    ) -> List[Dict[str, Any]]:
        query = self._db.table(table).select("*")
        if filters:
            for col, val in filters.items():
                query = query.eq(col, val)
        if order_by:
            query = query.order(order_by, desc=not ascending)
        response = query.execute()
        return response.data or []

    def fetch_one(
        self,
        table: str,
        record_id: UUID | str,
        id_column: str = "id",
    ) -> Optional[Dict[str, Any]]:
        response = (
            self._db.table(table).select("*").eq(id_column, str(record_id)).single().execute()
        )
        return response.data

    def fetch_filtered(
        self,
        table: str,
        filters: Dict[str, Any],
        id_column: str = "id",
        record_id: Optional[UUID | str] = None,
    ) -> Optional[Dict[str, Any]]:
        query = self._db.table(table).select("*")
        for col, val in filters.items():
            query = query.eq(col, val)
        if record_id:
            query = query.eq(id_column, str(record_id))
        response = query.single().execute()
        return response.data

    # ── Write ─────────────────────────────────────────────────────────────────

    def insert(self, table: str, data: Dict[str, Any]) -> Dict[str, Any]:
        response = self._db.table(table).insert(data).execute()
        return response.data[0]

    def update(
        self,
        table: str,
        record_id: UUID | str,
        data: Dict[str, Any],
        id_column: str = "id",
    ) -> Dict[str, Any]:
        response = (
            self._db.table(table)
            .update(data)
            .eq(id_column, str(record_id))
            .execute()
        )
        return response.data[0]

    def delete(
        self,
        table: str,
        record_id: UUID | str,
        id_column: str = "id",
    ) -> bool:
        self._db.table(table).delete().eq(id_column, str(record_id)).execute()
        return True
