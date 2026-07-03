"""End-to-end backend tests for Project Life.

Covers: auth guard, profile update, phases, journal + insights, safety net,
weekly check-ins, therapist uploads, memories, session logs, somatic practices,
trauma-map timeline, phase advance flow, and logout invalidation.
Mocks: Emergent Google OAuth is simulated by inserting the QA user directly
into MongoDB (see conftest.py).
"""
import requests
from conftest import API_URL, QA_TOKEN, QA_USER_ID, assert_no_mongo_id  # noqa: F401


# ------------------------------- Health --------------------------------------
def test_health_root():
    r = requests.get(f"{API_URL}/")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["service"] == "project-life"


# ---------------------------- Auth guarding ----------------------------------
class TestAuthGuard:
    def test_missing_auth_header_401(self, anon_client):
        r = anon_client.get(f"{API_URL}/auth/me")
        assert r.status_code == 401

    def test_invalid_token_401(self, anon_client):
        r = anon_client.get(
            f"{API_URL}/auth/me",
            headers={"Authorization": "Bearer totally-bogus-token"},
        )
        assert r.status_code == 401

    def test_invalid_session_id_rejected(self, anon_client):
        r = anon_client.post(
            f"{API_URL}/auth/session",
            json={"session_id": "definitely-not-real-session-id-12345"},
        )
        assert r.status_code == 401


# ---------------------------- Auth / Profile ---------------------------------
class TestAuthMe:
    def test_auth_me_returns_user(self, auth_client):
        r = auth_client.get(f"{API_URL}/auth/me")
        assert r.status_code == 200
        data = r.json()
        assert data["user_id"] == QA_USER_ID
        assert data["email"] == "qa@projectlife.local"
        assert data["current_phase"] == 0
        assert data["consent_accepted"] is False
        assert_no_mongo_id(data)

    def test_profile_update(self, auth_client):
        r = auth_client.put(
            f"{API_URL}/profile",
            json={
                "pronouns": "they/them",
                "location": "Testville",
                "in_therapy": True,
                "onboarding_complete": True,
            },
        )
        assert r.status_code == 200
        data = r.json()
        assert data["pronouns"] == "they/them"
        assert data["location"] == "Testville"
        assert data["in_therapy"] is True
        assert data["onboarding_complete"] is True
        assert_no_mongo_id(data)


# ------------------------------- Phases --------------------------------------
class TestPhases:
    def test_list_phases(self, auth_client):
        r = auth_client.get(f"{API_URL}/phases")
        assert r.status_code == 200
        phases = r.json()
        assert len(phases) == 4
        assert [p["phase"] for p in phases] == [0, 1, 2, 3]
        assert phases[0]["is_current"] is True
        assert phases[0]["is_unlocked"] is True
        for locked in phases[1:]:
            assert locked["is_unlocked"] is False
            assert locked["is_current"] is False
        assert_no_mongo_id(phases)

    def test_advance_blocked_when_requirements_not_met(self, auth_client):
        r = auth_client.post(f"{API_URL}/phases/advance")
        # QA user just updated profile but consent_accepted still False
        # and no emergency contacts -> progress <100 -> 400
        assert r.status_code == 400


