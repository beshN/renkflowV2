import 'server-only';

import { randomUUID } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { sql } from '@/lib/db';
import { uploadFile } from '@/lib/storage';
import { providerConfig } from '@/lib/ai/providers';
import { costUsd, withUsage } from '@/lib/ai/usage';
import { ModelBlockedError } from '@/lib/ai/policy';
import { maskPersonalData } from '@/lib/ai/privacy';
import { CATEGORY, type TaskCategoryId } from './catalog';
import { OFFICE_MODELS, TIER_MODEL, type ManagerDecision } from './routing';
import { reviewOfficeTask } from './review.server';
import { EFFORT, FREE_OUTPUT, FREE_TOOLS, WORK, freeSystemPrompt, readFreeOutcome, readOutcome, requestTools, safeFileName, systemPrompt, textFileName, userMessage, type TaskInput } from './work';

/**
 * Runs one queued AI office task for real on the model the manager chose: Office files are built
 * with Anthropic's prebuilt skills in its code sandbox and copied into the firm's private Blob
 * store; a raised hand (soru_sor) parks the task until the person answers. Called after the
 * request that queued the task has answered, inside the route's time budget.
 */

/** Below the routes' 300 s limit, so a slow run is recorded as failed rather than cut off silently. */
const RUN_TIMEOUT_MS = 270_000;
/** Server tools pause a long turn; resume it this many times at most. */
const MAX_CONTINUATIONS = 3;

function client() {
  const config = providerConfig('anthropic');
  if (!config.apiKey) throw new Error('ANTHROPIC_API_KEY yapılandırılmamış.');
  return new Anthropic({ apiKey: config.apiKey, timeout: RUN_TIMEOUT_MS, maxRetries: 0 });
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1';

/** The free OpenRouter models: one function-calling turn, the file written as text by the model. */
async function runOnOpenRouter(model: string, input: TaskInput, maskedText: string, meta: { tenantId: string; userId: string }) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENROUTER_API_KEY tanımlı değil.');
  const client = new OpenAI({ apiKey, baseURL: OPENROUTER_URL, timeout: RUN_TIMEOUT_MS, maxRetries: 0, defaultHeaders: { 'X-Title': 'RenkFlow AI ofis' } });
  const { response } = await withUsage({ ...meta, feature: 'office' }, 'openrouter', model, async () => {
    const response = await client.chat.completions.create({
      model, max_tokens: 32_000,
      messages: [{ role: 'system', content: freeSystemPrompt(input) }, { role: 'user', content: maskedText }],
      tools: FREE_TOOLS,
    });
    return { response, usage: { input_tokens: response.usage?.prompt_tokens ?? null, output_tokens: response.usage?.completion_tokens ?? null } };
  });
  const choice = response.choices[0];
  return readFreeOutcome(choice?.message, choice?.finish_reason);
}

const failRun = (tenantId: string, taskId: string, error: string, cost = 0) =>
  sql`UPDATE office_tasks SET status='failed', error=${error.slice(0, 500)}, cost_usd=cost_usd+${cost}, updated_at=now()
    WHERE tenant_id=${tenantId} AND id=${taskId} AND status='working'`;

