"""Iteration 5 — Supabase JWT auth + endpoint sanity checks.

Covers:
  1. JWT validation (missing / invalid / wrong secret / wrong aud / valid)
  2. First-time upsert on /api/auth/me
  3. Idempotency (no duplicate user row on repeat call)
  4. Profile update persistence
  5. Sanity: journal, dashboard, memory-path, phases, safety contacts,
     somatic-practices, journal prompt still work
  6. Removed endpoints (session/logout) return 404/405
  7. No _id leaks anywhere
"""
from __future__ import annotations

import uuid
from datetime import timedelta

import pytest
import requests

from conftest import (
    API_URL, QA_EMAIL, QA_SUB,
    assert_no_mongo_id, make_jwt,
)


# ---------------------------------------------------------------------------
# 1. JWT validation
# ---------------------------------------------------------------------------
class TestJwtValidation:

    def test_no_authorization_header_returns_401(self, anon_client: requests.Session):
        r = anon_client.get(f"{API_URL}/auth/me")
        assert r.status_code == 401, r.text

    def test_invalid_garbage_token_returns_401(self, anon_client: requests.Session):
        r = anon_client.get(
            f"{API_URL}/auth/me",
            headers={"Authorization": "Bearer invalidgarbage"},
        )
        assert r.status_code == 401, r.text

    def test_wrong_secret_returns_401(self, anon_client: requests.Session):
        bad = make_jwt(secret="not-the-real-secret-not-the-real-secret")
        r = anon_client.get(
            f"{API_URL}/auth/me",
            headers={"Authorization": f"Bearer {bad}"},
        )
        assert r.status_code == 401, r.text

    def test_wrong_audience_returns_401(self, anon_client: requests.Session):
        bad = make_jwt(aud="anon")
        r = anon_client.get(
            f"{API_URL}/auth/me",
            headers={"Authorization": f"Bearer {bad}"},
        )
        assert r.status_code == 401, r.text

    def test_expired_token_returns_401(self, anon_client: requests.Session):
        bad = make_jwt(exp_delta=timedelta(seconds=-60))
        r = anon_client.get(
            f"{API_URL}/auth/me",
            headers={"Authorization": f"Bearer {bad}"},
        )
        assert r.status_code == 401, r.text

    def test_missing_bearer_prefix_returns_401(self, anon_client: requests.Session, qa_token: str):
        r = anon_client.get(
            f"{API_URL}/auth/me",
            headers={"Authorization": qa_token},  # no "Bearer " prefix
        )
        assert r.status_code == 401, r.text

    def test_valid_token_returns_user(self, auth_client: requests.Session):
        r = auth_client.get(f"{API_URL}/auth/me")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user_id"] == QA_SUB
        assert data["email"] == QA_EMAIL
        assert data["name"] == "QA Tester"
        assert_no_mongo_id(data)


