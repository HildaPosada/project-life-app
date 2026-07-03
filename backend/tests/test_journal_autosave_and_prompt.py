"""
Iteration 4 backend tests — new journal endpoints:
  - PUT /api/journal/{entry_id}   (autosave-friendly update)
  - GET /api/journal/prompt       (rotating writing prompt + recent_mood)

Plus a small regression sanity sweep to confirm iteration-3 behavior still holds.
"""
from datetime import datetime, timedelta, timezone

import pytest
import requests


def _parse_dt(s: str) -> datetime:
    """Robust ISO parse tolerating trailing Z and optional tz."""
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _dt_equal(a: str, b: str) -> bool:
    """Equal to the millisecond (Mongo trims to ms & drops tz)."""
    da, db = _parse_dt(a), _parse_dt(b)
    return abs((da - db).total_seconds()) < 0.002

from conftest import API_URL, QA_TOKEN, QA_USER_ID, assert_no_mongo_id

# Second QA user (for cross-user isolation)
QA_USER_ID_B = "user_qatest_b"
QA_EMAIL_B = "qa_b@projectlife.local"
QA_TOKEN_B = "qa-token-xyz-b"

ACTIVITY_COLLS = [
    "journal_entries", "weekly_checkins", "session_logs",
    "safety_checkins", "emergency_contacts", "therapist_uploads",
    "memories", "timeline_events",
]


@pytest.fixture(autouse=True)
def _reset_between_tests(mongo_db):
    """Per-test cleanup for both users; keeps counts deterministic."""
    now = datetime.now(timezone.utc)

    def _wipe():
        for coll in ACTIVITY_COLLS:
            mongo_db[coll].delete_many({"user_id": QA_USER_ID})
            mongo_db[coll].delete_many({"user_id": QA_USER_ID_B})
        mongo_db.users.update_one(
            {"user_id": QA_USER_ID},
            {"$set": {"current_phase": 0, "consent_accepted": False,
                      "onboarding_complete": False, "updated_at": now}},
        )
        # Ensure user B + session exist for isolation tests
        mongo_db.users.delete_many({"user_id": QA_USER_ID_B})
        mongo_db.users.delete_many({"email": QA_EMAIL_B})
        mongo_db.user_sessions.delete_many({"session_token": QA_TOKEN_B})

    _wipe()

    # Re-seed user B fresh
    mongo_db.users.insert_one({
        "user_id": QA_USER_ID_B, "email": QA_EMAIL_B, "name": "QA Tester B",
        "picture": None, "pronouns": None, "location": None, "in_therapy": None,
        "therapist_release_form": None, "consent_accepted": False,
        "onboarding_complete": False, "current_phase": 0,
        "created_at": now, "updated_at": now,
    })
    mongo_db.user_sessions.insert_one({
        "session_token": QA_TOKEN_B, "user_id": QA_USER_ID_B,
        "expires_at": now + timedelta(days=7), "created_at": now,
    })
    yield
    _wipe()


@pytest.fixture
def client_b():
    s = requests.Session()
    s.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {QA_TOKEN_B}",
    })
    return s


# ---------------------------------------------------------------------------
# PUT /api/journal/{entry_id}
# ---------------------------------------------------------------------------
class TestJournalUpdate:
    """Autosave-friendly PUT /api/journal/{entry_id}."""

    def test_requires_auth(self, anon_client):
        r = anon_client.put(f"{API_URL}/journal/j_anything",
                            json={"body": "no auth"})
        assert r.status_code == 401

    def test_nonexistent_entry_returns_404(self, auth_client):
        r = auth_client.put(f"{API_URL}/journal/j_doesnotexist",
                            json={"body": "nope"})
        assert r.status_code == 404

    def test_full_update_preserves_id_and_created_at(self, auth_client):
        # Create
        create = auth_client.post(f"{API_URL}/journal", json={
            "title": "orig title", "body": "orig body",
            "mood_word": "Heavy", "mood_score": 2,
        })
        assert create.status_code == 200
        original = create.json()
        assert_no_mongo_id(original)
        entry_id = original["entry_id"]
        original_created_at = original["created_at"]

        # Update
        updated_payload = {
            "title": "new title", "body": "new body",
            "mood_word": "Bright", "mood_score": 5,
        }
        upd = auth_client.put(f"{API_URL}/journal/{entry_id}",
                              json=updated_payload)
        assert upd.status_code == 200
        data = upd.json()
        assert_no_mongo_id(data)

        assert data["entry_id"] == entry_id
        assert data["user_id"] == QA_USER_ID
        assert data["title"] == "new title"
        assert data["body"] == "new body"
        assert data["mood_word"] == "Bright"
        assert data["mood_score"] == 5
        # created_at must not be overwritten (compare at ms precision;
        # Mongo trims microseconds and strips tz on read-back)
        assert _dt_equal(data["created_at"], original_created_at)

        # Verify persistence via GET /journal
        listing = auth_client.get(f"{API_URL}/journal")
        assert listing.status_code == 200
        entries = listing.json()
        assert_no_mongo_id(entries)
        matches = [e for e in entries if e["entry_id"] == entry_id]
        assert len(matches) == 1
        assert matches[0]["body"] == "new body"
        assert matches[0]["title"] == "new title"
        assert matches[0]["mood_word"] == "Bright"
        assert matches[0]["mood_score"] == 5

    def test_partial_update_only_updates_provided_fields(self, auth_client):
        create = auth_client.post(f"{API_URL}/journal", json={
            "title": "keep this title", "body": "old body",
            "mood_word": "Tender", "mood_score": 3,
        })
        assert create.status_code == 200
        entry_id = create.json()["entry_id"]
        orig_created_at = create.json()["created_at"]

        # Only body sent
        upd = auth_client.put(f"{API_URL}/journal/{entry_id}",
                              json={"body": "new text only"})
        assert upd.status_code == 200
        data = upd.json()
        assert data["body"] == "new text only"
        # Untouched fields preserved
        assert data["title"] == "keep this title"
        assert data["mood_word"] == "Tender"
        assert data["mood_score"] == 3
        assert _dt_equal(data["created_at"], orig_created_at)
        assert data["entry_id"] == entry_id

    def test_cross_user_cannot_update_returns_404(self, auth_client, client_b):
        # user A creates
        create = auth_client.post(f"{API_URL}/journal",
                                  json={"body": "A's private entry"})
        assert create.status_code == 200
        a_entry_id = create.json()["entry_id"]

        # user B tries to update A's entry — MUST NOT return 403 (would leak
        # existence). Spec: return 404.
        r = client_b.put(f"{API_URL}/journal/{a_entry_id}",
                         json={"body": "B's overwrite attempt"})
        assert r.status_code == 404

        # And A's entry is untouched
        listing = auth_client.get(f"{API_URL}/journal")
        assert listing.status_code == 200
        entries = listing.json()
        assert len(entries) == 1
        assert entries[0]["entry_id"] == a_entry_id
        assert entries[0]["body"] == "A's private entry"


