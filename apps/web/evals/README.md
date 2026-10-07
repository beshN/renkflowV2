# Değerlendirmeler (evals)

Tekrarlanabilir ölçüm: doğruluk, uydurma (metinde olmayan değeri doldurma), süre, token ve maliyet.

```sh
npm run evals -- --task order-extraction --provider openai          # OPENAI_API_KEY gerekir
npm run evals -- --task order-extraction --provider replay --file x.json  # kayıtlı çıktıyı puanlar (test için)
npm run evals:export -- --kind cutting_plan                          # düzeltmeleri veri setine çevirir (yerel DB)
```

- `datasets/*.jsonl` sentetik vakalardır; gerçek müşteri verisi eklenmez.
- `openai` sağlayıcısı ürünün kendi yolunu (`AIService.analyzeText`: aynı istem, maskeleme ve şema) çalıştırır.
- Anahtar yoksa komut çalışmaz ve sonuç üretmez; tahmini rakam yazılmaz.
- Kullanıcının bir öneriyi düzeltmesi `ai_feedback_examples`'a kaydedilir; `evals:export` bunları kişisel alanları çıkarılmış hâlde veri setine yazar.
- Sağlayıcı karşılaştırması (Gemini, GLM) sağlayıcı katmanı gelince eklenir; o zamana kadar listede yalnız `openai` ve `replay` var.
