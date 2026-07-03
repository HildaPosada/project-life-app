"""Project Life – Trauma-Informed Emotional Intelligence App backend.

Auth: Supabase Auth (HS256 JWT verified locally with SUPABASE_JWT_SECRET).
Storage: MongoDB (all responses exclude _id). Auth-only in Supabase; the
FastAPI backend upserts our domain User row keyed by the Supabase `sub`
on the first authenticated request.
"""

import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional, Literal, Dict, Any

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Request
from jose import jwt as jose_jwt, JWTError
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

EMERGENT_SESSION_DATA_URL = ""  # deprecated

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("project-life")

app = FastAPI(title="Project Life API")
api = APIRouter(prefix="/api")


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    # Profile fields
    pronouns: Optional[str] = None
    location: Optional[str] = None
    in_therapy: Optional[bool] = None
    therapist_release_form: Optional[str] = None  # base64 pdf
    consent_accepted: bool = False
    onboarding_complete: bool = False
    current_phase: int = 0
    # Entitlement (subscriptions). Single "premium" tier; source tracks
    # whether it was granted via RevenueCat (iOS/Android IAP), Stripe (web),
    # a promo, or the dev mock. `expires_at` is set for renewing subs.
    entitlement: Literal["free", "premium"] = "free"
    entitlement_source: Optional[Literal["mock", "revenuecat", "stripe", "promo"]] = None
    entitlement_product: Optional[str] = None  # e.g. "pl_premium_monthly"
    entitlement_expires_at: Optional[datetime] = None
    trial_ends_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class ProfileUpdate(BaseModel):
    pronouns: Optional[str] = None
    location: Optional[str] = None
    in_therapy: Optional[bool] = None
    therapist_release_form: Optional[str] = None
    consent_accepted: Optional[bool] = None
    onboarding_complete: Optional[bool] = None


class Entitlement(BaseModel):
    is_premium: bool
    entitlement: Literal["free", "premium"]
    source: Optional[str] = None
    product: Optional[str] = None
    expires_at: Optional[datetime] = None
    trial_ends_at: Optional[datetime] = None


class MockEntitlementRequest(BaseModel):
    premium: bool
    product: Optional[str] = None  # "pl_premium_monthly" | "pl_premium_annual"


class JournalEntry(BaseModel):
    entry_id: str
    user_id: str
    title: Optional[str] = None
    body: str
    mood_word: Optional[str] = None
    mood_score: Optional[int] = None  # 1..5
    created_at: datetime


class JournalCreate(BaseModel):
    title: Optional[str] = None
    body: str
    mood_word: Optional[str] = None
    mood_score: Optional[int] = None


class WeeklyCheckIn(BaseModel):
    checkin_id: str
    user_id: str
    feeling_summary: str
    themes: Optional[str] = None
    mood_score: int  # 1..5
    week_key: str  # YYYY-WW
    created_at: datetime


class WeeklyCheckInCreate(BaseModel):
    feeling_summary: str
    themes: Optional[str] = None
    mood_score: int


class SafetyCheckIn(BaseModel):
    checkin_id: str
    user_id: str
    feel_safe: bool
    note: Optional[str] = None
    created_at: datetime


class SafetyCheckInCreate(BaseModel):
    feel_safe: bool
    note: Optional[str] = None


class EmergencyContact(BaseModel):
    contact_id: str
    user_id: str
    name: str
    phone: str
    relationship: Optional[str] = None
    created_at: datetime


class EmergencyContactCreate(BaseModel):
    name: str
    phone: str
    relationship: Optional[str] = None


class TherapistUpload(BaseModel):
    upload_id: str
    user_id: str
    filename: str
    kind: Literal["weekly_summary", "release_form", "emdr_approval", "other"]
    notes: Optional[str] = None
    file_base64: Optional[str] = None
    created_at: datetime


class TherapistUploadCreate(BaseModel):
    filename: str
    kind: Literal["weekly_summary", "release_form", "emdr_approval", "other"] = "weekly_summary"
    notes: Optional[str] = None
    file_base64: Optional[str] = None


class Memory(BaseModel):
    memory_id: str
    user_id: str
    title: str
    description: str
    body_sensation: Optional[str] = None
    target_belief: Optional[str] = None
    created_at: datetime


class MemoryCreate(BaseModel):
    title: str
    description: str
    body_sensation: Optional[str] = None
    target_belief: Optional[str] = None


class SessionLog(BaseModel):
    log_id: str
    user_id: str
    session_type: Literal["ketamine", "somatic", "therapy", "other"]
    date: datetime
    body_experience: Optional[str] = None
    insights: Optional[str] = None
    integration_notes: Optional[str] = None
    created_at: datetime


