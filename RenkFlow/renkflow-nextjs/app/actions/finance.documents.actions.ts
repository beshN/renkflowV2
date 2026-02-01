'use server';

import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { uploadFile, deleteFile, generateFilePath, getFileUrl } from '@/lib/storage/r2';
import {
  getServerUserContext,
  requirePermission,
} from '@/lib/auth/serverAuth';
import {
  OrderDocument,
  OrderDocumentType,
  OrderDocumentTypeSchema,
} from '@/lib/types/finance';

/**
 * Upload a document for an order
 */
export async function uploadOrderDocument(
  orderId: string,
  type: OrderDocumentType,
  file: File
): Promise<OrderDocument> {
  const context = await getServerUserContext();
  requirePermission(context, 'finance.documents.upload');

  // Validate type
  OrderDocumentTypeSchema.parse(type);

  // Verify order belongs to tenant
  const orderCheck = await sql`
    SELECT id, tenant_id FROM orders 
    WHERE id = ${orderId} AND tenant_id = ${context.tenantId}
    LIMIT 1
  `;

  if (orderCheck.length === 0) {
    throw new Error('Sipariş bulunamadı');
  }

  // Upload file to R2
  const key = generateFilePath(orderId, `${type}-${file.name}`);
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  await uploadFile(key, buffer, file.type);

  // Insert document record
  const result = await sql`
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
  `;

  revalidatePath('/finance');
  revalidatePath('/finance/documents');
  revalidatePath(`/orders/${orderId}`);

  const row = result[0];
  const signedUrl = await getFileUrl(row.file_url);

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
  };
}

/**
 * List all documents for a specific order
 */
export async function listOrderDocuments(orderId: string): Promise<OrderDocument[]> {
  const context = await getServerUserContext();
  requirePermission(context, 'finance.documents.view');

  const result = await sql`
    SELECT od.* 
    FROM order_documents od
    JOIN orders o ON od.order_id = o.id
    WHERE od.order_id = ${orderId} 
    AND od.tenant_id = ${context.tenantId}
    ORDER BY od.uploaded_at DESC
  `;

  return Promise.all(result.map(async (row: any) => {
    const signedUrl = await getFileUrl(row.file_url);
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
    };
  }));
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

  let query;
  
  if (options?.type && options?.orderId) {
    query = sql`
      SELECT od.*, o.order_number, o.customer_name
      FROM order_documents od
      JOIN orders o ON od.order_id = o.id
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
      JOIN orders o ON od.order_id = o.id
      WHERE od.tenant_id = ${context.tenantId}
      AND od.type = ${options.type}
      ORDER BY od.uploaded_at DESC
      LIMIT ${options?.limit || 100}
    `;
  } else if (options?.orderId) {
    query = sql`
      SELECT od.*, o.order_number, o.customer_name
      FROM order_documents od
      JOIN orders o ON od.order_id = o.id
      WHERE od.tenant_id = ${context.tenantId}
      AND od.order_id = ${options.orderId}
      ORDER BY od.uploaded_at DESC
      LIMIT ${options?.limit || 100}
    `;
  } else {
    query = sql`
      SELECT od.*, o.order_number, o.customer_name
      FROM order_documents od
      JOIN orders o ON od.order_id = o.id
      WHERE od.tenant_id = ${context.tenantId}
      ORDER BY od.uploaded_at DESC
      LIMIT ${options?.limit || 100}
    `;
  }

  const result = await query;

  return Promise.all(result.map(async (row: any) => {
    const signedUrl = await getFileUrl(row.file_url);
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
      orderNumber: row.order_number,
      customerName: row.customer_name,
    };
  }));
}

/**
 * Delete a document (owner/admin only)
 */
export async function deleteOrderDocument(documentId: string): Promise<void> {
  const context = await getServerUserContext();
  requirePermission(context, 'finance.documents.delete');

  // Get document info
  const docCheck = await sql`
    SELECT id, order_id, file_url FROM order_documents 
    WHERE id = ${documentId} AND tenant_id = ${context.tenantId}
    LIMIT 1
  `;

  if (docCheck.length === 0) {
    throw new Error('Belge bulunamadı');
  }

  const doc = docCheck[0];

  // Delete from R2
  try {
    await deleteFile(doc.file_url);
  } catch (error) {
    console.error('Error deleting file from R2:', error);
  }

  // Delete from database
  await sql`
    DELETE FROM order_documents 
    WHERE id = ${documentId} AND tenant_id = ${context.tenantId}
  `;

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

  const result = await sql`
    SELECT od.*, o.order_number
    FROM order_documents od
    JOIN orders o ON od.order_id = o.id
    WHERE od.tenant_id = ${context.tenantId}
    ORDER BY od.uploaded_at DESC
    LIMIT ${limit}
  `;

  return Promise.all(result.map(async (row: any) => {
    const signedUrl = await getFileUrl(row.file_url);
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
      orderNumber: row.order_number,
    };
  }));
}
