"""Iteration 3 — Tests for Memory Path endpoints and dashboard.context.

Covers:
- GET /api/dashboard new `context` field (fresh + after journal)
- GET /api/memory-path stone derivation (empty, 1 journal, 5 journals,
  4 weekly checkins, phase stone)
- GET /api/memory-path/{stone_id} detail (journal + checkin + 404 + auth)
- Regression sanity: /auth/session bad id, /auth/me, /journal, /phases

All tests wipe user-scoped activity collections between subtests so counts
start from a known baseline (per review-request instruction).
"""
from datetime import datetime, timezone

import pytest
import requests

from conftest import API_URL, QA_TOKEN, QA_USER_ID, assert_no_mongo_id


ACTIVITY_COLLS = [
    "journal_entries", "weekly_checkins", "session_logs",
    "safety_checkins", "emergency_contacts", "therapist_uploads",
    "memories", "timeline_events",
]


def _wipe_activity(mongo_db):
    for c in ACTIVITY_COLLS:
        mongo_db[c].delete_many({"user_id": QA_USER_ID})


def _reset_user(mongo_db):
    """Reset the seeded QA user to a fresh state (phase 0, no consent)."""
    mongo_db.users.update_one(
        {"user_id": QA_USER_ID},
        {"$set": {"current_phase": 0, "consent_accepted": False,
                  "onboarding_complete": False,
                  "updated_at": datetime.now(timezone.utc)}},
    )


@pytest.fixture(autouse=True)
def clean_state(mongo_db):
    """Before every test in this file: wipe activity + reset user."""
    _wipe_activity(mongo_db)
    _reset_user(mongo_db)
    yield
    _wipe_activity(mongo_db)
    _reset_user(mongo_db)


# =============================================================================
# 1) Dashboard `context` field
# =============================================================================
class TestDashboardContext:
    def test_fresh_user_context(self, auth_client):
        r = auth_client.get(f"{API_URL}/dashboard")
        assert r.status_code == 200, r.text
        data = r.json()

        # Existing fields still present
        for k in ("sessions_this_week", "sessions_completed", "sessions_target",
                  "journey_progress_pct", "weekly"):
            assert k in data, f"missing legacy key {k}"
        assert data["sessions_completed"] == 0
        assert data["sessions_this_week"] == 0
        assert isinstance(data["weekly"], list) and len(data["weekly"]) == 5

        # New context object
        ctx = data.get("context")
        assert ctx is not None, "context field missing"
        for k in ("days_since_last_activity", "active_days_count",
                  "is_first_visit", "is_returning",
                  "milestone_today", "milestone_title"):
            assert k in ctx, f"context missing key {k}"

        assert ctx["days_since_last_activity"] is None
        assert ctx["active_days_count"] == 0
        assert ctx["is_first_visit"] is True
        assert ctx["is_returning"] is False
        assert ctx["milestone_today"] is False
        assert ctx["milestone_title"] is None
        assert_no_mongo_id(data)

    def test_context_after_journal_entry(self, auth_client):
        # Create a journal entry
        r = auth_client.post(
            f"{API_URL}/journal",
            json={"title": "TEST", "body": "grounded today",
                  "mood_word": "grounded", "mood_score": 4},
        )
        assert r.status_code == 200

        r2 = auth_client.get(f"{API_URL}/dashboard")
        assert r2.status_code == 200
        ctx = r2.json()["context"]

        assert ctx["is_first_visit"] is False
        assert ctx["days_since_last_activity"] == 0
        assert ctx["active_days_count"] == 1
        assert ctx["is_returning"] is False
        # First stone is dated today -> milestone_today should fire
        assert ctx["milestone_today"] is True
        assert ctx["milestone_title"] == "The first stone"


