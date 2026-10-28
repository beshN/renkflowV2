/** @jest-environment node */
import {
  closureTicketMessage, csvLine, csvValue, excludedTableReason, exportReadme, fileReferenceSpecs, isSecretColumn,
  normalizeFirmName, planTenantExport, quoteIdent, tenantRowColumns, validateClosureRequest, type CatalogColumn,
} from '@/lib/features/account/export-plan';

const cols = (table: string, ...names: Array<string | [string, string]>): CatalogColumn[] =>
  names.map((n) => (Array.isArray(n) ? { table, column: n[0], dataType: n[1] } : { table, column: n, dataType: 'text' }));

const catalog: CatalogColumn[] = [
  ...cols('tenants', 'id', 'name', 'slug', 'iban', 'created_at'),
  ...cols('users', 'id', 'name', 'email', 'password', 'verification_token', 'password_reset_token', 'password_reset_expires'),
  ...cols('tenant_members', 'id', 'tenant_id', 'user_id', 'role'),
  ...cols('customers', 'id', 'tenant_id', 'full_name', 'email'),
  ...cols('invitations', 'id', 'tenant_id', 'email', 'token', 'expires_at'),
  ...cols('quotation_approval_links', 'id', 'tenant_id', 'quotation_id', 'token_hash', 'expires_at'),
  ...cols('installations', 'id', 'tenant_id', 'signoff_token_hash', 'status'),
  ...cols('station_devices', 'id', 'tenant_id', 'token_hash', 'pairing_hash', 'name'),
  ...cols('ai_usage', 'id', 'tenant_id', 'input_tokens', 'output_tokens', 'cost_usd'),
  ...cols('production_files', 'id', 'tenant_id', 'name', ['body', 'bytea'], 'file_path', ['size_bytes', 'bigint']),
  ...cols('office_files', 'id', 'tenant_id', 'file_name', 'storage_key', ['size_bytes', 'bigint']),
  ...cols('user_sessions', 'id', 'tenant_id', 'user_id'),
  ...cols('mobile_refresh_tokens', 'token_hash', 'tenant_id'),
  ...cols('user_mfa', 'user_id', 'tenant_id', 'secret_sealed', 'recovery_code_hashes'),
  ...cols('sso_providers', 'id', 'tenant_id', 'client_secret'),
  ...cols('onboarding_sessions', 'id', 'tenant_id', 'progress_percent'),
  ...cols('future_api_tokens', 'id', 'tenant_id', 'label'),
  ...cols('rate_limit_buckets', 'bucket_key', 'hits'),
];

describe('planTenantExport', () => {
  const plan = planTenantExport(catalog);
  const names = plan.tables.map((t) => t.table);
  const table = (n: string) => plan.tables.find((t) => t.table === n)!;

  it('exports only tables with a tenant_id column, sorted', () => {
    expect(names).toEqual([...names].sort());
    expect(names).not.toContain('users');
    expect(names).not.toContain('rate_limit_buckets');
    expect(names).toContain('customers');
  });

  it('excludes session, token, MFA and SSO tables, including future ones by name', () => {
    for (const t of ['user_sessions', 'mobile_refresh_tokens', 'user_mfa', 'sso_providers', 'future_api_tokens']) {
      expect(names).not.toContain(t);
      expect(plan.excluded.map((e) => e.table)).toContain(t);
    }
    expect(names).toContain('onboarding_sessions');
  });

  it('gives tenants and tenant_members their own files', () => {
    expect(names).not.toContain('tenant_members');
    expect(names).not.toContain('tenants');
    expect(tenantRowColumns(catalog)).toEqual(['id', 'name', 'slug', 'iban', 'created_at']);
  });

  it('drops secret and binary columns but keeps token counts', () => {
    expect(table('invitations').columns).toEqual(['id', 'tenant_id', 'email', 'expires_at']);
    expect(table('invitations').droppedColumns).toEqual(['token']);
    expect(table('quotation_approval_links').columns).not.toContain('token_hash');
    expect(table('installations').columns).not.toContain('signoff_token_hash');
    expect(table('station_devices').columns).toEqual(['id', 'tenant_id', 'name']);
    expect(table('ai_usage').columns).toEqual(['id', 'tenant_id', 'input_tokens', 'output_tokens', 'cost_usd']);
    expect(table('production_files').droppedColumns).toEqual(['body']);
  });

  it('recognises secret column names', () => {
    for (const c of ['password', 'password_reset_token', 'verification_token', 'token', 'token_hash', 'provider_token', 'client_secret', 'secret_sealed', 'replay_cipher', 'recovery_code_hashes', 'api_key', 'totp_secret']) expect(isSecretColumn(c)).toBe(true);
    for (const c of ['input_tokens', 'output_tokens', 'token_url', 'request_hash', 'email', 'name']) expect(isSecretColumn(c)).toBe(false);
    expect(excludedTableReason('customers')).toBeNull();
  });

  it('refuses an odd table name instead of quoting it into SQL', () => {
    const odd = planTenantExport(cols('Weird"Name', 'tenant_id'));
    expect(odd.tables).toEqual([]);
    expect(odd.excluded[0].table).toBe('Weird"Name');
    expect(quoteIdent('a"b')).toBe('"a""b"');
  });

  it('lists file references with their name and size columns', () => {
    expect(fileReferenceSpecs(plan)).toEqual([
      { table: 'office_files', refColumn: 'storage_key', nameColumn: 'file_name', sizeColumn: 'size_bytes' },
      { table: 'production_files', refColumn: 'file_path', nameColumn: 'name', sizeColumn: 'size_bytes' },
    ]);
  });

  it('writes a README naming what is in and out', () => {
    const text = exportReadme({ tenantName: 'Örnek', generatedAt: new Date('2026-10-26T10:00:00Z'), plan, rowCounts: { customers: 3 }, fileCount: 2 });
    expect(text).toContain('customers.csv (3 satır)');
    expect(text).toContain('invitations.csv (0 satır); çıkarılan sütunlar: token');
    expect(text).toContain('user_mfa:');
    expect(text).toContain('2 dosyanın adı');
    expect(text).toContain('2026-10-26T10:00:00.000Z');
    // The two copies: spreadsheet-safe at the root / tables/, byte-exact under raw/.
    expect(text).toContain('raw/');
    expect(text).toContain('tek tırnak');
    expect(excludedTableReason('ai_call_reservations')).toBeTruthy();
  });
});

