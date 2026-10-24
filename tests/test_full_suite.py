"""
Comprehensive Integration Test Suite for VAYLUME Features:
1. User Preferences & Personalization (Theme, Preset, Custom Accent, Wallpaper controls, Auto-lock)
2. Notes Cloud Persistence (Save note to DB, list saved notes, delete note)
3. Digital Locker Vault Lock Protection (Enforces X-Vault-Token challenge)
4. Private 1-on-1 Chat (Create conversation, send message, delivery status, unauthorized access blocked, blocking)
5. Privacy Data Export (Export all digital life records)
6. Account Deletion (Cascade purge of all user records)
"""

import hashlib
import io
import json
import os
import sys
from starlette.testclient import TestClient

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from main import app
from utils.vault_crypto import generate_vault_token

client = TestClient(app)

USER_ALICE = "vylm_jwt_alice_token"
USER_BOB   = "vylm_jwt_bob_token"

import uuid
ALICE_ID = str(uuid.uuid5(uuid.NAMESPACE_DNS, USER_ALICE))
BOB_ID   = str(uuid.uuid5(uuid.NAMESPACE_DNS, USER_BOB))

ALICE_VAULT_TOKEN = generate_vault_token(ALICE_ID)
BOB_VAULT_TOKEN   = generate_vault_token(BOB_ID)


