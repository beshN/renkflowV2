import { IBM_Plex_Sans_Condensed } from 'next/font/google';
import '@/styles/fair.css';

// Dimension labels and figures of the drawing sheet. Loaded only on the configurator's pages.
const condensed = IBM_Plex_Sans_Condensed({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  variable: '--font-condensed',
  display: 'swap',
});

export default function ConfiguratorLayout({ children }: { children: React.ReactNode }) {
  return <div className={condensed.variable}>{children}</div>;
}