# ---------------------------------------------------------------------------
# GET /api/journal/prompt
# ---------------------------------------------------------------------------
class TestJournalPrompt:

    def test_requires_auth(self, anon_client):
        r = anon_client.get(f"{API_URL}/journal/prompt")
        assert r.status_code == 401

    def test_shape_and_recent_mood_null_when_empty(self, auth_client):
        r = auth_client.get(f"{API_URL}/journal/prompt")
        assert r.status_code == 200
        data = r.json()
        assert_no_mongo_id(data)
        assert set(data.keys()) >= {"prompt", "recent_mood"}
        assert isinstance(data["prompt"], str) and len(data["prompt"]) > 0
        assert data["recent_mood"] is None

    def test_recent_mood_reflects_latest_entry(self, auth_client):
        auth_client.post(f"{API_URL}/journal",
                         json={"body": "first", "mood_word": "Tender"})
        r = auth_client.get(f"{API_URL}/journal/prompt")
        assert r.status_code == 200
        data = r.json()
        assert data["recent_mood"] == "Tender"
        assert isinstance(data["prompt"], str) and len(data["prompt"]) > 0

    def test_prompt_is_deterministic_within_day_for_same_user(self, auth_client):
        r1 = auth_client.get(f"{API_URL}/journal/prompt")
        r2 = auth_client.get(f"{API_URL}/journal/prompt")
        assert r1.status_code == 200 and r2.status_code == 200
        assert r1.json()["prompt"] == r2.json()["prompt"]


# ---------------------------------------------------------------------------
# Regression sanity sweep (max 5 endpoints)
# ---------------------------------------------------------------------------
class TestRegressionSanity:

    def test_post_journal_still_works(self, auth_client):
        r = auth_client.post(f"{API_URL}/journal",
                             json={"body": "regression", "mood_word": "Calm",
                                   "mood_score": 4})
        assert r.status_code == 200
        data = r.json()
        assert_no_mongo_id(data)
        assert data["body"] == "regression"
        assert data["mood_word"] == "Calm"
        assert data["mood_score"] == 4
        assert data["user_id"] == QA_USER_ID
        assert data["entry_id"].startswith("j_")

    def test_dashboard_still_returns_context(self, auth_client):
        r = auth_client.get(f"{API_URL}/dashboard")
        assert r.status_code == 200
        data = r.json()
        assert_no_mongo_id(data)
        assert "context" in data, f"context field missing: {data.keys()}"
        ctx = data["context"]
        for key in ("days_since_last_activity", "active_days_count",
                    "is_first_visit", "is_returning",
                    "milestone_today", "milestone_title"):
            assert key in ctx, f"context.{key} missing"

    def test_memory_path_returns_stones(self, auth_client):
        # No activity -> empty stones list
        r = auth_client.get(f"{API_URL}/memory-path")
        assert r.status_code == 200
        data = r.json()
        assert_no_mongo_id(data)
        assert "stones" in data
        assert data["stones"] == []

        # 1 journal -> 1 stone
        auth_client.post(f"{API_URL}/journal", json={"body": "first stone"})
        r2 = auth_client.get(f"{API_URL}/memory-path")
        assert r2.status_code == 200
        stones = r2.json()["stones"]
        assert len(stones) == 1
        assert stones[0]["kind"] == "journal"
        assert stones[0]["title"] == "The first stone"

    def test_auth_me_with_valid_bearer(self, auth_client):
        r = auth_client.get(f"{API_URL}/auth/me")
        assert r.status_code == 200
        data = r.json()
        assert_no_mongo_id(data)
        assert data["user_id"] == QA_USER_ID
        assert data["email"] == "qa@projectlife.local"

    def test_phases_returns_4(self, auth_client):
        r = auth_client.get(f"{API_URL}/phases")
        assert r.status_code == 200
        phases = r.json()
        assert_no_mongo_id(phases)
        assert len(phases) == 4
        assert [p["phase"] for p in phases] == [0, 1, 2, 3]
