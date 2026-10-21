import { CATEGORY, STAFF, type TaskCategoryId } from './catalog';
import type { Difficulty } from './routing';

/**
 * How a member of the AI office does a task for real: what each kind of work asks of the model,
 * which Anthropic skills it gets for Office files, and how its answer is read back. Pure, so the
 * request and the reading of the answer are tested without calling the model.
 */

export type OfficeSkill = 'docx' | 'xlsx' | 'pptx' | 'pdf';

type WorkSpec = {
  /** Anthropic's prebuilt file skill for the deliverable; none for plain text or images. */
  skill: OfficeSkill | null;
  /** Code execution in Anthropic's sandbox: needed for every file the model builds. */
  code: boolean;
  /** Web search for sourced work, capped per task. */
  webSearches: number;
  instructions: string;
};

export const WORK: Record<TaskCategoryId, WorkSpec> = {
  design: {
    skill: null, code: true, webSearches: 0,
    instructions: 'Grafik tasarım yap. Python (pillow/matplotlib) ile çalışarak bitmiş tasarımı PNG olarak, ayrıca düzenlenebilir SVG olarak kaydet. Ölçü verilmediyse sosyal medya için 1080x1080 kullan. Metinler Türkçe karakterlerle doğru görünmeli; okunaklı, dengeli ve profesyonel bir düzen kur.',
  },
  document: {
    skill: 'docx', code: true, webSearches: 0,
    instructions: 'İstenen belgeyi Word (.docx) olarak hazırla: başlıklar, paragraflar, gerekiyorsa tablo ve imza alanı. Resmî ve düzgün Türkçe kullan.',
  },
  spreadsheet: {
    skill: 'xlsx', code: true, webSearches: 0,
    instructions: 'İstenen tabloyu Excel (.xlsx) olarak hazırla: başlık satırı, uygun sütun genişlikleri, sayı ve para biçimleri, toplamlar için gerçek formüller. Gerekirse ikinci sayfaya grafik ekle.',
  },
  presentation: {
    skill: 'pptx', code: true, webSearches: 0,
    instructions: 'İstenen sunumu PowerPoint (.pptx) olarak hazırla: kapak, akışa uygun içerik slaytları, kapanış. Slayt başına az ve öz metin; tutarlı renk ve yazı düzeni.',
  },
  research: {
    skill: 'docx', code: true, webSearches: 5,
    instructions: 'Konuyu web aramasıyla araştır ve bulguları kaynaklı bir rapor olarak Word (.docx) hazırla: özet, bulgular, karşılaştırma tablosu, sonuç ve kaynakça (bağlantılarla). Doğrulayamadığın bilgiyi kesinmiş gibi yazma.',
  },
  correspondence: {
    skill: null, code: false, webSearches: 0,
    instructions: 'İstenen yazıyı/e-postayı yaz. Cevabın yalnızca gönderilmeye hazır metin olsun: varsa "Konu:" satırı, hitap, gövde ve kapanış. Açıklama ekleme.',
  },
  translation: {
    skill: 'docx', code: true, webSearches: 0,
    instructions: 'Verilen metni istenen dile çevir ve Word (.docx) belgesi olarak kaydet. Biçimi ve terimleri koru; dil belirtilmediyse Türkçe metni İngilizceye, yabancı metni Türkçeye çevir.',
  },
  data: {
    skill: 'xlsx', code: true, webSearches: 0,
    instructions: 'Verilen veriyi düzenle (ayrıştır, tekrarları temizle, birleştir) ve sonucu Excel (.xlsx) olarak kaydet. Belirsiz kayıtları ayrı bir sayfada listele.',
  },
};

/** Thinking depth follows the manager's call on the task. */
export const EFFORT: Record<Difficulty, 'low' | 'medium' | 'high'> = { easy: 'low', medium: 'medium', hard: 'high' };

/** The tool the model calls when it cannot go on without the person who gave the task. */
export const ASK_TOOL = {
  name: 'soru_sor',
  description: 'Görevi veren kişiye tek bir soru sorar ve işi cevap gelene kadar bekletir. Yalnızca işi doğru yapmak için gerçekten gerekli bir bilgi eksikse kullan (ör. ölçü, hedef dil, hangi müşteri). Makul bir varsayımla ilerleyebiliyorsan sorma.',
  input_schema: {
    type: 'object' as const,
    properties: { soru: { type: 'string', description: 'Kısa, tek bir soru.' } },
    required: ['soru'],
    additionalProperties: false,
  },
  strict: true,
};

export type TaskInput = {
  category: TaskCategoryId; title: string; brief: string; agentId: string;
  answers: Array<{ question: string; answer: string }>;
  notes: string[];
  revision: number;
  companyName?: string | null;
};

/** Masked personal data reaches the model as placeholders; it must keep them, never invent them. */
const PLACEHOLDER_RULE = 'Görevde köşeli parantezli yer tutucu (ör. [KİŞİ_1]) varsa onu olduğu gibi kullan; görevde olmayan yer tutucu ekleme. Alıcının adı verilmediyse "Değerli müşterimiz" gibi genel bir hitap kullan.';

