/**
 * @jest-environment node
 *
 * TOTP (RFC 6238) for two-step sign-in, checked against the RFC's own test vectors.
 */
import { base32Decode, base32Encode, generateTotpSecret, otpauthUri, totpAt, verifyTotp } from '@/lib/features/auth/totp';

// RFC 6238 appendix B: SHA-1 key "12345678901234567890", 8 digits.
const RFC_KEY = Buffer.from('12345678901234567890', 'ascii');
const RFC_VECTORS: Array<[number, string]> = [
  [59, '94287082'],
  [1111111109, '07081804'],
  [1111111111, '14050471'],
  [1234567890, '89005924'],
  [2000000000, '69279037'],
  [20000000000, '65353130'],
];

describe('totp', () => {
  it.each(RFC_VECTORS)('matches RFC 6238 at t=%i', (seconds, expected) => {
    expect(totpAt(RFC_KEY, Math.floor(seconds / 30), 8)).toBe(expected);
  });

  it('uses the last 6 digits for the default code length', () => {
    expect(totpAt(RFC_KEY, Math.floor(59 / 30))).toBe('287082');
  });

  it('round-trips base32 (RFC 4648, no padding)', () => {
    expect(base32Encode(Buffer.from('foobar'))).toBe('MZXW6YTBOI');
    expect(base32Decode('mzxw6ytboi')).toEqual(Buffer.from('foobar'));
    expect(base32Decode('MZXW 6YTB OI======')).toEqual(Buffer.from('foobar'));
    const secret = generateTotpSecret();
    expect(base32Decode(secret)).toHaveLength(20);
  });

  it('accepts the current step and one step of clock drift, and reports the step', () => {
    const secret = generateTotpSecret();
    const key = base32Decode(secret);
    const now = 1_800_000_000_000;
    const step = Math.floor(now / 1000 / 30);
    expect(verifyTotp(secret, totpAt(key, step), now)).toBe(step);
    expect(verifyTotp(secret, totpAt(key, step - 1), now)).toBe(step - 1);
    expect(verifyTotp(secret, totpAt(key, step + 1), now)).toBe(step + 1);
    expect(verifyTotp(secret, totpAt(key, step - 2), now)).toBeNull();
  });

  it('refuses a step at or before the last one used (replay)', () => {
    const secret = generateTotpSecret();
    const key = base32Decode(secret);
    const now = 1_800_000_000_000;
    const step = Math.floor(now / 1000 / 30);
    expect(verifyTotp(secret, totpAt(key, step), now, step)).toBeNull();
    expect(verifyTotp(secret, totpAt(key, step), now, step - 1)).toBe(step);
  });

  it('ignores spaces and refuses malformed codes', () => {
    const secret = generateTotpSecret();
    const now = 1_800_000_000_000;
    const code = totpAt(base32Decode(secret), Math.floor(now / 1000 / 30));
    expect(verifyTotp(secret, `${code.slice(0, 3)} ${code.slice(3)}`, now)).not.toBeNull();
    expect(verifyTotp(secret, '12345', now)).toBeNull();
    expect(verifyTotp(secret, 'abcdef', now)).toBeNull();
  });

  it('builds an otpauth URI for authenticator apps', () => {
    const uri = otpauthUri('JBSWY3DPEHPK3PXP', 'ali@renk.com', 'RenkFlow');
    expect(uri).toBe('otpauth://totp/RenkFlow:ali%40renk.com?secret=JBSWY3DPEHPK3PXP&issuer=RenkFlow&algorithm=SHA1&digits=6&period=30');
  });
});
