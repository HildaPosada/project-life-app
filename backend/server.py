"""Project Life – Trauma-Informed Emotional Intelligence App backend.

Auth: Emergent-managed Google OAuth (session_token flow, 7-day expiry).
Storage: MongoDB (all responses exclude _id).
"""

import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional, Literal, Dict, Any

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Request
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
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

EMERGENT_SESSION_DATA_URL = (
    "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
)

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
class SessionRequest(BaseModel):
    session_id: str


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
    created_at: datetime
    updated_at: datetime


class ProfileUpdate(BaseModel):
    pronouns: Optional[str] = None
    location: Optional[str] = None
    in_therapy: Optional[bool] = None
    therapist_release_form: Optional[str] = None
    consent_accepted: Optional[bool] = None
    onboarding_complete: Optional[bool] = None


class AuthResponse(BaseModel):
    session_token: str
    user: User


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
# Auth helpers
# ---------------------------------------------------------------------------
async def get_current_user(authorization: Optional[str] = Header(None)) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization[len("Bearer ") :].strip()
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now_utc():
        raise HTTPException(status_code=401, detail="Session expired")
    user_doc = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**user_doc)


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------
@api.post("/auth/session", response_model=AuthResponse)
async def create_session(payload: SessionRequest):
    async with httpx.AsyncClient(timeout=15.0) as http_client:
        r = await http_client.get(
            EMERGENT_SESSION_DATA_URL,
            headers={"X-Session-ID": payload.session_id},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session_id")
    data = r.json()
    email = data["email"]
    session_token = data["session_token"]

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": data.get("name", existing.get("name", "")),
                      "picture": data.get("picture"),
                      "updated_at": now_utc()}},
        )
    else:
        user_id = new_id("user")
        new_user = {
            "user_id": user_id,
            "email": email,
            "name": data.get("name", email.split("@")[0]),
            "picture": data.get("picture"),
            "pronouns": None,
            "location": None,
            "in_therapy": None,
            "therapist_release_form": None,
            "consent_accepted": False,
            "onboarding_complete": False,
            "current_phase": 0,
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }
        await db.users.insert_one(new_user)

    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "expires_at": now_utc() + timedelta(days=7),
        "created_at": now_utc(),
    })

    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return AuthResponse(session_token=session_token, user=User(**user_doc))


@api.get("/auth/me", response_model=User)
async def get_me(user: User = Depends(get_current_user)):
    return user


@api.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization[len("Bearer ") :].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


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
# Dashboard summary (for Home screen chart & progress)
# ---------------------------------------------------------------------------
@api.get("/dashboard")
async def dashboard(user: User = Depends(get_current_user)) -> Dict[str, Any]:
    """Return session counts per week (last 5 weeks) and overall progress."""
    now = now_utc()
    # session-like activities = weekly_checkins + journal + session_logs
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
    weeks.reverse()  # oldest → newest

    total_sessions = (
        await db.weekly_checkins.count_documents({"user_id": user.user_id})
        + await db.journal_entries.count_documents({"user_id": user.user_id})
        + await db.session_logs.count_documents({"user_id": user.user_id})
    )
    target = 20
    pct = min(round((total_sessions / target) * 100), 100) if target else 0
    return {
        "sessions_this_week": total_this_week,
        "sessions_completed": total_sessions,
        "sessions_target": target,
        "journey_progress_pct": pct,
        "weekly": weeks,
    }


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
        await db.users.create_index("email", unique=True)
        await db.users.create_index("user_id", unique=True)
        await db.user_sessions.create_index("session_token", unique=True)
        await db.user_sessions.create_index("user_id")
        await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
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
