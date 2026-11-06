/** @jest-environment node */
import { workerApiAllowed } from '@/lib/security/member-access.server';
jest.mock('@/lib/db', () => ({ sql: jest.fn() }));

it('allows only GET on the exact firm fun-policy path for workers', () => {
  expect(workerApiAllowed('/api/tenant/fun-features', 'GET')).toBe(true);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) {
    expect(workerApiAllowed('/api/tenant/fun-features', method)).toBe(false);
  }
  for (const path of ['/api/tenant/fun-features/', '/api/tenant/fun-features/other', '/api/tenant/fun-features-other', '/api/tenant/update']) {
    expect(workerApiAllowed(path, 'GET')).toBe(false);
  }
});
