import "server-only";
import { mkdir, readFile as readLocal, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export function validateStorageKey(key: string): string {
  if (!key || key.length > 700 || key.startsWith("/") || /[\\?#\x00-\x1f]/.test(key) || key.includes(":") || key.split("/").some(p => !p || p === "." || p === ".."))
    throw new Error("Geçersiz dosya yolu");
  return key;
}
function isLocalStorage() {
  return process.env.STORAGE_BACKEND === "local" && !process.env.VERCEL && (process.env.NODE_ENV !== "production" || process.env.ALLOW_LOCAL_STORAGE === "1");
}
function localPath(key: string) { return path.join(process.cwd(), ".data", "files", validateStorageKey(key)); }
export function storageConfigured() {
  if (isLocalStorage()) return true;
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN));
}
function assertStorageConfigured() {
  if ((process.env.STORAGE_BACKEND || "vercel-blob") !== "vercel-blob")
    throw new Error("STORAGE_BACKEND vercel-blob olmalıdır");
  if (!storageConfigured()) throw new Error("Özel Vercel Blob depolaması yapılandırılmamış");
}
/** Store only stable keys in SQL. Private Blob URLs are never made public. */
export async function uploadFile(key: string, file: Buffer | Blob, contentType: string): Promise<string> {
  validateStorageKey(key);
  if (isLocalStorage()) {
    const target = localPath(key);
    await mkdir(path.dirname(target), {recursive:true,mode:0o700});
    const bytes = file instanceof Blob ? Buffer.from(await file.arrayBuffer()) : file;
    await writeFile(target, bytes, {flag:"wx",mode:0o600});
    await writeFile(target+".metadata", JSON.stringify({contentType}), {flag:"wx",mode:0o600});
    return getFileUrl(key);
  }
  assertStorageConfigured();
  const { put } = await import("@vercel/blob");
  await put(key, file, {access: "private", contentType, addRandomSuffix: false, allowOverwrite: false});
  return getFileUrl(key);
}
/** Each read rechecks the current user's tenant and document access. */
export async function getFileUrl(key: string): Promise<string> {
  validateStorageKey(key);
  return `/api/storage/content?key=${encodeURIComponent(key)}`;
}
export async function readFile(key: string) {
  validateStorageKey(key);
  if (isLocalStorage()) {
    const bytes = await readLocal(localPath(key));
    const {contentType} = JSON.parse(await readLocal(localPath(key)+".metadata", "utf8"));
    return {body: new Blob([new Uint8Array(bytes)]).stream(), contentType: String(contentType), size: bytes.length, uploadedAt: undefined as Date | undefined};
  }
  assertStorageConfigured();
  const { get } = await import("@vercel/blob");
  const result = await get(key, {access: "private", useCache: false});
  if (!result || result.statusCode !== 200) throw new Error("Dosya bulunamadı");
  return {body: result.stream, contentType: result.blob.contentType, size: result.blob.size, uploadedAt: result.blob.uploadedAt};
}
export async function deleteFile(key: string): Promise<void> {
  validateStorageKey(key);
  if (isLocalStorage()) {
    for (const suffix of ["", ".metadata"]) {
      try {await unlink(localPath(key)+suffix);} catch(error) {if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;}
    }
    return;
  }
  assertStorageConfigured();
  const { del } = await import("@vercel/blob");
  await del(key);
}
export function generateFilePath(orderId: string, fileName: string): string {
  const name = fileName.replace(/[^a-zA-Z0-9.-]/g, "_").slice(-150) || "document";
  return validateStorageKey(`orders/${orderId}/${randomUUID()}-${name}`);
}
