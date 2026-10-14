// UBL-TR 1.2 invoice XML (e-Fatura and e-Arşiv). A pure function of the invoice: no database, no
// network. The provider adapter signs the document (UBLExtensions) and may add provider-specific
// elements; everything GİB derives totals and taxes from is produced here.

import { exemptionCode, withholdingCode } from './codes';

export type UblParty = {
  name: string;
  /** VKN (10 digits) for companies, TCKN (11 digits) for persons. */
  taxNumber: string | null;
  taxOffice?: string | null;
  addressLine?: string | null;
  district?: string | null;
  city?: string | null;
  postalCode?: string | null;
  phone?: string | null;
  email?: string | null;
  mersisNo?: string | null;
  tradeRegistryNo?: string | null;
};

export type UblLine = {
  description: string;
  quantity: number;
  unitCode: string;
  unitPrice: number;
  net: number;
  vatPercent: number;
  vat: number;
  withholdingCode?: string | null;
  withholdingPercent?: number;
  withholding?: number;
  exemptionCode?: string | null;
  exemptionReason?: string | null;
};

export type UblInvoice = {
  number: string;
  ettn: string;
  issueDate: string;
  issueTime: string;
  documentType: 'e_fatura' | 'e_arsiv';
  profile: 'TEMELFATURA' | 'TICARIFATURA' | 'EARSIVFATURA';
  typeCode: 'SATIS' | 'TEVKIFAT' | 'ISTISNA' | 'IADE';
  currency: string;
  exchangeRate?: number | null;
  notes?: string[];
  iban?: string | null;
  dueDate?: string | null;
  seller: UblParty;
  buyer: UblParty;
  lines: UblLine[];
  totals: { subtotal: number; vatTotal: number; total: number; withholdingTotal: number; payable: number };
};

/** e-Arşiv invoices to a consumer without an ID number use GİB's placeholder TCKN. */
export const UNKNOWN_CONSUMER_TCKN = '11111111111';

const NS = [
  'xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"',
  'xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"',
  'xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"',
  'xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"',
].join(' ');

export function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

const amount = (n: number) => n.toFixed(2);
const quantity = (n: number) => String(Number(n.toFixed(3)));
const price = (n: number) => String(Number(n.toFixed(4)));

function el(name: string, value: string | number | null | undefined, attrs = ''): string {
  if (value === null || value === undefined || value === '') return '';
  return `<${name}${attrs ? ` ${attrs}` : ''}>${escapeXml(String(value))}</${name}>`;
}

function money(name: string, value: number, currency: string): string {
  return el(name, amount(value), `currencyID="${escapeXml(currency)}"`);
}

/** TCKN checksum (the published algorithm); VKN is checked for shape only. */
export function isValidTckn(value: string): boolean {
  if (!/^[1-9]\d{10}$/.test(value)) return false;
  const d = value.split('').map(Number);
  const tenth = ((d[0] + d[2] + d[4] + d[6] + d[8]) * 7 - (d[1] + d[3] + d[5] + d[7])) % 10;
  const eleventh = d.slice(0, 10).reduce((s, x) => s + x, 0) % 10;
  return ((tenth + 10) % 10) === d[9] && eleventh === d[10];
}

export const isPersonId = (taxNumber: string | null | undefined) => !!taxNumber && /^\d{11}$/.test(taxNumber);

function splitPersonName(name: string): { first: string; family: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], family: parts[0] };
  return { first: parts.slice(0, -1).join(' '), family: parts[parts.length - 1] };
}

function address(p: UblParty): string {
  return '<cac:PostalAddress>'
    + el('cbc:StreetName', p.addressLine)
    + el('cbc:CitySubdivisionName', p.district)
    + el('cbc:CityName', p.city)
    + el('cbc:PostalZone', p.postalCode)
    + '<cac:Country><cbc:Name>Türkiye</cbc:Name></cac:Country>'
    + '</cac:PostalAddress>';
}

