jest.mock('expo-audio', () => {
  const mockRecorder = {
    prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
    record: jest.fn(),
    stop: jest.fn().mockResolvedValue(undefined),
    uri: '/tmp/recording.m4a',
  };
  return {
    AudioModule: {
      requestRecordingPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
      setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    },
    useAudioRecorder: () => mockRecorder,
    RecordingPresets: { HIGH_QUALITY: {} },
  };
});

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/docs/',
  cacheDirectory: '/cache/',
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, size: 12345 }),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  readDirectoryAsync: jest.fn().mockResolvedValue(['old-recording.m4a']),
}));

import { ensurePermission, cleanupOrphanRecordings } from '../audio';
import * as dbModule from '../../db/db';

describe('audio.ensurePermission', () => {
  it('returns true when granted', async () => {
    const ok = await ensurePermission();
    expect(ok).toBe(true);
  });
});

describe('audio.cleanupOrphanRecordings', () => {
  it('deletes any pre-existing .m4a files in the cache dir', async () => {
    const FS = require('expo-file-system/legacy');
    jest.spyOn(dbModule, 'getNotesWithAudioUri').mockResolvedValue([]);
    await cleanupOrphanRecordings({} as any);
    expect(FS.deleteAsync).toHaveBeenCalled();
  });
});

describe('cleanupOrphanRecordings — preserves notes.audio_uri', () => {
  it('skips files whose basename matches a stored audio_uri (file://… form)', async () => {
    const fs = require('expo-file-system/legacy');
    fs.cacheDirectory = '/cache/';
    fs.readDirectoryAsync.mockResolvedValue(['a.m4a', 'b.m4a', 'c.m4a']);
    fs.deleteAsync.mockClear();

    jest.spyOn(dbModule, 'getNotesWithAudioUri')
      .mockResolvedValue(['file:///somewhere/b.m4a']);

    const { cleanupOrphanRecordings } = require('../audio');
    await cleanupOrphanRecordings({} as any);

    const deletedPaths = fs.deleteAsync.mock.calls.map((c: any) => c[0]);
    expect(deletedPaths).toContain('/cache/a.m4a');
    expect(deletedPaths).toContain('/cache/c.m4a');
    expect(deletedPaths).not.toContain('/cache/b.m4a');
  });

  it('skips files whose basename matches a stored audio_uri (plain path form)', async () => {
    const fs = require('expo-file-system/legacy');
    fs.cacheDirectory = '/cache/';
    fs.readDirectoryAsync.mockResolvedValue(['x.m4a', 'y.m4a']);
    fs.deleteAsync.mockClear();
    jest.spyOn(dbModule, 'getNotesWithAudioUri').mockResolvedValue(['/elsewhere/y.m4a']);

    const { cleanupOrphanRecordings } = require('../audio');
    await cleanupOrphanRecordings({} as any);

    const deletedPaths = fs.deleteAsync.mock.calls.map((c: any) => c[0]);
    expect(deletedPaths).toContain('/cache/x.m4a');
    expect(deletedPaths).not.toContain('/cache/y.m4a');
  });
});

describe('discardRecording', () => {
  it('stops the recorder and deletes the resulting file (idempotent on missing)', async () => {
    const fs = require('expo-file-system/legacy');
    fs.deleteAsync.mockClear();
    const recorder: any = {
      stop: jest.fn().mockResolvedValue(undefined),
      uri: '/cache/zz.m4a',
    };
    const { discardRecording } = require('../audio');
    await discardRecording(recorder);
    expect(recorder.stop).toHaveBeenCalled();
    expect(fs.deleteAsync).toHaveBeenCalledWith('/cache/zz.m4a', { idempotent: true });
  });

  it('does not throw when recorder.stop rejects or uri is missing', async () => {
    const fs = require('expo-file-system/legacy');
    fs.deleteAsync.mockClear();
    const recorder: any = {
      stop: jest.fn().mockRejectedValue(new Error('boom')),
      uri: null,
    };
    const { discardRecording } = require('../audio');
    await expect(discardRecording(recorder)).resolves.toBeUndefined();
  });
});
