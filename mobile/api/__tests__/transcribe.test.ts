import { fetchTranscript } from '../transcribe';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

describe('fetchTranscript', () => {
  it('POSTs multipart and returns text + language on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ text: 'Hej', language: 'danish' }),
    }) as any;
    const r = await fetchTranscript('https://api.example/', 'file:///cache/a.m4a');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.text).toBe('Hej');
      expect(r.language).toBe('danish');
    }
    const call = (global.fetch as any).mock.calls[0];
    expect(call[0]).toBe('https://api.example/transcribe');
    const init = call[1];
    expect(init.method).toBe('POST');
  });

  it('returns ok:false on 5xx', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ error: { code: 'openai_error', message: 'upstream' } }),
    }) as any;
    const r = await fetchTranscript('https://api.example', 'file:///a.m4a');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('openai_error');
    }
  });

  it('returns ok:false on network error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('boom')) as any;
    const r = await fetchTranscript('https://api.example', 'file:///a.m4a');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('network_error');
    }
  });
});
