import { isSameOriginRequest } from '@/lib/security/request-origin';
import "server-only";
import type { NextRequest } from "next/server";
import { WorkOrderApiError } from "../work-orders/security";
import { requireJsonBody } from '@/lib/security/request-body.server';

export function requireSameOriginJson(
  request: NextRequest,
  maximumBytes = 2_000_000,
) {
  requireSameOrigin(request);
  requireJsonBody(request, maximumBytes);
}

export function requireSameOrigin(request: NextRequest) {
  if (!isSameOriginRequest(request))
    throw new WorkOrderApiError("Bu kaynaktan yazma isteği kabul edilmez", 403);
}
