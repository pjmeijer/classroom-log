import { fetchSummary } from '../summary';

describe('fetchSummary', () => {
  const url = 'https://example.test';
  const notes = [{ ts: 1, text: 'hi' }];

  it('returns {ok:true, sections} on a 200 response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ positives: 'p', concerns: 'c', patterns: 'pa', next_steps: 'n' }),
    } as any);
    const r = await fetchSummary(url, 'Alex', notes);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.sections.positives).toBe('p');
  });

  it('returns {ok:false, error} on a 4xx with error envelope', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { code: 'no_notes', message: 'No notes provided.' } }),
    } as any);
    const r = await fetchSummary(url, 'Alex', notes);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('no_notes');
  });

  it('returns a network_error on fetch rejection', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('net'));
    const r = await fetchSummary(url, 'Alex', notes);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('network_error');
  });

  it('aborts after 60s and returns timeout error', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn().mockImplementation((_url, opts) =>
      new Promise((_, reject) => {
        opts!.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      })
    );
    const promise = fetchSummary(url, 'Alex', notes);
    jest.advanceTimersByTime(60001);
    const r = await promise;
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('timeout');
    jest.useRealTimers();
  });
});