export async function runOfficeTask(tenantId: string, taskId: string) {
  const [task] = await sql`UPDATE office_tasks SET status='working', started_at=now(), question=NULL, error=NULL, updated_at=now()
    WHERE tenant_id=${tenantId} AND id=${taskId} AND status='queued' RETURNING *`;
  if (!task) return;
  const [tenant] = await sql`SELECT name FROM tenants WHERE id=${tenantId}`;
  const category = task.category as TaskCategoryId;
  const decision = task.decision as ManagerDecision;
  // Only models the office may use; an unknown stored id falls back to the tier's model.
  const chosen = OFFICE_MODELS[decision.model?.id] ?? OFFICE_MODELS[TIER_MODEL[decision.difficulty] ?? TIER_MODEL.medium];
  const model = chosen.id;
  let spent = 0;
  try {
    const input = {
      category, title: task.title, brief: task.brief, agentId: task.agent_id,
      answers: task.answers ?? [], notes: task.notes ?? [], revision: Number(task.revisions), companyName: tenant?.name ?? null,
    };
    // Personal data (e-mail, phone, IBAN, TC no) leaves as placeholders and is put back in text answers.
    const masked = maskPersonalData(userMessage(input));
    const revision = Number(task.revisions);
    const saved: string[] = [];
    const save = async (name: string, contentType: string, bytes: Buffer) => {
      const key = `office/${tenantId}/${taskId}/r${revision}-${randomUUID()}-${name}`;
      await uploadFile(key, bytes, contentType);
      await sql`INSERT INTO office_files (tenant_id, task_id, revision, file_name, content_type, size_bytes, storage_key)
        VALUES (${tenantId}, ${taskId}, ${revision}, ${name}, ${contentType}, ${bytes.length}, ${key})`;
      saved.push(name);
    };

    if (chosen.provider === 'openrouter') {
      const outcome = await runOnOpenRouter(model, input, masked.text, { tenantId, userId: task.created_by });
      if (outcome.kind === 'question') {
        await sql`UPDATE office_tasks SET status='needs_input', question=${masked.restore(outcome.question)}, updated_at=now()
          WHERE tenant_id=${tenantId} AND id=${taskId} AND status='working'`;
        return;
      }
      if (outcome.kind === 'incomplete') return void (await failRun(tenantId, taskId, 'Ücretsiz model işi bitiremedi; görevi kısaltın ya da Claude ile deneyin.'));
      const output = FREE_OUTPUT[category];
      const base = textFileName(outcome.name || task.title).replace(/\.txt$/, '');
      // A BOM makes Excel read Turkish characters in a CSV correctly.
      const body = (output.extension === 'csv' ? '\uFEFF' : '') + masked.restore(outcome.content);
      await save(`${base}.${output.extension}`, output.contentType, Buffer.from(body, 'utf8'));
      await sql`UPDATE office_tasks SET status='checking', review=NULL, summary=${masked.restore(outcome.summary || `${saved[0]} hazır.`).slice(0, 4000)},
        delivered_at=now(), updated_at=now() WHERE tenant_id=${tenantId} AND id=${taskId} AND status='working'`;
      return;
    }

    const { tools, container, betas } = requestTools(category);
    const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: masked.text }];
    const anthropic = client();
    let message: Anthropic.Beta.BetaMessage | null = null;
    for (let turn = 0; turn <= MAX_CONTINUATIONS; turn++) {
      message = await withUsage({ tenantId, userId: task.created_by, feature: 'office' }, 'anthropic', model, () =>
        anthropic.beta.messages.stream({
          model, max_tokens: 32_000,
          system: systemPrompt(input),
          messages,
          tools: tools as unknown as Anthropic.Beta.BetaToolUnion[],
          ...(container ? { container: container as Anthropic.Beta.BetaContainerParams } : {}),
          ...(betas.length ? { betas: betas as Anthropic.Beta.AnthropicBeta[] } : {}),
          thinking: { type: 'adaptive' },
          output_config: { effort: EFFORT[decision.difficulty] ?? 'medium' },
        }).finalMessage());
      spent += costUsd(model, message.usage as never) ?? 0;
      if (message.stop_reason !== 'pause_turn') break;
      messages.push({ role: 'assistant', content: message.content });
    }
    const outcome = readOutcome({ stop_reason: message!.stop_reason, content: message!.content as unknown[] });

    if (outcome.kind === 'question') {
      await sql`UPDATE office_tasks SET status='needs_input', question=${masked.restore(outcome.question)}, cost_usd=cost_usd+${spent}, updated_at=now()
        WHERE tenant_id=${tenantId} AND id=${taskId} AND status='working'`;
      return;
    }
    if (outcome.kind === 'refused') return void (await failRun(tenantId, taskId, 'Model bu isteği yerine getirmedi. Görevi farklı ifade edip yeniden deneyin.', spent));
    if (outcome.kind === 'incomplete') return void (await failRun(tenantId, taskId, 'İş tek seferde bitirilemedi; görevi daha küçük parçalara bölün.', spent));

    const summary = masked.restore(outcome.summary);
    if (!WORK[category].code) {
      // Plain text is the deliverable itself.
      await save(textFileName(task.title), 'text/plain; charset=utf-8', Buffer.from(summary, 'utf8'));
    } else {
      for (const fileId of outcome.fileIds) {
        try {
          const meta = await anthropic.files.retrieveMetadata(fileId);
          const response = await anthropic.files.download(fileId);
          await save(safeFileName(meta.filename, `dosya-${saved.length + 1}`), meta.mime_type || 'application/octet-stream', Buffer.from(await response.arrayBuffer()));
          // The firm's copy is in its own store now; nothing stays with the provider longer than needed.
          await anthropic.files.delete(fileId).catch(() => undefined);
        } catch (error) {
          console.error('[office] Üretilen dosya alınamadı:', fileId, error instanceof Error ? error.message : error);
        }
      }
      if (!saved.length) return void (await failRun(tenantId, taskId, `${CATEGORY[category].output.kind} dosyası üretilemedi. Yeniden deneyin.`, spent));
    }
    await sql`UPDATE office_tasks SET status='checking', review=NULL, summary=${WORK[category].code ? summary.slice(0, 4000) : `${saved[0]} hazır.`},
      delivered_at=now(), cost_usd=cost_usd+${spent}, updated_at=now() WHERE tenant_id=${tenantId} AND id=${taskId} AND status='working'`;
  } catch (error) {
    const reason = error instanceof ModelBlockedError ? error.message
      : error instanceof Anthropic.APIError || error instanceof OpenAI.APIError ? `Model hizmeti hata verdi (${error.status ?? 'bağlantı'}). ${error.status === 429 ? 'Ücretsiz modelin sınırı doldu; biraz sonra' : ''} Yeniden deneyin.`.replace(/\s+/g, ' ')
      : 'İş beklenmedik bir hatayla durdu. Yeniden deneyin.';
    if (!(error instanceof ModelBlockedError)) console.error('[office] Görev çalıştırılamadı:', taskId, error instanceof Error ? error.message : error);
    await failRun(tenantId, taskId, reason, spent);
  }
}

/**
 * Takes a task as far as the time left allows: the work, the manager's check and, when the
 * manager sends it back, the work again. What does not fit is picked up by the next look at the
 * office (listOfficeTasks reports it as due).
 */
export async function driveOfficeTask(tenantId: string, taskId: string, budgetMs = 280_000) {
  const deadline = Date.now() + budgetMs;
  for (let round = 0; round < 4; round++) {
    const [row] = await sql`SELECT status FROM office_tasks WHERE tenant_id=${tenantId} AND id=${taskId}`;
    const left = deadline - Date.now();
    if (row?.status === 'queued' && (round === 0 || left > 200_000)) await runOfficeTask(tenantId, taskId);
    else if (row?.status === 'checking' && left > 60_000) await reviewOfficeTask(tenantId, taskId);
    else return;
  }
}
