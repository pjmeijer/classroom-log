import * as SQLite from 'expo-sqlite';
import { AudioModule, useAudioRecorder, RecordingPresets, type AudioRecorder } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { getNotesWithAudioUri } from '../db/db';

export async function ensurePermission(): Promise<boolean> {
  const status = await AudioModule.requestRecordingPermissionsAsync();
  return status.granted;
}

export function useRecorder(): AudioRecorder {
  return useAudioRecorder(RecordingPresets.HIGH_QUALITY);
}

export async function startRecording(rec: AudioRecorder): Promise<void> {
  // iOS requires the audio session to be enabled for recording before
  // prepareToRecordAsync, or expo-audio throws RecordingDisabledException.
  // playsInSilentMode is set so the physical silent switch doesn't block
  // recording session activation.
  await AudioModule.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
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

// Best-effort "drop this recording on the floor" used by every cancel /
// error path (home tile cancel, modal cancel, modal-dismiss-while-
// recording, recorder errors during start). Stops the recorder (if it's
// recording) and deletes the resulting file. Never throws.
export async function discardRecording(rec: AudioRecorder): Promise<void> {
  try { await rec.stop(); } catch { /* might not have started or already stopped */ }
  const uri = rec.uri;
  if (!uri) return;
  await deleteRecording(uri);
}

function basename(p: string): string {
  // Works for both `file:///a/b/c.m4a` and `/a/b/c.m4a`.
  const noQuery = p.split('?')[0];
  const idx = noQuery.lastIndexOf('/');
  return idx >= 0 ? noQuery.slice(idx + 1) : noQuery;
}

export async function cleanupOrphanRecordings(
  db: SQLite.SQLiteDatabase
): Promise<void> {
  const dir = FileSystem.cacheDirectory;
  if (!dir) return;

  // Build the keep-set by basename so file:// vs plain-path mismatches
  // don't accidentally orphan a referenced file.
  let keep = new Set<string>();
  try {
    const uris = await getNotesWithAudioUri(db);
    keep = new Set(uris.map(basename));
  } catch {
    // If db read fails, fail safe by keeping everything — better to leak
    // than to delete a file that backs a real note.
    return;
  }

  let entries: string[] = [];
  try {
    entries = await FileSystem.readDirectoryAsync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (!(name.endsWith('.m4a') || name.endsWith('.caf'))) continue;
    if (keep.has(name)) continue;
    await FileSystem.deleteAsync(dir + name, { idempotent: true });
  }
}
