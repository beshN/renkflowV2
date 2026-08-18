import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { SignUpForm } from "@/components/auth-form";

export const metadata = { title: "Kurucu hesabı oluştur" };

export default function SignUpPage() {
  return (
    <AuthShell
      eyebrow="Temiz başlangıç"
      title="Şirketinizi RenkFlow'a taşıyın."
      description="E-posta doğrulamasından sonra şirketinizi oluşturup ekibinizi davet edebilirsiniz."
      footer={<span>Zaten hesabınız var mı? <Link href="/giris">Giriş yapın</Link></span>}
    >
      <SignUpForm />
    </AuthShell>
  );
}
