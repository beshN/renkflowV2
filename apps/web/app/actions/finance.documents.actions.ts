'use server';

import { resolveUploadedFile, verifiedFileKey } from '@/lib/storage/upload-reference';
import type { UploadedFileReference } from '@/lib/storage/client';
import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { uploadFile, deleteFile, generateFilePath, getFileUrl } from '@/lib/storage';
import {
  getServerUserContext,
  requirePermission,
} from '@/lib/auth/serverAuth';
import {
  OrderDocument,
  OrderDocumentType,
  OrderDocumentTypeSchema,
} from '@/lib/types/finance';
import { isMissingRelationError, tableExists } from '@/lib/db/schema-guard';

async function resolveDocumentUrl(fileReference: string | null | undefined): Promise<string> {
  if (!fileReference) return '';
  if (fileReference.startsWith('/api/')) return fileReference;
  if (/^https?:\/\//i.test(fileReference)) return fileReference;

  try {
    return await getFileUrl(fileReference);
  } catch {
    return fileReference;
  }
}

function mapLegacyDocumentRow(row: any): Omit<OrderDocument, 'fileUrl'> & { fileUrlRaw: string } {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    orderId: row.order_id,
    type: 'other',
    fileName: row.name,
    fileUrlRaw: row.file_path,
    mimeType: row.file_type,
    sizeBytes: row.size,
    uploadedBy: row.uploaded_by,
    uploadedAt: row.created_at,
  };
}

/**
 * Upload a document for an order
 */
export async function uploadOrderDocument(
  orderId: string,
  type: OrderDocumentType,
  rawFile: File | UploadedFileReference
): Promise<OrderDocument> {
  const context = await getServerUserContext();
  requirePermission(context, 'finance.documents.upload');
  const file = rawFile instanceof File ? rawFile : await resolveUploadedFile(context, rawFile);

  // Validate type
  OrderDocumentTypeSchema.parse(type);

  // Verify order belongs to tenant
  const orderCheckResult = await sql`
    SELECT id, tenant_id FROM orders 
    WHERE id = ${orderId} AND tenant_id = ${context.tenantId}
    LIMIT 1
  `;
  const orderCheck = orderCheckResult as any[];

  if (orderCheck.length === 0) {
    throw new Error('Sipariş bulunamadı');
  }

  // Upload file to GCS
  const key = verifiedFileKey(file) || generateFilePath(orderId, `${type}-${file.name}`);
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  if (!verifiedFileKey(file)) await uploadFile(key, buffer, file.type);

  const hasOrderDocuments = await tableExists('order_documents');
  const result = hasOrderDocuments
    ? await sql`
        INSERT INTO order_documents (
          tenant_id, order_id, type, file_name, file_url, mime_type, size_bytes, uploaded_by
        ) VALUES (
          ${context.tenantId},
          ${orderId},
          ${type},
          ${file.name},
          ${key},
          ${file.type},
          ${file.size},
          ${context.userId}
        )
        RETURNING *
      `
    : await sql`
        INSERT INTO documents (
          tenant_id, order_id, name, file_path, file_type, size, uploaded_by
        ) VALUES (
          ${context.tenantId},
          ${orderId},
          ${file.name},
          ${key},
          ${file.type},
          ${file.size},
          ${context.userId}
        )
        RETURNING *
      `;

  revalidatePath('/finance');
  revalidatePath('/finance/documents');
  revalidatePath(`/orders/${orderId}`);

  const rows = result as any[];
  const row = rows[0];
  const signedUrl = await resolveDocumentUrl(hasOrderDocuments ? row.file_url : row.file_path);

  return {
    id: row.id,
    tenantId: row.tenant_id,
    orderId: row.order_id,
    type: hasOrderDocuments ? row.type : type,
    fileName: hasOrderDocuments ? row.file_name : row.name,
    fileUrl: signedUrl,
    mimeType: hasOrderDocuments ? row.mime_type : row.file_type,
    sizeBytes: hasOrderDocuments ? row.size_bytes : row.size,
    uploadedBy: row.uploaded_by,
    uploadedAt: hasOrderDocuments ? row.uploaded_at : row.created_at,
  };
}

/**
 * List all documents for a specific order
 */
