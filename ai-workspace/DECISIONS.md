# Kararlar

| ID | Tarih | Karar | Gerekçe |
|---|---|---|---|
| D-001 | 2026-10-15 | Koordinatör bağımlılıksız Node/TypeScript (tip-silme), yalnızca `typescript` + `@types/node` dev bağımlılığı | Hafif, kurulumu kolay, monorepo'yu etkilemez |
| D-002 | 2026-10-15 | Rutin devirler deterministik kodla; Sonnet yalnızca `escalate` ile çağrılır | Maliyet ve öngörülebilirlik |
| D-003 | 2026-10-15 | **BEKLİYOR** — Simülasyon test veritabanı (Neon dalı) kullanıcı onayıyla açılacak | Ücretli/hesap işlemi otomatik yapılmaz |
| D-004 | 2026-10-15 | Model kimlikleri (`Gemini 4 Argon`, `GPT-6.1 Sol`) `coordinator.config.json`'da `null` (CLI varsayılanı) bırakıldı | Adlar kurulumda doğrulanamadı; tahmin edilmez |
| D-005 | 2026-10-15 | `main` korunması: yerel pre-push hook + GitHub branch protection (kullanıcı ayarlar) | Yerel hook tek başına yeterli değil |
