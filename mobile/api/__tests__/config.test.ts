describe('DEFAULT_API_BASE_URL', () => {
  const originalEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalDev = (global as any).__DEV__;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.EXPO_PUBLIC_API_BASE_URL;
    } else {
      process.env.EXPO_PUBLIC_API_BASE_URL = originalEnv;
    }
    (global as any).__DEV__ = originalDev;
    jest.resetModules();
  });

  it('uses the env value when EXPO_PUBLIC_API_BASE_URL is set', () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://prod.railway.app';
    jest.isolateModules(() => {
      const { DEFAULT_API_BASE_URL } = require('../config');
      expect(DEFAULT_API_BASE_URL).toBe('https://prod.railway.app');
    });
  });

  it('falls back to the sentinel in __DEV__ when env is unset', () => {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
    (global as any).__DEV__ = true;
    jest.isolateModules(() => {
      const { DEFAULT_API_BASE_URL } = require('../config');
      expect(DEFAULT_API_BASE_URL).toBe('https://example.ngrok.app');
    });
  });

  it('throws in non-dev builds when env is unset', () => {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
    (global as any).__DEV__ = false;
    expect(() => {
      jest.isolateModules(() => {
        require('../config');
      });
    }).toThrow(/EXPO_PUBLIC_API_BASE_URL/);
  });
});
