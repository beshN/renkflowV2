# Supabase kurulum notları

1. Supabase CLI ile projeyi bağlayın: `supabase link --project-ref upxfnbmoicepzmkkzzbl`.
2. Yeni bir ortamda migrasyonları sırayla `supabase db push` ile uygulayın.
3. `supabase/tests/rls_matrix_integration.sql` testini transaction içinde çalıştırın; test kendi verisini geri alır.
4. Security Advisor ve Performance Advisor sonuçlarını kontrol edin.
5. Auth URL'lerini ve Resend SMTP bilgilerini Supabase Dashboard üzerinden ekleyin.
6. Tarayıcıya yalnızca publishable key verin. Secret/service key sadece Vercel sunucu ortamında kalır.

PDF bucket'ı, RLS politikaları, tenant bütünlüğü ve gerekli indeksler sürümlü migrasyonlarda tutulur.