class SessionLogCreate(BaseModel):
    session_type: Literal["ketamine", "somatic", "therapy", "other"] = "therapy"
    date: Optional[datetime] = None
    body_experience: Optional[str] = None
    insights: Optional[str] = None
    integration_notes: Optional[str] = None


class SomaticPractice(BaseModel):
    practice_id: str
    title: str
    category: str  # Breathing, Grounding, EMDR pre-work, Body Awareness
    duration_min: int
    description: str
    instructions: List[str]
    unlock_phase: int


class TimelineEvent(BaseModel):
    event_id: str
    user_id: str
    title: str
    insight: Optional[str] = None
    emotion: Optional[str] = None
    event_date: datetime
    created_at: datetime


class TimelineEventCreate(BaseModel):
    title: str
    insight: Optional[str] = None
    emotion: Optional[str] = None
    event_date: Optional[datetime] = None


class PhaseInfo(BaseModel):
    phase: int
    title: str
    subtitle: str
    duration: str
    is_current: bool
    is_unlocked: bool
    progress_pct: int
    requirements: List[str]


# ---------------------------------------------------------------------------
# Auth helpers — Supabase JWT verification
# ---------------------------------------------------------------------------
async def get_current_user(authorization: Optional[str] = Header(None)) -> User:
    """Verify a Supabase-issued JWT and upsert a matching Mongo user record.

    Supabase issues HS256 JWTs signed with the project JWT secret. We verify
    the signature locally (no network call), then look up (or create) our
    domain user by the `sub` claim (Supabase user id).
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization[len("Bearer ") :].strip()
    if not SUPABASE_JWT_SECRET:
        raise HTTPException(status_code=500, detail="Supabase JWT secret not configured")
    try:
        claims = jose_jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}") from e

    sub = claims.get("sub")
    email = claims.get("email") or (claims.get("user_metadata") or {}).get("email") or ""
    md = claims.get("user_metadata") or {}
    name = md.get("name") or md.get("full_name") or (email.split("@")[0] if email else "friend")
    picture = md.get("avatar_url") or md.get("picture")

    if not sub:
        raise HTTPException(status_code=401, detail="Token missing subject")

    existing = await db.users.find_one({"user_id": sub}, {"_id": 0})
    if existing:
        # Refresh name/email/picture if the identity provider updated them.
        patch = {"updated_at": now_utc()}
        if email and existing.get("email") != email:
            patch["email"] = email
        if name and not existing.get("name"):
            patch["name"] = name
        if picture:
            patch["picture"] = picture
        await db.users.update_one({"user_id": sub}, {"$set": patch})
        doc = await db.users.find_one({"user_id": sub}, {"_id": 0})
        return User(**doc)

    new_user = {
        "user_id": sub,
        "email": email,
        "name": name,
        "picture": picture,
        "pronouns": None,
        "location": None,
        "in_therapy": None,
        "therapist_release_form": None,
        "consent_accepted": False,
        "onboarding_complete": False,
        "current_phase": 0,
        "entitlement": "free",
        "entitlement_source": None,
        "entitlement_product": None,
        "entitlement_expires_at": None,
        "trial_ends_at": None,
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    try:
        await db.users.insert_one(new_user)
    except Exception:
        # Race: another concurrent request created the same user
        doc = await db.users.find_one({"user_id": sub}, {"_id": 0})
        if doc:
            return User(**doc)
        raise
    doc = await db.users.find_one({"user_id": sub}, {"_id": 0})
    return User(**doc)


# ---------------------------------------------------------------------------
# Auth endpoints (Supabase handles sign-up / sign-in; we just expose /me)
# ---------------------------------------------------------------------------
@api.get("/auth/me", response_model=User)
async def get_me(user: User = Depends(get_current_user)):
    return user


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------
@api.put("/profile", response_model=User)
async def update_profile(update: ProfileUpdate, user: User = Depends(get_current_user)):
    patch = {k: v for k, v in update.model_dump(exclude_unset=True).items() if v is not None}
    patch["updated_at"] = now_utc()
    await db.users.update_one({"user_id": user.user_id}, {"$set": patch})
    doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    return User(**doc)


# ---------------------------------------------------------------------------
# Entitlements (subscriptions)
# ---------------------------------------------------------------------------
def _entitlement_is_active(user: User) -> bool:
    """Premium is active if entitlement=='premium' and either no expiry
    or expiry is still in the future. Trial windows also count as premium."""
    now = now_utc()

    def _aware(dt: Optional[datetime]) -> Optional[datetime]:
        if dt is None:
            return None
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)

    trial_end = _aware(user.trial_ends_at)
    exp = _aware(user.entitlement_expires_at)

    if user.entitlement != "premium":
        # Grant premium during trial window even if entitlement flag hasn't
        # been synced from RevenueCat/Stripe yet.
        if trial_end and trial_end > now:
            return True
        return False
    if exp and exp < now:
        return False
    return True


@api.get("/entitlement", response_model=Entitlement)
async def get_entitlement(user: User = Depends(get_current_user)):
    is_premium = _entitlement_is_active(user)
    return Entitlement(
        is_premium=is_premium,
        entitlement="premium" if is_premium else "free",
        source=user.entitlement_source,
        product=user.entitlement_product,
        expires_at=user.entitlement_expires_at,
        trial_ends_at=user.trial_ends_at,
    )


@api.post("/entitlement/mock", response_model=Entitlement)
async def mock_entitlement(body: MockEntitlementRequest, user: User = Depends(get_current_user)):
    """Dev-only entitlement toggle. Used to build & QA the paywall UI and
    gating logic before RevenueCat / Stripe are wired end-to-end. Will be
    replaced by webhook-driven sync in Sprint 2b."""
    if body.premium:
        patch = {
            "entitlement": "premium",
            "entitlement_source": "mock",
            "entitlement_product": body.product or "pl_premium_monthly",
            "entitlement_expires_at": now_utc() + timedelta(days=30),
            "trial_ends_at": None,
            "updated_at": now_utc(),
        }
    else:
        patch = {
            "entitlement": "free",
            "entitlement_source": None,
            "entitlement_product": None,
            "entitlement_expires_at": None,
            "trial_ends_at": None,
            "updated_at": now_utc(),
        }
    await db.users.update_one({"user_id": user.user_id}, {"$set": patch})
    doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    fresh = User(**doc)
    is_premium = _entitlement_is_active(fresh)
    return Entitlement(
        is_premium=is_premium,
        entitlement="premium" if is_premium else "free",
        source=fresh.entitlement_source,
        product=fresh.entitlement_product,
        expires_at=fresh.entitlement_expires_at,
        trial_ends_at=fresh.trial_ends_at,
    )


# ---------------------------------------------------------------------------
# Phases
# ---------------------------------------------------------------------------
PHASE_META = [
    {"phase": 0, "title": "Groundwork", "subtitle": "Access & consent",
     "duration": "Ongoing", "requirements": ["Complete onboarding", "Set safety net"]},
    {"phase": 1, "title": "Talk Therapy Foundations", "subtitle": "Weekly reflection",
     "duration": "12 months", "requirements": ["4 weekly check-ins", "1 therapist upload"]},
    {"phase": 2, "title": "EMDR Processing", "subtitle": "Memory & body",
     "duration": "8 weeks", "requirements": ["Complete Phase 1", "Therapist EMDR approval"]},
    {"phase": 3, "title": "Somatic + Ketamine Integration", "subtitle": "Body-based healing",
     "duration": "12 months", "requirements": ["Complete Phase 2", "Log first session"]},
]


async def compute_phase_progress(user: User, phase: int) -> int:
    if phase == 0:
        pts = 0
        if user.consent_accepted:
            pts += 50
        contacts = await db.emergency_contacts.count_documents({"user_id": user.user_id})
        if contacts > 0:
            pts += 50
        return min(pts, 100)
    if phase == 1:
        checkins = await db.weekly_checkins.count_documents({"user_id": user.user_id})
        uploads = await db.therapist_uploads.count_documents(
            {"user_id": user.user_id, "kind": "weekly_summary"}
        )
        return min(int((checkins / 4) * 60) + min(uploads * 40, 40), 100)
    if phase == 2:
        approval = await db.therapist_uploads.count_documents(
            {"user_id": user.user_id, "kind": "emdr_approval"}
        )
        memories = await db.memories.count_documents({"user_id": user.user_id})
        if approval == 0:
            return 0
        return min(30 + min(memories * 10, 70), 100)
    if phase == 3:
        logs = await db.session_logs.count_documents({"user_id": user.user_id})
        return min(logs * 20, 100)
    return 0


@api.get("/phases", response_model=List[PhaseInfo])
async def list_phases(user: User = Depends(get_current_user)):
    results: List[PhaseInfo] = []
    for meta in PHASE_META:
        p = meta["phase"]
        is_unlocked = p <= user.current_phase
        progress = await compute_phase_progress(user, p) if is_unlocked else 0
        results.append(PhaseInfo(
            phase=p,
            title=meta["title"],
            subtitle=meta["subtitle"],
            duration=meta["duration"],
            is_current=(p == user.current_phase),
            is_unlocked=is_unlocked,
            progress_pct=progress,
            requirements=meta["requirements"],
        ))
    return results


@api.post("/phases/advance", response_model=User)
async def advance_phase(user: User = Depends(get_current_user)):
    if user.current_phase >= 3:
        raise HTTPException(status_code=400, detail="Already at final phase")
    progress = await compute_phase_progress(user, user.current_phase)
    if progress < 100:
        raise HTTPException(status_code=400, detail="Current phase not complete")
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"current_phase": user.current_phase + 1, "updated_at": now_utc()}},
    )
    doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    return User(**doc)


# ---------------------------------------------------------------------------
# Journal + Insights
# ---------------------------------------------------------------------------
@api.post("/journal", response_model=JournalEntry)
async def create_journal(body: JournalCreate, user: User = Depends(get_current_user)):
    entry = JournalEntry(
        entry_id=new_id("j"),
        user_id=user.user_id,
        created_at=now_utc(),
        **body.model_dump(),
    )
    await db.journal_entries.insert_one(entry.model_dump())
    return entry


@api.put("/journal/{entry_id}", response_model=JournalEntry)
async def update_journal(entry_id: str, body: JournalCreate, user: User = Depends(get_current_user)):
    """Autosave-friendly upsert. Only the owner may update."""
    existing = await db.journal_entries.find_one(
        {"user_id": user.user_id, "entry_id": entry_id}, {"_id": 0}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Entry not found")
    patch = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    await db.journal_entries.update_one(
        {"user_id": user.user_id, "entry_id": entry_id},
        {"$set": patch},
    )
    updated = await db.journal_entries.find_one(
        {"user_id": user.user_id, "entry_id": entry_id}, {"_id": 0}
    )
    return JournalEntry(**updated)


_JOURNAL_PROMPTS_MORNING = [
    "What is asking for your attention this morning?",
    "How did you arrive here today?",
    "One breath — what is present, in the body?",
    "Begin anywhere. There is nothing to fix.",
]
_JOURNAL_PROMPTS_MIDDAY = [
    "What is your body telling you right now?",
    "Where is your attention resting?",
    "A soft observation, without judgement.",
    "What has today held so far?",
]
_JOURNAL_PROMPTS_EVENING = [
    "What is worth carrying into tonight?",
    "One thing you would like to lay down.",
    "A tender note to the version of you who woke up today.",
    "What did you notice, that no one else saw?",
]
_JOURNAL_PROMPTS_NIGHT = [
    "What is quiet enough now to be heard?",
    "The day is done. What lingers?",
    "One kindness — to yourself, before sleep.",
]


@api.get("/journal/prompt")
async def journal_prompt(user: User = Depends(get_current_user)) -> Dict[str, Any]:
    """A softly-rotating writing prompt driven by the time of day and the
    user's most recent mood word. Never instructive, never assessing."""
    h = now_utc().hour
    if 5 <= h < 12:
        pool = _JOURNAL_PROMPTS_MORNING
    elif 12 <= h < 17:
        pool = _JOURNAL_PROMPTS_MIDDAY
    elif 17 <= h < 22:
        pool = _JOURNAL_PROMPTS_EVENING
    else:
        pool = _JOURNAL_PROMPTS_NIGHT

    # Deterministic per-day so it doesn't shift while you're writing.
    today = now_utc().date()
    idx = (today.toordinal() + user.user_id.__hash__()) % len(pool)
    prompt = pool[idx]

    latest = await db.journal_entries.find_one(
        {"user_id": user.user_id}, {"_id": 0}, sort=[("created_at", -1)]
    )
    recent_mood = latest.get("mood_word") if latest else None
    return {"prompt": prompt, "recent_mood": recent_mood}


