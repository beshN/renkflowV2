// Same readiness check as /api/health/ready (environment + database). It used to answer "ready"
// without checking anything, so an uptime monitor on it could not see a database outage.
export { GET } from '../health/ready/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
