"""
Private 1-on-1 User-to-User Chat routes.

Security & Privacy:
  - Strict Authorization: Users can only access conversations where they are a participant (user1 or user2).
  - Server-Enforced TLS In-Transit Encryption.
  - Transparent Disclosure: Direct transport-level encryption (TLS/HTTPS). Server-authorized access control.
  - Blocking & Message Requests: Users can block disruptive accounts and manage conversation state.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from config.settings import get_settings
from models.schemas import (
    BlockUserRequest,
    ConversationCreateRequest,
    ConversationListResponse,
    ConversationResponse,
    MessageItemResponse,
    MessageListResponse,
    MessageResponse,
    MessageSendRequest,
)
from services.auth_service import get_current_user
from services.database_service import DatabaseService, get_authed_client
from utils.dependencies import get_current_user_jwt

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["Private 1-on-1 Chat"])
settings = get_settings()


def _db(jwt: str) -> DatabaseService:
    return DatabaseService(get_authed_client(jwt))


# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/conversations",
    response_model=ConversationListResponse,
    summary="List all 1-on-1 conversations for current user",
)
def list_conversations(jwt: str = Depends(get_current_user_jwt)):
    user = get_current_user(jwt)
    db = _db(jwt)

    raw_convs = db.fetch_user_conversations(user.id)
    conversations = []

    for c in raw_convs:
        # Determine the other participant
        other_id = c["user2_id"] if str(c["user1_id"]) == str(user.id) else c["user1_id"]
        other_email = f"user_{str(other_id)[:8]}@vaylume.app"
        other_name = f"Vaylume User ({str(other_id)[:6]})"

        # Count unread messages for current user
        unread = len([
            m for m in db.fetch_all("messages", filters={"conversation_id": c["id"], "recipient_id": user.id})
            if m.get("status") != "read"
        ])

        conversations.append(
            ConversationResponse(
                id=c["id"],
                participant_id=str(other_id),
                participant_email=other_email,
                participant_name=other_name,
                status=c.get("status", "accepted"),
                last_message=c.get("last_message"),
                last_message_at=c.get("last_message_at", c["created_at"]),
                unread_count=unread,
                created_at=c["created_at"],
            )
        )

    return ConversationListResponse(conversations=conversations, total=len(conversations))


@router.post(
    "/conversations",
    response_model=ConversationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Initiate or retrieve a 1-on-1 conversation with another user",
)
def create_conversation(
    payload: ConversationCreateRequest,
    jwt: str = Depends(get_current_user_jwt),
):
    user = get_current_user(jwt)
    db = _db(jwt)

    target_id = payload.recipient_id
    if not target_id and payload.recipient_email:
        import uuid
        target_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, payload.recipient_email))

    if not target_id or target_id == user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_RECIPIENT", "message": "Cannot start conversation with yourself or invalid recipient"},
        )

    # Check if blocked
    blocks = db.fetch_all("user_blocks", filters={"blocker_id": target_id, "blocked_id": user.id})
    if blocks:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "USER_BLOCKED", "message": "Unable to start conversation with this user."},
        )

    # Check existing conversation
    all_user_convs = db.fetch_user_conversations(user.id)
    for c in all_user_convs:
        p1, p2 = str(c["user1_id"]), str(c["user2_id"])
        if (p1 == user.id and p2 == target_id) or (p2 == user.id and p1 == target_id):
            return ConversationResponse(
                id=c["id"],
                participant_id=target_id,
                participant_email=payload.recipient_email or f"user_{target_id[:8]}@vaylume.app",
                participant_name=f"Vaylume User ({target_id[:6]})",
                status=c.get("status", "accepted"),
                last_message=c.get("last_message"),
                last_message_at=c.get("last_message_at", c["created_at"]),
                unread_count=0,
                created_at=c["created_at"],
            )

    # Create new conversation
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "user1_id": user.id,
        "user2_id": target_id,
        "status": "accepted",
        "last_message": "Conversation started",
        "last_message_at": now,
        "created_at": now,
        "updated_at": now,
    }
    inserted = db.insert("conversations", record)

    return ConversationResponse(
        id=inserted["id"],
        participant_id=target_id,
        participant_email=payload.recipient_email or f"user_{target_id[:8]}@vaylume.app",
        participant_name=f"Vaylume User ({target_id[:6]})",
        status=inserted["status"],
        last_message=inserted["last_message"],
        last_message_at=inserted["last_message_at"],
        unread_count=0,
        created_at=inserted["created_at"],
    )


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=MessageListResponse,
    summary="Get message history for an authorized conversation",
)
def get_conversation_messages(
    conversation_id: UUID,
    jwt: str = Depends(get_current_user_jwt),
):
    user = get_current_user(jwt)
    db = _db(jwt)

    conv = db.fetch_one("conversations", conversation_id)
    if not conv or (str(conv["user1_id"]) != user.id and str(conv["user2_id"]) != user.id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Conversation not found or unauthorized access"},
        )

    # Fetch messages
    msgs = db.fetch_all("messages", filters={"conversation_id": conversation_id}, order_by="created_at", ascending=True)

    # Mark incoming unread messages as read
    for m in msgs:
        if str(m["recipient_id"]) == user.id and m.get("status") != "read":
            db.update("messages", m["id"], {"status": "read"})
            m["status"] = "read"

    other_id = conv["user2_id"] if str(conv["user1_id"]) == str(user.id) else conv["user1_id"]

    return MessageListResponse(
        messages=[
            MessageItemResponse(
                id=m["id"],
                conversation_id=m["conversation_id"],
                sender_id=str(m["sender_id"]),
                recipient_id=str(m["recipient_id"]),
                content=m["content"],
                status=m.get("status", "sent"),
                created_at=m["created_at"],
            )
            for m in msgs
        ],
        conversation=ConversationResponse(
            id=conv["id"],
            participant_id=str(other_id),
            participant_email=f"user_{str(other_id)[:8]}@vaylume.app",
            participant_name=f"Vaylume User ({str(other_id)[:6]})",
            status=conv.get("status", "accepted"),
            last_message=conv.get("last_message"),
            last_message_at=conv.get("last_message_at", conv["created_at"]),
            unread_count=0,
            created_at=conv["created_at"],
        ),
    )


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=MessageItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Send a message in a conversation",
)
def send_message(
    conversation_id: UUID,
    payload: MessageSendRequest,
    jwt: str = Depends(get_current_user_jwt),
):
    user = get_current_user(jwt)
    db = _db(jwt)

    conv = db.fetch_one("conversations", conversation_id)
    if not conv or (str(conv["user1_id"]) != user.id and str(conv["user2_id"]) != user.id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Conversation not found or unauthorized access"},
        )

    recipient_id = conv["user2_id"] if str(conv["user1_id"]) == str(user.id) else conv["user1_id"]

    # Check block status
    blocks = db.fetch_all("user_blocks", filters={"blocker_id": recipient_id, "blocked_id": user.id})
    if blocks:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "USER_BLOCKED", "message": "You cannot message this user."},
        )

    now = datetime.now(timezone.utc).isoformat()
    record = {
        "conversation_id": conversation_id,
        "sender_id": user.id,
        "recipient_id": recipient_id,
        "content": payload.content,
        "status": "delivered",
        "created_at": now,
    }
    inserted = db.insert("messages", record)

    # Update conversation's last_message
    snippet = payload.content[:60] + ("..." if len(payload.content) > 60 else "")
    db.update("conversations", conversation_id, {
        "last_message": snippet,
        "last_message_at": now,
        "updated_at": now,
    })

    return MessageItemResponse(
        id=inserted["id"],
        conversation_id=inserted["conversation_id"],
        sender_id=str(inserted["sender_id"]),
        recipient_id=str(inserted["recipient_id"]),
        content=inserted["content"],
        status=inserted["status"],
        created_at=inserted["created_at"],
    )


@router.post(
    "/block/{user_id}",
    response_model=MessageResponse,
    summary="Block a user from sending messages",
)
def block_user(user_id: str, jwt: str = Depends(get_current_user_jwt)):
    user = get_current_user(jwt)
    db = _db(jwt)

    now = datetime.now(timezone.utc).isoformat()
    db.upsert("user_blocks", {"blocker_id": user.id, "blocked_id": user_id, "created_at": now}, on_conflict="blocker_id")
    return MessageResponse(message=f"User {user_id} blocked successfully.")


@router.delete(
    "/block/{user_id}",
    response_model=MessageResponse,
    summary="Unblock a user",
)
def unblock_user(user_id: str, jwt: str = Depends(get_current_user_jwt)):
    user = get_current_user(jwt)
    db = _db(jwt)

    db.delete_all("user_blocks", filters={"blocker_id": user.id, "blocked_id": user_id})
    return MessageResponse(message=f"User {user_id} unblocked.")


@router.delete(
    "/conversations/{conversation_id}",
    response_model=MessageResponse,
    summary="Delete conversation history",
)
def delete_conversation(conversation_id: UUID, jwt: str = Depends(get_current_user_jwt)):
    user = get_current_user(jwt)
    db = _db(jwt)

    conv = db.fetch_one("conversations", conversation_id)
    if not conv or (str(conv["user1_id"]) != user.id and str(conv["user2_id"]) != user.id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Conversation not found or unauthorized access"},
        )

    # Delete messages first then conversation
    db.delete_all("messages", filters={"conversation_id": conversation_id})
    db.delete("conversations", conversation_id)

    return MessageResponse(message="Conversation and message history deleted successfully.")