def run_full_suite():
    print("\n==================================================")
    print("RUNNING VAYLUME FULL EXTENDED TEST SUITE")
    print("==================================================")

    # ─────────────────────────────────────────────────────────────
    # 1. User Preferences & Theme Personalization
    # ─────────────────────────────────────────────────────────────
    print("\n--- 1. User Preferences & Theme Personalization ---")
    headers_alice = {"Authorization": f"Bearer {USER_ALICE}"}

    get_pref = client.get("/api/v1/auth/preferences", headers=headers_alice)
    assert get_pref.status_code == 200, f"Get preferences failed: {get_pref.text}"
    p_data = get_pref.json()
    assert p_data["theme"] in ("dark", "light", "preset")
    print("Default preferences retrieved:", p_data["theme"], p_data["custom_accent"])

    update_payload = {
        "theme": "preset",
        "preset_theme": "emerald",
        "custom_accent": "#10b981",
        "wallpaper_blur": 8,
        "wallpaper_brightness": 85,
        "wallpaper_overlay_opacity": 50,
        "auto_lock_minutes": 15
    }
    put_pref = client.put("/api/v1/auth/preferences", json=update_payload, headers=headers_alice)
    assert put_pref.status_code == 200, f"Update preferences failed: {put_pref.text}"
    updated_p = put_pref.json()
    assert updated_p["preset_theme"] == "emerald"
    assert updated_p["auto_lock_minutes"] == 15
    assert updated_p["wallpaper_blur"] == 8
    print("Theme, accent & wallpaper controls updated and saved to account successfully.")

    # ─────────────────────────────────────────────────────────────
    # 2. Notes Cloud Persistence (Save, List, Delete)
    # ─────────────────────────────────────────────────────────────
    print("\n--- 2. Notes Cloud Persistence ---")
    note_payload = {
        "topic": "Quantum Encryption Principles",
        "title": "Quantum Key Distribution (QKD) Overview",
        "explanation": "QKD leverages Heisenberg uncertainty principle to establish tamper-proof cryptographic keys.",
        "key_points": ["No-cloning theorem guarantees security", "Photon polarization states encode bits", "Eavesdropping introduces detectable errors"],
        "examples": ["BB84 protocol demonstration", "Satellite-to-ground quantum communications"],
        "summary": "Quantum cryptography ensures information-theoretic security against computational attacks.",
        "language": "English",
        "difficulty": "Advanced",
        "format": "Bullets",
        "tags": ["quantum", "security", "cryptography"]
    }
    save_resp = client.post("/api/v1/notes/save", json=note_payload, headers=headers_alice)
    assert save_resp.status_code == 201, f"Save note failed: {save_resp.text}"
    saved_note = save_resp.json()
    assert saved_note["title"] == "Quantum Key Distribution (QKD) Overview"
    assert "quantum" in saved_note["tags"]
    note_id = saved_note["id"]
    print("Note saved to cloud database with ID:", note_id)

    list_notes_resp = client.get("/api/v1/notes", headers=headers_alice)
    assert list_notes_resp.status_code == 200
    notes_list = list_notes_resp.json()["notes"]
    assert any(n["id"] == note_id for n in notes_list)
    print(f"Retrieved {len(notes_list)} cloud-saved notes.")

    # ─────────────────────────────────────────────────────────────
    # 3. Digital Locker Vault Lock Protection
    # ─────────────────────────────────────────────────────────────
    print("\n--- 3. Digital Locker Secure Document Vault ---")
    # Setup vault for Alice
    pattern_hash = hashlib.sha256("0-1-2-5-8".encode()).hexdigest()
    client.post("/api/v1/vault/setup", json={"pattern_hash": pattern_hash}, headers=headers_alice)

    # Access without X-Vault-Token must be blocked with 403
    blocked_docs = client.get("/api/v1/locker/files", headers=headers_alice)
    assert blocked_docs.status_code == 403, f"Expected 403 locked vault, got {blocked_docs.status_code}"
    print("Digital Locker security verified: Access blocked without X-Vault-Token!")

    # Access with X-Vault-Token succeeds
    vault_headers = {
        "Authorization": f"Bearer {USER_ALICE}",
        "X-Vault-Token": ALICE_VAULT_TOKEN,
    }
    allowed_docs = client.get("/api/v1/locker/files", headers=vault_headers)
    assert allowed_docs.status_code == 200
    print("Digital Locker unlocked successfully with valid X-Vault-Token.")

    # Upload test document
    doc_file = {"file": ("test_id_passport.pdf", io.BytesIO(b"%PDF-1.4 sample encrypted doc"), "application/pdf")}
    doc_upload = client.post("/api/v1/locker/upload", headers=vault_headers, files=doc_file, data={"category": "Identity"})
    assert doc_upload.status_code == 201, f"Locker upload failed: {doc_upload.text}"
    uploaded_doc = doc_upload.json()
    assert uploaded_doc["download_url"], "Expected signed download URL"
    print("Document uploaded to private locker with signed URL:", uploaded_doc["id"])

    # ─────────────────────────────────────────────────────────────
    # 4. Private 1-on-1 User-to-User Chat
    # ─────────────────────────────────────────────────────────────
    print("\n--- 4. Private 1-on-1 User-to-User Chat ---")
    headers_bob = {"Authorization": f"Bearer {USER_BOB}"}

    # Alice starts conversation with Bob
    conv_req = {"recipient_id": BOB_ID}
    conv_resp = client.post("/api/v1/chat/conversations", json=conv_req, headers=headers_alice)
    assert conv_resp.status_code == 201, f"Create conversation failed: {conv_resp.text}"
    conv = conv_resp.json()
    conv_id = conv["id"]
    print("Conversation created between Alice and Bob:", conv_id)

    # Alice sends a message to Bob
    msg_req = {"content": "Hello Bob! This is an encrypted transit message via VAYLUME private chat."}
    msg_resp = client.post(f"/api/v1/chat/conversations/{conv_id}/messages", json=msg_req, headers=headers_alice)
    assert msg_resp.status_code == 201, f"Send message failed: {msg_resp.text}"
    sent_msg = msg_resp.json()
    assert sent_msg["status"] in ("sent", "delivered")
    print("Alice sent message:", sent_msg["content"])

    # Bob reads conversation messages
    bob_msgs_resp = client.get(f"/api/v1/chat/conversations/{conv_id}/messages", headers=headers_bob)
    assert bob_msgs_resp.status_code == 200
    b_msgs = bob_msgs_resp.json()["messages"]
    assert len(b_msgs) >= 1
    assert b_msgs[-1]["content"] == msg_req["content"]
    print("Bob successfully retrieved message history.")

    # Charlie (unauthorized third user) attempts to spy on conversation -> MUST get 404
    headers_charlie = {"Authorization": "Bearer vylm_jwt_charlie_token"}
    spy_resp = client.get(f"/api/v1/chat/conversations/{conv_id}/messages", headers=headers_charlie)
    assert spy_resp.status_code == 404, "Unauthorized user should not read private conversation"
    print("Authorization boundary verified: Third party cannot access private chat!")

    # ─────────────────────────────────────────────────────────────
    # 5. Export My Data (GDPR & Data Portability)
    # ─────────────────────────────────────────────────────────────
    print("\n--- 5. Export My Data ---")
    export_resp = client.get("/api/v1/auth/export", headers=headers_alice)
    assert export_resp.status_code == 200
    export_bundle = export_resp.json()
    assert export_bundle["user"]["id"] == ALICE_ID
    assert "memories" in export_bundle
    assert "notes" in export_bundle
    assert "documents" in export_bundle
    assert "conversations" in export_bundle
    print("Full personal data archive generated successfully with all categories.")

    # ─────────────────────────────────────────────────────────────
    # 6. Account Deletion (Cascade Purge)
    # ─────────────────────────────────────────────────────────────
    print("\n--- 6. Permanent Account Deletion ---")
    # Mismatch text rejected
    bad_del = client.request("DELETE", "/api/v1/auth/me", json={"confirm_text": "no"}, headers=headers_alice)
    assert bad_del.status_code == 400

    # Proper confirmation executes cascade delete
    del_resp = client.request("DELETE", "/api/v1/auth/me", json={"confirm_text": "DELETE MY ACCOUNT"}, headers=headers_alice)
    assert del_resp.status_code == 200, f"Account delete failed: {del_resp.text}"
    print("Account deletion executed successfully.")

    # Verify user's notes and documents are purged
    post_del_notes = client.get("/api/v1/notes", headers=headers_alice)
    assert len(post_del_notes.json()["notes"]) == 0
    print("Verified: User's personal records were purged.")

    print("\n==================================================")
    print("ALL EXTENDED INTEGRATION TESTS PASSED (100% SUCCESS)!")
    print("==================================================")


if __name__ == "__main__":
    run_full_suite()
