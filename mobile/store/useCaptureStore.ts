import { create } from 'zustand';
import type { AudioRecorder } from 'expo-audio';

interface RecordingState {
  studentId: string;
  startedAt: number;
  recorder: AudioRecorder;
}

interface SavedHandle {
  noteId: string;
  studentId: string;     // stable; do not infer from name (duplicate names exist)
  studentName: string;   // display only
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
