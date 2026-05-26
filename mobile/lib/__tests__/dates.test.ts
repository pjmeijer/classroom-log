import { localYmd, localDayStartMs, localDayEndMs, formatTime } from '../dates';

describe('localYmd', () => {
  it('formats local date as YYYYMMDD', () => {
    const d = new Date(2026, 4, 26, 14, 30); // May 26, 2026 local
    expect(localYmd(d)).toBe('20260526');
  });
  it('pads single-digit months and days', () => {
    const d = new Date(2026, 0, 5, 0, 0);
    expect(localYmd(d)).toBe('20260105');
  });
});

describe('localDay bounds', () => {
  it('start is midnight, end is exclusive next midnight', () => {
    const start = localDayStartMs('20260526');
    const end = localDayEndMs('20260526');
    expect(end - start).toBe(24 * 60 * 60 * 1000);
    expect(new Date(start).getHours()).toBe(0);
  });
});
