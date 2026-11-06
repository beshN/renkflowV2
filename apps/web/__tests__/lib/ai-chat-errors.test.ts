import { AI_CREDIT_MESSAGE, AI_CHAT_UNAVAILABLE_MESSAGE, ChatRequestError, chatErrorMessage, isInsufficientCreditError } from '@/lib/ai/chat-errors';

test.each([
  new Error('Your credit balance is too low to access the Anthropic API. private-key'),
  new Error('insufficient balance'),
  { error: { type: 'invalid_request_error', message: 'Insufficient credits' } },
  { cause: { error: { message: 'insufficient_balance' } } },
  { code: 'insufficient_quota' },
])('recognizes provider credit exhaustion without exposing it', (error) => {
  expect(isInsufficientCreditError(error)).toBe(true);
  expect(chatErrorMessage(new ChatRequestError({ code: 'ai_insufficient_credit', error: String(error) }))).toBe(AI_CREDIT_MESSAGE);
});
test.each([null, new Error('timeout'), { status: 400 }, 'bad request'])('does not misclassify unrelated failures', (error) => {
  expect(isInsufficientCreditError(error)).toBe(false);
});
test('cyclic provider error terminates safely', () => {
  const error: { cause?: unknown } = {}; error.cause = error;
  expect(isInsufficientCreditError(error)).toBe(false);
});
test('unexpected client errors never become chat content', () => {
  expect(chatErrorMessage(new Error('private provider payload'))).toBe(AI_CHAT_UNAVAILABLE_MESSAGE);
  expect(chatErrorMessage(new ChatRequestError(null))).toBe(AI_CHAT_UNAVAILABLE_MESSAGE);
});
