/**
 * @jest-environment node
 *
 * A migration file that no release step applies never reaches production. Every .sql file must be
 * in the deploy path, or listed here with the reason it is not applied.
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('postgres', () => jest.fn());

// eslint-disable-next-line @typescript-eslint/no-require-imports
const schema = require('../../scripts/ensure-backend-schema');

const ROOT = join(__dirname, '..', '..');

/**
 * Not applied on release. Checked against production on 2026-10-14: none of these files' objects
 * exist there except tables that later migrations create. Each one is an open item in docs/ROADMAP.md.
 */
const NOT_APPLIED: Record<string, string> = {
  '0000_cool_stryfe.sql': 'drizzle placeholder; the base schema comes from schema.sql',
  '0002_mighty_hardball.sql': 'drizzle snapshot of tables that schema.sql already creates',
  '001_add_indexes.sql': 'never applied: production lacks these order/user indexes (performance item)',
  '002_audit_logs.sql': 'never applied: production has no audit_logs table (audit consolidation item)',
  '003_enterprise_features.sql': 'never applied: time_entries and automation tables are absent in production',
  '004_add_enterprise_features.sql': 'never applied: sso_states is absent in production (SSO item)',
};

describe('migration coverage', () => {
  const expected: string[] = schema.expectedLedgerEntries();

  it('applies or explicitly skips every core migration file', () => {
    const files = readdirSync(join(ROOT, 'lib/db/migrations')).filter((file) => file.endsWith('.sql'));
    const unaccounted = files.filter((file) => !expected.includes(file) && !(file in NOT_APPLIED));
    expect(unaccounted).toEqual([]);
  });

  it('applies every mobile migration file', () => {
    const files = readdirSync(join(ROOT, 'lib/features/mobile/migrations')).filter((file) => file.endsWith('.sql'));
    expect(files.map((file) => `mobile/${file}`).filter((entry) => !expected.includes(entry))).toEqual([]);
  });

  it('has no stale entries in the skip list or the apply list', () => {
    const files = new Set(readdirSync(join(ROOT, 'lib/db/migrations')));
    expect(Object.keys(NOT_APPLIED).filter((file) => !files.has(file))).toEqual([]);
    expect(expected.filter((entry) => !entry.startsWith('mobile/') && !files.has(entry))).toEqual([]);
  });

  it('lists each entry once', () => {
    expect(new Set(expected).size).toBe(expected.length);
  });
});
