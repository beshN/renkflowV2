/**
 * @jest-environment node
 *
 * withTransaction / withRetry — the transaction shell every reservation and production command
 * runs inside. The postgres.js client is replaced with a fake whose `begin` marks commit or
 * rollback exactly the way the real driver does (rollback when the callback throws).
 *
 * Proven invariants:
 *  - the requested isolation level is issued before the callback runs (reservations ask SERIALIZABLE),
 *  - a callback that throws signals a rollback to the driver and the original error reaches the caller,
 *  - an unsupported isolation level is refused before any connection work,
 *  - a hung transaction is rejected by the timeout,
 *  - withRetry retries only serialization failures (40001) and gives up after maxRetries.
 */
jest.mock('@/lib/db', () => ({ getSql: jest.fn() }));

import { getSql } from '@/lib/db';
import { withRetry, withTransaction } from '@/lib/db/transaction';

type FakeResult = { committed: boolean; rolledBack: boolean; unsafeCalls: string[]; transactions: number };

function fakeSql(result: FakeResult) {
  return {
    begin: jest.fn(async (callback: (tx: any) => Promise<any>) => {
      const unsafeCalls: string[] = [];
      const tx: any = (strings: TemplateStringsArray, ...values: unknown[]) => {
        unsafeCalls.push(strings.join('?'));
        return Promise.resolve([]);
      };
      tx.unsafe = (query: string) => {
        unsafeCalls.push(query);
        return Promise.resolve([]);
      };
      try {
        const value = await callback(tx);
        result.committed = true;
        result.unsafeCalls.push(...unsafeCalls);
        result.transactions += 1;
        return value;
      } catch (error) {
        result.rolledBack = true;
        throw error;
      }
    }),
  };
}

let result: FakeResult;
beforeEach(() => {
  result = { committed: false, rolledBack: false, unsafeCalls: [], transactions: 0 };
  (getSql as jest.Mock).mockReturnValue(fakeSql(result));
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

it('issues the requested isolation level inside the transaction and commits the result', async () => {
  const value = await withTransaction(async ({ sql }) => {
    await sql`SELECT 1`;
    return 'rezerve';
  }, { isolationLevel: 'SERIALIZABLE' });

  expect(value).toBe('rezerve');
  expect(result.committed).toBe(true);
  expect(result.rolledBack).toBe(false);
  expect(result.unsafeCalls[0]).toBe('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
});

it('defaults to READ COMMITTED when nothing is requested', async () => {
  await withTransaction(async () => 'ok');
  expect(result.unsafeCalls[0]).toBe('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
});

it('refuses an unsupported isolation level before opening a transaction', async () => {
  await expect(withTransaction(async () => 'never', { isolationLevel: 'DIRTY' as any })).rejects.toThrow('Unsupported isolation level');
  expect((getSql as jest.Mock)().begin).not.toHaveBeenCalled();
});

it('rolls the whole callback back to the driver when one statement fails (reservation abort)', async () => {
  const writes: string[] = [];
  const error = await withTransaction(async ({ sql }) => {
    await sql`INSERT INTO stock_reservations (tenant_id) VALUES (${'t'})`;
    writes.push('header');
    throw new Error('Yetersiz kullanılabilir stok: item-1 için 6, mevcut 4');
  }).catch((e) => e);

  expect(error).toBeInstanceOf(Error);
  expect(error.message).toContain('Yetersiz kullanılabilir stok');
  // The driver saw a failed callback: nothing written inside it can reach the database.
  expect(result.rolledBack).toBe(true);
  expect(result.committed).toBe(false);
  expect(result.transactions).toBe(0);
  expect(writes).toEqual(['header']); // in-memory only; no commit followed
});

it('turns the rollback sentinel into a clear error while keeping other errors untouched', async () => {
  await expect(
    withTransaction(async ({ rollback }) => {
      rollback();
      return 'not reached';
    }),
  ).rejects.toThrow('Transaction was rolled back');
  expect(result.rolledBack).toBe(true);

  const original = new Error('Üretim emri bulunamadı');
  await expect(withTransaction(async () => { throw original; })).rejects.toBe(original);
});

it('rejects a transaction that outlives its timeout', async () => {
  await expect(withTransaction(() => new Promise(() => {}), { timeout: 5 })).rejects.toThrow('Transaction timeout after 5ms');
  expect(result.rolledBack).toBe(true);
});

it('rejects transaction use in the browser', async () => {
  const originalWindow = (globalThis as any).window;
  (globalThis as any).window = {};
  try {
    await expect(withTransaction(async () => 'never')).rejects.toThrow('cannot be used in the browser');
  } finally {
    if (originalWindow === undefined) delete (globalThis as any).window;
    else (globalThis as any).window = originalWindow;
  }
});

describe('withRetry', () => {
  it('retries a serialization failure and returns the first success', async () => {
    let calls = 0;
    const value = await withRetry(async () => {
      calls += 1;
      if (calls < 3) throw Object.assign(new Error('could not serialize access due to concurrent update'), { code: '40001' });
      return 'reserved';
    }, { retryDelay: 1 });

    expect(value).toBe('reserved');
    expect(calls).toBe(3);
  });

  it('retries by error code 40001 alone', async () => {
    let calls = 0;
    await withRetry(async () => {
      calls += 1;
      if (calls === 1) throw Object.assign(new Error('serialization failure'), { code: '40001' });
      return 'ok';
    }, { retryDelay: 1 });
    expect(calls).toBe(2);
  });

  it('does not retry ordinary business errors — they are not transient', async () => {
    let calls = 0;
    await expect(
      withRetry(async () => {
        calls += 1;
        throw new Error('Yetersiz kullanılabilir stok');
      }, { retryDelay: 1 }),
    ).rejects.toThrow('Yetersiz kullanılabilir stok');
    expect(calls).toBe(1);
  });

  it('gives up after maxRetries and rethrows the last serialization failure', async () => {
    let calls = 0;
    await expect(
      withRetry(async () => {
        calls += 1;
        throw Object.assign(new Error('could not serialize'), { code: '40001' });
      }, { maxRetries: 2, retryDelay: 1 }),
    ).rejects.toThrow('could not serialize');
    expect(calls).toBe(2);
  });
});
