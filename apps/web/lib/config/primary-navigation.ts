export type PrimaryNavItem = {
  label: string;
  href: string;
};

export const PRIMARY_NAV_ITEMS: PrimaryNavItem[] = [
  { label: 'About us', href: '/about' },
  { label: 'Services', href: '/features' },
  { label: 'Use Cases', href: '/docs' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Blog', href: '/blog' },
];

export const PRIMARY_NAV_CTA = {
  label: 'Request a quote',
  href: '/contact?intent=quote',
};