export async function listOrderDocuments(orderId: string): Promise<OrderDocument[]> {
  const context = await getServerUserContext();
  requirePermission(context, 'finance.documents.view');
  const hasOrderDocuments = await tableExists('order_documents');

  try {
    const result = hasOrderDocuments
      ? await sql`
          SELECT od.* 
          FROM order_documents od
          JOIN orders o ON od.order_id = o.id AND o.tenant_id = od.tenant_id
          WHERE od.order_id = ${orderId} 
          AND od.tenant_id = ${context.tenantId}
          ORDER BY od.uploaded_at DESC
        `
      : await sql`
          SELECT d.*
          FROM documents d
          JOIN orders o ON d.order_id = o.id AND o.tenant_id = d.tenant_id
          WHERE d.order_id = ${orderId}
          AND d.tenant_id = ${context.tenantId}
          ORDER BY d.created_at DESC
        `;
    const rows = result as any[];

    return Promise.all(rows.map(async (row: any) => {
      if (hasOrderDocuments) {
        const signedUrl = await resolveDocumentUrl(row.file_url);
        return {
          id: row.id,
          tenantId: row.tenant_id,
          orderId: row.order_id,
          type: row.type,
          fileName: row.file_name,
          fileUrl: signedUrl,
          mimeType: row.mime_type,
          sizeBytes: row.size_bytes,
          uploadedBy: row.uploaded_by,
          uploadedAt: row.uploaded_at,
        } as OrderDocument;
      }

      const legacy = mapLegacyDocumentRow(row);
      return {
        id: legacy.id,
        tenantId: legacy.tenantId,
        orderId: legacy.orderId,
        type: legacy.type,
        fileName: legacy.fileName,
        fileUrl: await resolveDocumentUrl(legacy.fileUrlRaw),
        mimeType: legacy.mimeType,
        sizeBytes: legacy.sizeBytes,
        uploadedBy: legacy.uploadedBy,
        uploadedAt: legacy.uploadedAt,
      } as OrderDocument;
    }));
  } catch (error) {
    if (isMissingRelationError(error, ['order_documents', 'documents'])) {
      return [];
    }
    throw error;
  }
}

/**
 * List all documents for tenant with optional filtering
 */
export async function listAllDocuments(options?: {
  type?: OrderDocumentType;
  orderId?: string;
  limit?: number;
}): Promise<(OrderDocument & { orderNumber?: string; customerName?: string })[]> {
  const context = await getServerUserContext();
  requirePermission(context, 'finance.documents.view');
  const hasOrderDocuments = await tableExists('order_documents');

  try {
    let query;
    
    if (hasOrderDocuments) {
      if (options?.type && options?.orderId) {
        query = sql`
          SELECT od.*, o.order_number, o.customer_name
          FROM order_documents od
          JOIN orders o ON od.order_id = o.id AND o.tenant_id = od.tenant_id
          WHERE od.tenant_id = ${context.tenantId}
          AND od.type = ${options.type}
          AND od.order_id = ${options.orderId}
          ORDER BY od.uploaded_at DESC
          LIMIT ${options?.limit || 100}
        `;
      } else if (options?.type) {
        query = sql`
          SELECT od.*, o.order_number, o.customer_name
          FROM order_documents od
          JOIN orders o ON od.order_id = o.id AND o.tenant_id = od.tenant_id
          WHERE od.tenant_id = ${context.tenantId}
          AND od.type = ${options.type}
          ORDER BY od.uploaded_at DESC
          LIMIT ${options?.limit || 100}
        `;
      } else if (options?.orderId) {
        query = sql`
          SELECT od.*, o.order_number, o.customer_name
          FROM order_documents od
          JOIN orders o ON od.order_id = o.id AND o.tenant_id = od.tenant_id
          WHERE od.tenant_id = ${context.tenantId}
          AND od.order_id = ${options.orderId}
          ORDER BY od.uploaded_at DESC
          LIMIT ${options?.limit || 100}
        `;
      } else {
        query = sql`
          SELECT od.*, o.order_number, o.customer_name
          FROM order_documents od
          JOIN orders o ON od.order_id = o.id AND o.tenant_id = od.tenant_id
          WHERE od.tenant_id = ${context.tenantId}
          ORDER BY od.uploaded_at DESC
          LIMIT ${options?.limit || 100}
        `;
      }
    } else if (options?.orderId) {
      query = sql`
        SELECT d.*, o.order_number, o.customer_name
        FROM documents d
        JOIN orders o ON d.order_id = o.id AND o.tenant_id = d.tenant_id
        WHERE d.tenant_id = ${context.tenantId}
        AND d.order_id = ${options.orderId}
        ORDER BY d.created_at DESC
        LIMIT ${options?.limit || 100}
      `;
    } else {
      query = sql`
        SELECT d.*, o.order_number, o.customer_name
        FROM documents d
        JOIN orders o ON d.order_id = o.id AND o.tenant_id = d.tenant_id
        WHERE d.tenant_id = ${context.tenantId}
        ORDER BY d.created_at DESC
        LIMIT ${options?.limit || 100}
      `;
    }

    const result = await query;
    const rows = result as any[];

    return Promise.all(rows.map(async (row: any) => {
      if (hasOrderDocuments) {
        return {
          id: row.id,
          tenantId: row.tenant_id,
          orderId: row.order_id,
          type: row.type,
          fileName: row.file_name,
          fileUrl: await resolveDocumentUrl(row.file_url),
          mimeType: row.mime_type,
          sizeBytes: row.size_bytes,
          uploadedBy: row.uploaded_by,
          uploadedAt: row.uploaded_at,
          orderNumber: row.order_number,
          customerName: row.customer_name,
        };
      }

      const legacy = mapLegacyDocumentRow(row);
      return {
        id: legacy.id,
        tenantId: legacy.tenantId,
        orderId: legacy.orderId,
        type: legacy.type,
        fileName: legacy.fileName,
        fileUrl: await resolveDocumentUrl(legacy.fileUrlRaw),
        mimeType: legacy.mimeType,
        sizeBytes: legacy.sizeBytes,
        uploadedBy: legacy.uploadedBy,
        uploadedAt: legacy.uploadedAt,
        orderNumber: row.order_number,
        customerName: row.customer_name,
      };
    }));
  } catch (error) {
    if (isMissingRelationError(error, ['order_documents', 'documents'])) {
      return [];
    }
    throw error;
  }
}