export function systemPrompt(task: TaskInput) {
  const member = STAFF.find(s => s.id === task.agentId);
  const spec = WORK[task.category];
  return [
    `Sen ${task.companyName ? `${task.companyName} firmasının` : 'bir firmanın'} yapay zekâ ofisinde çalışan ${member?.name ?? 'bir çalışan'}sın (${member?.title ?? CATEGORY[task.category].label}).`,
    spec.instructions,
    spec.code ? 'Dosyayı kod çalıştırma ortamında oluştur ve kaydet; teslim edilecek her dosyanın adı kısa, Türkçe karakter içermeyen ve anlamlı olsun. Ara dosyaları teslim etme.' : '',
    'Bilgi eksikse ve makul bir varsayım yapamıyorsan soru_sor aracını kullan. Yaptığın varsayımları teslim notunda belirt.',
    'Bitirdiğinde cevabının sonunda 1-3 cümlelik Türkçe bir teslim notu yaz: ne hazırladın, neye dikkat edilmeli.',
    PLACEHOLDER_RULE,
  ].filter(Boolean).join('\n\n');
}

export function userMessage(task: TaskInput) {
  const parts = [`Görev: ${task.title}`];
  if (task.brief.trim() && task.brief.trim() !== task.title) parts.push(`Görevi verenin yazdığı:\n${task.brief.trim()}`);
  for (const qa of task.answers) parts.push(`Daha önce sorduğun: ${qa.question}\nCevap: ${qa.answer}`);
  if (task.notes.length) parts.push(`Bu işin önceki teslimi geri döndü. İstenen düzeltmeler:\n${task.notes.map(n => `- ${n}`).join('\n')}`);
  return parts.join('\n\n');
}

/** Builds the tools and container for one task's request. */
export function requestTools(category: TaskCategoryId) {
  const spec = WORK[category];
  const tools: Array<Record<string, unknown>> = [ASK_TOOL];
  if (spec.code) tools.push({ type: 'code_execution_20260521', name: 'code_execution' });
  if (spec.webSearches) tools.push({ type: 'web_search_20250305', name: 'web_search', max_uses: spec.webSearches });
  const container = spec.skill ? { skills: [{ type: 'anthropic', skill_id: spec.skill, version: 'latest' }] } : undefined;
  return { tools, container, betas: spec.code ? ['code-execution-2025-08-25'] : [] };
}

export type ModelOutcome =
  | { kind: 'question'; question: string }
  | { kind: 'delivered'; summary: string; fileIds: string[] }
  | { kind: 'refused' }
  | { kind: 'incomplete' };

/** Every Files API id the code execution results carry, in order, without repeats. */
export function outputFileIds(content: unknown[]): string[] {
  const ids: string[] = [];
  const walk = (value: unknown) => {
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (!value || typeof value !== 'object') return;
    const node = value as Record<string, unknown>;
    if (typeof node.file_id === 'string' && !ids.includes(node.file_id)) ids.push(node.file_id);
    for (const [key, child] of Object.entries(node)) if (key !== 'file_id') walk(child);
  };
  for (const block of content) {
    const type = (block as { type?: string })?.type ?? '';
    if (type.endsWith('code_execution_tool_result')) walk(block);
  }
  return ids;
}

/** Reads the model's final message: a question for the person, a delivery, or a failure. */
export function readOutcome(message: { stop_reason: string | null; content: unknown[] }): ModelOutcome {
  if (message.stop_reason === 'refusal') return { kind: 'refused' };
  const ask = message.content.find(b => (b as { type?: string; name?: string }).type === 'tool_use' && (b as { name?: string }).name === ASK_TOOL.name) as { input?: { soru?: unknown } } | undefined;
  if (ask && typeof ask.input?.soru === 'string' && ask.input.soru.trim()) return { kind: 'question', question: ask.input.soru.trim().slice(0, 500) };
  if (message.stop_reason === 'max_tokens' || message.stop_reason === 'pause_turn') return { kind: 'incomplete' };
  const texts = message.content.filter(b => (b as { type?: string }).type === 'text').map(b => String((b as { text?: unknown }).text ?? '').trim()).filter(Boolean);
  return { kind: 'delivered', summary: texts.join('\n\n'), fileIds: outputFileIds(message.content) };
}

/** A plain-text delivery (correspondence) becomes a .txt file with this name. */
export function textFileName(title: string) {
  const base = title.toLocaleLowerCase('tr').replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'metin';
  return `${base}.txt`;
}

/** Keeps a model-chosen file name to a safe base name. */
export function safeFileName(name: string, fallback: string) {
  const base = name.split(/[\\/]/).pop()?.replace(/[^\w.\-]+/g, '_').replace(/^\.+/, '').slice(-120) ?? '';
  return base && base !== '.' && base !== '..' ? base : fallback;
}

/**
 * What a free (OpenRouter) model hands in instead of an Office file: it has no sandbox, so it
 * writes the file's text itself in a format Word, Excel or a browser opens.
 */
