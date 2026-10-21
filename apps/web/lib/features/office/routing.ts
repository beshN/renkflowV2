import type { ManagerReview } from './review';
import { CATEGORY, type Capability, type TaskCategoryId } from './catalog';

/**
 * The office manager's call on a task: how hard it is and which model takes it. Difficulty picks
 * a tier (fast, balanced, strong); each tier names a model from the ones the office may use. For
 * now the product runs only on Claude Sonnet 5.5, so every tier points at it; other models are
 * added to OFFICE_MODELS and TIER_MODEL later without touching the manager's reasoning.
 */

export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTY_LABELS: Record<Difficulty, string> = { easy: 'Kolay', medium: 'Orta', hard: 'Zor' };

export type OfficeModel = { id: string; label: string; capabilities: Capability[] };

/** Models the office may hand work to. Image generation is not among them yet. */
export const OFFICE_MODELS: Record<string, OfficeModel> = {
  'claude-sonnet-5-5': { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', capabilities: ['text', 'files', 'web'] },
};

/** OpenCode catalog IDs verified against /zen/v1/models; no paid fallback. */
export const OPENCODE_MODELS: Record<'manager' | 'finance' | 'documents' | 'reviewer', OfficeModel> = {
  manager: { id: 'minimax-m3.1-flash-free', label: 'MiniMax M3.1 Flash', capabilities: ['text', 'files'] },
  finance: { id: 'deepseek-v4.1-flash-free', label: 'DeepSeek V4.1 Flash', capabilities: ['text', 'files'] },
  documents: { id: 'mimo-v2.6-flash-free', label: 'MiMo-V2.6 Flash', capabilities: ['text', 'files'] },
  reviewer: { id: 'glm-5.3-flash-free', label: 'GLM-5.3 Flash', capabilities: ['text', 'files'] },
};

export function openCodeDecision(decision: ManagerDecision, category: TaskCategoryId): ManagerDecision {
  const model = category === 'spreadsheet' || category === 'data' ? OPENCODE_MODELS.finance
    : category === 'document' || category === 'translation' || category === 'presentation' || category === 'research' ? OPENCODE_MODELS.documents
    : OPENCODE_MODELS.reviewer;
  return { ...decision, model, missing: CATEGORY[category].needs.filter(need => !model.capabilities.includes(need)) };
}

/** Which model each tier uses: a fast one for easy work, a strong one for hard work. */
export const TIER_MODEL: Record<Difficulty, string> = {
  easy: 'claude-sonnet-5-5',
  medium: 'claude-sonnet-5-5',
  hard: 'claude-sonnet-5-5',
};

/** How long the work takes relative to the category's usual time. */
export const DIFFICULTY_PACE: Record<Difficulty, number> = { easy: 0.8, medium: 1, hard: 1.4 };

/** How demanding each kind of work is before the brief is read. */
const CATEGORY_WEIGHT: Record<TaskCategoryId, number> = {
  design: 2, research: 2, presentation: 2, document: 1, spreadsheet: 1, data: 1, correspondence: 0, translation: 0,
};

const DEMANDING = /analiz|karşılaştır|detaylı|kapsamlı|strateji|finansal|sözleşme|hukuk|çok sayfalı|yıllık|pazar|rakip|formül/i;

export type ManagerDecision = {
  review?: ManagerReview;
  reviewHistory?: ManagerReview[];
  difficulty: Difficulty; score: number; reasons: string[];
  model: OfficeModel;
  /** What the category needs that the chosen model cannot do; the work falls back accordingly. */
  missing: Capability[];
  /** How the manager read the kind of work from the plain-words task, when it was written that way. */
  triage?: { by: 'model' | 'rules'; reason: string };
};

export function decide(task: { category: TaskCategoryId; title: string; brief: string; revisions: number }): ManagerDecision {
  const reasons: string[] = [];
  let score = CATEGORY_WEIGHT[task.category];
  if (score) reasons.push(`${CATEGORY[task.category].label} işi`);
  const text = `${task.title} ${task.brief}`;
  if (task.brief.length > 800) { score += 2; reasons.push('çok uzun brif'); }
  else if (task.brief.length > 300) { score += 1; reasons.push('uzun brif'); }
  if (DEMANDING.test(text)) { score += 1; reasons.push('kapsamlı istek'); }
  if (task.revisions > 0) { score += 1; reasons.push('revizyon'); }
  const difficulty: Difficulty = score >= 4 ? 'hard' : score >= 2 ? 'medium' : 'easy';
  const model = OFFICE_MODELS[TIER_MODEL[difficulty]];
  const missing = CATEGORY[task.category].needs.filter(need => !model.capabilities.includes(need));
  return { difficulty, score, reasons, model, missing };
}

/** Plain words for what a missing capability means for the work. */
export const MISSING_NOTE: Partial<Record<Capability, string>> = {
  image: 'görsel üretim modeli henüz yok; tasarım SVG/HTML ile hazırlanacak',
};
