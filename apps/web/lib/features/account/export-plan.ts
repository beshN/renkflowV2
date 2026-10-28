/**
 * What goes into the full firm export (KVKK m.11 / veri taşınabilirliği) and what stays out.
 * Pure: it works on the column list read from information_schema, so the rules are unit-tested
 * without a database and a table added by a later migration is exported without touching this file.
 */
import { neutralizeFormula } from '@/lib/security/spreadsheet-safe';

export type CatalogColumn = { table: string; column: string; dataType: string };

export type ExportTable = { table: string; columns: string[]; droppedColumns: string[] };
export type ExcludedTable = { table: string; reason: string };
export type ExportPlan = { tables: ExportTable[]; excluded: ExcludedTable[] };

/**
 * Whole tables that never leave the system: sign-in sessions, device and link tokens, SSO
 * credentials, internal queues and upload scratch space. Their rows are either secrets or
 * meaningless outside RenkFlow.
 */
export const EXCLUDED_TABLES: Record<string, string> = {
  user_sessions: 'oturum kayıtları',
  mobile_sessions: 'mobil oturum kayıtları',
  mobile_refresh_tokens: 'oturum anahtarları',
  mobile_push_devices: 'cihaz bildirim anahtarları',
  mobile_upload_chunks: 'yarım kalmış yükleme parçaları',
  sso_providers: 'tek oturum açma (SSO) kimlik bilgileri',
  sso_identities: 'SSO hesap bağlantıları',
  user_mfa: 'iki adımlı doğrulama sırları',
  order_qr_tokens: 'QR erişim anahtarları',
  rate_limit_buckets: 'istek sınırı sayaçları',
  storage_cleanup_queue: 'iç temizlik kuyruğu',
  notification_outbox: 'iç bildirim kuyruğu',
  export_jobs: 'iç dışa aktarma işleri',
  ai_call_reservations: 'süren asistan çağrılarının geçici bütçe kayıtları',
  tenants: 'firma kaydı ayrıca tenant.csv olarak verilir',
  tenant_members: 'üyeler ayrıca members.csv olarak verilir',
};

/** Table name shapes that are excluded even when a later migration adds one. */
const EXCLUDED_TABLE_PATTERN = /(^|_)(sessions?|tokens?|secrets?|credentials?|mfa)$/;
/** Firm data whose name only looks like a session table. */
const NAME_PATTERN_EXCEPTIONS = new Set(['onboarding_sessions']);

/**
 * Column names that hold secrets or the hashes of secrets: passwords, sign-in and link tokens
 * (and their hashes), sealed/encrypted values, recovery codes, API keys, client secrets.
 * `input_tokens`/`output_tokens` (AI usage counts) do not match: the rule needs "token" itself.
 */
const SECRET_COLUMN_PATTERN = /password|secret|sealed|cipher|recovery_code|api_key|private_key|credential|(^|_)token$|(^|_)token_(hash|expires)|(^|_)(pairing|signoff)_hash$|^otp|totp/;

/** Binary bodies (bytea) are not CSV material; their names stay in the export. */
const BINARY_TYPES = new Set(['bytea']);

export function isSecretColumn(column: string): boolean {
  return SECRET_COLUMN_PATTERN.test(column.toLowerCase());
}

export function excludedTableReason(table: string): string | null {
  const t = table.toLowerCase();
  if (EXCLUDED_TABLES[t]) return EXCLUDED_TABLES[t];
  if (EXCLUDED_TABLE_PATTERN.test(t) && !NAME_PATTERN_EXCEPTIONS.has(t)) return 'oturum veya anahtar tablosu';
  return null;
}

/**
 * Every table with a tenant_id column, minus excluded tables, each with its exportable columns
 * (secret and binary columns dropped). Order is stable (by table name, then catalog order).
 */
export function planTenantExport(columns: CatalogColumn[]): ExportPlan {
  const byTable = new Map<string, CatalogColumn[]>();
  for (const c of columns) {
    const list = byTable.get(c.table) ?? [];
    list.push(c);
    byTable.set(c.table, list);
  }
  const tables: ExportTable[] = [];
  const excluded: ExcludedTable[] = [];
  for (const table of [...byTable.keys()].sort()) {
    const cols = byTable.get(table)!;
    if (!cols.some((c) => c.column === 'tenant_id')) continue;
    if (!/^[a-z_][a-z0-9_]*$/.test(table)) { excluded.push({ table, reason: 'beklenmeyen tablo adı' }); continue; }
    const reason = excludedTableReason(table);
    if (reason) { excluded.push({ table, reason }); continue; }
    const keep: string[] = [];
    const dropped: string[] = [];
    for (const c of cols) {
      if (isSecretColumn(c.column) || BINARY_TYPES.has(c.dataType.toLowerCase())) dropped.push(c.column);
      else keep.push(c.column);
    }
    tables.push({ table, columns: keep, droppedColumns: dropped });
  }
  return { tables, excluded };
}

