import { z } from 'zod';

// Zod Türkçe yerelleştirme yapılandırması (yalnız yan etki için import edilir).
// z.config() modül düzeyindeki zod örneğini değiştirir; Next'in ayrı bundle
// katmanları kendi zod örneğini yükleyebildiği için bu modül hem
// instrumentation'dan hem de sunucu kodunun ortak girişi lib/db'den yüklenir.
z.config(z.locales.tr());
