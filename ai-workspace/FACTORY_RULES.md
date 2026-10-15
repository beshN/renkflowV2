# Fabrika ve Güvenlik Kuralları

## Değişmez güvenlik kuralları (ihlal = görev başarısız)
1. Production veritabanına bağlanma; `DATABASE_URL`/`POSTGRES_URL` değerlerini okuma. Simülasyon yalnızca ayrı **test veritabanı** ile (aşağıya bakın).
2. Gerçek müşteri verisiyle simülasyon yapma; yalnızca üretilmiş (sentetik) veri.
3. Gerçek e-posta, fatura veya ödeme **gönderme**. Bu entegrasyonlar test/sahte modda olmalı.
4. Gizli anahtar, token, `.env*` içeriğini dosyalara, raporlara, commit'lere yazma.
5. `main`/`production`/`release` dallarına doğrudan yazma yok; her şey `ai/*` dalı + PR.
6. Canlıya dağıtım (Vercel production, DB migration) yalnızca kullanıcının açık onayıyla.
7. Tehlikeli komutlar (`rm -rf`, `git push --force`, `db:push` üretime, `curl | sh`) otomatik onaylanmaz.

## Alan kuralları (mevcut iş bağlamından)
- Alüminyum profil **satın alınan malzemedir**, üretim çıktısı değildir; stok/maliyet modeli bunu yansıtmalı.
- Üretim adımları: tedarik edilen profil/kumaş/motor/cam/aksesuar → kesim/işleme → montaj → sevkiyat.
- Birimler (metre/kg/adet) birbirine **toplanmaz**; ölçüler mm.
- Yeni iş kuralı gerektiren her değişiklikte kural `DECISIONS.md`'ye gerekçesiyle yazılır; belirsiz kural uydurulmaz, soru olarak işaretlenir.

## Test veritabanı planı (henüz kurulmadı)
- Fabrika simülasyonu için **ayrı** bir Neon dalı/projesi (ör. `renkflow-sim`) kullanılacak; bağlantı dizisi yalnızca `apps/web/.env.simulation.local` (git'e girmez) içinde.
- Simülasyon betikleri başlarken `SIMULATION=1` ve DB host'unun izinli listede olduğunu doğrular; aksi halde çıkar.
- Veri: sentetik firmalar/siparişler; kişisel veri yok (KVKK, bkz. `docs/kvkk.md`).
- **Karar bekliyor:** DB sağlayıcısı/dalı oluşturma kullanıcı onayı gerektirir (`DECISIONS.md` D-003).

## Görev türüne göre kontroller
| Tür | Otomatik kontroller |
|---|---|
| `docs`, `audit`, `simulation` | Yalnızca `ai-workspace/` altına yazma kapsamı + sır taraması + bağımsız denetim |
| `code` | `type-check`, `lint`, `jest` (apps/web) + kapsam + sır taraması + bağımsız denetim |
