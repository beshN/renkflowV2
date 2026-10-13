/**
 * @jest-environment node
 *
 * Password reset tokens are stored only as a SHA-256 hash. A route that also compares the column
 * with the raw token would let a leaked database row be used as a working reset link.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

import { generateResetToken, hashResetToken } from '@/lib/features/auth/reset-token';

const API = join(__dirname, '..', '..', 'app', 'api', 'auth');
const ROUTES = ['forgot-password', 'reset-password', 'verify-reset-token'];

describe('password reset token', () => {
  it('hashes with SHA-256 hex', async () => {
    const token = 'a'.repeat(64);
    await expect(hashResetToken(token)).resolves.toBe(createHash('sha256').update(token).digest('hex'));
  });

  it('generates 32 random bytes as hex', () => {
    const a = generateResetToken();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(generateResetToken()).not.toBe(a);
  });

  it.each(ROUTES)('%s uses the shared helper and never matches the raw token', (route) => {
    const source = readFileSync(join(API, route, 'route.ts'), 'utf8');
    expect(source).toMatch(/hashResetToken/);
    expect(source).not.toMatch(/async function hashToken/);
    expect(source).not.toMatch(/password_reset_token\s*=\s*\$\{token\}/);
  });
});
