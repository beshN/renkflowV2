import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { ForgotPasswordForm } from "@/components/auth-form";

export const metadata = { title: "Parolamı unuttum" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Hesap kurtarma"
      title="Parolanızı yenileyin."
      description="Kayıtlı e-posta adresinize tek kullanımlık yenileme bağlantısı göndereceğiz."
      footer={<Link href="/giris">Giriş sayfasına dön</Link>}
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
