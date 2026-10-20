"use client";
import { useState } from "react";
import Link from "next/link";
import { requestJson } from "@/lib/shared/network";
import { useCommandRetry } from "@/lib/hooks/useCommandRetry";
import type { leadSalesContext } from "@/lib/features/field/sales-context.server";
import {
  CUSTOMER_TYPES,
  CUSTOMER_TYPE_LABELS,
  PRIORITY_LEVELS,
  PRIORITY_LABELS,
  RESEARCH_CATEGORIES,
  RESEARCH_LABELS,
  type SalesProfile,
} from "@/lib/features/field/sales-context";
type Data = Extract<
  Awaited<ReturnType<typeof leadSalesContext>>,
  { available: true }
>;
const countries = [
  ["TR", "Türkiye"],
  ["DE", "Almanya"],
  ["RO", "Romanya"],
  ["GB", "Birleşik Krallık"],
  ["FR", "Fransa"],
  ["NL", "Hollanda"],
  ["BE", "Belçika"],
  ["AT", "Avusturya"],
  ["IT", "İtalya"],
  ["ES", "İspanya"],
  ["US", "ABD"],
  ["AE", "Birleşik Arap Emirlikleri"],
];
const quoteStatus: Record<string, string> = {
  draft: "Hazırlanıyor",
  sent: "Gönderildi",
  accepted: "Onaylandı",
  converted: "Siparişe bağlandı",
  rejected: "Reddedildi",
  expired: "Süresi doldu",
};
export function LeadSalesContextPanel({
  leadId,
  data,
  reload,
}: {
  leadId: string;
  data: Data;
  reload: () => Promise<void>;
}) {
  const [profile, setProfile] = useState<SalesProfile>(data.profile),
    [owner, setOwner] = useState(data.ownerId || ""),
    [override, setOverride] = useState(data.override?.level || ""),
    [reason, setReason] = useState(data.override?.reason || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [sourceOpen, setSourceOpen] = useState(false),
    [link, setLink] = useState("");
  const command = useCommandRetry();
  const research = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await command(
        `/api/v1/leads/${leadId}`,
        {
          action: "researchCompany",
        },
        "root",
        { timeoutMs: 100000 },
      );
      if (!r.ok) throw new Error(r.error || "Araştırma tamamlanamadı");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Araştırma tamamlanamadı");
    } finally {
      setBusy(false);
    }
  };
  const send = async (body: unknown) => {
    setBusy(true);
    setError("");
    try {
      const r = await requestJson(`/api/v1/leads/${leadId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(r.error || "Kaydedilemedi");
      await reload();
      setSourceOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kaydedilemedi");
    } finally {
      setBusy(false);
    }
  };
  const tri = (
    key: "dealerPotential" | "recurringPotential",
    label: string,
  ) => (
    <label className="text-sm">
      {label}
      <select
        className="rf-input mt-1 w-full"
        disabled={!data.canEdit || busy}
        value={profile[key] === null ? "" : String(profile[key])}
        onChange={(e) =>
          setProfile((p) => ({
            ...p,
            [key]: e.target.value === "" ? null : e.target.value === "true",
          }))
        }
      >
        <option value="">Henüz bilinmiyor</option>
        <option value="true">Evet</option>
        <option value="false">Hayır</option>
      </select>
    </label>
  );
  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <section className="space-y-3 rounded-lg border border-border p-3">
        <h3 className="font-semibold">
          Satış önceliği · {data.priority.label}
        </h3>
        <p className="text-sm text-muted-foreground">{data.priority.reason}</p>
        <p className="text-xs text-muted-foreground">
          Öncelik satış stratejisini gösterir. Araştırma kapsamı aşağıda ayrı
          izlenir.
        </p>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send({
              action: "context",
              version: data.version,
              ownerId: owner || null,
              profile,
              override: override ? { level: override, reason } : null,
            });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Ülke · ISO kodu
              <input
                list={"lead-countries-" + leadId}
                pattern="[A-Z]{2}"
                maxLength={2}
                className="rf-input mt-1 w-full"
                value={profile.country}
                placeholder="TR, DE…"
                disabled={!data.canEdit || busy}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    country: e.target.value.toUpperCase(),
                  }))
                }
              />
              <datalist id={"lead-countries-" + leadId}>
                {countries.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </datalist>
              <span className="text-xs text-muted-foreground">
                Listede olmayan ülkenin iki harfli kodunu yazabilirsiniz.
                Bilinmiyorsa boş bırakın.
              </span>
            </label>
            <label className="text-sm">
              Şehir
              <input
                className="rf-input mt-1 w-full"
                value={profile.city}
                disabled={!data.canEdit || busy}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, city: e.target.value }))
                }
              />
            </label>
            <label className="text-sm">
              Müşteri türü
              <select
                className="rf-input mt-1 w-full"
                value={profile.customerType}
                disabled={!data.canEdit || busy}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    customerType: e.target
                      .value as SalesProfile["customerType"],
                  }))
                }
              >
                {CUSTOMER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {CUSTOMER_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Sorumlu
              <select
                className="rf-input mt-1 w-full"
                value={owner}
                disabled={!data.canEdit || busy}
                onChange={(e) => setOwner(e.target.value)}
              >
                <option value="">Atanmadı</option>
                {data.members.map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            {tri("dealerPotential", "Bayilik potansiyeli")}
            {tri("recurringPotential", "Düzenli alım potansiyeli")}
          </div>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">
              İlgilenilen ürünler ve adet
            </legend>
            {profile.interests.map((interest, i) => (
              <div key={i} className="flex flex-wrap gap-2">
                <input
                  aria-label={`${i + 1}. ilgilenilen ürün`}
                  required
                  className="rf-input min-w-0 flex-1"
                  value={interest.product}
                  disabled={!data.canEdit || busy}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      interests: p.interests.map((v, k) =>
                        k === i ? { ...v, product: e.target.value } : v,
                      ),
                    }))
                  }
                />
                <input
                  aria-label={`${interest.product || i + 1} talep adedi`}
                  className="rf-input w-24"
                  type="number"
                  placeholder="Adet?"
                  min={1}
                  max={1000000}
                  value={interest.quantity ?? ""}
                  disabled={!data.canEdit || busy}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      interests: p.interests.map((v, k) =>
                        k === i
                          ? {
                              ...v,
                              quantity: e.target.value
                                ? Number(e.target.value)
                                : null,
                            }
                          : v,
                      ),
                    }))
                  }
                />
                {data.canEdit && (
                  <button
                    type="button"
                    className="rf-secondary-button"
                    disabled={busy}
                    onClick={() =>
                      setProfile((p) => ({
                        ...p,
                        interests: p.interests.filter((_, k) => k !== i),
                      }))
                    }
                  >
                    Kaldır
                  </button>
                )}
              </div>
            ))}
            {data.canEdit && profile.interests.length < 30 && (
              <button
                type="button"
                className="rf-secondary-button"
                disabled={busy}
                onClick={() =>
                  setProfile((p) => ({
                    ...p,
                    interests: [
                      ...p.interests,
                      { product: "", quantity: null },
                    ],
                  }))
                }
              >
                Ürün ekle
              </button>
            )}
          </fieldset>
          {data.canEdit && (
            <details>
              <summary className="cursor-pointer text-sm">
                Önceliği gerekçeyle değiştir
              </summary>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="text-sm">
                  Öncelik
                  <select
                    className="rf-input mt-1 w-full"
                    value={override}
                    onChange={(e) => setOverride(e.target.value)}
                  >
                    <option value="">Stratejiden otomatik</option>
                    {PRIORITY_LEVELS.map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </label>
                {override && (
                  <label className="text-sm">
                    Gerekçe
                    <input
                      required
                      minLength={5}
                      maxLength={1000}
                      className="rf-input mt-1 w-full"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </label>
                )}
              </div>
            </details>
          )}
          {data.canEdit && (
            <button className="rf-primary-button" disabled={busy}>
              Satış bilgilerini kaydet
            </button>
          )}
        </form>
      </section>
      <section className="space-y-3 rounded-lg border border-border p-3">
        <h3 className="font-semibold">Bağlı teklifler</h3>
        {data.quotes.map((q: any) => (
          <article key={q.id} className="space-y-1 text-sm">
            <Link
              href={`/quotations/${q.id}`}
              className="font-medium text-primary"
            >
              {q.number}
            </Link>
            <p>
              {quoteStatus[q.status] || q.status} · Sürüm {q.revision} ·{" "}
              {new Date(q.updated_at).toLocaleDateString("tr-TR")}
              {q.totalAmount != null
                ? ` · ${Number(q.totalAmount).toLocaleString("tr-TR")} ${q.currency}`
                : ""}
            </p>
            {q.history.length > 0 && (
              <details>
                <summary className="cursor-pointer text-xs">
                  Önceki sürümler
                </summary>
                {q.history.map((r: any) => (
                  <p key={r.revision} className="mt-1 text-xs">
                    Sürüm {r.revision} · {quoteStatus[r.status] || r.status} ·{" "}
                    {new Date(r.at).toLocaleDateString("tr-TR")} · {r.reason}
                    {r.totalAmount != null
                      ? ` · ${Number(r.totalAmount).toLocaleString("tr-TR")} ${q.currency}`
                      : ""}
                  </p>
                ))}
              </details>
            )}
          </article>
        ))}
        {!data.quotes.length && (
          <p className="text-sm text-muted-foreground">
            Henüz bağlı teklif yok.
          </p>
        )}
        {data.canEdit &&
          data.quoteCandidates.some(
            (q: any) => !data.quotes.some((v: any) => v.id === q.id),
          ) && (
            <div className="flex flex-wrap gap-2">
              <select
                aria-label="Müşterinin bağlanacak teklifi"
                className="rf-input"
                value={link}
                onChange={(e) => setLink(e.target.value)}
              >
                <option value="">Müşterinin teklifini seçin</option>
                {data.quoteCandidates
                  .filter(
                    (q: any) => !data.quotes.some((v: any) => v.id === q.id),
                  )
                  .map((q: any) => (
                    <option key={q.id} value={q.id}>
                      {q.number}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                className="rf-secondary-button"
                disabled={busy || !link}
                onClick={() =>
                  void send({ action: "linkQuote", quotationId: link })
                }
              >
                Teklifi bağla
              </button>
            </div>
          )}
        {data.lastContactAt && (
          <p className="text-sm text-muted-foreground">
            Son iletişim: {new Date(data.lastContactAt).toLocaleString("tr-TR")}
          </p>
        )}
      </section>
      <section className="space-y-3 rounded-lg border border-border p-3">
        <div className="flex flex-wrap justify-between gap-2">
          <h3 className="font-semibold">Firma araştırması ve kaynaklar</h3>
          {data.canEdit && (
            <button
              type="button"
              className="rf-secondary-button"
              onClick={() => setSourceOpen((v) => !v)}
            >
              Kaynak ekle
            </button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {data.research.verified} doğrulanmış kaynak · {data.research.pending}{" "}
          kontrol bekliyor · {data.research.coverage.length}/7 araştırma konusu.
          Kaynak bulunmaması firmanın değersiz veya güvensiz olduğu anlamına
          gelmez.
        </p>
        {data.canEdit && (
          <div className="space-y-2">
            <button
              type="button"
              className="rf-primary-button"
              disabled={busy || !data.researchAutomation.available}
              onClick={() => void research()}
            >
              {busy ? "İşlem sürüyor…" : "Yapay zekâyla araştır"}
            </button>
            <p className="text-xs text-muted-foreground">
              Kaydedilmiş firma adı, ülke ve şehir araştırma servisine
              gönderilir. En fazla {data.researchAutomation.maxSearches} web
              araması: arama başına{" "}
              {data.researchAutomation.searchCostUsd.toLocaleString("tr-TR")}{" "}
              USD ve model kullanımı. Sonuçlar{" "}
              {data.researchAutomation.cacheHours} saat yeniden kullanılır.
            </p>
            {data.researchAutomation.reason && (
              <p className="text-sm text-muted-foreground">
                {data.researchAutomation.reason}
              </p>
            )}
          </div>
        )}
        {data.lastResearch && (
          <p role="status" className="text-sm">
            {data.lastResearch.status === "running"
              ? "Firma araştırması sürüyor. Biraz sonra kaydı yenileyin."
              : data.lastResearch.result?.message}
            {data.lastResearch.result?.incomplete
              ? " Araştırma kısmen tamamlandı."
              : ""}
            {data.lastResearch.result?.sourceCount > 0 &&
            data.lastResearch.result?.classificationComplete === false
              ? " Konu sınıflandırması tamamlanamadı; kaynakları kontrol edin."
              : ""}
          </p>
        )}
        {sourceOpen && (
          <ResearchForm
            busy={busy}
            submit={(source) =>
              send({
                action: "research",
                commandId: crypto.randomUUID(),
                source,
              })
            }
          />
        )}{" "}
        {data.sources.map((s: any) => (
          <article
            key={s.id}
            className="space-y-1 border-t border-border pt-2 text-sm"
          >
            <a
              className="font-medium text-primary"
              href={s.url}
              target="_blank"
              rel="noreferrer noopener"
            >
              {s.title}
            </a>
            <p>
              {s.evidence?.kind === "web_search_citation"
                ? "Yapay zekâ buldu · "
                : ""}
              {RESEARCH_LABELS[s.category as keyof typeof RESEARCH_LABELS]} ·{" "}
              {s.status === "verified"
                ? "Doğrulandı"
                : s.status === "rejected"
                  ? "Geçersiz / uygun değil"
                  : "Kontrol bekliyor"}{" "}
              · {new Date(s.checked_at).toLocaleDateString("tr-TR")}
            </p>
            {s.evidence?.kind === "web_search_citation" ? (
              <blockquote className="whitespace-pre-wrap border-l-2 border-border pl-3">
                {s.findings}
              </blockquote>
            ) : (
              <p className="whitespace-pre-wrap">{s.findings}</p>
            )}
            {data.canEdit && (
              <div className="flex flex-wrap gap-2">
                {s.evidence?.kind === "web_search_citation" && (
                  <details className="w-full text-sm">
                    <summary className="cursor-pointer text-muted-foreground">
                      Araştırma konusunu düzelt
                    </summary>
                    <label className="mt-2 block">
                      Konu
                      <select
                        className="rf-input mt-1 w-full"
                        disabled={busy}
                        value={s.category}
                        onChange={(e) =>
                          void send({
                            action: "research",
                            commandId: crypto.randomUUID(),
                            id: s.id,
                            version: s.version,
                            source: {
                              category: e.target.value,
                              url: s.url,
                              title: s.title,
                              findings: s.findings,
                              status: s.status,
                              checkedAt: new Date().toISOString(),
                            },
                          })
                        }
                      >
                        {RESEARCH_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {RESEARCH_LABELS[c]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </details>
                )}
                {s.status !== "verified" && (
                  <button
                    disabled={busy}
                    type="button"
                    className="rf-secondary-button"
                    onClick={() =>
                      void send({
                        action: "research",
                        commandId: crypto.randomUUID(),
                        id: s.id,
                        version: s.version,
                        source: {
                          category: s.category,
                          url: s.url,
                          title: s.title,
                          findings: s.findings,
                          status: "verified",
                          checkedAt: new Date().toISOString(),
                        },
                      })
                    }
                  >
                    Kaynağı kontrol ettim, doğrula
                  </button>
                )}
                {s.status !== "rejected" && (
                  <button
                    disabled={busy}
                    type="button"
                    className="rf-secondary-button"
                    onClick={() =>
                      void send({
                        action: "research",
                        commandId: crypto.randomUUID(),
                        id: s.id,
                        version: s.version,
                        source: {
                          category: s.category,
                          url: s.url,
                          title: s.title,
                          findings: s.findings,
                          status: "rejected",
                          checkedAt: new Date().toISOString(),
                        },
                      })
                    }
                  >
                    Uygun değil
                  </button>
                )}
              </div>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
function ResearchForm({
  submit,
  busy,
}: {
  submit: (source: unknown) => Promise<void>;
  busy: boolean;
}) {
  const [source, setSource] = useState({
    category: "activity",
    url: "",
    title: "",
    findings: "",
  });
  return (
    <form
      className="grid gap-3 rounded border border-border p-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        void submit({
          ...source,
          status: "reported",
          checkedAt: new Date().toISOString(),
        });
      }}
    >
      <label className="text-sm">
        Konu
        <select
          className="rf-input mt-1 w-full"
          value={source.category}
          onChange={(e) =>
            setSource((s) => ({ ...s, category: e.target.value }))
          }
        >
          {RESEARCH_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {RESEARCH_LABELS[c]}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Kaynak başlığı
        <input
          required
          className="rf-input mt-1 w-full"
          value={source.title}
          onChange={(e) => setSource((s) => ({ ...s, title: e.target.value }))}
        />
      </label>
      <label className="text-sm sm:col-span-2">
        Kaynak bağlantısı
        <input
          required
          type="url"
          className="rf-input mt-1 w-full"
          value={source.url}
          onChange={(e) => setSource((s) => ({ ...s, url: e.target.value }))}
        />
      </label>
      <label className="text-sm sm:col-span-2">
        Bulunan bilgi
        <textarea
          required
          minLength={5}
          maxLength={4000}
          className="rf-input mt-1 w-full"
          rows={3}
          value={source.findings}
          onChange={(e) =>
            setSource((s) => ({ ...s, findings: e.target.value }))
          }
        />
      </label>
      <p className="text-xs text-muted-foreground sm:col-span-2">
        Yalnız kaynakta bulunan bilgiyi kaydedin. Bayilik niyeti, ciro veya alım
        olasılığı kaynak olmadan kesinleştirilmez.
      </p>
      <button className="rf-primary-button" disabled={busy}>
        Kaynağı kaydet
      </button>
    </form>
  );
}
