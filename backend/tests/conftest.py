"""Shared fixtures for Project Life backend tests.

Auth model (Iteration 5+): the backend verifies Supabase-issued HS256 JWTs
signed with SUPABASE_JWT_SECRET. Tests mint their own JWTs directly with the
same secret instead of round-tripping through Supabase.
"""
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv
from jose import jwt as jose_jwt
from pymongo import MongoClient

BACKEND_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_ROOT / ".env")
load_dotenv(BACKEND_ROOT.parent / "frontend" / ".env")

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API_URL = f"{BASE_URL}/api"

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
SUPABASE_JWT_SECRET = os.environ["SUPABASE_JWT_SECRET"]

# Canonical QA test user (Supabase-style uuid-ish sub)
QA_SUB = "11111111-1111-4111-8111-111111111111"
QA_EMAIL = "qa+iter5@projectlife.local"
QA_NAME = "QA Tester"

USER_COLLECTIONS = [
    "users", "journal_entries", "weekly_checkins",
    "safety_checkins", "emergency_contacts", "therapist_uploads",
    "memories", "session_logs", "timeline_events",
]


def make_jwt(
    sub: str = QA_SUB,
    email: str = QA_EMAIL,
    name: str = QA_NAME,
    aud: str = "authenticated",
    secret: str = SUPABASE_JWT_SECRET,
    algorithm: str = "HS256",
    exp_delta: timedelta = timedelta(hours=1),
    extra_metadata: dict | None = None,
    include_exp: bool = True,
) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": sub,
        "email": email,
        "user_metadata": {"name": name, **(extra_metadata or {})},
        "aud": aud,
        "iat": int(now.timestamp()),
        "role": "authenticated",
    }
    if include_exp:
        payload["exp"] = int((now + exp_delta).timestamp())
    return jose_jwt.encode(payload, secret, algorithm=algorithm)


@pytest.fixture(scope="session")
def mongo_db():
    mc = MongoClient(MONGO_URL)
    db = mc[DB_NAME]
    yield db
    mc.close()


@pytest.fixture(scope="session", autouse=True)
def wipe_qa_data(mongo_db):
    """Clean out any leftover QA user data before and after the session."""
    for coll in USER_COLLECTIONS:
        mongo_db[coll].delete_many({"user_id": QA_SUB})
    mongo_db.users.delete_many({"email": QA_EMAIL})
    # Drop any obsolete user_sessions collection from prior iterations
    try:
        mongo_db.user_sessions.drop()
    except Exception:
        pass
    yield
    for coll in USER_COLLECTIONS:
        mongo_db[coll].delete_many({"user_id": QA_SUB})
    mongo_db.users.delete_many({"email": QA_EMAIL})


@pytest.fixture
def qa_token() -> str:
    return make_jwt()


@pytest.fixture
def auth_client(qa_token):
    s = requests.Session()
    s.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {qa_token}",
    })
    return s


@pytest.fixture
def anon_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def assert_no_mongo_id(payload):
    if isinstance(payload, dict):
        assert "_id" not in payload, f"_id leaked in response: {payload}"
        for v in payload.values():
            assert_no_mongo_id(v)
    elif isinstance(payload, list):
        for item in payload:
            assert_no_mongo_id(item)
