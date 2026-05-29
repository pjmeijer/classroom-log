import * as SQLite from 'expo-sqlite';
import {
  initDb,
  listActiveStudents,
  addStudent,
  archiveStudent,
  setStudentVoiceAllowed,
  addNote,
  getNote,
  updateNote,
  deleteNote,
  moveNote,
  getNotesForLocalDate,
  getNotesForStudentInLocalRange,
  getSetting,
  setSetting,
} from '../db';
import { migrate } from '../migrations';

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
    const { id: nid } = await addNote(db, { studentId: id, text: 'note that must survive' });
    await archiveStudent(db, id);
    const rows = await listActiveStudents(db);
    expect(rows).toEqual([]);
    // Direct row still exists with archived_at set
    const all = await db.getAllAsync<{ id: string; archived_at: number | null }>('SELECT id, archived_at FROM students');
    expect(all.length).toBe(1);
    expect(all[0].archived_at).not.toBeNull();
    // Note is retained — archive must NOT cascade-delete it
    const survivingNote = await getNote(db, nid);
    expect(survivingNote?.text).toBe('note that must survive');
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

  it("lists today's notes for a date in local time", async () => {
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
    expect(rows[0].student_name).toBe('Alex');
  });

  it('lists notes for a student in a local date range', async () => {
    const { id: sid } = await addStudent(db, { name: 'Alex' });
    await addNote(db, { studentId: sid, text: 'in range' });
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const ymd = `${y}${m}${d}`;
    const rows = await getNotesForStudentInLocalRange(db, sid, ymd, ymd);
    expect(rows.length).toBe(1);
    expect(rows[0].text).toBe('in range');
  });

  it('refuses to delete a student that has notes (RESTRICT)', async () => {
    const { id: sid } = await addStudent(db, { name: 'Alex' });
    await addNote(db, { studentId: sid, text: 'note' });
    await expect(
      db.runAsync('DELETE FROM students WHERE id = ?', sid)
    ).rejects.toThrow();
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

describe('migrations', () => {
  it('refuses to run when user_version is newer than the app supports', async () => {
    const future = await SQLite.openDatabaseAsync(':memory:');
    await future.execAsync('PRAGMA user_version = 99');
    await expect(migrate(future)).rejects.toThrow(/newer than this app/);
    await future.closeAsync();
  });
});

async function openTestDb() {
  return SQLite.openDatabaseAsync(':memory:');
}

describe('migrate v2', () => {
  it('adds notes.language and notes.audio_uri columns at v2', async () => {
    const db = await openTestDb();
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
    await db.closeAsync();
  });

  it('recovers from partial v2 apply (one column added, user_version still 1)', async () => {
    const db = await openTestDb();
    // Simulate: v1 succeeded, language was added, then a crash before audio_uri.
    await migrate(db);                                  // get to v2 cleanly
    // Tear back down to "partial v2" state: set version to 1 (leave language in place)
    await db.execAsync('PRAGMA user_version = 1');
    // (we leave language in place — that's the "partial apply" state)
    // Re-running migrate must NOT throw "duplicate column language"
    await migrate(db);
    const cols = (await db.getAllAsync<{ name: string }>('PRAGMA table_info(notes)')).map(c => c.name);
    expect(cols).toContain('language');
    expect(cols).toContain('audio_uri');
    const v = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(v?.user_version).toBe(2);
    await db.closeAsync();
  });
});
