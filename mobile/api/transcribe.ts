export type TranscribeResult =
  | { ok: true; text: string; language: string | null }
  | { ok: false; error: { code: string; message: string } };

export async function fetchTranscript(
  apiBaseUrl: string,
  audioUri: string,
  timeoutMs: number = 60_000
): Promise<TranscribeResult> {
  const url = `${apiBaseUrl.replace(/\/$/, '')}/transcribe`;
  const form = new FormData();
  form.append('audio', {
    uri: audioUri,
    name: 'audio.m4a',
    type: 'audio/m4a',
  } as any);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      body: form,
      signal: ctrl.signal,
    });
    const body = await resp.json().catch(() => ({}));
    if (resp.ok) {
      return { ok: true, text: body.text ?? '', language: body.language ?? null };
    }
    const env = body?.error ?? { code: 'http_error', message: `HTTP ${resp.status}` };
    return { ok: false, error: env };
  } catch (e: any) {
    if (e?.name === 'AbortError') return { ok: false, error: { code: 'timeout', message: 'Request timed out' } };
    return { ok: false, error: { code: 'network_error', message: e?.message ?? 'Network error' } };
  } finally {
    clearTimeout(timer);
  }
}
