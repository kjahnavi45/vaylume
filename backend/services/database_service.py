"""
Database service — wrapper around the Supabase Python client.

All database access goes through this service so that:
  1. The rest of the code never imports supabase directly.
  2. RLS (Row Level Security) is respected by using the user's JWT when possible.
  3. Admin operations use the service-role client, never the anon key.
  4. Graceful in-memory fallback is provided when running offline or in tests.
"""

from __future__ import annotations

import copy
import threading
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from supabase import Client, create_client

from config.settings import get_settings

settings = get_settings()

# Thread-safe in-memory store for offline demo / unit testing
_lock = threading.Lock()
_MOCK_DB: Dict[str, List[Dict[str, Any]]] = {
    "memories": [],
    "vault_security": [],
    "notes": [],
    "documents": [],
    "user_preferences": [],
    "conversations": [],
    "messages": [],
    "user_blocks": [],
}


def is_supabase_configured() -> bool:
    """Check if valid Supabase credentials are configured."""
    return bool(
        settings.SUPABASE_URL
        and settings.SUPABASE_ANON_KEY
        and "your-project" not in settings.SUPABASE_URL
    )


def _get_anon_client() -> Client:
    """Anon client — respects Row Level Security. Use for user-scoped operations."""
    if not is_supabase_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "SUPABASE_NOT_CONFIGURED", "message": "Supabase credentials are not configured in backend/.env"},
        )
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)


def _get_service_client() -> Client:
    """Service-role client — bypasses RLS. Use only for admin / server-side tasks."""
    if (
        not settings.SUPABASE_URL
        or not settings.SUPABASE_SERVICE_ROLE_KEY
        or "your-project" in settings.SUPABASE_URL
    ):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "SUPABASE_NOT_CONFIGURED", "message": "Supabase credentials are not configured in backend/.env"},
        )
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


def get_authed_client(jwt: str) -> Optional[Client]:
    """Return an anon client with the user's JWT injected so RLS applies, or None for mock."""
    if not is_supabase_configured() or jwt.startswith("vylm_jwt_") or jwt in ("test-jwt-token", "demo-jwt-token"):
        return None
    client = _get_anon_client()
    client.auth.set_session(access_token=jwt, refresh_token="")
    return client


def get_service_client() -> Optional[Client]:
    if not is_supabase_configured():
        return None
    return _get_service_client()


# ─────────────────────────────────────────────────────────────────────────────
# Generic CRUD helpers
# ─────────────────────────────────────────────────────────────────────────────

