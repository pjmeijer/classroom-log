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
    for (let v = current + 1; v <= TARGET_VERSION; v++) {
      const sql = MIGRATIONS[v];
      if (!sql) throw new Error(`No migration for version ${v}`);
      await db.execAsync(sql);
      await db.execAsync(`PRAGMA user_version = ${v}`);
    }
    await db.execAsync('COMMIT');
  } catch (e) {
    await db.execAsync('ROLLBACK').catch(() => {});
    throw e;
  }
}
