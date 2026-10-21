import 'server-only';

import { z } from 'zod';
import { withUsage, type AIRequestMeta } from '@/lib/ai/usage';
import { maskPersonalData } from '@/lib/ai/privacy';
import { OPENCODE_MODELS } from './routing';
import { safeFileName, userMessage, type TaskInput } from './work';

export const openCodeEnabled = () => process.env.OFFICE_PROVIDER === 'opencode';
export const openCodeAvailable = () => Boolean(process.env.OPENCODE_API_KEY?.trim());

/** No paid fallback: every selected model is explicitly a free model. */
export async function openCodeCall(system: string, input: string, tool: { name: string; description: string; parameters: Record<string, unknown> }, model: string, meta: AIRequestMeta, signal: AbortSignal) {
  if (!Object.values(OPENCODE_MODELS).some(m => m.id === model)) throw new Error('Ofis modeli izin listesinde değil.');
  const response = await withUsage(meta, 'opencode', model, async () => {
    const result = await fetch('https://opencode.ai/zen/v1/chat/completions', {
      method: 'POST', signal,
      headers: { Authorization: `Bearer ${process.env.OPENCODE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 16000, messages: [{ role: 'system', content: system }, { role: 'user', content: input }],
        tools: [{ type: 'function', function: tool }], tool_choice: { type: 'function', function: { name: tool.name } } }),
    });
    if (!result.ok) throw new Error(`Model hizmeti hata verdi (${result.status}).`);
    const data = await result.json();
    if (data.error) throw new Error('Model hizmeti isteği tamamlayamadı.');
    return { ...data, usage: { input_tokens: data.usage?.prompt_tokens, output_tokens: data.usage?.completion_tokens } };
  });
  const choice = response.choices?.[0];
  if (choice?.finish_reason === 'length') throw new Error('Model yanıtı uzunluk sınırında kesildi.');
  const calls = choice?.message?.tool_calls;
  if (!Array.isArray(calls) || calls.length !== 1 || calls[0]?.function?.name !== tool.name) throw new Error('Model geçerli teslimat göndermedi.');
  return JSON.parse(calls[0].function.arguments);
}

const Delivery = z.object({
  question: z.string().max(500), summary: z.string().max(4000),
  files: z.array(z.object({ name: z.string().min(1).max(120), format: z.enum(['txt', 'md', 'csv', 'svg']), content: z.string().min(1).max(200000) })).max(4),
}).superRefine((v, ctx) => {
  if (Boolean(v.question.trim()) === Boolean(v.files.length)) ctx.addIssue({ code: 'custom', message: 'Ya soru ya dosya teslim edilmelidir.' });
});

export async function produceOpenCode(task: TaskInput, model: string, meta: AIRequestMeta, signal: AbortSignal) {
  const masked = maskPersonalData(userMessage(task));
  const raw = await openCodeCall([
    'Bir Türk firmasının profesyonel ofis çalışanısın. Verilen işi eksiksiz, düzgün Türkçe ile yap.',
    'Eksik zorunlu bilgi varsa question alanında sor ve files dizisini boş bırak; aksi halde question boş olmalı.',
    'Dosya içeriklerini teslim_et aracıyla gerçekten üret. Yazışma txt, belge/çeviri/araştırma md, tablo/veri csv, tasarım svg, sunum slayt başlıklarıyla md olarak teslim edilir.',
    'Bu yol Word/Excel/PowerPoint ikili dosyası veya web araması üretmez. Başka uzantı takma, araştırma yaptığını iddia etme; doğrulanmamış bilgiyi ve format sınırlamasını teslim notunda açıkla.',
    'CSV: ilk satır başlık, sayılar ve toplamlar doğru, hücrelerde çalıştırılabilir formül yok. SVG: bağımsız statik vektör, script, dış kaynak, olay işleyici veya foreignObject yok.',
    'Yalnızca görev metninde gerçekten bulunan maskelenmiş değerleri aynen koru; kendin yer tutucu veya hayali kişi/iletişim bilgisi oluşturma.',
    'Dosyanın içeriğine teslim notu ekleme; kısa teslim notunu summary alanına yaz. Eksik veri varsa uydurma.',
  ].join('\n'), masked.text, { name: 'teslim_et', description: 'Tamamlanan dosyaları veya gerekli soruyu teslim et.', parameters: z.toJSONSchema(Delivery, { unrepresentable: 'any' }) }, model, meta, signal);
  const delivery = Delivery.parse(raw);
  return {
    question: masked.restore(delivery.question), summary: masked.restore(delivery.summary),
    files: delivery.files.map(file => {
      const content = masked.restore(file.content);
      if (file.format === 'svg' && (!/<svg\b/i.test(content) || /<\s*(script|foreignObject|iframe|object|embed)\b|\bon\w+\s*=|(?:href|url)\s*[=(]|<!ENTITY/i.test(content))) throw new Error('Tasarım güvenli bir statik SVG değil.');
      // Spreadsheet programs must never execute model-generated CSV formulas on download.
      if (file.format === 'csv' && /(?:^|[;,\n])\s*"?\s*(?:[=+@\t\r]|-(?!\d+(?:[.,]\d+)?(?:[";,\r\n]|$)))/m.test(content)) throw new Error('CSV çalıştırılabilir formül içeriyor.');
      const base = safeFileName(file.name, 'teslim').replace(/\.[^.]+$/, '');
      return { name: `${base}.${file.format}`, contentType: { txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', svg: 'image/svg+xml' }[file.format], bytes: Buffer.from(content, 'utf8') };
    }),
  };
}
