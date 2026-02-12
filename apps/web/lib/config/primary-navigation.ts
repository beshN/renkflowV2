export type PrimaryNavItem = {
  label: string;
  href: string;
};

export const PRIMARY_NAV_ITEMS: PrimaryNavItem[] = [
  { label: 'Hakkimizda', href: '/about' },
  { label: 'Ozellikler', href: '/features' },
  { label: 'Kullanim Senaryolari', href: '/docs' },
  { label: 'Fiyatlandirma', href: '/pricing' },
  { label: 'Blog', href: '/blog' },
];

export const PRIMARY_NAV_CTA = {
  label: 'Giris Yap',
  href: '/auth/login',
};
