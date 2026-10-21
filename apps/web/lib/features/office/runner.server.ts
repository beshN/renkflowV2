import 'server-only';

import { openCodeEnabled, produceOpenCode } from './opencode.server';
import { reviewDelivery } from './review.server';
import type { DeliveryFile } from './inspect.server';
import { randomUUID } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { sql } from '@/lib/db';
import { uploadFile } from '@/lib/storage';
import { providerConfig } from '@/lib/ai/providers';
import { costUsd, withUsage } from '@/lib/ai/usage';
import { ModelBlockedError } from '@/lib/ai/policy';
import { maskPersonalData } from '@/lib/ai/privacy';
import { CATEGORY, type TaskCategoryId } from './catalog';
import { OFFICE_MODELS, TIER_MODEL, openCodeDecision, type ManagerDecision } from './routing';
import { EFFORT, WORK, readOutcome, requestTools, safeFileName, systemPrompt, textFileName, userMessage } from './work';

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

const failRun = (tenantId: string, taskId: string, error: string, cost = 0, lease?: Date) =>
  sql`UPDATE office_tasks SET status='failed', error=${error.slice(0, 500)}, cost_usd=cost_usd+${cost}, updated_at=now()
    WHERE tenant_id=${tenantId} AND id=${taskId} AND status='working' AND started_at=${lease}`;

