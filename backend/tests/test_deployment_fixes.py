"""Tests verifying deployment-blocker fixes.

Covers:
- SECURITY: POST /api/entitlement/mock is 200 when ALLOW_MOCK_ENTITLEMENT=1
- SECURITY: POST /api/entitlement/mock is 404 when env var is unset
- REGRESSION: GET /api/entitlement works regardless of the flag
- CONFIG: /app/frontend/app.json contains Apple Sign-In + bundle ids
- CONFIG: /app/.gitignore no longer contains standalone .env patterns
- CONFIG: /app/frontend/.env quotes METRO_CACHE_ROOT
- CONFIG: /app/backend/server.py defaults ALLOW_MOCK_ENTITLEMENT to "0"

IMPORTANT: Any test that mutates /app/backend/.env must restore
ALLOW_MOCK_ENTITLEMENT=1 in a finally block so dev flows keep working.
"""
import json
import os
import re
import shutil
import subprocess
import time
from pathlib import Path

import pytest
import requests

from conftest import API_URL, BASE_URL, make_jwt  # noqa: E402

APP_ROOT = Path("/app")
BACKEND_ENV = APP_ROOT / "backend" / ".env"
FRONTEND_ENV = APP_ROOT / "frontend" / ".env"
APP_JSON = APP_ROOT / "frontend" / "app.json"
GITIGNORE = APP_ROOT / ".gitignore"
SERVER_PY = APP_ROOT / "backend" / "server.py"