function party(p: UblParty, role: 'seller' | 'buyer'): string {
  const id = p.taxNumber || (role === 'buyer' ? UNKNOWN_CONSUMER_TCKN : '');
  const person = isPersonId(id);
  const ids = [
    el('cbc:ID', id, `schemeID="${person ? 'TCKN' : 'VKN'}"`),
  ];
  if (p.mersisNo) ids.push(el('cbc:ID', p.mersisNo, 'schemeID="MERSISNO"'));
  if (p.tradeRegistryNo) ids.push(el('cbc:ID', p.tradeRegistryNo, 'schemeID="TICARETSICILNO"'));
  // A party is either a company (name) or a person (first and family name), never both.
  const nameBlock = person
    ? (() => { const n = splitPersonName(p.name); return `<cac:Person>${el('cbc:FirstName', n.first)}${el('cbc:FamilyName', n.family)}</cac:Person>`; })()
    : `<cac:PartyName>${el('cbc:Name', p.name)}</cac:PartyName>`;
  const contact = p.phone || p.email ? `<cac:Contact>${el('cbc:Telephone', p.phone)}${el('cbc:ElectronicMail', p.email)}</cac:Contact>` : '';
  return '<cac:Party>'
    + ids.map((x) => `<cac:PartyIdentification>${x}</cac:PartyIdentification>`).join('')
    + (person ? '' : nameBlock)
    + address(p)
    + (p.taxOffice ? `<cac:PartyTaxScheme><cac:TaxScheme>${el('cbc:Name', p.taxOffice)}</cac:TaxScheme></cac:PartyTaxScheme>` : '')
    + contact
    + (person ? nameBlock : '')
    + '</cac:Party>';
}

type VatGroup = { percent: number; exemption: string | null; reason: string | null; taxable: number; tax: number };

function vatGroups(lines: UblLine[]): VatGroup[] {
  const groups = new Map<string, VatGroup>();
  for (const l of lines) {
    const key = `${l.vatPercent}|${l.exemptionCode ?? ''}`;
    const g = groups.get(key) ?? { percent: l.vatPercent, exemption: l.exemptionCode ?? null, reason: l.exemptionReason ?? null, taxable: 0, tax: 0 };
    g.taxable += l.net;
    g.tax += l.vat;
    groups.set(key, g);
  }
  return [...groups.values()].map((g) => ({ ...g, taxable: Number(g.taxable.toFixed(2)), tax: Number(g.tax.toFixed(2)) }));
}

function vatSubtotal(g: VatGroup, currency: string, sequence: number): string {
  const exemptionName = g.exemption ? exemptionCode(g.exemption)?.name ?? g.reason : null;
  return '<cac:TaxSubtotal>'
    + money('cbc:TaxableAmount', g.taxable, currency)
    + money('cbc:TaxAmount', g.tax, currency)
    + el('cbc:CalculationSequenceNumeric', sequence)
    + el('cbc:Percent', g.percent)
    + '<cac:TaxCategory>'
    + el('cbc:TaxExemptionReasonCode', g.exemption)
    + el('cbc:TaxExemptionReason', g.exemption ? (g.reason || exemptionName) : null)
    + '<cac:TaxScheme><cbc:Name>KDV</cbc:Name><cbc:TaxTypeCode>0015</cbc:TaxTypeCode></cac:TaxScheme>'
    + '</cac:TaxCategory>'
    + '</cac:TaxSubtotal>';
}

function withholdingBlock(lines: UblLine[], currency: string): string {
  const groups = new Map<string, { percent: number; taxable: number; tax: number }>();
  for (const l of lines) {
    if (!l.withholdingCode || !l.withholding) continue;
    const g = groups.get(l.withholdingCode) ?? { percent: l.withholdingPercent ?? 0, taxable: 0, tax: 0 };
    g.taxable += l.vat;
    g.tax += l.withholding;
    groups.set(l.withholdingCode, g);
  }
  if (!groups.size) return '';
  const total = [...groups.values()].reduce((s, g) => s + g.tax, 0);
  return '<cac:WithholdingTaxTotal>'
    + money('cbc:TaxAmount', total, currency)
    + [...groups.entries()].map(([code, g]) => '<cac:TaxSubtotal>'
      + money('cbc:TaxableAmount', g.taxable, currency)
      + money('cbc:TaxAmount', g.tax, currency)
      + el('cbc:Percent', g.percent)
      + `<cac:TaxCategory><cac:TaxScheme>${el('cbc:Name', withholdingCode(code)?.name ?? code)}${el('cbc:TaxTypeCode', code)}</cac:TaxScheme></cac:TaxCategory>`
      + '</cac:TaxSubtotal>').join('')
    + '</cac:WithholdingTaxTotal>';
}

