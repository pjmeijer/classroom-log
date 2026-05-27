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

describe('audio.ensurePermission', () => {
  it('returns true when granted', async () => {
    const ok = await ensurePermission();
    expect(ok).toBe(true);
  });
});

describe('audio.cleanupOrphanRecordings', () => {
  it('deletes any pre-existing .m4a files in the cache dir', async () => {
    const FS = require('expo-file-system/legacy');
    await cleanupOrphanRecordings();
    expect(FS.deleteAsync).toHaveBeenCalled();
  });
});
