export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

export async function callJson<T>(url: string, init: RequestInit, timeoutMs: number): Promise<ApiResult<T>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...init, signal: ctrl.signal });
    const body = await resp.json().catch(() => ({}));
    if (resp.ok) return { ok: true, data: body as T };
    const env = body?.error ?? { code: 'http_error', message: `HTTP ${resp.status}` };
    return { ok: false, error: env };
  } catch (e: any) {
    if (e?.name === 'AbortError') return { ok: false, error: { code: 'timeout', message: 'Request timed out' } };
    return { ok: false, error: { code: 'network_error', message: e?.message ?? 'Network error' } };
  } finally {
    clearTimeout(timer);
  }
}
