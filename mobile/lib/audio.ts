import { AudioModule, useAudioRecorder, RecordingPresets, type AudioRecorder } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';

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
