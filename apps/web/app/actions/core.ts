"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Resend } from "resend";
import {
  activateRuleSetSchema,
  calculationRunSchema,
  productionStagesSchema,
  createOrderSchema,
  createRuleSetSchema,
  advanceStageSchema,
  inviteMemberSchema,
  reviewAnalysisSchema,
  updateOrderSchema,
} from "@/lib/server-schemas";
import { requireMembership } from "@/lib/auth";
import { validateRuleAst } from "@/lib/rules/engine";
import { runRuleSet } from "@/lib/rules/engine";
import type { RuleSet } from "@/lib/types";
import InviteEmail from "@/emails/invite";
import type { FormActionState } from "@/lib/action-state";
import { extractedOrderFieldsSchema } from "@/lib/ai/extraction-schema";
import { collectAnalysisCorrections } from "@/lib/ai/corrections";

export async function createOrder(_: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = createOrderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Sipariş bilgileri geçersiz." };

  let orderId: string;
  try {
    const { supabase } = await requireMembership(parsed.data.organizationId, ["owner", "admin", "office"]);
    const { data, error } = await supabase.rpc("create_order", {
      target_organization: parsed.data.organizationId,
      target_customer_name: parsed.data.customerName || null,
      target_project_name: parsed.data.projectName || null,
      target_customer_reference: parsed.data.customerReference || null,
      target_notes: parsed.data.notes || null,
    });
    if (error || !data) return { error: error?.message || "Sipariş oluşturulamadı." };
    orderId = data;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Sipariş oluşturulamadı." };
  }

  redirect(`/panel/siparisler/${orderId}`);
}

export async function updateOrder(input: unknown) {
  const parsed = updateOrderSchema.parse(input);
  const { supabase } = await requireMembership(parsed.organizationId, ["owner", "admin", "office"]);
  const { error } = await supabase.rpc("update_order_details", {
    target_organization: parsed.organizationId,
    target_order: parsed.orderId,
    target_customer_name: parsed.customerName || null,
    target_project_name: parsed.projectName || null,
    target_customer_reference: parsed.customerReference || null,
    target_notes: parsed.notes || null,
  });
  if (error) throw new Error("Sipariş güncellenemedi.");
  revalidatePath(`/panel/siparisler/${parsed.orderId}`);
}

