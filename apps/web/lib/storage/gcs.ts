import { Storage } from '@google-cloud/storage';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const STORAGE_BACKEND = (process.env.STORAGE_BACKEND || 'gcs').toLowerCase();

const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME;
const GCS_PUBLIC_URL = process.env.GCS_PUBLIC_URL;

const gcsClient = GCS_BUCKET_NAME ? new Storage() : null;

function assertStorageConfigured() {
  if (STORAGE_BACKEND !== 'gcs') {
    throw new Error(
      '[RenkFlow Storage] Invalid STORAGE_BACKEND. Only "gcs" is supported.'
    );
  }

  if (!gcsClient || !GCS_BUCKET_NAME) {
    const message =
      '[RenkFlow Storage] GCS_BUCKET_NAME is not configured for Google Cloud Storage.';
    if (IS_PRODUCTION) {
      throw new Error(message);
    }

    throw new Error(
      `${message} Set GCS_BUCKET_NAME before using file operations in development.`
    );
  }
}

function toBuffer(file: Buffer | Blob): Promise<Buffer> {
  if (file instanceof Blob) {
    return file.arrayBuffer().then((value) => Buffer.from(value));
  }
  return Promise.resolve(file);
}

/**
 * Upload file to Google Cloud Storage.
 */
export async function uploadFile(
  key: string,
  file: Buffer | Blob,
  contentType: string
): Promise<string> {
  assertStorageConfigured();

  const bucket = gcsClient!.bucket(GCS_BUCKET_NAME!);
  const object = bucket.file(key);
  await object.save(await toBuffer(file), {
    contentType,
    resumable: false,
  });

  if (GCS_PUBLIC_URL) {
    return `${GCS_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
  }

  return getFileUrl(key);
}

/**
 * Get signed URL for file (valid for 1 hour by default).
 */
export async function getFileUrl(key: string, expiresIn: number = 3600): Promise<string> {
  assertStorageConfigured();

  const bucket = gcsClient!.bucket(GCS_BUCKET_NAME!);
  const object = bucket.file(key);
  const [url] = await object.getSignedUrl({
    action: 'read',
    expires: Date.now() + expiresIn * 1000,
    version: 'v4',
  });

  return url;
}

/**
 * Delete file from Google Cloud Storage.
 */
export async function deleteFile(key: string): Promise<void> {
  assertStorageConfigured();

  const bucket = gcsClient!.bucket(GCS_BUCKET_NAME!);
  await bucket.file(key).delete({ ignoreNotFound: true });
}

/**
 * Generate unique file path
 */
export function generateFilePath(orderId: string, fileName: string): string {
  const timestamp = Date.now();
  const sanitized = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `orders/${orderId}/${timestamp}-${sanitized}`;
}

export { gcsClient };
