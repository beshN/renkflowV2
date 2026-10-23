/** @jest-environment node */
jest.mock('server-only', () => ({}));
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/db', () => ({ sql: jest.fn() }));
jest.mock('@/lib/ai/service', () => ({ aiAvailable: jest.fn(() => true), getAIService: jest.fn() }));
jest.mock('@/lib/features/work-orders/security', () => {
  const actual = jest.requireActual('@/lib/features/work-orders/security');
  return { ...actual, requireWorkOrderActor: jest.fn() };
});
jest.mock('@/lib/features/manufacturing/intake.service', () => {
  const actual = jest.requireActual('@/lib/features/manufacturing/intake.service');
  return { ...actual, extractIntake: jest.fn() };
});
jest.mock('@/lib/security/rate-limit', () => ({ consumeRateLimit: jest.fn(), rateLimitHeaders: () => ({ 'Retry-After': '60' }) }));
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/ai/document-extract/route';
import { requireWorkOrderActor, WorkOrderApiError } from '@/lib/features/work-orders/security';
import { extractIntake, requireIntakeAccess } from '@/lib/features/manufacturing/intake.service';
import { effectiveAccess, routeRequirement, meets } from '@/lib/security/access-matrix';
import { consumeRateLimit } from '@/lib/security/rate-limit';
import { aiAvailable } from '@/lib/ai/service';
const actor = { userId: 'user', tenantId: 'firm', role: 'office' as const, access: effectiveAccess('office', null) };
const draftId = 'ed87ebf0-6b7a-4fc1-9821-9d41f731ab45';
const file = { name: 'liste.pdf', mimeType: 'application/pdf', base64: Buffer.from('%PDF-list').toString('base64') };
function request(body: unknown = file, extra: Record<string, string> = {}) {
  return new NextRequest('https://renkflow.example/api/ai/document-extract', { method: 'POST', headers: { 'content-type': 'application/json', ...extra }, body: typeof body === 'string' ? body : JSON.stringify(body) });
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(requireWorkOrderActor).mockResolvedValue(actor);
  jest.mocked(consumeRateLimit).mockResolvedValue({ allowed: true, remaining: 19, retryAfterSeconds: 60 });
  jest.mocked(aiAvailable).mockReturnValue(true);
  jest.mocked(extractIntake).mockResolvedValue({ id: draftId, extracted_data: { items: [{ productName: 'Makaslı' }, { productName: 'Pergola' }] } } as never);
});
it('sends the full source into the shared review workflow instead of mapping modern multi-line output to old flat keys', async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ success: true, draftId, reviewUrl: `/production/intake/${draftId}` });
  expect(extractIntake).toHaveBeenCalledWith(actor, { name: 'liste.pdf', mime: 'application/pdf', base64: file.base64 });
  expect(response.headers.get('cache-control')).toContain('no-store');
});
it('preserves private direct-upload references for documents above the Vercel request limit', async () => {
  await POST(request({ name: 'large.pdf', mimeType: 'application/pdf', blobPath: 'uploads/firm/user/file' }));
  expect(extractIntake).toHaveBeenCalledWith(actor, expect.objectContaining({ blobPath: 'uploads/firm/user/file', base64: undefined }));
});
it.each([401, 403])('does not call storage or AI when fresh membership rejects the request (%i)', async status => {
  jest.mocked(requireWorkOrderActor).mockRejectedValue(new WorkOrderApiError('Oturum gerekli.', status));
  expect((await POST(request())).status).toBe(status);
  expect(extractIntake).not.toHaveBeenCalled();
});
it('refuses a custom office role that cannot create orders on both capability and extraction endpoints', async () => {
  jest.mocked(requireWorkOrderActor).mockResolvedValue({ ...actor, access: effectiveAccess('office', { key: 'read', name: 'Read', permissions: { orders: ['view'] }, hidden: [] }) });
  expect((await GET()).status).toBe(403);
  expect((await POST(request())).status).toBe(403);
  expect(extractIntake).not.toHaveBeenCalled();
});
it('applies the same order-create boundary to extraction, reading and approval at the service and proxy', () => {
  const limited = { ...actor, access: effectiveAccess('office', { key: 'plan', name: 'Plan', permissions: { production: ['view', 'edit'] }, hidden: [] }) };
  expect(() => requireIntakeAccess(limited)).toThrow();
  for (const path of ['/api/v1/production/intake', `/api/v1/production/intake/${draftId}`, `/production/intake/${draftId}`, '/api/ai/document-extract']) {
    const need = routeRequirement(path, 'GET')!;
    expect(need).toEqual({ module: 'orders', action: 'create' });
    expect(meets(limited.access, need)).toBe(false);
    expect(meets(actor.access, need)).toBe(true);
  }
});
it('returns useful 400/415/413 errors before starting a model call', async () => {
  expect((await POST(request('{bad'))).status).toBe(400);
  expect((await POST(request(file, { 'content-type': 'text/plain' }))).status).toBe(415);
  expect((await POST(request(file, { 'content-length': '15000001' }))).status).toBe(413);
  expect(extractIntake).not.toHaveBeenCalled();
});
it('returns 429 with Retry-After and never starts extraction', async () => {
  jest.mocked(consumeRateLimit).mockResolvedValue({ allowed: false, remaining: 0, retryAfterSeconds: 60 });
  const response = await POST(request());
  expect(response.status).toBe(429);
  expect(response.headers.get('retry-after')).toBe('60');
  expect(extractIntake).not.toHaveBeenCalled();
});
it('reports unavailable AI without creating an empty order or silently inventing fields', async () => {
  jest.mocked(aiAvailable).mockReturnValue(false);
  expect(await (await GET()).json()).toEqual({ available: false });
  expect((await POST(request())).status).toBe(503);
  expect(extractIntake).not.toHaveBeenCalled();
});