@api.get("/journal", response_model=List[JournalEntry])
async def list_journal(user: User = Depends(get_current_user)):
    docs = await db.journal_entries.find({"user_id": user.user_id}, {"_id": 0}) \
        .sort("created_at", -1).to_list(500)
    return [JournalEntry(**d) for d in docs]


@api.get("/journal/insights")
async def journal_insights(user: User = Depends(get_current_user)):
    docs = await db.journal_entries.find({"user_id": user.user_id}, {"_id": 0}).to_list(1000)
    word_counts: dict = {}
    scores: List[int] = []
    for d in docs:
        w = d.get("mood_word")
        if w:
            word_counts[w] = word_counts.get(w, 0) + 1
        s = d.get("mood_score")
        if isinstance(s, int):
            scores.append(s)
    top_words = sorted(word_counts.items(), key=lambda x: -x[1])[:8]
    avg = round(sum(scores) / len(scores), 2) if scores else None
    checkin_count = await db.weekly_checkins.count_documents({"user_id": user.user_id})
    upload_count = await db.therapist_uploads.count_documents({"user_id": user.user_id})
    return {
        "entry_count": len(docs),
        "avg_mood": avg,
        "top_words": [{"word": w, "count": c} for w, c in top_words],
        "weekly_checkins": checkin_count,
        "therapist_uploads": upload_count,
    }


