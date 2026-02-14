import { requestJson } from '@/lib/shared/network';

describe('network helpers', () => {
  const originalFetch = global.fetch;
  const mockResponse = (status: number, body: string) =>
    ({
      ok: status >= 200 && status < 300,
      status,
      text: jest.fn().mockResolvedValue(body),
    }) as unknown as Response;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('returns parsed data for successful JSON responses', async () => {
    const payload = { success: true, value: 42 };

    global.fetch = jest.fn().mockResolvedValue(
      mockResponse(200, JSON.stringify(payload)),
    ) as unknown as typeof fetch;

    const result = await requestJson<typeof payload>('/api/test');

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual(payload);
    expect(result.error).toBeNull();
  });

  it('extracts error field from failed JSON responses', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse(400, JSON.stringify({ error: 'Validation failed' })),
    ) as unknown as typeof fetch;

    const result = await requestJson('/api/test');

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toBe('Validation failed');
  });

  it('falls back to message for non-JSON error responses', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse(503, 'Server down'),
    ) as unknown as typeof fetch;

    const result = await requestJson('/api/test');

    expect(result.ok).toBe(false);
    expect(result.status).toBe(503);
    expect(result.error).toBe('Server down');
  });

  it('returns timeout-friendly message for aborted requests', async () => {
    const abortError = new DOMException('The operation was aborted.', 'AbortError');
    global.fetch = jest.fn().mockRejectedValue(abortError) as unknown as typeof fetch;

    const result = await requestJson('/api/test');

    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(result.error).toContain('zaman');
  });
});