export const FREE_OUTPUT: Record<TaskCategoryId, { extension: string; contentType: string; instructions: string }> = {
  design: { extension: 'svg', contentType: 'image/svg+xml', instructions: 'Tasarımı tek, eksiksiz bir SVG belgesi olarak yaz (viewBox ver, yazı tipi olarak sans-serif kullan, dış kaynak bağlama).' },
  document: { extension: 'html', contentType: 'text/html; charset=utf-8', instructions: 'Belgeyi Word ve tarayıcıda açılabilen, satır içi CSS ile biçimlenmiş tek bir HTML belgesi olarak yaz.' },
  research: { extension: 'html', contentType: 'text/html; charset=utf-8', instructions: 'Raporu tek bir HTML belgesi olarak yaz: özet, bulgular, karşılaştırma tablosu, sonuç. Web erişimin yok; bilmediğin güncel bilgiyi uydurma, varsayımları belirt.' },
  presentation: { extension: 'html', contentType: 'text/html; charset=utf-8', instructions: 'Sunumu tek bir HTML belgesi olarak yaz; her slayt tam ekran bir <section>, satır içi CSS ile.' },
  translation: { extension: 'html', contentType: 'text/html; charset=utf-8', instructions: 'Çeviriyi biçimi koruyarak tek bir HTML belgesi olarak yaz.' },
  spreadsheet: { extension: 'csv', contentType: 'text/csv; charset=utf-8', instructions: 'Tabloyu Excel\'in açacağı CSV olarak yaz: ayırıcı noktalı virgül (;), ondalık ayırıcı virgül, ilk satır başlık. Toplamları hesaplayıp yaz.' },
  data: { extension: 'csv', contentType: 'text/csv; charset=utf-8', instructions: 'Sonucu Excel\'in açacağı CSV olarak yaz: ayırıcı noktalı virgül (;), ilk satır başlık.' },
  correspondence: { extension: 'txt', contentType: 'text/plain; charset=utf-8', instructions: 'Yalnızca gönderilmeye hazır metni yaz.' },
};

/** The two functions a free model works with: ask the person, or hand in the file. */
export const FREE_TOOLS = [
  { type: 'function' as const, function: { name: ASK_TOOL.name, description: ASK_TOOL.description, parameters: ASK_TOOL.input_schema } },
  {
    type: 'function' as const,
    function: {
      name: 'teslim_et',
      description: 'Bitmiş işi teslim eder. icerik dosyanın tam metnidir.',
      parameters: {
        type: 'object', additionalProperties: false, required: ['dosya_adi', 'icerik', 'not'],
        properties: {
          dosya_adi: { type: 'string', description: 'Uzantısız kısa dosya adı, Türkçe karakter olmadan.' },
          icerik: { type: 'string', description: 'Dosyanın eksiksiz içeriği.' },
          not: { type: 'string', description: '1-3 cümlelik teslim notu.' },
        },
      },
    },
  },
];

export function freeSystemPrompt(task: TaskInput) {
  const member = STAFF.find(s => s.id === task.agentId);
  return [
    `Sen ${task.companyName ? `${task.companyName} firmasının` : 'bir firmanın'} yapay zekâ ofisinde çalışan ${member?.name ?? 'bir çalışan'}sın (${member?.title ?? CATEGORY[task.category].label}).`,
    WORK[task.category].instructions.split('.')[0] + '.',
    FREE_OUTPUT[task.category].instructions,
    'İşi bitirince teslim_et fonksiyonunu çağır. Gerçekten gerekli bir bilgi eksikse ve makul bir varsayım yapamıyorsan soru_sor fonksiyonunu çağır.',
    PLACEHOLDER_RULE,
  ].join('\n\n');
}

type FreeMessage = { content?: string | null; tool_calls?: Array<{ type?: string; function?: { name?: string; arguments?: string } }> | null };

/** Reads a free model's answer: a function call when it made one, its plain text otherwise. */
export function readFreeOutcome(message: FreeMessage | undefined, finishReason: string | null | undefined):
  | { kind: 'question'; question: string } | { kind: 'delivered'; name: string | null; content: string; summary: string } | { kind: 'incomplete' } {
  for (const call of message?.tool_calls ?? []) {
    let args: Record<string, unknown> = {};
    try { args = JSON.parse(call.function?.arguments || '{}'); } catch { continue; }
    if (call.function?.name === ASK_TOOL.name && typeof args.soru === 'string' && args.soru.trim()) return { kind: 'question', question: args.soru.trim().slice(0, 500) };
    if (call.function?.name === 'teslim_et' && typeof args.icerik === 'string' && args.icerik.trim()) {
      return { kind: 'delivered', name: typeof args.dosya_adi === 'string' ? args.dosya_adi : null, content: args.icerik, summary: typeof args.not === 'string' ? args.not.trim() : '' };
    }
  }
  if (finishReason === 'length') return { kind: 'incomplete' };
  const text = (message?.content ?? '').trim();
  // Some free models skip the function and answer in text; a fenced block is then the file.
  const fenced = text.match(/```[a-z]*\n([\s\S]*?)```/i);
  return text ? { kind: 'delivered', name: null, content: fenced ? fenced[1] : text, summary: fenced ? text.replace(fenced[0], '').trim().slice(0, 1000) : '' } : { kind: 'incomplete' };
}
