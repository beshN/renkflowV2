import 'server-only';

import { openCodeEnabled, produceOpenCode } from './opencode.server';
import { reviewDelivery } from './review.server';
import type { DeliveryFile } from './inspect.server';
import { randomUUID } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { sql } from '@/lib/db';
import { deleteFile, uploadFile } from '@/lib/storage';
import { providerConfig } from '@/lib/ai/providers';
import { costUsd, withUsage } from '@/lib/ai/usage';
import { ModelBlockedError } from '@/lib/ai/policy';
import { createMasker, personalValues } from '@/lib/ai/privacy';
import { tenantPersonalNames } from '@/lib/ai/known-names';
import { CATEGORY, type TaskCategoryId } from './catalog';
import { companyProfile, lookUpRecords, taskActor } from './data.server';
import { mayReadOfficeTask } from './access';
import { OFFICE_MODELS, TIER_MODEL, openCodeDecision, type ManagerDecision } from './routing';
import { unmaskFile } from './unmask';
import { EFFORT, WORK, dataCalls, readOutcome, requestTools, safeFileName, systemPrompt, textFileName, userMessage, type DataCall } from './work';

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
/** Turns spent looking up the firm's records, and lookups answered per turn. */
const MAX_LOOKUP_ROUNDS = 4;
const LOOKUPS_PER_TURN = 5;
/** A lookup's answer as the model sees it; longer lists are cut. */
const LOOKUP_CHARS = 20_000;

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
  const category = task.category as TaskCategoryId;
  const decision = openCodeEnabled() ? openCodeDecision(task.decision as ManagerDecision, category) : task.decision as ManagerDecision;
  // Only models the office may use; an unknown stored id falls back to the tier's model.
  const model = openCodeEnabled() ? decision.model.id : OFFICE_MODELS[decision.model?.id]?.id ?? TIER_MODEL[decision.difficulty] ?? TIER_MODEL.medium;
  let spent = 0;
  try {
    const assertCurrentScope = async () => {
      const actor = await taskActor(tenantId, task.created_by);
      if (!actor?.access || !mayReadOfficeTask(actor.access, task.created_by, task as any))
        throw new Error('Görevi veren kişinin erişimi değişti; görev yeniden yetkilendirilmelidir.');
      return actor;
    };
    await assertCurrentScope();
    const [company, knownNames] = await Promise.all([companyProfile(tenantId), tenantPersonalNames(tenantId).catch(() => [] as string[])]);
    const input = {
      category, title: task.title, brief: task.brief, agentId: task.agent_id,
      answers: task.answers ?? [], notes: task.notes ?? [], revision: Number(task.revisions), companyName: company?.name ?? null, company,
    };
    // Personal data (names the firm knows, e-mail, phone, IBAN, TC no) leaves as placeholders, in the
    // task and in every record looked up, and is put back in the answer and the delivered files.
    const masker = createMasker(knownNames);
    const prompt = masker.mask(userMessage(input));
    const system = masker.mask(systemPrompt(input));
    if (openCodeEnabled()) await assertCurrentScope();
    const free = openCodeEnabled() ? await produceOpenCode(input, model, { tenantId, userId: task.created_by, feature: 'office' }, signal) : null;
    const { tools, container, betas } = requestTools(category);
    const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: prompt }];
    const anthropic = free ? null : client();
    const lookUp = async (call: DataCall) => {
      try {
        const actor = await assertCurrentScope();
        const found = await lookUpRecords(actor, call.category, masker.restore(call.query));
        masker.know(personalValues(found));
        return masker.mask(JSON.stringify(found ?? null)).slice(0, LOOKUP_CHARS);
      } catch (error) {
        console.error('[office] Firma kaydı okunamadı:', call.category, error instanceof Error ? error.message : error);
        return 'Kayıtlar şu anda okunamadı; elindeki bilgiyle devam et.';
      }
    };
    let message: Anthropic.Beta.BetaMessage | null = null;
    let lookups = 0;
    let sandboxId: string | null = null;
    for (let turn = 0; !free && turn <= MAX_CONTINUATIONS + MAX_LOOKUP_ROUNDS; turn++) {
      await assertCurrentScope();
      // A resumed turn keeps the same sandbox, so files built so far are still there.
      const sandbox: Anthropic.Beta.BetaContainerParams | undefined = sandboxId ? { ...(container as Anthropic.Beta.BetaContainerParams | undefined), id: sandboxId } : container as Anthropic.Beta.BetaContainerParams | undefined;
      message = await withUsage({ tenantId, userId: task.created_by, feature: 'office' }, 'anthropic', model, (): Promise<Anthropic.Beta.BetaMessage> =>
        anthropic!.beta.messages.stream({
          model, max_tokens: 32_000,
          system,
          messages,
          tools: tools as unknown as Anthropic.Beta.BetaToolUnion[],
          ...(sandbox ? { container: sandbox } : {}),
          ...(betas.length ? { betas: betas as Anthropic.Beta.AnthropicBeta[] } : {}),
          thinking: { type: 'adaptive' },
          output_config: { effort: EFFORT[decision.difficulty] ?? 'medium' },
        }, { signal }).finalMessage());
      spent += costUsd(model, message.usage as never) ?? 0;
      sandboxId = message.container?.id ?? sandboxId;
      if (message.stop_reason === 'pause_turn') {
        messages.push({ role: 'assistant', content: message.content });
        continue;
      }
      // Looking up records: answer every lookup and let the work go on; a question or a delivery ends the run.
      const calls = message.stop_reason === 'tool_use' ? dataCalls(message.content) : [];
      if (!calls.length || lookups >= MAX_LOOKUP_ROUNDS || readOutcome({ stop_reason: message.stop_reason, content: message.content }).kind === 'question') break;
      lookups++;
      messages.push({ role: 'assistant', content: message.content });
      messages.push({ role: 'user', content: await Promise.all(calls.map(async (call, i) => ({
        type: 'tool_result' as const, tool_use_id: call.id,
        content: i < LOOKUPS_PER_TURN ? await lookUp(call) : 'Bu turdaki arama sınırı doldu; bulduklarınla devam et.',
      }))) });
    }
    const outcome = free ? (free.question ? { kind: 'question' as const, question: free.question } : { kind: 'delivered' as const, summary: free.summary, fileIds: [] as string[] }) : readOutcome({ stop_reason: message!.stop_reason, content: message!.content as unknown[] });

    if (outcome.kind === 'question') {
      await sql`UPDATE office_tasks SET status='needs_input', question=${masker.restore(outcome.question)}, cost_usd=cost_usd+${spent}, updated_at=now()
        WHERE tenant_id=${tenantId} AND id=${taskId} AND status='working' AND started_at=${lease}`;
      return;
    }
    if (outcome.kind === 'refused') return void (await failRun(tenantId, taskId, 'Model bu isteği yerine getirmedi. Görevi farklı ifade edip yeniden deneyin.', spent, lease));
    if (outcome.kind === 'incomplete') return void (await failRun(tenantId, taskId, 'İş tek seferde bitirilemedi; görevi daha küçük parçalara bölün.', spent, lease));

    const summary = masker.restore(outcome.summary);
    const revision = Number(task.revisions);
    const saved: string[] = [];
    const deliveredFiles: DeliveryFile[] = [];
    const save = async (name: string, contentType: string, bytes: Buffer) => {
      signal.throwIfAborted();
      await assertCurrentScope();
      if (!bytes.length || bytes.length > 8 * 1024 * 1024 || saved.length >= 8) throw new Error('Teslim dosyası sınırın dışında.');
      // The firm's copy gets the real names back; the manager checks the placeholder copy the model made.
      const stored = unmaskFile({ name, contentType, bytes }, value => masker.restore(value));
      const key = `office/${tenantId}/${taskId}/r${revision}-${randomUUID()}-${name}`;
      await uploadFile(key, stored, contentType);
      // Only the run that holds the task may add files: a run that outlived a retry leaves none behind.
      const [kept] = await sql`INSERT INTO office_files (tenant_id, task_id, revision, file_name, content_type, size_bytes, storage_key)
        SELECT ${tenantId}, ${taskId}, ${revision}, ${name}, ${contentType}, ${stored.length}, ${key}
        WHERE EXISTS (SELECT 1 FROM office_tasks WHERE tenant_id=${tenantId} AND id=${taskId} AND status='working' AND started_at=${lease})
        RETURNING id`;
      if (!kept) {
        await deleteFile(key).catch(() => undefined);
        throw new Error('Görev başka bir çalıştırmaya geçti.');
      }
      saved.push(name);
      deliveredFiles.push({ name, contentType, bytes });
    };
    if (free) {
      for (const file of free.files) await save(file.name, file.contentType, file.bytes);
    } else if (!WORK[category].code) {
      // Plain text is the deliverable itself.
      await save(textFileName(task.title), 'text/plain; charset=utf-8', Buffer.from(outcome.summary, 'utf8'));
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
    await assertCurrentScope();
    const checked = await reviewDelivery(input, deliveredFiles, { tenantId, userId: task.created_by, feature: 'office_review' }, signal, masker);
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