class DatabaseService:
    """
    Stateless helper that wraps Supabase PostgREST queries with in-memory fallback.
    """

    def __init__(self, client: Optional[Client]):
        self._db = client

    # ── Read ─────────────────────────────────────────────────────────────────

    def fetch_all(
        self,
        table: str,
        filters: Optional[Dict[str, Any]] = None,
        order_by: Optional[str] = None,
        ascending: bool = False,
    ) -> List[Dict[str, Any]]:
        if self._db is None:
            with _lock:
                rows = [copy.deepcopy(r) for r in _MOCK_DB.get(table, [])]
            if filters:
                rows = [
                    r for r in rows
                    if all(str(r.get(k)) == str(v) for k, v in filters.items())
                ]
            if order_by:
                rows.sort(key=lambda x: str(x.get(order_by, "")), reverse=not ascending)
            return rows

        query = self._db.table(table).select("*")
        if filters:
            for col, val in filters.items():
                query = query.eq(col, val)
        if order_by:
            query = query.order(order_by, desc=not ascending)
        response = query.execute()
        return response.data or []

    def fetch_user_conversations(self, user_id: str) -> List[Dict[str, Any]]:
        """Fetch all conversations where the user is either user1 or user2."""
        if self._db is None:
            with _lock:
                rows = [
                    copy.deepcopy(r) for r in _MOCK_DB.get("conversations", [])
                    if str(r.get("user1_id")) == str(user_id) or str(r.get("user2_id")) == str(user_id)
                ]
                rows.sort(key=lambda x: str(x.get("last_message_at", "")), reverse=True)
                return rows

        query = self._db.table("conversations").select("*").or_(f"user1_id.eq.{user_id},user2_id.eq.{user_id}").order("last_message_at", desc=True)
        response = query.execute()
        return response.data or []

    def fetch_one(
        self,
        table: str,
        record_id: UUID | str,
        id_column: str = "id",
    ) -> Optional[Dict[str, Any]]:
        if self._db is None:
            with _lock:
                rows = _MOCK_DB.get(table, [])
                for r in rows:
                    if str(r.get(id_column)) == str(record_id):
                        return copy.deepcopy(r)
            return None

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
        if self._db is None:
            with _lock:
                rows = _MOCK_DB.get(table, [])
                for r in rows:
                    match = all(str(r.get(k)) == str(v) for k, v in filters.items())
                    if match and (record_id is None or str(r.get(id_column)) == str(record_id)):
                        return copy.deepcopy(r)
            return None

        query = self._db.table(table).select("*")
        for col, val in filters.items():
            query = query.eq(col, val)
        if record_id:
            query = query.eq(id_column, str(record_id))
        try:
            response = query.single().execute()
            return response.data
        except Exception:
            return None

    # ── Write ─────────────────────────────────────────────────────────────────

    def insert(self, table: str, data: Dict[str, Any]) -> Dict[str, Any]:
        if self._db is None:
            with _lock:
                if table not in _MOCK_DB:
                    _MOCK_DB[table] = []
                record = copy.deepcopy(data)
                if "id" not in record and table != "vault_security":
                    record["id"] = str(uuid4())
                _MOCK_DB[table].append(record)
                return copy.deepcopy(record)

        response = self._db.table(table).insert(data).execute()
        return response.data[0]

    def upsert(self, table: str, data: Dict[str, Any], on_conflict: str = "user_id") -> Dict[str, Any]:
        if self._db is None:
            with _lock:
                if table not in _MOCK_DB:
                    _MOCK_DB[table] = []
                rows = _MOCK_DB[table]
                conflict_val = str(data.get(on_conflict))
                for i, r in enumerate(rows):
                    if str(r.get(on_conflict)) == conflict_val:
                        rows[i].update(copy.deepcopy(data))
                        return copy.deepcopy(rows[i])
                record = copy.deepcopy(data)
                rows.append(record)
                return copy.deepcopy(record)

        response = self._db.table(table).upsert(data, on_conflict=on_conflict).execute()
        return response.data[0]

    def update(
        self,
        table: str,
        record_id: UUID | str,
        data: Dict[str, Any],
        id_column: str = "id",
    ) -> Dict[str, Any]:
        if self._db is None:
            with _lock:
                rows = _MOCK_DB.get(table, [])
                for i, r in enumerate(rows):
                    if str(r.get(id_column)) == str(record_id):
                        rows[i].update(copy.deepcopy(data))
                        return copy.deepcopy(rows[i])
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "NOT_FOUND", "message": f"Record {record_id} not found"},
            )

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
        if self._db is None:
            with _lock:
                rows = _MOCK_DB.get(table, [])
                before_len = len(rows)
                _MOCK_DB[table] = [r for r in rows if str(r.get(id_column)) != str(record_id)]
                return len(_MOCK_DB[table]) < before_len

        self._db.table(table).delete().eq(id_column, str(record_id)).execute()
        return True

    def delete_all(
        self,
        table: str,
        filters: Dict[str, Any],
    ) -> int:
        """Delete all rows matching the given filters."""
        if self._db is None:
            with _lock:
                rows = _MOCK_DB.get(table, [])
                before_len = len(rows)
                _MOCK_DB[table] = [
                    r for r in rows
                    if not all(str(r.get(k)) == str(v) for k, v in filters.items())
                ]
                return before_len - len(_MOCK_DB[table])

        query = self._db.table(table).delete()
        for col, val in filters.items():
            query = query.eq(col, val)
        response = query.execute()
        return len(response.data or [])
