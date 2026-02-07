// Force dynamic rendering for signup page to prevent Vercel build timeout
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
