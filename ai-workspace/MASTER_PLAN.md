# Ana Plan

## Faz 0 — Koordinasyon altyapısı (bu PR)
- [x] `ai-workspace/` ortak çalışma alanı, `TASK_BOARD.json`
- [x] `tools/ai-coordinator` (kuyruk, worktree, CLI çalıştırma, test, denetim, rapor)
- [x] Güvenlik: kapsam kilidi, sır taraması, bütçe/devre kesici, korumalı dal
- [ ] **Gemini ve Codex CLI kurulumu + kimlik doğrulama (kullanıcı)** → `npm run ai:doctor -- --live`
- [ ] Pilot görev PILOT-001'in gerçek Argon→Sol devri

## Faz 1 — Sonraki (planlanacak, Sonnet)
- Gerçek üretim özellikleri için görevler: UX iyileştirme, fabrika simülasyonu (test DB sonrası), iş kuralı denetimleri.
- Üretim kodu görevleri ancak Faz 0 pilotu gerçek CLI'larla geçtikten sonra eklenir.
