"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMembership } from "@/lib/auth";
import type { FormActionState } from "@/lib/action-state";

const optionalText = z.string().trim().max(500).optional().transform((value) => value || null);
const optionalEmail = z.union([z.literal(""), z.email().max(254)]).transform((value) => value || null);
const numberField = z.coerce.number().min(0).max(999_999_999);

const customerSchema = z.object({
  organizationId: z.uuid(), name: z.string().trim().min(2).max(160), contactPerson: optionalText,
  email: optionalEmail, phone: optionalText, status: z.enum(["prospect", "active", "inactive"]), notes: optionalText,
});
const supplierSchema = z.object({
  organizationId: z.uuid(), name: z.string().trim().min(2).max(160), contactPerson: optionalText,
  email: optionalEmail, phone: optionalText, categories: z.string().trim().max(500), status: z.enum(["active", "paused", "inactive"]), notes: optionalText,
});
const inventorySchema = z.object({
  organizationId: z.uuid(), sku: z.string().trim().min(1).max(80), name: z.string().trim().min(2).max(180),
  category: optionalText, unit: z.enum(["adet", "metre", "m2", "kg", "kutu"]), onHand: numberField,
  reorderLevel: numberField, unitCost: z.union([z.literal(""), z.coerce.number().min(0).max(999_999_999)]).transform((value) => value === "" ? null : value),
  currency: z.enum(["TRY", "EUR", "USD"]), supplierId: z.union([z.literal(""), z.uuid()]).transform((value) => value || null), notes: optionalText,
});
const financialSchema = z.object({
  organizationId: z.uuid(), recordNumber: z.string().trim().min(1).max(80), recordType: z.enum(["quote", "invoice", "payment", "expense"]),
  status: z.enum(["draft", "issued", "paid", "overdue", "cancelled"]), orderId: z.union([z.literal(""), z.uuid()]).transform((value) => value || null),
  customerId: z.union([z.literal(""), z.uuid()]).transform((value) => value || null), description: z.string().trim().min(2).max(240),
  amount: numberField, currency: z.enum(["TRY", "EUR", "USD"]), issueDate: z.iso.date(), dueDate: z.union([z.literal(""), z.iso.date()]).transform((value) => value || null), notes: optionalText,
});

const inventoryMovementSchema = z.object({
  organizationId: z.uuid(),
  inventoryItemId: z.uuid(),
  movementType: z.enum(["receipt", "consumption", "increase_adjustment", "decrease_adjustment"]),
  quantity: z.coerce.number().positive().max(999_999_999),
  notes: z.string().trim().max(1000).optional().transform((value) => value || null),
});

const customerStatusSchema = z.object({
  organizationId: z.uuid(),
  customerId: z.uuid(),
  status: z.enum(["prospect", "active", "inactive"]),
});

const supplierStatusSchema = z.object({
  organizationId: z.uuid(),
  supplierId: z.uuid(),
  status: z.enum(["active", "paused", "inactive"]),
});

const financialStatusSchema = z.object({
  organizationId: z.uuid(),
  recordId: z.uuid(),
  status: z.enum(["draft", "issued", "paid", "overdue", "cancelled"]),
});

export async function createCustomer(_: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = customerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Müşteri bilgileri geçersiz." };
  try {
    const { supabase, user } = await requireMembership(parsed.data.organizationId, ["owner", "admin", "office"]);
    const { error } = await supabase.from("crm_customers").insert({ organization_id: parsed.data.organizationId, name: parsed.data.name, contact_person: parsed.data.contactPerson, email: parsed.data.email, phone: parsed.data.phone, status: parsed.data.status, notes: parsed.data.notes, created_by: user.id });
    if (error) return { error: error.code === "23505" ? "Bu müşteri zaten kayıtlı." : "Müşteri kaydedilemedi." };
    revalidatePath("/panel/crm"); return { success: "Müşteri kaydedildi." };
  } catch (error) { return { error: error instanceof Error ? error.message : "Müşteri kaydedilemedi." }; }
}

export async function createSupplier(_: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = supplierSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Tedarikçi bilgileri geçersiz." };
  try {
    const { supabase, user } = await requireMembership(parsed.data.organizationId, ["owner", "admin", "office"]);
    const { error } = await supabase.from("suppliers").insert({ organization_id: parsed.data.organizationId, name: parsed.data.name, contact_person: parsed.data.contactPerson, email: parsed.data.email, phone: parsed.data.phone, material_categories: parsed.data.categories.split(",").map((value) => value.trim()).filter(Boolean), status: parsed.data.status, notes: parsed.data.notes, created_by: user.id });
    if (error) return { error: error.code === "23505" ? "Bu tedarikçi zaten kayıtlı." : "Tedarikçi kaydedilemedi." };
    revalidatePath("/panel/tedarikciler"); return { success: "Tedarikçi kaydedildi." };
  } catch (error) { return { error: error instanceof Error ? error.message : "Tedarikçi kaydedilemedi." }; }
}