# ------------------------------ Safety net -----------------------------------
class TestSafetyNet:
    contact_id = None

    def test_add_contact(self, auth_client):
        r = auth_client.post(
            f"{API_URL}/safety/contacts",
            json={"name": "TEST_Best Friend", "phone": "+15550001111",
                  "relationship": "friend"},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "TEST_Best Friend"
        assert data["phone"] == "+15550001111"
        assert data["user_id"] == QA_USER_ID
        assert "contact_id" in data
        assert_no_mongo_id(data)
        TestSafetyNet.contact_id = data["contact_id"]

    def test_list_contacts(self, auth_client):
        r = auth_client.get(f"{API_URL}/safety/contacts")
        assert r.status_code == 200
        contacts = r.json()
        assert any(c["contact_id"] == TestSafetyNet.contact_id for c in contacts)
        assert_no_mongo_id(contacts)

    def test_safety_checkin_create_and_today(self, auth_client):
        r = auth_client.post(
            f"{API_URL}/safety/checkin",
            json={"feel_safe": True, "note": "TEST_all good"},
        )
        assert r.status_code == 200
        assert r.json()["feel_safe"] is True

        r2 = auth_client.get(f"{API_URL}/safety/checkin/today")
        assert r2.status_code == 200
        today = r2.json()
        assert today is not None
        assert today["feel_safe"] is True
        assert today["note"] == "TEST_all good"
        assert_no_mongo_id(today)

    def test_crisis_resources(self, auth_client):
        r = auth_client.get(f"{API_URL}/safety/crisis-resources")
        assert r.status_code == 200
        data = r.json()
        assert "resources" in data
        assert len(data["resources"]) == 4
        for res in data["resources"]:
            assert {"name", "contact", "kind"}.issubset(res.keys())


# ------------------------------- Journal -------------------------------------
class TestJournal:
    def test_create_journal(self, auth_client):
        r = auth_client.post(
            f"{API_URL}/journal",
            json={"title": "TEST", "body": "felt calm today",
                  "mood_word": "calm", "mood_score": 4},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["mood_word"] == "calm"
        assert data["mood_score"] == 4
        assert_no_mongo_id(data)

    def test_create_second_journal_and_list(self, auth_client):
        auth_client.post(
            f"{API_URL}/journal",
            json={"body": "still calm", "mood_word": "calm", "mood_score": 5},
        )
        r = auth_client.get(f"{API_URL}/journal")
        assert r.status_code == 200
        entries = r.json()
        assert len(entries) >= 2
        assert_no_mongo_id(entries)

    def test_journal_insights(self, auth_client):
        r = auth_client.get(f"{API_URL}/journal/insights")
        assert r.status_code == 200
        data = r.json()
        assert data["entry_count"] >= 2
        assert data["avg_mood"] is not None and data["avg_mood"] > 0
        words = {w["word"]: w["count"] for w in data["top_words"]}
        assert words.get("calm", 0) >= 2
        assert_no_mongo_id(data)


# --------------------------- Weekly check-ins --------------------------------
class TestWeeklyCheckIn:
    def test_create_and_list(self, auth_client):
        r = auth_client.post(
            f"{API_URL}/checkins/weekly",
            json={"feeling_summary": "TEST steady", "themes": "grounding",
                  "mood_score": 4},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["mood_score"] == 4
        assert data["week_key"] and "-" in data["week_key"]
        assert_no_mongo_id(data)

        r2 = auth_client.get(f"{API_URL}/checkins/weekly")
        assert r2.status_code == 200
        assert len(r2.json()) >= 1
        assert_no_mongo_id(r2.json())


# --------------------------- Therapist uploads -------------------------------
class TestTherapistUploads:
    def test_create_and_list_strips_base64(self, auth_client):
        r = auth_client.post(
            f"{API_URL}/therapist-uploads",
            json={"filename": "TEST_summary.pdf", "kind": "weekly_summary",
                  "notes": "TEST notes",
                  "file_base64": "SGVsbG8gd29ybGQ="},
        )
        assert r.status_code == 200
        created = r.json()
        assert created["kind"] == "weekly_summary"
        assert created["file_base64"] == "SGVsbG8gd29ybGQ="

        r2 = auth_client.get(f"{API_URL}/therapist-uploads")
        assert r2.status_code == 200
        uploads = r2.json()
        assert len(uploads) >= 1
        for u in uploads:
            assert u["file_base64"] is None, "file_base64 must be stripped in list response"
        assert_no_mongo_id(uploads)


# ------------------------------- Memories ------------------------------------
class TestMemories:
    def test_create_memory_no_phase_gate(self, auth_client):
        # User is still in phase 0; endpoint should NOT gate on phase
        r = auth_client.post(
            f"{API_URL}/memories",
            json={"title": "TEST memory", "description": "a description",
                  "body_sensation": "tight chest",
                  "target_belief": "I am safe"},
        )
        assert r.status_code == 200
        assert r.json()["title"] == "TEST memory"
        assert_no_mongo_id(r.json())


# ---------------------------- Session logs -----------------------------------
class TestSessionLogs:
    def test_create_session_log(self, auth_client):
        r = auth_client.post(
            f"{API_URL}/session-logs",
            json={"session_type": "therapy", "body_experience": "TEST relaxed",
                  "insights": "seen the pattern",
                  "integration_notes": "journal tonight"},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["session_type"] == "therapy"
        assert data["date"] is not None
        assert_no_mongo_id(data)


# --------------------------- Somatic practices -------------------------------
class TestSomaticPractices:
    def test_list_practices(self, auth_client):
        r = auth_client.get(f"{API_URL}/somatic-practices")
        assert r.status_code == 200
        practices = r.json()
        assert len(practices) == 8
        for p in practices:
            assert "unlock_phase" in p
            assert isinstance(p["unlock_phase"], int)
            assert p["instructions"] and isinstance(p["instructions"], list)
        assert_no_mongo_id(practices)


# --------------------------- Trauma-map timeline -----------------------------
class TestTimeline:
    def test_create_and_list(self, auth_client):
        r = auth_client.post(
            f"{API_URL}/timeline",
            json={"title": "TEST early memory", "insight": "roots here",
                  "emotion": "sadness"},
        )
        assert r.status_code == 200
        ev = r.json()
        assert ev["title"] == "TEST early memory"
        assert ev["event_date"] is not None
        assert_no_mongo_id(ev)

        r2 = auth_client.get(f"{API_URL}/timeline")
        assert r2.status_code == 200
        assert len(r2.json()) >= 1


# ------------------------- Phase advance flow --------------------------------
class TestPhaseAdvanceFlow:
    """After accepting consent + adding a contact, phase 0 -> 1 should succeed."""

    def test_accept_consent_then_advance(self, auth_client):
        # Accept consent
        r = auth_client.put(f"{API_URL}/profile",
                            json={"consent_accepted": True})
        assert r.status_code == 200
        assert r.json()["consent_accepted"] is True

        # Progress should now be 100 (consent 50 + contact 50 from earlier test)
        r_phases = auth_client.get(f"{API_URL}/phases")
        phase0 = next(p for p in r_phases.json() if p["phase"] == 0)
        assert phase0["progress_pct"] == 100

        # Advance
        r_adv = auth_client.post(f"{API_URL}/phases/advance")
        assert r_adv.status_code == 200, r_adv.text
        assert r_adv.json()["current_phase"] == 1

    def test_delete_contact(self, auth_client):
        # Cleanup: delete the contact we created (also proves DELETE endpoint)
        contact_id = TestSafetyNet.contact_id
        assert contact_id, "contact_id from earlier test was not persisted"
        r = auth_client.delete(f"{API_URL}/safety/contacts/{contact_id}")
        assert r.status_code == 200
        assert r.json() == {"ok": True}
        # Verify gone
        r2 = auth_client.get(f"{API_URL}/safety/contacts")
        assert all(c["contact_id"] != contact_id for c in r2.json())


# -------------- Auth fix regression: bad session_id shapes -------------------
class TestAuthSessionRegression:
    """Regression for the OAuth fix in AuthContext.tsx.

    parseSessionId() previously produced a session_id with a trailing '?'.
    Backend must reject any such malformed / non-existent session_id with 401,
    never 200 and never 500.
    """

    def test_session_id_with_trailing_question_mark_rejected(self, anon_client):
        r = anon_client.post(
            f"{API_URL}/auth/session",
            json={"session_id": "abc?"},
        )
        assert r.status_code == 401, r.text

    def test_session_id_valid_shape_but_nonexistent_rejected(self, anon_client):
        r = anon_client.post(
            f"{API_URL}/auth/session",
            json={"session_id": "a" * 40},
        )
        assert r.status_code == 401, r.text

    def test_session_id_empty_string_rejected(self, anon_client):
        r = anon_client.post(
            f"{API_URL}/auth/session",
            json={"session_id": ""},
        )
        # Either 401 (rejected by upstream) or 422 (validation) is acceptable
        assert r.status_code in (401, 422), r.text


# ---------------------------- Dashboard --------------------------------------
class TestDashboard:
    def test_dashboard_requires_auth(self, anon_client):
        r = anon_client.get(f"{API_URL}/dashboard")
        assert r.status_code == 401

    def test_dashboard_shape_and_values(self, auth_client):
        r = auth_client.get(f"{API_URL}/dashboard")
        assert r.status_code == 200, r.text
        data = r.json()
        # Required top-level keys
        for k in ("sessions_this_week", "sessions_completed",
                  "sessions_target", "journey_progress_pct", "weekly"):
            assert k in data, f"missing key {k}"
        # Type + non-negativity checks
        assert isinstance(data["sessions_this_week"], int)
        assert isinstance(data["sessions_completed"], int)
        assert isinstance(data["sessions_target"], int)
        assert isinstance(data["journey_progress_pct"], int)
        assert data["sessions_this_week"] >= 0
        assert data["sessions_completed"] >= 0
        assert data["sessions_target"] > 0
        assert 0 <= data["journey_progress_pct"] <= 100
        # Weekly array = 5 buckets, each an int count >= 0
        weekly = data["weekly"]
        assert isinstance(weekly, list) and len(weekly) == 5
        for bucket in weekly:
            assert isinstance(bucket, dict)
            assert "count" in bucket and isinstance(bucket["count"], int)
            assert bucket["count"] >= 0
            assert "week_start" in bucket and "week_end" in bucket
        assert_no_mongo_id(data)

    def test_dashboard_reflects_activity(self, auth_client):
        """After the earlier tests created journal/checkin/session log entries,
        sessions_completed should be > 0."""
        r = auth_client.get(f"{API_URL}/dashboard")
        assert r.status_code == 200
        data = r.json()
        assert data["sessions_completed"] > 0, \
            "dashboard shows 0 activity but journal/checkin/session-log created earlier"


# ------------------- Onboarding starting-phase -------------------------------
class TestStartingPhase:
    def test_starting_phase_requires_auth(self, anon_client):
        r = anon_client.post(
            f"{API_URL}/onboarding/starting-phase",
            json={"phase": 2},
        )
        assert r.status_code == 401

    def test_starting_phase_rejects_zero(self, auth_client):
        r = auth_client.post(
            f"{API_URL}/onboarding/starting-phase",
            json={"phase": 0},
        )
        assert r.status_code == 400, r.text

    def test_starting_phase_rejects_four(self, auth_client):
        r = auth_client.post(
            f"{API_URL}/onboarding/starting-phase",
            json={"phase": 4},
        )
        assert r.status_code == 400, r.text

    def test_starting_phase_accepts_two_and_updates_user(self, auth_client):
        r = auth_client.post(
            f"{API_URL}/onboarding/starting-phase",
            json={"phase": 2},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["current_phase"] == 2
        assert data["user_id"] == QA_USER_ID
        assert_no_mongo_id(data)

        # GET to verify persistence
        r2 = auth_client.get(f"{API_URL}/auth/me")
        assert r2.status_code == 200
        assert r2.json()["current_phase"] == 2


# ------------------------------- Logout --------------------------------------
class TestLogout:
    def test_logout_invalidates_token(self, auth_client):
        r = auth_client.post(f"{API_URL}/auth/logout")
        assert r.status_code == 200
        assert r.json() == {"ok": True}

        # Subsequent request must be unauthorized
        r2 = auth_client.get(f"{API_URL}/auth/me")
        assert r2.status_code == 401
