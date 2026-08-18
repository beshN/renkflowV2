"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { organizationSchema, signInSchema, signUpSchema } from "@/lib/schemas";

export type AuthActionState = { error?: string; success?: string };

export async function signInAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "E-posta veya parola geçersiz." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Giriş yapılamadı. E-posta ve parolanızı kontrol edin." };

  redirect("/panel");
}

export async function signUpAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Bilgiler geçersiz." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/auth/callback`,
    },
  });

  if (error) return { error: error.message };
  return { success: "Doğrulama bağlantısını e-posta adresinize gönderdik." };
}

export async function requestPasswordResetAction(
  _: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email.includes("@")) return { error: "Geçerli bir e-posta adresi girin." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/parola-yenile`,
  });
  if (error) return { error: error.message };
  return { success: "Parola yenileme bağlantısı gönderildi." };
}

export async function createOrganizationAction(formData: FormData) {
  const parsed = organizationSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_organization", { org_name: parsed.data.name });
  if (error) throw new Error("Şirket oluşturulamadı.");
  redirect("/panel");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
