# Devir kaydı — PILOT-001 (Argon → Sol → Sonnet)

**Durum (2026-10-15): ENGELLİ — gerçek devir doğrulanmadı.**

| Adım | Sonuç |
|---|---|
| Sonnet (claude CLI 2.1.300) | ✅ kurulu, giriş yapılmış, canlı PONG başarılı |
| Argon (gemini CLI) | ❌ kurulu değil, kimlik doğrulama yok |
| Sol (codex CLI) | ❌ kurulu değil, kimlik doğrulama yok |

Eksik bağımlılıklar nedeniyle görev `blocked` bırakıldı; **sahte başarı üretilmedi**.

## Tamamlamak için (kullanıcı)
1. `npm i -g @google/gemini-cli @openai/codex`
2. `gemini` ile Google girişi (veya `GEMINI_API_KEY`), `codex login` (veya `OPENAI_API_KEY`) — hesap/ücretli API kararı sizde.
3. `ai-workspace/coordinator.config.json` içine doğrulanmış model kimliklerini yazın.
4. `npm run ai:doctor -- --live` hepsi ✅ olunca: `npm run ai -- unblock PILOT-001 && npm run ai -- run PILOT-001`
5. `ready_for_pr` olursa: `npm run ai -- escalate PILOT-001` (Sonnet özet kararı) → `prepare-pr`.
