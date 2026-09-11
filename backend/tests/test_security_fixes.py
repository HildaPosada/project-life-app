"""Security fix verification tests for Project Life backend.

Covers:
  SEC-001 — POST /api/entitlement/mock requires caller email in ADMIN_EMAILS
            allowlist (full email or @domain suffix).
  SEC-002 — /app/.gitignore contains explicit backend/.env and frontend/.env.
  SEC-003 — POST /api/phases/advance returns 402 premium_required when
            advancing to phase >= 2 without an active premium entitlement.
  P3      — JWT issuer pinning (rejects wrong iss) + 30s clock-skew leeway.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
import requests
from jose import jwt as jose_jwt

from conftest import (
    API_URL,
    SUPABASE_JWT_SECRET,
    SUPABASE_ISSUER,
    make_jwt,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _client_for_token(token: str) -> requests.Session:
    s = requests.Session()
    s.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    })
    return s


def _cleanup(mongo_db, sub: str, email: str | None = None):
    collections = [
        "users", "journal_entries", "weekly_checkins", "safety_checkins",
        "emergency_contacts", "therapist_uploads", "memories",
        "session_logs", "timeline_events",
    ]
    for coll in collections:
        mongo_db[coll].delete_many({"user_id": sub})
    if email:
        mongo_db.users.delete_many({"email": email})


# ---------------------------------------------------------------------------
# SEC-001 — mock endpoint email allowlist
# ---------------------------------------------------------------------------
class TestSEC001MockEndpointAllowlist:
    """Verify ADMIN_EMAILS gating on POST /api/entitlement/mock."""

    def test_allowlisted_domain_can_use_mock(self, auth_client):
        """(a) QA user in @projectlife.local domain -> 200."""
        r = auth_client.post(f"{API_URL}/entitlement/mock", json={"premium": True})
        assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text}"
        body = r.json()
        assert body["is_premium"] is True
        assert body["entitlement"] == "premium"
        assert body["source"] == "mock"

        # cleanup: downgrade
        auth_client.post(f"{API_URL}/entitlement/mock", json={"premium": False})

    def test_non_allowlisted_email_gets_404(self, mongo_db):
        """(b) User with non-allowlisted email -> 404 even if ALLOW_MOCK_ENTITLEMENT=1."""
        sub = "22222222-2222-4222-8222-222222222222"
        email = "random@notallowed.example"
        _cleanup(mongo_db, sub, email)
        try:
            token = make_jwt(sub=sub, email=email, name="Not Allowed")
            client = _client_for_token(token)
            r = client.post(f"{API_URL}/entitlement/mock", json={"premium": True})
            assert r.status_code == 404, f"expected 404, got {r.status_code}: {r.text}"

            # Ensure user was NOT upgraded — verify entitlement GET still free
            r2 = client.get(f"{API_URL}/entitlement")
            assert r2.status_code == 200
            body = r2.json()
            assert body["is_premium"] is False
            assert body["entitlement"] == "free"
        finally:
            _cleanup(mongo_db, sub, email)


# ---------------------------------------------------------------------------
# SEC-002 — .gitignore contains env paths
# ---------------------------------------------------------------------------
class TestSEC002GitignoreEnvPaths:
    def test_gitignore_contains_backend_and_frontend_env(self):
        gitignore = Path("/app/.gitignore")
        assert gitignore.exists(), "/app/.gitignore missing"
        contents = gitignore.read_text()
        # Match exact lines to avoid false positive from comments/globs
        lines = {line.strip() for line in contents.splitlines()}
        assert "backend/.env" in lines, "backend/.env not gitignored"
        assert "frontend/.env" in lines, "frontend/.env not gitignored"


# ---------------------------------------------------------------------------
# SEC-003 — server-side premium enforcement on /phases/advance
# ---------------------------------------------------------------------------
class TestSEC003PhasesAdvancePremiumEnforcement:

    def _complete_phase_0(self, client, mongo_db, sub):
        """Bring user to 100% phase 0 progress so advance is allowed by
        completeness check. Phase 0 requires: consent_accepted + 1 emergency
        contact (50 + 50 = 100)."""
        r = client.put(f"{API_URL}/profile", json={"consent_accepted": True})
        assert r.status_code == 200, r.text
        r = client.post(
            f"{API_URL}/safety/contacts",
            json={"name": "Test", "phone": "555-0100"},
        )
        assert r.status_code == 200, r.text

    def _complete_phase_1(self, client, mongo_db, sub):
        """4 weekly check-ins + 1 therapist upload -> 100%."""
        for i in range(4):
            r = client.post(
                f"{API_URL}/checkins/weekly",
                json={"feeling_summary": f"wk{i}", "mood_score": 3},
            )
            assert r.status_code == 200, r.text
        r = client.post(
            f"{API_URL}/therapist-uploads",
            json={"filename": "note.pdf", "kind": "weekly_summary"},
        )
        assert r.status_code == 200, r.text

    def test_phase_0_to_1_free_user_succeeds(self, mongo_db):
        """(c) Free user advancing from phase 0 -> 1 succeeds (no premium)."""
        sub = "33333333-3333-4333-8333-333333333333"
        email = "free-p0@projectlife.local"
        _cleanup(mongo_db, sub, email)
        try:
            token = make_jwt(sub=sub, email=email, name="Free P0")
            client = _client_for_token(token)

            # Bootstrap user
            r = client.get(f"{API_URL}/auth/me")
            assert r.status_code == 200
            assert r.json()["current_phase"] == 0

            self._complete_phase_0(client, mongo_db, sub)

            r = client.post(f"{API_URL}/phases/advance")
            assert r.status_code == 200, f"free user should advance 0->1: {r.text}"
            assert r.json()["current_phase"] == 1
        finally:
            _cleanup(mongo_db, sub, email)

    def test_phase_1_to_2_free_user_gets_402(self, mongo_db):
        """(a) Free user completing phase 1 gets 402 premium_required on advance."""
        sub = "44444444-4444-4444-8444-444444444444"
        email = "free-p1@projectlife.local"
        _cleanup(mongo_db, sub, email)
        try:
            token = make_jwt(sub=sub, email=email, name="Free P1")
            client = _client_for_token(token)

            # Bootstrap + complete phase 0, advance to 1
            client.get(f"{API_URL}/auth/me")
            self._complete_phase_0(client, mongo_db, sub)
            r = client.post(f"{API_URL}/phases/advance")
            assert r.status_code == 200 and r.json()["current_phase"] == 1

            # Complete phase 1
            self._complete_phase_1(client, mongo_db, sub)

            # Attempt advance -> should be 402
            r = client.post(f"{API_URL}/phases/advance")
            assert r.status_code == 402, f"expected 402, got {r.status_code}: {r.text}"
            body = r.json()
            # FastAPI wraps HTTPException detail under "detail"
            detail = body.get("detail", body)
            assert detail.get("error") == "premium_required"
            assert detail.get("target_phase") == 2

            # user is still at phase 1
            r = client.get(f"{API_URL}/auth/me")
            assert r.json()["current_phase"] == 1
        finally:
            _cleanup(mongo_db, sub, email)

    def test_phase_1_to_2_premium_user_succeeds(self, mongo_db):
        """(b) Premium user (via mock unlock) advances phase 1 -> 2 (200)."""
        sub = "55555555-5555-4555-8555-555555555555"
        email = "premium@projectlife.local"
        _cleanup(mongo_db, sub, email)
        try:
            token = make_jwt(sub=sub, email=email, name="Premium User")
            client = _client_for_token(token)

            client.get(f"{API_URL}/auth/me")
            self._complete_phase_0(client, mongo_db, sub)
            r = client.post(f"{API_URL}/phases/advance")
            assert r.status_code == 200 and r.json()["current_phase"] == 1

            self._complete_phase_1(client, mongo_db, sub)

            # Unlock premium via mock endpoint (email is allowlisted @projectlife.local)
            r = client.post(f"{API_URL}/entitlement/mock", json={"premium": True})
            assert r.status_code == 200 and r.json()["is_premium"] is True

            # Now advance 1 -> 2 should succeed
            r = client.post(f"{API_URL}/phases/advance")
            assert r.status_code == 200, f"premium user should advance 1->2: {r.text}"
            assert r.json()["current_phase"] == 2
        finally:
            _cleanup(mongo_db, sub, email)


# ---------------------------------------------------------------------------
# P3 hardening — JWT issuer pinning
# ---------------------------------------------------------------------------
class TestP3IssuerPinning:

    def test_correct_issuer_accepted(self, auth_client):
        """(a) Token minted with correct SUPABASE_URL-derived iss passes /auth/me."""
        r = auth_client.get(f"{API_URL}/auth/me")
        assert r.status_code == 200, r.text
        assert "user_id" in r.json()

    def test_wrong_issuer_rejected(self, mongo_db):
        """(b) Token with malicious iss like https://evil.supabase.co/auth/v1 -> 401."""
        sub = "66666666-6666-4666-8666-666666666666"
        email = "evil@projectlife.local"
        _cleanup(mongo_db, sub, email)
        try:
            now = datetime.now(timezone.utc)
            payload = {
                "sub": sub,
                "email": email,
                "user_metadata": {"name": "Evil"},
                "aud": "authenticated",
                "iss": "https://evil.supabase.co/auth/v1",
                "iat": int(now.timestamp()),
                "exp": int((now + timedelta(hours=1)).timestamp()),
                "role": "authenticated",
            }
            bad_token = jose_jwt.encode(payload, SUPABASE_JWT_SECRET, algorithm="HS256")
            client = _client_for_token(bad_token)
            r = client.get(f"{API_URL}/auth/me")
            assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text}"
        finally:
            _cleanup(mongo_db, sub, email)


