# Voice-first capture — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the voice-first capture restructure from the design spec at
`docs/superpowers/specs/2026-05-29-voice-first-capture-design.md`. Tap a
student tile on home → record inline → tap Stop & save → toast with
Undo/Edit. Long-press tile → text modal with a real (wired) recorder
that appends the transcript at the cursor. All Danish UI. Summary
prompt locked to third-person observational stance, Danish output, no
first-person on the student's behalf.

**Architecture:** Single `useCaptureStore` Zustand slice owns the
recording lifecycle, consumed by both the home tile transformation and
the in-modal `RecordingBar`. Backend gets a new system prompt + Whisper
language field surfaced to mobile + friendlier 5xx envelopes. Mobile DB
gains `notes.language` and `notes.audio_uri` (idempotent migration v2).
Every UI string moves to `mobile/lib/copy.ts`.

**Tech Stack:** Expo SDK 54, React Native 0.81.5, Expo Router, TypeScript
strict, jest + jest-expo, Zustand (new dep this slice), expo-sqlite,
expo-audio, FastAPI, OpenAI Whisper (`whisper-1` with `verbose_json`),
Anthropic Claude (`claude-sonnet-4-6`), pytest.

---

## Pre-flight checks (do these before Task 0)

Confirm the starting state, so we don't burn a subagent on a moving target:

```bash
git branch --show-current      # expect: feat/v1-implementation
git status --short             # expect: clean
git log --oneline -1           # expect: 0d43b0a (or later — the spec edits)
cat mobile/package.json | grep -E '"expo":|zustand'  # expect: expo ~54.0.0, NO zustand line
```

If `git status` is dirty, stop and ask the controller. If `zustand` is
already in `dependencies`, skip the install step in Task 0 and note it.

---

## Task 0: Branch + Zustand install

**Files:**
- Modify: `mobile/package.json`
- Modify: `mobile/package-lock.json`

- [ ] **Step 1: Create the feature branch off `feat/v1-implementation`.**

```bash
git checkout feat/v1-implementation
git status                          # expect: clean
git checkout -b feat/voice-first-capture
git branch --show-current           # expect: feat/voice-first-capture
```

- [ ] **Step 2: Install zustand via `expo install` (it picks SDK 54-compatible version).**

```bash
cd mobile
npx expo install zustand
```

Expected: a new `"zustand": "^X.Y.Z"` row in `mobile/package.json`
`dependencies`, lockfile regenerated. The actual semver picked by
`expo install` is whatever ships under SDK 54.

- [ ] **Step 3: Verify jest still passes (no behavior changed yet).**

```bash
cd mobile
npm test
```

Expected: 24/24 pass. If anything fails, stop and report.

- [ ] **Step 4: Commit.**

```bash
cd /workspace
git add mobile/package.json mobile/package-lock.json
git -c user.name="pjmeijer" -c user.email="pjmeijer@me.com" commit -m "$(cat <<'EOF'
chore(mobile): add zustand for voice-first capture state

Single source of truth for the recording lifecycle, consumed by both
the home tile transformation and the in-modal RecordingBar.

Spec: docs/superpowers/specs/2026-05-29-voice-first-capture-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 1: DB migration v2 — `notes.language` + `notes.audio_uri`

**Files:**
- Modify: `mobile/db/migrations.ts`
- Modify: `mobile/db/db.ts:5-17` (the `Note` interface)
- Test: `mobile/db/__tests__/db.test.ts` (extend)

- [ ] **Step 1: Write the failing test for migration v2 idempotency.**

Add to `mobile/db/__tests__/db.test.ts`:

```ts
import { migrate } from '../migrations';
// (existing imports/setup stay)

describe('migrate', () => {
  it('adds notes.language and notes.audio_uri columns at v2', async () => {
    const db = await openTestDb();           // existing helper
    await migrate(db);
    await migrate(db);                       // re-run must be idempotent
    const cols = await db.getAllAsync<{ name: string }>(
      "PRAGMA table_info(notes)"
    );
    const names = cols.map(c => c.name);
    expect(names).toContain('language');
    expect(names).toContain('audio_uri');
    const v = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(v?.user_version).toBe(2);
  });
});
```

If `openTestDb` doesn't exist as a helper yet, inline:

```ts
async function openTestDb() {
  const { openDatabaseAsync } = require('expo-sqlite');
  return openDatabaseAsync(':memory:');
}
```

- [ ] **Step 2: Run the test, watch it fail.**

```bash
cd mobile
npm test -- --testPathPattern db
```

Expected: FAIL with "expected ... to contain 'language'" (column not added) or
"expected user_version to be 2" (still at 1).

- [ ] **Step 3: Add migration v2 in `mobile/db/migrations.ts`.**

```ts
const TARGET_VERSION = 2;

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
  2: `
    ALTER TABLE notes ADD COLUMN language TEXT;
    ALTER TABLE notes ADD COLUMN audio_uri TEXT;
  `,
};
```

The existing version-counter logic in `migrate()` will only run v2 if
`user_version < 2`. Re-running on a v2 db is a no-op. No `IF NOT EXISTS`
needed at column level.

- [ ] **Step 4: Update the `Note` interface in `mobile/db/db.ts`.**

```ts
export interface Note {
  id: string;
  student_id: string;
  text: string;
  language: string | null;        // ISO-ish; whatever Whisper returns. null for text-typed notes.
  audio_uri: string | null;        // local file URI when a transcription failed; null otherwise.
  created_at: number;
  updated_at: number;
}
```

- [ ] **Step 5: Run the test, watch it pass.**

```bash
npm test -- --testPathPattern db
```

Expected: PASS. If any existing test breaks (e.g. shape assertion on
`Note`), update the shape to include the two new nullable fields.

- [ ] **Step 6: Commit.**

```bash
cd /workspace
git add mobile/db/migrations.ts mobile/db/db.ts mobile/db/__tests__/db.test.ts
git -c user.name="pjmeijer" -c user.email="pjmeijer@me.com" commit -m "$(cat <<'EOF'
feat(mobile): db migration v2 — notes.language + notes.audio_uri

Two nullable columns: language captures Whisper's detected language
per voice note (not functionally used in v1.1; Danish hardcoded in
backend prompt). audio_uri captures the local .m4a path when a
transcription fails so the teacher can retry later from the today's
notes row.

Idempotent: re-running migrate() at user_version=2 is a no-op.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `addNote` accepts `language` + `audioUri`

**Files:**
- Modify: `mobile/db/db.ts:80-95` (the `addNote` function)
- Test: `mobile/db/__tests__/db.test.ts` (extend)

- [ ] **Step 1: Write the failing test.**

Add to `mobile/db/__tests__/db.test.ts`:

```ts
describe('addNote', () => {
  it('persists language and audio_uri when supplied', async () => {
    const db = await openTestDb();
    await migrate(db);
    await addStudent(db, { name: 'Stine' });
    const students = await listActiveStudents(db);
    const sid = students[0].id;
    const { id } = await addNote(db, {
      studentId: sid,
      text: 'Det går fint i dag.',
      language: 'danish',
      audioUri: null,
    });
    const row = await getNote(db, id);
    expect(row?.text).toBe('Det går fint i dag.');
    expect(row?.language).toBe('danish');
    expect(row?.audio_uri).toBeNull();
  });

  it('persists audio_uri for failed transcription notes', async () => {
    const db = await openTestDb();
    await migrate(db);
    await addStudent(db, { name: 'Stine' });
    const sid = (await listActiveStudents(db))[0].id;
    const { id } = await addNote(db, {
      studentId: sid,
      text: '(fejl under transskribering — tryk på noten for at prøve igen)',
      language: null,
      audioUri: 'file:///cache/abc.m4a',
    });
    const row = await getNote(db, id);
    expect(row?.audio_uri).toBe('file:///cache/abc.m4a');
  });

  it('still accepts text-only calls (existing callers unchanged)', async () => {
    const db = await openTestDb();
    await migrate(db);
    await addStudent(db, { name: 'Stine' });
    const sid = (await listActiveStudents(db))[0].id;
    const { id } = await addNote(db, {
      studentId: sid,
      text: 'typed note',
    });
    const row = await getNote(db, id);
    expect(row?.language).toBeNull();
    expect(row?.audio_uri).toBeNull();
  });
});
```

- [ ] **Step 2: Run, watch it fail.**

```bash
npm test -- --testPathPattern db
```

Expected: FAIL — addNote doesn't take `language` / `audioUri` yet.

- [ ] **Step 3: Update `addNote` in `mobile/db/db.ts`.**

```ts
export async function addNote(
  db: SQLite.SQLiteDatabase,
  {
    studentId,
    text,
    language = null,
    audioUri = null,
  }: { studentId: string; text: string; language?: string | null; audioUri?: string | null }
): Promise<{ id: string }> {
  const id = uuid();
  const now = Date.now();
  await db.runAsync(
    'INSERT INTO notes (id, student_id, text, language, audio_uri, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    id,
    studentId,
    text,
    language,
    audioUri,
    now,
    now
  );
  return { id };
}
```

- [ ] **Step 4: Run, watch it pass.**

```bash
npm test -- --testPathPattern db
```

