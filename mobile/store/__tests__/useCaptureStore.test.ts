import { useCaptureStore } from '../useCaptureStore';

describe('useCaptureStore', () => {
  beforeEach(() => {
    useCaptureStore.setState({ recording: null, lastSaved: null });
  });

  it('start() sets recording when idle and returns true', () => {
    const ok = useCaptureStore.getState().start('student-1', { mock: 'recorder' } as any);
    expect(ok).toBe(true);
    const s = useCaptureStore.getState();
    expect(s.recording?.studentId).toBe('student-1');
    expect(typeof s.recording?.startedAt).toBe('number');
  });

  it('start() refuses (returns false) when already recording', () => {
    useCaptureStore.getState().start('student-1', { mock: 'first' } as any);
    const ok = useCaptureStore.getState().start('student-2', { mock: 'second' } as any);
    expect(ok).toBe(false);
    expect(useCaptureStore.getState().recording?.studentId).toBe('student-1');
  });

  it('stop() returns the active recording and clears state', () => {
    useCaptureStore.getState().start('s', { mock: 'r' } as any);
    const handle = useCaptureStore.getState().stop();
    expect(handle?.studentId).toBe('s');
    expect(useCaptureStore.getState().recording).toBeNull();
  });

  it('stop() returns null when not recording', () => {
    expect(useCaptureStore.getState().stop()).toBeNull();
  });

  it('markSaved() exposes lastSaved for the toast', () => {
    useCaptureStore.getState().markSaved({ noteId: 'n', studentId: 'sid', studentName: 'Stine' });
    expect(useCaptureStore.getState().lastSaved?.noteId).toBe('n');
    expect(useCaptureStore.getState().lastSaved?.studentId).toBe('sid');
    expect(useCaptureStore.getState().lastSaved?.studentName).toBe('Stine');
  });

  it('dismissToast() clears lastSaved', () => {
    useCaptureStore.getState().markSaved({ noteId: 'n', studentId: 'sid', studentName: 'Stine' });
    useCaptureStore.getState().dismissToast();
    expect(useCaptureStore.getState().lastSaved).toBeNull();
  });
});