# ---------------------------------------------------------------------------
# P3 hardening — clock skew leeway (30s)
# ---------------------------------------------------------------------------
class TestP3ClockSkewLeeway:

    def test_token_expired_5s_ago_still_works_due_to_leeway(self, mongo_db):
        """Token with exp 10s in the past should still validate due to 30s leeway."""
        sub = "77777777-7777-4777-8777-777777777777"
        email = "skew@projectlife.local"
        _cleanup(mongo_db, sub, email)
        try:
            now = datetime.now(timezone.utc)
            payload = {
                "sub": sub,
                "email": email,
                "user_metadata": {"name": "Skew Tester"},
                "aud": "authenticated",
                "iat": int((now - timedelta(seconds=60)).timestamp()),
                # exp 10s in the past — within 30s leeway
                "exp": int((now - timedelta(seconds=10)).timestamp()),
                "role": "authenticated",
            }
            if SUPABASE_ISSUER:
                payload["iss"] = SUPABASE_ISSUER
            token = jose_jwt.encode(payload, SUPABASE_JWT_SECRET, algorithm="HS256")
            client = _client_for_token(token)
            r = client.get(f"{API_URL}/auth/me")
            assert r.status_code == 200, f"expected 200 (leeway), got {r.status_code}: {r.text}"
            assert r.json()["user_id"] == sub
        finally:
            _cleanup(mongo_db, sub, email)


