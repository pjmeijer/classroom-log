# Classroom-Log V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an Expo Go app + FastAPI proxy that special-education teachers can use during a demo session to log incidents (voice or text) about students and generate a Claude-drafted daily summary per student.

**Architecture:** Expo Router app on phones (Expo Go, no custom dev build) + FastAPI proxy on the builder's WSL laptop. The phone records audio via `expo-audio`, ships it to the proxy, which calls OpenAI Whisper for transcription and Claude for summaries. Local SQLite per device; ngrok tunnel between phone and laptop. Design language is variant C "Warm human" — cream paper + terracotta + sage, Source Serif headings, Source Sans body.

**Tech Stack:** TypeScript + Expo SDK (expo-router, expo-audio, expo-sqlite), Python 3.11+ + FastAPI + `anthropic` SDK + `openai` SDK, Jest with `jest-expo` preset on the mobile side, pytest on the backend side.

**Constraints (locked, do not relax):**
- All implementation work happens on feature branches off `main`. Never on `main` directly. Per-task commits as detailed below.
- TDD discipline per `superpowers:test-driven-development`: red → green → refactor. Write the test first, watch it fail, write minimum code to pass, refactor if needed, commit.
- Every dispatched subagent MUST be instructed to use the appropriate superpowers skills (TDD, verification-before-completion). Dropping discipline at the subagent boundary is a regression.
- Implementer subagents stay on the feature branch they were dispatched into. They do NOT fast-forward merge to `main`. The controller (you) does merges.
- Code reviews via `/codex review` at the end of major phases (not in-session subagent reviewers). A spec-compliance subagent (mechanical plan-vs-code check) is OK.
- Out-of-scope items per spec §2 (multi-tenant, sync, app store, categories, RNTL UI tests, web build, etc.) stay out of scope. Do NOT expand.
- User host is Windows + WSL2. All commands assume WSL bash.

**Sequencing rationale:** Backend lands first so the mobile layer can hit real endpoints from day one (no stubs to swap later). Mobile is built bottom-up (SQLite → screens) so each screen renders real data. The TEXT path of the demo flow is end-to-end working by Task 12, before any voice work — proves the architecture under load before adding audio complexity. Voice path is layered on after (Tasks 13–14). Polish and edge cases close out (Tasks 15–18).

**Design tokens (variant C — Warm human, from approved.json):**
- `bg: #FAF6EE` (cream paper)
- `surface: #FFFCF5`
- `surface2: #F4EFE2`
- `ink: #2A2620`
- `inkMuted: #807366`
- `border: #E8DFCB`
- `accent: #C4543B` (terracotta — primary action)
- `accent2: #7B9A66` (sage — secondary action / success)
- `accentSoft: #F4D9CF`
- `accentText: #FFFCF5`
- `radius: { sm: 10, md: 16, lg: 22 }`
- `font.heading: "SourceSerif4_600SemiBold"` (italic for captions)
- `font.body: "SourceSans3_400Regular"` / `"SourceSans3_600SemiBold"`
- `shadow: "0 2px 6px rgba(196, 84, 59, .08)"`

---

## File Structure

**Repo root:**
```
classroom-log/
├── .gitignore
├── README.md
├── mobile/
│   ├── app/
│   │   ├── _layout.tsx
│   │   ├── index.tsx
│   │   ├── onboarding.tsx
│   │   ├── settings.tsx
│   │   ├── summary.tsx
│   │   └── note/
│   │       └── [studentId].tsx
│   ├── components/
│   │   ├── StudentTile.tsx
│   │   ├── NoteRow.tsx
│   │   ├── StatusPill.tsx
│   │   ├── PrimaryButton.tsx
│   │   └── DiscardSheet.tsx
│   ├── db/
│   │   ├── db.ts
│   │   ├── migrations.ts
│   │   └── __tests__/db.test.ts
│   ├── api/
│   │   ├── client.ts
│   │   ├── health.ts
│   │   ├── summary.ts
│   │   ├── transcribe.ts
│   │   └── __tests__/api.test.ts
│   ├── lib/
│   │   ├── audio.ts
│   │   ├── theme.ts
│   │   ├── dates.ts
│   │   ├── id.ts
│   │   └── __tests__/audio.test.ts
│   ├── package.json
│   ├── tsconfig.json
│   ├── babel.config.js
│   ├── jest.config.js
│   └── app.config.ts
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── settings.py
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   ├── health.py
│   │   │   ├── summary.py
│   │   │   └── transcribe.py
│   │   └── clients/
│   │       ├── __init__.py
│   │       ├── anthropic_client.py
│   │       └── openai_client.py
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── conftest.py
│   │   ├── test_health.py
│   │   ├── test_summary.py
│   │   └── test_transcribe.py
│   ├── requirements.txt
│   ├── pytest.ini
│   └── .env.example
└── docs/
    ├── manual-smoke.md
    ├── tunnel-setup.md
    └── superpowers/
        ├── specs/
        │   └── 2026-05-26-classroom-log-design.md
        └── plans/
            └── 2026-05-26-classroom-log-v1.md  (this file)
```

Each file is single-responsibility. The `routes/` and `clients/` split on the backend lets you mock clients in tests without monkey-patching FastAPI internals. The `components/`, `db/`, `api/`, `lib/` split on the mobile side keeps screens thin — screens orchestrate, they don't own logic.

---

## Task 0: Setup feature branch and pre-commit hygiene

**Files:**
- Modify: `.gitignore`
- Read: existing `.gitignore` to confirm rules

**Branch policy:** Start a clean feature branch off `main`. The current branch (`spec/initial-design`) is for spec work; implementation goes elsewhere.

- [ ] **Step 1: Confirm we're at a clean merge point**

```bash
git status
git branch --show-current
```

Expected: working tree clean. Current branch is `spec/initial-design` (where the spec and this plan live).

- [ ] **Step 2: Merge the spec branch to main first**

```bash
git checkout main
git merge --no-ff spec/initial-design -m "Merge spec/initial-design: V1 design spec + implementation plan"
```

Expected: fast-forward or no-ff merge completes; main now has the spec + plan.

- [ ] **Step 3: Create the implementation branch off main**

```bash
git checkout -b feat/v1-implementation
git branch --show-current
```

Expected: output is `feat/v1-implementation`.

- [ ] **Step 4: Extend .gitignore for upcoming artifacts**

Add Expo/Metro caches that aren't already covered. Current `.gitignore` already has `node_modules/`, `.expo/`, `dist/`, `web-build/`, `.gstack/`, secrets, OS, IDE.

Append:

```
# Expo / EAS
.expo-shared/
*.tsbuildinfo

# Pytest / Python cache
.pytest_cache/
.mypy_cache/
.ruff_cache/

# Mobile build outputs
mobile/ios/
mobile/android/
```

- [ ] **Step 5: Commit**

```bash
git add .gitignore
git commit -m "chore: extend gitignore for Expo, EAS, pytest caches"
```

---

## Task 1: Backend skeleton + /health endpoint

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/pytest.ini`
- Create: `backend/.env.example`
- Create: `backend/app/__init__.py` (empty)
- Create: `backend/app/main.py`
- Create: `backend/app/settings.py`
- Create: `backend/app/routes/__init__.py` (empty)
- Create: `backend/app/routes/health.py`
- Create: `backend/app/clients/__init__.py` (empty)
- Create: `backend/app/clients/anthropic_client.py`
- Create: `backend/app/clients/openai_client.py`
- Create: `backend/tests/__init__.py` (empty)
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_health.py`

- [ ] **Step 1: Write requirements.txt**

```
fastapi==0.115.0
uvicorn[standard]==0.32.0
python-multipart==0.0.12
python-dotenv==1.0.1
anthropic==0.39.0
openai==1.54.0
pydantic==2.9.2
pytest==8.3.3
pytest-asyncio==0.24.0
httpx==0.27.2
```

- [ ] **Step 2: Write pytest.ini**

```ini
[pytest]
testpaths = tests
asyncio_mode = auto
filterwarnings =
    ignore::DeprecationWarning
```

- [ ] **Step 3: Write .env.example**

```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-proj-...
```

- [ ] **Step 4: Install deps and verify**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pytest --collect-only
```

Expected: `pytest --collect-only` reports 0 tests collected and exits 5. That's correct — no tests yet.

- [ ] **Step 5: Write the failing test for /health**

`backend/tests/conftest.py`:
```python
import pytest
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture
def client():
    return TestClient(app)