# =============================================================================
# 2) GET /api/memory-path
# =============================================================================
class TestMemoryPathList:
    def test_requires_auth(self, anon_client):
        r = anon_client.get(f"{API_URL}/memory-path")
        assert r.status_code == 401

    def test_empty_user_returns_empty_stones(self, auth_client):
        r = auth_client.get(f"{API_URL}/memory-path")
        assert r.status_code == 200
        body = r.json()
        assert body == {"stones": []}
        assert_no_mongo_id(body)

    def test_one_journal_yields_first_stone(self, auth_client):
        auth_client.post(
            f"{API_URL}/journal",
            json={"body": "first ever entry, feeling brave",
                  "mood_word": "brave", "mood_score": 4},
        )
        r = auth_client.get(f"{API_URL}/memory-path")
        assert r.status_code == 200
        stones = r.json()["stones"]
        assert len(stones) == 1
        s = stones[0]
        assert s["kind"] == "journal"
        assert s["title"] == "The first stone"
        assert s["stone_id"].startswith("stone_journal_")
        assert s["ref_id"].startswith("j_")
        # date must be an ISO date string (not a datetime obj)
        assert isinstance(s["date"], str)
        datetime.strptime(s["date"], "%Y-%m-%d")  # parses -> valid ISO date
        assert "first ever entry" in s["preview"]
        # No datetime object should have leaked
        assert "created_at" not in s
        assert_no_mongo_id(stones)

    def test_five_journals_yields_two_stones_ordered(self, auth_client):
        for i in range(5):
            r = auth_client.post(
                f"{API_URL}/journal",
                json={"body": f"entry number {i + 1} — reflecting",
                      "mood_word": "steady", "mood_score": 3},
            )
            assert r.status_code == 200

        r = auth_client.get(f"{API_URL}/memory-path")
        assert r.status_code == 200
        stones = r.json()["stones"]
        # Expect exactly 2 journal stones: first + chapter 5
        assert len(stones) == 2, stones
        assert stones[0]["title"] == "The first stone"
        assert stones[1]["title"] == "Chapter 5 of reflection"
        # Chronological ordering
        assert stones[0]["date"] <= stones[1]["date"]
        for s in stones:
            assert s["kind"] == "journal"
            assert "created_at" not in s
        assert_no_mongo_id(stones)

    def test_four_weekly_checkins_add_checkin_stone(self, auth_client):
        # Start with 1 journal so we know journal stone stays
        auth_client.post(f"{API_URL}/journal", json={"body": "seed"})
        for i in range(4):
            r = auth_client.post(
                f"{API_URL}/checkins/weekly",
                json={"feeling_summary": f"steady week {i + 1}",
                      "themes": "grounding", "mood_score": 4},
            )
            assert r.status_code == 200

        r = auth_client.get(f"{API_URL}/memory-path")
        assert r.status_code == 200
        stones = r.json()["stones"]
        kinds = [s["kind"] for s in stones]
        assert "journal" in kinds
        assert kinds.count("checkin") == 1
        checkin_stone = next(s for s in stones if s["kind"] == "checkin")
        assert checkin_stone["title"] == "A month of showing up"
        assert checkin_stone["stone_id"].startswith("stone_checkin_")
        assert_no_mongo_id(stones)

    def test_phase_stone_when_current_phase_gt_zero(self, auth_client, mongo_db):
        # Bump user to phase 1
        mongo_db.users.update_one(
            {"user_id": QA_USER_ID},
            {"$set": {"current_phase": 1,
                      "updated_at": datetime.now(timezone.utc)}},
        )
        r = auth_client.get(f"{API_URL}/memory-path")
        assert r.status_code == 200
        stones = r.json()["stones"]
        phase_stones = [s for s in stones if s["kind"] == "phase"]
        assert len(phase_stones) == 1
        p = phase_stones[0]
        assert p["stone_id"] == "stone_phase_1"
        assert p["ref_id"] == "1"
        assert "Season 1" in p["title"]
        assert "created_at" not in p
        assert_no_mongo_id(stones)


# =============================================================================
# 3) GET /api/memory-path/{stone_id}
# =============================================================================
class TestMemoryStoneDetail:
    def test_requires_auth(self, anon_client):
        r = anon_client.get(f"{API_URL}/memory-path/stone_journal_anything")
        assert r.status_code == 401

    def test_invalid_stone_id_returns_404(self, auth_client):
        r = auth_client.get(f"{API_URL}/memory-path/stone_does_not_exist")
        assert r.status_code == 404

    def test_journal_stone_detail_has_entry(self, auth_client):
        create = auth_client.post(
            f"{API_URL}/journal",
            json={"title": "TEST detail",
                  "body": "a real entry with a mood",
                  "mood_word": "hopeful", "mood_score": 5},
        )
        assert create.status_code == 200
        entry_id = create.json()["entry_id"]

        list_r = auth_client.get(f"{API_URL}/memory-path")
        assert list_r.status_code == 200
        stone_id = list_r.json()["stones"][0]["stone_id"]

        r = auth_client.get(f"{API_URL}/memory-path/{stone_id}")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["stone_id"] == stone_id
        assert d["kind"] == "journal"
        assert "entry" in d, "detail must include the actual journal entry"
        entry = d["entry"]
        assert entry["entry_id"] == entry_id
        assert entry["title"] == "TEST detail"
        assert entry["body"] == "a real entry with a mood"
        assert entry["mood_word"] == "hopeful"
        assert entry["mood_score"] == 5
        assert "created_at" not in d  # datetime stripped at top level
        assert_no_mongo_id(d)

    def test_checkin_stone_detail_has_entry(self, auth_client):
        for i in range(4):
            r = auth_client.post(
                f"{API_URL}/checkins/weekly",
                json={"feeling_summary": f"showing up wk {i + 1}",
                      "themes": "consistency", "mood_score": 4},
            )
            assert r.status_code == 200
        list_r = auth_client.get(f"{API_URL}/memory-path")
        checkin_stone = next(
            s for s in list_r.json()["stones"] if s["kind"] == "checkin"
        )
        r = auth_client.get(f"{API_URL}/memory-path/{checkin_stone['stone_id']}")
        assert r.status_code == 200
        d = r.json()
        assert d["kind"] == "checkin"
        assert "entry" in d
        entry = d["entry"]
        assert entry["checkin_id"] == checkin_stone["ref_id"]
        assert entry["mood_score"] == 4
        assert "feeling_summary" in entry
        assert_no_mongo_id(d)


# =============================================================================
# 4) Regression sanity (iterations 1–2)
# =============================================================================
class TestRegressionSanity:
    def test_bad_session_id_still_401(self):
        r = requests.post(
            f"{API_URL}/auth/session",
            json={"session_id": "not-a-real-session-id"},
        )
        assert r.status_code == 401

    def test_auth_me_valid_bearer_200(self, auth_client):
        r = auth_client.get(f"{API_URL}/auth/me")
        assert r.status_code == 200
        assert r.json()["user_id"] == QA_USER_ID

    def test_journal_post_still_works(self, auth_client):
        r = auth_client.post(
            f"{API_URL}/journal",
            json={"body": "regression check", "mood_score": 3},
        )
        assert r.status_code == 200
        assert r.json()["body"] == "regression check"

    def test_phases_returns_four(self, auth_client):
        r = auth_client.get(f"{API_URL}/phases")
        assert r.status_code == 200
        phases = r.json()
        assert len(phases) == 4
        assert [p["phase"] for p in phases] == [0, 1, 2, 3]
