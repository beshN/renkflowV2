import { parseVoice } from '@/lib/ai/voice';

const reasons = [{ code: 'cut_error', label: 'Kesim hatası' }, { code: 'paint', label: 'Boya hatası' }, { code: 'material', label: 'Malzeme kusuru' }];

describe('worker voice commands', () => {
  it('start and finish', () => {
    expect(parseVoice('Başla', reasons)).toEqual({ action: 'start' });
    expect(parseVoice('bitti', reasons)).toEqual({ action: 'complete' });
    expect(parseVoice('Tamamlandı.', reasons)).toEqual({ action: 'complete' });
  });
  it('scrap with a count and the firm\'s reason (inflected words match)', () => {
    expect(parseVoice('3 adet fire, kesim hatası', reasons)).toEqual({ action: 'scrap', quantity: 3, reasonCode: 'cut_error', reasonLabel: 'Kesim hatası' });
    expect(parseVoice('iki tane fire boya hatasından', reasons)).toMatchObject({ quantity: 2, reasonCode: 'paint' });
  });
  it('an unknown reason is not guessed; other speech is not a command', () => {
    expect(parseVoice('1 fire', reasons)).toEqual({ action: 'scrap', quantity: 1, reasonCode: null, reasonLabel: null });
    expect(parseVoice('çay molası', reasons)).toBeNull();
    expect(parseVoice('başka iş var mı', reasons)).toBeNull();
  });
});
