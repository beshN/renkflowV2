import { redirect } from 'next/navigation';

/**
 * The public landing page is temporarily disabled while the panel is piloted.
 * Authenticated users continue to the dashboard; unauthenticated users are
 * redirected to the login screen by the application proxy.
 */
export default function HomePage() {
  redirect('/dashboard');
}
