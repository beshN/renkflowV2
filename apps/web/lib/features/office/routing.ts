import { CATEGORY, type Capability, type TaskCategoryId } from './catalog';

/**
 * The office manager's call on a task: how hard it is and which model takes it. Difficulty picks
 * a tier (fast, balanced, strong); each tier names a model from the ones the office may use. The
 * office runs on Claude Sonnet 5.5 (every Claude tier points at it); a person can instead try the
 * free models on OpenRouter, a separate family with its own tiers and no Office-file sandbox.
 */

export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTY_LABELS: Record<Difficulty, string> = { easy: 'Kolay', medium: 'Orta', hard: 'Zor' };

export type ModelFamily = 'claude' | 'free';
export type OfficeModel = { id: string; label: string; provider: 'anthropic' | 'openrouter'; family: ModelFamily; capabilities: Capability[] };

/** Models the office may hand work to. Image generation is not among them yet. */
export const OFFICE_MODELS: Record<string, OfficeModel> = {
  'claude-sonnet-5-5': { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', provider: 'anthropic', family: 'claude', capabilities: ['text', 'files', 'web'] },
  // Free models on OpenRouter, for trying the office out; picked for their Turkish and reasoning.
  'nvidia/nemotron-3-ultra-550b-a55b:free': { id: 'nvidia/nemotron-3-ultra-550b-a55b:free', label: 'NVIDIA Nemotron 3 Ultra (ücretsiz)', provider: 'openrouter', family: 'free', capabilities: ['text'] },
  'minimax/minimax-m3.1-flash:free': { id: 'minimax/minimax-m3.1-flash:free', label: 'MiniMax M3.1 Flash (ücretsiz)', provider: 'openrouter', family: 'free', capabilities: ['text'] },
  'nvidia/nemotron-3.5-super-vl:free': { id: 'nvidia/nemotron-3.5-super-vl:free', label: 'NVIDIA Nemotron 3.5 Super VL (ücretsiz)', provider: 'openrouter', family: 'free', capabilities: ['text'] },
};

export const FAMILY_LABELS: Record<ModelFamily, string> = { claude: 'Claude Sonnet 5.5', free: 'Ücretsiz modeller (deneme)' };

/** Which model each tier uses: a fast one for easy work, a strong one for hard work. */
export const TIER_MODEL: Record<Difficulty, string> = {
  easy: 'claude-sonnet-5-5',
  medium: 'claude-sonnet-5-5',
  hard: 'claude-sonnet-5-5',
};

/** The free family's tiers: the strongest free model only where the work is hard. */
export const FREE_TIER_MODEL: Record<Difficulty, string> = {
  easy: 'nvidia/nemotron-3.5-super-vl:free',
  medium: 'minimax/minimax-m3.1-flash:free',
  hard: 'nvidia/nemotron-3-ultra-550b-a55b:free',
};

/** How long the work takes relative to the category's usual time. */
export const DIFFICULTY_PACE: Record<Difficulty, number> = { easy: 0.8, medium: 1, hard: 1.4 };

/** How demanding each kind of work is before the brief is read. */
const CATEGORY_WEIGHT: Record<TaskCategoryId, number> = {
  design: 2, research: 2, presentation: 2, document: 1, spreadsheet: 1, data: 1, correspondence: 0, translation: 0,
};

const DEMANDING = /analiz|karşılaştır|detaylı|kapsamlı|strateji|finansal|sözleşme|hukuk|çok sayfalı|yıllık|pazar|rakip|formül/i;

export type ManagerDecision = {
  difficulty: Difficulty; score: number; reasons: string[];
  model: OfficeModel;
  /** What the category needs that the chosen model cannot do; the work falls back accordingly. */
  missing: Capability[];
  /** How the manager read the kind of work from the plain-words task, when it was written that way. */
  triage?: { by: 'model' | 'rules'; reason: string };
};

export function decide(task: { category: TaskCategoryId; title: string; brief: string; revisions: number }, family: ModelFamily = 'claude'): ManagerDecision {
  const reasons: string[] = [];
  let score = CATEGORY_WEIGHT[task.category];
  if (score) reasons.push(`${CATEGORY[task.category].label} işi`);
  const text = `${task.title} ${task.brief}`;
  if (task.brief.length > 800) { score += 2; reasons.push('çok uzun brif'); }
  else if (task.brief.length > 300) { score += 1; reasons.push('uzun brif'); }
  if (DEMANDING.test(text)) { score += 1; reasons.push('kapsamlı istek'); }
  if (task.revisions > 0) { score += 1; reasons.push('revizyon'); }
  const difficulty: Difficulty = score >= 4 ? 'hard' : score >= 2 ? 'medium' : 'easy';
  const model = OFFICE_MODELS[(family === 'free' ? FREE_TIER_MODEL : TIER_MODEL)[difficulty]];
  const missing = CATEGORY[task.category].needs.filter(need => !model.capabilities.includes(need));
  return { difficulty, score, reasons, model, missing };
}

/** Plain words for what a missing capability means for the work. */
export const MISSING_NOTE: Partial<Record<Capability, string>> = {
  image: 'görsel üretim modeli henüz yok; tasarım SVG/HTML ile hazırlanacak',
  files: 'bu model Office dosyası üretemez; belge HTML, tablo CSV olarak teslim edilir',
  web: 'bu modelde web araması yok; bilgi modelin kendi bilgisiyle sınırlı',
};
