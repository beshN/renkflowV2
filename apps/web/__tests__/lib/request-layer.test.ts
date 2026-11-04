/** @jest-environment jsdom */
import { renderHook, waitFor } from '@testing-library/react';
import {
  cachedRequest,
  extractHttpStatus,
  isRetryableError,
  requestCache,
  useCachedQuery,
} from '@/lib/shared/api/request-layer';

describe('request-layer retry behavior', () => {
  beforeEach(() => {
    requestCache.invalidateAll();
    jest.clearAllMocks();
  });

  describe('extractHttpStatus', () => {
    it('extracts status number from status, statusCode, response.status, or cause', () => {
      expect(extractHttpStatus({ status: 403 })).toBe(403);
      expect(extractHttpStatus({ statusCode: 401 })).toBe(401);
      expect(extractHttpStatus({ response: { status: 422 } })).toBe(422);
      expect(extractHttpStatus({ cause: { status: 502 } })).toBe(502);
      expect(extractHttpStatus(new Error('no status'))).toBeNull();
      expect(extractHttpStatus(null)).toBeNull();
    });

    it('parses string status codes', () => {
      expect(extractHttpStatus({ status: '404' })).toBe(404);
      expect(extractHttpStatus({ statusCode: '500' })).toBe(500);
    });
  });

  describe('isRetryableError', () => {
    it('never retries 4xx client errors (400, 401, 403, 404, 409, 422)', () => {
      expect(isRetryableError({ status: 400 })).toBe(false);
      expect(isRetryableError({ status: 401 })).toBe(false);
      expect(isRetryableError({ status: 403 })).toBe(false);
      expect(isRetryableError({ status: 404 })).toBe(false);
      expect(isRetryableError({ status: 409 })).toBe(false);
      expect(isRetryableError({ status: 422 })).toBe(false);
      expect(isRetryableError({ statusCode: 403 })).toBe(false);
      expect(isRetryableError({ response: { status: 403 } })).toBe(false);
    });

    it('never retries auth or validation messages and error codes', () => {
      expect(isRetryableError(new Error('Bu işlem için yetkiniz bulunmuyor'))).toBe(false);
      expect(isRetryableError(new Error('Unauthorized access'))).toBe(false);
      expect(isRetryableError(new Error('Forbidden: access denied'))).toBe(false);
      expect(isRetryableError({ code: 'UNAUTHORIZED' })).toBe(false);
      expect(isRetryableError({ code: 'FORBIDDEN' })).toBe(false);
      expect(isRetryableError({ code: 403 })).toBe(false);
    });

    it('retries network errors', () => {
      expect(isRetryableError(new TypeError('Failed to fetch'))).toBe(true);
      expect(isRetryableError(new TypeError('fetch failed'))).toBe(true);
      expect(isRetryableError(new Error('Ağ hatası oluştu'))).toBe(true);
      expect(isRetryableError(new Error('Network error occurred'))).toBe(true);
      expect(isRetryableError({ code: 'ECONNRESET' })).toBe(true);
      expect(isRetryableError({ code: 'ECONNREFUSED' })).toBe(true);
      expect(isRetryableError({ code: 'ENOTFOUND' })).toBe(true);
      expect(isRetryableError({ status: 0 })).toBe(true);
    });

    it('retries timeout and aborted request errors', () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      expect(isRetryableError(abortError)).toBe(true);

      const timeoutError = new Error('Operation timed out');
      timeoutError.name = 'TimeoutError';
      expect(isRetryableError(timeoutError)).toBe(true);

      expect(isRetryableError(new Error('İstek zaman aşımına uğradı'))).toBe(true);
      expect(isRetryableError(new Error('Request timeout after 20000ms'))).toBe(true);
      expect(isRetryableError({ code: 'ETIMEDOUT' })).toBe(true);
      expect(isRetryableError({ code: 'UND_ERR_CONNECT_TIMEOUT' })).toBe(true);
    });

    it('retries 5xx server errors', () => {
      expect(isRetryableError({ status: 500 })).toBe(true);
      expect(isRetryableError({ status: 502 })).toBe(true);
      expect(isRetryableError({ status: 503 })).toBe(true);
      expect(isRetryableError({ status: 504 })).toBe(true);
    });

    it('does not retry unknown generic errors', () => {
      expect(isRetryableError(new Error('Unknown application bug'))).toBe(false);
      expect(isRetryableError(null)).toBe(false);
      expect(isRetryableError(undefined)).toBe(false);
    });
  });

  describe('cachedRequest retry logic', () => {
    it('does NOT retry on 403 error (executes fetcher only once)', async () => {
      const forbiddenError = Object.assign(new Error('Bu işlem için yetkiniz yok'), { status: 403 });
      const fetcher = jest.fn().mockRejectedValue(forbiddenError);

      await expect(
        cachedRequest('test:403:once', fetcher, { retryDelay: 0 })
      ).rejects.toThrow('Bu işlem için yetkiniz yok');

      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('does NOT retry on 401 error', async () => {
      const unauthorizedError = Object.assign(new Error('Unauthorized'), { status: 401 });
      const fetcher = jest.fn().mockRejectedValue(unauthorizedError);

      await expect(
        cachedRequest('test:401:once', fetcher, { retryDelay: 0 })
      ).rejects.toThrow('Unauthorized');

      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('does NOT retry on 400, 409, or 422 validation errors', async () => {
      for (const status of [400, 409, 422]) {
        const error = Object.assign(new Error(`Validation error ${status}`), { status });
        const fetcher = jest.fn().mockRejectedValue(error);

        await expect(
          cachedRequest(`test:${status}:once`, fetcher, { retryDelay: 0 })
        ).rejects.toThrow(`Validation error ${status}`);

        expect(fetcher).toHaveBeenCalledTimes(1);
      }
    });

    it('respects retry: 0 even for network errors', async () => {
      const networkError = new TypeError('Failed to fetch');
      const fetcher = jest.fn().mockRejectedValue(networkError);

      await expect(
        cachedRequest('test:network:retry-zero', fetcher, { retry: 0, retryDelay: 0 })
      ).rejects.toThrow('Failed to fetch');

      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('allows configuring retry count (e.g. retry: 2 retries twice)', async () => {
      const networkError = new TypeError('Failed to fetch');
      const fetcher = jest
        .fn()
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce('third-time-charm');

      const result = await cachedRequest('test:network:retry-two', fetcher, {
        retry: 2,
        retryDelay: 0,
      });

      expect(result).toBe('third-time-charm');
      expect(fetcher).toHaveBeenCalledTimes(3);
    });

    it('retries exactly 1 time on network error by default and succeeds if retry works', async () => {
      const networkError = new TypeError('Failed to fetch');
      const fetcher = jest
        .fn()
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce({ success: true, orders: ['order-1'] });

      const result = await cachedRequest('test:network:retry-success', fetcher, { retryDelay: 0 });

      expect(result).toEqual({ success: true, orders: ['order-1'] });
      // 1 initial attempt + 1 retry = 2 total executions
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('retries exactly 1 time on persistent network error and fails after 1 retry', async () => {
      const networkError = new TypeError('Failed to fetch');
      const fetcher = jest.fn().mockRejectedValue(networkError);

      await expect(
        cachedRequest('test:network:fail-after-retry', fetcher, { retryDelay: 0 })
      ).rejects.toThrow('Failed to fetch');

      // 1 initial attempt + 1 retry = 2 total executions (default retry = 1)
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('retries 5xx server errors exactly 1 time by default', async () => {
      const serverError = Object.assign(new Error('Internal Server Error'), { status: 500 });
      const fetcher = jest
        .fn()
        .mockRejectedValueOnce(serverError)
        .mockResolvedValueOnce({ ok: true });

      const result = await cachedRequest('test:500:retry-success', fetcher, { retryDelay: 0 });

      expect(result).toEqual({ ok: true });
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('allows overriding shouldRetry custom predicate', async () => {
      const customError = new Error('Custom error');
      const fetcher = jest
        .fn()
        .mockRejectedValueOnce(customError)
        .mockResolvedValueOnce('recovered');

      const result = await cachedRequest('test:custom:predicate', fetcher, {
        retryDelay: 0,
        shouldRetry: (err) => err === customError,
      });

      expect(result).toBe('recovered');
      expect(fetcher).toHaveBeenCalledTimes(2);
    });
  });

  describe('useCachedQuery hook retry integration', () => {
    it('does not retry 403 errors and reports error immediately', async () => {
      const forbiddenError = Object.assign(new Error('Bu işlem için yetkiniz bulunmuyor'), { status: 403 });
      const fetcher = jest.fn().mockRejectedValue(forbiddenError);
      const onError = jest.fn();

      const { result } = renderHook(() =>
        useCachedQuery('test:hook:403', fetcher, {
          retryDelay: 0,
          onError,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeTruthy();
      });

      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(result.current.error?.message).toBe('Bu işlem için yetkiniz bulunmuyor');
    });

    it('retries network error once and recovers when 2nd attempt succeeds', async () => {
      const fetcher = jest
        .fn()
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce([{ id: 'order-100', status: 'approved' }]);

      const { result } = renderHook(() =>
        useCachedQuery('test:hook:network-retry', fetcher, {
          retryDelay: 0,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.data).toEqual([{ id: 'order-100', status: 'approved' }]);
      });

      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(result.current.error).toBeNull();
    });
  });
});
