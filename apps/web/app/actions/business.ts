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