```

`backend/tests/test_health.py`:
```python
def test_health_returns_ok_shape(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert "anthropic_ok" in body
    assert "openai_ok" in body
```

- [ ] **Step 6: Run the test to verify it fails**

```bash
cd backend && source .venv/bin/activate && pytest tests/test_health.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'app.main'`.

- [ ] **Step 7: Write settings.py**

```python
# backend/app/settings.py
import os
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
```

- [ ] **Step 8: Write the Anthropic and OpenAI client wrappers (stubs first)**

`backend/app/clients/anthropic_client.py`:
```python
from anthropic import Anthropic
from app.settings import ANTHROPIC_API_KEY

def get_anthropic() -> Anthropic:
    return Anthropic(api_key=ANTHROPIC_API_KEY)

async def ping_anthropic() -> bool:
    """Returns True if the API key is set. Real connectivity check happens on actual calls.
    Kept cheap to make /health fast."""
    return bool(ANTHROPIC_API_KEY)
```

`backend/app/clients/openai_client.py`:
```python
from openai import OpenAI
from app.settings import OPENAI_API_KEY

def get_openai() -> OpenAI:
    return OpenAI(api_key=OPENAI_API_KEY)

async def ping_openai() -> bool:
    return bool(OPENAI_API_KEY)
```

- [ ] **Step 9: Write the /health route**

`backend/app/routes/health.py`:
```python
from fastapi import APIRouter
from app.clients.anthropic_client import ping_anthropic
from app.clients.openai_client import ping_openai

router = APIRouter()

@router.get("/health")
async def health():
    anthropic_ok = await ping_anthropic()
    openai_ok = await ping_openai()
    return {
        "ok": anthropic_ok and openai_ok,
        "anthropic_ok": anthropic_ok,
        "openai_ok": openai_ok,
    }
```

- [ ] **Step 10: Wire main.py**

`backend/app/main.py`:
```python
from fastapi import FastAPI
from app.routes.health import router as health_router

app = FastAPI(title="classroom-log proxy", version="0.1.0")
app.include_router(health_router)
```

- [ ] **Step 11: Run the test to verify it passes**

```bash
cd backend && source .venv/bin/activate && pytest tests/test_health.py -v
```

Expected: PASS.

- [ ] **Step 12: Smoke-test the server manually**

In one terminal:
```bash
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

In another:
```bash
curl http://localhost:8000/health
```

Expected (when env keys are set): `{"ok":true,"anthropic_ok":true,"openai_ok":true}`. With keys unset, `ok:false`. Either is acceptable — the test asserts shape, not truth.

- [ ] **Step 13: Commit**

```bash
git add backend/
git commit -m "feat(backend): scaffolding + /health endpoint with TDD"
```

---

## Task 2: Backend /summary endpoint with mocked Anthropic

**Files:**
- Create: `backend/app/routes/summary.py`
- Modify: `backend/app/main.py` (add router)
- Modify: `backend/app/clients/anthropic_client.py` (add `generate_summary`)
- Create: `backend/tests/test_summary.py`

**Contract:**
- Request: `POST /summary` with JSON `{"student_name": str, "notes": [{"ts": int, "text": str}]}`
- Response on success: `{"positives": str, "concerns": str, "patterns": str, "next_steps": str}`
- Response on error: `{"error": {"code": str, "message": str}}` with appropriate HTTP status

Uses Anthropic tool use for structured output — Claude must return all four sections.

- [ ] **Step 1: Write the failing test for the happy path**

`backend/tests/test_summary.py`:
```python
import pytest
from unittest.mock import AsyncMock, patch

@pytest.fixture
def sample_payload():
    return {
        "student_name": "Alex M.",
        "notes": [
            {"ts": 1716711600000, "text": "Stayed focused through morning math."},
            {"ts": 1716718200000, "text": "Used sensory tools twice during transitions."},
        ],
    }

@patch("app.routes.summary.generate_summary", new_callable=AsyncMock)
def test_summary_returns_four_sections(mock_gen, client, sample_payload):
    mock_gen.return_value = {
        "positives": "Maintained focus through morning blocks.",
        "concerns": "Transitions remain hard.",
        "patterns": "Best output in first 90 minutes.",
        "next_steps": "Try shorter afternoon chunks.",
    }
    r = client.post("/summary", json=sample_payload)
    assert r.status_code == 200
    body = r.json()
    assert set(body.keys()) == {"positives", "concerns", "patterns", "next_steps"}
    for v in body.values():
        assert isinstance(v, str) and len(v) > 0

@patch("app.routes.summary.generate_summary", new_callable=AsyncMock)
def test_summary_propagates_anthropic_error(mock_gen, client, sample_payload):
    mock_gen.side_effect = RuntimeError("rate limited")
    r = client.post("/summary", json=sample_payload)
    assert r.status_code == 502
    body = r.json()
    assert body["error"]["code"] == "anthropic_error"
    assert "rate limited" in body["error"]["message"]

def test_summary_rejects_empty_notes(client):
    r = client.post("/summary", json={"student_name": "Alex", "notes": []})
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "no_notes"
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend && pytest tests/test_summary.py -v
```

Expected: FAIL with import error (no `summary.py` yet).

- [ ] **Step 3: Extend the Anthropic client wrapper**

Append to `backend/app/clients/anthropic_client.py`:
```python
SUMMARY_TOOL = {
    "name": "produce_summary",
    "description": "Produce a four-section draft summary for a teacher to review.",
    "input_schema": {
        "type": "object",
        "properties": {
            "positives": {"type": "string", "description": "Concrete positive observations from the day."},
            "concerns": {"type": "string", "description": "Concrete concerns or challenges observed."},
            "patterns": {"type": "string", "description": "Patterns observed across the notes (timing, triggers, recoveries)."},
            "next_steps": {"type": "string", "description": "Suggested next steps for the teacher to consider."},
        },
        "required": ["positives", "concerns", "patterns", "next_steps"],
    },
}

SYSTEM_PROMPT = """You are an assistant helping a special-education teacher produce a draft daily summary about one student. You will receive that day's notes and must return a four-section draft using the `produce_summary` tool. The teacher will review before sharing — write as a draft, not as a finished document. Be concrete; quote behaviors, not interpretations."""

async def generate_summary(student_name: str, notes: list[dict]) -> dict:
    client = get_anthropic()
    notes_block = "\n".join(f"- [{n['ts']}] {n['text']}" for n in notes)
    user_message = f"Student: {student_name}\n\nNotes from today:\n{notes_block}"
    resp = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        tools=[SUMMARY_TOOL],
        tool_choice={"type": "tool", "name": "produce_summary"},
        messages=[{"role": "user", "content": user_message}],
    )
    # Tool use forces structured output; extract the tool_use block.
    for block in resp.content:
        if block.type == "tool_use" and block.name == "produce_summary":
            return block.input
    raise RuntimeError("Anthropic returned no tool_use block")
```

- [ ] **Step 4: Write the /summary route**

`backend/app/routes/summary.py`:
```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.clients.anthropic_client import generate_summary

router = APIRouter()

class Note(BaseModel):
    ts: int
    text: str

class SummaryRequest(BaseModel):
    student_name: str
    notes: list[Note]

@router.post("/summary")
async def summary(req: SummaryRequest):
    if not req.notes:
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "no_notes", "message": "No notes provided for summary."}},
        )
    try:
        result = await generate_summary(req.student_name, [n.model_dump() for n in req.notes])
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail={"error": {"code": "anthropic_error", "message": str(e)}},
        )
    return result
```

- [ ] **Step 5: Override FastAPI's HTTPException-to-response mapping**

FastAPI defaults to `{"detail": ...}` for HTTPExceptions. We want our error envelope at the top level. Add to `backend/app/main.py`:

```python
from fastapi import FastAPI, Request
from fastapi.exceptions import HTTPException
from fastapi.responses import JSONResponse
from app.routes.health import router as health_router
from app.routes.summary import router as summary_router

app = FastAPI(title="classroom-log proxy", version="0.1.0")

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(status_code=exc.status_code, content={"error": {"code": "http_error", "message": str(exc.detail)}})

app.include_router(health_router)
app.include_router(summary_router)
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
cd backend && pytest tests/test_summary.py -v
```

Expected: PASS (3 tests).

- [ ] **Step 7: Refactor — extract the error envelope into a helper**

Add to `backend/app/main.py` above the route imports:
```python
def err(code: str, message: str, status: int = 400):
    return HTTPException(status_code=status, detail={"error": {"code": code, "message": message}})
```

Update `backend/app/routes/summary.py` to use it:
```python
from fastapi import APIRouter
from pydantic import BaseModel
from app.clients.anthropic_client import generate_summary
from app.main import err

router = APIRouter()

class Note(BaseModel):
    ts: int
    text: str

class SummaryRequest(BaseModel):
    student_name: str
    notes: list[Note]

@router.post("/summary")
async def summary(req: SummaryRequest):
    if not req.notes:
        raise err("no_notes", "No notes provided for summary.", status=400)
    try:
        return await generate_summary(req.student_name, [n.model_dump() for n in req.notes])
    except Exception as e:
        raise err("anthropic_error", str(e), status=502)
```

This creates a circular import (`main` imports `summary`, `summary` imports `main`). Fix: move `err` into a new file.

`backend/app/errors.py`:
```python
from fastapi import HTTPException

def err(code: str, message: str, status: int = 400):
    return HTTPException(status_code=status, detail={"error": {"code": code, "message": message}})
```

Update both `main.py` and `summary.py` to import from `app.errors` instead.

- [ ] **Step 8: Re-run all tests to verify the refactor didn't break anything**

```bash
cd backend && pytest -v
```

Expected: PASS — both `test_health.py` and `test_summary.py`.

- [ ] **Step 9: Commit**

```bash
git add backend/
git commit -m "feat(backend): /summary endpoint with Anthropic tool-use structured output"
```

---

## Task 3: Backend /transcribe endpoint with mocked Whisper

**Files:**
- Create: `backend/app/routes/transcribe.py`
- Modify: `backend/app/main.py` (add router)
- Modify: `backend/app/clients/openai_client.py` (add `transcribe_audio`)
- Create: `backend/tests/test_transcribe.py`

**Contract:**
- Request: `POST /transcribe` multipart with `audio` field (the file)
- Response on success: `{"text": str}`
- Response on error: standard error envelope

Audio must be held in memory (no temp file on disk) and discarded after Whisper responds.

- [ ] **Step 1: Write the failing test for the happy path**

`backend/tests/test_transcribe.py`:
```python
import io
import pytest
from unittest.mock import AsyncMock, patch

@patch("app.routes.transcribe.transcribe_audio", new_callable=AsyncMock)
def test_transcribe_returns_text(mock_t, client):
    mock_t.return_value = "Stayed focused through morning math."
    fake_audio = io.BytesIO(b"RIFF....fake-wav-bytes")
    r = client.post(
        "/transcribe",
        files={"audio": ("note.m4a", fake_audio, "audio/m4a")},
    )
    assert r.status_code == 200
    assert r.json() == {"text": "Stayed focused through morning math."}

@patch("app.routes.transcribe.transcribe_audio", new_callable=AsyncMock)
def test_transcribe_propagates_openai_error(mock_t, client):
    mock_t.side_effect = RuntimeError("model temporarily unavailable")
    fake_audio = io.BytesIO(b"x")
    r = client.post(
        "/transcribe",
        files={"audio": ("note.m4a", fake_audio, "audio/m4a")},
    )
    assert r.status_code == 502
    assert r.json()["error"]["code"] == "openai_error"

def test_transcribe_rejects_missing_file(client):
    r = client.post("/transcribe")
    assert r.status_code == 422  # FastAPI validation error
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend && pytest tests/test_transcribe.py -v
```

Expected: FAIL — `app.routes.transcribe` not found.

- [ ] **Step 3: Extend the OpenAI client wrapper**

Append to `backend/app/clients/openai_client.py`:
```python
async def transcribe_audio(audio_bytes: bytes, filename: str = "audio.m4a") -> str:
    """Send audio bytes to Whisper. Audio is never written to disk;
    we wrap bytes in a BytesIO with a filename so the SDK can post multipart."""
    import io
    client = get_openai()
    file_obj = io.BytesIO(audio_bytes)
    file_obj.name = filename  # OpenAI SDK uses .name for filename in multipart
    resp = client.audio.transcriptions.create(
        model="whisper-1",
        file=file_obj,
        response_format="text",
    )
    # response_format=text returns a plain string
    return resp if isinstance(resp, str) else resp.text
```

- [ ] **Step 4: Write the /transcribe route**

`backend/app/routes/transcribe.py`:
```python
from fastapi import APIRouter, UploadFile, File
from app.clients.openai_client import transcribe_audio
from app.errors import err

router = APIRouter()

@router.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    try:
        audio_bytes = await audio.read()
        if not audio_bytes:
            raise err("empty_audio", "Audio payload was empty.", status=400)
        text = await transcribe_audio(audio_bytes, audio.filename or "audio.m4a")
        return {"text": text}
    finally:
        # Ensure the upload buffer is closed — uvicorn handles this in normal flow,
        # but explicit close defends against retained buffers under exceptions.
        try:
            await audio.close()
        except Exception:
            pass
```

- [ ] **Step 5: Register the router**

In `backend/app/main.py`:
```python
from app.routes.transcribe import router as transcribe_router
app.include_router(transcribe_router)
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
cd backend && pytest tests/test_transcribe.py -v
```

Expected: PASS (3 tests).

- [ ] **Step 7: Make the /health endpoint cheap-real**

Currently `ping_anthropic` and `ping_openai` just check that keys exist. Tighten them to be cheap real probes by validating the key format, but don't make a network call (that would slow `/health` down to >1s). Keys not validated remotely; the first real `/summary` or `/transcribe` call surfaces auth issues.

Update `backend/app/clients/anthropic_client.py`:
```python
async def ping_anthropic() -> bool:
    return bool(ANTHROPIC_API_KEY) and ANTHROPIC_API_KEY.startswith("sk-ant-")
```

Update `backend/app/clients/openai_client.py`:
```python
async def ping_openai() -> bool:
    return bool(OPENAI_API_KEY) and OPENAI_API_KEY.startswith("sk-")
```

- [ ] **Step 8: Run the full suite**

```bash
cd backend && pytest -v
```

Expected: ALL PASS (test_health + test_summary + test_transcribe).

- [ ] **Step 9: Commit**

```bash
git add backend/
git commit -m "feat(backend): /transcribe via Whisper, /health key-shape probe"
```

---

## Task 4: Mobile bootstrap + theme tokens (variant C)

**Files:**
- Create: `mobile/` via `npx create-expo-app`
- Replace: `mobile/app/index.tsx` (placeholder)
- Create: `mobile/lib/theme.ts`
- Create: `mobile/lib/id.ts`
- Create: `mobile/lib/dates.ts`
- Create: `mobile/lib/__tests__/dates.test.ts`
- Create: `mobile/jest.config.js`
- Modify: `mobile/package.json`
- Modify: `mobile/tsconfig.json`
- Modify: `mobile/app.config.ts` (rename from app.json)

- [ ] **Step 1: Initialize the Expo project**

```bash
cd /workspace
npx create-expo-app@latest mobile --template default
```

Answer the interactive prompts: project name `classroom-log`. The default template uses Expo Router and TypeScript.

- [ ] **Step 2: Install runtime deps**

```bash
cd mobile
npx expo install expo-sqlite expo-audio expo-router expo-status-bar expo-haptics @expo-google-fonts/source-serif-4 @expo-google-fonts/source-sans-3 expo-font expo-splash-screen react-native-safe-area-context react-native-screens
```

- [ ] **Step 3: Install dev deps**

```bash
npm install --save-dev jest jest-expo @types/jest @testing-library/react-native @testing-library/jest-native
```

- [ ] **Step 4: Configure jest**

`mobile/jest.config.js`:
```js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEach: [],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|expo-router|expo-sqlite|expo-audio))',
  ],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  collectCoverageFrom: ['**/*.{ts,tsx}', '!**/node_modules/**', '!**/babel.config.js', '!**/jest.config.js'],
};
```

Add to `mobile/package.json` scripts:
```json
"scripts": {
  "start": "expo start --tunnel",
  "test": "jest --watchAll=false",
  "test:watch": "jest --watchAll",
  "typecheck": "tsc --noEmit"
}
```

- [ ] **Step 5: Verify the bootstrap with a typecheck and a no-op jest run**

```bash
cd mobile
npx tsc --noEmit
npx jest --passWithNoTests
```

Expected: both exit 0.

- [ ] **Step 6: Write the theme tokens**

`mobile/lib/theme.ts`:
```ts
export const colors = {
  bg: '#FAF6EE',
  surface: '#FFFCF5',
  surface2: '#F4EFE2',
  ink: '#2A2620',
  inkMuted: '#807366',
  border: '#E8DFCB',
  accent: '#C4543B',        // terracotta — primary action
  accent2: '#7B9A66',       // sage — secondary action / success
  accentSoft: '#F4D9CF',
  accentText: '#FFFCF5',
  danger: '#B23A2A',
} as const;

export const radii = { sm: 10, md: 16, lg: 22 } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const fonts = {
  heading: 'SourceSerif4_600SemiBold',
  headingItalic: 'SourceSerif4_400Regular_Italic',
  body: 'SourceSans3_400Regular',
  bodyBold: 'SourceSans3_600SemiBold',
} as const;

export const shadows = {
  soft: {
    shadowColor: '#C4543B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
};
```

- [ ] **Step 7: Write tiny utilities**

`mobile/lib/id.ts`:
```ts
import * as Crypto from 'expo-crypto';

export function uuid(): string {
  return Crypto.randomUUID();
}
```

Install: `npx expo install expo-crypto`.

`mobile/lib/dates.ts`:
```ts
/** Local-timezone YYYYMMDD string. Used as the DB query key for "day". */
export function localYmd(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/** Start-of-local-day in unix ms. */
export function localDayStartMs(ymd: string): number {
  const y = parseInt(ymd.slice(0, 4), 10);
  const m = parseInt(ymd.slice(4, 6), 10) - 1;
  const d = parseInt(ymd.slice(6, 8), 10);
  return new Date(y, m, d, 0, 0, 0, 0).getTime();
}

/** End-of-local-day in unix ms (exclusive). */
export function localDayEndMs(ymd: string): number {
  const y = parseInt(ymd.slice(0, 4), 10);
  const m = parseInt(ymd.slice(4, 6), 10) - 1;
  const d = parseInt(ymd.slice(6, 8), 10);
  return new Date(y, m, d + 1, 0, 0, 0, 0).getTime();
}

/** "9:42 AM" format. */
export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
```

- [ ] **Step 8: Write the failing tests for dates**

`mobile/lib/__tests__/dates.test.ts`:
```ts
import { localYmd, localDayStartMs, localDayEndMs, formatTime } from '../dates';

describe('localYmd', () => {
  it('formats local date as YYYYMMDD', () => {
    const d = new Date(2026, 4, 26, 14, 30); // May 26, 2026 local
    expect(localYmd(d)).toBe('20260526');
  });
  it('pads single-digit months and days', () => {
    const d = new Date(2026, 0, 5, 0, 0);
    expect(localYmd(d)).toBe('20260105');
  });
});

describe('localDay bounds', () => {
  it('start is midnight, end is exclusive next midnight', () => {
    const start = localDayStartMs('20260526');
    const end = localDayEndMs('20260526');
    expect(end - start).toBe(24 * 60 * 60 * 1000);
    expect(new Date(start).getHours()).toBe(0);
  });
});
```

- [ ] **Step 9: Run the tests to verify they pass**

```bash
cd mobile && npm test -- dates
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): Expo bootstrap, theme tokens (variant C), date utils + tests"
```

---

## Task 5: SQLite — schema + students CRUD

**Files:**
- Create: `mobile/db/migrations.ts`
- Create: `mobile/db/db.ts`
- Create: `mobile/db/__tests__/db.test.ts`

The DB module is the single owner of schema, migrations, and SQL queries. No SQL leaks into screens.

- [ ] **Step 1: Write the failing test for student CRUD**

`mobile/db/__tests__/db.test.ts`:
```ts
import * as SQLite from 'expo-sqlite';
import { initDb, listActiveStudents, addStudent, archiveStudent, setStudentVoiceAllowed } from '../db';

let db: SQLite.SQLiteDatabase;

beforeEach(async () => {
  db = await SQLite.openDatabaseAsync(':memory:');
  await initDb(db);
});

afterEach(async () => {
  await db.closeAsync();
});

describe('students', () => {
  it('inserts and lists active students', async () => {
    await addStudent(db, { name: 'Alex M.' });
    await addStudent(db, { name: 'Casey B.' });
    const rows = await listActiveStudents(db);
    expect(rows.map(r => r.name).sort()).toEqual(['Alex M.', 'Casey B.']);
  });

  it('archives a student without deleting their notes', async () => {
    const { id } = await addStudent(db, { name: 'Sam R.' });
    await archiveStudent(db, id);
    const rows = await listActiveStudents(db);
    expect(rows).toEqual([]);
    // Direct row still exists with archived_at set
    const all = await db.getAllAsync<{ id: string; archived_at: number | null }>('SELECT id, archived_at FROM students');
    expect(all.length).toBe(1);
    expect(all[0].archived_at).not.toBeNull();
  });

  it('toggles per-student voice allowed', async () => {
    const { id } = await addStudent(db, { name: 'Quinn T.' });
    await setStudentVoiceAllowed(db, id, false);
    const [row] = await listActiveStudents(db);
    expect(row.recording_enabled).toBe(0);
  });

  it('enforces PRAGMA foreign_keys on every connection', async () => {
    const r = await db.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys');
    expect(r?.foreign_keys).toBe(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd mobile && npm test -- db
```

Expected: FAIL — `../db` not found.

- [ ] **Step 3: Write the migrations module**

`mobile/db/migrations.ts`:
```ts
import * as SQLite from 'expo-sqlite';

const TARGET_VERSION = 1;

const MIGRATIONS: Record<number, string> = {
  1: `
    CREATE TABLE students (
      id                 TEXT PRIMARY KEY,
      name               TEXT NOT NULL,
      recording_enabled  INTEGER NOT NULL DEFAULT 1,
      archived_at        INTEGER,
      created_at         INTEGER NOT NULL
    );
    CREATE TABLE notes (
      id          TEXT PRIMARY KEY,
      student_id  TEXT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
      text        TEXT NOT NULL,
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL
    );
    CREATE INDEX idx_notes_student_created ON notes(student_id, created_at, id);
    CREATE INDEX idx_notes_created ON notes(created_at, id);
    CREATE TABLE settings (
      key    TEXT PRIMARY KEY,
      value  TEXT NOT NULL
    );
  `,
};

export async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const current = (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;
  for (let v = current + 1; v <= TARGET_VERSION; v++) {
    const sql = MIGRATIONS[v];
    if (!sql) throw new Error(`No migration for version ${v}`);
    await db.execAsync(sql);
    await db.execAsync(`PRAGMA user_version = ${v}`);
  }
}
```

- [ ] **Step 4: Write the db module**

`mobile/db/db.ts`:
```ts
import * as SQLite from 'expo-sqlite';
import { migrate } from './migrations';
import { uuid } from '../lib/id';

export interface Student {
  id: string;
  name: string;
  recording_enabled: number; // 0 | 1
  archived_at: number | null;
  created_at: number;
}

export interface Note {
  id: string;
  student_id: string;
  text: string;
  created_at: number;
  updated_at: number;
}

export async function initDb(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON');
  await migrate(db);
}

export async function openAppDb(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync('classroom-log.db');
  await initDb(db);
  return db;
}

// ---- Students -------------------------------------------------------------

export async function addStudent(db: SQLite.SQLiteDatabase, { name }: { name: string }): Promise<{ id: string }> {
  const id = uuid();
  const now = Date.now();
  await db.runAsync(
    'INSERT INTO students (id, name, recording_enabled, archived_at, created_at) VALUES (?, ?, 1, NULL, ?)',
    id, name.trim(), now
  );
  return { id };
}

export async function listActiveStudents(db: SQLite.SQLiteDatabase): Promise<Student[]> {
  return db.getAllAsync<Student>(
    'SELECT id, name, recording_enabled, archived_at, created_at FROM students WHERE archived_at IS NULL ORDER BY created_at ASC'
  );
}

export async function archiveStudent(db: SQLite.SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('UPDATE students SET archived_at = ? WHERE id = ?', Date.now(), id);
}

export async function setStudentVoiceAllowed(db: SQLite.SQLiteDatabase, id: string, allowed: boolean): Promise<void> {
  await db.runAsync('UPDATE students SET recording_enabled = ? WHERE id = ?', allowed ? 1 : 0, id);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd mobile && npm test -- db
```

Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add mobile/db/ mobile/lib/id.ts
git commit -m "feat(mobile): SQLite migrations + students CRUD with TDD"
```

---

## Task 6: SQLite — notes CRUD + settings CRUD

**Files:**
- Modify: `mobile/db/db.ts`
- Modify: `mobile/db/__tests__/db.test.ts`

- [ ] **Step 1: Write the failing tests for notes and settings**

Append to `mobile/db/__tests__/db.test.ts`:
```ts
import {
  addNote, updateNote, deleteNote, getNote, moveNote,
  getNotesForLocalDate, getNotesForStudentInLocalRange,
  getSetting, setSetting,
} from '../db';

describe('notes', () => {
  it('inserts a note and retrieves it', async () => {
    const { id: sid } = await addStudent(db, { name: 'Alex' });
    const { id: nid } = await addNote(db, { studentId: sid, text: 'Morning was focused.' });
    const got = await getNote(db, nid);
    expect(got?.text).toBe('Morning was focused.');
    expect(got?.student_id).toBe(sid);
    expect(got?.created_at).toBe(got?.updated_at);
  });

  it('updates a note and bumps updated_at', async () => {
    const { id: sid } = await addStudent(db, { name: 'Alex' });
    const { id: nid } = await addNote(db, { studentId: sid, text: 'first' });
    const before = await getNote(db, nid);
    await new Promise(r => setTimeout(r, 5));
    await updateNote(db, nid, 'second');
    const after = await getNote(db, nid);
    expect(after?.text).toBe('second');
    expect(after!.updated_at).toBeGreaterThan(before!.updated_at);
    expect(after!.created_at).toBe(before!.created_at);
  });

  it('deletes a note', async () => {
    const { id: sid } = await addStudent(db, { name: 'Alex' });
    const { id: nid } = await addNote(db, { studentId: sid, text: 'gone' });
    await deleteNote(db, nid);
    expect(await getNote(db, nid)).toBeNull();
  });

  it('moves a note between students', async () => {
    const { id: sid1 } = await addStudent(db, { name: 'Alex' });
    const { id: sid2 } = await addStudent(db, { name: 'Casey' });
    const { id: nid } = await addNote(db, { studentId: sid1, text: 'mis-tap' });
    await moveNote(db, nid, sid2);
    const got = await getNote(db, nid);
    expect(got?.student_id).toBe(sid2);
  });

  it('lists today\'s notes for a date in local time', async () => {
    const { id: sid } = await addStudent(db, { name: 'Alex' });
    await addNote(db, { studentId: sid, text: 'today' });
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const ymd = `${y}${m}${d}`;
    const rows = await getNotesForLocalDate(db, ymd);
    expect(rows.length).toBe(1);
    expect(rows[0].text).toBe('today');
  });

  it('refuses to delete a student that has notes (RESTRICT)', async () => {
    const { id: sid } = await addStudent(db, { name: 'Alex' });
    await addNote(db, { studentId: sid, text: 'note' });
    await expect(db.runAsync('DELETE FROM students WHERE id = ?', sid)).rejects.toThrow();
  });
});

describe('settings', () => {
  it('returns null for missing keys', async () => {
    expect(await getSetting(db, 'nope')).toBeNull();
  });

  it('round-trips values', async () => {
    await setSetting(db, 'voice_on', '1');
    expect(await getSetting(db, 'voice_on')).toBe('1');
    await setSetting(db, 'voice_on', '0');
    expect(await getSetting(db, 'voice_on')).toBe('0');
  });

  it('upserts (no duplicate-key errors)', async () => {
    await setSetting(db, 'k', 'v1');
    await setSetting(db, 'k', 'v2');
    expect(await getSetting(db, 'k')).toBe('v2');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd mobile && npm test -- db
```

Expected: FAIL (notes and settings functions don't exist).

- [ ] **Step 3: Implement the notes and settings functions**

Append to `mobile/db/db.ts`:
```ts
// ---- Notes ---------------------------------------------------------------

export async function addNote(db: SQLite.SQLiteDatabase, { studentId, text }: { studentId: string; text: string }): Promise<{ id: string }> {
  const id = uuid();
  const now = Date.now();
  await db.runAsync(
    'INSERT INTO notes (id, student_id, text, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    id, studentId, text, now, now
  );
  return { id };
}

export async function getNote(db: SQLite.SQLiteDatabase, id: string): Promise<Note | null> {
  const row = await db.getFirstAsync<Note>('SELECT * FROM notes WHERE id = ?', id);
  return row ?? null;
}

export async function updateNote(db: SQLite.SQLiteDatabase, id: string, text: string): Promise<void> {
  await db.runAsync('UPDATE notes SET text = ?, updated_at = ? WHERE id = ?', text, Date.now(), id);
}

export async function deleteNote(db: SQLite.SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM notes WHERE id = ?', id);
}

export async function moveNote(db: SQLite.SQLiteDatabase, noteId: string, newStudentId: string): Promise<void> {
  await db.runAsync('UPDATE notes SET student_id = ?, updated_at = ? WHERE id = ?', newStudentId, Date.now(), noteId);
}

export async function getNotesForLocalDate(db: SQLite.SQLiteDatabase, ymd: string): Promise<Array<Note & { student_name: string }>> {
  const { localDayStartMs, localDayEndMs } = await import('../lib/dates');
  const start = localDayStartMs(ymd);
  const end = localDayEndMs(ymd);
  return db.getAllAsync(
    `SELECT n.*, s.name AS student_name
       FROM notes n
       JOIN students s ON s.id = n.student_id
      WHERE n.created_at >= ? AND n.created_at < ?
      ORDER BY n.created_at ASC, n.id ASC`,
    start, end
  );
}

export async function getNotesForStudentInLocalRange(
  db: SQLite.SQLiteDatabase,
  studentId: string,
  fromYmd: string,
  toYmd: string
): Promise<Note[]> {
  const { localDayStartMs, localDayEndMs } = await import('../lib/dates');
  const start = localDayStartMs(fromYmd);
  const end = localDayEndMs(toYmd);
  return db.getAllAsync<Note>(
    `SELECT * FROM notes
      WHERE student_id = ? AND created_at >= ? AND created_at < ?
      ORDER BY created_at ASC, id ASC`,
    studentId, start, end
  );
}

// ---- Settings ------------------------------------------------------------

export async function getSetting(db: SQLite.SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setSetting(db: SQLite.SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key, value
  );
}
```

- [ ] **Step 4: Run all db tests**

```bash
cd mobile && npm test -- db
```

Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/db/
git commit -m "feat(mobile): notes CRUD + settings CRUD + RESTRICT-cascade test"
```

---

## Task 7: Onboarding screen + permission preflight

**Files:**
- Create: `mobile/app/onboarding.tsx`
- Modify: `mobile/app/_layout.tsx` (route on first launch)
- Create: `mobile/components/PrimaryButton.tsx`

- [ ] **Step 1: Write PrimaryButton (used by onboarding and elsewhere)**

`mobile/components/PrimaryButton.tsx`:
```tsx
import { Pressable, Text, StyleSheet, View } from 'react-native';
import { colors, radii, spacing, fonts, shadows } from '../lib/theme';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
}

export function PrimaryButton({ label, onPress, variant = 'primary', disabled }: Props) {
  const bg = variant === 'primary' ? colors.accent : variant === 'secondary' ? colors.accent2 : 'transparent';
  const fg = variant === 'ghost' ? colors.ink : colors.accentText;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        variant === 'ghost' && { borderWidth: 1, borderColor: colors.border },
        variant !== 'ghost' && shadows.soft,
      ]}
    >
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontFamily: fonts.bodyBold, fontSize: 15 },
});
```

- [ ] **Step 2: Write the onboarding screen**

`mobile/app/onboarding.tsx`:
```tsx
import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Audio } from 'expo-audio';
import { useSQLiteContext } from 'expo-sqlite';
import { setSetting } from '../db/db';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, fonts, spacing } from '../lib/theme';

export default function Onboarding() {
  const router = useRouter();
  const db = useSQLiteContext();
  const [micGranted, setMicGranted] = useState(false);

  async function requestMic() {
    const status = await Audio.requestRecordingPermissionsAsync();
    setMicGranted(status.granted);
    if (!status.granted) {
      Alert.alert(
        'Mic disabled',
        'Voice capture will be unavailable. You can still type notes. Enable the microphone for this app in iOS or Android Settings later.',
      );
    }
  }

  async function continueToApp() {
    await setSetting(db, 'onboarding_complete', '1');
    router.replace('/');
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Welcome to Classroom Log</Text>
      <Text style={styles.paragraph}>
        A note-taking tool for special-education teachers. Tap a student, speak or type, save. Then let Claude draft a daily summary for review.
      </Text>

      <Text style={styles.subhead}>What stays on the phone</Text>
      <Text style={styles.paragraph}>
        Typed notes, transcribed text, settings, and your roster all live in a local database on this device only.
      </Text>

      <Text style={styles.subhead}>What goes to the laptop</Text>
      <Text style={styles.paragraph}>
        When you record a voice note, audio bytes are sent to the builder's laptop just long enough to transcribe; nothing is written to disk. When you generate a summary, the note text is sent to the laptop for Claude. Nothing is retained after each request returns.
      </Text>

      <Text style={styles.subhead}>What goes to third parties</Text>
      <Text style={styles.paragraph}>
        Audio bytes are sent to OpenAI Whisper for transcription; note text is sent to Anthropic Claude for summaries. Both services state they do not retain API inputs for training.
      </Text>

      <View style={styles.actions}>
        <PrimaryButton
          label={micGranted ? 'Microphone allowed' : 'Allow microphone'}
          onPress={requestMic}
          variant={micGranted ? 'secondary' : 'primary'}
          disabled={micGranted}
        />
        <View style={{ height: spacing.md }} />
        <PrimaryButton label="Start using the app" onPress={continueToApp} variant="primary" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.bg, flex: 1 },
  content: { padding: spacing.xl, paddingTop: spacing.xxl },
  heading: { fontFamily: fonts.heading, fontSize: 28, color: colors.ink, marginBottom: spacing.lg },
  subhead: { fontFamily: fonts.headingItalic, fontSize: 16, color: colors.ink, marginTop: spacing.lg, marginBottom: spacing.xs },
  paragraph: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink, marginBottom: spacing.md },
  actions: { marginTop: spacing.xl, marginBottom: spacing.xxl },
});
```

- [ ] **Step 3: Wire the root layout to provide the DB and route on first launch**

Replace `mobile/app/_layout.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts, SourceSerif4_600SemiBold, SourceSerif4_400Regular_Italic } from '@expo-google-fonts/source-serif-4';
import { SourceSans3_400Regular, SourceSans3_600SemiBold } from '@expo-google-fonts/source-sans-3';
import { View, ActivityIndicator } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { migrate } from '../db/migrations';
import { getSetting } from '../db/db';
import { colors } from '../lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

async function onDbInit(db: any) {
  await db.execAsync('PRAGMA foreign_keys = ON');
  await migrate(db);
}

function RouterGate({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const router = useRouter();
  const segments = useSegments();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const done = await getSetting(db, 'onboarding_complete');
      const inOnboarding = segments[0] === 'onboarding';
      if (done !== '1' && !inOnboarding) {
        router.replace('/onboarding');
      }
      setReady(true);
      SplashScreen.hideAsync().catch(() => {});
    })();
  }, [db]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}><ActivityIndicator /></View>;
  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SourceSerif4_600SemiBold,
    SourceSerif4_400Regular_Italic,
    SourceSans3_400Regular,
    SourceSans3_600SemiBold,
  });

  if (!fontsLoaded) return null;

  return (
    <SQLiteProvider databaseName="classroom-log.db" onInit={onDbInit}>
      <RouterGate>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
      </RouterGate>
    </SQLiteProvider>
  );
}
```

- [ ] **Step 4: Smoke-run on the simulator/device**

```bash
cd mobile && npm start -- --tunnel
```

Scan QR with Expo Go. Expected: app opens at onboarding screen, three sections rendered with serif headings and sans body, both buttons visible.

- [ ] **Step 5: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): onboarding screen with privacy disclosure and mic preflight"
```

---

## Task 8: Home screen (roster, status pill, FAB) — wired to real DB

**Files:**
- Create: `mobile/components/StudentTile.tsx`
- Create: `mobile/components/NoteRow.tsx`
- Create: `mobile/components/StatusPill.tsx`
- Replace: `mobile/app/index.tsx`

- [ ] **Step 1: StudentTile component**

`mobile/components/StudentTile.tsx`:
```tsx
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { colors, radii, spacing, fonts, shadows } from '../lib/theme';

const DOT_COLORS = ['#C4543B', '#7B9A66', '#E6A547', '#6B8FAD', '#9A6B96', '#C4543B', '#7B9A66', '#E6A547'];

interface Props {
  name: string;
  index: number;
  onPress: () => void;
}

export function StudentTile({ name, index, onPress }: Props) {
  const dotColor = DOT_COLORS[index % DOT_COLORS.length];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Log a note for ${name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, shadows.soft, pressed && { opacity: 0.85 }]}
    >
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={styles.label} numberOfLines={1}>{name}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexBasis: '48%',
    flexGrow: 0,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { fontFamily: fonts.heading, fontSize: 16, color: colors.ink, flexShrink: 1 },
});
```

- [ ] **Step 2: NoteRow component**

`mobile/components/NoteRow.tsx`:
```tsx
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { colors, radii, spacing, fonts, shadows } from '../lib/theme';
import { formatTime } from '../lib/dates';

interface Props {
  studentName: string;
  text: string;
  createdAt: number;
  onPress: () => void;
}

export function NoteRow({ studentName, text, createdAt, onPress }: Props) {
  const preview = text.length > 80 ? text.slice(0, 80).trim() + '…' : text;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, shadows.soft, pressed && { opacity: 0.85 }]}>
      <View style={styles.meta}>
        <Text style={styles.time}>{formatTime(createdAt)}</Text>
        <Text style={styles.name}>{studentName}</Text>
      </View>
      <Text style={styles.body}>{preview}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  time: { fontFamily: fonts.headingItalic, fontSize: 12, color: colors.inkMuted },
  name: { fontFamily: fonts.headingItalic, fontSize: 12, color: colors.inkMuted },
  body: { fontFamily: fonts.body, fontSize: 13, color: colors.ink, lineHeight: 18 },
});
```

- [ ] **Step 3: StatusPill component**

`mobile/components/StatusPill.tsx`:
```tsx
import { Text, View, StyleSheet } from 'react-native';
import { colors, radii, fonts } from '../lib/theme';