# ---------------------------------------------------------------------------
# Weekly check-ins
# ---------------------------------------------------------------------------
@api.post("/checkins/weekly", response_model=WeeklyCheckIn)
async def create_weekly_checkin(body: WeeklyCheckInCreate, user: User = Depends(get_current_user)):
    dt = now_utc()
    yr, wk, _ = dt.isocalendar()
    entry = WeeklyCheckIn(
        checkin_id=new_id("wc"),
        user_id=user.user_id,
        week_key=f"{yr}-{wk:02d}",
        created_at=dt,
        **body.model_dump(),
    )
    await db.weekly_checkins.insert_one(entry.model_dump())
    return entry


@api.get("/checkins/weekly", response_model=List[WeeklyCheckIn])
async def list_weekly_checkins(user: User = Depends(get_current_user)):
    docs = await db.weekly_checkins.find({"user_id": user.user_id}, {"_id": 0}) \
        .sort("created_at", -1).to_list(200)
    return [WeeklyCheckIn(**d) for d in docs]


# ---------------------------------------------------------------------------
# Safety net
# ---------------------------------------------------------------------------
@api.post("/safety/checkin", response_model=SafetyCheckIn)
async def create_safety_checkin(body: SafetyCheckInCreate, user: User = Depends(get_current_user)):
    entry = SafetyCheckIn(
        checkin_id=new_id("sc"),
        user_id=user.user_id,
        created_at=now_utc(),
        **body.model_dump(),
    )
    await db.safety_checkins.insert_one(entry.model_dump())
    return entry