function invoiceLine(l: UblLine, index: number, currency: string): string {
  const lineWithholding = l.withholdingCode && l.withholding
    ? withholdingBlock([l], currency)
    : '';
  return '<cac:InvoiceLine>'
    + el('cbc:ID', index + 1)
    + el('cbc:InvoicedQuantity', quantity(l.quantity), `unitCode="${escapeXml(l.unitCode)}"`)
    + money('cbc:LineExtensionAmount', l.net, currency)
    + '<cac:TaxTotal>' + money('cbc:TaxAmount', l.vat, currency) + vatSubtotal({ percent: l.vatPercent, exemption: l.exemptionCode ?? null, reason: l.exemptionReason ?? null, taxable: l.net, tax: l.vat }, currency, 1) + '</cac:TaxTotal>'
    + lineWithholding
    + `<cac:Item>${el('cbc:Name', l.description)}</cac:Item>`
    + `<cac:Price>${el('cbc:PriceAmount', price(l.unitPrice), `currencyID="${escapeXml(currency)}"`)}</cac:Price>`
    + '</cac:InvoiceLine>';
}

export function buildUblInvoice(inv: UblInvoice): string {
  const c = inv.currency;
  const groups = vatGroups(inv.lines);
  const exchange = c !== 'TRY' && inv.exchangeRate
    ? `<cac:PricingExchangeRate>${el('cbc:SourceCurrencyCode', c)}${el('cbc:TargetCurrencyCode', 'TRY')}${el('cbc:CalculationRate', inv.exchangeRate)}</cac:PricingExchangeRate>`
    : '';
  // e-Arşiv documents state how they reach the buyer; integrators may override this reference.
  const sendingType = inv.documentType === 'e_arsiv'
    ? `<cac:AdditionalDocumentReference>${el('cbc:ID', 'ELEKTRONIK')}${el('cbc:IssueDate', inv.issueDate)}${el('cbc:DocumentTypeCode', 'SendingType')}</cac:AdditionalDocumentReference>`
    : '';
  const payment = inv.iban || inv.dueDate
    ? `<cac:PaymentMeans>${el('cbc:PaymentMeansCode', 1)}${el('cbc:PaymentDueDate', inv.dueDate)}${inv.iban ? `<cac:PayeeFinancialAccount>${el('cbc:ID', inv.iban.replace(/\s/g, ''))}</cac:PayeeFinancialAccount>` : ''}</cac:PaymentMeans>`
    : '';
  return '<?xml version="1.0" encoding="UTF-8"?>'
    + `<Invoice ${NS}>`
    // No UBLExtensions here: an empty ExtensionContent is invalid against the UBL 2.1 schema; the
    // provider adds the block with its XAdES signature when it signs the document.
    + el('cbc:UBLVersionID', '2.1')
    + el('cbc:CustomizationID', 'TR1.2')
    + el('cbc:ProfileID', inv.profile)
    + el('cbc:ID', inv.number)
    + el('cbc:CopyIndicator', 'false')
    + el('cbc:UUID', inv.ettn)
    + el('cbc:IssueDate', inv.issueDate)
    + el('cbc:IssueTime', inv.issueTime)
    + el('cbc:InvoiceTypeCode', inv.typeCode)
    + (inv.notes ?? []).filter(Boolean).map((n) => el('cbc:Note', n)).join('')
    + el('cbc:DocumentCurrencyCode', c)
    + el('cbc:LineCountNumeric', inv.lines.length)
    + sendingType
    + '<cac:Signature>'
    + el('cbc:ID', inv.seller.taxNumber, 'schemeID="VKN_TCKN"')
    + `<cac:SignatoryParty><cac:PartyIdentification>${el('cbc:ID', inv.seller.taxNumber, `schemeID="${isPersonId(inv.seller.taxNumber) ? 'TCKN' : 'VKN'}"`)}</cac:PartyIdentification>${address(inv.seller)}</cac:SignatoryParty>`
    + '<cac:DigitalSignatureAttachment><cac:ExternalReference><cbc:URI>#Signature</cbc:URI></cac:ExternalReference></cac:DigitalSignatureAttachment>'
    + '</cac:Signature>'
    + `<cac:AccountingSupplierParty>${party(inv.seller, 'seller')}</cac:AccountingSupplierParty>`
    + `<cac:AccountingCustomerParty>${party(inv.buyer, 'buyer')}</cac:AccountingCustomerParty>`
    + payment
    + exchange
    + '<cac:TaxTotal>' + money('cbc:TaxAmount', inv.totals.vatTotal, c) + groups.map((g, i) => vatSubtotal(g, c, i + 1)).join('') + '</cac:TaxTotal>'
    + withholdingBlock(inv.lines, c)
    + '<cac:LegalMonetaryTotal>'
    + money('cbc:LineExtensionAmount', inv.totals.subtotal, c)
    + money('cbc:TaxExclusiveAmount', inv.totals.subtotal, c)
    + money('cbc:TaxInclusiveAmount', inv.totals.total, c)
    + money('cbc:AllowanceTotalAmount', 0, c)
    + money('cbc:PayableAmount', inv.totals.payable, c)
    + '</cac:LegalMonetaryTotal>'
    + inv.lines.map((l, i) => invoiceLine(l, i, c)).join('')
    + '</Invoice>';
}