interface Props {
  ok: boolean;
}

export function StatusPill({ ok }: Props) {
  return (
    <View style={[styles.pill, { backgroundColor: ok ? colors.accentSoft : '#EEE2DD' }]}>
      <View style={[styles.dot, { backgroundColor: ok ? colors.accent2 : colors.inkMuted }]} />
      <Text style={[styles.label, { color: ok ? colors.accent : colors.inkMuted }]}>{ok ? 'AI: connected' : 'AI: offline'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontFamily: fonts.body, fontSize: 11 },
});
```

- [ ] **Step 4: Home screen**

Replace `mobile/app/index.tsx`:
```tsx
import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Pressable } from 'react-native';
import { useRouter, useFocusEffect, Link } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listActiveStudents, getNotesForLocalDate, getSetting, setSetting, Student } from '../db/db';
import { StudentTile } from '../components/StudentTile';
import { NoteRow } from '../components/NoteRow';
import { StatusPill } from '../components/StatusPill';
import { colors, fonts, spacing, radii } from '../lib/theme';
import { localYmd } from '../lib/dates';

export default function Home() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [voiceOn, setVoiceOn] = useState(true);

  const reload = useCallback(async () => {
    setStudents(await listActiveStudents(db));
    setNotes(await getNotesForLocalDate(db, localYmd()));
    setVoiceOn((await getSetting(db, 'voice_on')) !== '0');
  }, [db]);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  async function toggleVoice(next: boolean) {
    setVoiceOn(next);
    await setSetting(db, 'voice_on', next ? '1' : '0');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <View style={styles.topBar}>
          <Text style={styles.title}>Classroom Log</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <StatusPill ok={true /* wired up in Task 15 */} />
            <Link href="/settings" asChild>
              <Pressable accessibilityRole="button" accessibilityLabel="Settings">
                <Text style={{ fontSize: 20 }}>⚙</Text>
              </Pressable>
            </Link>
          </View>
        </View>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Voice off</Text>
          <Switch value={!voiceOn} onValueChange={(v) => toggleVoice(!v)} />
        </View>

        <Text style={styles.sectionHead}>Roster</Text>
        {students.length === 0 ? (
          <Text style={styles.empty}>No students yet. Add your first one in Settings.</Text>
        ) : (
          <View style={styles.grid}>
            {students.map((s, i) => (
              <StudentTile key={s.id} name={s.name} index={i} onPress={() => router.push(`/note/${s.id}`)} />
            ))}
          </View>
        )}

        <Text style={styles.sectionHead}>Today's notes</Text>
        {notes.length === 0 ? (
          <Text style={styles.empty}>No notes today yet.</Text>
        ) : (
          notes.map((n) => (
            <NoteRow key={n.id} studentName={n.student_name} text={n.text} createdAt={n.created_at} onPress={() => router.push(`/note/${n.student_id}?noteId=${n.id}`)} />
          ))
        )}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Generate summary"
        onPress={() => router.push('/summary')}
        style={({ pressed }) => [styles.fab, { opacity: pressed ? 0.85 : 1 }]}
      >
        <Text style={styles.fabLabel}>＋ Generate Summary</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: spacing.md, borderBottomWidth: 1, borderColor: colors.border },
  title: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md },
  rowLabel: { fontFamily: fonts.headingItalic, fontSize: 14, color: colors.ink },
  sectionHead: { fontFamily: fonts.headingItalic, fontSize: 14, color: colors.ink, marginTop: spacing.lg, marginBottom: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  empty: { fontFamily: fonts.body, fontSize: 13, color: colors.inkMuted, marginBottom: spacing.md },
  fab: { position: 'absolute', bottom: spacing.xl, right: spacing.xl, backgroundColor: colors.accent, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radii.lg, shadowColor: colors.accent, shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  fabLabel: { fontFamily: fonts.bodyBold, color: colors.accentText, fontSize: 14 },
});
```

- [ ] **Step 5: Smoke-run**

```bash
cd mobile && npm start -- --tunnel
```

Expected: navigate from onboarding to Home; empty state shows since no students yet. Voice toggle works.

- [ ] **Step 6: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): Home screen with roster, notes list, status pill, FAB"
```

