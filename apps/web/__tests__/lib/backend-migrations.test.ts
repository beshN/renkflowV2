import fs from 'node:fs';
import path from 'node:path';
import { ensureBackendSchema } from '../../scripts/ensure-backend-schema';

jest.mock('postgres', () => jest.fn());

describe('backend migration execution', () => {
  it('sends native manufacturing and ERP migrations intact to PostgreSQL', async () => {
    const unsafe = jest.fn().mockResolvedValue([]);
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await ensureBackendSchema({ unsafe });
      const queries = unsafe.mock.calls.map(([query]) => query as string);
      for (const file of ['012_native_manufacturing.sql', '013_erp_core.sql']) {
        const raw = fs.readFileSync(path.join(process.cwd(), 'lib/db/migrations', file), 'utf8');
        expect(raw).toContain('DO $$');
        expect(queries.filter((query) => query === raw)).toHaveLength(1);
      }
      expect(queries).not.toContain('END $$');
    } finally {
      log.mockRestore();
    }
  });

  it('stops before the next migration when PostgreSQL rejects a file', async () => {
    const unsafe = jest.fn(async (query: string) => {
      if (query.includes('RenkFlow native inventory')) throw new Error('migration rejected');
      return [];
    });
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await expect(ensureBackendSchema({ unsafe })).rejects.toThrow('migration rejected');
      expect(unsafe.mock.calls.some(([query]) => query.includes('RenkFlow ERP Core'))).toBe(false);
    } finally {
      log.mockRestore();
    }
  });
});