/** The firm row: same column rules as the other tables. */
export function tenantRowColumns(columns: CatalogColumn[]): string[] {
  return columns.filter((c) => c.table === 'tenants' && !isSecretColumn(c.column) && !BINARY_TYPES.has(c.dataType.toLowerCase())).map((c) => c.column);
}

/** Columns that point at a file in Blob storage; listed in files.csv. */
export const FILE_REFERENCE_COLUMNS = ['storage_key', 'file_url', 'file_path', 'final_url'] as const;
const FILE_NAME_COLUMNS = ['file_name', 'name', 'source_name', 'title'];
const FILE_SIZE_COLUMNS = ['size_bytes', 'size', 'file_size'];

export type FileReferenceSpec = { table: string; refColumn: string; nameColumn: string | null; sizeColumn: string | null };

export function fileReferenceSpecs(plan: ExportPlan): FileReferenceSpec[] {
  const specs: FileReferenceSpec[] = [];
  for (const t of plan.tables) {
    for (const ref of FILE_REFERENCE_COLUMNS) {
      if (!t.columns.includes(ref)) continue;
      specs.push({
        table: t.table,
        refColumn: ref,
        nameColumn: FILE_NAME_COLUMNS.find((c) => t.columns.includes(c)) ?? null,
        sizeColumn: FILE_SIZE_COLUMNS.find((c) => t.columns.includes(c)) ?? null,
      });
    }
  }
  return specs;
}

export const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;

const quoteCsv = (text: string) => (/[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') return String(value);
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) return '';
  return JSON.stringify(value);
}

/** RFC 4180 cell: the value as stored, so another system reads it back exactly (raw/ copies). */
export function csvValue(value: unknown): string {
  return quoteCsv(cellText(value));
}

/**
 * RFC 4180 cell for people (the default tables): text a spreadsheet would run as a formula gets a
 * leading apostrophe (S-07). Numbers stay numbers, also when the driver hands them over as text
 * (numeric/bigint columns arrive as "-12.5").
 */
