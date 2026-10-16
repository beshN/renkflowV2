// Also loaded by Next.js proxy (not a React server module).
import { sql } from '@/lib/db';
import { parseCompanyHost } from './host';
export class CompanyHostError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function companyForHost(
  host: string | null,
): Promise<{ id: string; name: string; address: string } | null> {
  const parsed = parseCompanyHost(
    host,
    process.env.NODE_ENV !== 'production' ||
      process.env.ALLOW_INSECURE_HTTP === '1',
  );
  if (parsed.kind === 'invalid')
    throw new CompanyHostError('Bu şirket adresi kullanılamıyor.', 404);
  if (parsed.kind === 'shared') return null;
  const [company] =
    await sql`SELECT t.id,t.name,d.address FROM company_addresses d JOIN tenants t ON t.id=d.tenant_id WHERE d.address=${parsed.address}`;
  if (!company) throw new CompanyHostError('Bu şirket adresi bulunamadı.', 404);
  return company;
}
/** Scripts may have no request, but a real request never skips an unknown or mismatched host. */
export async function currentCompany() {
  let requestHeaders: Headers;
  try {
    const { headers } = await import('next/headers');
    requestHeaders = await headers();
  } catch (e) {
    if (
      e instanceof Error &&
      /outside a request scope|was called outside a request|Invalid state: Headers/i.test(
        e.message,
      )
    )
      return null;
    throw e;
  }
  return companyForHost(requestHeaders.get('host'));
}
export async function assertCompanyHostTenant(
  tenantId: string,
  host: string | null,
) {
  const company = await companyForHost(host);
  if (company && company.id !== tenantId)
    throw new CompanyHostError('Bu şirket için oturum açın.', 403);
}
