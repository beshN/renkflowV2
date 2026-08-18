"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function updatePassword(formData: FormData) {
    setPending(true);
    const password = String(formData.get("password") ?? "");
    if (password.length < 10) {
      setMessage("Parola en az 10 karakter olmalı.");
      setPending(false);
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setMessage(error ? error.message : "Parolanız güncellendi. Giriş yapabilirsiniz.");
    setPending(false);
  }

  return (
    <main className="setup-page">
      <section className="setup-card">
        <span className="step-label">Hesap güvenliği</span>
        <h1>Yeni parola belirleyin.</h1>
        <form action={updatePassword} className="auth-form">
          <label>Yeni parola<input name="password" type="password" minLength={10} autoComplete="new-password" required /></label>
          {message && <p className="form-message success">{message}</p>}
          <button className="button button-primary" disabled={pending}>{pending ? "Güncelleniyor…" : "Parolayı güncelle"}</button>
          <Link className="text-link" href="/giris">Giriş sayfasına dön</Link>
        </form>
      </section>
    </main>
  );
}