export function csvSafeValue(value: unknown): string {
  const text = cellText(value);
  return quoteCsv(typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean' ? text : neutralizeFormula(text));
}

export const csvLine = (values: unknown[]) => values.map(csvValue).join(',') + '\r\n';
export const csvSafeLine = (values: unknown[]) => values.map(csvSafeValue).join(',') + '\r\n';

/** Where the two copies of every CSV live in the ZIP. */
export const RAW_EXPORT_FOLDER = 'raw/';

export function exportReadme(input: { tenantName: string; generatedAt: Date; plan: ExportPlan; rowCounts: Record<string, number>; fileCount: number }): string {
  const lines = [
    'RenkFlow firma veri dışa aktarımı',
    '==================================',
    '',
    `Firma: ${input.tenantName}`,
    `Oluşturulma: ${input.generatedAt.toISOString()}`,
    '',
    'Bu arşiv, KVKK m.11 kapsamındaki erişim ve veri taşınabilirliği talepleri için firmanızın',
    'RenkFlow\'daki kayıtlarını makine tarafından okunabilir CSV dosyaları olarak içerir.',
    'Dosyalar UTF-8, virgülle ayrılmış, ilk satırı sütun adlarıdır (RFC 4180). JSON alanlar',
    'JSON metni olarak, tarihler ISO 8601 (UTC) olarak yazılmıştır.',
    '',
    'Her CSV iki kopya halindedir:',
    '- Kök klasördeki dosyalar ve tables/ (insanlar ve tablolama programları için): "=", "+", "-",',
    '  "@", sekme veya satır başı ile başlayan METİN hücrelerinin başına tek tırnak (\') eklenmiştir;',
    '  böylece Excel / LibreOffice bu hücreleri formül olarak çalıştırmaz. Gerçek sayılar (ör. -12.5)',
    '  değiştirilmez.',
    '- raw/ (makineler ve başka sistemlere aktarım için): aynı dosyaların bayt bayt özgün hali; hiçbir',
    '  hücre değiştirilmemiştir. Bu dosyaları tablolama programında doğrudan AÇMAYIN; içe aktarma',
    '  sihirbazında sütunları "Metin" olarak seçin.',
    '',
    'İçerik',
    '------',
    'tenant.csv      Firma kaydı',
    'members.csv     Firma üyeleri: ad, e-posta, rol, katılım tarihi (şifre ve doğrulama bilgileri hariç)',
    'files.csv       Yüklenen dosyaların listesi (ad, depolama anahtarı, boyut)',
    'raw/            Yukarıdaki ve aşağıdaki tüm CSV dosyalarının değiştirilmemiş kopyaları (raw/tables/*.csv dahil)',
    'tables/*.csv    Firmanıza ait her tablo:',
    ...input.plan.tables.map((t) => `  - ${t.table}.csv (${input.rowCounts[t.table] ?? 0} satır)${t.droppedColumns.length ? `; çıkarılan sütunlar: ${t.droppedColumns.join(', ')}` : ''}`),
    '',
    'Dahil olmayanlar',
    '----------------',
    `- Blob depolamadaki dosyaların kendileri. ${input.fileCount} dosyanın adı ve anahtarı files.csv içindedir;`,
    '  dosyaların teslimi için destek talebi açabilirsiniz.',
    '- Şifre özetleri, oturum ve bağlantı anahtarları, iki adımlı doğrulama sırları, API ve SSO',
    '  kimlik bilgileri (güvenlik nedeniyle hiçbir zaman dışa aktarılmaz).',
    '- Veritabanında ikili (binary) olarak saklanan dosya içerikleri.',
    ...input.plan.excluded.map((e) => `- ${e.table}: ${e.reason}`),
    '',
    'Not: Başka bir sisteme yüklenecek veriler için raw/ klasörünü kullanın; tables/ altındaki',
    'kopyalarda formül gibi görünen metinlerin başındaki tek tırnak verinin parçası değildir.',
    '',
  ];
  return lines.join('\r\n');
}

/** Closure confirmation: the typed name must match the firm name (case and spacing aside, Turkish rules). */
export function normalizeFirmName(name: string): string {
  return name.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR');
}

export type ClosureInput = { confirmName?: unknown; reason?: unknown };
export type ClosureValidation = { ok: true; reason: string | null } | { ok: false; error: string };

export function validateClosureRequest(input: ClosureInput, firmName: string): ClosureValidation {
  if (typeof input.confirmName !== 'string' || !input.confirmName.trim()) return { ok: false, error: 'Onay için firma adını yazın' };
  if (input.confirmName.length > 300) return { ok: false, error: 'Firma adı çok uzun' };
  if (!firmName.trim() || normalizeFirmName(input.confirmName) !== normalizeFirmName(firmName)) return { ok: false, error: 'Yazdığınız ad firma adıyla eşleşmiyor' };
  if (input.reason !== undefined && input.reason !== null && typeof input.reason !== 'string') return { ok: false, error: 'Geçersiz açıklama' };
  const reason = typeof input.reason === 'string' ? input.reason.trim().slice(0, 2000) : '';
  return { ok: true, reason: reason || null };
}

export const CLOSURE_TICKET_SUBJECT = 'Hesap kapatma talebi';

export function closureTicketMessage(input: { firmName: string; tenantId: string; requestedBy: string; reason: string | null; requestedAt: Date }): string {
  return [
    `${input.firmName} firması hesabının kapatılmasını talep ediyor.`,
    '',
    `Firma kimliği: ${input.tenantId}`,
    `Talep eden: ${input.requestedBy}`,
    `Talep zamanı: ${input.requestedAt.toISOString()}`,
    input.reason ? `Açıklama: ${input.reason}` : 'Açıklama: —',
    '',
    'Hiçbir veri otomatik silinmedi. Kapatmadan önce firma sahibine Ayarlar > Plan ve kullanım',
    'bölümündeki "Tüm verileri indir (ZIP)" ile verilerini indirmesi hatırlatılmalıdır.',
    'Kullanım koşulları m.10: sona ermeden itibaren 30 gün içinde veri teslimi istenebilir;',
    'sonrasında veriler yedekler dahil en geç 90 gün içinde silinir veya anonimleştirilir.',
  ].join('\n');
}