describe('csv', () => {
  it('quotes per RFC 4180 and serialises dates and JSON', () => {
    expect(csvValue(null)).toBe('');
    expect(csvValue('a,b')).toBe('"a,b"');
    expect(csvValue('say "hi"')).toBe('"say ""hi"""');
    expect(csvValue('line\nbreak')).toBe('"line\nbreak"');
    expect(csvValue(new Date('2026-01-02T03:04:05Z'))).toBe('2026-01-02T03:04:05.000Z');
    expect(csvValue({ a: 1 })).toBe('"{""a"":1}"');
    expect(csvValue(['x'])).toBe('"[""x""]"');
    expect(csvValue(Buffer.from('bin'))).toBe('');
    expect(csvLine([1, true, 'x'])).toBe('1,true,x\r\n');
  });
});

describe('validateClosureRequest', () => {
  it('needs the firm name, ignoring case and spacing with Turkish rules', () => {
    expect(validateClosureRequest({ confirmName: '  istanbul   ALÜMİNYUM ' }, 'İstanbul Alüminyum')).toEqual({ ok: true, reason: null });
    expect(normalizeFirmName('IŞIK')).toBe('ışık');
  });

  it('rejects a missing, wrong or oversized name and a bad reason', () => {
    expect(validateClosureRequest({}, 'Acme')).toMatchObject({ ok: false });
    expect(validateClosureRequest({ confirmName: '   ' }, 'Acme')).toMatchObject({ ok: false });
    expect(validateClosureRequest({ confirmName: 'Acme Ltd' }, 'Acme')).toEqual({ ok: false, error: 'Yazdığınız ad firma adıyla eşleşmiyor' });
    expect(validateClosureRequest({ confirmName: 'x'.repeat(301) }, 'x'.repeat(301))).toMatchObject({ ok: false });
    expect(validateClosureRequest({ confirmName: '' }, '')).toMatchObject({ ok: false });
    expect(validateClosureRequest({ confirmName: 'Acme', reason: 5 }, 'Acme')).toMatchObject({ ok: false });
  });

  it('keeps a trimmed, bounded reason', () => {
    const r = validateClosureRequest({ confirmName: 'Acme', reason: `  ${'a'.repeat(2500)} ` }, 'Acme');
    expect(r.ok && r.reason?.length).toBe(2000);
  });

  it('builds a ticket message with the export reminder and the terms periods', () => {
    const text = closureTicketMessage({ firmName: 'Acme', tenantId: 't1', requestedBy: 'o@acme.test', reason: null, requestedAt: new Date('2026-10-26T00:00:00Z') });
    expect(text).toContain('Tüm verileri indir (ZIP)');
    expect(text).toContain('30 gün');
    expect(text).toContain('Hiçbir veri otomatik silinmedi');
  });
});