@api.get("/safety/checkin/today", response_model=Optional[SafetyCheckIn])
async def today_safety_checkin(user: User = Depends(get_current_user)):
    start = now_utc().replace(hour=0, minute=0, second=0, microsecond=0)
    doc = await db.safety_checkins.find_one(
        {"user_id": user.user_id, "created_at": {"$gte": start}},
        {"_id": 0},
        sort=[("created_at", -1)],
    )
    return SafetyCheckIn(**doc) if doc else None


@api.post("/safety/contacts", response_model=EmergencyContact)
async def add_contact(body: EmergencyContactCreate, user: User = Depends(get_current_user)):
    contact = EmergencyContact(
        contact_id=new_id("ec"),
        user_id=user.user_id,
        created_at=now_utc(),
        **body.model_dump(),
    )
    await db.emergency_contacts.insert_one(contact.model_dump())
    return contact


@api.get("/safety/contacts", response_model=List[EmergencyContact])
async def list_contacts(user: User = Depends(get_current_user)):
    docs = await db.emergency_contacts.find({"user_id": user.user_id}, {"_id": 0}) \
        .sort("created_at", -1).to_list(50)
    return [EmergencyContact(**d) for d in docs]


@api.delete("/safety/contacts/{contact_id}")
async def delete_contact(contact_id: str, user: User = Depends(get_current_user)):
    await db.emergency_contacts.delete_one({"contact_id": contact_id, "user_id": user.user_id})
    return {"ok": True}


@api.get("/safety/crisis-resources")
async def crisis_resources():
    return {
        "resources": [
            {"name": "988 Suicide & Crisis Lifeline (US)", "contact": "988", "kind": "call_or_text"},
            {"name": "Crisis Text Line", "contact": "Text HOME to 741741", "kind": "text"},
            {"name": "International Association for Suicide Prevention", "contact": "iasp.info/resources/Crisis_Centres/", "kind": "web"},
            {"name": "SAMHSA National Helpline", "contact": "1-800-662-4357", "kind": "call"},
        ]
    }


# ---------------------------------------------------------------------------
# Therapist uploads
# ---------------------------------------------------------------------------
@api.post("/therapist-uploads", response_model=TherapistUpload)
async def create_upload(body: TherapistUploadCreate, user: User = Depends(get_current_user)):
    upload = TherapistUpload(
        upload_id=new_id("tu"),
        user_id=user.user_id,
        created_at=now_utc(),
        **body.model_dump(),
    )
    await db.therapist_uploads.insert_one(upload.model_dump())
    return upload


@api.get("/therapist-uploads", response_model=List[TherapistUpload])
async def list_uploads(user: User = Depends(get_current_user)):
    docs = await db.therapist_uploads.find({"user_id": user.user_id}, {"_id": 0}) \
        .sort("created_at", -1).to_list(200)
    # strip file_base64 from list responses to keep payload small
    for d in docs:
        d["file_base64"] = None
    return [TherapistUpload(**d) for d in docs]


