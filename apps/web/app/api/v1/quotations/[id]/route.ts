import { recordAuditAfterCommit } from "@/lib/audit/audit-log";
import { WorkOrderApiError } from "@/lib/features/work-orders/security";
import { requireSameOriginJson } from "@/lib/features/manufacturing/http-security";
import { NextRequest } from "next/server";
import {
  getAPIUser,
  successResponse,
  errorResponse,
} from "@/lib/api/auth-helpers";
import { quotationService } from "@/lib/features/quotations/service";
import { CreateQuotationSchema } from "@/lib/features/quotations/types";
import { hasPermission, UserRole, AuthorizationError } from "@/lib/auth/rbac";
import { z, ZodError } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAPIUser(request);
    if (!user || !user.tenantId)
      return errorResponse("Yetkilendirme gereklidir", 401);

    const role = (user.role as UserRole) || "member";
    if (!hasPermission(role, "quotations", "read"))
      return errorResponse("Yetkiniz yok", 403);

    const { id } = await params;
    const quotation = await quotationService.getQuotationById(
      user.tenantId,
      id,
    );
    if (!quotation) return errorResponse("Teklif bulunamadı", 404);

    return successResponse(quotation);
  } catch (error: any) {
    if (error instanceof WorkOrderApiError) return errorResponse(error.message, error.status);
    return errorResponse("Teklif işlemi tamamlanamadı. Lütfen tekrar deneyin.", 500);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    requireSameOriginJson(request, 2000000);
    const user = await getAPIUser(request);
    if (!user || !user.tenantId)
      return errorResponse("Yetkilendirme gereklidir", 401);

    const role = (user.role as UserRole) || "member";
    if (!hasPermission(role, "quotations", "update"))
      return errorResponse("Yetkiniz yok", 403);

    const body = await request.json();

    const { id } = await params;

    const expectedVersion = z
      .number()
      .int()
      .positive()
      .parse(body.expectedVersion);
    if (body.action === "convert") {
      const result = await quotationService.convertToOrder(
        user.tenantId,
        id,
        user.id,
        expectedVersion,
        user.role,
      );
      return successResponse(result, "Teklif siparişe dönüştürüldü");
    }

    if (body.status) {
      const validStatus = z
        .enum(["draft", "sent", "accepted", "rejected", "expired", "converted"])
        .parse(body.status);
      const quotation = await quotationService.updateStatus(
        user.tenantId,
        id,
        validStatus,
        expectedVersion,
        user.id,
        user.role,
      );
      return successResponse(quotation, "Durum güncellendi");
    }

    const parsedData = CreateQuotationSchema.partial().parse(body);
    const quotation = await quotationService.updateQuotation(
      user.tenantId,
      id,
      parsedData,
    );
    await recordAuditAfterCommit({ tenantId: user.tenantId, actorId: user.id, entityType: "quotation", entityId: id, action: "updated", metadata: { fields: Object.keys(body).filter((key) => key !== "expectedVersion") } });
    return successResponse(quotation, "Teklif güncellendi");
  } catch (error: any) {
    if (error instanceof WorkOrderApiError) return errorResponse(error.message, error.status);
    if (error instanceof ZodError)
      return errorResponse(
        "Geçersiz veri: " +
          error.issues.map((issue) => issue.message).join(", "),
        400,
      );
    return errorResponse("Teklif işlemi tamamlanamadı. Lütfen tekrar deneyin.", 500);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAPIUser(request);
    if (!user || !user.tenantId)
      return errorResponse("Yetkilendirme gereklidir", 401);

    const role = (user.role as UserRole) || "member";
    if (!hasPermission(role, "quotations", "delete"))
      return errorResponse("Yetkiniz yok", 403);

    const { id } = await params;
    await quotationService.deleteQuotation(user.tenantId, id);
    await recordAuditAfterCommit({ tenantId: user.tenantId, actorId: user.id, entityType: "quotation", entityId: id, action: "deleted" });
    return successResponse({ success: true }, "Teklif silindi");
  } catch (error: any) {
    if (error instanceof WorkOrderApiError) return errorResponse(error.message, error.status);
    return errorResponse("Teklif işlemi tamamlanamadı. Lütfen tekrar deneyin.", 500);
  }
}
