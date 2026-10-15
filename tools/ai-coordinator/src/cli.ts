#!/usr/bin/env node
import { chmod, copyFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadConfig, findRepoRoot } from './config.ts';
import { doctor } from './doctor.ts';
import { BudgetError } from './guard.ts';
import { BlockedError, Pipeline } from './pipeline.ts';
import { writeReport } from './report.ts';
import { Store } from './store.ts';
import { makeTask, validateNewTask, type NewTask } from './tasks.ts';
import { sleep } from './util.ts';

const HELP = `RenkFlow AI koordinatörü
  doctor [--live]          Ortam/CLI/kimlik doğrulama denetimi (--live: her modele gerçek PONG çağrısı)
  init                     Git hook'larını kur (main'e push engeli)
  add-task <dosya.json>    Doğrulanmış görev ekle
  list                     Görev listesi
  report                   reports/PROGRESS.md üret
  run <ID>                 Tek görevi uçtan uca çalıştır (geliştir→test→denetle)
  tick                     Sıradaki uygun görevi çalıştır
  start [--max N]          doctor + görev döngüsü (STOP dosyası/limit/devre kesici ile durur)
  escalate <ID>            Sonnet kararı (escalated veya ready_for_pr özet kararı)
  prepare-pr <ID> [--push] PR gövdesi üret; --push yalnızca ai/* dalını iter
  unblock <ID>             blocked görevi todo'ya al
  mark-done <ID>           PR birleştirildi, görevi bitir (bağımlılıkları açar)
  reset-breaker            Devre kesiciyi sıfırla
  stop | resume            STOP dosyası koy / kaldır`;

async function main(): Promise<number> {
  const [cmd, ...rest] = process.argv.slice(2);
  const repo = findRepoRoot();
  const cfg = await loadConfig(repo);
  const store = new Store(join(repo, 'ai-workspace'));
  const pipe = new Pipeline(repo, cfg, store);
  const arg = rest.find((a) => !a.startsWith('--'));
  const flag = (f: string) => rest.includes(f);

  switch (cmd) {
    case 'doctor': {
      const d = await doctor(repo, cfg, flag('--live'));
      console.log(d.git.join('\n'));
      let missing = 0;
      for (const r of d.rows) {
        const ok = r.installed && r.auth === 'ok' && (r.live === 'ok' || r.live === 'skipped');
        if (!ok) missing += 1;
        console.log(`\n${ok ? '✅' : '❌'} ${r.label} (${r.model}) — cli=${r.cli}`);
        console.log(`   kurulu: ${r.installed ? r.version : 'HAYIR'} | kimlik: ${r.auth} (${r.authNote}) | model: ${r.modelId}`);
        if (r.live !== 'skipped') console.log(`   canlı test: ${r.live} ${r.liveNote}`);
      }
      return missing ? 2 : 0;
    }
    case 'init': {
      const src = join(repo, 'tools', 'ai-coordinator', 'hooks', 'pre-push');
      const dst = join(repo, '.git', 'hooks', 'pre-push');
      await mkdir(join(repo, '.git', 'hooks'), { recursive: true });
      await copyFile(src, dst);
      await chmod(dst, 0o755);
      console.log('pre-push hook kuruldu:', dst);
      return 0;
    }
    case 'add-task': {
      if (!arg) throw new Error('add-task <dosya.json>');
      const raw = JSON.parse(await readFile(arg, 'utf8')) as NewTask | NewTask[];
      for (const n of Array.isArray(raw) ? raw : [raw]) {
        await store.update((board) => {
          const errs = validateNewTask(n, cfg, board.tasks);
          if (errs.length) throw new Error(`${n.id}: ${errs.join('; ')}`);
          board.tasks.push(makeTask(n));
        });
        console.log('eklendi:', n.id);
      }
      return 0;
    }
    case 'list': {
      for (const t of (await store.readBoard()).tasks) console.log(`${t.id}\t${t.priority}\t${t.status}\t${t.owner}→${t.reviewer}\t${t.title}`);
      return 0;
    }
    case 'report': console.log(await writeReport(store, cfg)); return 0;
    case 'run': {
      if (!arg) throw new Error('run <ID>');
      const t = await pipe.runTask(arg);
      console.log(`${t.id}: ${t.status} — ${t.blockedReason ?? t.nextAction}`);
      await writeReport(store, cfg);
      return t.status === 'blocked' ? 3 : 0;
    }
    case 'tick': {
      const t = await pipe.tick();
      console.log(t ? `${t.id}: ${t.status}` : 'çalıştırılabilir görev yok');
      await writeReport(store, cfg);
      return 0;
    }
    case 'start': {
      const max = Number(rest[rest.indexOf('--max') + 1]) || 20;
      const d = await doctor(repo, cfg, false);
      const bad = d.rows.filter((r) => r.model !== 'sonnet' && (!r.installed || r.auth !== 'ok'));
      if (bad.length) console.warn(`⚠️  Eksik modeller: ${bad.map((b) => b.model).join(', ')} — bu modellere atanmış görevler "blocked" olur (sahte başarı üretilmez).`);
      for (let i = 0; i < max; i += 1) {
        try {
          const t = await pipe.tick();
          if (!t) { console.log('Kuyrukta çalıştırılabilir görev kalmadı.'); break; }
          console.log(`${t.id}: ${t.status}`);
          if (t.status === 'blocked') { console.log(`  engel: ${t.blockedReason}`); }
        } catch (e) {
          if (e instanceof BudgetError) { console.log(`Durduruldu: ${e.message}`); break; }
          throw e;
        }
        await sleep(500);
      }
      console.log('Rapor:', await writeReport(store, cfg));
      return 0;
    }
    case 'escalate': {
      if (!arg) throw new Error('escalate <ID>');
      const r = await pipe.decide(arg);
      console.log(`Sonnet: ${r.decision} — ${r.reason}`);
      await writeReport(store, cfg);
      return 0;
    }
    case 'prepare-pr': {
      if (!arg) throw new Error('prepare-pr <ID>');
      console.log(await pipe.preparePr(arg, flag('--push')));
      return 0;
    }
    case 'unblock': await store.patchTask(arg!, { status: 'todo', blockedReason: null, nextAction: 'Yeniden kuyrukta.' }); return 0;
    case 'mark-done': await store.patchTask(arg!, { status: 'done', nextAction: 'Tamamlandı.' }); return 0;
    case 'reset-breaker': await store.update((_b, u) => { u.consecutiveFailures = 0; }); return 0;
    case 'stop': await import('node:fs/promises').then((fs) => fs.writeFile(store.stopFile, 'stop\n')); console.log('STOP konuldu.'); return 0;
    case 'resume': await import('node:fs/promises').then((fs) => fs.rm(store.stopFile, { force: true })); console.log('STOP kaldırıldı.'); return 0;
    default: console.log(HELP); return cmd ? 1 : 0;
  }
}

main().then((code) => process.exit(code), (err) => {
  console.error(err instanceof BlockedError || err instanceof BudgetError ? `⛔ ${err.message}` : err);
  process.exit(1);
});