export async function createInventoryItem(_: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = inventorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Stok bilgileri geçersiz." };
  try {
    const { supabase, user } = await requireMembership(parsed.data.organizationId, ["owner", "admin", "office"]);
    const { error } = await supabase.from("inventory_items").insert({ organization_id: parsed.data.organizationId, sku: parsed.data.sku, name: parsed.data.name, category: parsed.data.category, unit: parsed.data.unit, on_hand: parsed.data.onHand, reorder_level: parsed.data.reorderLevel, unit_cost: parsed.data.unitCost, currency: parsed.data.currency, supplier_id: parsed.data.supplierId, notes: parsed.data.notes, created_by: user.id });
    if (error) return { error: error.code === "23505" ? "Bu stok kodu zaten kullanılıyor." : "Stok kartı kaydedilemedi." };
    revalidatePath("/panel/envanter"); return { success: "Stok kartı kaydedildi." };
  } catch (error) { return { error: error instanceof Error ? error.message : "Stok kartı kaydedilemedi." }; }
}

export async function createFinancialRecord(_: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = financialSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Finans kaydı geçersiz." };
  try {
    const { supabase, user } = await requireMembership(parsed.data.organizationId, ["owner", "admin"]);
    const { error } = await supabase.from("financial_records").insert({ organization_id: parsed.data.organizationId, record_number: parsed.data.recordNumber, record_type: parsed.data.recordType, status: parsed.data.status, order_id: parsed.data.orderId, customer_id: parsed.data.customerId, description: parsed.data.description, amount: parsed.data.amount, currency: parsed.data.currency, issue_date: parsed.data.issueDate, due_date: parsed.data.dueDate, notes: parsed.data.notes, created_by: user.id });
    if (error) return { error: error.code === "23505" ? "Bu kayıt numarası zaten kullanılıyor." : "Finans kaydı oluşturulamadı." };
    revalidatePath("/panel/finans"); return { success: "Finans kaydı oluşturuldu." };
  } catch (error) { return { error: error instanceof Error ? error.message : "Finans kaydı oluşturulamadı." }; }
}

export async function recordInventoryMovement(_: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = inventoryMovementSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Stok hareketi geçersiz." };
  try {
    const { supabase } = await requireMembership(parsed.data.organizationId, ["owner", "admin", "office", "production"]);
    const { error } = await supabase.rpc("record_inventory_movement", {
      target_organization: parsed.data.organizationId,
      target_inventory_item: parsed.data.inventoryItemId,
      target_movement_type: parsed.data.movementType,
      target_quantity: parsed.data.quantity,
      target_notes: parsed.data.notes,
    });
    if (error) return { error: error.message || "Stok hareketi kaydedilemedi." };
    revalidatePath("/panel/envanter");
    revalidatePath("/panel/denetim");
    return { success: "Stok hareketi işlendi." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Stok hareketi kaydedilemedi." };
  }
}

export async function updateCustomerStatus(_: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = customerStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Müşteri durumu geçersiz." };
  try {
    const { supabase } = await requireMembership(parsed.data.organizationId, ["owner", "admin", "office"]);
    const { data, error } = await supabase.from("crm_customers").update({ status: parsed.data.status })
      .eq("organization_id", parsed.data.organizationId).eq("id", parsed.data.customerId).select("id").maybeSingle();
    if (error || !data) return { error: "Müşteri durumu güncellenemedi." };
    revalidatePath("/panel/crm");
    revalidatePath("/panel/denetim");
    return { success: "Müşteri durumu güncellendi." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Müşteri durumu güncellenemedi." };
  }
}

export async function updateSupplierStatus(_: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = supplierStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Tedarikçi durumu geçersiz." };
  try {
    const { supabase } = await requireMembership(parsed.data.organizationId, ["owner", "admin", "office"]);
    const { data, error } = await supabase.from("suppliers").update({ status: parsed.data.status })
      .eq("organization_id", parsed.data.organizationId).eq("id", parsed.data.supplierId).select("id").maybeSingle();
    if (error || !data) return { error: "Tedarikçi durumu güncellenemedi." };
    revalidatePath("/panel/tedarikciler");
    revalidatePath("/panel/denetim");
    return { success: "Tedarikçi durumu güncellendi." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Tedarikçi durumu güncellenemedi." };
  }
}

export async function updateFinancialStatus(_: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = financialStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Finans durumu geçersiz." };
  try {
    const { supabase } = await requireMembership(parsed.data.organizationId, ["owner", "admin"]);
    const { data, error } = await supabase.from("financial_records").update({ status: parsed.data.status })
      .eq("organization_id", parsed.data.organizationId).eq("id", parsed.data.recordId).select("id").maybeSingle();
    if (error || !data) return { error: "Finans durumu güncellenemedi." };
    revalidatePath("/panel/finans");
    revalidatePath("/panel/denetim");
    return { success: "Finans durumu güncellendi." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Finans durumu güncellenemedi." };
  }
}
