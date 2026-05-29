import { copy } from '../copy';

describe('copy', () => {
  it('exposes Danish strings as non-empty values', () => {
    expect(copy.appTitle).toBe('Observationer');
    expect(copy.roster).toBe('Klasseliste');
    expect(copy.todaysNotes).toBe('Dagens noter');
    expect(copy.recording).toBe('Optager');
    expect(copy.stopAndSave).toBe('Stop & gem');
    expect(copy.cancel).toBe('Annuller');
    expect(copy.undo).toBe('Fortryd');
    expect(copy.edit).toBe('Redigér');
  });

  it('savedFor interpolates the student name', () => {
    expect(copy.savedFor('Stine')).toBe('Gemt for Stine');
    expect(copy.savedFor('Mads-Erik')).toBe('Gemt for Mads-Erik');
  });

  it('notesToday picks the right Danish form for 0 / 1 / N', () => {
    expect(copy.notesToday(0)).toBe('Ingen noter endnu');
    expect(copy.notesToday(1)).toBe('1 note i dag');
    expect(copy.notesToday(2)).toBe('2 noter i dag');
    expect(copy.notesToday(17)).toBe('17 noter i dag');
  });
});