# ---------------------------------------------------------------------------
# EMDR memories (phase 2)
# ---------------------------------------------------------------------------
@api.post("/memories", response_model=Memory)
async def create_memory(body: MemoryCreate, user: User = Depends(get_current_user)):
    m = Memory(
        memory_id=new_id("m"),
        user_id=user.user_id,
        created_at=now_utc(),
        **body.model_dump(),
    )
    await db.memories.insert_one(m.model_dump())
    return m


@api.get("/memories", response_model=List[Memory])
async def list_memories(user: User = Depends(get_current_user)):
    docs = await db.memories.find({"user_id": user.user_id}, {"_id": 0}) \
        .sort("created_at", -1).to_list(200)
    return [Memory(**d) for d in docs]


# ---------------------------------------------------------------------------
# Session logs (phase 3)
# ---------------------------------------------------------------------------
@api.post("/session-logs", response_model=SessionLog)
async def create_session_log(body: SessionLogCreate, user: User = Depends(get_current_user)):
    data = body.model_dump()
    data["date"] = data.get("date") or now_utc()
    log = SessionLog(
        log_id=new_id("sl"),
        user_id=user.user_id,
        created_at=now_utc(),
        **data,
    )
    await db.session_logs.insert_one(log.model_dump())
    return log


@api.get("/session-logs", response_model=List[SessionLog])
async def list_session_logs(user: User = Depends(get_current_user)):
    docs = await db.session_logs.find({"user_id": user.user_id}, {"_id": 0}) \
        .sort("date", -1).to_list(200)
    return [SessionLog(**d) for d in docs]


# ---------------------------------------------------------------------------
# Somatic practices (global, seeded)
# ---------------------------------------------------------------------------
SEED_PRACTICES: List[dict] = [
    {"practice_id": "pr_box_breathing", "title": "Box Breathing", "category": "Breathing",
     "duration_min": 4, "description": "Regulate the nervous system with a 4-4-4-4 breath cycle.",
     "instructions": ["Inhale gently through the nose for 4 counts.", "Hold your breath softly for 4 counts.",
                      "Exhale slowly through the mouth for 4 counts.", "Hold empty for 4 counts.",
                      "Repeat for 4 minutes."], "unlock_phase": 0},
    {"practice_id": "pr_54321", "title": "5-4-3-2-1 Grounding", "category": "Grounding",
     "duration_min": 3, "description": "Return to the present through your five senses.",
     "instructions": ["Notice 5 things you can see.", "Notice 4 things you can touch.",
                      "Notice 3 things you can hear.", "Notice 2 things you can smell.",
                      "Notice 1 thing you can taste."], "unlock_phase": 0},
    {"practice_id": "pr_body_scan", "title": "Gentle Body Scan", "category": "Body Awareness",
     "duration_min": 8, "description": "Move attention slowly through the body without changing anything.",
     "instructions": ["Sit or lie comfortably.", "Begin at the feet, notice sensation without judgement.",
                      "Move slowly upward — legs, hips, belly, chest, arms, neck, face.",
                      "Rest attention at the crown for a breath, then softly open your eyes."],
     "unlock_phase": 1},
    {"practice_id": "pr_butterfly_hug", "title": "Butterfly Hug (self-tapping)", "category": "EMDR pre-work",
     "duration_min": 2, "description": "Bilateral self-soothing tapping to regulate before EMDR work.",
     "instructions": ["Cross arms over chest, hands on shoulders.", "Tap left, then right, slowly, alternating.",
                      "Breathe steadily for 30 seconds to 2 minutes.", "Notice any shift, however small."],
     "unlock_phase": 2},
    {"practice_id": "pr_orient", "title": "Orienting Practice", "category": "Grounding",
     "duration_min": 3, "description": "Slowly look around the room to signal safety to the nervous system.",
     "instructions": ["Slowly turn your head left, then right.", "Let your eyes rest on colors and shapes.",
                      "Notice the exits, the light, the quiet.", "Whisper: 'I am here. It is now.'"],
     "unlock_phase": 0},
    {"practice_id": "pr_soft_belly", "title": "Soft Belly Breathing", "category": "Breathing",
     "duration_min": 5, "description": "Release abdominal tension carried from stress.",
     "instructions": ["Place one hand on the belly.", "Breathe so only the belly hand rises.",
                      "Sigh out on each exhale.", "Continue for 5 minutes."], "unlock_phase": 0},
    {"practice_id": "pr_pendulation", "title": "Pendulation", "category": "Body Awareness",
     "duration_min": 6, "description": "Move attention between a resourced place and mild activation.",
     "instructions": ["Notice a place in the body that feels neutral or safe.",
                      "Briefly notice a place that feels charged.",
                      "Return to the safe place. Repeat gently.",
                      "End on the safe place."], "unlock_phase": 3},
    {"practice_id": "pr_container", "title": "Container Visualization", "category": "EMDR pre-work",
     "duration_min": 5, "description": "Safely store distressing material between sessions.",
     "instructions": ["Imagine a container of any size, sturdy and closable.",
                      "Place any distressing thoughts inside.", "Close the container securely.",
                      "Set it aside until your next session."], "unlock_phase": 2},
]


