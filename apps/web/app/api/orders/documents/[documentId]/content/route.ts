import { hidesAny, redactedJson } from '@/lib/security/field-access.server';
import { NextResponse } from 'next/server';

import { sql } from '@/lib/db';
import { readFile } from '@/lib/storage';
import {
  AuthenticationError,
  AuthorizationError,
  requirePermission,
  requireTenantContext,
} from '@/lib/auth/serverAuth';
import { isMissingRelationError, tableExists } from '@/lib/db/schema-guard';

type DocumentRecord = {
  id: string;
  fileReference: string;
  fileName: string;
  fileType?: string | null;
};

function toInlineContentDisposition(fileName: string): string {
  const safeFallback = fileName.replace(/[^\w.\-]+/g, '_');
  const encoded = encodeURIComponent(fileName);
  return `inline; filename="${safeFallback}"; filename*=UTF-8''${encoded}`;
}

async function findDocumentForTenant(
  tenantId: string,
  documentId: string,
): Promise<DocumentRecord | null> {
  const baseResult = await sql`
    SELECT d.id, d.file_path as file_reference, d.name as file_name, d.file_type
    FROM documents d
    JOIN orders o ON o.id = d.order_id
    WHERE d.id = ${documentId}
      AND d.tenant_id = ${tenantId}
      AND o.tenant_id = ${tenantId}
    LIMIT 1
  `;
  const baseRows = baseResult as Array<{
    id: string;
    file_reference: string;
    file_name: string;
    file_type?: string | null;
  }>;
  if (baseRows.length > 0) {
    return {
      id: baseRows[0].id,
      fileReference: baseRows[0].file_reference,
      fileName: baseRows[0].file_name,
      fileType: baseRows[0].file_type,
    };
  }

  const hasOrderDocuments = await tableExists('order_documents');
  if (!hasOrderDocuments) {
    return null;
  }

  try {
    const financeResult = await sql`
      SELECT od.id, od.file_url as file_reference, od.file_name, od.mime_type as file_type
      FROM order_documents od
      JOIN orders o ON o.id = od.order_id
      WHERE od.id = ${documentId}
        AND od.tenant_id = ${tenantId}
        AND o.tenant_id = ${tenantId}
      LIMIT 1
    `;
    const financeRows = financeResult as Array<{
      id: string;
      file_reference: string;
      file_name: string;
      file_type?: string | null;
    }>;
    if (financeRows.length === 0) {
      return null;
    }

    return {
      id: financeRows[0].id,
      fileReference: financeRows[0].file_reference,
      fileName: financeRows[0].file_name,
      fileType: financeRows[0].file_type,
    };
  } catch (error) {
    if (isMissingRelationError(error, ['order_documents'])) {
      return null;
    }
    throw error;
  }
}

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  try {
    const context = await requireTenantContext();
    requirePermission(context, 'orders.view');
    if (context.role === 'worker') throw new AuthorizationError('Ticari sipariş belgelerine erişim yetkiniz yok. Teknik fotoğraflar için usta ekranını kullanın.');
    // Commercial documents carry prices: a role that hides prices does not open them either.
    if (await hidesAny(['price'])) throw new AuthorizationError('Ticari sipariş belgeleri rolünüzde gizli.');

    const { documentId } = await params;
    if (!documentId) {
      return redactedJson({ error: 'Belge ID zorunludur' }, { status: 400 });
    }

    const document = await findDocumentForTenant(context.tenantId, documentId);
    if (!document) {
      return redactedJson({ error: 'Belge bulunamadı' }, { status: 404 });
    }

    let content: ReadableStream<Uint8Array>;
    let contentType = document.fileType || 'application/octet-stream';
    let contentLength: string | undefined;
    if (document.fileReference.startsWith('/api/v1/production/files/')) {
      const fileId = document.fileReference.split('/').pop();
      const [file] = await sql`SELECT * FROM production_files WHERE tenant_id=${context.tenantId} AND id=${fileId!}`;
      if (!file) return redactedJson({error: 'Belge bulunamadı'}, {status: 404});
      if (file.file_path) {
        const stored = await readFile(file.file_path);
        content = stored.body; contentType = stored.contentType; contentLength = String(stored.size);
      } else {
        content = new Blob([new Uint8Array(file.body)]).stream();
        contentType = file.mime;
      }
    } else {
      const stored = await readFile(document.fileReference);
      content = stored.body; contentType = stored.contentType; contentLength = String(stored.size);
    }

    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', contentType);
    responseHeaders.set('Content-Disposition', toInlineContentDisposition(document.fileName));
    responseHeaders.set('Cache-Control', 'no-store, max-age=0');
    responseHeaders.set('X-Content-Type-Options', 'nosniff');
    if (contentLength) {
      responseHeaders.set('Content-Length', contentLength);
    }

    return new NextResponse(content, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error: unknown) {
    if (error instanceof AuthenticationError) {
      return redactedJson({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof AuthorizationError) {
      return redactedJson({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Order document content route error:', error);
    return redactedJson({ error: 'Internal server error' }, { status: 500 });
  }
}