# ---------------------------------------------------------------------------
# 2 + 3. First-time upsert + idempotency
# ---------------------------------------------------------------------------
class TestUpsertAndIdempotency:

    def test_first_call_creates_user_document(self, anon_client, mongo_db):
        fresh_sub = str(uuid.uuid4())
        fresh_email = f"fresh+{fresh_sub[:8]}@projectlife.local"
        token = make_jwt(sub=fresh_sub, email=fresh_email, name="Fresh User")
        try:
            r = anon_client.get(
                f"{API_URL}/auth/me",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert r.status_code == 200, r.text
            data = r.json()
            assert data["user_id"] == fresh_sub
            assert data["email"] == fresh_email
            assert data["name"] == "Fresh User"
            assert data["consent_accepted"] is False
            assert data["onboarding_complete"] is False
            assert data["current_phase"] == 0
            assert_no_mongo_id(data)

            doc = mongo_db.users.find_one({"user_id": fresh_sub})
            assert doc is not None
            assert doc["email"] == fresh_email
        finally:
            mongo_db.users.delete_many({"user_id": fresh_sub})

    def test_name_falls_back_to_email_prefix_when_missing(self, anon_client, mongo_db):
        fresh_sub = str(uuid.uuid4())
        fresh_email = f"noname+{fresh_sub[:8]}@projectlife.local"
        # Build a token with NO name in user_metadata
        from jose import jwt as jose_jwt
        import os
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        payload = {
            "sub": fresh_sub, "email": fresh_email,
            "user_metadata": {}, "aud": "authenticated",
            "iat": int(now.timestamp()),
            "exp": int(now.timestamp()) + 3600,
        }
        token = jose_jwt.encode(payload, os.environ["SUPABASE_JWT_SECRET"], algorithm="HS256")
        try:
            r = anon_client.get(
                f"{API_URL}/auth/me",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert r.status_code == 200, r.text
            data = r.json()
            assert data["name"] == fresh_email.split("@")[0]
        finally:
            mongo_db.users.delete_many({"user_id": fresh_sub})

    def test_idempotent_repeat_calls_no_duplicate(self, auth_client, mongo_db):
        # 3 calls in a row with the same QA token
        for _ in range(3):
            r = auth_client.get(f"{API_URL}/auth/me")
            assert r.status_code == 200, r.text
        count = mongo_db.users.count_documents({"user_id": QA_SUB})
        assert count == 1, f"Expected exactly 1 user row, found {count}"


# ---------------------------------------------------------------------------
# 4. Profile update persistence
# ---------------------------------------------------------------------------
class TestProfilePersistence:

    def test_put_profile_persists(self, auth_client):
        # Ensure user row exists first
        auth_client.get(f"{API_URL}/auth/me")

        r = auth_client.put(
            f"{API_URL}/profile",
            json={"onboarding_complete": True, "consent_accepted": True, "pronouns": "they/them"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["onboarding_complete"] is True
        assert data["consent_accepted"] is True
        assert data["pronouns"] == "they/them"
        assert_no_mongo_id(data)

        r2 = auth_client.get(f"{API_URL}/auth/me")
        assert r2.status_code == 200
        me = r2.json()
        assert me["onboarding_complete"] is True
        assert me["consent_accepted"] is True
        assert me["pronouns"] == "they/them"


# ---------------------------------------------------------------------------
# 5. Endpoint sanity
# ---------------------------------------------------------------------------
class TestEndpointSanity:

    def test_journal_create_list_update(self, auth_client):
        auth_client.get(f"{API_URL}/auth/me")  # ensure user seeded

        create = auth_client.post(
            f"{API_URL}/journal",
            json={"title": "TEST_entry", "body": "first thoughts", "mood_word": "tender", "mood_score": 3},
        )
        assert create.status_code == 200, create.text
        entry = create.json()
        assert entry["body"] == "first thoughts"
        assert entry["user_id"] == QA_SUB
        assert_no_mongo_id(entry)
        entry_id = entry["entry_id"]

        lst = auth_client.get(f"{API_URL}/journal")
        assert lst.status_code == 200
        entries = lst.json()
        assert any(e["entry_id"] == entry_id for e in entries)
        assert_no_mongo_id(entries)

        upd = auth_client.put(
            f"{API_URL}/journal/{entry_id}",
            json={"body": "revised body", "mood_word": "calmer", "mood_score": 4},
        )
        assert upd.status_code == 200, upd.text
        assert upd.json()["body"] == "revised body"
        assert upd.json()["mood_word"] == "calmer"

    def test_journal_prompt(self, auth_client):
        r = auth_client.get(f"{API_URL}/journal/prompt")
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data.get("prompt"), str) and len(data["prompt"]) > 0

    def test_dashboard_returns_context(self, auth_client):
        r = auth_client.get(f"{API_URL}/dashboard")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "context" in data
        assert isinstance(data["context"], dict)
        assert "is_first_visit" in data["context"]
        assert_no_mongo_id(data)

    def test_memory_path_new_user(self, anon_client, mongo_db):
        fresh_sub = str(uuid.uuid4())
        token = make_jwt(sub=fresh_sub, email=f"mp+{fresh_sub[:6]}@projectlife.local", name="MP")
        try:
            # trigger upsert
            anon_client.get(f"{API_URL}/auth/me", headers={"Authorization": f"Bearer {token}"})
            r = anon_client.get(
                f"{API_URL}/memory-path",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert r.status_code == 200, r.text
            data = r.json()
            assert data == {"stones": []}
        finally:
            mongo_db.users.delete_many({"user_id": fresh_sub})

    def test_phases_returns_four(self, auth_client):
        r = auth_client.get(f"{API_URL}/phases")
        assert r.status_code == 200, r.text
        phases = r.json()
        assert len(phases) == 4
        assert [p["phase"] for p in phases] == [0, 1, 2, 3]
        assert_no_mongo_id(phases)

    def test_safety_contacts_create_and_list(self, auth_client):
        auth_client.get(f"{API_URL}/auth/me")
        c = auth_client.post(
            f"{API_URL}/safety/contacts",
            json={"name": "TEST_Emergency", "phone": "555-0100", "relationship": "friend"},
        )
        assert c.status_code == 200, c.text
        assert c.json()["name"] == "TEST_Emergency"
        assert_no_mongo_id(c.json())

        lst = auth_client.get(f"{API_URL}/safety/contacts")
        assert lst.status_code == 200
        assert any(x["name"] == "TEST_Emergency" for x in lst.json())
        assert_no_mongo_id(lst.json())

    def test_somatic_practices_seeded(self, auth_client):
        r = auth_client.get(f"{API_URL}/somatic-practices")
        assert r.status_code == 200, r.text
        practices = r.json()
        assert len(practices) >= 4
        titles = [p["title"] for p in practices]
        assert "Box Breathing" in titles
        assert_no_mongo_id(practices)


# ---------------------------------------------------------------------------
# 6. Removed endpoints
# ---------------------------------------------------------------------------
class TestRemovedEndpoints:

    def test_auth_session_removed(self, anon_client):
        r = anon_client.post(f"{API_URL}/auth/session", json={"session_id": "anything"})
        assert r.status_code in (404, 405), f"Expected 404/405, got {r.status_code}: {r.text}"

    def test_auth_logout_removed(self, anon_client):
        r = anon_client.post(f"{API_URL}/auth/logout")
        assert r.status_code in (404, 405), f"Expected 404/405, got {r.status_code}: {r.text}"