export async function updateOrderForm(_: FormActionState, formData: FormData): Promise<FormActionState> {
  try {
    await updateOrder(Object.fromEntries(formData));
    return { success: "Sipariş bilgileri güncellendi." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Sipariş güncellenemedi." };
  }
}

export async function cancelOrder(input: unknown) {
  const parsed = updateOrderSchema.pick({ organizationId: true, orderId: true }).parse(input);
  const { supabase } = await requireMembership(parsed.organizationId, ["owner", "admin", "office"]);
  const { error } = await supabase.rpc("cancel_order", {
    target_organization: parsed.organizationId,
    target_order: parsed.orderId,
  });
  if (error) throw new Error(error.message || "Sipariş iptal edilemedi.");
  revalidatePath("/panel/siparisler");
  revalidatePath(`/panel/siparisler/${parsed.orderId}`);
}

export async function reviewAnalysis(input: unknown) {
  const parsed = reviewAnalysisSchema.parse(input);
  const { supabase } = await requireMembership(parsed.organizationId, ["owner", "admin", "office"]);
  const { data: analysis } = await supabase.from("document_analyses")
    .select("normalized_output, status")
    .eq("id", parsed.analysisId)
    .eq("organization_id", parsed.organizationId)
    .eq("order_id", parsed.orderId)
    .maybeSingle();
  if (!analysis || analysis.status !== "needs_review") throw new Error("Analiz artık onaylanabilir durumda değil.");

  const original = extractedOrderFieldsSchema.safeParse(analysis.normalized_output);
  if (!original.success) throw new Error("Kaydedilmiş AI çıktısı geçerli değil. Analizi yeniden çalıştırın.");
  const corrections = collectAnalysisCorrections(original.data, parsed.normalizedOutput);
  const { error } = await supabase.rpc("review_analysis", {
    target_analysis: parsed.analysisId,
    verified_output: parsed.normalizedOutput,
    corrections,
  });
  if (error) throw new Error("Analiz onaylanamadı.");
  revalidatePath(`/panel/siparisler/${parsed.orderId}`);
}

export async function advanceOrderStage(input: unknown) {
  const parsed = advanceStageSchema.parse(input);
  const { supabase } = await requireMembership(parsed.organizationId, ["owner", "admin", "office", "production"]);
  const { error } = await supabase.rpc("advance_order_stage", {
    target_organization: parsed.organizationId,
    target_order: parsed.orderId,
    target_stage: parsed.stageId,
    requested_event: parsed.eventType,
    event_note: parsed.note || null,
  });
  if (error) throw new Error(error.message || "Üretim aşaması güncellenemedi.");

  revalidatePath("/panel/uretim");
  revalidatePath(`/panel/siparisler/${parsed.orderId}`);
}

export async function inviteMember(_: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = inviteMemberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Davet bilgileri geçersiz." };

  try {
    const { supabase, user } = await requireMembership(parsed.data.organizationId, ["owner", "admin"]);
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: organization } = await supabase.from("organizations")
      .select("name").eq("id", parsed.data.organizationId).single();
    if (!organization) return { error: "Şirket bulunamadı." };

    await supabase.from("organization_invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("organization_id", parsed.data.organizationId)
      .eq("email", parsed.data.email)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .lte("expires_at", new Date().toISOString());

    const { data: invite, error } = await supabase.from("organization_invites").insert({
      organization_id: parsed.data.organizationId,
      email: parsed.data.email,
      role: parsed.data.role,
      token_hash: tokenHash,
      invited_by: user.id,
      expires_at: expiresAt,
    }).select("id").single();
    if (error || !invite) return { error: "Bu adres için bekleyen bir davet zaten olabilir." };

    try {
      const fromEmail = process.env.RESEND_FROM_EMAIL ?? process.env.RESEND_INFO_EMAIL;
      if (!process.env.RESEND_API_KEY || !fromEmail) {
        throw new Error("E-posta servisi yapılandırılmadı.");
      }
      const resend = new Resend(process.env.RESEND_API_KEY);
      const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/davet?token=${encodeURIComponent(token)}`;
      const { error: emailError } = await resend.emails.send({
        from: fromEmail,
        to: parsed.data.email,
        subject: `${organization.name} sizi RenkFlow'a davet etti`,
        react: InviteEmail({ organizationName: organization.name, acceptUrl, role: parsed.data.role }),
      }, { headers: { "Idempotency-Key": `organization-invite-${invite.id}` } });
      if (emailError) throw emailError;
    } catch {
      await supabase.from("organization_invites").update({ revoked_at: new Date().toISOString() }).eq("id", invite.id);
      return { error: "Davet e-postası gönderilemedi. E-posta servisi ayarlarını kontrol edin." };
    }

    revalidatePath("/panel/ekip");
    return { success: "Davet e-postası gönderildi." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Davet gönderilemedi." };
  }
}

