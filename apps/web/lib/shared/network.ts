export const DEFAULT_REQUEST_TIMEOUT_MS = 20000;

export type RequestJsonResult<T = unknown> = {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
};

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const externalSignal = init.signal;

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason);
    } else {
      externalSignal.addEventListener('abort', () => controller.abort(externalSignal.reason), { once: true });
    }
  }

  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function readResponseBody(response: Response): Promise<unknown | null> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function getErrorFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;

  const candidate = payload as Record<string, unknown>;
  if (typeof candidate.error === 'string' && candidate.error.trim()) return candidate.error;
  if (typeof candidate.message === 'string' && candidate.message.trim()) return candidate.message;

  return null;
}

export async function requestJson<T = unknown>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: {
    timeoutMs?: number;
    fallbackError?: string;
  } = {},
): Promise<RequestJsonResult<T>> {
  try {
    const response = await fetchWithTimeout(input, init, options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS);
    const payload = (await readResponseBody(response)) as T | null;

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        data: payload,
        error:
          getErrorFromPayload(payload) ||
          options.fallbackError ||
          `Istek basarisiz oldu (${response.status})`,
      };
    }

    return {
      ok: true,
      status: response.status,
      data: payload,
      error: null,
    };
  } catch (error) {
    const timeout = error instanceof DOMException && error.name === 'AbortError';

    return {
      ok: false,
      status: 0,
      data: null,
      error: timeout
        ? 'Istek zaman asimina ugradi. Lutfen tekrar deneyin.'
        : options.fallbackError || 'Ag hatasi olustu. Baglantinizi kontrol edip tekrar deneyin.',
    };
  }
}
