import * as SQLite from 'expo-sqlite';

const TARGET_VERSION = 2;

const V1_SQL = `
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
`;

async function notesHasColumn(db: SQLite.SQLiteDatabase, col: string): Promise<boolean> {
  const rows = await db.getAllAsync<{ name: string }>('PRAGMA table_info(notes)');
  return rows.some(r => r.name === col);
}

async function runV2(db: SQLite.SQLiteDatabase): Promise<void> {
  // Per-column probe: safe on fresh upgrades AND on partial-apply re-runs.
  if (!(await notesHasColumn(db, 'language'))) {
    await db.execAsync('ALTER TABLE notes ADD COLUMN language TEXT');
  }
  if (!(await notesHasColumn(db, 'audio_uri'))) {
    await db.execAsync('ALTER TABLE notes ADD COLUMN audio_uri TEXT');
  }
}

export async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  // Take the write lock BEFORE reading user_version so two concurrent
  // openers cannot both observe version 0 and race CREATE TABLE.
  await db.execAsync('BEGIN IMMEDIATE');
  try {
    const current =
      (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))
        ?.user_version ?? 0;
    if (current > TARGET_VERSION) {
      throw new Error(
        `Database schema version ${current} is newer than this app supports (target ${TARGET_VERSION}). Refusing to run.`
      );
    }
    if (current < 1) {
      await db.execAsync(V1_SQL);
      await db.execAsync('PRAGMA user_version = 1');
    }
    if (current < 2) {
      await runV2(db);
      await db.execAsync('PRAGMA user_version = 2');
    }
    await db.execAsync('COMMIT');
  } catch (e) {
    await db.execAsync('ROLLBACK').catch(() => {});
    throw e;
  }
}
