# Değerlendirmeler (evals)

Tekrarlanabilir ölçüm: doğruluk, uydurma (metinde olmayan değeri doldurma), süre, token ve maliyet.

```sh
npm run evals -- --task order-extraction --provider anthropic       # ANTHROPIC_API_KEY gerekir
npm run evals -- --task order-extraction --provider anthropic,openai,gemini,glm  # anahtarı olanlar çalışır, tek tablo
npm run evals -- --task order-extraction --provider replay --file x.json  # kayıtlı çıktıyı puanlar (test için)
npm run evals:export -- --kind cutting_plan                          # düzeltmeleri veri setine çevirir (yerel DB)
```

- `datasets/*.jsonl` sentetik vakalardır; gerçek müşteri verisi eklenmez.
- Her sağlayıcı ürünün kendi yolunu (`AIService.analyzeText`: aynı istem, maskeleme ve şema) çalıştırır; yalnız model değişir (`lib/ai/providers.ts`).
- Anahtarlar: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ZAI_API_KEY`. Model ve adres `GEMINI_MODEL`/`GEMINI_BASE_URL`, `ZAI_MODEL`/`ZAI_BASE_URL` ile değişir (varsayılan `gemini-3.8-flash`, `glm-5.3-flash`). Maliyet için `AI_MODEL_PRICES_USD_PER_MTOK`.
- Anahtar yoksa komut çalışmaz ve sonuç üretmez; tahmini rakam yazılmaz.
- Kullanıcının bir öneriyi düzeltmesi `ai_feedback_examples`'a kaydedilir; `evals:export` bunları kişisel alanları çıkarılmış hâlde veri setine yazar.
- Anahtarı olmayan sağlayıcı tabloda "çalıştırılmadı" satırıyla görünür, onun için rakam üretilmez; istenen sağlayıcılardan biri bile çalışmadıysa çıkış kodu 2. Sağlayıcılar yan yana, her sağlayıcının vakaları sırayla çalışır. Hatalı vakanın süresi, token ve maliyeti de sayılır.
- Production sağlayıcısı Anthropic Claude Haiku 5.5'tir: `lib/config/deployment-env.ts` production'da `ANTHROPIC_API_KEY` ister; `AI_PROVIDER` ve `ANTHROPIC_MODEL` boşsa ya da `anthropic` / `claude-haiku-5-5` ise geçer. Değiştirmek bilinçli bir sözleşme değişikliğidir.
- Kapsam: sağlayıcı seçimi şimdilik sipariş metni çıkarımında (`analyzeText`). Sohbet (araç çağrılı), komut ve belge (PDF/görsel) analizi Claude'da kalır.
