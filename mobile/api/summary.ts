import { callJson, ApiResult } from './client';

export interface SummarySections {
  positives: string;
  concerns: string;
  patterns: string;
  next_steps: string;
}

export type SummaryResult =
  | { ok: true; sections: SummarySections }
  | { ok: false; error: { code: string; message: string } };

export async function fetchSummary(apiBaseUrl: string, studentName: string, notes: Array<{ ts: number; text: string }>): Promise<SummaryResult> {
  const r = await callJson<SummarySections>(
    `${apiBaseUrl.replace(/\/$/, '')}/summary`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_name: studentName, notes }),
    },
    60_000
  );
  if (r.ok) return { ok: true, sections: r.data };
  return { ok: false, error: r.error };
}
