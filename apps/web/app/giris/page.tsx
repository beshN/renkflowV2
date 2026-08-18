import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { SignInForm } from "@/components/auth-form";

export const metadata = { title: "Giriş yap" };

export default function SignInPage() {
  return (
    <AuthShell
      eyebrow="Çalışma alanınıza dönün"
      title="Tekrar hoş geldiniz."
      description="Siparişleri incelemek ve üretimi ilerletmek için giriş yapın."
      footer={<span>Hesabınız yok mu? <Link href="/kayit">Kurucu hesabı oluşturun</Link></span>}
    >
      <SignInForm />
    </AuthShell>
  );
}
