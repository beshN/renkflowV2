# RenkFlow — Proje Bağlamı (tüm modeller için)

RenkFlow, Türkiye'de küçük-orta ölçekli bir **tente, pergola ve rüzgâr kırıcı** üreticisi (Renk Alüminyum) için geliştirilen üretim ve işletme yönetim sistemidir.

- Fabrika **alüminyum profil üretmez**; tedarik ettiği profilleri, kumaşları, motorları, camları ve aksesuarları işleyip ürün imal eder.
- Hedef: kapsamlı ama **son derece kolay kullanılan** bir sistem. Kullanıcı arayüzü sade, Türkçe ve saha çalışanının (atölye, montaj) kullanabileceği netlikte olmalı.
- Teknik yığın: `apps/web` (Next.js 16, React 19, TypeScript, PostgreSQL/Drizzle, NextAuth), `apps/native-ios`, `apps/native-android`. Ayrıntı: kök `README.md`, `docs/DEV_HANDOFF.md`, `docs/adr/`.
- Doğrulama komutu: `cd apps/web && npm run validate`.

## Roller

| Model | Rol |
|---|---|
| Claude Sonnet 5.5 | Koordinatör: planlama, öncelik, kritik karar, çözülemeyen anlaşmazlık |
| Gemini 4 Argon | Ana geliştirici: kullanıcı deneyimi, fabrika simülasyonu |
| GPT-6.1 Sol | Mimari, kritik iş kuralları, güvenlik, bağımsız kod denetimi |

> Model adları proje tarafından kullanılan etiketlerdir; CLI'a verilen gerçek model kimlikleri `coordinator.config.json` içinde ayrıca ve doğrulanarak tanımlanır.

## Çalışma düzeni

1. Tek doğruluk kaynağı `TASK_BOARD.json`'dır; elle düzenlenmez, `tools/ai-coordinator` üzerinden güncellenir.
2. Her görevin ayrı git worktree'si ve `ai/<model>/<görev-id>` dalı vardır.
3. Geliştiren model kendi işini denetlemez; denetçi her zaman diğer modeldir.
4. Birleştirme yalnızca PR ve insan onayıyla; canlıya dağıtım kullanıcı onayı gerektirir.
5. Devir notları `handoffs/`, denetim kayıtları `audits/`, UX notları `ux/`, simülasyon planı/sonuçları `simulations/`, ilerleme raporları `reports/` altındadır.