/**
 * Delete a document (owner/admin only)
 */
export async function deleteOrderDocument(documentId: string): Promise<void> {
  const context = await getServerUserContext();
  requirePermission(context, 'finance.documents.delete');
  const hasOrderDocuments = await tableExists('order_documents');

  // Get document info
  const docCheckResult = hasOrderDocuments
    ? await sql`
        SELECT id, order_id, file_url FROM order_documents 
        WHERE id = ${documentId} AND tenant_id = ${context.tenantId}
        LIMIT 1
      `
    : await sql`
        SELECT id, order_id, file_path as file_url FROM documents
        WHERE id = ${documentId} AND tenant_id = ${context.tenantId}
        LIMIT 1
      `;
  const docCheck = docCheckResult as any[];

  if (docCheck.length === 0) {
    throw new Error('Belge bulunamadı');
  }

  const doc = docCheck[0];

  // Delete from object storage
  try {
    await deleteFile(doc.file_url);
  } catch (error) {
    console.error('Error deleting file from object storage:', error);
  }

  // Delete from database
  if (hasOrderDocuments) {
    await sql`
      DELETE FROM order_documents 
      WHERE id = ${documentId} AND tenant_id = ${context.tenantId}
    `;
  } else {
    await sql`
      DELETE FROM documents
      WHERE id = ${documentId} AND tenant_id = ${context.tenantId}
    `;
  }

  revalidatePath('/finance');
  revalidatePath('/finance/documents');
  revalidatePath(`/orders/${doc.order_id}`);
}

/**
 * Get recent documents for overview
 */
export async function getRecentDocuments(limit: number = 5): Promise<(OrderDocument & { orderNumber?: string })[]> {
  const context = await getServerUserContext();
  requirePermission(context, 'finance.documents.view');
  const hasOrderDocuments = await tableExists('order_documents');

  try {
    const result = hasOrderDocuments
      ? await sql`
          SELECT od.*, o.order_number
          FROM order_documents od
          JOIN orders o ON od.order_id = o.id AND o.tenant_id = od.tenant_id
          WHERE od.tenant_id = ${context.tenantId}
          ORDER BY od.uploaded_at DESC
          LIMIT ${limit}
        `
      : await sql`
          SELECT d.*, o.order_number
          FROM documents d
          JOIN orders o ON d.order_id = o.id AND o.tenant_id = d.tenant_id
          WHERE d.tenant_id = ${context.tenantId}
          ORDER BY d.created_at DESC
          LIMIT ${limit}
        `;
    const rows = result as any[];

    return Promise.all(rows.map(async (row: any) => {
      if (hasOrderDocuments) {
        return {
          id: row.id,
          tenantId: row.tenant_id,
          orderId: row.order_id,
          type: row.type,
          fileName: row.file_name,
          fileUrl: await resolveDocumentUrl(row.file_url),
          mimeType: row.mime_type,
          sizeBytes: row.size_bytes,
          uploadedBy: row.uploaded_by,
          uploadedAt: row.uploaded_at,
          orderNumber: row.order_number,
        };
      }

      const legacy = mapLegacyDocumentRow(row);
      return {
        id: legacy.id,
        tenantId: legacy.tenantId,
        orderId: legacy.orderId,
        type: legacy.type,
        fileName: legacy.fileName,
        fileUrl: await resolveDocumentUrl(legacy.fileUrlRaw),
        mimeType: legacy.mimeType,
        sizeBytes: legacy.sizeBytes,
        uploadedBy: legacy.uploadedBy,
        uploadedAt: legacy.uploadedAt,
        orderNumber: row.order_number,
      };
    }));
  } catch (error) {
    if (isMissingRelationError(error, ['order_documents', 'documents'])) {
      return [];
    }
    throw error;
  }
}
