jest.mock('@/lib/db', () => ({ sql: jest.fn() }));
import { workerApiAllowed } from '@/lib/security/member-access.server';
it('delegates only the exact GET lot trace to its own 404 guard', () => {
  expect(workerApiAllowed('/api/v1/traceability/lots','GET')).toBe(true);
  for (const method of ['POST','PUT','PATCH','DELETE','OPTIONS','HEAD'])
    expect(workerApiAllowed('/api/v1/traceability/lots',method)).toBe(false);
  for (const path of ['/api/v1/traceability/lots/extra','/api/v1/traceability/lots-other'])
    expect(workerApiAllowed(path,'GET')).toBe(false);
});