---

## Task 9: Settings screen (roster CRUD, API URL, LLM toggle, demo reset)

**Files:**
- Create: `mobile/app/settings.tsx`

- [ ] **Step 1: Write the Settings screen**

`mobile/app/settings.tsx`:
```tsx
import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, Switch, Alert, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listActiveStudents, addStudent, archiveStudent, setStudentVoiceAllowed, getSetting, setSetting, Student } from '../db/db';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, fonts, spacing, radii, shadows } from '../lib/theme';
import Constants from 'expo-constants';

const DEFAULT_API = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://example.ngrok.app';

export default function Settings() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [newName, setNewName] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [llmEnabled, setLlmEnabled] = useState(true);
  const [healthStatus, setHealthStatus] = useState<string>('not tested');

  const reload = useCallback(async () => {
    setStudents(await listActiveStudents(db));
    setApiUrl((await getSetting(db, 'api_base_url')) || DEFAULT_API);
    setLlmEnabled((await getSetting(db, 'llm_enabled')) !== '0');
  }, [db]);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const counts = students.reduce<Record<string, number>>((acc, s) => {
    acc[s.name] = (acc[s.name] || 0) + 1;
    return acc;
  }, {});

  async function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await addStudent(db, { name: trimmed });
    setNewName('');
    reload();
  }

  function confirmArchive(s: Student) {
    Alert.alert(
      `Archive ${s.name}?`,
      'Their notes remain in the database. They no longer appear in the roster.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Archive', style: 'destructive', onPress: async () => { await archiveStudent(db, s.id); reload(); } },
      ],
    );
  }

  async function saveApiUrl() {
    await setSetting(db, 'api_base_url', apiUrl.trim());
    Alert.alert('Saved', 'API base URL updated.');
  }

  async function testConnection() {
    try {
      setHealthStatus('checking…');
      const r = await fetch(`${apiUrl.trim()}/health`, { method: 'GET' });
      const body = await r.json();
      setHealthStatus(body.ok ? 'connected' : `degraded (anthropic=${body.anthropic_ok}, openai=${body.openai_ok})`);
    } catch (e: any) {
      setHealthStatus(`error: ${e.message}`);
    }
  }

  function confirmReset() {
    Alert.alert(
      'Reset demo data?',
      'All students and notes will be permanently deleted from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await db.execAsync('DELETE FROM notes; DELETE FROM students; DELETE FROM settings WHERE key NOT IN (\'onboarding_complete\', \'api_base_url\')');
            reload();
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl * 2 }}>
        <Pressable onPress={() => router.back()} style={{ marginBottom: spacing.md }}>
          <Text style={{ fontFamily: fonts.body, color: colors.accent }}>← Back</Text>
        </Pressable>
        <Text style={styles.h1}>Settings</Text>

        <Text style={styles.sectionHead}>Students</Text>
        <View style={styles.addRow}>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="Student name"
            placeholderTextColor={colors.inkMuted}
            style={styles.input}
            onSubmitEditing={handleAdd}
            returnKeyType="done"
          />
          <PrimaryButton label="Add" onPress={handleAdd} variant="primary" />
        </View>
        {students.map((s) => (
          <View key={s.id} style={styles.studentRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.studentName}>{s.name}</Text>
              {counts[s.name] > 1 && <Text style={styles.warn}>⚠ duplicate name</Text>}
            </View>
            <Switch
              value={s.recording_enabled === 1}
              onValueChange={async (v) => { await setStudentVoiceAllowed(db, s.id, v); reload(); }}
            />
            <Pressable onPress={() => confirmArchive(s)} style={styles.archiveBtn}>
              <Text style={{ color: colors.danger, fontFamily: fonts.body }}>Archive</Text>
            </Pressable>
          </View>
        ))}

        <Text style={styles.sectionHead}>AI</Text>
        <View style={styles.aiRow}>
          <Text style={styles.aiLabel}>Generate summaries with Claude</Text>
          <Switch value={llmEnabled} onValueChange={async (v) => { await setSetting(db, 'llm_enabled', v ? '1' : '0'); setLlmEnabled(v); }} />
        </View>

        <Text style={styles.sectionHead}>Server</Text>
        <TextInput value={apiUrl} onChangeText={setApiUrl} placeholder="https://your-tunnel.ngrok.app" autoCapitalize="none" style={styles.input} />
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
          <View style={{ flex: 1 }}><PrimaryButton label="Save URL" onPress={saveApiUrl} variant="secondary" /></View>
          <View style={{ flex: 1 }}><PrimaryButton label="Test connection" onPress={testConnection} variant="ghost" /></View>
        </View>
        <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted, marginTop: spacing.sm }}>Status: {healthStatus}</Text>

        <Text style={styles.sectionHead}>Demo</Text>
        <PrimaryButton label="Reset demo data" onPress={confirmReset} variant="ghost" />

        <Text style={styles.sectionHead}>About</Text>
        <Text style={styles.aboutLine}>Version {Constants.expoConfig?.version ?? '0.1.0'}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: fonts.heading, fontSize: 26, color: colors.ink, marginBottom: spacing.md },
  sectionHead: { fontFamily: fonts.headingItalic, fontSize: 14, color: colors.ink, marginTop: spacing.xl, marginBottom: spacing.sm },
  addRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginBottom: spacing.md },
  input: { flex: 1, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontFamily: fonts.body, color: colors.ink, fontSize: 14, ...shadows.soft },
  studentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  studentName: { fontFamily: fonts.heading, fontSize: 15, color: colors.ink },
  warn: { fontFamily: fonts.body, fontSize: 11, color: colors.danger, marginTop: 2 },
  archiveBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  aiRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm },
  aiLabel: { fontFamily: fonts.body, fontSize: 14, color: colors.ink, flex: 1 },
  aboutLine: { fontFamily: fonts.body, fontSize: 13, color: colors.inkMuted },
});
```