# ---------------------------------------------------------------------------
# Regression — /api/entitlement (GET) unaffected by allowlist
# ---------------------------------------------------------------------------
class TestRegressionGetEntitlement:

    def test_get_entitlement_works_for_allowlisted_user(self, auth_client):
        r = auth_client.get(f"{API_URL}/entitlement")
        assert r.status_code == 200
        assert "is_premium" in r.json()

    def test_get_entitlement_works_for_non_allowlisted_user(self, mongo_db):
        """Allowlist only gates the mock endpoint, not GET /entitlement."""
        sub = "88888888-8888-4888-8888-888888888888"
        email = "notallowed@notallowed.example"
        _cleanup(mongo_db, sub, email)
        try:
            token = make_jwt(sub=sub, email=email, name="Not Allowed")
            client = _client_for_token(token)
            r = client.get(f"{API_URL}/entitlement")
            assert r.status_code == 200, r.text
            body = r.json()
            assert body["is_premium"] is False
            assert body["entitlement"] == "free"
        finally:
            _cleanup(mongo_db, sub, email)


# ---------------------------------------------------------------------------
# Regression — /api/auth/me works with real Supabase-shaped tokens
# ---------------------------------------------------------------------------
class TestRegressionAuthMeWithIssClaim:

    def test_auth_me_with_iss_claim(self, auth_client):
        """conftest.make_jwt() now includes iss automatically -> should pass."""
        r = auth_client.get(f"{API_URL}/auth/me")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["user_id"]
        assert body["email"]
