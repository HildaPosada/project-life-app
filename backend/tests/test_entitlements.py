"""Sprint 2a — Entitlement / paywall gating tests.

Coverage:
  1. Auth on entitlement endpoints (401 without bearer token)
  2. GET /api/entitlement default = free for a new user
  3. POST /api/entitlement/mock unlocks premium (monthly + annual products)
    - Verifies is_premium=true, correct product, expires_at ~30d in future
  4. POST /api/entitlement/mock with premium=false clears entitlement
  5. Persistence: GET /api/entitlement reflects prior mock state
  6. GET /api/auth/me returns entitlement=free / entitlement_source=null for fresh user
  7. GET /api/auth/me reflects entitlement=premium after mock unlock
  8. Legacy regression: /api/phases, /api/journal, /api/dashboard,
     /api/memory-path, /api/journal/prompt still return 200
  9. Backward-compat: existing Mongo user docs lacking new entitlement
     fields must not 500 on /api/auth/me — Pydantic must fall back to
     defaults (entitlement='free').
 10. Expiry logic (_entitlement_is_active): if entitlement='premium' but
     entitlement_expires_at is in the past, is_premium should be false.
     Verified by direct Mongo write of an expired doc.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests

from conftest import API_URL, QA_SUB, assert_no_mongo_id, make_jwt


# ---------------------------------------------------------------------------
# 1. Auth requirement on entitlement endpoints
# ---------------------------------------------------------------------------
class TestEntitlementAuth:

    def test_get_entitlement_requires_auth(self, anon_client: requests.Session):
        r = anon_client.get(f"{API_URL}/entitlement")
        assert r.status_code == 401, r.text

    def test_mock_entitlement_requires_auth(self, anon_client: requests.Session):
        r = anon_client.post(
            f"{API_URL}/entitlement/mock",
            json={"premium": True, "product": "pl_premium_annual"},
        )
        assert r.status_code == 401, r.text

    def test_mock_entitlement_bad_token(self, anon_client: requests.Session):
        r = anon_client.post(
            f"{API_URL}/entitlement/mock",
            json={"premium": True},
            headers={"Authorization": "Bearer garbage.token.here"},
        )
        assert r.status_code == 401, r.text


# ---------------------------------------------------------------------------
# 2 + 6. Free-defaults on new user (both GET /entitlement and /auth/me)
# ---------------------------------------------------------------------------
class TestEntitlementDefaults:

    def _fresh_headers(self):
        sub = str(uuid.uuid4())
        email = f"ent+{sub[:8]}@projectlife.local"
        token = make_jwt(sub=sub, email=email, name="Ent Fresh")
        return sub, email, {"Authorization": f"Bearer {token}"}

    def test_new_user_get_entitlement_is_free(self, anon_client, mongo_db):
        sub, _email, headers = self._fresh_headers()
        try:
            # trigger user upsert first
            me = anon_client.get(f"{API_URL}/auth/me", headers=headers)
            assert me.status_code == 200, me.text

            r = anon_client.get(f"{API_URL}/entitlement", headers=headers)
            assert r.status_code == 200, r.text
            data = r.json()
            assert data["is_premium"] is False
            assert data["entitlement"] == "free"
            assert data.get("source") is None
            assert data.get("product") is None
            assert data.get("expires_at") is None
            assert data.get("trial_ends_at") is None
            assert_no_mongo_id(data)
        finally:
            mongo_db.users.delete_many({"user_id": sub})

    def test_new_user_auth_me_has_free_entitlement(self, anon_client, mongo_db):
        sub, _email, headers = self._fresh_headers()
        try:
            r = anon_client.get(f"{API_URL}/auth/me", headers=headers)
            assert r.status_code == 200, r.text
            data = r.json()
            assert data.get("entitlement") == "free"
            assert data.get("entitlement_source") is None
            assert data.get("entitlement_product") is None
            assert data.get("entitlement_expires_at") is None
            assert data.get("trial_ends_at") is None
            assert_no_mongo_id(data)
        finally:
            mongo_db.users.delete_many({"user_id": sub})


# ---------------------------------------------------------------------------
# 3 + 4 + 5 + 7. Mock unlock, product handling, clear, persistence
# ---------------------------------------------------------------------------
class TestEntitlementMock:

    def _fresh(self, anon_client, mongo_db):
        sub = str(uuid.uuid4())
        email = f"mock+{sub[:8]}@projectlife.local"
        token = make_jwt(sub=sub, email=email, name="Mock Buyer")
        headers = {"Authorization": f"Bearer {token}"}
        # seed the user
        anon_client.get(f"{API_URL}/auth/me", headers=headers)
        return sub, headers

    def test_mock_unlock_annual_sets_premium(self, anon_client, mongo_db):
        sub, headers = self._fresh(anon_client, mongo_db)
        try:
            before = datetime.now(timezone.utc)
            r = anon_client.post(
                f"{API_URL}/entitlement/mock",
                json={"premium": True, "product": "pl_premium_annual"},
                headers=headers,
            )
            assert r.status_code == 200, r.text
            data = r.json()
            assert data["is_premium"] is True
            assert data["entitlement"] == "premium"
            assert data["source"] == "mock"
            assert data["product"] == "pl_premium_annual"
            assert data["expires_at"] is not None
            # expires_at should be ~30d in the future
            exp_str = data["expires_at"].replace("Z", "+00:00")
            exp = datetime.fromisoformat(exp_str)
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            delta = exp - before
            assert timedelta(days=29) < delta < timedelta(days=31), (
                f"expires_at delta not ~30d: {delta}"
            )
            assert data.get("trial_ends_at") is None
            assert_no_mongo_id(data)
        finally:
            mongo_db.users.delete_many({"user_id": sub})

    def test_mock_unlock_monthly_sets_premium(self, anon_client, mongo_db):
        sub, headers = self._fresh(anon_client, mongo_db)
        try:
            r = anon_client.post(
                f"{API_URL}/entitlement/mock",
                json={"premium": True, "product": "pl_premium_monthly"},
                headers=headers,
            )
            assert r.status_code == 200, r.text
            data = r.json()
            assert data["is_premium"] is True
            assert data["entitlement"] == "premium"
            assert data["product"] == "pl_premium_monthly"
            assert data["source"] == "mock"
            assert data["expires_at"] is not None
        finally:
            mongo_db.users.delete_many({"user_id": sub})

    def test_mock_unlock_persists_across_get(self, anon_client, mongo_db):
        sub, headers = self._fresh(anon_client, mongo_db)
        try:
            up = anon_client.post(
                f"{API_URL}/entitlement/mock",
                json={"premium": True, "product": "pl_premium_annual"},
                headers=headers,
            )
            assert up.status_code == 200

            r = anon_client.get(f"{API_URL}/entitlement", headers=headers)
            assert r.status_code == 200, r.text
            data = r.json()
            assert data["is_premium"] is True
            assert data["entitlement"] == "premium"
            assert data["product"] == "pl_premium_annual"
            assert data["source"] == "mock"

            # /auth/me should also reflect it
            me = anon_client.get(f"{API_URL}/auth/me", headers=headers)
            assert me.status_code == 200
            body = me.json()
            assert body["entitlement"] == "premium"
            assert body["entitlement_source"] == "mock"
            assert body["entitlement_product"] == "pl_premium_annual"
            assert body["entitlement_expires_at"] is not None
        finally:
            mongo_db.users.delete_many({"user_id": sub})

    def test_mock_downgrade_clears_entitlement(self, anon_client, mongo_db):
        sub, headers = self._fresh(anon_client, mongo_db)
        try:
            # first premium
            anon_client.post(
                f"{API_URL}/entitlement/mock",
                json={"premium": True, "product": "pl_premium_monthly"},
                headers=headers,
            )
            # now downgrade
            r = anon_client.post(
                f"{API_URL}/entitlement/mock",
                json={"premium": False},
                headers=headers,
            )
            assert r.status_code == 200, r.text
            data = r.json()
            assert data["is_premium"] is False
            assert data["entitlement"] == "free"
            assert data.get("product") is None
            assert data.get("expires_at") is None
            assert data.get("source") is None
            assert data.get("trial_ends_at") is None

            # confirm through GET
            g = anon_client.get(f"{API_URL}/entitlement", headers=headers)
            assert g.status_code == 200
            gd = g.json()
            assert gd["is_premium"] is False
            assert gd["entitlement"] == "free"
        finally:
            mongo_db.users.delete_many({"user_id": sub})

    def test_mock_unlock_without_product_defaults_monthly(self, anon_client, mongo_db):
        """When product is omitted, server defaults to pl_premium_monthly."""
        sub, headers = self._fresh(anon_client, mongo_db)
        try:
            r = anon_client.post(
                f"{API_URL}/entitlement/mock",
                json={"premium": True},
                headers=headers,
            )
            assert r.status_code == 200, r.text
            assert r.json()["product"] == "pl_premium_monthly"
        finally:
            mongo_db.users.delete_many({"user_id": sub})


# ---------------------------------------------------------------------------
# 9. Backward-compat: existing Mongo docs without new entitlement fields
# ---------------------------------------------------------------------------
class TestEntitlementBackwardCompat:

    def test_auth_me_survives_legacy_user_doc(self, anon_client, mongo_db):
        """Simulate a user row written before Sprint 2a — no entitlement*
        fields. /api/auth/me must fall back to defaults and NOT 500."""
        legacy_sub = str(uuid.uuid4())
        legacy_email = f"legacy+{legacy_sub[:8]}@projectlife.local"
        now = datetime.now(timezone.utc)
        legacy_doc = {
            "user_id": legacy_sub,
            "email": legacy_email,
            "name": "Legacy User",
            "picture": None,
            "pronouns": None,
            "location": None,
            "in_therapy": None,
            "therapist_release_form": None,
            "consent_accepted": False,
            "onboarding_complete": False,
            "current_phase": 0,
            "created_at": now,
            "updated_at": now,
            # NOTE: intentionally NO entitlement* fields
        }
        mongo_db.users.insert_one(legacy_doc)
        token = make_jwt(sub=legacy_sub, email=legacy_email, name="Legacy User")
        try:
            r = anon_client.get(
                f"{API_URL}/auth/me",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert r.status_code == 200, (
                f"Legacy doc without entitlement fields caused non-200 on "
                f"/auth/me: {r.status_code} {r.text}"
            )
            data = r.json()
            assert data["entitlement"] == "free"
            assert data.get("entitlement_source") is None
            assert data.get("entitlement_product") is None
            assert data.get("entitlement_expires_at") is None
            assert data.get("trial_ends_at") is None

            # And /entitlement should also work for a legacy user
            r2 = anon_client.get(
                f"{API_URL}/entitlement",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert r2.status_code == 200, r2.text
            body = r2.json()
            assert body["is_premium"] is False
            assert body["entitlement"] == "free"
        finally:
            mongo_db.users.delete_many({"user_id": legacy_sub})


# ---------------------------------------------------------------------------
# 10. Expiry logic — direct Mongo write of expired premium row
# ---------------------------------------------------------------------------
class TestEntitlementExpiry:

    def test_expired_premium_is_reported_as_free(self, anon_client, mongo_db):
        """If entitlement='premium' but entitlement_expires_at is in the past,
        _entitlement_is_active should treat it as expired => is_premium=false.
        """
        sub = str(uuid.uuid4())
        email = f"exp+{sub[:8]}@projectlife.local"
        token = make_jwt(sub=sub, email=email, name="Expired Buyer")
        headers = {"Authorization": f"Bearer {token}"}
        try:
            # seed user via /auth/me
            r = anon_client.get(f"{API_URL}/auth/me", headers=headers)
            assert r.status_code == 200

            past = datetime.now(timezone.utc) - timedelta(days=5)
            mongo_db.users.update_one(
                {"user_id": sub},
                {"$set": {
                    "entitlement": "premium",
                    "entitlement_source": "mock",
                    "entitlement_product": "pl_premium_monthly",
                    "entitlement_expires_at": past,
                    "trial_ends_at": None,
                }},
            )

            r = anon_client.get(f"{API_URL}/entitlement", headers=headers)
            assert r.status_code == 200, r.text
            data = r.json()
            assert data["is_premium"] is False, (
                f"Expired premium should be inactive, got: {data}"
            )
            assert data["entitlement"] == "free"
        finally:
            mongo_db.users.delete_many({"user_id": sub})

    def test_active_trial_grants_premium_even_if_entitlement_free(self, anon_client, mongo_db):
        """If trial_ends_at is in the future, is_premium should be true
        even if entitlement flag is still 'free' (pre-webhook sync)."""
        sub = str(uuid.uuid4())
        email = f"trial+{sub[:8]}@projectlife.local"
        token = make_jwt(sub=sub, email=email, name="Trialist")
        headers = {"Authorization": f"Bearer {token}"}
        try:
            r = anon_client.get(f"{API_URL}/auth/me", headers=headers)
            assert r.status_code == 200

            future = datetime.now(timezone.utc) + timedelta(days=10)
            mongo_db.users.update_one(
                {"user_id": sub},
                {"$set": {
                    "entitlement": "free",
                    "trial_ends_at": future,
                }},
            )

            r = anon_client.get(f"{API_URL}/entitlement", headers=headers)
            assert r.status_code == 200, r.text
            data = r.json()
            assert data["is_premium"] is True, (
                f"Active trial should count as premium, got: {data}"
            )
            assert data["entitlement"] == "premium"
        finally:
            mongo_db.users.delete_many({"user_id": sub})


# ---------------------------------------------------------------------------
# 8. Regression: legacy endpoints still work
# ---------------------------------------------------------------------------
class TestLegacyRegression:

    def test_phases_still_works(self, auth_client):
        auth_client.get(f"{API_URL}/auth/me")
        r = auth_client.get(f"{API_URL}/phases")
        assert r.status_code == 200, r.text
        assert len(r.json()) == 4

    def test_journal_list_still_works(self, auth_client):
        auth_client.get(f"{API_URL}/auth/me")
        r = auth_client.get(f"{API_URL}/journal")
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_journal_prompt_still_works(self, auth_client):
        auth_client.get(f"{API_URL}/auth/me")
        r = auth_client.get(f"{API_URL}/journal/prompt")
        assert r.status_code == 200, r.text
        assert "prompt" in r.json()

    def test_dashboard_still_works(self, auth_client):
        auth_client.get(f"{API_URL}/auth/me")
        r = auth_client.get(f"{API_URL}/dashboard")
        assert r.status_code == 200, r.text
        body = r.json()
        assert "context" in body
        assert "sessions_completed" in body

    def test_memory_path_still_works(self, auth_client):
        auth_client.get(f"{API_URL}/auth/me")
        r = auth_client.get(f"{API_URL}/memory-path")
        assert r.status_code == 200, r.text
        assert "stones" in r.json()
