import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { SignUpForm } from "@/components/auth-form";

export const metadata = { title: "Kurucu hesabı oluştur" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthShell
      eyebrow={next?.startsWith("/davet") ? "Ekip daveti" : "Temiz başlangıç"}
      title={next?.startsWith("/davet") ? "Davetinizi kabul etmek için hesap oluşturun." : "Şirketinizi RenkFlow'a taşıyın."}
      description="E-posta doğrulamasından sonra güvenli çalışma alanınıza yönlendirileceksiniz."
      footer={<span>Zaten hesabınız var mı? <Link href={next ? `/giris?next=${encodeURIComponent(next)}` : "/giris"}>Giriş yapın</Link></span>}
    >
      <SignUpForm next={next} />
    </AuthShell>
  );
}