- [ ] **Step 2: Smoke-run**

Expected: navigate from Home → Settings. Add 2 students. Toggle one off. Try archive flow. Test connection (will likely fail until the backend tunnel is set up — that's expected at this stage).

- [ ] **Step 3: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): Settings screen — roster, AI toggle, server URL, demo reset"
```

---

## Task 10: Note capture modal (text path only — voice deferred to Task 14)

**Files:**
- Create: `mobile/app/note/[studentId].tsx`
- Create: `mobile/components/DiscardSheet.tsx`

The voice/mic button is wired with a placeholder onPress that we'll wire in Task 14. The text path is fully working.

- [ ] **Step 1: DiscardSheet component**

`mobile/components/DiscardSheet.tsx`:
```tsx
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { PrimaryButton } from './PrimaryButton';
import { colors, fonts, spacing, radii } from '../lib/theme';

interface Props {
  visible: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onKeepEditing: () => void;
}

export function DiscardSheet({ visible, onSave, onDiscard, onKeepEditing }: Props) {
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onKeepEditing}>
      <Pressable style={styles.backdrop} onPress={onKeepEditing} />
      <View style={styles.sheet}>
        <Text style={styles.heading}>You have unsaved changes</Text>
        <Text style={styles.body}>Save this note, discard it, or keep editing?</Text>
        <View style={styles.actions}>
          <PrimaryButton label="Save" onPress={onSave} variant="primary" />
          <View style={{ height: spacing.sm }} />
          <PrimaryButton label="Discard" onPress={onDiscard} variant="ghost" />
          <View style={{ height: spacing.sm }} />
          <PrimaryButton label="Keep editing" onPress={onKeepEditing} variant="secondary" />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', inset: 0 as any, backgroundColor: 'rgba(42, 38, 32, .4)' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.bg, padding: spacing.xl, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg },
  heading: { fontFamily: fonts.heading, fontSize: 18, color: colors.ink, marginBottom: spacing.xs },
  body: { fontFamily: fonts.body, fontSize: 14, color: colors.inkMuted, marginBottom: spacing.lg },
  actions: { gap: 0 },
});
```

- [ ] **Step 2: Note modal route**

`mobile/app/note/[studentId].tsx`:
```tsx
import { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addNote, updateNote, deleteNote, getNote, listActiveStudents, getSetting, Student } from '../../db/db';
import { DiscardSheet } from '../../components/DiscardSheet';
import { colors, fonts, spacing, radii, shadows } from '../../lib/theme';

const MAX_LEN = 5000;

export default function NoteModal() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { studentId, noteId } = useLocalSearchParams<{ studentId: string; noteId?: string }>();
  const [student, setStudent] = useState<Student | null>(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const [text, setText] = useState('');
  const [initialText, setInitialText] = useState('');
  const [discardVisible, setDiscardVisible] = useState(false);

  useEffect(() => {
    (async () => {
      const all = await listActiveStudents(db);
      const s = all.find(x => x.id === studentId);
      setStudent(s || null);
      setVoiceOn((await getSetting(db, 'voice_on')) !== '0');
      if (noteId) {
        const n = await getNote(db, noteId);
        if (n) {
          setText(n.text);
          setInitialText(n.text);
        }
      }
    })();
  }, [studentId, noteId, db]);

  const dirty = text !== initialText;
  const editing = !!noteId;

  function handleClose() {
    if (dirty && text.trim()) setDiscardVisible(true);
    else router.back();
  }

  async function handleSave() {
    if (!text.trim()) return;
    if (noteId) await updateNote(db, noteId, text);
    else if (student) await addNote(db, { studentId: student.id, text });
    router.back();
  }

  function handleDiscard() {
    setDiscardVisible(false);
    router.back();
  }

  async function handleDelete() {
    Alert.alert(
      'Delete this note?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => { if (noteId) { await deleteNote(db, noteId); router.back(); } } },
      ],
    );
  }

  const micAllowed = voiceOn && student?.recording_enabled === 1;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.header}>
        <Text style={styles.title}>{student?.name ?? 'Note'}</Text>
        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={micAllowed ? 'Voice enabled' : 'Voice disabled'}
            disabled={!micAllowed}
            style={[styles.micToggle, { backgroundColor: micAllowed ? colors.accentSoft : colors.surface2, opacity: micAllowed ? 1 : 0.5 }]}
          >
            <Text style={{ fontSize: 14 }}>🎙</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={handleClose}>
            <Text style={styles.x}>✕</Text>
          </Pressable>
        </View>
      </View>

      <TextInput
        autoFocus
        multiline
        value={text}
        onChangeText={(t) => setText(t.slice(0, MAX_LEN))}
        placeholder={micAllowed ? 'Type or tap the mic to dictate…' : 'Type your note…'}
        placeholderTextColor={colors.inkMuted}
        style={styles.textarea}
      />
      {text.length >= MAX_LEN && (
        <Text style={styles.capWarn}>Note is at the {MAX_LEN.toLocaleString()}-character limit.</Text>
      )}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start recording"
          disabled={!micAllowed}
          onPress={() => Alert.alert('Coming up next', 'Voice recording is wired in Task 14.')}
          style={[styles.mic, { backgroundColor: micAllowed ? colors.accent : colors.surface2, opacity: micAllowed ? 1 : 0.5 }]}
        >
          <Text style={styles.micIcon}>🎙</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={handleSave}
          disabled={!text.trim()}
          style={[styles.saveBtn, !text.trim() && { opacity: 0.5 }, shadows.soft]}
        >
          <Text style={styles.saveLabel}>{editing ? 'Update' : 'Save'}</Text>
        </Pressable>
      </View>

      {editing && (
        <Pressable onLongPress={handleDelete} delayLongPress={800} style={styles.deleteBtn}>
          <Text style={styles.deleteLabel}>Hold to delete</Text>
        </Pressable>
      )}

      <DiscardSheet
        visible={discardVisible}
        onSave={async () => { setDiscardVisible(false); await handleSave(); }}
        onDiscard={handleDiscard}
        onKeepEditing={() => setDiscardVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink },
  micToggle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  x: { fontSize: 22, color: colors.inkMuted },
  textarea: { flex: 1, padding: spacing.lg, fontFamily: fonts.body, fontSize: 16, color: colors.ink, textAlignVertical: 'top' },
  capWarn: { fontFamily: fonts.body, fontSize: 12, color: colors.danger, textAlign: 'center', paddingBottom: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, alignItems: 'center' },
  mic: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  micIcon: { fontSize: 24, color: colors.accentText },
  saveBtn: { flex: 1, backgroundColor: colors.accent2, paddingVertical: spacing.md, borderRadius: radii.md, alignItems: 'center' },
  saveLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.accentText },
  deleteBtn: { alignSelf: 'center', padding: spacing.md, marginBottom: spacing.lg },
  deleteLabel: { fontFamily: fonts.bodyItalic, fontSize: 13, color: colors.danger },
});
```

- [ ] **Step 3: Smoke-run end-to-end of the text path**

Expected:
- Home → tap student → modal opens with their name
- Type a note → tap Save → returns to Home → note appears in "Today's notes"
- Tap an existing note → modal opens in edit mode → edit + Update works
- Long-press "Hold to delete" → confirmation → note is removed
- Close with unsaved text → Discard sheet appears

- [ ] **Step 4: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): note capture modal (text path), discard sheet, edit/delete"
```

---

## Task 11: Summary screen (picker + Generate + four sections + Copy all)

**Files:**
- Create: `mobile/app/summary.tsx`
- Create: `mobile/api/client.ts`
- Create: `mobile/api/summary.ts`
- Create: `mobile/api/__tests__/api.test.ts`

- [ ] **Step 1: Write the failing test for the api/summary wrapper**

