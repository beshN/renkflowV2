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
  legalName: 'Renk Alüminyum Kepenk ve Çatı Sistemleri İnşaat San. Tic. Ltd. Şti.',
  /** Office address (also the KVKK contact address), single line. */
  address: 'Gençosman Mah. Orgeneral Eşref Bitlis Cad. No: 37/B, 34165 Güngören / İstanbul',
  /** Phone in international format, e.g. +90 212 000 00 00. */
  phone: '+90 212 563 21 32',
  /** WhatsApp number in international format; digits are used for the wa.me link. */
  whatsapp: '+90 553 837 53 54',
  email: 'info@renkflow.com',
  /** Where KVKK data-subject requests go; falls back to `email`. */
  privacyEmail: '',
  /** Optional registry details shown in the privacy notice. */
  mersisNo: '',
  taxOffice: 'Esenler',
  taxNumber: '7340074530',
  /** Weekday support hours, e.g. "Hafta içi 09:00–18:00". */
  hours: 'Hafta içi 09:00–18:30',
  social: {
    linkedin: '',
    instagram: 'https://www.instagram.com/renkaluminum/',
    youtube: 'https://www.youtube.com/channel/UCs2x_58VlFJQwoMcjAMkA5Q',
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
