import 'server-only';

// The seam between RenkFlow and a GİB special integrator (özel entegratör). The integrator is not
// chosen yet; when it is, it gets one adapter implementing EInvoiceProvider and a name in
// E_INVOICE_PROVIDER. Without that variable the feature is off and invoices behave as before.

export type ProviderDocument = {
  ettn: string;
  number: string;
  documentType: 'e_fatura' | 'e_arsiv';
  /** Recipient mailbox label for e-Fatura (from the registered-user query). */
  recipientAlias?: string | null;
  xml: string;
};

export type ProviderStatus = { status: 'sent' | 'accepted' | 'rejected' | 'error'; message?: string };

export interface EInvoiceProvider {
  readonly name: string;
  /** Is this VKN/TCKN a registered e-Fatura user (then e-Fatura, otherwise e-Arşiv)? */
  isRegisteredRecipient(taxNumber: string): Promise<{ registered: boolean; alias?: string | null }>;
  /** Hands the document over; resolves once the provider has accepted it for delivery. */
  send(document: ProviderDocument): Promise<{ providerId: string }>;
  status(providerId: string): Promise<ProviderStatus>;
  /** e-Arşiv only: e-Fatura has no cancel, it is answered with a return invoice. */
  cancelArchive(providerId: string, reason: string): Promise<void>;
}

/**
 * Local and test stand-in. It never contacts GİB and refuses to run in production, where it would
 * mark invoices as accepted that nobody received.
 *   - recipients listed in E_INVOICE_MOCK_REGISTERED (comma-separated tax numbers) are e-Fatura users;
 *   - a document whose buyer name contains "RET-TEST" is rejected, "HATA-TEST" fails to send.
 */
export class MockProvider implements EInvoiceProvider {
  readonly name = 'mock';

  async isRegisteredRecipient(taxNumber: string) {
    const registered = (process.env.E_INVOICE_MOCK_REGISTERED || '').split(',').map((v) => v.trim()).includes(taxNumber);
    return { registered, alias: registered ? `urn:mail:defaultpk@${taxNumber}.test` : null };
  }

  async send(document: ProviderDocument) {
    if (document.xml.includes('HATA-TEST')) throw new Error('Sahte sağlayıcı: gönderim hatası (HATA-TEST)');
    return { providerId: `mock:${document.documentType}:${document.ettn}:${document.xml.includes('RET-TEST') ? 'reject' : 'accept'}` };
  }

  async status(providerId: string): Promise<ProviderStatus> {
    return providerId.endsWith(':reject')
      ? { status: 'rejected', message: 'Alıcı faturayı reddetti (sahte sağlayıcı)' }
      : { status: 'accepted' };
  }

  async cancelArchive(providerId: string) {
    if (!providerId.startsWith('mock:e_arsiv:')) throw new Error('Yalnız e-Arşiv iptal edilebilir');
  }
}

const isProduction = () => process.env.VERCEL_ENV === 'production' || (process.env.NODE_ENV === 'production' && !process.env.VERCEL_ENV && process.env.E_INVOICE_ALLOW_MOCK !== '1');

/** The configured provider, or null when e-Belge is off. */
export function eInvoiceProvider(): EInvoiceProvider | null {
  const name = (process.env.E_INVOICE_PROVIDER || '').trim();
  if (!name) return null;
  if (name === 'mock') {
    if (isProduction()) throw new Error('E_INVOICE_PROVIDER=mock production ortamında kullanılamaz');
    return new MockProvider();
  }
  throw new Error(`Tanınmayan e-Belge sağlayıcısı: ${name}`);
}