Expected: PASS. Existing call sites (e.g. note modal's `addNote(db, { studentId, text })`) still work because both new params default to `null`.

- [ ] **Step 5: Commit.**

```bash
cd /workspace
git add mobile/db/db.ts mobile/db/__tests__/db.test.ts
git -c user.name="pjmeijer" -c user.email="pjmeijer@me.com" commit -m "feat(mobile): addNote accepts optional language + audioUri

Both default to null so existing text-only call sites are
unchanged. Voice notes will populate language from Whisper;
failed-transcription notes will populate audio_uri for retry.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: New `getNotesWithAudioUri` query

**Files:**
- Modify: `mobile/db/db.ts` (add new function)
- Test: `mobile/db/__tests__/db.test.ts` (extend)

- [ ] **Step 1: Write the failing test.**

Add to `mobile/db/__tests__/db.test.ts`:

```ts
import { getNotesWithAudioUri } from '../db';

describe('getNotesWithAudioUri', () => {
  it('returns audio_uri values for notes that have one, skips nulls', async () => {
    const db = await openTestDb();
    await migrate(db);
    await addStudent(db, { name: 'Stine' });
    const sid = (await listActiveStudents(db))[0].id;
    await addNote(db, { studentId: sid, text: 'text only' });
    await addNote(db, { studentId: sid, text: 'pending', audioUri: 'file:///cache/a.m4a' });
    await addNote(db, { studentId: sid, text: 'also pending', audioUri: 'file:///cache/b.m4a' });
    const uris = await getNotesWithAudioUri(db);
    expect(uris.sort()).toEqual(['file:///cache/a.m4a', 'file:///cache/b.m4a']);
  });
});
```

- [ ] **Step 2: Run, watch it fail (function not defined).**

```bash
npm test -- --testPathPattern db
```

- [ ] **Step 3: Implement in `mobile/db/db.ts`.**

```ts
export async function getNotesWithAudioUri(
  db: SQLite.SQLiteDatabase
): Promise<string[]> {
  const rows = await db.getAllAsync<{ audio_uri: string }>(
    'SELECT audio_uri FROM notes WHERE audio_uri IS NOT NULL'
  );
  return rows.map(r => r.audio_uri);
}
```

- [ ] **Step 4: Run, watch it pass.**

- [ ] **Step 5: Commit.**

```bash
cd /workspace
git add mobile/db/db.ts mobile/db/__tests__/db.test.ts
git -c user.name="pjmeijer" -c user.email="pjmeijer@me.com" commit -m "feat(mobile): getNotesWithAudioUri query for orphan-cleanup

Used by cleanupOrphanRecordings to skip .m4a files that belong to
failed-transcription notes (they get retried, not garbage-collected).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `cleanupOrphanRecordings` respects `notes.audio_uri`

**Files:**
- Modify: `mobile/lib/audio.ts` (cleanupOrphanRecordings signature + logic)
- Modify: `mobile/app/_layout.tsx` (pass db to cleanup call)
- Test: `mobile/lib/__tests__/audio.test.ts` (extend)

- [ ] **Step 1: Write the failing test.**

Add to `mobile/lib/__tests__/audio.test.ts`:

```ts
describe('cleanupOrphanRecordings — preserves notes.audio_uri', () => {
  it('skips files listed in getNotesWithAudioUri', async () => {
    const fs = require('expo-file-system/legacy');
    fs.readDirectoryAsync.mockResolvedValue(['a.m4a', 'b.m4a', 'c.m4a']);
    fs.deleteAsync.mockClear();

    const fakeDb = {} as any;
    const { cleanupOrphanRecordings } = require('../audio');
    const { getNotesWithAudioUri } = require('../../db/db');
    jest.spyOn(require('../../db/db'), 'getNotesWithAudioUri')
      .mockResolvedValue(['/cache/b.m4a']);

    await cleanupOrphanRecordings(fakeDb);

    const deletedPaths = fs.deleteAsync.mock.calls.map((c: any) => c[0]);
    expect(deletedPaths).toContain('/cache/a.m4a');
    expect(deletedPaths).toContain('/cache/c.m4a');
    expect(deletedPaths).not.toContain('/cache/b.m4a');
  });
});
```

- [ ] **Step 2: Run, watch it fail.**

`cleanupOrphanRecordings()` currently takes no args; the test passes
`fakeDb` so calling it will currently throw or ignore. Expected: FAIL.

- [ ] **Step 3: Update `cleanupOrphanRecordings` in `mobile/lib/audio.ts`.**

```ts
import * as SQLite from 'expo-sqlite';
import { getNotesWithAudioUri } from '../db/db';

export async function cleanupOrphanRecordings(
  db: SQLite.SQLiteDatabase
): Promise<void> {
  const dir = FileSystem.cacheDirectory;
  if (!dir) return;

  const keep = new Set(await getNotesWithAudioUri(db));

  let entries: string[] = [];
  try {
    entries = await FileSystem.readDirectoryAsync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name.endsWith('.m4a') || name.endsWith('.caf')) {
      const full = dir + name;
      if (keep.has(full)) continue;
      await FileSystem.deleteAsync(full, { idempotent: true });
    }
  }
}
```

- [ ] **Step 4: Update the call site in `mobile/app/_layout.tsx`.**

Find the line:

```ts
cleanupOrphanRecordings().catch(() => {});
```

Replace with:

```ts
cleanupOrphanRecordings(db).catch(() => {});
```

(The `db` is already in scope from `useSQLiteContext()`.)

- [ ] **Step 5: Run, watch it pass.**

```bash
npm test -- --testPathPattern audio
```

Expected: PASS. The existing tests in `audio.test.ts` still need to
pass too; if any of them call `cleanupOrphanRecordings()` without an
arg, update them to pass a mocked db.

- [ ] **Step 6: Commit.**

```bash
cd /workspace
git add mobile/lib/audio.ts mobile/app/_layout.tsx mobile/lib/__tests__/audio.test.ts
git -c user.name="pjmeijer" -c user.email="pjmeijer@me.com" commit -m "feat(mobile): cleanupOrphanRecordings preserves notes.audio_uri files

Cache-dir sweep now reads notes.audio_uri NOT NULL and excludes
those URIs from deletion. Failed-transcription notes that hold a
retry handle survive the next app boot's orphan sweep.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `mobile/lib/copy.ts` — Danish UI strings

**Files:**
- Create: `mobile/lib/copy.ts`
- Test: `mobile/lib/__tests__/copy.test.ts`

- [ ] **Step 1: Write the failing test.**

Create `mobile/lib/__tests__/copy.test.ts`:

```ts
import { copy } from '../copy';

describe('copy', () => {
  it('exposes Danish strings as non-empty values', () => {
    // Spot-check a handful so missing keys fail loudly
    expect(copy.appTitle).toBe('Observationer');
    expect(copy.roster).toBe('Klasseliste');
    expect(copy.todaysNotes).toBe('Dagens noter');
    expect(copy.recording).toBe('Optager');
    expect(copy.stopAndSave).toBe('Stop & gem');
    expect(copy.cancel).toBe('Annuller');
    expect(copy.undo).toBe('Fortryd');
    expect(copy.edit).toBe('Redigér');
  });

  it('savedFor interpolates the student name', () => {
    expect(copy.savedFor('Stine')).toBe('Gemt for Stine');
    expect(copy.savedFor('Mads-Erik')).toBe('Gemt for Mads-Erik');
  });
});
```

- [ ] **Step 2: Run, watch it fail (module not found).**

```bash
npm test -- --testPathPattern copy
```

- [ ] **Step 3: Create `mobile/lib/copy.ts`.**

```ts
export const copy = {
  // Home
  appTitle: 'Observationer',
  roster: 'Klasseliste',
  todaysNotes: 'Dagens noter',
  voiceOff: 'Stemme fra',
  emptyRoster: 'Ingen elever endnu. Tilføj din første under Indstillinger.',
  emptyNotes: 'Ingen noter i dag endnu.',
  generateSummary: '＋ Lav opsummering',
  gestureHint: 'Tip — hold på en elev for at skrive en note i stedet.',

  // Recording (tile + bar)
  recording: 'Optager',
  stopAndSave: 'Stop & gem',
  cancel: 'Annuller',

  // Toast
  savedFor: (name: string) => `Gemt for ${name}`,
  undo: 'Fortryd',
  edit: 'Redigér',

  // Note modal
  save: 'Gem',
  update: 'Opdatér',
  holdToDelete: 'Hold for at slette',
  deleteConfirmTitle: 'Slet denne note?',
  deleteConfirmBody: 'Dette kan ikke fortrydes.',
  delete: 'Slet',
  noteTextarea: 'Skriv en note, eller tryk på mikrofonen for at diktere…',
  noteHeaderNote: 'Note',

  // DiscardSheet
  unsavedChanges: 'Du har ikke gemt dine ændringer',
  unsavedBody: 'Vil du gemme noten, kassere den eller fortsætte redigeringen?',
  keepEditing: 'Fortsæt redigering',
  discard: 'Kassér',

  // Settings
  settings: 'Indstillinger',
  serverUrl: 'Server',
  testConnection: 'Test forbindelse',
  addStudent: 'Tilføj elev',
  studentName: 'Elevens navn',

  // Onboarding
  onboardingTitle: 'Velkommen',
  allowMicrophone: 'Tillad mikrofon',
  startUsingApp: 'Begynd at bruge appen',
  onboardingGestureLine:
    'Når du er færdig: tryk på en elev for at optage, eller hold på en elev for at skrive en note i stedet.',
  privacyDisclosureBody:
    'Skrevne noter, transskriberet tekst, indstillinger og din klasseliste ligger udelukkende i en lokal database på denne enhed.',
  privacyDisclosureBody2:
    'Når du optager en stemmenote, sendes lydbytes til serveren netop længe nok til at blive transskriberet; intet skrives til disk. Når du laver en opsummering, sendes notens tekst til serveren for Claude. Intet gemmes efter at hvert svar er returneret.',

  // Errors
  micDeniedSnack: 'Mikrofon deaktiveret — hold på en elev for at skrive i stedet.',
  draftSavedToast: 'Gemt som kladde.',
  transcribeError: '(fejl under transskribering — tryk på noten for at prøve igen)',
  emptyRecording: '(tom optagelse)',
  summaryUpstreamError: 'Opsummeringstjenesten er midlertidigt utilgængelig. Prøv igen om et øjeblik.',
  summaryRetry: 'Prøv igen',

  // Summary screen
  draftSummary: 'Kladde — opsummering',
  draftReviewBeforeSharing: 'Kladde — gennemse før deling',
  student: 'Elev',
  date: 'Dato',
  generate: 'Generér',
  positives: 'Positive iagttagelser',
  concerns: 'Bekymringer',
  patterns: 'Mønstre',
  nextSteps: 'Forslag til næste skridt',
  rawNotes: 'Rå noter',
  copyAll: 'Kopier alt',
  noNotesAlertTitle: 'Ingen noter',
  noNotesAlertBody: (name: string) => `Ingen noter for ${name} på den valgte dag.`,
  copiedAlertTitle: 'Kopieret',
  copiedAlertBody: 'Opsummering kopieret til udklipsholder.',
  backToHome: '← Tilbage',
} as const;
```

- [ ] **Step 4: Run, watch it pass.**

```bash
npm test -- --testPathPattern copy
```

- [ ] **Step 5: Commit.**

```bash
cd /workspace
git add mobile/lib/copy.ts mobile/lib/__tests__/copy.test.ts
git -c user.name="pjmeijer" -c user.email="pjmeijer@me.com" commit -m "feat(mobile): centralize UI strings in lib/copy.ts (Danish)

All v1.1 UI text moves into a single named-constant module.
Components and screens will import from copy.X in the next task.
Factory functions for interpolation (savedFor, noNotesAlertBody)
so a future locale swap stays a single-file refactor.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Swap existing screens to use `copy.ts` (no behavior change)

**Files:**
- Modify: `mobile/app/index.tsx`
- Modify: `mobile/app/onboarding.tsx`
- Modify: `mobile/app/settings.tsx`
- Modify: `mobile/app/summary.tsx`
- Modify: `mobile/app/note/[studentId].tsx`
- Modify: `mobile/components/StudentTile.tsx`
- Modify: `mobile/components/DiscardSheet.tsx`
- Modify: `mobile/components/StatusPill.tsx`
- Modify: `mobile/components/NoteRow.tsx`

This task is purely a string-swap. Behavior stays identical. The
voice-first behavior changes ride on top in later tasks.

- [ ] **Step 1: Add `import { copy } from '../lib/copy';` (or `'../../lib/copy'` for `app/note/...`) to every screen/component that holds a Danish string. Replace every literal that maps to a `copy.X` key with the reference.**

For example, in `mobile/app/index.tsx`:

```ts
import { copy } from '../lib/copy';
// ...
<Text style={styles.title}>{copy.appTitle}</Text>
<Text style={styles.rowLabel}>{copy.voiceOff}</Text>
<Text style={styles.sectionHead}>{copy.roster}</Text>
<Text style={styles.empty}>{copy.emptyRoster}</Text>
<Text style={styles.sectionHead}>{copy.todaysNotes}</Text>
<Text style={styles.empty}>{copy.emptyNotes}</Text>
<Text style={styles.fabLabel}>{copy.generateSummary}</Text>
```

In `mobile/app/note/[studentId].tsx`, replace the textarea placeholder
("Type or tap the mic to dictate…") with `copy.noteTextarea`, the Save
button label with `copy.save`, the Update button label with
`copy.update`, the "Hold to delete" label with `copy.holdToDelete`, the
delete confirm alert title with `copy.deleteConfirmTitle` and body with
`copy.deleteConfirmBody`, etc.

In `mobile/components/DiscardSheet.tsx`, replace "You have unsaved changes",
"Save this note, discard it, or keep editing?", "Save", "Discard",
"Keep editing" with `copy.unsavedChanges`, `copy.unsavedBody`,
`copy.save`, `copy.discard`, `copy.keepEditing`.

In `mobile/app/onboarding.tsx`, replace the privacy disclosure body and
the button labels with `copy.privacyDisclosureBody`,
`copy.privacyDisclosureBody2`, `copy.allowMicrophone`,
`copy.startUsingApp`.

- [ ] **Step 2: Run all tests; nothing breaks.**

```bash
cd mobile
npm test
```

Expected: 24+ pass (the new copy test from Task 5 lifts the count).
If any test asserts on an English literal, update it to assert on
`copy.X`.

- [ ] **Step 3: Run tsc.**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit.**

```bash
cd /workspace
git add mobile/app mobile/components
git -c user.name="pjmeijer" -c user.email="pjmeijer@me.com" commit -m "$(cat <<'EOF'
refactor(mobile): swap all UI strings to copy.X (Danish, no behavior change)

Every Danish-target string now reads from lib/copy.ts; no JSX
literal remains. This is the pure string-swap pass; voice-first
behavior changes land in later tasks.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Backend — Whisper returns language via `verbose_json`

**Files:**
- Modify: `backend/app/clients/openai_client.py`
- Modify: `backend/app/routes/transcribe.py`
- Test: `backend/tests/test_transcribe.py` (extend)

- [ ] **Step 1: Write the failing test.**

Add to `backend/tests/test_transcribe.py`:

```python
from unittest.mock import patch, MagicMock

def test_transcribe_returns_text_and_language(client):
    # Patch the openai SDK call to return a verbose_json-shaped object.
    fake_resp = MagicMock(text='Det går fint i dag.', language='danish')
    with patch('app.clients.openai_client.OpenAI') as openai_ctor:
        openai_ctor.return_value.audio.transcriptions.create.return_value = fake_resp
        files = {'audio': ('a.m4a', b'fake bytes', 'audio/m4a')}
        r = client.post('/transcribe', files=files)
    assert r.status_code == 200
    body = r.json()
    assert body['text'] == 'Det går fint i dag.'
    assert body['language'] == 'danish'
```

(If `conftest.py` doesn't already wire up `OPENAI_API_KEY` for tests, add
`monkeypatch.setenv('OPENAI_API_KEY', 'sk-test')` to a fixture or the
top of the test.)

- [ ] **Step 2: Run, watch it fail (KeyError on `language`).**

```bash
cd backend
pytest tests/test_transcribe.py::test_transcribe_returns_text_and_language -v
```

- [ ] **Step 3: Update `backend/app/clients/openai_client.py`.**

```python
async def transcribe_audio(
    audio_bytes: bytes, filename: str = "audio.m4a"
) -> dict:
    """Send audio bytes to Whisper. Audio is never written to disk.
    Returns {'text': str, 'language': str | None} — verbose_json gives us
    Whisper's detected language so the mobile client can persist it on
    the note row."""
    client = get_openai()
    file_obj = io.BytesIO(audio_bytes)
    file_obj.name = filename
    resp = client.audio.transcriptions.create(
        model="whisper-1",
        file=file_obj,
        response_format="verbose_json",
    )
    # The SDK returns a Transcription object with .text and .language.
    text = getattr(resp, "text", "") or ""
    language = getattr(resp, "language", None)
    return {"text": text, "language": language}
```

- [ ] **Step 4: Update `backend/app/routes/transcribe.py`.**

Find:

```python
text = await transcribe_audio(bytes(audio_bytes), audio.filename or "audio.m4a")
```

Replace the unpacking + return:

```python
result = await transcribe_audio(bytes(audio_bytes), audio.filename or "audio.m4a")
# ...
return {"text": result["text"], "language": result.get("language")}
```

Make sure the surrounding try/except still wraps the call.

- [ ] **Step 5: Run pytest, watch it pass.**

```bash
pytest tests/test_transcribe.py -v
```

- [ ] **Step 6: Commit.**

```bash
cd /workspace
git add backend/app/clients/openai_client.py backend/app/routes/transcribe.py backend/tests/test_transcribe.py
git -c user.name="pjmeijer" -c user.email="pjmeijer@me.com" commit -m "$(cat <<'EOF'
feat(backend): /transcribe returns Whisper's detected language

Switch openai_client.transcribe_audio to verbose_json so Whisper's
language field is surfaced. Route now returns {text, language}.
Mobile will store language on the note row (not functionally used
in v1.1 — Danish hardcoded in summary prompt — but captured for
future multi-language work).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Mobile `api/transcribe.ts` wrapper

**Files:**
- Create: `mobile/api/transcribe.ts`
- Test: `mobile/api/__tests__/transcribe.test.ts`

- [ ] **Step 1: Write the failing test.**

Create `mobile/api/__tests__/transcribe.test.ts`:

```ts
import { fetchTranscript } from '../transcribe';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

describe('fetchTranscript', () => {
  it('POSTs multipart and returns text + language on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ text: 'Hej', language: 'danish' }),
    }) as any;
    const r = await fetchTranscript('https://api.example/', 'file:///cache/a.m4a');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.text).toBe('Hej');
      expect(r.language).toBe('danish');
    }
    const call = (global.fetch as any).mock.calls[0];
    expect(call[0]).toBe('https://api.example/transcribe');
    const init = call[1];
    expect(init.method).toBe('POST');
  });

  it('returns ok:false on 5xx', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ error: { code: 'openai_error', message: 'upstream' } }),
    }) as any;
    const r = await fetchTranscript('https://api.example', 'file:///a.m4a');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('openai_error');
    }
  });

  it('returns ok:false on network error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('boom')) as any;
    const r = await fetchTranscript('https://api.example', 'file:///a.m4a');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('network_error');
    }
  });
});
```

- [ ] **Step 2: Run, watch it fail (module not found).**

```bash
cd mobile
npm test -- --testPathPattern transcribe
```

- [ ] **Step 3: Create `mobile/api/transcribe.ts`.**

```ts
export type TranscribeResult =
  | { ok: true; text: string; language: string | null }
  | { ok: false; error: { code: string; message: string } };

export async function fetchTranscript(
  apiBaseUrl: string,
  audioUri: string,
  timeoutMs: number = 60_000
): Promise<TranscribeResult> {
  const url = `${apiBaseUrl.replace(/\/$/, '')}/transcribe`;
  const form = new FormData();
  form.append('audio', {
    uri: audioUri,
    name: 'audio.m4a',
    type: 'audio/m4a',
  } as any);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      body: form,
      signal: ctrl.signal,
    });
    const body = await resp.json().catch(() => ({}));
    if (resp.ok) {
      return { ok: true, text: body.text ?? '', language: body.language ?? null };
    }
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

(Why not use `callJson` from `client.ts`? Multipart with a file requires
`FormData` + `fetch`, which doesn't slot into the JSON-only helper.)

- [ ] **Step 4: Run, watch it pass.**

```bash
npm test -- --testPathPattern transcribe
```

- [ ] **Step 5: Commit.**

```bash
cd /workspace
git add mobile/api/transcribe.ts mobile/api/__tests__/transcribe.test.ts
git -c user.name="pjmeijer" -c user.email="pjmeijer@me.com" commit -m "feat(mobile): api/transcribe.ts wraps POST /transcribe

Returns {text, language} on success; ApiResult-shaped error on
upstream failure, network, or timeout. 60s default timeout matches
the existing summary wrapper.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: `useCaptureStore` (Zustand)

**Files:**
- Create: `mobile/store/useCaptureStore.ts`
- Test: `mobile/store/__tests__/useCaptureStore.test.ts`

- [ ] **Step 1: Write the failing test.**

Create `mobile/store/__tests__/useCaptureStore.test.ts`:

```ts
import { useCaptureStore } from '../useCaptureStore';

describe('useCaptureStore', () => {
  beforeEach(() => {
    useCaptureStore.setState({ recording: null, lastSaved: null });
  });

  it('start() sets recording when idle and returns true', () => {
    const ok = useCaptureStore.getState().start('student-1', { mock: 'recorder' } as any);
    expect(ok).toBe(true);
    const s = useCaptureStore.getState();
    expect(s.recording?.studentId).toBe('student-1');
    expect(typeof s.recording?.startedAt).toBe('number');
  });

  it('start() refuses (returns false) when already recording', () => {
    useCaptureStore.getState().start('student-1', { mock: 'first' } as any);
    const ok = useCaptureStore.getState().start('student-2', { mock: 'second' } as any);
    expect(ok).toBe(false);
    expect(useCaptureStore.getState().recording?.studentId).toBe('student-1');
  });

  it('stop() returns the active recording and clears state', () => {
    useCaptureStore.getState().start('s', { mock: 'r' } as any);
    const handle = useCaptureStore.getState().stop();
    expect(handle?.studentId).toBe('s');
    expect(useCaptureStore.getState().recording).toBeNull();
  });

  it('stop() returns null when not recording', () => {
    expect(useCaptureStore.getState().stop()).toBeNull();
  });

  it('markSaved() exposes lastSaved for the toast', () => {
    useCaptureStore.getState().markSaved({ noteId: 'n', studentName: 'Stine' });
    expect(useCaptureStore.getState().lastSaved?.noteId).toBe('n');
    expect(useCaptureStore.getState().lastSaved?.studentName).toBe('Stine');
  });

  it('dismissToast() clears lastSaved', () => {
    useCaptureStore.getState().markSaved({ noteId: 'n', studentName: 'Stine' });
    useCaptureStore.getState().dismissToast();
    expect(useCaptureStore.getState().lastSaved).toBeNull();
  });
});
```

- [ ] **Step 2: Run, watch it fail.**

```bash
npm test -- --testPathPattern useCaptureStore
```

- [ ] **Step 3: Create `mobile/store/useCaptureStore.ts`.**

```ts
import { create } from 'zustand';
import type { AudioRecorder } from 'expo-audio';

interface RecordingState {
  studentId: string;
  startedAt: number;
  recorder: AudioRecorder;
}

interface SavedHandle {
  noteId: string;
  studentName: string;
}

interface CaptureStore {
  recording: RecordingState | null;
  lastSaved: SavedHandle | null;
  start: (studentId: string, recorder: AudioRecorder) => boolean;
  stop: () => RecordingState | null;
  cancel: () => RecordingState | null;
  markSaved: (h: SavedHandle) => void;
  dismissToast: () => void;
}

export const useCaptureStore = create<CaptureStore>((set, get) => ({
  recording: null,
  lastSaved: null,

  start: (studentId, recorder) => {
    if (get().recording !== null) return false;
    set({ recording: { studentId, startedAt: Date.now(), recorder } });
    return true;
  },

  stop: () => {
    const r = get().recording;
    if (!r) return null;
    set({ recording: null });
    return r;
  },

  cancel: () => {
    const r = get().recording;
    if (!r) return null;
    set({ recording: null });
    return r;
  },

  markSaved: (h) => set({ lastSaved: h }),
  dismissToast: () => set({ lastSaved: null }),
}));
```

`start()` and `stop()` return values let callers chain the audio
side-effect: e.g. `const r = useCaptureStore.getState().stop(); if (r) await
stopRecording(r.recorder)`. (Note: the store's `stop()` and the audio
wrapper's `stopRecording()` are distinct — the store transitions the
state machine; the audio wrapper drives the native recorder.)

- [ ] **Step 4: Run, watch it pass.**

```bash
npm test -- --testPathPattern useCaptureStore
```

- [ ] **Step 5: Commit.**

```bash
cd /workspace
git add mobile/store/useCaptureStore.ts mobile/store/__tests__/useCaptureStore.test.ts
git -c user.name="pjmeijer" -c user.email="pjmeijer@me.com" commit -m "feat(mobile): useCaptureStore — single-recording invariant via Zustand

begin() refuses when already recording. end()/cancel() return the
active recording so the caller can drive the audio side-effects
without leaking state. markSaved/dismissToast power the post-stop
Undo/Edit toast.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: `RecordingTile` component

**Files:**
- Create: `mobile/components/RecordingTile.tsx`
- Test: `mobile/components/__tests__/RecordingTile.test.tsx`

- [ ] **Step 1: Write the failing test.**

Create the `__tests__` dir if missing, then
`mobile/components/__tests__/RecordingTile.test.tsx`:

```tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { RecordingTile } from '../RecordingTile';

describe('RecordingTile', () => {
  it('renders the student name and the recording label', () => {
    const { getByText } = render(
      <RecordingTile
        studentName="Stine"
        startedAt={Date.now()}
        onStop={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    expect(getByText('Stine')).toBeTruthy();
    expect(getByText('Optager')).toBeTruthy();
  });

  it('calls onStop when Stop & gem is pressed', () => {
    const onStop = jest.fn();
    const { getByText } = render(
      <RecordingTile studentName="Stine" startedAt={Date.now()} onStop={onStop} onCancel={jest.fn()} />
    );
    fireEvent.press(getByText('Stop & gem'));
    expect(onStop).toHaveBeenCalled();
  });

  it('calls onCancel when Annuller is pressed', () => {
    const onCancel = jest.fn();
    const { getByText } = render(
      <RecordingTile studentName="Stine" startedAt={Date.now()} onStop={jest.fn()} onCancel={onCancel} />
    );
    fireEvent.press(getByText('Annuller'));
    expect(onCancel).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, watch it fail.**

```bash
npm test -- --testPathPattern RecordingTile
```

- [ ] **Step 3: Create `mobile/components/RecordingTile.tsx`.**

```tsx
import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing } from 'react-native';
import { colors, fonts, spacing, radii, shadows } from '../lib/theme';
import { copy } from '../lib/copy';

interface Props {
  studentName: string;
  startedAt: number;
  onStop: () => void;
  onCancel: () => void;
}

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}

export function RecordingTile({ studentName, startedAt, onStop, onCancel }: Props) {
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  // Pulsing red dot
  const pulse = new Animated.Value(1);
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.55, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <View style={[styles.tile, shadows.soft]}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Animated.View style={[styles.dot, { opacity: pulse }]} />
          <Text style={styles.headerLabel}>{copy.recording}</Text>
        </View>
        <Text style={styles.timer}>{formatElapsed(now - startedAt)}</Text>
      </View>
      <Text style={styles.name} numberOfLines={1}>{studentName}</Text>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.stopAndSave}
          onPress={onStop}
          style={({ pressed }) => [styles.stop, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.stopLabel}>{copy.stopAndSave}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.cancel}
          onPress={onCancel}
          style={({ pressed }) => [styles.cancel, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.cancelLabel}>{copy.cancel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexBasis: '100%',                         // spans both columns of the 2-col grid
    backgroundColor: colors.accent,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    minHeight: 120,
    justifyContent: 'space-between',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accentText },
  headerLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.accentText, opacity: 0.85 },
  timer: { fontFamily: fonts.body, fontSize: 13, color: colors.accentText, fontVariant: ['tabular-nums'] },
  name: { fontFamily: fonts.heading, fontSize: 17, color: colors.accentText, marginVertical: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
  stop: { flex: 1, backgroundColor: colors.accentText, paddingVertical: spacing.md, borderRadius: radii.sm, alignItems: 'center' },
  stopLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.accent },
  cancel: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.accentText, alignItems: 'center', justifyContent: 'center' },
  cancelLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.accentText },
});
```

- [ ] **Step 4: Run, watch it pass.**

```bash
npm test -- --testPathPattern RecordingTile
```

- [ ] **Step 5: Commit.**

```bash
cd /workspace
git add mobile/components/RecordingTile.tsx mobile/components/__tests__/RecordingTile.test.tsx
git -c user.name="pjmeijer" -c user.email="pjmeijer@me.com" commit -m "feat(mobile): RecordingTile component — in-place recording UI

Spans both columns of the 2-col home grid. Pulsing red dot,
tabular elapsed timer, student name, big Stop & gem button +
smaller Annuller. Pure presentation; lifecycle owned by the
parent via onStop/onCancel.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: `ToastUndoEdit` component

**Files:**
- Create: `mobile/components/ToastUndoEdit.tsx`
- Test: `mobile/components/__tests__/ToastUndoEdit.test.tsx`

- [ ] **Step 1: Write the failing test.**

```tsx
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { ToastUndoEdit } from '../ToastUndoEdit';

describe('ToastUndoEdit', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  it('renders "Gemt for {name}" and the two actions', () => {
    const { getByText } = render(
      <ToastUndoEdit studentName="Stine" onUndo={jest.fn()} onEdit={jest.fn()} onTimeout={jest.fn()} />
    );
    expect(getByText('Gemt for Stine')).toBeTruthy();
    expect(getByText('Fortryd')).toBeTruthy();
    expect(getByText('Redigér')).toBeTruthy();
  });

  it('calls onTimeout after 5 seconds', () => {
    const onTimeout = jest.fn();
    render(<ToastUndoEdit studentName="Stine" onUndo={jest.fn()} onEdit={jest.fn()} onTimeout={onTimeout} />);
    act(() => { jest.advanceTimersByTime(5000); });
    expect(onTimeout).toHaveBeenCalled();
  });

  it('pressing Fortryd cancels the timeout and calls onUndo', () => {
    const onUndo = jest.fn();
    const onTimeout = jest.fn();
    const { getByText } = render(
      <ToastUndoEdit studentName="Stine" onUndo={onUndo} onEdit={jest.fn()} onTimeout={onTimeout} />
    );
    fireEvent.press(getByText('Fortryd'));
    expect(onUndo).toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(5000); });
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, watch it fail.**

- [ ] **Step 3: Create `mobile/components/ToastUndoEdit.tsx`.**

```tsx
import { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, spacing, radii } from '../lib/theme';
import { copy } from '../lib/copy';

interface Props {
  studentName: string;
  onUndo: () => void;
  onEdit: () => void;
  onTimeout: () => void;
  durationMs?: number;
}

export function ToastUndoEdit({ studentName, onUndo, onEdit, onTimeout, durationMs = 5000 }: Props) {
  const fired = useRef(false);

  useEffect(() => {
    const id = setTimeout(() => {
      fired.current = true;
      onTimeout();
    }, durationMs);
    return () => clearTimeout(id);
  }, [durationMs, onTimeout]);

  function handle(action: () => void) {
    if (fired.current) return;
    fired.current = true;
    action();
  }

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.bar}>
        <Text style={styles.msg}>{copy.savedFor(studentName)}</Text>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel={copy.undo} onPress={() => handle(onUndo)}>
            <Text style={styles.undo}>{copy.undo}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={copy.edit} onPress={() => handle(onEdit)}>
            <Text style={styles.edit}>{copy.edit}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 80, alignItems: 'center', paddingHorizontal: spacing.lg },
  bar: { backgroundColor: colors.ink, borderRadius: radii.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  msg: { fontFamily: fonts.body, fontSize: 13, color: colors.accentText },
  actions: { flexDirection: 'row', gap: spacing.lg },
  undo: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.accentSoft, padding: spacing.xs },
  edit: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.accent2, padding: spacing.xs },
});
```

- [ ] **Step 4: Run, watch it pass.**

- [ ] **Step 5: Commit.**

```bash
cd /workspace
git add mobile/components/ToastUndoEdit.tsx mobile/components/__tests__/ToastUndoEdit.test.tsx
git -c user.name="pjmeijer" -c user.email="pjmeijer@me.com" commit -m "feat(mobile): ToastUndoEdit — 5s post-save toast with Undo/Edit

Self-contained timed toast. Action vs timeout race is debounced
by a ref flag so the user can't trigger both. Caller owns the
side-effects (delete note for Undo, navigate for Edit, clear
state for Timeout).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: `StudentTile` — `onLongPress` + `disabled`

**Files:**
- Modify: `mobile/components/StudentTile.tsx`
- Test: `mobile/components/__tests__/StudentTile.test.tsx`

- [ ] **Step 1: Write the failing test.**

```tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StudentTile } from '../StudentTile';

describe('StudentTile', () => {
  it('fires onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(<StudentTile name="Stine" index={0} onPress={onPress} onLongPress={jest.fn()} />);
    fireEvent.press(getByLabelText(/Stine/));
    expect(onPress).toHaveBeenCalled();
  });

  it('fires onLongPress when long-pressed', () => {
    const onLongPress = jest.fn();
    const { getByLabelText } = render(<StudentTile name="Stine" index={0} onPress={jest.fn()} onLongPress={onLongPress} />);
    fireEvent(getByLabelText(/Stine/), 'longPress');
    expect(onLongPress).toHaveBeenCalled();
  });

  it('does not fire onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(<StudentTile name="Stine" index={0} onPress={onPress} onLongPress={jest.fn()} disabled />);
    fireEvent.press(getByLabelText(/Stine/));
    expect(onPress).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, watch it fail.**

- [ ] **Step 3: Update `mobile/components/StudentTile.tsx`.**

```tsx
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { colors, radii, spacing, fonts, shadows } from '../lib/theme';

const DOT_COLORS = ['#C4543B', '#7B9A66', '#E6A547', '#6B8FAD', '#9A6B96', '#C4543B', '#7B9A66', '#E6A547'];

interface Props {
  name: string;
  index: number;
  onPress: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  notesToday?: number;
}

export function StudentTile({ name, index, onPress, onLongPress, disabled, notesToday }: Props) {
  const dotColor = DOT_COLORS[index % DOT_COLORS.length];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Optag eller skriv en note for ${name}`}
      onPress={disabled ? undefined : onPress}
      onLongPress={disabled ? undefined : onLongPress}
      delayLongPress={500}
      disabled={disabled}
      style={({ pressed }) => [
        styles.tile,
        shadows.soft,
        pressed && !disabled && { opacity: 0.85 },
        disabled && { opacity: 0.35 },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.label} numberOfLines={1}>{name}</Text>
        {typeof notesToday === 'number' && (
          <Text style={styles.meta} numberOfLines={1}>
            {notesToday === 0 ? 'Ingen noter endnu' : notesToday === 1 ? '1 note i dag' : `${notesToday} noter i dag`}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexBasis: '48%', flexGrow: 0, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radii.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { fontFamily: fonts.heading, fontSize: 16, color: colors.ink, flexShrink: 1 },
  meta: { fontFamily: fonts.body, fontSize: 11, color: colors.inkMuted, marginTop: 2 },
});
```

The "X notes today" meta line uses inline strings rather than `copy.X`
because the pluralization is structural; if a future locale needs
different plural forms, the whole helper moves into `lib/copy.ts`.

- [ ] **Step 4: Run, watch it pass.**

- [ ] **Step 5: Commit.**

```bash
cd /workspace
git add mobile/components/StudentTile.tsx mobile/components/__tests__/StudentTile.test.tsx
git -c user.name="pjmeijer" -c user.email="pjmeijer@me.com" commit -m "feat(mobile): StudentTile — onLongPress + disabled props

Tap = primary action (recording in v1.1). Long-press = secondary
(text modal). disabled prop dims to 0.35 and blocks both gestures,
used during another tile's active recording.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Home (`app/index.tsx`) — voice-first wiring

**Files:**
- Modify: `mobile/app/index.tsx`

This is the largest UI change. No new tests beyond what we have for the
sub-components; the integration is exercised by the on-device smoke
later. Existing jest suite stays green.

- [ ] **Step 1: Replace `mobile/app/index.tsx` with the voice-first version.**

```tsx
import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Pressable, Alert } from 'react-native';
import { useRouter, useFocusEffect, Link } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listActiveStudents, getNotesForLocalDate, getSetting, setSetting, addNote, deleteNote, Student } from '../db/db';
import { StudentTile } from '../components/StudentTile';
import { RecordingTile } from '../components/RecordingTile';
import { NoteRow } from '../components/NoteRow';
import { StatusPill } from '../components/StatusPill';
import { ToastUndoEdit } from '../components/ToastUndoEdit';
import { useCaptureStore } from '../store/useCaptureStore';
import { ensurePermission, useRecorder, startRecording, stopRecording, deleteRecording } from '../lib/audio';
import { fetchTranscript } from '../api/transcribe';
import { DEFAULT_API_BASE_URL } from '../api/config';
import { colors, fonts, spacing, radii } from '../lib/theme';
import { localYmd } from '../lib/dates';
import { copy } from '../lib/copy';

export default function Home() {
  const db = useSQLiteContext();
  const router = useRouter();
  const recorder = useRecorder();
  const recording = useCaptureStore(s => s.recording);
  const lastSaved = useCaptureStore(s => s.lastSaved);

  const [students, setStudents] = useState<Student[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [voiceOn, setVoiceOn] = useState(true);
  const [apiUrl, setApiUrl] = useState('');
  const [showHint, setShowHint] = useState(false);

  const reload = useCallback(async () => {
    setStudents(await listActiveStudents(db));
    setNotes(await getNotesForLocalDate(db, localYmd()));
    setVoiceOn((await getSetting(db, 'voice_on')) !== '0');
    setApiUrl((await getSetting(db, 'api_base_url')) || DEFAULT_API_BASE_URL);
    setShowHint((await getSetting(db, 'gesture_hint_dismissed')) !== '1');
  }, [db]);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  async function toggleVoice(next: boolean) {
    setVoiceOn(next);
    await setSetting(db, 'voice_on', next ? '1' : '0');
  }

  async function handleTapTile(s: Student) {
    if (recording !== null) return;                     // covered by disabled tiles, defense in depth
    if (!voiceOn || s.recording_enabled === 0) {
      router.push(`/note/${s.id}`);
      return;
    }
    const granted = await ensurePermission();
    if (!granted) {
      Alert.alert(copy.micDeniedSnack);
      return;
    }
    const started = useCaptureStore.getState().start(s.id, recorder);
    if (!started) return;
    try {
      await startRecording(recorder);
    } catch (e) {
      // Recorder failed to start — clear state, do nothing visible.
      useCaptureStore.getState().cancel();
    }
  }

  async function handleLongPressTile(s: Student) {
    router.push(`/note/${s.id}`);
    if (showHint) {
      await setSetting(db, 'gesture_hint_dismissed', '1');
      setShowHint(false);
    }
  }

  async function handleStop() {
    const r = useCaptureStore.getState().stop();
    if (!r) return;
    const audio = await stopRecording(r.recorder);
    if (!audio) return;

    const student = students.find(x => x.id === r.studentId);
    const studentName = student?.name ?? '';

    const result = await fetchTranscript(apiUrl, audio.uri);
    if (result.ok) {
      const text = result.text.trim();
      if (text === '') {
        const { id: noteId } = await addNote(db, { studentId: r.studentId, text: copy.emptyRecording, language: result.language, audioUri: null });
        await deleteRecording(audio.uri);
        useCaptureStore.getState().markSaved({ noteId, studentName });
      } else {
        const { id: noteId } = await addNote(db, { studentId: r.studentId, text, language: result.language, audioUri: null });
        await deleteRecording(audio.uri);
        useCaptureStore.getState().markSaved({ noteId, studentName });
      }
    } else {
      // 5xx or offline: keep the audio file, save a placeholder note with audio_uri for retry.
      const { id: noteId } = await addNote(db, { studentId: r.studentId, text: copy.transcribeError, language: null, audioUri: audio.uri });
      useCaptureStore.getState().markSaved({ noteId, studentName });
    }
    await reload();
  }

  async function handleCancel() {
    const r = useCaptureStore.getState().cancel();
    if (!r) return;
    try {
      await stopRecording(r.recorder);
    } catch {}
    // best-effort discard; orphan cleanup will sweep anything left over
    const uri = r.recorder.uri;
    if (uri) await deleteRecording(uri);
  }

  async function handleUndo() {
    const s = lastSaved;
    if (!s) return;
    useCaptureStore.getState().dismissToast();
    await deleteNote(db, s.noteId);
    await reload();
  }

  function handleEdit() {
    const s = lastSaved;
    if (!s) return;
    useCaptureStore.getState().dismissToast();
    router.push(`/note/${students.find(st => st.name === s.studentName)?.id ?? ''}?noteId=${s.noteId}`);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <View style={styles.topBar}>
          <Text style={styles.title}>{copy.appTitle}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <StatusPill ok={true} />
            <Link href="/settings" asChild>
              <Pressable accessibilityRole="button" accessibilityLabel={copy.settings}>
                <Text style={{ fontSize: 20 }}>⚙</Text>
              </Pressable>
            </Link>
          </View>
        </View>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>{copy.voiceOff}</Text>
          <Switch value={!voiceOn} onValueChange={(v) => toggleVoice(!v)} disabled={recording !== null} />
        </View>

        <Text style={styles.sectionHead}>{copy.roster}</Text>
        {students.length === 0 ? (
          <Text style={styles.empty}>{copy.emptyRoster}</Text>
        ) : (
          <View style={styles.grid}>
            {students.map((s, i) => {
              const isRecording = recording?.studentId === s.id;
              const isOther = recording !== null && !isRecording;
              const noteCount = notes.filter(n => n.student_id === s.id).length;
              if (isRecording) {
                return <RecordingTile key={s.id} studentName={s.name} startedAt={recording!.startedAt} onStop={handleStop} onCancel={handleCancel} />;
              }
              return (
                <StudentTile
                  key={s.id}
                  name={s.name}
                  index={i}
                  notesToday={noteCount}
                  onPress={() => handleTapTile(s)}
                  onLongPress={() => handleLongPressTile(s)}
                  disabled={isOther}
                />
              );
            })}
          </View>
        )}

        {showHint && students.length > 0 && (
          <Text style={styles.gestureHint}>{copy.gestureHint}</Text>
        )}

        <Text style={styles.sectionHead}>{copy.todaysNotes}</Text>
        {notes.length === 0 ? (
          <Text style={styles.empty}>{copy.emptyNotes}</Text>
        ) : (
          notes.map((n) => (
            <NoteRow
              key={n.id}
              studentName={n.student_name}
              text={n.text}
              createdAt={n.created_at}
              onPress={() => recording === null && router.push(`/note/${n.student_id}?noteId=${n.id}`)}
            />
          ))
        )}
      </ScrollView>

      {lastSaved && (
        <ToastUndoEdit
          studentName={lastSaved.studentName}
          onUndo={handleUndo}
          onEdit={handleEdit}
          onTimeout={() => useCaptureStore.getState().dismissToast()}
        />
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.generateSummary}
        onPress={() => recording === null && router.push('/summary')}
        disabled={recording !== null}
        style={({ pressed }) => [styles.fab, { opacity: recording !== null ? 0.5 : pressed ? 0.85 : 1 }]}
      >
        <Text style={styles.fabLabel}>{copy.generateSummary}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  title: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xs, marginBottom: spacing.sm },
  rowLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.inkMuted },
  sectionHead: { fontFamily: fonts.heading, fontSize: 14, color: colors.ink, marginTop: spacing.md, marginBottom: spacing.sm },
  empty: { fontFamily: fonts.bodyItalic ?? fonts.body, fontSize: 13, color: colors.inkMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm },
  gestureHint: { fontFamily: fonts.body, fontSize: 11, color: colors.inkMuted, fontStyle: 'italic', marginTop: spacing.xs, marginBottom: spacing.sm },
  fab: { position: 'absolute', bottom: spacing.lg, right: spacing.lg, backgroundColor: colors.accent, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: 999 },
  fabLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.accentText },
});
```

(`fonts.bodyItalic` may not exist; use `fonts.body` as fallback. Check
`mobile/lib/theme.ts` and pick what's available.)

- [ ] **Step 2: Run jest.**

```bash
cd mobile
npm test
```

Expected: all green.

- [ ] **Step 3: Run tsc.**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit.**

```bash
cd /workspace
git add mobile/app/index.tsx
git -c user.name="pjmeijer" -c user.email="pjmeijer@me.com" commit -m "$(cat <<'EOF'
feat(mobile): voice-first home screen

Tap a tile → start recording inline; long-press → text modal.
Recording tile spans 2 cols, others dim, voice-off switch dims
and disables, generate FAB dims and disables. Stop → POST
/transcribe → save note + show ToastUndoEdit for 5s; offline/5xx
saves a placeholder note with audio_uri for later retry. Cancel
discards. One-time gesture hint under the roster, suppressed via
gesture_hint_dismissed setting once the teacher long-presses
once.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: `RecordingBar` component (used inside the text modal)

**Files:**
- Create: `mobile/components/RecordingBar.tsx`
- Test: `mobile/components/__tests__/RecordingBar.test.tsx`

- [ ] **Step 1: Write the failing test.**

```tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { RecordingBar } from '../RecordingBar';

describe('RecordingBar', () => {
  it('renders Optager + timer + Stop & gem + Annuller', () => {
    const { getByText } = render(
      <RecordingBar startedAt={Date.now()} onStop={jest.fn()} onCancel={jest.fn()} />
    );
    expect(getByText(/Optager/)).toBeTruthy();
    expect(getByText('Stop & gem')).toBeTruthy();
    expect(getByText('Annuller')).toBeTruthy();
  });
  it('onStop and onCancel fire from their buttons', () => {
    const onStop = jest.fn();
    const onCancel = jest.fn();
    const { getByText } = render(<RecordingBar startedAt={Date.now()} onStop={onStop} onCancel={onCancel} />);
    fireEvent.press(getByText('Stop & gem'));
    fireEvent.press(getByText('Annuller'));
    expect(onStop).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, watch it fail.**

- [ ] **Step 3: Create `mobile/components/RecordingBar.tsx`.**

```tsx
import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, spacing, radii } from '../lib/theme';
import { copy } from '../lib/copy';

interface Props {
  startedAt: number;
  onStop: () => void;
  onCancel: () => void;
}

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}

export function RecordingBar({ startedAt, onStop, onCancel }: Props) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  return (
    <View style={styles.bar}>
      <Text style={styles.label}>{copy.recording} {formatElapsed(now - startedAt)}</Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Pressable accessibilityRole="button" accessibilityLabel={copy.stopAndSave} onPress={onStop} style={styles.stop}>
          <Text style={styles.stopLabel}>{copy.stopAndSave}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={copy.cancel} onPress={onCancel} style={styles.cancel}>
          <Text style={styles.cancelLabel}>{copy.cancel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.accent, padding: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.accentText, fontVariant: ['tabular-nums'] },
  stop: { backgroundColor: colors.accentText, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.sm },
  stopLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.accent },
  cancel: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.accentText },
  cancelLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.accentText },
});
```

- [ ] **Step 4: Run, watch it pass.**

- [ ] **Step 5: Commit.**

```bash
cd /workspace
git add mobile/components/RecordingBar.tsx mobile/components/__tests__/RecordingBar.test.tsx
git -c user.name="pjmeijer" -c user.email="pjmeijer@me.com" commit -m "feat(mobile): RecordingBar component — in-modal recording UI

Terracotta bar with timer + Stop & gem + Annuller. Used inside
the text modal, anchored above the keyboard via the modal's
KeyboardAvoidingView.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: Text modal — wire mic chip + RecordingBar, swipe-down dismiss, append at cursor

**Files:**
- Modify: `mobile/app/note/[studentId].tsx`

This task replaces the misleading Alert mic button with the real
recording flow inside the modal.

- [ ] **Step 1: Replace `mobile/app/note/[studentId].tsx` with the wired version.**

```tsx
import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addNote, updateNote, deleteNote, getNote, listActiveStudents, getSetting, Student } from '../../db/db';
import { DiscardSheet } from '../../components/DiscardSheet';
import { RecordingBar } from '../../components/RecordingBar';
import { useCaptureStore } from '../../store/useCaptureStore';
import { ensurePermission, useRecorder, startRecording, stopRecording, deleteRecording } from '../../lib/audio';
import { fetchTranscript } from '../../api/transcribe';
import { DEFAULT_API_BASE_URL } from '../../api/config';
import { colors, fonts, spacing, radii, shadows } from '../../lib/theme';
import { copy } from '../../lib/copy';

const MAX_LEN = 5000;

export default function NoteModal() {
  const db = useSQLiteContext();
  const router = useRouter();
  const navigation = useNavigation();
  const recorder = useRecorder();
  const { studentId, noteId } = useLocalSearchParams<{ studentId: string; noteId?: string }>();
  const [student, setStudent] = useState<Student | null>(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const [apiUrl, setApiUrl] = useState('');
  const [text, setText] = useState('');
  const [initialText, setInitialText] = useState('');
  const [discardVisible, setDiscardVisible] = useState(false);
  const [selection, setSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const pendingActionRef = useRef<unknown>(null);
  const recording = useCaptureStore(s => s.recording);
  const recordingInThisModal = recording?.studentId === studentId;

  useEffect(() => {
    (async () => {
      const all = await listActiveStudents(db);
      const s = all.find(x => x.id === studentId);
      setStudent(s || null);
      setVoiceOn((await getSetting(db, 'voice_on')) !== '0');
      setApiUrl((await getSetting(db, 'api_base_url')) || DEFAULT_API_BASE_URL);
      if (noteId) {
        const n = await getNote(db, noteId);
        if (n) {
          setText(n.text);
          setInitialText(n.text);
          setSelection({ start: n.text.length, end: n.text.length });
        }
      }
    })();
  }, [studentId, noteId, db]);

  const dirty = text !== initialText;
  const editing = !!noteId;
  const allowLeaveRef = useRef(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', async (e: any) => {
      if (recording !== null && recordingInThisModal) {
        e.preventDefault();
        // Cancel the recording first, then re-fire the dismissal so the dirty check runs again.
        const r = useCaptureStore.getState().cancel();
        if (r) {
          try { await stopRecording(r.recorder); } catch {}
          if (r.recorder.uri) await deleteRecording(r.recorder.uri);
        }
        // re-attempt the original navigation
        navigation.dispatch(e.data.action);
        return;
      }
      if (!dirty || allowLeaveRef.current) return;
      e.preventDefault();
      pendingActionRef.current = e.data.action;
      setDiscardVisible(true);
    });
    return unsubscribe;
  }, [navigation, dirty, recording, recordingInThisModal]);

  function dispatchPending() {
    allowLeaveRef.current = true;
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    if (action) navigation.dispatch(action as any);
    else router.back();
  }

  function handleClose() {
    if (recording !== null && recordingInThisModal) {
      // route the same way as the navigation listener
      router.back();
      return;
    }
    if (dirty) setDiscardVisible(true);
    else {
      allowLeaveRef.current = true;
      router.back();
    }
  }

  async function handleSave() {
    if (!text.trim()) return;
    if (noteId) await updateNote(db, noteId, text);
    else if (student) await addNote(db, { studentId: student.id, text });
    dispatchPending();
  }

  function handleDiscard() {
    setDiscardVisible(false);
    dispatchPending();
  }

  async function handleDelete() {
    Alert.alert(copy.deleteConfirmTitle, copy.deleteConfirmBody, [
      { text: copy.cancel, style: 'cancel' },
      { text: copy.delete, style: 'destructive', onPress: async () => {
        if (noteId) {
          await deleteNote(db, noteId);
          allowLeaveRef.current = true;
          router.back();
        }
      } },
    ]);
  }

  async function handleMicTap() {
    if (recording !== null) return;
    if (!voiceOn || student?.recording_enabled === 0) return;
    const granted = await ensurePermission();
    if (!granted) {
      Alert.alert(copy.micDeniedSnack);
      return;
    }
    const started = useCaptureStore.getState().start(studentId, recorder);
    if (!started) return;
    try {
      await startRecording(recorder);
    } catch {
      useCaptureStore.getState().cancel();
    }
  }

  async function handleStopAndAppend() {
    const r = useCaptureStore.getState().stop();
    if (!r) return;
    const audio = await stopRecording(r.recorder);
    if (!audio) return;
    const result = await fetchTranscript(apiUrl, audio.uri);
    await deleteRecording(audio.uri);
    if (!result.ok) {
      Alert.alert(copy.summaryUpstreamError);   // shared friendly upstream-error string
      return;
    }
    const transcript = result.text.trim();
    if (!transcript) return;
    setText(prev => prev.slice(0, selection.start) + transcript + prev.slice(selection.end));
    const newPos = selection.start + transcript.length;
    setSelection({ start: newPos, end: newPos });
  }

  async function handleBarCancel() {
    const r = useCaptureStore.getState().cancel();
    if (!r) return;
    try { await stopRecording(r.recorder); } catch {}
    if (r.recorder.uri) await deleteRecording(r.recorder.uri);
  }

  const micAllowed = voiceOn && student?.recording_enabled === 1 && recording === null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Text style={styles.title}>{student?.name ?? copy.noteHeaderNote}</Text>
          <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.recording}
              disabled={!micAllowed}
              onPress={handleMicTap}
              style={[styles.micToggle, { backgroundColor: micAllowed ? colors.accentSoft : colors.surface2, opacity: micAllowed ? 1 : 0.5 }]}
            >
              <Text style={{ fontSize: 14 }}>🎙</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={copy.cancel} onPress={handleClose}>
              <Text style={styles.x}>✕</Text>
            </Pressable>
          </View>
        </View>

        <TextInput
          autoFocus
          multiline
          value={text}
          onChangeText={(t) => setText(t.slice(0, MAX_LEN))}
          onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
          selection={selection}
          placeholder={copy.noteTextarea}
          placeholderTextColor={colors.inkMuted}
          style={styles.textarea}
        />

        {recordingInThisModal && (
          <RecordingBar startedAt={recording!.startedAt} onStop={handleStopAndAppend} onCancel={handleBarCancel} />
        )}

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={handleSave}
            disabled={!text.trim()}
            style={[styles.saveBtn, !text.trim() && { opacity: 0.5 }, shadows.soft]}
          >
            <Text style={styles.saveLabel}>{editing ? copy.update : copy.save}</Text>
          </Pressable>
        </View>

        {editing && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.holdToDelete}
            onLongPress={handleDelete}
            delayLongPress={800}
            style={styles.deleteBtn}
          >
            <Text style={styles.deleteLabel}>{copy.holdToDelete}</Text>
          </Pressable>
        )}

        <DiscardSheet
          visible={discardVisible}
          onSave={async () => { setDiscardVisible(false); await handleSave(); }}
          onDiscard={handleDiscard}
          onKeepEditing={() => setDiscardVisible(false)}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink },
  micToggle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  x: { fontSize: 22, color: colors.inkMuted },
  textarea: { flex: 1, padding: spacing.lg, fontFamily: fonts.body, fontSize: 16, color: colors.ink, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, alignItems: 'center' },
  saveBtn: { flex: 1, backgroundColor: colors.accent2, paddingVertical: spacing.md, borderRadius: radii.md, alignItems: 'center' },
  saveLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.accentText },
  deleteBtn: { alignSelf: 'center', padding: spacing.md, marginBottom: spacing.lg },
  deleteLabel: { fontFamily: fonts.headingItalic, fontSize: 13, color: colors.danger },
});
```

Notes:
- The big bottom mic button + Alert ("Coming up next") is gone.
- The header mic chip is now functional (`handleMicTap`).
- `RecordingBar` renders only when `recordingInThisModal` is true.
- `Stop & gem` inside the modal calls `handleStopAndAppend` which
  inserts the transcript at the current `selection`.
- `KeyboardAvoidingView` keeps the recording bar above the keyboard
  on iOS; Android relies on its native window-soft-input behavior.

- [ ] **Step 2: Run jest.**

```bash
cd mobile
npm test
```

- [ ] **Step 3: Run tsc.**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit.**

```bash
cd /workspace
git add mobile/app/note/[studentId].tsx
git -c user.name="pjmeijer" -c user.email="pjmeijer@me.com" commit -m "$(cat <<'EOF'
feat(mobile): wire mic in text modal — transcript appends at cursor

- Mic chip in modal header is functional (was an Alert "Coming
  up next" — gone).
- Big bottom mic button removed.
- Tapping the mic chip starts a recording, shows the RecordingBar
  above the keyboard via KeyboardAvoidingView.
- Stop & gem appends the Whisper transcript at the current
  selection position; modal stays open for further edits.
- Annuller discards the recording without saving.
- Dismissing the modal while recording cancels the recording
  first, then runs the existing dirty-check / DiscardSheet flow.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: iOS modal swipe-down dismiss

**Files:**
- Modify: `mobile/app/_layout.tsx`

The `/note/[studentId]` route currently renders as a stacked screen.
Setting `presentation="modal"` on iOS gives the native swipe-down
gesture for free. Android uses the native back gesture (no extra
work in v1.1; spec explicitly defers Android `PanResponder`).

- [ ] **Step 1: Update the `Stack` in `mobile/app/_layout.tsx`.**

Find the `<Stack ... />` line and replace:

```tsx
<Stack
  screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}
>
  <Stack.Screen name="note/[studentId]" options={{ presentation: 'modal' }} />
</Stack>
```

(Expo Router accepts `<Stack.Screen>` children for per-route overrides;
other routes inherit the parent options.)

- [ ] **Step 2: Run tsc.**

```bash
cd mobile
npx tsc --noEmit
```

- [ ] **Step 3: Commit.**

```bash
cd /workspace
git add mobile/app/_layout.tsx
git -c user.name="pjmeijer" -c user.email="pjmeijer@me.com" commit -m "feat(mobile): note modal uses iOS native modal presentation

Adds the native swipe-down dismiss gesture on iOS. Android keeps
the existing back-button behavior (PanResponder fallback for
Android is explicitly out of scope for v1.1 per the spec).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 17: Backend — SYSTEM_PROMPT + friendly error envelope

**Files:**
- Modify: `backend/app/clients/anthropic_client.py`
- Modify: `backend/app/routes/summary.py` (error wrap)
- Test: `backend/tests/test_summary.py` (extend)

- [ ] **Step 1: Write the failing tests.**

Add to `backend/tests/test_summary.py`:

```python
from unittest.mock import patch, MagicMock

def _mock_anthropic_response(text_block: dict):
    """Build a fake Anthropic response with a single tool_use block."""
    block = MagicMock()
    block.type = 'tool_use'
    block.name = 'produce_summary'
    block.input = text_block
    resp = MagicMock()
    resp.content = [block]
    return resp


def test_summary_third_person_no_first_person(client):
    fake = _mock_anthropic_response({
        'positives': 'Eleven deltog aktivt i samlingen.',
        'concerns': 'Ingen tydelige bekymringer i dag.',
        'patterns': 'Roen kom efter ca. 10 minutter.',
        'next_steps': 'Fortsæt at observere overgangen efter frokost.',
    })
    with patch('app.clients.anthropic_client.Anthropic') as A:
        A.return_value.messages.create.return_value = fake
        r = client.post('/summary', json={
            'student_name': 'Stine',
            'notes': [{'ts': 1700000000000, 'text': 'Det går fint i dag.'}],
        })
    assert r.status_code == 200
    body = r.json()
    for k in ['positives', 'concerns', 'patterns', 'next_steps']:
        s = body[k].lower()
        # First-person red flags in Danish:
        assert ' jeg ' not in f' {s} '
        assert ' mig ' not in f' {s} '
        assert ' min ' not in f' {s} '

def test_summary_anthropic_5xx_friendly_message(client):
    from anthropic import APIStatusError
    err = APIStatusError(message='upstream meltdown', response=MagicMock(status_code=500, request_id='req_123'), body={'type':'error'})
    with patch('app.clients.anthropic_client.Anthropic') as A:
        A.return_value.messages.create.side_effect = err
        r = client.post('/summary', json={
            'student_name': 'Stine',
            'notes': [{'ts': 1, 'text': 'a'}],
        })
    assert r.status_code == 502
    body = r.json()
    msg = body['error']['message']
    # No raw Python repr leaking
    assert "{'type':" not in msg
    assert "<MagicMock" not in msg
    # Friendly Danish-or-English phrasing + request_id for support
    assert 'req_123' in msg or 'try again' in msg.lower()
```

- [ ] **Step 2: Run, watch them fail.**

```bash
cd backend
pytest tests/test_summary.py -v
```

The first test will probably fail because the current prompt sometimes
produces "Jeg" — running it once against the mocked response should
PASS, but the real risk is in production prompting (the test only
validates the contract). Treat both tests as gates against future
regressions.

If the first test passes against the mock (since the mock returns
pre-baked Danish), that's expected. Run anyway to confirm.

- [ ] **Step 3: Update `SYSTEM_PROMPT` in `backend/app/clients/anthropic_client.py`.**

Replace the existing `SYSTEM_PROMPT = (...)` with:

```python
SYSTEM_PROMPT = (
    "You are an assistant to a special-education teacher in Denmark.\n"
    "\n"
    "You will receive that day's OBSERVATION NOTES — brief notes the "
    "teacher has written (or dictated) about what she observed about ONE "
    "student during the school day. The notes are the teacher's "
    "third-person observations of the student's behavior. They are NOT "
    "the student's own voice, NOT a transcript of the student speaking, "
    "and NOT the student's introspection. Even when a note is terse and "
    "could be read as first-person (e.g. \"Det går fint i dag.\" = "
    "\"Doing fine today.\"), the implied subject is THE STUDENT, observed "
    "by the teacher.\n"
    "\n"
    "Produce a four-section draft using the `produce_summary` tool, "
    "written from the teacher's observational stance:\n"
    "\n"
    "1. Third-person about the student. Use the student's name or \"eleven\" "
    "(\"the student\"). Never use first-person on the student's behalf "
    "(no \"jeg\", no \"mig\").\n"
    "2. Quote observed behaviors, not interpretations of internal states.\n"
    "   - Good: \"Eleven blev ved sit bord under hele lektionen og deltog "
    "i samlingen.\"\n"
    "   - Good: \"Stine virkede urolig efter frokost, men fandt ro efter "
    "ca. 10 minutter ved hjælp af sansestimulering.\"\n"
    "   - Wrong (first-person on the student's behalf): \"Jeg var rolig "
    "i dag.\"\n"
    "   - Wrong (internal-state guess): \"Eleven følte sig glad.\"\n"
    "3. Draft, not finished document. The teacher will review before "
    "sharing. Flag gaps (\"no observations were captured during PE\") and "
    "recommend next observations; do not paper over missing data.\n"
    "\n"
    "Write the response IN DANISH. The teacher, parents, and school are "
    "Danish. All four section fields must be Danish prose, regardless of "
    "what language any individual note happens to be written in.\n"
)
```

- [ ] **Step 4: Update the error path in `backend/app/routes/summary.py`.**

Replace the existing `except Exception as e: raise err(...)` block with:

```python
    try:
        raw = await generate_summary(req.student_name, [n.model_dump() for n in req.notes])
    except Exception as e:
        # Stop leaking Python repr of upstream dicts. Treat 5xx as friendly
        # message + request_id; everything else falls back to str(e).
        from anthropic import APIStatusError
        if isinstance(e, APIStatusError) and 500 <= getattr(e, 'status_code', 0) < 600:
            rid = getattr(getattr(e, 'response', None), 'request_id', None) or getattr(e, 'request_id', None)
            msg = "The summary service is temporarily unavailable. Please try again shortly."
            if rid:
                msg = f"{msg} (request_id: {rid})"
            raise err("anthropic_error", msg, status=502)
        raise err("anthropic_error", str(e), status=502)
```

(Mobile renders `error.message` to the user; the friendly string is the
last hop before the screen so there's no need to make it Danish at the
backend — mobile maps `code === 'anthropic_error'` to
`copy.summaryUpstreamError` in Task 18.)

- [ ] **Step 5: Run pytest, watch the new tests pass.**

```bash
cd backend
pytest tests/test_summary.py -v
```

- [ ] **Step 6: Commit.**

```bash
cd /workspace
git add backend/app/clients/anthropic_client.py backend/app/routes/summary.py backend/tests/test_summary.py
git -c user.name="pjmeijer" -c user.email="pjmeijer@me.com" commit -m "$(cat <<'EOF'
feat(backend): lock SYSTEM_PROMPT to Danish third-person + friendly 5xx

- SYSTEM_PROMPT rewritten with explicit agency (teacher observes,
  student is subject), Danish output mandate, four anchor examples
  (two good Danish observations, two wrong: first-person on the
  student's behalf and internal-state guess).
- /summary 5xx no longer leaks Python repr of the upstream dict.
  Returns a friendly English message + request_id; mobile maps the
  code to a Danish copy string.
- pytest gates: regression against first-person language in
  response, and friendly-message + no-raw-repr on 5xx.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 18: Mobile summary screen — Danish copy + friendly error + retry

**Files:**
- Modify: `mobile/app/summary.tsx`

- [ ] **Step 1: Replace the error-rendering block and section labels in `mobile/app/summary.tsx` with copy references + a retry button.**

Find this block (around line 65):

```ts
if (r.ok) setSections(r.sections);
else setErrorMsg(`${r.error.code}: ${r.error.message}`);
```

Replace with:

```ts
if (r.ok) setSections(r.sections);
else {
  // Map anthropic_error to the friendly Danish copy; everything else
  // gets the server's message but only the message — never the code.
  if (r.error.code === 'anthropic_error') {
    setErrorMsg(copy.summaryUpstreamError);
  } else {
    setErrorMsg(r.error.message);
  }
}
```

Below the error message in the JSX, add a retry button (find the spot
that currently renders the error message and add a `PrimaryButton`
labeled `copy.summaryRetry` that calls `generate()`).

Also swap all section labels: `Positives → copy.positives`, `Concerns →
copy.concerns`, etc. Swap `Draft summary` heading to
`copy.draftSummary`. Swap the per-section subtitle to
`copy.draftReviewBeforeSharing`. Swap `Student / Date / Generate / Raw
notes / Copy all / ← Back` to copy equivalents. Replace the `Alert`
calls with copy equivalents.

- [ ] **Step 2: Run jest + tsc.**

```bash
cd mobile
npm test
npx tsc --noEmit
```

- [ ] **Step 3: Commit.**

```bash
cd /workspace
git add mobile/app/summary.tsx
git -c user.name="pjmeijer" -c user.email="pjmeijer@me.com" commit -m "feat(mobile): summary screen — friendly upstream errors + Danish copy

- anthropic_error renders copy.summaryUpstreamError (friendly
  Danish), not the raw error envelope.
- Retry button added next to the error message.
- All headings + section titles + alerts swapped to copy.X.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 19: Onboarding gesture line

**Files:**
- Modify: `mobile/app/onboarding.tsx`

- [ ] **Step 1: Find a place in `mobile/app/onboarding.tsx` to render the gesture summary just below "Tillad mikrofon" / before the "Begynd at bruge appen" button. Add:**

```tsx
<Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.inkMuted, marginTop: spacing.md, marginBottom: spacing.md }}>
  {copy.onboardingGestureLine}
</Text>
```

- [ ] **Step 2: Run tsc.**

```bash
cd mobile
npx tsc --noEmit
```

- [ ] **Step 3: Commit.**

```bash
cd /workspace
git add mobile/app/onboarding.tsx
git -c user.name="pjmeijer" -c user.email="pjmeijer@me.com" commit -m "feat(mobile): onboarding shows the tap/long-press gesture summary

One-line Danish primer so teachers know tap = record, long-press
= type before they hit the home screen the first time. The
inline gesture hint on home is the backup for anyone who skips
or forgets.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 20: Final in-container verification

**Files:** none (verification only)

- [ ] **Step 1: Full jest run.**

```bash
cd mobile
npm test
```

Expected: all green (count > 24 thanks to the new test files).

- [ ] **Step 2: TypeScript check.**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Backend pytest.**

```bash
cd ../backend
pytest -v
```

Expected: all green.

- [ ] **Step 4: STOP — do not commit; this task is verification only. If anything fails, return to the relevant task and fix.**

---

## Task 21: Codex review of the v1.1 diff

**Files:** none (review only)

- [ ] **Step 1: Inspect the diff from `feat/v1-implementation`.**

```bash
cd /workspace
git log --oneline feat/v1-implementation..HEAD
git diff feat/v1-implementation..HEAD --stat
```

Confirm files match the spec: copy.ts new, useCaptureStore new,
RecordingTile/RecordingBar/ToastUndoEdit new, db migrations + db.ts +
audio.ts edits, app/index.tsx + note + summary + onboarding + _layout
edits, backend openai_client/anthropic_client/summary edits,
matching test files.

- [ ] **Step 2: Invoke `/codex review`.**

In the controller session:

```
/codex review
```

Pass this scope context:

> Review the diff vs feat/v1-implementation. Goal: voice-first capture
> (tile-tap records inline, long-press = text modal, modal mic chip
> wired, Whisper language stored, summary prompt locked to Danish
> third-person observational, friendlier 5xx envelopes). Scrutinize:
> (1) single-recording invariant — any path where two recordings can
> start? (2) audio-file leak paths — does every state transition that
> drops the recorder also delete the file? (3) SYSTEM_PROMPT — does
> it actually prevent first-person on the student's behalf for terse
> Danish notes? (4) `notes.audio_uri` lifecycle vs
> `cleanupOrphanRecordings` — are the URI formats consistent
> (`file://...` vs `/cache/...`)? (5) copy.ts coverage — any JSX
> still holding inline English? (6) error-envelope cleanup — any
> remaining raw-repr path?

- [ ] **Step 3: Address findings.** Fix anything `[P1]` before merge;
treat `[P2]` items as decisions for the controller (defer or fix).

- [ ] **Step 4: Final verification re-run.**

```bash
cd /workspace/mobile && npm test && npx tsc --noEmit
cd /workspace/backend && pytest -v
```

Expected: all green.

---

## Task 22: Stop for on-device smoke test

**Files:** none (handoff to user)

- [ ] **Step 1: Print the manual checklist for the user.**

User runs from Windows on the SDK-54 build:

```
□ Tap a tile → recording state visible (red tile spans 2 cols, others dim) → tap Stop & gem → toast "Gemt for Stine" appears → tap Edit → modal opens with the transcript
□ Tap Cancel mid-recording → no toast, audio file gone
□ Long-press tile → modal opens (no recording started)
□ Inside modal: place cursor mid-line → tap mic chip → recording bar appears above keyboard → speak → Stop & gem → transcript inserted AT CURSOR (not at end)
□ Settings → change voice-off switch on → tap a tile → modal opens directly (no recording starts)
□ iOS Settings → disable mic for app → tap a tile → snackbar (no crash)
□ Stop backend → tap → record → Stop & gem → placeholder "(fejl under transskribering…)" note saved with Undo/Edit toast; reopen the note and confirm the audio file persists
□ Run summary on a day with Danish notes → response is in Danish, third-person ("Eleven…"), no "Jeg/mig/min" in the prose
□ Trigger an Anthropic 5xx (turn off ANTHROPIC_API_KEY temporarily) → summary screen shows friendly Danish message + retry button, no raw repr
```

- [ ] **Step 2: Wait for user confirmation. Do NOT FF-merge until user reports all checks pass.**

---

## Task 23: FF-merge into `feat/v1-implementation`

**Files:** none

Only after Task 22 passes.

- [ ] **Step 1: Fast-forward merge.**

```bash
cd /workspace
git checkout feat/v1-implementation
git merge --ff-only feat/voice-first-capture
```

If FF fails (someone landed commits on feat/v1-implementation while we were on the sub-branch), rebase first:

```bash
git checkout feat/voice-first-capture
git rebase feat/v1-implementation
git checkout feat/v1-implementation
git merge --ff-only feat/voice-first-capture
```

- [ ] **Step 2: Delete the sub-branch (local).**

```bash
git branch -d feat/voice-first-capture
```

- [ ] **Step 3: STOP — do not push.** The user pushes from Windows. Tell them: "Voice-first capture complete and merged into feat/v1-implementation locally. Push from Windows when ready."

---

## Verification gates (must all pass before declaring DONE)

- [ ] `npm test` in `mobile/` → all green (>24 tests now)
- [ ] `npx tsc --noEmit` in `mobile/` → zero errors
- [ ] `pytest` in `backend/` → all green
- [ ] `git diff feat/v1-implementation..feat/voice-first-capture --stat` shows only the files listed under "Files touched" in the spec, plus the new test files
- [ ] Codex review returns PASS (or all P1 findings addressed)
- [ ] User on-device smoke test (Task 22) all checks pass
- [ ] Branch fast-forwarded into `feat/v1-implementation`
- [ ] User pushes from Windows
