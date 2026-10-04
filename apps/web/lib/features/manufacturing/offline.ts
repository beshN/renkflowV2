"use client";
import { prepareFileUpload } from "@/lib/storage/client";
import { openDB } from "idb";
export type PendingCommand = {
  commandId: string;
  action: "operation" | "rework.resolve";
  data: Record<string, unknown>;
  createdAt: string;
  status: "pending" | "conflict";
  error?: string;
  photos?: Array<{
    name: string;
    mime: string;
    base64: string;
    workOrderId: string;
  }>;
};
export async function productionDeviceDb(scope: string) {
  return openDB("renkflow-production-" + scope, 1, {
    upgrade(db) {
      db.createObjectStore("commands", { keyPath: "commandId" });
      db.createObjectStore("cache");
    },
  });
}
export async function queueOperation(scope: string, command: PendingCommand) {
  const db = await productionDeviceDb(scope);
  await db.put("commands", command);
}
export async function pendingOperations(
  scope: string,
): Promise<PendingCommand[]> {
  const db = await productionDeviceDb(scope);
  return (await db.getAll("commands")).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
}
async function performSyncOperations(scope: string, onChange: () => void) {
  if (!navigator.onLine) return;
  const db = await productionDeviceDb(scope),
    commands = await pendingOperations(scope);
  for (const cmd of commands) {
    if (cmd.status === "conflict") continue;
    try {
      for (const photo of cmd.photos || []) {
        const r = await fetch("/api/v1/production/files", {
          method: "POST",
          signal: AbortSignal.timeout(30000),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(await prepareFileUpload(photo)),
        });
        if (!r.ok) {
          if ([400, 401, 403, 404, 409, 413, 415].includes(r.status)) {
            const body = await r.json().catch(() => ({}));
            cmd.status = "conflict";
            cmd.error = body.error || "Fotoğraf sunucuda kabul edilmedi";
            await db.put("commands", cmd);
            onChange();
            return;
          }
          throw new Error("Fotoğraf yüklenemedi");
        }
        const { data } = await r.json();
        cmd.data.photos = [...((cmd.data.photos as string[]) || []), data.url];
        cmd.photos = cmd.photos?.filter((p) => p !== photo);
        await db.put("commands", cmd);
      }
      const r = await fetch("/api/v1/production", {
        method: "POST",
        signal: AbortSignal.timeout(30000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commandId: cmd.commandId,
          action: cmd.action,
          data: cmd.data,
        }),
      });
      const body = await r.json();
      if (r.ok) await db.delete("commands", cmd.commandId);
      else if ([400, 401, 403, 404, 409].includes(r.status)) {
        cmd.status = "conflict";
        cmd.error = body.error || "Sunucu kabul etmedi";
        await db.put("commands", cmd);
      } else break;
      onChange();
    } catch {
      break;
    }
  }
}
export async function discardOperation(scope: string, id: string) {
  const db = await productionDeviceDb(scope);
  await db.delete("commands", id);
}
export async function fileData(file: File) {
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Dosya en fazla 10 MB olabilir");
  const base64 = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  return { name: file.name, mime: file.type, base64 };
}

export async function syncOperations(scope: string, onChange: () => void) {
  if (navigator.locks)
    return navigator.locks.request(
      "rf-production-sync-" + scope,
      { ifAvailable: true },
      async (lock) => {
        if (lock) await performSyncOperations(scope, onChange);
      },
    );
  const db = await productionDeviceDb(scope),
    owner = crypto.randomUUID();
  const tx = db.transaction("cache", "readwrite");
  const lease = await tx.store.get("sync-lease");
  if (lease && lease.expiresAt > Date.now()) {
    await tx.done;
    return;
  }
  await tx.store.put({ owner, expiresAt: Date.now() + 180000 }, "sync-lease");
  await tx.done;
  try {
    await performSyncOperations(scope, onChange);
  } finally {
    const release = db.transaction("cache", "readwrite");
    if ((await release.store.get("sync-lease"))?.owner === owner)
      await release.store.delete("sync-lease");
    await release.done;
  }
}
