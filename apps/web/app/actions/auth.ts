"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { organizationSchema, signInSchema, signUpSchema } from "@/lib/schemas";
import { safeAppPath } from "@/lib/navigation";
import type { FormActionState } from "@/lib/action-state";

export type AuthActionState = { error?: string; success?: string };

export async function signInAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "E-posta veya parola geçersiz." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Giriş yapılamadı. E-posta ve parolanızı kontrol edin." };

  redirect(safeAppPath(parsed.data.next));
}

export async function signUpAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Bilgiler geçersiz." };

  const supabase = await createClient();
  const next = safeAppPath(parsed.data.next, "/kurulum");
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/auth/callback?next=${encodeURIComponent(next)}`,
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
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/auth/callback?next=${encodeURIComponent("/parola-yenile")}`,
  });
  if (error) return { error: error.message };
  return { success: "Parola yenileme bağlantısı gönderildi." };
}

export async function createOrganizationAction(
  _: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const parsed = organizationSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Şirket adı geçersiz." };

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("create_organization", { org_name: parsed.data.name });
    if (error) return { error: "Şirket oluşturulamadı. Aynı adla bir çalışma alanınız olabilir." };
  } catch {
    return { error: "Şirket oluşturulamadı. Lütfen yeniden deneyin." };
  }
  redirect("/panel");
}

export async function acceptOrganizationInviteAction(
  _: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const token = String(formData.get("token") ?? "");
  if (token.length < 20 || token.length > 500) return { error: "Davet bağlantısı geçersiz." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_organization_invite", { raw_token: token });
  if (error || !data) {
    return { error: "Davet süresi dolmuş, iptal edilmiş veya farklı bir e-posta adresine ait." };
  }

  const cookieStore = await cookies();
  cookieStore.set("renkflow-organization", data, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/panel");
}

export async function switchOrganizationAction(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/giris");

  const { data: membership } = await supabase.from("organization_members")
    .select("organization_id")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) throw new Error("Bu çalışma alanına erişiminiz yok.");

  const cookieStore = await cookies();
  cookieStore.set("renkflow-organization", organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/panel");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete("renkflow-organization");
  redirect("/");
}