# ---------------------------------------------------------------------------
# SECURITY: entitlement/mock gated by ALLOW_MOCK_ENTITLEMENT env
# ---------------------------------------------------------------------------
class TestEntitlementMockFlag:
    def test_mock_endpoint_returns_200_when_flag_enabled(self, auth_client):
        """With ALLOW_MOCK_ENTITLEMENT=1 in backend/.env (current state)."""
        r = auth_client.post(
            f"{API_URL}/entitlement/mock",
            json={"premium": True, "product": "pl_premium_monthly"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["is_premium"] is True
        assert body["entitlement"] == "premium"
        assert body["source"] == "mock"
        assert body["product"] == "pl_premium_monthly"

        # reset to free so the flip test below stays clean
        r2 = auth_client.post(f"{API_URL}/entitlement/mock", json={"premium": False})
        assert r2.status_code == 200
        assert r2.json()["is_premium"] is False

    def test_mock_endpoint_404_when_flag_removed(self, auth_client):
        """Remove ALLOW_MOCK_ENTITLEMENT from backend/.env, restart backend,
        POST /api/entitlement/mock must return 404. Then restore .env and
        restart backend so nothing else regresses.
        """
        original = BACKEND_ENV.read_text()
        backup = BACKEND_ENV.with_suffix(".env.bak-deploytest")
        shutil.copy(BACKEND_ENV, backup)
        try:
            # Strip ALLOW_MOCK_ENTITLEMENT entirely
            stripped = re.sub(
                r"(?m)^\s*ALLOW_MOCK_ENTITLEMENT\s*=.*\n?", "", original
            )
            BACKEND_ENV.write_text(stripped)
            assert "ALLOW_MOCK_ENTITLEMENT" not in BACKEND_ENV.read_text()

            subprocess.run(
                ["sudo", "supervisorctl", "restart", "backend"],
                check=True, capture_output=True, text=True,
            )
            # Give backend time to come up
            self._wait_for_backend()

            r = requests.post(
                f"{API_URL}/entitlement/mock",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {make_jwt()}",
                },
                json={"premium": True},
                timeout=10,
            )
            assert r.status_code == 404, f"Expected 404 when flag unset, got {r.status_code}: {r.text}"

            # REGRESSION: GET /api/entitlement still works with flag unset
            r_get = requests.get(
                f"{API_URL}/entitlement",
                headers={"Authorization": f"Bearer {make_jwt()}"},
                timeout=10,
            )
            assert r_get.status_code == 200, r_get.text
            body = r_get.json()
            assert "is_premium" in body
            assert "entitlement" in body
        finally:
            # ALWAYS restore backend/.env so dev flows aren't broken
            BACKEND_ENV.write_text(original)
            backup.unlink(missing_ok=True)
            subprocess.run(
                ["sudo", "supervisorctl", "restart", "backend"],
                check=True, capture_output=True, text=True,
            )
            self._wait_for_backend()
            # sanity: env restored & mock endpoint alive again
            assert "ALLOW_MOCK_ENTITLEMENT=1" in BACKEND_ENV.read_text()

    def test_get_entitlement_works_regardless_of_flag(self, auth_client):
        """Baseline: with the flag enabled, GET /api/entitlement still 200s."""
        r = auth_client.get(f"{API_URL}/entitlement")
        assert r.status_code == 200
        body = r.json()
        assert set(["is_premium", "entitlement"]).issubset(body.keys())

    @staticmethod
    def _wait_for_backend(timeout: float = 20.0) -> None:
        deadline = time.time() + timeout
        last_err = None
        while time.time() < deadline:
            try:
                r = requests.get(f"{API_URL}/", timeout=2)
                if r.status_code == 200:
                    return
            except Exception as e:
                last_err = e
            time.sleep(0.5)
        raise RuntimeError(f"Backend never came back up: {last_err}")


# ---------------------------------------------------------------------------
# CONFIG: static file assertions (no backend restart needed)
# ---------------------------------------------------------------------------
class TestStaticConfig:
    def test_app_json_valid_and_has_apple_signin(self):
        data = json.loads(APP_JSON.read_text())
        expo = data["expo"]
        assert expo["ios"]["bundleIdentifier"] == "com.hyperintelligence.projectlife"
        assert expo["ios"]["usesAppleSignIn"] is True
        assert expo["android"]["package"] == "com.hyperintelligence.projectlife"
        assert "expo-apple-authentication" in expo["plugins"]

    def test_gitignore_no_standalone_env_patterns(self):
        lines = [ln.strip() for ln in GITIGNORE.read_text().splitlines()]
        # Ignore comments and blanks
        code_lines = [ln for ln in lines if ln and not ln.startswith("#")]
        forbidden = {".env", ".env.*", "*.env"}
        offenders = [ln for ln in code_lines if ln in forbidden]
        assert not offenders, f"Standalone env-ignore lines still present: {offenders}"

    def test_frontend_env_metro_cache_root_quoted(self):
        content = FRONTEND_ENV.read_text()
        m = re.search(r'^METRO_CACHE_ROOT=(.+)$', content, flags=re.MULTILINE)
        assert m, "METRO_CACHE_ROOT not found in frontend/.env"
        value = m.group(1).strip()
        assert value.startswith('"') and value.endswith('"'), \
            f"METRO_CACHE_ROOT must be wrapped in double quotes, got: {value!r}"

    def test_server_py_default_allow_mock_is_zero(self):
        src = SERVER_PY.read_text()
        # match: os.environ.get("ALLOW_MOCK_ENTITLEMENT", "0")
        m = re.search(
            r'os\.environ\.get\(\s*["\']ALLOW_MOCK_ENTITLEMENT["\']\s*,\s*["\']([01])["\']\s*\)',
            src,
        )
        assert m, "ALLOW_MOCK_ENTITLEMENT env lookup with literal default not found"
        assert m.group(1) == "0", f"Default must be '0', got '{m.group(1)}'"

    def test_backend_env_has_allow_mock_enabled(self):
        # Dev container should ship with the flag enabled
        assert re.search(
            r"(?m)^ALLOW_MOCK_ENTITLEMENT\s*=\s*1\s*$",
            BACKEND_ENV.read_text(),
        ), "backend/.env must set ALLOW_MOCK_ENTITLEMENT=1 for dev/QA"
