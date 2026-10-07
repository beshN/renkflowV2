# Değerlendirmeler (evals)

Tekrarlanabilir ölçüm: doğruluk, uydurma (metinde olmayan değeri doldurma), süre, token ve maliyet.

```sh
npm run evals -- --task order-extraction --provider openai          # OPENAI_API_KEY gerekir
npm run evals -- --task order-extraction --provider openai,gemini,glm  # anahtarı olanlar çalışır, tek tablo
npm run evals -- --task order-extraction --provider replay --file x.json  # kayıtlı çıktıyı puanlar (test için)
npm run evals:export -- --kind cutting_plan                          # düzeltmeleri veri setine çevirir (yerel DB)
```

- `datasets/*.jsonl` sentetik vakalardır; gerçek müşteri verisi eklenmez.
- Her sağlayıcı ürünün kendi yolunu (`AIService.analyzeText`: aynı istem, maskeleme ve şema) çalıştırır; yalnız model değişir (`lib/ai/providers.ts`).
- Anahtarlar: `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ZAI_API_KEY`. Model ve adres `GEMINI_MODEL`/`GEMINI_BASE_URL`, `ZAI_MODEL`/`ZAI_BASE_URL` ile değişir (varsayılan `gemini-3.8-flash`, `glm-5.3-flash`). Maliyet için `AI_MODEL_PRICES_USD_PER_MTOK`.
- Anahtar yoksa komut çalışmaz ve sonuç üretmez; tahmini rakam yazılmaz.
- Kullanıcının bir öneriyi düzeltmesi `ai_feedback_examples`'a kaydedilir; `evals:export` bunları kişisel alanları çıkarılmış hâlde veri setine yazar.
- Anahtarı olmayan sağlayıcı tabloda "çalıştırılmadı" satırıyla görünür, onun için rakam üretilmez; istenen sağlayıcılardan biri bile çalışmadıysa çıkış kodu 2. Sağlayıcılar yan yana, her sağlayıcının vakaları sırayla çalışır. Hatalı vakanın süresi, token ve maliyeti de sayılır.
- Kazanan belli olmadan production sağlayıcısı değişmez: `lib/config/deployment-env.ts` production'da `AI_PROVIDER=openai`, `OPENAI_MODEL=gpt-6-luna` ister. Değiştirmek bilinçli bir sözleşme değişikliğidir.
- Kapsam: sağlayıcı seçimi şimdilik sipariş metni çıkarımında (`analyzeText`). Sohbet (araç çağrılı) ve belge (PDF/görsel) analizi OpenAI'da kalır.
