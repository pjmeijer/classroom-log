import * as SQLite from 'expo-sqlite';

import { uuid } from '../lib/id';
import { migrate } from './migrations';

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

// ---- Students ------------------------------------------------------------

export async function addStudent(
  db: SQLite.SQLiteDatabase,
  { name }: { name: string }
): Promise<{ id: string }> {
  const id = uuid();
  const now = Date.now();
  await db.runAsync(
    'INSERT INTO students (id, name, recording_enabled, archived_at, created_at) VALUES (?, ?, 1, NULL, ?)',
    id,
    name.trim(),
    now
  );
  return { id };
}

export async function listActiveStudents(
  db: SQLite.SQLiteDatabase
): Promise<Student[]> {
  return db.getAllAsync<Student>(
    'SELECT id, name, recording_enabled, archived_at, created_at FROM students WHERE archived_at IS NULL ORDER BY created_at ASC'
  );
}

export async function archiveStudent(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<void> {
  await db.runAsync(
    'UPDATE students SET archived_at = ? WHERE id = ?',
    Date.now(),
    id
  );
}

export async function setStudentVoiceAllowed(
  db: SQLite.SQLiteDatabase,
  id: string,
  allowed: boolean
): Promise<void> {
  await db.runAsync(
    'UPDATE students SET recording_enabled = ? WHERE id = ?',
    allowed ? 1 : 0,
    id
  );
}
