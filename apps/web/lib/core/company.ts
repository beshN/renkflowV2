/**
 * Single source of truth for the company details shown on the public site:
 * footer, contact page, privacy notice (KVKK) and search-engine structured data.
 *
 * Leave a field empty ('') to hide it everywhere; never put placeholder values here.
 */
export const COMPANY = {
  brand: 'RenkFlow',
  /** Trading name used across the site. */
  shortName: 'Renk Alüminyum',
  /** Full legal title as registered (ticaret unvanı), used as the KVKK data controller. */
  legalName: '',
  /** Registered address, single line. */
  address: '',
  /** Phone in international format, e.g. +90 212 000 00 00. */
  phone: '',
  /** WhatsApp number in international format; digits are used for the wa.me link. */
  whatsapp: '',
  email: 'info@renkflow.com',
  /** Where KVKK data-subject requests go; falls back to `email`. */
  privacyEmail: '',
  /** Optional registry details shown in the privacy notice. */
  mersisNo: '',
  taxOffice: '',
  taxNumber: '',
  /** Weekday support hours, e.g. "Hafta içi 09:00–18:00". */
  hours: '',
  social: {
    linkedin: '',
    instagram: '',
  },
} as const;

export const companyLegalName = () => COMPANY.legalName || COMPANY.shortName;
export const privacyEmail = () => COMPANY.privacyEmail || COMPANY.email;

const digits = (value: string) => value.replace(/\D/g, '');
export const telHref = (phone: string) => `tel:+${digits(phone)}`;
export const whatsappHref = (phone: string) => `https://wa.me/${digits(phone)}`;

export const socialLinks = () =>
  Object.entries(COMPANY.social)
    .filter(([, url]) => Boolean(url))
    .map(([network, url]) => ({ network, url }));
