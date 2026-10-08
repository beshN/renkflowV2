import 'server-only';

import { applyCountImport, COUNT_IMPORT_KIND, CountImportPayloadSchema, type CountImportPayload } from '@/lib/features/warehouse/count-import/service';
import { registerSuggestionKind } from '../kinds';

/**
 * Stock count list (PDF) import: read with fixed rules, no model. Approval creates the cards,
 * writes opening stock for counted pieces and leaves metre rows for the bar-by-bar count.
 */
registerSuggestionKind<CountImportPayload>({
  kind: COUNT_IMPORT_KIND,
  label: 'Sayım listesi içe aktarma',
  payloadSchema: CountImportPayloadSchema,
  roles: ['owner', 'admin'],
  apply: (tx, actor, payload, suggestion) => applyCountImport(tx, actor, payload, suggestion.id),
});
