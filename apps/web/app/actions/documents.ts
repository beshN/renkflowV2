"use server";

import { revalidatePath } from "next/cache";
import type { FormActionState } from "@/lib/action-state";
import { uploadOrderDocument } from "@/lib/documents/upload";

export async function uploadDocumentAction(_: FormActionState, formData: FormData): Promise<FormActionState> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const orderId = String(formData.get("orderId") ?? "");
  const file = formData.get("file");

  if (!(file instanceof File)) return { error: "PDF dosyası seçilmedi." };
  try {
    const result = await uploadOrderDocument({ organizationId, orderId, file });
    revalidatePath(`/panel/siparisler/${orderId}`);
    if (!result.analysisQueued) return { error: result.warning };
    return { success: "PDF yüklendi ve analiz sırasına alındı." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "PDF yüklenemedi." };
  }
}