/** Why this invoice cannot be sent as an e-Belge (empty when it can). Messages are for the user. */
export function eBelgeProblems(inv: Pick<UblInvoice, 'documentType' | 'typeCode' | 'seller' | 'buyer' | 'lines' | 'currency' | 'exchangeRate'>): string[] {
  const p: string[] = [];
  const s = inv.seller;
  if (!s.name?.trim()) p.push('Firma unvanı eksik (Ayarlar → Firma)');
  if (!s.taxNumber || !/^(\d{10}|\d{11})$/.test(s.taxNumber)) p.push('Firma VKN/TCKN eksik ya da hatalı');
  else if (isPersonId(s.taxNumber) && !isValidTckn(s.taxNumber)) p.push('Firma TCKN doğrulanamadı');
  if (!s.taxOffice?.trim()) p.push('Firma vergi dairesi eksik');
  if (!s.addressLine?.trim() || !s.district?.trim() || !s.city?.trim()) p.push('Firma adresi (açık adres, ilçe, il) eksik');
  const b = inv.buyer;
  if (inv.documentType === 'e_fatura' && (!b.taxNumber || !/^(\d{10}|\d{11})$/.test(b.taxNumber))) p.push('e-Fatura için müşterinin VKN/TCKN bilgisi gerekli');
  if (b.taxNumber && isPersonId(b.taxNumber) && b.taxNumber !== UNKNOWN_CONSUMER_TCKN && !isValidTckn(b.taxNumber)) p.push('Müşteri TCKN doğrulanamadı');
  if (b.taxNumber && /^\d{10}$/.test(b.taxNumber) && !b.taxOffice?.trim()) p.push('Müşterinin vergi dairesi eksik');
  if (!b.city?.trim()) p.push('Müşterinin il bilgisi eksik');
  if (inv.currency !== 'TRY' && !inv.exchangeRate) p.push('Dövizli fatura için kur gerekli');
  const hasWithholding = inv.lines.some((l) => l.withholdingCode);
  const exemptions = inv.lines.map((l) => l.exemptionCode).filter(Boolean) as string[];
  for (const l of inv.lines) {
    if (l.withholdingCode && !withholdingCode(l.withholdingCode)) p.push(`Tanınmayan tevkifat kodu: ${l.withholdingCode}`);
    if (l.exemptionCode && !exemptionCode(l.exemptionCode)) p.push(`Tanınmayan istisna kodu: ${l.exemptionCode}`);
    if (l.vatPercent === 0 && !l.exemptionCode) p.push(`%0 KDV'li satır için istisna kodu gerekli: ${l.description}`);
  }
  if (hasWithholding && inv.typeCode !== 'TEVKIFAT') p.push('Tevkifatlı satır varken fatura tipi TEVKIFAT olmalı');
  if (!hasWithholding && inv.typeCode === 'TEVKIFAT') p.push('TEVKIFAT tipli faturada tevkifatlı satır yok');
  const needsIstisna = exemptions.some((code) => exemptionCode(code)?.invoiceType === 'ISTISNA');
  if (needsIstisna && !['ISTISNA', 'IADE'].includes(inv.typeCode)) p.push('İstisna kodlu satır varken fatura tipi ISTISNA olmalı');
  return [...new Set(p)];
}
