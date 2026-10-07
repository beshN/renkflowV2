# ADR 0001 — Tek denetim kaydı: `activity_logs`

Durum: önerildi (K5) · Tarih: 7 Ekim 2026

## Bağlam

Denetimde (docs/AUDIT.md, K5) denetim izinin dağınık ve kısmen bozuk olduğu görüldü:

- `/api/audit` var olmayan `audit_logs` tablosunu okuyordu (500). `002_audit_logs.sql` migration kaydında yok, hiçbir ortamda tablo oluşmamış.
- `AuditLogService.log` (toplu finans işlemleri, sipariş QR aksiyonları) aynı olmayan tabloya yazmaya çalışıp hatayı yutuyordu: bu kayıtların hiçbiri saklanmıyordu.
- `lib/audit/logging.ts` ve `lib/security/audit-trail.ts` de `audit_logs`'u hedefliyor ve hiçbir yerden kullanılmıyor.
- `activity_logs` gerçekten var ve sipariş durum geçişleri, sipariş notları ve müşteri değişiklikleri için kullanılıyordu; panelden sipariş oluşturma ise kayda düşmüyordu.
- Stok defteri (`stock_entries`), üretim olayları (`production_events`, `work_order_events`) ve komut tekrar tablosu (`production_commands`) kendi alanlarında değiştirilemez kayıt tutuyor.

## Karar

1. **Firma denetim izi `activity_logs`'tur.** Yeni tablo açılmadı; zaten var, firma kapsamlı, sipariş zaman çizelgesi de buradan okunuyor.
2. Tek yazma noktası `lib/audit/audit-log.ts` → `recordAudit(db, entry)`. Değişiklik bir transaction içinde yapılıyorsa aynı `tx` verilir; kayıt ve değişiklik birlikte commit olur ya da birlikte geri alınır.
3. `AuditLogService.log` bu fonksiyona yönlendirildi (davranışı korunur: iş tamamlandıktan sonra yazılır, hata işlemi geri almaz ama artık kayıt gerçekten yazılır).
4. Kayda düşen işlemler: sipariş oluşturma / güncelleme (alan bazlı fark) / silme, teklif oluşturma / güncelleme / durum / siparişe dönüştürme / silme, müşteri oluşturma / güncelleme / pasife alma, firma ayarları, ekip daveti ve davet iptali, tüm `finance.*` komutları (tahsilat, personel, bordro) ve tahsilat silme, durum geçişleri ve notlar (mevcut).
5. Stok ve üretim hareketleri **kopyalanmaz**: kendi değiştirilemez defterleri yetkili kaynaktır (ters kayıtla düzeltilir). Denetim ekranı gerekirse bu defterleri ayrı sekmede gösterir.
6. `/api/audit` yalnız **sahip ve yönetici**ye açıktır, `activity_logs`'u firma kapsamında filtreleyerek okur.
7. Tekrarlanan (idempotent) komutlar ikinci kayıt üretmez: kayıt, tekrarın erken döndüğü noktanın sonrasında yazılır.

## Sonuçlar

- Artık kullanılmayan `lib/audit/logging.ts`, `lib/security/audit-trail.ts` ve `002_audit_logs.sql` silme PR'ında kaldırılabilir.
- `activity_logs` bugün değiştirilebilir bir tablodur (UPDATE/DELETE engeli yok). Değiştirilemezlik gerekiyorsa sonraki adım: tablo için yalnız INSERT izni olan rol veya `BEFORE UPDATE OR DELETE` tetikleyicisi (ayrı migration, onayla).
- Giriş/çıkış olayları kapsam dışı bırakıldı (hız sınırı tablosu başarısız girişleri zaten sayıyor).
- Kişisel veri: kayıt metadata'sında davet e-postası ve silinen siparişin müşteri adı bulunur; KVKK saklama süresi kararı gerekiyor.
