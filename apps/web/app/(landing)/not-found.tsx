import type { Metadata } from 'next';
import { NotFoundBody } from '@/components/site/NotFoundBody';

export const metadata: Metadata = {
  title: 'Sayfa bulunamadı',
  robots: { index: false, follow: false },
};

/** Inside the public site the layout already draws the header, so only the body is shown. */
export default function NotFound() {
  return <NotFoundBody />;
}