@api.get("/somatic-practices", response_model=List[SomaticPractice])
async def list_practices(user: User = Depends(get_current_user)):
    return [SomaticPractice(**p) for p in SEED_PRACTICES]


# ---------------------------------------------------------------------------
# Trauma Map Timeline
# ---------------------------------------------------------------------------
@api.post("/timeline", response_model=TimelineEvent)
async def create_timeline_event(body: TimelineEventCreate, user: User = Depends(get_current_user)):
    data = body.model_dump()
    data["event_date"] = data.get("event_date") or now_utc()
    ev = TimelineEvent(
        event_id=new_id("te"),
        user_id=user.user_id,
        created_at=now_utc(),
        **data,
    )
    await db.timeline_events.insert_one(ev.model_dump())
    return ev


@api.get("/timeline", response_model=List[TimelineEvent])
async def list_timeline(user: User = Depends(get_current_user)):
    docs = await db.timeline_events.find({"user_id": user.user_id}, {"_id": 0}) \
        .sort("event_date", -1).to_list(500)
    return [TimelineEvent(**d) for d in docs]


# ---------------------------------------------------------------------------
# Dashboard summary (for Today screen)
# ---------------------------------------------------------------------------
@api.get("/dashboard")
async def dashboard(user: User = Depends(get_current_user)) -> Dict[str, Any]:
    """Sessions rollup + emotional context signals for the Today screen."""
    now = now_utc()
    weeks: List[Dict[str, Any]] = []
    total_this_week = 0
    for i in range(5):
        week_end = now - timedelta(weeks=i)
        week_start = week_end - timedelta(days=7)
        q = {"user_id": user.user_id, "created_at": {"$gte": week_start, "$lt": week_end}}
        c1 = await db.weekly_checkins.count_documents(q)
        c2 = await db.journal_entries.count_documents(q)
        c3 = await db.session_logs.count_documents(q)
        count = c1 + c2 + c3
        if i == 0:
            total_this_week = count
        weeks.append({
            "week_start": week_start.date().isoformat(),
            "week_end": week_end.date().isoformat(),
            "count": count,
        })
    weeks.reverse()

    total_sessions = (
        await db.weekly_checkins.count_documents({"user_id": user.user_id})
        + await db.journal_entries.count_documents({"user_id": user.user_id})
        + await db.session_logs.count_documents({"user_id": user.user_id})
    )
    target = 20
    pct = min(round((total_sessions / target) * 100), 100) if target else 0

    # ------- Context signals for contextual affirmations -------
    latest_journal = await db.journal_entries.find_one(
        {"user_id": user.user_id}, {"_id": 0}, sort=[("created_at", -1)]
    )
    latest_checkin = await db.weekly_checkins.find_one(
        {"user_id": user.user_id}, {"_id": 0}, sort=[("created_at", -1)]
    )
    latest = None
    for cand in [latest_journal, latest_checkin]:
        if not cand:
            continue
        ts = cand["created_at"]
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        if latest is None or ts > latest:
            latest = ts
    days_since_last = None
    if latest is not None:
        days_since_last = (now.date() - latest.date()).days

    # Distinct active days across all activity
    pipeline = [
        {"$match": {"user_id": user.user_id}},
        {"$project": {"_id": 0, "d": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}}}},
    ]
    active_days = set()
    for col in ("journal_entries", "weekly_checkins", "session_logs"):
        async for doc in db[col].aggregate(pipeline):
            active_days.add(doc["d"])

    # Milestone hit recently? (a stone will pop today if there's a stone dated today)
    milestone_today = False
    milestone_title = None
    milestones_all = await _compute_memory_stones(user)
    today_iso = now.date().isoformat()
    if milestones_all:
        latest_stone = milestones_all[-1]
        if latest_stone["date"] == today_iso:
            milestone_today = True
            milestone_title = latest_stone["title"]

    return {
        "sessions_this_week": total_this_week,
        "sessions_completed": total_sessions,
        "sessions_target": target,
        "journey_progress_pct": pct,
        "weekly": weeks,
        "context": {
            "days_since_last_activity": days_since_last,
            "active_days_count": len(active_days),
            "is_first_visit": total_sessions == 0,
            "is_returning": days_since_last is not None and days_since_last >= 14,
            "milestone_today": milestone_today,
            "milestone_title": milestone_title,
        },
    }


