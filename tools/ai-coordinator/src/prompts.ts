import type { Task, TestResult } from './types.ts';

const RULES = `Genel kurallar (ihlal = görev başarısız):
- Yalnızca "İzinli dosyalar" altında değişiklik yap. Başka dosyaya dokunma.
- Gizli anahtar, token, .env değeri, gerçek müşteri verisi yazma/okuma. Üretim veritabanına bağlanma.
- git push, branch değiştirme, main'e yazma, dağıtım (deploy) YASAK. Commit'i koordinatör atar.
- Gerçek e-posta/fatura/ödeme gönderme. Tehlikeli komut çalıştırma.
- ai-workspace/FACTORY_RULES.md ve PROJECT_CONTEXT.md'yi oku; iş kurallarına uy.`;

export function devPrompt(t: Task, feedback: string | null): string {
  return `Sen RenkFlow geliştirme ekibinde "${t.owner}" rolündesin. Görev: ${t.id} — ${t.title}

Açıklama:
${t.description}

Kabul kriterleri:
${t.acceptance.map((a) => `- ${a}`).join('\n')}

İzinli dosyalar:
${t.files.map((f) => `- ${f}`).join('\n')}

${RULES}
${feedback ? `\nÖnceki denemeden geri bildirim (mutlaka gider):\n${feedback}\n` : ''}
Bitirdiğinde ne yaptığını 5 satırı geçmeyen bir özetle yaz.`;
}

export function reviewPrompt(t: Task, diff: string, tests: TestResult[]): string {
  return `Sen RenkFlow için bağımsız denetçisin ("${t.reviewer}"). ${t.id} — ${t.title} görevinin değişikliğini denetle. Dosyaları DEĞİŞTİRME.

Kabul kriterleri:
${t.acceptance.map((a) => `- ${a}`).join('\n')}

İzinli dosyalar: ${t.files.join(', ')}

Test sonuçları:
${tests.length ? tests.map((x) => `- ${x.name}: ${x.ok ? 'GEÇTİ' : 'KALDI'}`).join('\n') : '- (bu görev türü için otomatik test yok)'}

Diff:
\`\`\`diff
${diff || '(boş)'}
\`\`\`

Kontrol et: kabul kriterleri, kapsam dışı değişiklik, gizli bilgi sızıntısı, güvenlik, iş kuralı doğruluğu.
YANITIN SON SATIRI yalnızca şu biçimde tek satır JSON olmalı:
{"verdict":"pass"|"fail","summary":"…","issues":["…"]}
Emin değilsen "fail" ver.`;
}

export function escalationPrompt(t: Task, history: string): string {
  return `Sen RenkFlow koordinatörüsün (Sonnet). ${t.id} — ${t.title} görevi geliştirici/denetçi arasında çözülemedi veya özet karar gerekiyor.

${history}

Karar ver. YANITIN SON SATIRI tek satır JSON olmalı:
{"decision":"accept"|"retry"|"cancel"|"split","reason":"…","guidance":"geliştiriciye net talimat (retry ise)"}`;
}

/** Last parsable JSON object on the last non-empty line(s) of a model reply. */
export function parseTailJson<T>(text: string): T | null {
  const lines = text.trim().split('\n').reverse();
  for (const line of lines) {
    const s = line.trim().replace(/^```(json)?|```$/g, '').trim();
    if (!s.startsWith('{')) continue;
    try { return JSON.parse(s) as T; } catch { /* keep looking */ }
  }
  return null;
}
