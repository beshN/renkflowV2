jest.mock('@/lib/db', () => ({ sql: jest.fn() }));
import { workerApiAllowed } from '@/lib/security/member-access.server';
it.each(['GET', 'POST'])('allows the exact worker kiosk endpoint for %s', method => {
  expect(workerApiAllowed('/api/v1/production/kiosk', method)).toBe(true);
});
it.each(['PUT', 'PATCH', 'DELETE', 'OPTIONS'])('refuses unsupported kiosk method %s', method => {
  expect(workerApiAllowed('/api/v1/production/kiosk', method)).toBe(false);
});
it.each(['/api/v1/production/kiosk/extra', '/api/v1/production/kiosk-other'])('does not grant a kiosk prefix: %s', path => {
  expect(workerApiAllowed(path, 'GET')).toBe(false);
  expect(workerApiAllowed(path, 'POST')).toBe(false);
});
