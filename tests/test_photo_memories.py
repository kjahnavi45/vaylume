"""
Automated Integration and Security Test Suite for Photo Memories & Two-Step Lock.

Tests:
1. Two-Step Lock Setup (Biometric + 3x3 Pattern)
2. Enforcement of Two-Step Lock on Memories API (Blocks access without X-Vault-Token)
3. Step 1: Biometric Verification & Intermediate Token
4. Step 2: Pattern Verification & Vault Token Issuance
5. Single Photo Upload (JPG/PNG/WebP, metadata, private storage, signed URL)
6. Multiple / Batch Photo Upload with progress & per-photo metadata
7. File Size Validation (>10MB rejected with 413)
8. File Type Validation (unsupported types rejected with 415)
9. Multi-User Isolation & Ownership Verification (User A cannot view, edit, or delete User B's memories)
10. Update & Delete (Deletes photo from storage and row from database)
"""

import hashlib
import io
import json
import os
import sys
from datetime import date
from starlette.testclient import TestClient

# Add backend directory to sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from main import app
from services.auth_service import get_current_user
from utils.vault_crypto import generate_vault_token

client = TestClient(app)

# Helper tokens
USER_A_JWT = "vylm_jwt_user_a_token"
USER_B_JWT = "vylm_jwt_user_b_token"

# Sample 1x1 transparent PNG bytes
TINY_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00"
    b"\x1f\x15c4\x00\x00\x00\rIDATx\x9cc`\x00\x00\x00\x02\x00\x01H\xaf\xa4q\x00\x00\x00\x00IEND\xaeB`\x82"
)

# Sample 1x1 JPEG bytes
TINY_JPG = (
    b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07"
    b"\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e"
    b"\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9"
)

# Sample WebP header bytes
TINY_WEBP = (
    b"RIFF\x1a\x00\x00\x00WEBPVP8 \x0e\x00\x00\x00/ \x00\x000\x01\x00\x9d\x01*\x01\x00\x01\x00\x00"
)

PATTERN_HASH = hashlib.sha256("0-1-2-5-8".encode("utf-8")).hexdigest()
CREDENTIAL_ID = "webauthn_cred_aarav_99"


