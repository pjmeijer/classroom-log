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