`mobile/api/__tests__/api.test.ts`:
```ts
import { fetchSummary } from '../summary';

describe('fetchSummary', () => {
  const url = 'https://example.test';
  const notes = [{ ts: 1, text: 'hi' }];

  it('returns {ok:true, sections} on a 200 response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ positives: 'p', concerns: 'c', patterns: 'pa', next_steps: 'n' }),
    } as any);
    const r = await fetchSummary(url, 'Alex', notes);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.sections.positives).toBe('p');
  });

  it('returns {ok:false, error} on a 4xx with error envelope', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { code: 'no_notes', message: 'No notes provided.' } }),
    } as any);
    const r = await fetchSummary(url, 'Alex', notes);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('no_notes');
  });

  it('returns a network_error on fetch rejection', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('net'));
    const r = await fetchSummary(url, 'Alex', notes);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('network_error');
  });

  it('aborts after 60s and returns timeout error', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn().mockImplementation((_url, opts) =>
      new Promise((_, reject) => {
        opts!.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      })
    );
    const promise = fetchSummary(url, 'Alex', notes);
    jest.advanceTimersByTime(60001);
    const r = await promise;
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('timeout');
    jest.useRealTimers();
  });
});
```

- [ ] **Step 2: Write the api/client and api/summary modules**

`mobile/api/client.ts`:
```ts
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

export async function callJson<T>(url: string, init: RequestInit, timeoutMs: number): Promise<ApiResult<T>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...init, signal: ctrl.signal });
    const body = await resp.json().catch(() => ({}));
    if (resp.ok) return { ok: true, data: body as T };
    const env = body?.error ?? { code: 'http_error', message: `HTTP ${resp.status}` };
    return { ok: false, error: env };
  } catch (e: any) {
    if (e?.name === 'AbortError') return { ok: false, error: { code: 'timeout', message: 'Request timed out' } };
    return { ok: false, error: { code: 'network_error', message: e?.message ?? 'Network error' } };
  } finally {
    clearTimeout(timer);
  }
}
```

`mobile/api/summary.ts`:
```ts
import { callJson, ApiResult } from './client';

export interface SummarySections {
  positives: string;
  concerns: string;
  patterns: string;
  next_steps: string;
}

export type SummaryResult =
  | { ok: true; sections: SummarySections }
  | { ok: false; error: { code: string; message: string } };

export async function fetchSummary(apiBaseUrl: string, studentName: string, notes: Array<{ ts: number; text: string }>): Promise<SummaryResult> {
  const r = await callJson<SummarySections>(
    `${apiBaseUrl.replace(/\/$/, '')}/summary`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_name: studentName, notes }),
    },
    60_000
  );
  if (r.ok) return { ok: true, sections: r.data };
  return { ok: false, error: r.error };
}
```

- [ ] **Step 3: Run the tests to verify they pass**

```bash
cd mobile && npm test -- api
```

Expected: PASS.

- [ ] **Step 4: Summary screen**

`mobile/app/summary.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { listActiveStudents, getNotesForStudentInLocalRange, getSetting, Student } from '../db/db';
import { fetchSummary, SummarySections } from '../api/summary';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, fonts, spacing, radii, shadows } from '../lib/theme';
import { localYmd } from '../lib/dates';

export default function Summary() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [ymd, setYmd] = useState<string>(localYmd());
  const [llmEnabled, setLlmEnabled] = useState(true);
  const [apiUrl, setApiUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<SummarySections | null>(null);
  const [rawNotes, setRawNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const list = await listActiveStudents(db);
      setStudents(list);
      setStudentId(list[0]?.id ?? null);
      setApiUrl((await getSetting(db, 'api_base_url')) || '');
      setLlmEnabled((await getSetting(db, 'llm_enabled')) !== '0');
    })();
  }, [db]);

  async function generate() {
    if (!studentId) return;
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    const notes = await getNotesForStudentInLocalRange(db, studentId, ymd, ymd);
    if (notes.length === 0) {
      Alert.alert('No notes', `No notes for ${student.name} on the selected day.`);
      return;
    }
    setRawNotes(notes.map(n => `${new Date(n.created_at).toLocaleTimeString()} — ${n.text}`).join('\n\n'));
    if (!llmEnabled) {
      setSections(null);
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    const r = await fetchSummary(apiUrl, student.name, notes.map(n => ({ ts: n.created_at, text: n.text })));
    setLoading(false);
    if (r.ok) setSections(r.sections);
    else setErrorMsg(`${r.error.code}: ${r.error.message}`);
  }

  async function copyAll() {
    if (!sections) {
      await Clipboard.setStringAsync(rawNotes);
      return;
    }
    const out = `Positives — Draft, review before sharing\n${sections.positives}\n\nConcerns — Draft, review before sharing\n${sections.concerns}\n\nPatterns — Draft, review before sharing\n${sections.patterns}\n\nSuggested next steps — Draft, review before sharing\n${sections.next_steps}`;
    await Clipboard.setStringAsync(out);
    Alert.alert('Copied', 'Summary copied to clipboard.');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl * 2 }}>
        <Pressable onPress={() => router.back()} style={{ marginBottom: spacing.md }}>
          <Text style={{ fontFamily: fonts.body, color: colors.accent }}>← Back</Text>
        </Pressable>
        <Text style={styles.h1}>Draft summary</Text>

        <View style={styles.pickerRow}>
          <View style={styles.pickerCol}>
            <Text style={styles.pickerLabel}>Student</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {students.map(s => (
                <Pressable key={s.id} onPress={() => setStudentId(s.id)} style={[styles.chip, studentId === s.id && styles.chipOn]}>
                  <Text style={[styles.chipLabel, studentId === s.id && styles.chipLabelOn]}>{s.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
        <Text style={styles.dateNote}>Date: {ymd.slice(0,4)}-{ymd.slice(4,6)}-{ymd.slice(6,8)} (today)</Text>

        <View style={{ marginTop: spacing.md }}>
          <PrimaryButton label={loading ? 'Generating…' : 'Generate'} onPress={generate} variant="primary" disabled={loading || !studentId} />
        </View>

        {!llmEnabled && (
          <Text style={styles.banner}>AI summaries are off. Showing your raw notes.</Text>
        )}

        {loading && <ActivityIndicator style={{ marginTop: spacing.xl }} />}
        {errorMsg && <Text style={styles.error}>{errorMsg}</Text>}

        {sections && (
          <View>
            {(['positives', 'concerns', 'patterns', 'next_steps'] as const).map((k) => (
              <View key={k} style={styles.section}>
                <Text style={styles.sectionTitle}>{({positives:'Positives',concerns:'Concerns',patterns:'Patterns',next_steps:'Suggested next steps'} as any)[k]}</Text>
                <Text style={styles.draft}>Draft — review before sharing</Text>
                <Text style={styles.sectionBody}>{sections[k]}</Text>
              </View>
            ))}
          </View>
        )}

        {!sections && rawNotes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Raw notes</Text>
            <Text style={styles.sectionBody}>{rawNotes}</Text>
          </View>
        )}

        {(sections || rawNotes) && (
          <View style={{ marginTop: spacing.lg }}>
            <PrimaryButton label="Copy all" onPress={copyAll} variant="secondary" />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: fonts.heading, fontSize: 26, color: colors.ink, marginBottom: spacing.md },
  pickerRow: { marginBottom: spacing.sm },
  pickerCol: {},
  pickerLabel: { fontFamily: fonts.headingItalic, fontSize: 12, color: colors.inkMuted, marginBottom: spacing.xs },
  chip: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginRight: spacing.sm },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipLabel: { fontFamily: fonts.heading, fontSize: 14, color: colors.ink },
  chipLabelOn: { color: colors.accentText },
  dateNote: { fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted, marginTop: spacing.sm },
  banner: { fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted, backgroundColor: colors.surface2, padding: spacing.sm, borderRadius: radii.sm, marginTop: spacing.md, textAlign: 'center' },
  error: { fontFamily: fonts.body, color: colors.danger, marginTop: spacing.lg, textAlign: 'center' },
  section: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radii.md, padding: spacing.md, marginTop: spacing.md, ...shadows.soft },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 16, color: colors.ink },
  draft: { fontFamily: fonts.headingItalic, fontSize: 11, color: colors.inkMuted, marginBottom: spacing.sm },
  sectionBody: { fontFamily: fonts.body, fontSize: 14, color: colors.ink, lineHeight: 21 },
});
```

Install: `npx expo install expo-clipboard`.

- [ ] **Step 5: Smoke-run**

Expected: log a few text notes for Alex M., open Summary, pick Alex, tap Generate. With the backend tunnel up and reachable, the four sections appear. Copy all works.

- [ ] **Step 6: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): Summary screen + api/summary wrapper with TDD"
```

---

## Task 12: First end-to-end smoke — text-path demo flow

**Goal:** Manual verification that the text-only path of the demo flow works end-to-end on a real phone. This catches regressions early before voice work layers in.

**Files:** none (manual checklist only; the checklist doc lives at `docs/manual-smoke.md`, written in Task 17).

- [ ] **Step 1: Verify the local backend setup**

```bash
cd backend && source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
# In another terminal:
ngrok http 8000
# Note the assigned ngrok URL.
curl https://YOUR-NGROK-URL/health
```

Expected: `{"ok":true,"anthropic_ok":true,"openai_ok":true}` (assuming `.env` is set in backend/).

- [ ] **Step 2: Start Metro and load on a phone**

```bash
cd mobile && npm start -- --tunnel
```

Scan QR with Expo Go on iPhone or Android. The first launch should hit Onboarding.

- [ ] **Step 3: Run the manual flow**

Performed by the builder on a real device. The expected behavior is documented inline; checkmarks below are the engineer's verification.

  - [ ] Onboarding opens; three sections render; allow microphone; tap "Start using the app"
  - [ ] Home is empty with "No students yet. Add your first one in Settings."
  - [ ] Settings → set API base URL to the ngrok URL → "Test connection" returns "connected"
  - [ ] Settings → add 3 students (Alex M., Casey B., Kai L.)
  - [ ] Home → roster shows 3 tiles
  - [ ] Tap "Alex M." → modal opens with student name + "Type your note…" placeholder
  - [ ] Type "Morning math was focused today" → tap Save → returns to Home → note shows in Today's notes
  - [ ] Tap the note row → modal opens in edit mode → edit text → tap Update → list updates
  - [ ] Open the note again → long-press "Hold to delete" → confirm → note disappears
  - [ ] Add 2 more notes for Alex
  - [ ] Tap Generate Summary FAB → Summary screen opens
  - [ ] Pick Alex M., tap Generate → four sections render with realistic content from Claude
  - [ ] Tap Copy all → "Copied" alert appears

- [ ] **Step 4: If anything fails, file an issue and stop**

Do not proceed to voice work until the text path is solid. If a step fails, dispatch a debugging subagent (instructed to use `superpowers:systematic-debugging`) before continuing.

- [ ] **Step 5: Commit the smoke verification as a doc stub**

`docs/manual-smoke.md` (initial stub — fleshed out in Task 17):
```markdown
# Manual smoke checklist

This is the authoritative end-to-end test for classroom-log. Run it after each significant change.

## Setup
1. Start the backend: `cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
2. Expose via ngrok: `ngrok http 8000`
3. Verify: `curl https://<ngrok>/health` returns `ok:true`
4. Start Metro: `cd mobile && npm start -- --tunnel`
5. Scan QR with Expo Go

## Text path (Task 12)

- [ ] Onboarding renders; mic permission granted
- [ ] Settings → add 3 students; set API URL; Test connection = connected
- [ ] Home → tap student → modal → type → save → note appears
- [ ] Tap note → edit → update; long-press hold → delete works
- [ ] Discard sheet appears when closing with unsaved text
- [ ] Summary → pick student → Generate → four sections render
- [ ] Copy all copies the formatted summary

## Voice path (added in Task 14)
(pending)

## Edge cases (added in Task 17)
(pending)
```

```bash
git add docs/manual-smoke.md
git commit -m "docs: initial manual smoke checklist (text path verified)"
```

---

## Task 13: lib/audio.ts (record + cleanup via expo-audio)

**Files:**
- Create: `mobile/lib/audio.ts`
- Create: `mobile/lib/__tests__/audio.test.ts`

Use `expo-audio` (the supported successor to the deprecated `expo-av` mentioned in the spec). The recording API records to a temp file in the app cache dir; the file path is returned by `stop()` and is the caller's responsibility to send and delete.

- [ ] **Step 1: Write the failing tests**

`mobile/lib/__tests__/audio.test.ts`:
```ts
jest.mock('expo-audio', () => {
  const mockRecorder = {
    prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
    record: jest.fn(),
    stop: jest.fn().mockResolvedValue(undefined),
    uri: '/tmp/recording.m4a',
  };
  return {
    AudioModule: {
      requestRecordingPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
      setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    },
    useAudioRecorder: () => mockRecorder,
    RecordingPresets: { HIGH_QUALITY: {} },
  };
});

jest.mock('expo-file-system', () => ({
  documentDirectory: '/docs/',
  cacheDirectory: '/cache/',
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, size: 12345 }),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  readDirectoryAsync: jest.fn().mockResolvedValue(['old-recording.m4a']),
}));

import { ensurePermission, cleanupOrphanRecordings } from '../audio';

describe('audio.ensurePermission', () => {
  it('returns true when granted', async () => {
    const ok = await ensurePermission();
    expect(ok).toBe(true);
  });
});

