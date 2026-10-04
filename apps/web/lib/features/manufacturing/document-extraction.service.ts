import 'server-only';

import { sql } from '@/lib/db';
import { withTransaction } from '@/lib/db/transaction';
import { ManufacturingActor } from './types';

export async function saveExtractionDraft(
  actor: ManufacturingActor,
  input: {
    documentId: string;
    schemaVersion: number;
    extractedData: Record<string, unknown>;
    confidence?: Record<string, unknown>;
  },
) {
  const documents = await sql`
    SELECT id FROM documents
    WHERE tenant_id = ${actor.tenantId} AND id = ${input.documentId}
  `;
  if (!documents[0]) throw new Error('Belge bulunamadı');
  const rows = await sql`
    INSERT INTO document_extractions (
      tenant_id, document_id, status, schema_version, extracted_data, confidence
    ) VALUES (
      ${actor.tenantId}, ${input.documentId}, 'needs_review', ${input.schemaVersion},
      ${JSON.stringify(input.extractedData)}::text::jsonb, ${JSON.stringify(input.confidence || {})}::text::jsonb
    ) RETURNING *
  `;
  return rows[0];
}

export async function reviewExtraction(
  actor: ManufacturingActor,
  extractionId: string,
  decision: 'approved' | 'rejected',
  correctedData?: Record<string, unknown>,
) {
  return withTransaction(async ({ sql: tx }) => {
    const rows = await tx`
      SELECT * FROM document_extractions
      WHERE tenant_id = ${actor.tenantId} AND id = ${extractionId}
      FOR UPDATE
    `;
    if (!rows[0]) throw new Error('Belge çıkarımı bulunamadı');
    if (!['needs_review', 'approved', 'rejected'].includes(rows[0].status)) {
      throw new Error('Belge çıkarımı henüz incelemeye hazır değil');
    }
    const updated = await tx`
      UPDATE document_extractions
      SET status = ${decision},
          extracted_data = ${JSON.stringify(correctedData || rows[0].extracted_data)}::text::jsonb,
          reviewed_by = ${actor.userId}, reviewed_at = now(), updated_at = now()
      WHERE tenant_id = ${actor.tenantId} AND id = ${extractionId}
      RETURNING *
    `;
    return updated[0];
  });
}
