import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { SignInForm } from "@/components/auth-form";

export const metadata = { title: "Giriş yap" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; password?: string; error?: string }>;
}) {
  const { next, password, error } = await searchParams;
  const notice = password === "updated"
    ? "Parolanız güncellendi. Yeni parolanızla giriş yapabilirsiniz."
    : error === "callback"
      ? "Bağlantı doğrulanamadı veya süresi doldu."
      : undefined;
  return (
    <AuthShell
      eyebrow="Çalışma alanınıza dönün"
      title="Tekrar hoş geldiniz."
      description="Siparişleri incelemek ve üretimi ilerletmek için giriş yapın."
      footer={<span>Hesabınız yok mu? <Link href={next ? `/kayit?next=${encodeURIComponent(next)}` : "/kayit"}>Hesap oluşturun</Link></span>}
    >
      <SignInForm next={next} notice={notice} />
    </AuthShell>
  );
}