describe('audio.cleanupOrphanRecordings', () => {
  it('deletes any pre-existing .m4a files in the cache dir', async () => {
    const FS = require('expo-file-system');
    await cleanupOrphanRecordings();
    expect(FS.deleteAsync).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd mobile && npm test -- audio
```

Expected: FAIL — `../audio` not found.

- [ ] **Step 3: Implement lib/audio.ts**

`mobile/lib/audio.ts`:
```ts
import { AudioModule, useAudioRecorder, RecordingPresets, type AudioRecorder } from 'expo-audio';
import * as FileSystem from 'expo-file-system';

export async function ensurePermission(): Promise<boolean> {
  const status = await AudioModule.requestRecordingPermissionsAsync();
  return status.granted;
}

export function useRecorder(): AudioRecorder {
  return useAudioRecorder(RecordingPresets.HIGH_QUALITY);
}

export async function startRecording(rec: AudioRecorder): Promise<void> {
  await rec.prepareToRecordAsync();
  rec.record();
}

export async function stopRecording(rec: AudioRecorder): Promise<{ uri: string; size: number } | null> {
  await rec.stop();
  const uri = rec.uri;
  if (!uri) return null;
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) return null;
  return { uri, size: info.size ?? 0 };
}

export async function deleteRecording(uri: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // Recording may already be gone; ignore.
  }
}

export async function cleanupOrphanRecordings(): Promise<void> {
  const dir = FileSystem.cacheDirectory;
  if (!dir) return;
  let entries: string[] = [];
  try {
    entries = await FileSystem.readDirectoryAsync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name.endsWith('.m4a') || name.endsWith('.caf')) {
      await FileSystem.deleteAsync(dir + name, { idempotent: true });
    }
  }
}
```

Install: `npx expo install expo-audio expo-file-system`.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd mobile && npm test -- audio
```

Expected: PASS.

- [ ] **Step 5: Wire cleanup at root layout startup**

Modify `mobile/app/_layout.tsx` — add to `RouterGate` useEffect:
```ts
import { cleanupOrphanRecordings } from '../lib/audio';
// inside the existing effect, after setReady:
cleanupOrphanRecordings().catch(() => {});
```

- [ ] **Step 6: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): expo-audio wrapper + orphan-recording cleanup with TDD"
```

---

## Task 14: Wire audio → /transcribe → Note modal

**Files:**
- Create: `mobile/api/transcribe.ts`
- Modify: `mobile/api/__tests__/api.test.ts` (add transcribe tests)
- Modify: `mobile/app/note/[studentId].tsx`

- [ ] **Step 1: Add failing tests for api/transcribe**

Append to `mobile/api/__tests__/api.test.ts`:
```ts
import { uploadAudio } from '../transcribe';

describe('uploadAudio', () => {
  it('returns {ok:true, text} on a 200 response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'hello world' }),
    } as any);
    const r = await uploadAudio('https://x.test', 'file:///tmp/r.m4a');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.text).toBe('hello world');
  });

  it('returns {ok:false, error} on a 5xx with error envelope', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ error: { code: 'openai_error', message: 'down' } }),
    } as any);
    const r = await uploadAudio('https://x.test', 'file:///tmp/r.m4a');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('openai_error');
  });
});
```

- [ ] **Step 2: Write api/transcribe.ts**

`mobile/api/transcribe.ts`:
```ts
export type TranscribeResult =
  | { ok: true; text: string }
  | { ok: false; error: { code: string; message: string } };

export async function uploadAudio(apiBaseUrl: string, fileUri: string, timeoutMs = 30_000): Promise<TranscribeResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const form = new FormData();
    // React Native FormData accepts {uri, name, type} for file uploads
    // @ts-expect-error — RN-specific shape, TypeScript form lib does not cover it
    form.append('audio', { uri: fileUri, name: 'audio.m4a', type: 'audio/m4a' });

    const resp = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/transcribe`, {
      method: 'POST',
      body: form,
      signal: ctrl.signal,
    });
    const body = await resp.json().catch(() => ({}));
    if (resp.ok) return { ok: true, text: body.text ?? '' };
    return { ok: false, error: body?.error ?? { code: 'http_error', message: `HTTP ${resp.status}` } };
  } catch (e: any) {
    if (e?.name === 'AbortError') return { ok: false, error: { code: 'timeout', message: 'Transcription timed out' } };
    return { ok: false, error: { code: 'network_error', message: e?.message ?? 'Network error' } };
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 3: Run the tests**

```bash
cd mobile && npm test -- api
```

Expected: PASS (existing + new transcribe tests).

- [ ] **Step 4: Wire the mic button in Note modal**

Replace the placeholder mic Pressable in `mobile/app/note/[studentId].tsx`. Add at the top of the component:
```ts
import { useRecorder, startRecording, stopRecording, deleteRecording } from '../../lib/audio';
import { uploadAudio } from '../../api/transcribe';

// inside component:
const recorder = useRecorder();
const [recording, setRecording] = useState(false);
const [transcribing, setTranscribing] = useState(false);

async function toggleRecording() {
  if (recording) {
    setRecording(false);
    const r = await stopRecording(recorder);
    if (!r) return;
    setTranscribing(true);
    const apiUrl = (await getSetting(db, 'api_base_url')) || '';
    const upload = await uploadAudio(apiUrl, r.uri);
    setTranscribing(false);
    if (upload.ok) {
      setText(prev => (prev.trim() ? prev + ' ' + upload.text : upload.text));
    } else {
      Alert.alert('Transcription failed', `${upload.error.code}: ${upload.error.message}`);
    }
    await deleteRecording(r.uri);
  } else {
    setRecording(true);
    await startRecording(recorder);
  }
}
```

And replace the placeholder `onPress` of the mic FAB with `toggleRecording`. Set the textarea's `editable` to `!recording`. Show a "Recording…" or "Transcribing…" label above the textarea when those flags are true.

Concrete diff (replace existing mic Pressable and add the Recording/Transcribing label):

```tsx
{recording && (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} />
    <Text style={{ fontFamily: fonts.headingItalic, color: colors.accent }}>Recording…</Text>
  </View>
)}
{transcribing && (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
    <ActivityIndicator size="small" color={colors.accent} />
    <Text style={{ fontFamily: fonts.headingItalic, color: colors.inkMuted }}>Transcribing…</Text>
  </View>
)}
```

Then in the existing `TextInput`, set `editable={!recording}` and update the mic Pressable's onPress to `toggleRecording`. Replace `Alert.alert('Coming up next', …)` accordingly.

(Import `ActivityIndicator` from `react-native` if not already imported.)

- [ ] **Step 5: Smoke-run voice path**

Real device required for mic access. Expected:
- Tap mic → "Recording…" appears, text field becomes read-only
- Tap mic again → "Transcribing…" briefly, then transcribed text appears in the field
- Save the note → it shows up on Home

- [ ] **Step 6: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): voice path — record, upload, transcribe, append text"
```

---

## Task 15: Real /health status pill + retry/error states

**Files:**
- Create: `mobile/api/health.ts`
- Modify: `mobile/app/index.tsx` (use real health)

- [ ] **Step 1: Write api/health.ts**

`mobile/api/health.ts`:
```ts
import { callJson } from './client';

export interface HealthResult {
  ok: boolean;
  anthropic_ok: boolean;
  openai_ok: boolean;
}

export async function checkHealth(apiBaseUrl: string): Promise<{ ok: true; data: HealthResult } | { ok: false; error: { code: string; message: string } }> {
  if (!apiBaseUrl) return { ok: false, error: { code: 'no_url', message: 'API base URL not set' } };
  return callJson<HealthResult>(`${apiBaseUrl.replace(/\/$/, '')}/health`, { method: 'GET' }, 5_000);
}
```

- [ ] **Step 2: Wire into Home**

In `mobile/app/index.tsx`, replace the hardcoded `ok={true}` with a state-driven value:
```ts
import { checkHealth } from '../api/health';
const [healthOk, setHealthOk] = useState(false);

// inside reload():
const apiUrl = (await getSetting(db, 'api_base_url')) || '';
const h = await checkHealth(apiUrl);
setHealthOk(h.ok && h.data.ok);

// in JSX:
<StatusPill ok={healthOk} />
```

- [ ] **Step 3: Smoke-run**

Expected:
- With the backend tunnel up and reachable, status pill shows "AI: connected"
- Kill the backend, navigate away and back to Home → pill flips to "AI: offline"

- [ ] **Step 4: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): live /health status pill on Home"
```

---

## Task 16: Edit / delete / move existing notes (long-press flow)

The single-tap edit + long-press-delete is already implemented in Task 10. This task adds "move note to a different student" — useful when the teacher taps the wrong student tile and realizes mid-note.

**Files:**
- Modify: `mobile/components/NoteRow.tsx` (long-press to open move sheet)
- Create: `mobile/components/MoveSheet.tsx`

- [ ] **Step 1: MoveSheet component**

`mobile/components/MoveSheet.tsx`:
```tsx
import { Modal, View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { Student } from '../db/db';
import { colors, fonts, spacing, radii } from '../lib/theme';

interface Props {
  visible: boolean;
  students: Student[];
  currentStudentId: string;
  onPick: (id: string) => void;
  onClose: () => void;
}

export function MoveSheet({ visible, students, currentStudentId, onPick, onClose }: Props) {
  const others = students.filter(s => s.id !== currentStudentId);
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.heading}>Move note to…</Text>
        <FlatList
          data={others}
          keyExtractor={(s) => s.id}
          renderItem={({ item }) => (
            <Pressable onPress={() => onPick(item.id)} style={styles.row}>
              <Text style={styles.rowLabel}>{item.name}</Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No other students to move to.</Text>}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', inset: 0 as any, backgroundColor: 'rgba(42, 38, 32, .4)' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: '60%', backgroundColor: colors.bg, padding: spacing.xl, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg },
  heading: { fontFamily: fonts.heading, fontSize: 18, color: colors.ink, marginBottom: spacing.md },
  row: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { fontFamily: fonts.heading, fontSize: 16, color: colors.ink },
  empty: { fontFamily: fonts.body, fontSize: 13, color: colors.inkMuted, textAlign: 'center', paddingVertical: spacing.lg },
});
```

- [ ] **Step 2: Update NoteRow to accept a long-press handler**

In `mobile/components/NoteRow.tsx`:
```tsx
interface Props {
  studentName: string;
  text: string;
  createdAt: number;
  onPress: () => void;
  onLongPress?: () => void;  // new
}

// In the Pressable:
<Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={600} ...>
```

- [ ] **Step 3: Wire into Home**

In `mobile/app/index.tsx`:
```ts
import { moveNote } from '../db/db';
import { MoveSheet } from '../components/MoveSheet';

const [moveTarget, setMoveTarget] = useState<{ noteId: string; currentStudentId: string } | null>(null);

// in JSX, replace NoteRow callsite:
<NoteRow
  key={n.id}
  studentName={n.student_name}
  text={n.text}
  createdAt={n.created_at}
  onPress={() => router.push(`/note/${n.student_id}?noteId=${n.id}`)}
  onLongPress={() => setMoveTarget({ noteId: n.id, currentStudentId: n.student_id })}
/>

// before the closing SafeAreaView:
<MoveSheet
  visible={!!moveTarget}
  students={students}
  currentStudentId={moveTarget?.currentStudentId ?? ''}
  onPick={async (sid) => {
    if (moveTarget) {
      await moveNote(db, moveTarget.noteId, sid);
      setMoveTarget(null);
      reload();
    }
  }}
  onClose={() => setMoveTarget(null)}
/>
```

- [ ] **Step 4: Smoke-run**

Expected: long-press a note → bottom sheet with other students → tap one → note now belongs to that student → Home list refreshes.

- [ ] **Step 5: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): long-press to move a note between students"
```

---

## Task 17: Manual smoke checklist (final) + tunnel setup docs

**Files:**
- Replace: `docs/manual-smoke.md`
- Create: `docs/tunnel-setup.md`
- Create: `README.md` (project root)

- [ ] **Step 1: Final manual smoke checklist**

Replace `docs/manual-smoke.md`:
```markdown
# Manual smoke checklist

Authoritative end-to-end test for classroom-log. Run after each significant change. Should take ~5 minutes on a real device.

## Setup

1. Ensure `backend/.env` contains both `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`.
2. Start the backend:
   ```
   cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
3. Expose via ngrok (use the stable assigned dev domain to avoid URL churn):
   ```
   ngrok http --domain=<assigned-dev-domain> 8000
   ```
4. Verify backend health from your laptop: `curl https://<ngrok-domain>/health` → expect `ok:true`.
5. Start Metro: `cd mobile && npm start -- --tunnel`
6. Scan the QR with Expo Go on iPhone or Android.

## Cold start

- [ ] Onboarding screen opens
- [ ] Three sections render with serif headings (Source Serif) and sans body (Source Sans), cream background
- [ ] Tap "Allow microphone" → OS permission prompt → grant
- [ ] Tap "Start using the app" → routes to Home

## Roster

- [ ] Home is empty: "No students yet. Add your first one in Settings."
- [ ] Tap settings gear → Settings opens
- [ ] Set API base URL to the ngrok URL → tap "Save URL"
- [ ] Tap "Test connection" → status shows "connected"
- [ ] Add 3 students: Alex M., Casey B., Kai L. → all 3 appear with colored dots
- [ ] Toggle Alex M.'s "Voice allowed" off, then back on
- [ ] Back to Home → 3 student tiles visible in roster grid
- [ ] Status pill shows "AI: connected"

## Text capture