export async function runOfficeTask(tenantId: string, taskId: string, signal: AbortSignal = AbortSignal.timeout(260_000), automaticRevision = 0) {
  const [task] = await sql`UPDATE office_tasks SET status='working', started_at=date_trunc('milliseconds',clock_timestamp()), decision=decision-'review', question=NULL, error=NULL, updated_at=now()
    WHERE tenant_id=${tenantId} AND id=${taskId} AND status='queued' RETURNING *`;
  if (!task) return;
  const lease = task.started_at;
  delete task.decision.review;
  const [tenant] = await sql`SELECT name FROM tenants WHERE id=${tenantId}`;
  const category = task.category as TaskCategoryId;
  const decision = openCodeEnabled() ? openCodeDecision(task.decision as ManagerDecision, category) : task.decision as ManagerDecision;
  // Only models the office may use; an unknown stored id falls back to the tier's model.
  const model = openCodeEnabled() ? decision.model.id : OFFICE_MODELS[decision.model?.id]?.id ?? TIER_MODEL[decision.difficulty] ?? TIER_MODEL.medium;
  let spent = 0;
  try {
    const input = {
      category, title: task.title, brief: task.brief, agentId: task.agent_id,
      answers: task.answers ?? [], notes: task.notes ?? [], revision: Number(task.revisions), companyName: tenant?.name ?? null,
    };
    // Personal data (e-mail, phone, IBAN, TC no) leaves as placeholders and is put back in text answers.
    const masked = maskPersonalData(userMessage(input));
    const free = openCodeEnabled() ? await produceOpenCode(input, model, { tenantId, userId: task.created_by, feature: 'office' }, signal) : null;
    const { tools, container, betas } = requestTools(category);
    const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: masked.text }];
    const anthropic = free ? null : client();
    let message: Anthropic.Beta.BetaMessage | null = null;
    for (let turn = 0; !free && turn <= MAX_CONTINUATIONS; turn++) {
      message = await withUsage({ tenantId, userId: task.created_by, feature: 'office' }, 'anthropic', model, () =>
        anthropic!.beta.messages.stream({
          model, max_tokens: 32_000,
          system: systemPrompt(input),
          messages,
          tools: tools as unknown as Anthropic.Beta.BetaToolUnion[],
          ...(container ? { container: container as Anthropic.Beta.BetaContainerParams } : {}),
          ...(betas.length ? { betas: betas as Anthropic.Beta.AnthropicBeta[] } : {}),
          thinking: { type: 'adaptive' },
          output_config: { effort: EFFORT[decision.difficulty] ?? 'medium' },
        }, { signal }).finalMessage());
      spent += costUsd(model, message.usage as never) ?? 0;
      if (message.stop_reason !== 'pause_turn') break;
      messages.push({ role: 'assistant', content: message.content });
    }
    const outcome = free ? (free.question ? { kind: 'question' as const, question: free.question } : { kind: 'delivered' as const, summary: free.summary, fileIds: [] as string[] }) : readOutcome({ stop_reason: message!.stop_reason, content: message!.content as unknown[] });

    if (outcome.kind === 'question') {
      await sql`UPDATE office_tasks SET status='needs_input', question=${masked.restore(outcome.question)}, cost_usd=cost_usd+${spent}, updated_at=now()
        WHERE tenant_id=${tenantId} AND id=${taskId} AND status='working' AND started_at=${lease}`;
      return;
    }
    if (outcome.kind === 'refused') return void (await failRun(tenantId, taskId, 'Model bu isteği yerine getirmedi. Görevi farklı ifade edip yeniden deneyin.', spent, lease));
    if (outcome.kind === 'incomplete') return void (await failRun(tenantId, taskId, 'İş tek seferde bitirilemedi; görevi daha küçük parçalara bölün.', spent, lease));

    const summary = masked.restore(outcome.summary);
    const revision = Number(task.revisions);
    const saved: string[] = [];
    const deliveredFiles: DeliveryFile[] = [];
    const save = async (name: string, contentType: string, bytes: Buffer) => {
      signal.throwIfAborted();
      if (!bytes.length || bytes.length > 8 * 1024 * 1024 || saved.length >= 8) throw new Error('Teslim dosyası sınırın dışında.');
      const key = `office/${tenantId}/${taskId}/r${revision}-${randomUUID()}-${name}`;
      await uploadFile(key, bytes, contentType);
      await sql`INSERT INTO office_files (tenant_id, task_id, revision, file_name, content_type, size_bytes, storage_key)
        VALUES (${tenantId}, ${taskId}, ${revision}, ${name}, ${contentType}, ${bytes.length}, ${key})`;
      saved.push(name);
      deliveredFiles.push({ name, contentType, bytes });
    };
    if (free) {
      for (const file of free.files) await save(file.name, file.contentType, file.bytes);
    } else if (!WORK[category].code) {
      // Plain text is the deliverable itself.
      await save(textFileName(task.title), 'text/plain; charset=utf-8', Buffer.from(summary, 'utf8'));
    } else {
      for (const fileId of outcome.fileIds) {
        try {
          const meta = await anthropic!.files.retrieveMetadata(fileId, {}, { signal });
          if (meta.size_bytes > 8 * 1024 * 1024) throw new Error('Dosya boyut sınırını aşıyor.');
          const response = await anthropic!.files.download(fileId, {}, { signal });
          await save(safeFileName(meta.filename, `dosya-${saved.length + 1}`), meta.mime_type || 'application/octet-stream', Buffer.from(await response.arrayBuffer()));
          // The firm's copy is in its own store now; nothing stays with the provider longer than needed.
          await anthropic!.files.delete(fileId, {}, { signal }).catch(() => undefined);
        } catch (error) {
          console.error('[office] Üretilen dosya alınamadı:', fileId, error instanceof Error ? error.message : error);
        }
      }
      if (!saved.length) return void (await failRun(tenantId, taskId, `${CATEGORY[category].output.kind} dosyası üretilemedi. Yeniden deneyin.`, spent, lease));
    }
    decision.review = { status: 'checking', score: null, note: 'Yönetici teslim dosyalarını inceliyor.', issues: [], revision, checkedAt: new Date().toISOString() };
    const [owned] = await sql`UPDATE office_tasks SET decision=${sql.json(decision)}, updated_at=now()
      WHERE tenant_id=${tenantId} AND id=${taskId} AND status='working' AND started_at=${lease} RETURNING id`;
    if (!owned) return;
    const checked = await reviewDelivery(input, deliveredFiles, { tenantId, userId: task.created_by, feature: 'office_review' }, signal);
    spent += checked.cost;
    decision.review = checked.review;
    decision.reviewHistory = [...(decision.reviewHistory ?? []), checked.review].slice(-10);
    if (checked.review.status === 'changes_requested' && automaticRevision < 1 && !signal.aborted) {
      const note = `Yönetici düzeltmesi: ${checked.review.note} ${checked.review.issues.join(' · ')}`.slice(0, 2000);
      const [retry] = await sql`UPDATE office_tasks SET status='queued', revisions=revisions+1,
        notes=notes || ${sql.json([note])}::jsonb, decision=${sql.json(decision)}, cost_usd=cost_usd+${spent}, updated_at=now()
        WHERE tenant_id=${tenantId} AND id=${taskId} AND status='working' AND started_at=${lease} RETURNING id`;
      if (retry) await runOfficeTask(tenantId, taskId, signal, automaticRevision + 1);
      return;
    }
    if (checked.review.status === 'changes_requested') decision.review = { ...checked.review, status: 'needs_human', note: `Otomatik düzeltme sonrası hâlâ sorun var. ${checked.review.note}` };
    await sql`UPDATE office_tasks SET status='review', summary=${WORK[category].code ? summary.slice(0, 4000) : `${saved[0]} hazır.`},
      decision=${sql.json(decision)}, delivered_at=now(), cost_usd=cost_usd+${spent}, updated_at=now()
      WHERE tenant_id=${tenantId} AND id=${taskId} AND status='working' AND started_at=${lease}`;
  } catch (error) {
    const reason = error instanceof ModelBlockedError ? error.message
      : error instanceof Anthropic.APIError ? `Model hizmeti hata verdi (${error.status ?? 'bağlantı'}). Yeniden deneyin.`
      : 'İş beklenmedik bir hatayla durdu. Yeniden deneyin.';
    if (!(error instanceof ModelBlockedError)) console.error('[office] Görev çalıştırılamadı:', taskId, error instanceof Error ? error.message : error);
    await failRun(tenantId, taskId, reason, spent, lease);
  }
}
