import 'server-only';

import { NextResponse } from 'next/server';
import { successResponse } from '@/lib/shared/api/auth-helpers';
import { redactForRequest } from './field-redaction.server';

export { hidesAny, redactForRequest, requestHiddenFields } from './field-redaction.server';

/** NextResponse.json for data that may carry price, cost, profit or customer contact fields. */
export async function redactedJson<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(await redactForRequest(data), init);
}

/** successResponse for data that may carry hidden kinds of fields. */
export async function redactedSuccess<T>(data: T, message?: string) {
  return successResponse(await redactForRequest(data), message);
}
