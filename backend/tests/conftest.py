"""Shared fixtures for Project Life backend tests."""
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

# Load backend .env for MONGO_URL / DB_NAME
BACKEND_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_ROOT / ".env")

# Frontend .env for public URL
load_dotenv(BACKEND_ROOT.parent / "frontend" / ".env")

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API_URL = f"{BASE_URL}/api"

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

QA_USER_ID = "user_qatest"
QA_EMAIL = "qa@projectlife.local"
QA_TOKEN = "qa-token-xyz"


@pytest.fixture(scope="session")
def mongo_db():
    mc = MongoClient(MONGO_URL)
    db = mc[DB_NAME]
    yield db
    mc.close()


@pytest.fixture(scope="session", autouse=True)
def qa_user(mongo_db):
    """Seed a QA user + session token directly in MongoDB (mocks Google OAuth)."""
    now = datetime.now(timezone.utc)
    # Clean any prior test data for this user
    for coll in [
        "users", "user_sessions", "journal_entries", "weekly_checkins",
        "safety_checkins", "emergency_contacts", "therapist_uploads",
        "memories", "session_logs", "timeline_events",
    ]:
        mongo_db[coll].delete_many({"user_id": QA_USER_ID})
    mongo_db.users.delete_many({"email": QA_EMAIL})
    mongo_db.user_sessions.delete_many({"session_token": QA_TOKEN})

    mongo_db.users.insert_one({
        "user_id": QA_USER_ID,
        "email": QA_EMAIL,
        "name": "QA Tester",
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
    })
    mongo_db.user_sessions.insert_one({
        "session_token": QA_TOKEN,
        "user_id": QA_USER_ID,
        "expires_at": now + timedelta(days=7),
        "created_at": now,
    })
    yield
    # Teardown
    for coll in [
        "users", "user_sessions", "journal_entries", "weekly_checkins",
        "safety_checkins", "emergency_contacts", "therapist_uploads",
        "memories", "session_logs", "timeline_events",
    ]:
        mongo_db[coll].delete_many({"user_id": QA_USER_ID})
    mongo_db.user_sessions.delete_many({"session_token": QA_TOKEN})


@pytest.fixture
def auth_client():
    s = requests.Session()
    s.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {QA_TOKEN}",
    })
    return s


@pytest.fixture
def anon_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def assert_no_mongo_id(payload):
    """Recursively ensure no dict contains a `_id` key."""
    if isinstance(payload, dict):
        assert "_id" not in payload, f"_id leaked in response: {payload}"
        for v in payload.values():
            assert_no_mongo_id(v)
    elif isinstance(payload, list):
        for item in payload:
            assert_no_mongo_id(item)
