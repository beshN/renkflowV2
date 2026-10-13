# Yapay zekâ denetimi (7 Ekim 2026)

Kod okunarak çıkarıldı; production'da çalıştırılmadı. Model anahtarı bu ortamda yok, model çağrısı yapan yollar yalnız birim/entegrasyon testleriyle doğrulandı.

## Durum

| Bileşen | Durum | Kanıt | Not |
|---|---|---|---|
| `lib/ai/service.ts` (`assist`, `analyzeText`, `analyzeDocument`) | çalışıyor | `service.ts` | Anthropic Claude (Messages API, yapılandırılmış çıktı), model `ANTHROPIC_MODEL` ya da `claude-haiku-5-5`; talimatlar `lib/ai/prompts.ts`'de. Hata olunca yanıt uydurmuyor, hata fırlatıyor. **Bu PR ile:** metin istemlerinde kişisel veri maskeleniyor, her istek `ai_usage`'a yazılıyor. |
| `service.ts` `query()` / `queryWithContext()` | ölü | yalnız `scripts/test-ai.ts` | Sabit öneri metni döndürüyor; uygulamada kullanılmıyor. |
| `lib/ai/workspace.ts` (öneri/uyarı listesi, arama) | çalışıyor | `buildInsights`, `searchAssistant` | Model değil, SQL. Rol bazlı kapsam var. |
| `components/features/ai/AIChatbot.tsx` | çalışıyor | `app/(dashboard)/layout.tsx` | Tüm panel sayfalarında. **Bu PR ile:** model anahtarı yoksa sohbet kutusu yerine "kapalı" notu gösteriliyor (önceden açılıp mesajda hata veriyordu). |
| "Asistan önerisi" bandı | çalışıyor | `AIChatbot.tsx`, `workspace.ts` | İçerik gerçek kayıtlardan (SQL); model açıksa kısa özet ekleniyor. |
| `/api/ai/chat` | çalışıyor | `app/api/ai/chat/route.ts` | Aynı köken, rol, hız sınırı (20/dk). |
| `/api/ai/insights`, `/api/ai/actions` | çalışıyor | ilgili route'lar | Model çağırmıyor. `actions` idempotent, sipariş taslağı `intake_drafts`'a. |
| `/api/ai/document-extract` | çalışıyor | route | Rol JWT'den, hız sınırı yok (mevcut hâl korundu; ayrı iş). |
| `v1/production/intake`, gelen e-posta/WhatsApp | çalışıyor | `intake.service.ts`, `inbound.service.ts` | Model hatasında boş taslak + uyarı; değer uydurmuyor. |
| `lib/ai/providers.ts` (sağlayıcı katmanı) | çalışıyor (yalnız sipariş metni çıkarımı) | `providers.ts`, `service.ts` `analyzeText`, `__tests__/lib/ai-providers.test.ts` | `AI_PROVIDER` = anthropic (varsayılan) / openai / gemini / glm; anahtar, adres ve model ortamdan. OpenAI, Gemini ve GLM, Chat Completions uçlarıyla; aynı istem, aynı maskeleme, şemaya uymayan yanıt hata (doldurma yok). Production sözleşmesi `anthropic` / `claude-haiku-5-5` ister. Sohbet, komut ve belge analizi Claude'da. Eski `lib/features/ai/ai.service.ts` (gemini/openai/claude, sabit `confidence: 0.85`) hiçbir yerden import edilmediği doğrulanıp silindi. |
| `lib/ai/tools.ts`, `lib/ai/index.ts`, `AIChat.tsx`, `useChat` (iki kopya) | ölü | importer yok | Faz 7 kararına kadar bırakıldı. |
| `assistant_drafts` | tablo yok | `022_assistant_drafts.sql` | Migration yalnız `intake_drafts.source`'a `'assistant'` değerini ekliyor. |
| Öneri türü: **Kesim planı** (`production.cutting_plan`) | çalışıyor | `lib/ai/suggestions/kinds/cutting-plan.ts` | Model çağırmaz: sipariş girişte okunur, kesimler reçeteden, hesap kesim motorundan. Kesim bekleyen işler birlikte planlanır; stok yetmiyorsa öneri yapılmaz (satın alma ihtiyacı planda görünür). Onay planı kaydeder ve çubukları ayırır; o arada stok değiştiyse onay reddedilir, öneri bekler. Tahmini değerlerle yapılmışsa "Emin değilim" notu taşır. Reddedilen durum tekrar önerilmez; durum (havuz, stok, boy, değer, yerleşim) değişince eski öneri süresi dolmuş sayılır ve onay, planın parmak izi farklıysa reddedilir. Müşteri adı ve fiyat içermez. |
| Pazarlama sitesi | AI iddiası yok | `components/site`, `marketing-content.ts` | Yalnız "panel içindeki asistan" geçiyor. |

## Kişisel veri (KVKK)

- **Maskelenen:** sohbet asistanına (`assist`) giden mesaj, geçmiş, çalışma alanı verisi ve arama sonuçları; gelen e-posta/WhatsApp metni (`analyzeText`). E-posta, telefon, TC kimlik, IBAN; veride adı geçen kişi/firma/adres alanları ve firmanın kayıtlı müşteri, tedarikçi ve kullanıcı adları (sohbet geçmişinde serbest metin olarak geçse bile) `[KİŞİ_1]` gibi yer tutuculara çevriliyor; isimler kelime sınırıyla eşleşir, ürün/profil adı gibi genel `name` alanları maskelenmez, model yanıtı sunucuda geri çevriliyor. Kanıt: `__tests__/lib/ai-privacy.test.ts`, `__tests__/lib/ai-service-privacy.test.ts`.
- **Sınır:** firmada kayıtlı olmayan ve yalnız serbest metinde geçen bir isim tanınamaz; e-posta/telefon tanınır. **Belge (PDF/görsel) analizi** dosyanın kendisini modele gönderir, maskelenemez. Bu yurt dışına veri aktarımıdır; açık rıza/aktarım kararı sizin.

## Maliyet ve güvenlik

- Her model isteği `ai_usage`'a: özellik, model, girdi/çıktı token, süre, sonuç (ok/error). Maliyet yalnız `AI_MODEL_PRICES_USD_PER_MTOK` tanımlıysa hesaplanır; fiyat uydurulmaz.
- Mevcut hız sınırı (`assistant` 20/dk) korundu.
- Öneriler emin değilse bunu yazmak zorunda (`uncertain` + gerekçe); emin olmadan gerekçesiz öneri kaydedilemez.
