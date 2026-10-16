"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Plus,
  Search,
  FileText,
  Download,
  History,
  ArrowLeft,
  Archive,
  RotateCcw,
  FolderPlus,
  Paperclip,
  Lock,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { prepareBrowserFile } from "@/lib/storage/client";
import { ORDER_ALLOWED_FILE_TYPES } from "@/lib/features/orders/constants";
import {
  KNOWLEDGE_VISIBILITY,
  type KnowledgeVisibility,
} from "@/lib/features/knowledge/contract";
import { useAuth } from "@/lib/context/AuthContext";
type Category = { id: string; name: string };
type Doc = {
  id: string;
  title: string;
  visibility: KnowledgeVisibility;
  version: number;
  category_id: string | null;
  category_name?: string;
  archived: boolean;
  updated_at: string;
  excerpt?: string;
  content?: string;
  file_name?: string;
  mime?: string;
};
type Revision = {
  version: number;
  title: string;
  content: string;
  file_name: string | null;
  mime: string | null;
  note: string;
  created_at: string;
  author_name: string | null;
};
type Detail = {
  document: Doc;
  revision: Revision;
  history: Revision[];
  hasFile: boolean;
};
async function api(path: string, options?: RequestInit) {
  const r = await fetch("/api/v1/knowledge" + path, {
    cache: "no-store",
    ...options,
  });
  const body = await r.json();
  if (!r.ok) throw Error(body.error || "İşlem tamamlanamadı.");
  return body.data;
}
const json = (method: string, body: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const date = (value: string) =>
  new Date(value).toLocaleString("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
export function KnowledgeWorkspace() {
  const { user } = useAuth(),
    [docs, setDocs] = useState<Doc[]>([]),
    [categories, setCategories] = useState<Category[]>([]),
    [q, setQ] = useState(""),
    [category, setCategory] = useState(""),
    [archived, setArchived] = useState(false),
    [canWrite, setCanWrite] = useState(false),
    [canEdit, setCanEdit] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [selected, setSelected] = useState<string | null>(null),
    [detail, setDetail] = useState<Detail | null>(null),
    [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false),
    [showHistory, setShowHistory] = useState(false),
    [categoryName, setCategoryName] = useState(""),
    [categoryForm, setCategoryForm] = useState(false),
    [file, setFile] = useState<File | null>(null),
    [removeFile, setRemoveFile] = useState(false),
    [form, setForm] = useState({
      title: "",
      content: "",
      categoryId: "",
      visibility: "company" as KnowledgeVisibility,
      note: "",
    });
  useEffect(() => {
    const abort = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      api(
        "?" +
          new URLSearchParams({ q, category, archived: archived ? "1" : "0" }),
        { signal: abort.signal },
      )
        .then((data) => {
          setDocs(data.documents);
          setCategories(data.categories);
          setCanWrite(data.canWrite);
          setCanEdit(data.canEdit);
        })
        .catch((e) => {
          if (!abort.signal.aborted) setError(e.message);
        })
        .finally(() => {
          if (!abort.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [q, category, archived, refresh]);
  const detailRequest = useRef<AbortController | null>(null);
  useEffect(() => () => detailRequest.current?.abort(), []);
  const open = useCallback(async (id: string, version?: number) => {
    detailRequest.current?.abort();
    const abort = new AbortController();
    detailRequest.current = abort;
    setSelected(id);
    setDetail(null);
    setEditing(false);
    setError("");
    try {
      const result = await api(
        "/" + id + (version ? "?version=" + version : ""),
        { signal: abort.signal },
      );
      if (!abort.signal.aborted) {
        setDetail(result);
        const url = new URL(window.location.href);
        url.searchParams.set("doc", id);
        if (version) url.searchParams.set("version", String(version));
        else url.searchParams.delete("version");
        window.history.replaceState(null, "", url);
      }
    } catch (e) {
      if (!abort.signal.aborted)
        setError(e instanceof Error ? e.message : "Belge açılamadı.");
    }
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search),
      id = params.get("doc");
    if (id) {
      const version = Number(params.get("version"));
      void open(
        id,
        Number.isInteger(version) && version > 0 ? version : undefined,
      );
    }
  }, [open]);
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Belge bağlantısı kopyalandı.");
    } catch {
      setError(
        "Bağlantı kopyalanamadı. Tarayıcı adresini kopyalayabilirsiniz.",
      );
    }
  }
  function clearSelection() {
    detailRequest.current?.abort();
    setSelected(null);
    setDetail(null);
    setEditing(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("doc");
    url.searchParams.delete("version");
    window.history.replaceState(null, "", url);
  }
  function edit(doc?: Detail) {
    detailRequest.current?.abort();
    setFile(null);
    setRemoveFile(false);
    setShowHistory(false);
    setForm({
      title: doc?.document.title ?? "",
      content: doc?.document.content ?? "",
      categoryId: doc?.document.category_id ?? category,
      visibility: doc?.document.visibility ?? "company",
      note: "",
    });
    setEditing(true);
    if (!doc) {
      setSelected(null);
      setDetail(null);
    }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      let upload: unknown;
      if (file) {
        const prepared = await prepareBrowserFile(file, "knowledge");
        if (prepared instanceof File) {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(",")[1]);
            reader.onerror = () => reject(Error("Dosya okunamadı."));
            reader.readAsDataURL(prepared);
          });
          upload = { name: file.name, mime: file.type, base64 };
        } else upload = prepared;
      }
      const saved = await api(
        "",
        json("POST", {
          ...form,
          categoryId: form.categoryId || null,
          id: detail?.document.id,
          version: detail?.document.version ?? 0,
          file: upload,
          removeFile,
        }),
      );
      setEditing(false);
      setRefresh((v) => v + 1);
      await open(saved.id);
      toast.success("Belge sürümü kaydedildi.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  }
  async function archive() {
    if (!detail) return;
    setBusy(true);
    try {
      await api(
        "/" + detail.document.id,
        json("PATCH", {
          version: detail.document.version,
          archived: !detail.document.archived,
        }),
      );
      clearSelection();
      setRefresh((v) => v + 1);
      toast.success(
        detail.document.archived ? "Belge geri yüklendi." : "Belge arşivlendi.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "İşlem yapılamadı.");
    } finally {
      setBusy(false);
    }
  }
  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const c = await api("/categories", json("POST", { name: categoryName }));
      setCategory(c.id);
      setCategoryForm(false);
      setCategoryName("");
      setRefresh((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kategori eklenemedi.");
    } finally {
      setBusy(false);
    }
  }
  const contentUrl = detail
    ? `/api/v1/knowledge/${detail.document.id}/content?version=${detail.revision.version}`
    : "";
  return (
    <div className="rf-page space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Şirketinizin ortak hafızası
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Kataloglar, teknik çizimler, resmi belgeler ve çalışma talimatları.
          </p>
        </div>
        {canWrite && (
          <button
            onClick={() => edit()}
            className="rf-primary-button min-h-11 px-4"
          >
            <Plus size={16} /> Yeni belge
          </button>
        )}
      </div>
      {error && (
        <div role="alert" className="rf-alert">
          {error}{" "}
          <button
            className="underline"
            onClick={() => {
              if (selected && !detail) void open(selected);
              else setRefresh((v) => v + 1);
            }}
          >
            Yenile
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <label className="rf-panel flex min-h-11 min-w-48 flex-1 items-center gap-2 px-3">
          <Search size={16} aria-hidden />
          <input
            aria-label="Belge ara"
            className="w-full bg-transparent text-sm outline-none"
            placeholder="Belge, dosya adı veya içerikte ara…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <select
          aria-label="Belge kategorisi"
          className="rf-input max-w-60"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Tüm kategoriler</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          aria-pressed={archived}
          onClick={() => setArchived((v) => !v)}
          className="rf-secondary-button min-h-11 px-3"
        >
          <Archive size={16} />
          {archived ? "Arşiv" : "Arşivi göster"}
        </button>
        {canWrite && (
          <button
            aria-expanded={categoryForm}
            onClick={() => setCategoryForm((v) => !v)}
            className="rf-secondary-button min-h-11 px-3"
          >
            <FolderPlus size={16} /> Kategori
          </button>
        )}
      </div>
      {categoryForm && (
        <form
          onSubmit={addCategory}
          className="rf-panel flex flex-wrap gap-2 p-3"
        >
          <input
            aria-label="Yeni kategori adı"
            required
            maxLength={100}
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            className="rf-input flex-1"
            placeholder="Örn. Montaj talimatları"
          />
          <button disabled={busy} className="rf-primary-button px-4">
            Kategori oluştur
          </button>
        </form>
      )}
      <div className="grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside
          aria-label="Belgeler"
          className={cn(
            "rf-panel overflow-hidden",
            (selected || editing) && "hidden lg:block",
          )}
        >
          {loading ? (
            <p role="status" className="p-6 text-sm text-muted-foreground">
              Belgeler yükleniyor…
            </p>
          ) : docs.length ? (
            docs.map((doc) => (
              <button
                key={doc.id}
                onClick={() => open(doc.id)}
                aria-current={selected === doc.id ? "true" : undefined}
                className={cn(
                  "flex w-full gap-3 border-b border-border p-4 text-left transition-colors hover:bg-muted/50",
                  selected === doc.id && "bg-muted/60",
                )}
              >
                <FileText
                  size={18}
                  className="mt-0.5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {doc.title}
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {doc.category_name || "Kategorisiz"} · v{doc.version}
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {KNOWLEDGE_VISIBILITY[doc.visibility]}
                  </span>
                </span>
              </button>
            ))
          ) : (
            <div className="space-y-2 p-7 text-sm text-muted-foreground">
              <BookOpen size={24} />
              <p>
                {q || category
                  ? "Aramanıza uygun belge yok."
                  : archived
                    ? "Arşivde belge yok."
                    : "Henüz belge eklenmedi."}
              </p>
            </div>
          )}
        </aside>
        <section
          aria-label="Belge içeriği"
          className="rf-panel min-w-0 p-4 md:p-6"
        >
          {(selected || editing) && (
            <button
              onClick={() => {
                clearSelection();
              }}
              className="rf-secondary-button mb-4 min-h-11 px-3 lg:hidden"
            >
              <ArrowLeft size={16} /> Belgelere dön
            </button>
          )}
          {editing ? (
            <form onSubmit={save} className="space-y-4">
              <h2 className="font-semibold">
                {detail ? "Belgeyi düzenle" : "Yeni belge"}
              </h2>
              <label className="block text-sm">
                Başlık
                <input
                  required
                  maxLength={180}
                  className="rf-input mt-1 w-full"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  Kategori
                  <select
                    className="rf-input mt-1 w-full"
                    value={form.categoryId}
                    onChange={(e) =>
                      setForm({ ...form, categoryId: e.target.value })
                    }
                  >
                    <option value="">Kategorisiz</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  Kimler görebilir?
                  <select
                    className="rf-input mt-1 w-full"
                    value={form.visibility}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        visibility: e.target.value as KnowledgeVisibility,
                      })
                    }
                  >
                    {Object.entries(KNOWLEDGE_VISIBILITY)
                      .filter(
                        ([key]) =>
                          key !== "managers" ||
                          ["owner", "admin"].includes(user?.role ?? ""),
                      )
                      .map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              <label className="block text-sm">
                İçerik / çalışma talimatı
                <textarea
                  className="rf-input mt-1 min-h-48 w-full resize-y py-3"
                  maxLength={100000}
                  value={form.content}
                  onChange={(e) =>
                    setForm({ ...form, content: e.target.value })
                  }
                />
              </label>
              <label className="rf-panel block space-y-2 border-dashed p-4 text-sm">
                <span className="flex gap-2 font-medium">
                  <Paperclip size={16} />{" "}
                  {detail?.hasFile
                    ? "Dosyanın yeni sürümünü yükle"
                    : "Dosya ekle"}
                </span>
                <input
                  type="file"
                  accept={ORDER_ALLOWED_FILE_TYPES.join(",")}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    if (f && f.size > 10 * 1024 * 1024) {
                      setError("Dosya en fazla 10 MB olabilir.");
                      e.target.value = "";
                      return;
                    }
                    setFile(f);
                    setRemoveFile(false);
                  }}
                />
                <span className="block text-xs text-muted-foreground">
                  PDF, görseller, Word ve Excel · en fazla 10 MB
                </span>
              </label>
              {detail?.hasFile && !file && (
                <label className="flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={removeFile}
                    onChange={(e) => setRemoveFile(e.target.checked)}
                  />{" "}
                  Mevcut dosyayı yeni sürümden kaldır (geçmişte korunur)
                </label>
              )}
              <label className="block text-sm">
                Sürüm notu
                <input
                  className="rf-input mt-1 w-full"
                  maxLength={500}
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="Bu sürümde ne değişti?"
                />
              </label>
              <div className="flex gap-2">
                <button
                  disabled={busy}
                  className="rf-primary-button min-h-11 px-4"
                >
                  {busy ? "Kaydediliyor…" : "Sürümü kaydet"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setEditing(false)}
                  className="rf-secondary-button min-h-11 px-4"
                >
                  Vazgeç
                </button>
              </div>
            </form>
          ) : detail ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">
                    {detail.revision.title}
                  </h2>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Lock size={12} />{" "}
                    {KNOWLEDGE_VISIBILITY[detail.document.visibility]} · v
                    {detail.revision.version} ·{" "}
                    {date(detail.revision.created_at)}
                  </p>
                  {detail.document.archived && (
                    <p className="mt-2 text-sm text-amber-600">
                      Bu belge arşivde.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={copyLink}
                    className="rf-secondary-button min-h-10 px-3"
                  >
                    <Link2 size={15} /> Bağlantı
                  </button>
                  <button
                    aria-expanded={showHistory}
                    onClick={() => setShowHistory((v) => !v)}
                    className="rf-secondary-button min-h-10 px-3"
                  >
                    <History size={15} /> Geçmiş
                  </button>
                  {canEdit && (
                    <>
                      <button
                        onClick={() => edit(detail)}
                        className="rf-secondary-button min-h-10 px-3"
                      >
                        Düzenle
                      </button>
                      <button
                        disabled={busy}
                        onClick={archive}
                        className="rf-secondary-button min-h-10 px-3"
                      >
                        {detail.document.archived ? (
                          <RotateCcw size={15} />
                        ) : (
                          <Archive size={15} />
                        )}{" "}
                        {detail.document.archived ? "Geri yükle" : "Arşivle"}
                      </button>
                    </>
                  )}
                </div>
              </div>
              {detail.revision.version !== detail.document.version && (
                <div className="rf-alert mt-4 flex items-center justify-between gap-3">
                  Eski sürümü görüntülüyorsunuz.
                  <button
                    className="underline"
                    onClick={() => open(detail.document.id)}
                  >
                    Güncel sürümü aç
                  </button>
                </div>
              )}
              {showHistory && (
                <ol
                  aria-label="Sürüm geçmişi"
                  className="my-4 divide-y divide-border rounded-lg border border-border"
                >
                  {detail.history.map((rev) => (
                    <li key={rev.version}>
                      <button
                        onClick={() => open(detail.document.id, rev.version)}
                        className="w-full space-y-1 p-3 text-left hover:bg-muted/50"
                      >
                        <span className="block text-sm font-medium">
                          v{rev.version} · {rev.author_name || "Ekip üyesi"}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {date(rev.created_at)}
                          {rev.note ? " · " + rev.note : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
              {detail.revision.content && (
                <div className="my-6 whitespace-pre-wrap break-words text-sm leading-7">
                  {detail.revision.content}
                </div>
              )}
              {detail.hasFile && (
                <div className="mt-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 p-3">
                    <span className="flex min-w-0 items-center gap-2 text-sm">
                      <Paperclip size={15} />
                      <span className="truncate">
                        {detail.revision.file_name}
                      </span>
                    </span>
                    <a
                      className="rf-secondary-button min-h-10 px-3"
                      href={contentUrl + "&download=1"}
                    >
                      <Download size={15} /> İndir
                    </a>
                  </div>
                  {detail.revision.mime === "application/pdf" ? (
                    <iframe
                      title="PDF belge önizlemesi"
                      src={contentUrl}
                      className="h-[65vh] min-h-80 w-full rounded-lg border border-border"
                    />
                  ) : detail.revision.mime?.startsWith("image/") ? (
                    <img
                      src={contentUrl}
                      alt={detail.revision.title}
                      className="max-h-[70vh] w-full rounded-lg object-contain"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Bu dosya türü tarayıcıda önizlenemiyor. İndirerek
                      açabilirsiniz.
                    </p>
                  )}
                </div>
              )}
            </>
          ) : selected && error ? (
            <p
              role="status"
              className="py-16 text-center text-sm text-muted-foreground"
            >
              Belge açılamadı. Yukarıdaki Yenile düğmesiyle yeniden
              deneyebilirsiniz.
            </p>
          ) : selected ? (
            <p
              role="status"
              className="py-16 text-center text-sm text-muted-foreground"
            >
              Belge açılıyor…
            </p>
          ) : (
            <div className="flex min-h-80 flex-col items-center justify-center gap-3 text-center">
              <BookOpen
                size={32}
                strokeWidth={1.25}
                className="text-muted-foreground"
              />
              <h2 className="font-semibold">
                Bilgi tek yerde, ekip aynı sayfada
              </h2>
              <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                Görüntülemek için bir belge seçin
                {canWrite
                  ? " veya ilk katalog, çizim ve talimatınızı ekleyin."
                  : "."}
              </p>
              {canWrite && (
                <button
                  onClick={() => edit()}
                  className="rf-primary-button mt-2 min-h-11 px-4"
                >
                  <Plus size={16} /> Belge oluştur
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
