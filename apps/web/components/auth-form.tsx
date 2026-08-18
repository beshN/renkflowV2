"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { AuthActionState } from "@/app/actions/auth";
import { requestPasswordResetAction, signInAction, signUpAction } from "@/app/actions/auth";

const initialState: AuthActionState = {};

export function SignInForm() {
  const [state, action, pending] = useActionState(signInAction, initialState);
  return (
    <form action={action} className="auth-form">
      <label>E-posta<input name="email" type="email" autoComplete="email" required /></label>
      <label>Parola<input name="password" type="password" autoComplete="current-password" required /></label>
      {state.error && <p className="form-message error">{state.error}</p>}
      <button className="button button-primary" disabled={pending}>{pending ? "Giriş yapılıyor…" : "Giriş yap"}</button>
      <Link className="text-link" href="/parolami-unuttum">Parolamı unuttum</Link>
    </form>
  );
}

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUpAction, initialState);
  return (
    <form action={action} className="auth-form">
      <label>Ad soyad<input name="fullName" autoComplete="name" required /></label>
      <label>E-posta<input name="email" type="email" autoComplete="email" required /></label>
      <label>Parola<input name="password" type="password" autoComplete="new-password" minLength={10} required /></label>
      {state.error && <p className="form-message error">{state.error}</p>}
      {state.success && <p className="form-message success">{state.success}</p>}
      <button className="button button-primary" disabled={pending}>{pending ? "Hesap oluşturuluyor…" : "Kurucu hesabı oluştur"}</button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, initialState);
  return (
    <form action={action} className="auth-form">
      <label>E-posta<input name="email" type="email" autoComplete="email" required /></label>
      {state.error && <p className="form-message error">{state.error}</p>}
      {state.success && <p className="form-message success">{state.success}</p>}
      <button className="button button-primary" disabled={pending}>{pending ? "Gönderiliyor…" : "Bağlantı gönder"}</button>
    </form>
  );
}
