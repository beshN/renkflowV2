"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function updatePassword(formData: FormData) {
    setPending(true);
    setMessage("");
    setIsError(false);
    const password = String(formData.get("password") ?? "");
    const confirmation = String(formData.get("passwordConfirmation") ?? "");
    if (password.length < 10) {
      setMessage("Parola en az 10 karakter olmalı.");
      setIsError(true);
      setPending(false);
      return;
    }
    if (password !== confirmation) {
      setMessage("Parolalar birbiriyle eşleşmiyor.");
      setIsError(true);
      setPending(false);
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage("Parola güncellenemedi. Yenileme bağlantısının süresi dolmuş olabilir.");
      setIsError(true);
      setPending(false);
      return;
    }
    await supabase.auth.signOut();
    router.replace("/giris?password=updated");
    setPending(false);
  }

  return (
    <main className="setup-page">
      <section className="setup-card">
        <span className="step-label">Hesap güvenliği</span>
        <h1>Yeni parola belirleyin.</h1>
        <form action={updatePassword} className="auth-form">
          <label>Yeni parola<input name="password" type="password" minLength={10} autoComplete="new-password" required /></label>
          <label>Yeni parola tekrar<input name="passwordConfirmation" type="password" minLength={10} autoComplete="new-password" required /></label>
          {message && <p className={`form-message ${isError ? "error" : "success"}`} role={isError ? "alert" : "status"}>{message}</p>}
          <button type="submit" className="button button-primary" disabled={pending}>{pending ? "Güncelleniyor…" : "Parolayı güncelle"}</button>
          <Link className="text-link" href="/giris">Giriş sayfasına dön</Link>
        </form>
      </section>
    </main>
  );
}
