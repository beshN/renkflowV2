/**
 * Everyday talk in the command box is answered, not refused; real commands are never taken for small talk.
 */
import { searchWords, smallTalk } from '@/lib/ai/commands/smalltalk';
import { parseCommand } from '@/lib/ai/commands/parse';

describe('command box small talk', () => {
  it.each(['naber', 'Naber?', 'selam', 'Merhaba!', 'günaydın', 'nasılsın', 'ne haber', 'merhaba nasılsın'])('"%s" gets a greeting', (text) => {
    expect(smallTalk(text)).toMatch(/\S/);
  });
  it.each(['teşekkürler', 'sağ ol', 'Eyvallah'])('"%s" gets a reply', (text) => expect(smallTalk(text)).toMatch(/Rica ederim/));
  it.each(['ne yapabilirsin', 'yardım', 'neler yapabilirsin?'])('"%s" explains what can be asked', (text) => expect(smallTalk(text)).toMatch(/sipariş/i));
  it('is not small talk for real questions and commands', () => {
    for (const text of ['bu hafta geciken işler', '7016 mat kaç çubuk var', "Ahmet Bey'e 3x4 pergola teklif hazırla", 'RF-1042 nerede', 'Kaya İnşaat borcu ne kadar', 'yarın kaç sipariş teslim edilecek'])
      expect(smallTalk(text)).toBeNull();
  });
  it('never swallows something the command rules understand', () => {
    for (const text of ['bu hafta geciken işler', 'kritik stok', 'yarın teslimatlar', 'vadesi geçen faturalar', 'yoldaki malzemeler'])
      expect(parseCommand(text).command.intent).not.toBe('unknown');
  });
});

describe('search words', () => {
  it('keeps names, numbers and materials, drops filler, longest first', () => {
    expect(searchWords('Kaya İnşaat için bana bir şey göster')).toEqual(['inşaat', 'kaya']);
    expect(searchWords('RF-1042 nerede')).toEqual(['1042']);
    expect(searchWords('naber')).toEqual(['naber']);
    expect(searchWords('ve bir de')).toEqual([]);
  });
});
