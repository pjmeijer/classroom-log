import * as SQLite from 'expo-sqlite';

import { localDayStartMs, localDayEndMs } from '../lib/dates';
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
  language: string | null;        // ISO-ish; whatever Whisper returns. null for text-typed notes.
  audio_uri: string | null;       // local file URI when a transcription failed; null otherwise.
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

// ---- Notes ---------------------------------------------------------------

export async function addNote(
  db: SQLite.SQLiteDatabase,
  {
    studentId,
    text,
    language = null,
    audioUri = null,
  }: {
    studentId: string;
    text: string;
    language?: string | null;
    audioUri?: string | null;
  }
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

export async function getNote(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<Note | null> {
  const row = await db.getFirstAsync<Note>(
    'SELECT * FROM notes WHERE id = ?',
    id
  );
  return row ?? null;
}

export async function updateNote(
  db: SQLite.SQLiteDatabase,
  id: string,
  text: string
): Promise<void> {
  await db.runAsync(
    'UPDATE notes SET text = ?, updated_at = ? WHERE id = ?',
    text,
    Date.now(),
    id
  );
}

export async function deleteNote(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<void> {
  await db.runAsync('DELETE FROM notes WHERE id = ?', id);
}

export async function moveNote(
  db: SQLite.SQLiteDatabase,
  noteId: string,
  newStudentId: string
): Promise<void> {
  await db.runAsync(
    'UPDATE notes SET student_id = ?, updated_at = ? WHERE id = ?',
    newStudentId,
    Date.now(),
    noteId
  );
}

export async function getNotesForLocalDate(
  db: SQLite.SQLiteDatabase,
  ymd: string
): Promise<Array<Note & { student_name: string }>> {
  const start = localDayStartMs(ymd);
  const end = localDayEndMs(ymd);
  return db.getAllAsync(
    `SELECT n.*, s.name AS student_name
       FROM notes n
       JOIN students s ON s.id = n.student_id
      WHERE n.created_at >= ? AND n.created_at < ?
      ORDER BY n.created_at ASC, n.id ASC`,
    start,
    end
  );
}

export async function getNotesForStudentInLocalRange(
  db: SQLite.SQLiteDatabase,
  studentId: string,
  fromYmd: string,
  toYmd: string
): Promise<Note[]> {
  const start = localDayStartMs(fromYmd);
  const end = localDayEndMs(toYmd);
  return db.getAllAsync<Note>(
    `SELECT * FROM notes
      WHERE student_id = ? AND created_at >= ? AND created_at < ?
      ORDER BY created_at ASC, id ASC`,
    studentId,
    start,
    end
  );
}

export async function getNotesWithAudioUri(
  db: SQLite.SQLiteDatabase
): Promise<string[]> {
  const rows = await db.getAllAsync<{ audio_uri: string }>(
    'SELECT audio_uri FROM notes WHERE audio_uri IS NOT NULL'
  );
  return rows.map(r => r.audio_uri);
}

// ---- Settings ------------------------------------------------------------

export async function getSetting(
  db: SQLite.SQLiteDatabase,
  key: string
): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    key
  );
  return row?.value ?? null;
}

export async function setSetting(
  db: SQLite.SQLiteDatabase,
  key: string,
  value: string
): Promise<void> {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value
  );
}