- [ ] Tap Alex M. → modal opens, textarea focused
- [ ] Type "Morning math was focused today." → tap Save → returns to Home
- [ ] Today's notes shows one entry under Alex M.
- [ ] Tap that note → modal re-opens with the text → edit and tap Update → list reflects the edit
- [ ] Long-press "Hold to delete" → confirm → note removed
- [ ] Add 3 new notes for Alex M.

## Voice capture

- [ ] Tap Casey B. → modal opens
- [ ] Tap the mic FAB → "Recording…" indicator appears, textarea read-only
- [ ] Say one short sentence aloud → tap mic again
- [ ] "Transcribing…" appears briefly → transcribed text fills the textarea
- [ ] Tap Save → note appears on Home

## Voice off

- [ ] Home → toggle "Voice off" → mic FAB on any note modal is greyed and disabled

## Summary

- [ ] Tap "Generate Summary" FAB → Summary screen
- [ ] Pick Alex M. → tap Generate → loading state → four sections render
- [ ] Each section header shows "Draft — review before sharing"
- [ ] Tap Copy all → "Copied" alert

## Move a note

- [ ] Home → long-press one of Alex's notes → bottom sheet appears
- [ ] Tap Casey B. → note now appears under Casey B.

## Demo reset

- [ ] Settings → Reset demo data → confirm → roster + notes wiped
- [ ] Home is back to empty state; onboarding does NOT re-trigger (api_base_url is preserved)

## Error states

- [ ] Stop the backend
- [ ] Home → wait → status pill flips to "AI: offline"
- [ ] Summary → Generate → error shows with code (network_error or timeout)
- [ ] Restart backend → status pill recovers on next focus

## Concurrent testers

- [ ] Share the Metro QR with a second phone
- [ ] Both phones can use the app simultaneously; each has its own roster
```

- [ ] **Step 2: Tunnel setup doc**

`docs/tunnel-setup.md`:
```markdown
# Demo-day tunnel setup

Exact order matters. The phone reads its API base URL from a `settings` row in the local SQLite, seeded on first launch from `EXPO_PUBLIC_API_BASE_URL`. If the URL changes between sessions, teachers update it in Settings → Server. They do not need a new build.

## One-time setup (do this once per machine)

1. Reserve a stable ngrok dev domain at https://dashboard.ngrok.com/cloud-edge/domains
2. Generate an Anthropic API key and an OpenAI API key.
3. Put both in `backend/.env`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   OPENAI_API_KEY=sk-proj-...
   ```
4. Put the ngrok URL in `mobile/.env`:
   ```
   EXPO_PUBLIC_API_BASE_URL=https://your-stable-domain.ngrok.app
   ```

## Demo-day startup order

1. Terminal 1 — backend:
   ```
   cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
2. Terminal 2 — ngrok:
   ```
   ngrok http --domain=your-stable-domain.ngrok.app 8000
   ```
3. Verify health:
   ```
   curl https://your-stable-domain.ngrok.app/health
   ```
   Expected: `{"ok":true,"anthropic_ok":true,"openai_ok":true}`
4. Terminal 3 — Metro:
   ```
   cd mobile && npm start -- --tunnel
   ```
5. Builder phone QA: scan QR with Expo Go, run through the manual smoke checklist (above).

## Network sanity check (60 seconds, before teachers arrive)

If you are not on your home Wi-Fi (school Wi-Fi often blocks tunnels):
1. `curl https://your-stable-domain.ngrok.app/health` from the demo network laptop.
2. `curl https://api.anthropic.com/v1/models` (any non-200 except 401 means network is blocking Anthropic).
3. `curl https://api.openai.com/v1/models` (same check for OpenAI).

If any of these fail on school Wi-Fi:
- Switch to a personal cellular hotspot.
- Re-run the manual smoke checklist before handing the phone over.

## What teachers need

- iPhone or Android with Expo Go installed (free from App Store / Play Store)
- The Metro QR code (shown in Terminal 3)
- Your good will: if the demo lags, it's the tunnel, not the app.

## Cost ballpark

- Whisper API: ~$0.006 per minute of audio
- Claude summary (sonnet-4-6): ~$0.01–0.03 per generation
- 5 teachers × 30 minutes × ~3 voice notes + 2 summaries each ≈ <$2 per demo session
```

- [ ] **Step 3: Project README**

`README.md`:
```markdown
# classroom-log

A real-time note-taking app for special-education teachers. Prototype V1.

## What it does

Teachers tap a student button, speak or type an observation, save. Claude generates a draft daily summary they review before sharing.

## Run it

See `docs/tunnel-setup.md` for the demo-day startup order. See `docs/manual-smoke.md` for the end-to-end manual test.

## Architecture

See `docs/superpowers/specs/2026-05-26-classroom-log-design.md`.

## Status

V1 prototype. Not for production. Not in app stores. Designed to be demoed by the builder to teachers, with the builder present and online.
```

- [ ] **Step 4: Commit**

```bash
git add docs/manual-smoke.md docs/tunnel-setup.md README.md
git commit -m "docs: final manual smoke checklist, tunnel setup, project README"
```

---

## Task 18: Final /codex review of the implementation

**Files:** none modified directly. This is a review pass.

- [ ] **Step 1: Make sure the diff is clean and pushed-ready**

```bash
git status
git log --oneline main..HEAD
```

Expected: all changes committed, clean working tree, ~17 commits on the feature branch.

- [ ] **Step 2: Run the full test suite**

```bash
cd backend && source .venv/bin/activate && pytest -v
cd ../mobile && npm test
```

Expected: ALL PASS.

- [ ] **Step 3: Run codex review on the diff**

```bash
/codex review
```

The codex skill will diff `feat/v1-implementation` against `main` and produce a P1/P2/P3 findings list with pass/fail gate.

- [ ] **Step 4: Triage findings**

For each P1: file an issue or fix inline before merging. Use the systematic-debugging skill for any unclear findings.
For each P2: judgment call — fix now, or defer with a TODO and a tracking note in CHANGELOG.
P3 are advisory; only act if the fix is trivial.

- [ ] **Step 5: Run the manual smoke checklist one more time on a real device**

End-to-end. Both phones if you have testers lined up.

- [ ] **Step 6: Merge to main**

```bash
git checkout main
git merge --no-ff feat/v1-implementation -m "Merge feat/v1-implementation: V1 prototype ready for teacher demo"
```

- [ ] **Step 7: Tag**

```bash
git tag v0.1.0
```

Optionally push to the GitHub remote if the team wants the tag visible.

---

## Self-Review (controller checklist before handoff)

Run this after writing the plan, before executing.

**1. Spec coverage:** Every section of `docs/superpowers/specs/2026-05-26-classroom-log-design.md` has a corresponding task:
- §1 Overview — Task 0 (branch + bootstrap)
- §2 Goals/non-goals — Goals exercised by smoke test (Task 12, 17); non-goals enforced by absence of tasks
- §3 Architecture (mobile + backend + tunnel) — Tasks 1–4
- §4 Components — Tasks 5–11, 13–16
- §5 Data model — Tasks 5–6
- §6 Data flow — Tasks 10, 11, 14
- §7 Error handling — Tasks 11 (timeout/network), 15 (offline pill), 17 (smoke checklist)
- §8 Privacy — Task 7 (onboarding disclosure)
- §9 Testing — embedded throughout (TDD); manual smoke in Task 17
- §10 Distribution and demo setup — Task 17 (tunnel-setup.md)
- §11 Future V2 — explicitly out of scope; no task

**2. Placeholder scan:** No "TBD", "implement later", "Similar to Task N" without repetition, or skeleton steps without code. Every code step shows real working code.

**3. Type consistency:** `Student` and `Note` types are defined in Task 5 (`db.ts`) and used unchanged in Tasks 7, 8, 9, 10, 11, 16. `SummarySections` defined in Task 11, used in 11 only. `ApiResult` defined in Task 11, used by both `summary.ts` and `health.ts`.

**4. TDD discipline:** Every task that adds production code has a failing test in an earlier step. Backend tests use pytest with mocked clients; mobile tests use Jest with `jest-expo` preset.

**5. Branch discipline:** Task 0 establishes `feat/v1-implementation` off `main`. Every commit is on that branch. Final merge is in Task 18, controlled by the human, never by a subagent.

**6. Subagent boundary:** Every subagent dispatched during execution must be instructed: "Stay on `feat/v1-implementation`. Do not FF-merge to main. Use TDD per superpowers:test-driven-development. Use verification-before-completion before reporting done."

---

## Parallel execution graph

Run tasks in waves. Within a wave, dispatch one subagent per task — they run in parallel. Wait for the wave to finish, run a quick codex review on the merged diff, then dispatch the next wave.

```
WAVE 1 (after Task 0 lands serially):
  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
  │ T1       │    │ T2       │    │ T3       │    │ T4       │
  │ /health  │    │ /summary │    │ /transcr │    │ mobile   │
  │ backend  │    │ backend  │    │ backend  │    │ bootstrap│
  └──────────┘    └──────────┘    └──────────┘    └──────────┘
                                              (T2 depends on T1's err helper;
                                               T3 depends on T1's clients;
                                               dispatch T1 first, then T2+T3
                                               in parallel after T1 lands.)
                                               T4 is fully independent — runs
                                               in parallel with the backend wave.

WAVE 2 (after T4 lands):
  T5 (students CRUD) → T6 (notes + settings CRUD)
  (Serial: T6 depends on T5's db.ts structure.)

WAVE 3 (after T6 lands) — five-way fan-out:
  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
  │ T7       │ │ T8       │ │ T9       │ │ T10      │ │ T11      │
  │ onboard  │ │ home     │ │ settings │ │ note     │ │ summary  │
  │          │ │          │ │          │ │ modal    │ │          │
  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
  + T13 (audio lib) in parallel — independent of all UI

WAVE 4 (after Wave 3 lands):
  T12 (manual smoke — text path) — serial, controller runs this on a real phone

WAVE 5 (after T12 passes):
  ┌──────────┐ ┌──────────┐ ┌──────────┐
  │ T14      │ │ T15      │ │ T16      │
  │ wire     │ │ health   │ │ move     │
  │ voice    │ │ pill     │ │ sheet    │
  └──────────┘ └──────────┘ └──────────┘
  (T14 needs T13 + T10; T15 and T16 need T8. All three run in parallel.)

WAVE 6 (after Wave 5 lands):
  T17 (docs) — serial, controller-authored

WAVE 7 (final):
  T18 /codex review on the full feature-branch diff
```

**Between every wave, the controller (you) runs `/codex review` on the diff added during that wave.** Codex findings are addressed before the next wave starts. This is the inter-wave gate.

## Agent dispatch template

Every subagent dispatched to execute a task in this plan MUST receive this preamble in addition to its task-specific instructions. Boilerplate to copy verbatim:

```
You are a subagent dispatched to implement ONE task from
docs/superpowers/plans/2026-05-26-classroom-log-v1.md. Stay focused; do
not expand scope; do not touch tasks other than the one assigned.

REQUIRED SUPERPOWERS SKILLS (use them, do not just acknowledge them):
- superpowers:test-driven-development — every line of production code is
  preceded by a failing test that you watch fail, then pass.
- superpowers:verification-before-completion — before reporting done,
  run the full test suite for the module you touched and the typechecker;
  manually verify any UI change on a device if possible.
- superpowers:systematic-debugging — if a test fails unexpectedly, do
  not flail. Reproduce minimally, form a hypothesis, test it.

GIT BOUNDARY (non-negotiable):
- You are working on branch `feat/v1-implementation`. Stay on it.
- Do NOT fast-forward merge to `main`. Do NOT cherry-pick. Do NOT rebase
  onto main. Do NOT push.
- Make commits with the exact messages shown in the task steps. One
  commit per task unless the task explicitly says otherwise.

SCOPE BOUNDARY:
- The spec's §2 Non-goals list is locked. Do not add features that the
  spec excluded (categories, web build, app store, multi-day summaries,
  CORS, prompt caching, malformed-JSON retry, etc.).
- If you discover something genuinely broken outside your task's scope,
  document it inline in your report — do not fix it.

REPORT FORMAT:
At the end, report:
- TASK_<N>_DONE — list of files touched + the commit SHA
- TESTS — what you ran, exit codes
- DEVIATIONS — any place the implementation differs from the plan (with
  a one-line reason)
- BLOCKERS — anything that needs the controller's attention
```

## Wave-level codex review

After each wave lands and is merged into the feature branch, the controller runs:

```bash
git checkout feat/v1-implementation
# Run codex review on commits added during the just-finished wave:
/codex review
```

Codex sees the diff between `main` and `HEAD`. Its P1 findings are blockers
for the next wave; P2 findings are triaged; P3 are advisory.

Do NOT use in-session subagent reviewers in place of /codex review. The
project preference (see auto-memory) is that /codex provides the independent
second opinion on code quality.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-26-classroom-log-v1.md`. Two execution options:**

**1. Subagent-Driven, max-parallel (recommended given your direction)** — I dispatch a fresh subagent per task, fan out per the wave graph above, run `/codex review` between waves, address P1s before continuing.

**2. Inline Execution** — Execute tasks in this session using `executing-plans`, no subagents. Slower, less parallelism, but you watch every step.

Which approach?
