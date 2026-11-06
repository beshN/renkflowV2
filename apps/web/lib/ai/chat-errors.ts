/** Public chat errors contain no provider response, request ID, or credentials. */
export const AI_CREDIT_MESSAGE = 'AI hizmetinin kullanım kredisi tükendiği için şu anda yanıt veremiyoruz. Lütfen yöneticinize bildirin. Sipariş, stok ve diğer uygulama ekranlarını AI kullanmadan kullanmaya devam edebilirsiniz.';
export const AI_CHAT_UNAVAILABLE_MESSAGE = 'Asistan şu anda yanıt veremiyor. Uygulama ekranlarını AI kullanmadan kullanmaya devam edebilirsiniz.';

export class ChatRequestError extends Error {
  constructor(body: { error?: unknown; code?: unknown } | null) {
    super(body?.code === 'ai_insufficient_credit' ? AI_CREDIT_MESSAGE :
      typeof body?.error === 'string' ? body.error : AI_CHAT_UNAVAILABLE_MESSAGE);
  }
}

export function chatErrorMessage(error: unknown): string {
  return error instanceof ChatRequestError ? error.message : AI_CHAT_UNAVAILABLE_MESSAGE;
}

/** SDK errors may wrap the provider's message inside error/error or cause. */
export function isInsufficientCreditError(error: unknown, depth = 0): boolean {
  if (depth > 4 || !error || typeof error !== 'object') return false;
  const value = error as { message?: unknown; error?: unknown; cause?: unknown; code?: unknown };
  return (typeof value.message === 'string' && /insufficient[ _-]*(balance|credit|quota)|credit balance.*too low|billing.*(balance|credit)|kredi.*yetersiz/i.test(value.message)) ||
    value.code === 'insufficient_quota' ||
    isInsufficientCreditError(value.error, depth + 1) ||
    isInsufficientCreditError(value.cause, depth + 1);
}