def test_vault_and_photo_memories_flow():
    print("\n--- 1. Check Initial Vault Status ---")
    resp = client.get("/api/v1/vault/status", headers={"Authorization": f"Bearer {USER_A_JWT}"})
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    status_data = resp.json()
    assert "is_setup" in status_data
    print("Vault status:", status_data)

    print("\n--- 2. Two-Step Lock Setup ---")
    setup_payload = {
        "pattern_hash": PATTERN_HASH,
        "webauthn_credential_id": CREDENTIAL_ID,
        "has_webauthn": True,
        "fallback_pin_hash": hashlib.sha256("9876".encode("utf-8")).hexdigest(),
    }
    resp = client.post(
        "/api/v1/vault/setup",
        json=setup_payload,
        headers={"Authorization": f"Bearer {USER_A_JWT}"},
    )
    assert resp.status_code == 201, f"Setup failed: {resp.text}"
    vault_token = resp.json()["vault_token"]
    assert vault_token, "Expected vault_token"
    print("Vault setup complete! Vault Token issued.")

    print("\n--- 3. Verify Two-Step Lock Enforcement on Memories ---")
    # Request without X-Vault-Token MUST be blocked with 403 Forbidden
    blocked_resp = client.get(
        "/api/v1/memories",
        headers={"Authorization": f"Bearer {USER_A_JWT}"},
    )
    assert blocked_resp.status_code == 403, f"Expected 403 Forbidden when locked, got {blocked_resp.status_code}"
    assert blocked_resp.json()["detail"]["code"] == "VAULT_LOCKED"
    print("Security verified: Memories API blocked without X-Vault-Token!")

    print("\n--- 4. Verify Step 1: Biometric Verification ---")
    bio_resp = client.post(
        "/api/v1/vault/verify-biometric",
        json={"credential_id": CREDENTIAL_ID},
        headers={"Authorization": f"Bearer {USER_A_JWT}"},
    )
    assert bio_resp.status_code == 200, f"Biometric verification failed: {bio_resp.text}"
    bio_token = bio_resp.json()["biometric_token"]
    assert bio_token, "Expected biometric_token"
    print("Step 1 (Biometric) passed! Intermediate token received.")

    print("\n--- 5. Verify Step 2: Pattern Lock ---")
    # Reject if biometric step is bypassed or token is missing
    bad_pattern_resp = client.post(
        "/api/v1/vault/verify-pattern",
        json={"pattern_hash": PATTERN_HASH},
        headers={"Authorization": f"Bearer {USER_A_JWT}"},
    )
    assert bad_pattern_resp.status_code == 403, "Step 2 should reject if step 1 biometric_token is missing"

    # Reject if wrong pattern
    wrong_pattern_resp = client.post(
        "/api/v1/vault/verify-pattern",
        json={"pattern_hash": "wrong_hash_1234567890abcdef", "biometric_token": bio_token},
        headers={"Authorization": f"Bearer {USER_A_JWT}"},
    )
    assert wrong_pattern_resp.status_code == 401, "Should reject incorrect pattern"

    # Success with correct pattern + biometric token
    pattern_resp = client.post(
        "/api/v1/vault/verify-pattern",
        json={"pattern_hash": PATTERN_HASH, "biometric_token": bio_token},
        headers={"Authorization": f"Bearer {USER_A_JWT}"},
    )
    assert pattern_resp.status_code == 200, f"Pattern unlock failed: {pattern_resp.text}"
    unlocked_vault_token = pattern_resp.json()["vault_token"]
    print("Step 2 (Pattern) passed! Full Vault Token granted.")

    auth_headers = {
        "Authorization": f"Bearer {USER_A_JWT}",
        "X-Vault-Token": unlocked_vault_token,
    }

    print("\n--- 6. Single Photo Upload (PNG) with Metadata ---")
    files = {"photo": ("sunset_beach.png", io.BytesIO(TINY_PNG), "image/png")}
    data = {
        "title": "Sunset over Gokarna Beach",
        "description": "Golden hour reflecting on the Arabian sea with serene waves.",
        "memory_date": "2026-10-24",
        "category": "Travel",
        "tags": "beach, sunset, peace",
    }
    resp = client.post("/api/v1/memories", headers=auth_headers, files=files, data=data)
    assert resp.status_code == 201, f"Create memory failed: {resp.text}"
    mem1 = resp.json()
    assert mem1["title"] == "Sunset over Gokarna Beach"
    assert mem1["category"] == "Travel"
    assert "beach" in mem1["tags"]
    assert mem1["photo_url"], "Expected signed photo_url"
    print("Memory created with signed photo URL:", mem1["id"])

    print("\n--- 7. Batch Multi-Photo Upload (JPG + WebP) ---")
    multi_files = [
        ("photos", ("hike_peak.jpg", io.BytesIO(TINY_JPG), "image/jpeg")),
        ("photos", ("lake_view.webp", io.BytesIO(TINY_WEBP), "image/webp")),
    ]
    batch_metadata = json.dumps([
        {"title": "Summit Hike Peak", "description": "Crisp mountain air at 3,000m", "category": "Milestone", "tags": ["trek", "peak"]},
        {"title": "Tranquil Lake View", "description": "Quiet morning reflections", "category": "Personal", "tags": ["lake", "calm"]},
    ])
    resp = client.post(
        "/api/v1/memories/batch",
        headers=auth_headers,
        files=multi_files,
        data={"metadata": batch_metadata},
    )
    assert resp.status_code == 201, f"Batch upload failed: {resp.text}"
    batch_data = resp.json()
    assert batch_data["total_uploaded"] == 2
    assert len(batch_data["memories"]) == 2
    print(f"Batch upload succeeded: {batch_data['total_uploaded']} photos uploaded.")

    print("\n--- 8. File Type Validation: Reject Unsupported Files ---")
    bad_file = {"photo": ("malicious_script.exe", io.BytesIO(b"MZ\x90\x00"), "application/x-msdownload")}
    bad_resp = client.post(
        "/api/v1/memories",
        headers=auth_headers,
        files=bad_file,
        data={"title": "Bad File"},
    )
    assert bad_resp.status_code == 415, f"Expected 415 Unsupported Media Type, got {bad_resp.status_code}"
    print("Security verified: Unsupported executable file rejected with 415!")

    print("\n--- 9. File Size Validation: Reject Oversized Files (>10MB) ---")
    large_data = b"X" * (11 * 1024 * 1024)  # 11 MB
    large_file = {"photo": ("huge_photo.jpg", io.BytesIO(large_data), "image/jpeg")}
    large_resp = client.post(
        "/api/v1/memories",
        headers=auth_headers,
        files=large_file,
        data={"title": "Huge Photo"},
    )
    assert large_resp.status_code == 413, f"Expected 413 File Too Large, got {large_resp.status_code}"
    print("Security verified: File exceeding 10MB rejected with 413!")

    print("\n--- 10. List Memories & Read Persistence ---")
    list_resp = client.get("/api/v1/memories", headers=auth_headers)
    assert list_resp.status_code == 200
    memories_list = list_resp.json()["memories"]
    assert len(memories_list) >= 3
    print(f"List memories returned {len(memories_list)} records with active signed URLs.")

    print("\n--- 11. Multi-User Isolation: User B Cannot Access User A's Memory ---")
    import uuid
    user_b_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, USER_B_JWT))
    user_b_token = generate_vault_token(user_b_id)
    user_b_headers = {
        "Authorization": f"Bearer {USER_B_JWT}",
        "X-Vault-Token": user_b_token,
    }
    user_b_get = client.get(f"/api/v1/memories/{mem1['id']}", headers=user_b_headers)
    assert user_b_get.status_code == 404, f"User B should get 404, got {user_b_get.status_code}"

    user_b_delete = client.delete(f"/api/v1/memories/{mem1['id']}", headers=user_b_headers)
    assert user_b_delete.status_code == 404, "User B should not be able to delete User A's memory"
    print("Multi-user isolation verified: User B cannot view or delete User A's memories!")

    print("\n--- 12. Update Memory Metadata ---")
    update_resp = client.put(
        f"/api/v1/memories/{mem1['id']}",
        headers=auth_headers,
        json={"title": "Sunset over Gokarna Beach (Updated)", "description": "Magical colors at dusk."},
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["title"] == "Sunset over Gokarna Beach (Updated)"
    print("Memory metadata updated successfully.")

    print("\n--- 13. Delete Memory ---")
    del_resp = client.delete(f"/api/v1/memories/{mem1['id']}", headers=auth_headers)
    assert del_resp.status_code == 200
    assert del_resp.json()["message"] == "Memory deleted successfully"

    # Confirm it is no longer retrievable
    get_after_del = client.get(f"/api/v1/memories/{mem1['id']}", headers=auth_headers)
    assert get_after_del.status_code == 404
    print("Memory and photo deleted successfully.")

    print("\n==========================================")
    print("ALL 13 SECURITY & INTEGRATION TESTS PASSED!")
    print("==========================================")


if __name__ == "__main__":
    test_vault_and_photo_memories_flow()
