import 'server-only';
import { providerConfig } from './providers';
export function assistantModelInfo(actualModel?: string) {
  const configured = providerConfig('anthropic').model;
  const id = actualModel || configured;
  return { provider: 'anthropic' as const, id, label: id.startsWith('claude-sonnet-5-5') ? 'Claude Sonnet 5.5' : `Claude · ${id}`, verifiedResponse: Boolean(actualModel), configuredId: configured };
}