# ---------------------------------------------------------------------------
# Memory Path — meaningful stones a user can tap to revisit a chapter
# ---------------------------------------------------------------------------
async def _compute_memory_stones(user: User) -> List[Dict[str, Any]]:
    """Derive a sequence of memory stones from the user's own history.

    Stones are chapters, not achievements. Each stone points to a real
    saved moment (journal entry, weekly check-in, or phase transition).
    """
    stones: List[Dict[str, Any]] = []

    # Journal chapters — first entry + every 5th entry
    journals = await db.journal_entries.find({"user_id": user.user_id}, {"_id": 0}) \
        .sort("created_at", 1).to_list(1000)
    for idx, j in enumerate(journals):
        n = idx + 1
        is_first = n == 1
        is_milestone = n > 1 and n % 5 == 0
        if not (is_first or is_milestone):
            continue
        ts: datetime = j["created_at"]
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        stones.append({
            "stone_id": f"stone_journal_{j['entry_id']}",
            "kind": "journal",
            "title": "The first stone" if is_first else f"Chapter {n} of reflection",
            "date": ts.date().isoformat(),
            "created_at": ts,
            "ref_id": j["entry_id"],
            "preview": (j.get("body") or "")[:140],
        })

    # Weekly check-in chapters — every 4th check-in
    checkins = await db.weekly_checkins.find({"user_id": user.user_id}, {"_id": 0}) \
        .sort("created_at", 1).to_list(500)
    for idx, c in enumerate(checkins):
        n = idx + 1
        if n % 4 != 0:
            continue
        ts = c["created_at"]
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        stones.append({
            "stone_id": f"stone_checkin_{c['checkin_id']}",
            "kind": "checkin",
            "title": "A month of showing up",
            "date": ts.date().isoformat(),
            "created_at": ts,
            "ref_id": c["checkin_id"],
            "preview": (c.get("feeling_summary") or "")[:140],
        })

    # Phase changes — one stone per phase reached
    # We approximate: use user's updated_at + current_phase (no dedicated log yet)
    # If phase > 0, add a stone for entering current phase (best-effort).
    if user.current_phase > 0:
        stones.append({
            "stone_id": f"stone_phase_{user.current_phase}",
            "kind": "phase",
            "title": f"Entered Season {user.current_phase}",
            "date": (user.updated_at.date() if user.updated_at.tzinfo else user.updated_at.replace(tzinfo=timezone.utc).date()).isoformat(),
            "created_at": user.updated_at if user.updated_at.tzinfo else user.updated_at.replace(tzinfo=timezone.utc),
            "ref_id": str(user.current_phase),
            "preview": "A new season of your healing arc.",
        })

    stones.sort(key=lambda s: s["created_at"])
    return stones


@api.get("/memory-path")
async def memory_path(user: User = Depends(get_current_user)) -> Dict[str, Any]:
    stones = await _compute_memory_stones(user)
    # strip datetime, keep iso date
    for s in stones:
        s.pop("created_at", None)
    return {"stones": stones}


@api.get("/memory-path/{stone_id}")
async def memory_stone_detail(stone_id: str, user: User = Depends(get_current_user)):
    stones = await _compute_memory_stones(user)
    match = next((s for s in stones if s["stone_id"] == stone_id), None)
    if not match:
        raise HTTPException(status_code=404, detail="Stone not found")

    detail: Dict[str, Any] = {**match}
    detail.pop("created_at", None)

    if match["kind"] == "journal":
        j = await db.journal_entries.find_one(
            {"user_id": user.user_id, "entry_id": match["ref_id"]}, {"_id": 0}
        )
        if j:
            detail["entry"] = j
    elif match["kind"] == "checkin":
        c = await db.weekly_checkins.find_one(
            {"user_id": user.user_id, "checkin_id": match["ref_id"]}, {"_id": 0}
        )
        if c:
            detail["entry"] = c
    elif match["kind"] == "phase":
        detail["entry"] = {"phase": int(match["ref_id"])}

    return detail


# ---------------------------------------------------------------------------
# Starting phase selection (onboarding)
# ---------------------------------------------------------------------------
class StartingPhaseRequest(BaseModel):
    phase: int


@api.post("/onboarding/starting-phase", response_model=User)
async def set_starting_phase(body: StartingPhaseRequest, user: User = Depends(get_current_user)):
    if body.phase not in (1, 2, 3):
        raise HTTPException(status_code=400, detail="phase must be 1, 2, or 3")
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"current_phase": body.phase, "updated_at": now_utc()}},
    )
    doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    return User(**doc)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@api.get("/")
async def root():
    return {"service": "project-life", "ok": True}


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------
@app.on_event("startup")
async def startup():
    try:
        await db.users.create_index("email", unique=False)
        await db.users.create_index("user_id", unique=True)
    except Exception as e:  # noqa: BLE001
        logger.warning("Index creation warning: %s", e)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
