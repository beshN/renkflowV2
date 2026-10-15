"use client";
import { useRef } from "react";
import { requestJson, type RequestJsonResult } from "@/lib/shared/network";
import { stableJson } from "@/lib/features/products/configuration";
/** Keep the command identity when a response is lost; another click must not count more parts. */
export function useCommandRetry() {
  const pending = useRef<{ signature: string; commandId: string } | null>(null);
  return async <T = unknown>(
    url: string,
    raw: Record<string, any>,
    location: "root" | "data" = "root",
    options: { timeoutMs?: number } = {},
  ): Promise<RequestJsonResult<T>> => {
    const target = location === "data" ? raw.data : raw,
      { commandId: _discard, ...fields } = target || {},
      body = location === "data" ? { ...raw, data: fields } : fields;
    const signature = url + "|" + stableJson(body);
    if (pending.current && pending.current.signature !== signature)
      return {
        ok: false,
        status: 409,
        data: null,
        error:
          "Önceki kaydın sonucu belirsiz. Miktarı ve bilgileri önceki hâline getirip tekrar deneyin; önce o kaydı doğrulayalım.",
      };
    pending.current ||= { signature, commandId: crypto.randomUUID() };
    const payload =
      location === "data"
        ? { ...body, data: { ...fields, commandId: pending.current.commandId } }
        : { ...fields, commandId: pending.current.commandId };
    const result = await requestJson<T>(
      url,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
      options,
    );
    if (result.ok || (result.status >= 400 && result.status < 500))
      pending.current = null;
    return result;
  };
}
