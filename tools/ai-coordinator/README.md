# RenkFlow AI Koordinatörü

Üç modelin (Argon/Gemini, Sol/Codex, Sonnet/Claude) aynı repoda, görev kuyruğu + git worktree + PR üzerinden çalışmasını yöneten hafif, bağımlılıksız (Node ≥ 22.18) koordinatör. Rutin devirler **deterministik koddur**; Sonnet yalnızca `escalate` ile çağrılır.

## Kurulum (bir kerelik)

```bash
npm i -g @google/gemini-cli @openai/codex      # Claude Code zaten kurulu olmalı
gemini                                         # veya GEMINI_API_KEY ayarla  -> Google ile giriş
codex login                                    # veya OPENAI_API_KEY
claude auth login
(cd tools/ai-coordinator && npm install)       # yalnızca typescript + @types/node (type-check için)
npm run ai -- init                             # main'e push'u engelleyen pre-push hook
npm run ai:doctor -- --live                    # her CLI'a gerçek PONG çağrısı
```

> `ai-workspace/coordinator.config.json` içinde `model` alanları `null` (= CLI varsayılanı). "Gemini 4 Argon" / "GPT-6.1 Sol" için CLI'nın kabul ettiği **gerçek model kimliğini** (`gemini -m …`, `codex -m …`) hesabınızda doğrulayıp oraya yazın. Koordinatör model adı tahmin etmez.

## Tek komutla başlatma

```bash
npm run ai:start        # doctor + görev döngüsü; STOP/limit/devre kesicide durur, rapor yazar
```

## Akış (görev başına)

`todo → in_progress → (kapsam + sır taraması) → commit(ai/<model>/<id>) → testler → in_review → ready_for_pr → done`
Başarısız test/denetim → `changes_requested` (geri bildirimle geliştiriciye döner); `maxAttempts` dolunca → `escalated` → `npm run ai -- escalate <ID>` (Sonnet: accept/retry/cancel/split).
`ready_for_pr` → `npm run ai -- prepare-pr <ID> [--push]` → PR'ı siz (veya Sonnet) açar; birleştirdikten sonra `mark-done <ID>`.

## Komutlar
`npm run ai -- <komut>`: `doctor, init, add-task, list, report, run, tick, start, escalate, prepare-pr, unblock, mark-done, reset-breaker, stop, resume` (ayrıntı: `npm run ai`).

Görev ekleme: JSON (bkz. `ai-workspace/tasks/PILOT-001.json`) → `npm run ai -- add-task dosya.json`.

## Git izolasyonu
- Her görev: `.ai-worktrees/<model>/<id>` worktree'si, `ai/<model>/<id>` dalı (gitignore'lu).
- Aynı dosya/dizine aynı anda iki görev **başlamaz** (görev `files` kilidi; dizin = önek).
- Model yalnızca `files` içine yazabilir; dışı geri alınır ve görev iade edilir.
- Koordinatör yalnızca `ai/*` dalına push eder; `main/master/production/release` reddedilir (kod + pre-push hook). **Esas koruma için GitHub'da `main` branch protection açın** (PR + onay zorunlu).
- `TASK_BOARD.json` yazımları kilit + atomik rename ile; çoklu süreç güvenli.

## Güvenlik ve maliyet önlemleri
- En az yetki: `--yolo`/`bypassPermissions` yok. Claude: `acceptEdits` + dar araç listesi, proje `settings.json` yok sayılır (repoda `bypassPermissions` var). Gemini: `auto_edit`/`plan`. Codex: `workspace-write`/`read-only` sandbox, onay `never`.
- Model süreçlerine yalnızca izinli ortam değişkenleri geçer (`envAllowlist`); `DATABASE_URL` vb. geçmez.
- Commit öncesi **sır taraması**; çıktılar/raporlar/olay günlüğü `redact`'ten geçer.
- Limitler (`limits`): çağrı başına zaman aşımı, görev başına deneme, toplam/görev başı çağrı sayısı, toplam ve çağrı başı USD (**yalnızca Claude maliyet raporlar**; Gemini/Codex için çağrı sayısı limiti asıl koruma), ardışık hata devre kesici. `STOP` dosyası (`npm run ai -- stop`) döngüyü güvenle durdurur.
- Altyapı kendini koruma: modeller `tools/ai-coordinator`, `.github`, `.git` değiştiremez; docs/audit/simulation görevleri yalnızca `ai-workspace/` altına yazar.
- Bilinen sınır: bütçe kontrolü çağrı öncesi yapılır; paralel işçilerde 1–2 çağrı aşılabilir.

## Test
```bash
cd tools/ai-coordinator && npm test && npm run type-check
```
Testler **yalnızca test amaçlı sahte** `gemini`/`codex` betikleriyle durum makinesini sınar; gerçek model devrinin kanıtı değildir (bkz. `ai-workspace/handoffs/PILOT-001.md`).
