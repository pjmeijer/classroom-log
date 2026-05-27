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
