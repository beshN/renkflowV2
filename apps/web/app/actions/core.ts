"use server";

import { createHash, randomBytes, randomUUID } from "node:crypto";
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

export async function createOrder(formData: FormData) {
  const parsed = createOrderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Sipariş bilgileri geçersiz.");

  const { supabase, user } = await requireMembership(parsed.data.organizationId, ["owner", "admin", "office"]);
  const orderNumber = `RF-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const { data, error } = await supabase.from("orders").insert({
    organization_id: parsed.data.organizationId,
    order_number: orderNumber,
    customer_name: parsed.data.customerName || null,
    project_name: parsed.data.projectName || null,
    customer_reference: parsed.data.customerReference || null,
    notes: parsed.data.notes || null,
    created_by: user.id,
  }).select("id").single();

  if (error || !data) throw new Error("Sipariş oluşturulamadı.");
  await supabase.from("audit_logs").insert({
    organization_id: parsed.data.organizationId,
    actor_id: user.id,
    action: "order.created",
    entity_type: "order",
    entity_id: data.id,
  });

  redirect(`/panel/siparisler/${data.id}`);
}

export async function updateOrder(input: unknown) {
  const parsed = updateOrderSchema.parse(input);
  const { supabase, user } = await requireMembership(parsed.organizationId, ["owner", "admin", "office"]);
  const { error } = await supabase.from("orders").update({
    customer_name: parsed.customerName || null,
    project_name: parsed.projectName || null,
    customer_reference: parsed.customerReference || null,
    notes: parsed.notes || null,
    ...(parsed.status ? { status: parsed.status } : {}),
  }).eq("id", parsed.orderId).eq("organization_id", parsed.organizationId);
  if (error) throw new Error("Sipariş güncellenemedi.");

  await supabase.from("audit_logs").insert({
    organization_id: parsed.organizationId,
    actor_id: user.id,
    action: "order.updated",
    entity_type: "order",
    entity_id: parsed.orderId,
  });
  revalidatePath(`/panel/siparisler/${parsed.orderId}`);
}

export async function reviewAnalysis(input: unknown) {
  const parsed = reviewAnalysisSchema.parse(input);
  const { supabase } = await requireMembership(parsed.organizationId, ["owner", "admin", "office"]);
  const { error } = await supabase.rpc("review_analysis", {
    target_analysis: parsed.analysisId,
    verified_output: parsed.normalizedOutput,
    corrections: parsed.corrections,
  });
  if (error) throw new Error("Analiz onaylanamadı.");
  revalidatePath(`/panel/siparisler/${parsed.orderId}`);
}

export async function advanceOrderStage(input: unknown) {
  const parsed = advanceStageSchema.parse(input);
  const { supabase, user } = await requireMembership(parsed.organizationId, ["owner", "admin", "office", "production"]);
  const { error } = await supabase.from("order_stage_events").insert({
    organization_id: parsed.organizationId,
    order_id: parsed.orderId,
    stage_id: parsed.stageId,
    event_type: parsed.eventType,
    note: parsed.note || null,
    created_by: user.id,
  });
  if (error) throw new Error("Üretim aşaması güncellenemedi.");

  if (parsed.eventType === "started") {
    await supabase.from("orders").update({ status: "in_production" })
      .eq("id", parsed.orderId).in("status", ["approved", "in_production"]);
  }
  revalidatePath("/panel/uretim");
  revalidatePath(`/panel/siparisler/${parsed.orderId}`);
}

export async function inviteMember(formData: FormData) {
  const parsed = inviteMemberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("Davet bilgileri geçersiz.");

  const { supabase, user } = await requireMembership(parsed.data.organizationId, ["owner", "admin"]);
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: organization } = await supabase.from("organizations")
    .select("name").eq("id", parsed.data.organizationId).single();
  if (!organization) throw new Error("Şirket bulunamadı.");

  const { data: invite, error } = await supabase.from("organization_invites").insert({
    organization_id: parsed.data.organizationId,
    email: parsed.data.email,
    role: parsed.data.role,
    token_hash: tokenHash,
    invited_by: user.id,
    expires_at: expiresAt,
  }).select("id").single();
  if (error || !invite) throw new Error("Davet kaydı oluşturulamadı.");

  const resend = new Resend(process.env.RESEND_API_KEY);
  const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/davet?token=${encodeURIComponent(token)}`;
  const { error: emailError } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "RenkFlow <onboarding@resend.dev>",
    to: parsed.data.email,
    subject: `${organization.name} sizi RenkFlow'a davet etti`,
    react: InviteEmail({ organizationName: organization.name, acceptUrl, role: parsed.data.role }),
  }, { headers: { "Idempotency-Key": `organization-invite-${invite.id}` } });

  if (emailError) {
    await supabase.from("organization_invites").update({ revoked_at: new Date().toISOString() }).eq("id", invite.id);
    throw new Error("Davet e-postası gönderilemedi.");
  }

  revalidatePath("/panel/ekip");
}

export async function createRuleSet(formData: FormData) {
  const parsed = createRuleSetSchema.safeParse({
    organizationId: formData.get("organizationId"),
    name: formData.get("name"),
    rulesAst: formData.get("rulesAst"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Kural bilgileri geçersiz.");

  const ast = JSON.parse(parsed.data.rulesAst) as unknown;
  const astResult = validateRuleAst(ast);
  if (!astResult.success) throw new Error("Kural AST biçimi geçersiz.");

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
  if (error) throw new Error("Kural taslağı oluşturulamadı.");
  revalidatePath("/panel/hesap-kurallari");
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
    supabase.from("orders").select("id, status, order_items(*)")
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

  for (const item of order.order_items ?? []) {
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
    const { error } = await supabase.from("calculation_runs").upsert({
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
    }, { onConflict: "order_item_id,rule_set_id,input_hash", ignoreDuplicates: true });
    if (error) throw new Error("Hesap sonucu kaydedilemedi.");
  }
  revalidatePath(`/panel/siparisler/${parsed.orderId}`);
}

export async function updateProductionStages(formData: FormData) {
  const ids = formData.getAll("stageId").map(String);
  const names = formData.getAll("stageName").map(String);
  const colors = formData.getAll("stageColor").map(String);
  const parsed = productionStagesSchema.safeParse({
    organizationId: formData.get("organizationId"),
    stages: ids.map((id, index) => ({ id, name: names[index], color: colors[index], position: index + 1 })),
  });
  if (!parsed.success) throw new Error("Üretim aşamaları geçersiz.");

  const { supabase } = await requireMembership(parsed.data.organizationId, ["owner", "admin"]);
  for (const stage of parsed.data.stages) {
    const { error } = await supabase.from("production_stages").update({
      name: stage.name,
      color: stage.color,
      position: stage.position,
    }).eq("id", stage.id).eq("organization_id", parsed.data.organizationId);
    if (error) throw new Error("Üretim aşamaları kaydedilemedi.");
  }
  revalidatePath("/panel/uretim");
  revalidatePath("/panel/ayarlar");
}