export async function createRuleSet(_: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = createRuleSetSchema.safeParse({
    organizationId: formData.get("organizationId"),
    name: formData.get("name"),
    rulesAst: formData.get("rulesAst"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Kural bilgileri geçersiz." };

  let ast: unknown;
  try {
    ast = JSON.parse(parsed.data.rulesAst) as unknown;
  } catch {
    return { error: "JSON AST geçerli bir JSON belgesi değil." };
  }
  const astResult = validateRuleAst(ast);
  if (!astResult.success) return { error: astResult.error.issues[0]?.message ?? "Kural AST biçimi geçersiz." };

  try {
    const { supabase, user } = await requireMembership(parsed.data.organizationId, ["owner", "admin"]);
    const { data: latest } = await supabase.from("calculation_rule_sets").select("version")
      .eq("organization_id", parsed.data.organizationId).eq("name", parsed.data.name)
      .order("version", { ascending: false }).limit(1).maybeSingle();

    const { error } = await supabase.from("calculation_rule_sets").insert({
      organization_id: parsed.data.organizationId,
      name: parsed.data.name,
      version: (latest?.version ?? 0) + 1,
      status: "draft",
      rules_ast: ast,
      created_by: user.id,
    });
    if (error) return { error: "Kural taslağı oluşturulamadı." };
    revalidatePath("/panel/hesap-kurallari");
    return { success: "Kural taslağı kaydedildi." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Kural taslağı oluşturulamadı." };
  }
}

export async function activateRuleSet(input: unknown) {
  const parsed = activateRuleSetSchema.parse(input);
  const { supabase } = await requireMembership(parsed.organizationId, ["owner", "admin"]);
  const { data: ruleSet } = await supabase.from("calculation_rule_sets")
    .select("rules_ast").eq("id", parsed.ruleSetId).eq("organization_id", parsed.organizationId).single();
  if (!ruleSet || !validateRuleAst(ruleSet.rules_ast).success) throw new Error("Kural seti geçerli değil.");

  const { error } = await supabase.rpc("activate_rule_set", { target_rule_set: parsed.ruleSetId });
  if (error) throw new Error("Kural seti etkinleştirilemedi.");
  revalidatePath("/panel/hesap-kurallari");
}

export async function runCalculation(input: unknown) {
  const parsed = calculationRunSchema.parse(input);
  const { supabase, user } = await requireMembership(parsed.organizationId, ["owner", "admin", "office"]);
  const [{ data: order }, { data: activeRule }] = await Promise.all([
    supabase.from("orders").select("id, status, order_items!order_items_order_id_fkey(*)")
      .eq("id", parsed.orderId).eq("organization_id", parsed.organizationId).single(),
    supabase.from("calculation_rule_sets").select("*")
      .eq("organization_id", parsed.organizationId).eq("status", "active")
      .order("activated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (!order || !["approved", "in_production", "ready"].includes(order.status)) {
    throw new Error("Hesaplama yalnızca insan tarafından onaylanmış siparişte çalışır.");
  }
  if (!activeRule) throw new Error("Etkin bir kural seti yok.");
  const ast = activeRule.rules_ast as { version?: number; rules?: RuleSet["rules"] };
  if (!validateRuleAst(ast).success || !ast.rules) throw new Error("Etkin kural seti geçersiz.");

  const ruleSet: RuleSet = {
    id: activeRule.id,
    organizationId: activeRule.organization_id,
    name: activeRule.name,
    version: activeRule.version,
    status: "active",
    rules: ast.rules,
  };

  if (!order.order_items?.length) throw new Error("Hesaplanacak onaylanmış ürün satırı yok.");
  const calculationRows = order.order_items.map((item) => {
    const inputSnapshot = {
      quantity: item.quantity,
      widthMm: item.width_mm === null ? null : Number(item.width_mm),
      heightMm: item.height_mm === null ? null : Number(item.height_mm),
      lightColor: item.light_color,
      profileType: item.profile_type,
      motorType: item.motor_type,
      verifiedData: item.verified_data,
    };
    const inputHash = createHash("sha256").update(JSON.stringify(inputSnapshot)).digest("hex");
    const result = runRuleSet(ruleSet, inputSnapshot);
    return {
      organization_id: parsed.organizationId,
      order_id: order.id,
      order_item_id: item.id,
      rule_set_id: activeRule.id,
      rule_set_version: activeRule.version,
      input_hash: inputHash,
      input_snapshot: inputSnapshot,
      result_snapshot: result.outputs,
      validation_errors: result.errors,
      created_by: user.id,
    };
  });
  const { error } = await supabase.from("calculation_runs").upsert(calculationRows, {
    onConflict: "order_item_id,rule_set_id,input_hash",
    ignoreDuplicates: true,
  });
  if (error) throw new Error("Hesap sonuçları kaydedilemedi.");
  revalidatePath(`/panel/siparisler/${parsed.orderId}`);
}

export async function updateProductionStages(_: FormActionState, formData: FormData): Promise<FormActionState> {
  const ids = formData.getAll("stageId").map(String);
  const names = formData.getAll("stageName").map(String);
  const colors = formData.getAll("stageColor").map(String);
  const parsed = productionStagesSchema.safeParse({
    organizationId: formData.get("organizationId"),
    stages: ids.map((id, index) => ({ id, name: names[index], color: colors[index], position: index + 1 })),
  });
  if (!parsed.success) return { error: "Üretim aşamaları geçersiz." };

  try {
    const { supabase } = await requireMembership(parsed.data.organizationId, ["owner", "admin"]);
    const { error } = await supabase.rpc("update_production_stages", {
      target_organization: parsed.data.organizationId,
      stage_payload: parsed.data.stages,
    });
    if (error) return { error: error.message || "Üretim aşamaları kaydedilemedi." };
    revalidatePath("/panel/uretim");
    revalidatePath("/panel/ayarlar");
    return { success: "Üretim aşamaları kaydedildi." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Üretim aşamaları kaydedilemedi." };
  }
}
