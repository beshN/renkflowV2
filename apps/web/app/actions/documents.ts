"use server";

import { createHash, randomUUID } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { revalidatePath } from "next/cache";
import { requireMembership } from "@/lib/auth";
import { queueDocumentAnalysis } from "@/lib/analysis/queue";

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const MAX_PDF_PAGES = 50;

export async function uploadDocumentAction(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");
  const orderId = String(formData.get("orderId") ?? "");
  const file = formData.get("file");

  if (!(file instanceof File)) throw new Error("PDF dosyası seçilmedi.");
  if (file.type !== "application/pdf") throw new Error("Yalnızca PDF yüklenebilir.");
  if (file.size <= 0 || file.size > MAX_PDF_BYTES) throw new Error("PDF en fazla 25 MB olabilir.");

  const { supabase, user } = await requireMembership(organizationId, ["owner", "admin", "office"]);
  const { data: order } = await supabase.from("orders").select("id")
    .eq("id", orderId).eq("organization_id", organizationId).maybeSingle();
  if (!order) throw new Error("Sipariş bulunamadı.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  let pageCount: number;
  try {
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: false });
    pageCount = pdf.getPageCount();
  } catch {
    throw new Error("PDF okunamıyor veya parola korumalı.");
  }
  if (pageCount < 1 || pageCount > MAX_PDF_PAGES) throw new Error("PDF en fazla 50 sayfa olabilir.");

  const documentId = randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120) || "document.pdf";
  const storagePath = `${organizationId}/${orderId}/${documentId}-${safeName}`;
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  const { error: uploadError } = await supabase.storage
    .from("order-documents")
    .upload(storagePath, bytes, { contentType: "application/pdf", upsert: false });
  if (uploadError) throw new Error("PDF depoya yüklenemedi.");

  const { error: insertError } = await supabase.from("documents").insert({
    id: documentId,
    organization_id: organizationId,
    order_id: orderId,
    original_name: file.name,
    storage_path: storagePath,
    mime_type: "application/pdf",
    size_bytes: file.size,
    page_count: pageCount,
    sha256,
    uploaded_by: user.id,
  });

  if (insertError) {
    await supabase.storage.from("order-documents").remove([storagePath]);
    throw new Error("PDF kaydı oluşturulamadı.");
  }

  await queueDocumentAnalysis(documentId);
  revalidatePath(`/panel/siparisler/${orderId}`);
}
