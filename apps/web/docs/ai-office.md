# AI ofis: yürütme ve teslim kontrolü

Görevler firma bazında `office_tasks` ve `office_files` tablolarında saklanır (077 migration). Dosyalar özel Blob deposundadır; indirme firma/rol denetiminden geçer.

Çalışan teslim ettikten sonra yönetici gerçek dosya içeriklerini görevle karşılaştırır. Word, Excel ve PowerPoint XML içeriği, PDF metni, düz metin ve desteklenen görseller incelenir. Büyük veya okunamayan içerik, kontrol edilebilmiş gibi onaylanmaz. Puan, gerekçe ve sorunlar teslim kartında gösterilir. Kontrol sonucunun ve en fazla son 10 incelemenin kaydı `decision` alanındadır.

Hata bulunan teslim bir kez otomatik düzeltmeye gider. Aynı çalıştırmadaki bütün model çağrıları ortak 260 saniye sınırını paylaşır. Sorun sürerse, kontrol servisi kullanılamazsa veya dosya tam incelenemezse son karar kullanıcıya bırakılır. Yönetici onayı, kullanıcının son onayının yerine geçmez. Altı dakika boyunca çalıştırılamayan işler yeniden denenebilir; eski çalıştırıcı yeni denemenin sonucunu değiştiremez.

## Model seçimi

Varsayılan `OFFICE_PROVIDER=anthropic`: mevcut Claude Sonnet 5.5 yolu korunur; Word, Excel, PowerPoint ve araştırma araçları bu yoldadır.

OpenCode API hazır olduğunda yalnız sunucu ortamına `OPENCODE_API_KEY` eklenir ve `OFFICE_PROVIDER=opencode` ile yeni preview deploy oluşturulur. Uygulamanın diğer AI özellikleri bu ayardan etkilenmez. Firma KVKK onayı, asistan modu, bütçe ve kişi çağrı sınırı her model çağrısında geçerlidir.

| Rol | OpenCode model kimliği |
| --- | --- |
| Yönetici / görev dağıtımı | `minimax-m3.1-flash-free` |
| Tablolar / veri / finans | `deepseek-v4.1-flash-free` |
| Belgeler / çeviri / sunum / rapor | `mimo-v2.6-flash-free` |
| Yazışma / tasarım / bağımsız belge kontrolü | `glm-5.3-flash-free` |

Kimlikler 21 Ekim 2026 tarihinde `https://opencode.ai/zen/v1/models` kataloğundan doğrulandı. Ücretli modele otomatik geçiş yoktur. Ücretsiz modellerin kapasite ve kullanım şartları sağlayıcıya bağlıdır.

OpenCode bağlantısının ilk sürümü aracıyla gerçek TXT, Markdown, CSV ve statik SVG dosyaları teslim eder; ikili Word/Excel/PowerPoint üretimi veya web araması yaptığını iddia etmez. Bu sınırlama model talimatında ve teslim notunda belirtilir. SVG aktif içerik ve CSV formülleri kabul edilmez. OpenCode görsel incelemesi desteklenmediğinde kullanıcı kontrolü istenir.

API anahtarı henüz hazır olmadığından OpenCode canlı çağrısı doğrulanmamıştır; etkinleştirmeden önce preview üzerinde dört model için teslim, eksik bilgi, yanlış toplam, düzeltme, kota/zaman aşımı ve özel dosya indirme akışları denenmelidir. Anahtarlar loga, repoya veya tarayıcıya yazılmaz.

## Yayın

077 migration mevcut veriyi değiştirmez; yeni görev ve dosya tablolarını ekler. Veritabanı yedeği alınarak migration ve ledger kaydı tamamlanmalı; ardından production readiness ve anonim API erişim reddi kontrol edilmelidir.
