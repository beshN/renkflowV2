import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { requireMembership } from "@/lib/auth";
import { queueDocumentAnalysis } from "@/lib/analysis/queue";

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const MAX_PDF_PAGES = 50;

export type DocumentUploadResult = {
  documentId: string;
  analysisQueued: boolean;
  warning?: string;
};

export async function uploadOrderDocument({
  organizationId,
  orderId,
  file,
}: {
  organizationId: string;
  orderId: string;
  file: File;
}): Promise<DocumentUploadResult> {
  const looksLikePdf = file.type === "application/pdf" || file.name.toLocaleLowerCase("tr-TR").endsWith(".pdf");
  if (!looksLikePdf) throw new Error("Yalnızca PDF yüklenebilir.");
  if (file.size <= 0 || file.size > MAX_PDF_BYTES) throw new Error("PDF en fazla 25 MB olabilir.");

  const { supabase, user } = await requireMembership(organizationId, ["owner", "admin", "office"]);
  const { data: order, error: orderError } = await supabase.from("orders").select("id, status")
    .eq("id", orderId).eq("organization_id", organizationId).maybeSingle();
  if (orderError) throw new Error("Sipariş bilgisi kontrol edilemedi.", { cause: orderError });
  if (!order) throw new Error("Sipariş bulunamadı.");
  if (!["draft", "awaiting_review", "approved"].includes(order.status)) {
    throw new Error("Üretime alınmış, teslim edilmiş veya iptal edilmiş siparişe yeni PDF yüklenemez.");
  }

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
  if (uploadError) throw new Error("PDF depoya yüklenemedi.", { cause: uploadError });

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
    throw new Error("PDF kaydı oluşturulamadı.", { cause: insertError });
  }

  try {
    await queueDocumentAnalysis(documentId);
    return { documentId, analysisQueued: true };
  } catch (error) {
    return {
      documentId,
      analysisQueued: false,
      warning: `PDF yüklendi ancak analiz başlatılamadı: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`,
    };
  }
}
