'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Check,
  Download,
  FileSpreadsheet,
  FileUp,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { StatusChip, type Tone } from '@/components/kit';
import { toCsv } from '@/lib/features/products/csv';
import { requestJson } from '@/lib/shared/network';

type Outcome = 'new' | 'exists' | 'fill' | 'name_match' | 'error';
type Result = {
  dryRun: boolean;
  previewHash: string;
  columns: Record<string, string>;
  ignored: string[];
  summary: {
    new: number;
    exists: number;
    filled: number;
    nameMatches: number;
    errors: number;
  };
  rows: Array<{
    line: number;
    name: string;
    outcome: Outcome;
    matchedId?: string;
    filled?: string[];
    errors?: string[];
  }>;
};
type Options = { fillEmpty: boolean; includeNameMatches: boolean };
type Config = {
  endpoint: string;
  template: string;
  templateName: string;
  listHref: string;
  cardHref?: (id: string) => string;
  noun: string;
  description: string;
  canFill?: boolean;
  allowNameDuplicates?: boolean;
  fieldLabels?: Record<string, string>;
};
const OUTCOME: Record<Outcome, { before: string; after: string; tone: Tone }> =
  {
    new: {
      before: 'Yeni kart açılacak',
      after: 'Yeni kart açıldı',
      tone: 'success',
    },
    exists: {
      before: 'Kayıtlı · atlanacak',
      after: 'Kayıtlı · atlandı',
      tone: 'neutral',
    },
    fill: {
      before: 'Boş alanlar tamamlanacak',
      after: 'Boş alanlar tamamlandı',
      tone: 'info',
    },
    name_match: {
      before: 'Aynı adlı kart · atlanacak',
      after: 'Aynı adlı kart · atlandı',
      tone: 'warning',
    },
    error: {
      before: 'Kontrol gerekli · atlanacak',
      after: 'Aktarılamadı',
      tone: 'danger',
    },
  };
const FIELD_LABELS: Record<string, string> = {
  fullName: 'Ad',
  full_name: 'Ad',
  companyName: 'Firma',
  company_name: 'Firma',
  phone: 'Telefon',
  email: 'E-posta',
  taxNumber: 'VKN/TCKN',
  tax_number: 'VKN/TCKN',
  taxOffice: 'Vergi dairesi',
  tax_office: 'Vergi dairesi',
  address: 'Adres',
  city: 'İl',
  district: 'İlçe',
  notes: 'Not',
  contact_name: 'Yetkili',
};
const PAGE_SIZE = 50;
const spreadsheetSafe = (value: string) =>
  /^[=+@-]/.test(value.trimStart()) ? "'" + value : value;

/** Shared preview → confirm workflow. A server fingerprint protects the preview from stale writes. */
export function CsvImportWizard({
  endpoint,
  template,
  templateName,
  listHref,
  cardHref,
  noun,
  description,
  canFill = true,
  allowNameDuplicates = true,
  fieldLabels = {},
}: Config) {
  const [text, setText] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [options, setOptions] = useState<Options>({
    fillEmpty: false,
    includeNameMatches: false,
  });
  const [preview, setPreview] = useState<Result | null>(null);
  const [done, setDone] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Outcome | 'all'>('all');
  const [page, setPage] = useState(0);
  const [dragging, setDragging] = useState(false);
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);

  async function request(
    content: string,
    settings: Options,
    dryRun: boolean,
    previewHash?: string,
  ) {
    controller.current?.abort();
    const ac = new AbortController();
    controller.current = ac;
    const response = await requestJson<Result>(
      endpoint,
      {
        method: 'POST',
        signal: ac.signal,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: content,
          dryRun,
          ...settings,
          ...(previewHash ? { previewHash } : {}),
        }),
      },
      { timeoutMs: 120_000 },
    );
    if (!mounted.current || ac.signal.aborted) return null;
    if (!response.ok || !response.data) {
      setError(response.error || 'Dosya işlenemedi.');
      return null;
    }
    return response.data;
  }

  async function operation(work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await work();
    } catch {
      if (mounted.current)
        setError('Dosya okunamadı. CSV olarak kaydedip yeniden deneyin.');
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function pick(file?: File) {
    if (!file || lock.current) return;
    await operation(async () => {
      setText(null);
      setFileName('');
      setPreview(null);
      setDone(null);
      setPage(0);
      setFilter('all');
      if (!/\.(csv|txt)$/i.test(file.name)) {
        setError(
          'CSV dosyası seçin. Excel dosyanızı önce CSV olarak kaydedebilirsiniz.',
        );
        return;
      }
      if (file.size > 2_000_000) {
        setError(
          'Dosya 2 MB sınırını aşıyor. Listeyi daha küçük dosyalara bölün.',
        );
        return;
      }
      if (!file.size) {
        setError('Seçilen dosya boş.');
        return;
      }
      const buffer = await file.arrayBuffer();
      let content: string;
      try {
        content = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      } catch {
        content = new TextDecoder('windows-1254', { fatal: true }).decode(
          buffer,
        );
      }
      if (content.includes('\0')) {
        setError(
          'Dosya metin biçiminde değil. CSV olarak kaydedip tekrar seçin.',
        );
        return;
      }
      if (!mounted.current) return;
      setText(content);
      setFileName(file.name);
      const result = await request(content, options, true);
      if (result) {
        setPreview(result);
        requestAnimationFrame(() => resultHeading.current?.focus());
      }
    });
  }

  async function refresh(next = options) {
    if (!text) return;
    await operation(async () => {
      setOptions(next);
      setPreview(null);
      setPage(0);
      setFilter('all');
      const result = await request(text, next, true);
      if (result) setPreview(result);
    });
  }

  async function confirm() {
    if (!text || !preview || busy) return;
    await operation(async () => {
      const result = await request(text, options, false, preview.previewHash);
      if (result) {
        setDone(result);
        setPreview(null);
        setText(null);
        setPage(0);
        setFilter('all');
        requestAnimationFrame(() => resultHeading.current?.focus());
      } else setPreview(null); // Refresh the preview after a conflict, lost response or denied write.
    });
  }

  const labels = { ...FIELD_LABELS, ...fieldLabels };
  const shown = preview ?? done;
  const filtered =
    shown?.rows.filter((row) => filter === 'all' || row.outcome === filter) ??
    [];
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const rows = filtered.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE,
  );
  const stage = done ? 2 : shown ? 1 : 0;
  const issues =
    shown?.rows.filter(
      (row) => row.outcome === 'error' || row.outcome === 'name_match',
    ) ?? [];
  const issueReport = toCsv([
    ['Satır', 'Ad', 'Sonuç', 'Açıklama'],
    ...issues.map((row) => [
      row.line,
      spreadsheetSafe(row.name),
      OUTCOME[row.outcome][done ? 'after' : 'before'],
      spreadsheetSafe(
        row.errors?.join('; ') || 'Aynı adlı kart var. Kaydı kontrol edin.',
      ),
    ]),
  ]);
  const download = (content: string) =>
    `data:text/csv;charset=utf-8,${encodeURIComponent(content)}`;

  return (
    <div className="space-y-5" aria-busy={busy}>
      <ol aria-label="Aktarım adımları" className="grid grid-cols-3 gap-2">
        {['Dosyayı seç', 'Önizle ve kontrol et', 'Aktarımı tamamla'].map(
          (label, index) => (
            <li
              key={label}
              aria-current={stage === index ? 'step' : undefined}
              className={`flex items-center gap-2 rounded-xl border p-3 text-xs sm:text-sm ${stage === index ? 'border-primary/30 bg-primary/5 text-foreground' : 'border-border text-muted-foreground'}`}
            >
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs ${stage >= index ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
              >
                {stage > index ? <Check size={13} aria-hidden /> : index + 1}
              </span>
              {label}
            </li>
          ),
        )}
      </ol>
      <section className="rf-panel space-y-4 p-4 sm:p-6">
        <div>
          <h2 className="rf-section-title">{noun} listenizi yükleyin</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
        <div
          className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors ${dragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/20'}`}
          onDragOver={(event) => {
            event.preventDefault();
            if (!busy) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void pick(event.dataTransfer.files[0]);
          }}
        >
          <FileSpreadsheet
            className="mx-auto mb-3 text-muted-foreground"
            size={30}
            aria-hidden
          />
          <p className="mb-3 text-sm">
            CSV dosyanızı buraya sürükleyin veya seçin
          </p>
          <button
            type="button"
            className="rf-primary-button inline-flex items-center gap-2 text-sm"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            <FileUp size={16} aria-hidden /> Dosya seç
          </button>
          <input
            ref={fileInput}
            type="file"
            aria-label={`${noun} CSV dosyası`}
            accept=".csv,.txt"
            className="sr-only"
            tabIndex={-1}
            disabled={busy}
            onChange={(event) => {
              void pick(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            En fazla 2 MB ve 2.000 satır · Türkçe Excel CSV dosyaları
            desteklenir
          </p>
          {fileName && (
            <p className="mt-3 break-all text-sm font-medium">{fileName}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <a
            href={download('\uFEFF' + template)}
            download={templateName}
            className="rf-secondary-button inline-flex items-center gap-2 text-sm"
          >
            <Download size={14} aria-hidden /> Örnek şablonu indir
          </a>
          {text && (
            <button
              type="button"
              disabled={busy}
              className="rf-secondary-button inline-flex items-center gap-2 text-sm"
              onClick={() => void refresh()}
            >
              <RefreshCw size={14} aria-hidden /> Önizlemeyi yenile
            </button>
          )}
        </div>
        <fieldset
          className="space-y-3 border-t border-border pt-4 text-sm"
          disabled={busy || Boolean(done)}
        >
          <legend className="sr-only">Eşleşen kayıtlar</legend>
          {canFill && (
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={options.fillEmpty}
                onChange={(event) =>
                  text
                    ? void refresh({
                        ...options,
                        fillEmpty: event.target.checked,
                      })
                    : setOptions({
                        ...options,
                        fillEmpty: event.target.checked,
                      })
                }
              />
              <span>
                Kayıtlı kartların boş alanlarını tamamla
                <span className="mt-1 block text-xs text-muted-foreground">
                  Dolu alanlar korunur. Çelişen bilgiler otomatik
                  birleştirilmez.
                </span>
              </span>
            </label>
          )}
          {allowNameDuplicates && (
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={options.includeNameMatches}
                onChange={(event) =>
                  text
                    ? void refresh({
                        ...options,
                        includeNameMatches: event.target.checked,
                      })
                    : setOptions({
                        ...options,
                        includeNameMatches: event.target.checked,
                      })
                }
              />
              <span>
                Yalnız adı aynı olan kişiler için ayrı kart aç
                <span className="mt-1 block text-xs text-muted-foreground">
                  Varsayılan olarak aynı adlı kayıtlar incelemeniz için atlanır.
                </span>
              </span>
            </label>
          )}
        </fieldset>
        {busy && (
          <p role="status" className="flex items-center gap-2 text-sm">
            <Loader2
              size={16}
              className="animate-spin motion-reduce:animate-none"
              aria-hidden
            />{' '}
            Dosya işleniyor…
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
          >
            {error}
          </p>
        )}
      </section>
      {shown && (
        <section
          className="rf-panel space-y-4 p-4 sm:p-6"
          aria-labelledby="import-result"
        >
          <div>
            <h2
              id="import-result"
              ref={resultHeading}
              tabIndex={-1}
              className="rf-section-title outline-none"
            >
              {done ? 'Aktarım sonucu' : 'Kaydetmeden önce kontrol edin'}
            </h2>
            <p
              className="mt-1 text-sm text-muted-foreground"
              aria-live="polite"
            >
              {done
                ? 'Geçerli satırlar işlendi. Atlanan satırları aşağıdan inceleyebilirsiniz.'
                : 'Henüz bir kayıt değişmedi. Aşağıdaki sonuçları kontrol edip aktarımı onaylayın.'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              [shown.summary.new, 'Yeni kart'],
              [
                shown.summary.filled,
                done ? 'Tamamlanan kart' : 'Tamamlanacak kart',
              ],
              [shown.summary.exists, 'Zaten kayıtlı'],
              [
                shown.summary.errors + shown.summary.nameMatches,
                'Kontrol gerekli',
              ],
            ].map(([count, label]) => (
              <div key={label} className="rounded-xl border border-border p-3">
                <p className="text-2xl font-semibold tabular-nums">{count}</p>
                <p className="mt-1 text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          <details className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium">
              Sütun eşleşmeleri
            </summary>
            <dl className="mt-2 grid gap-2 sm:grid-cols-2">
              {Object.entries(shown.columns).map(([field, header]) => (
                <div key={field}>
                  <dt className="inline font-medium text-foreground">
                    {header}
                  </dt>
                  <dd className="inline"> → {labels[field] ?? field}</dd>
                </div>
              ))}
            </dl>
            {shown.ignored.length > 0 && (
              <p className="mt-2">
                Kullanılmayan sütunlar: {shown.ignored.join(', ')}
              </p>
            )}
          </details>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="text-sm">
              Satırları göster{' '}
              <select
                className="rf-input ml-2"
                value={filter}
                onChange={(event) => {
                  setFilter(event.target.value as Outcome | 'all');
                  setPage(0);
                }}
              >
                <option value="all">Tümü ({shown.rows.length})</option>
                {(Object.keys(OUTCOME) as Outcome[]).map((outcome) => (
                  <option key={outcome} value={outcome}>
                    {OUTCOME[outcome][done ? 'after' : 'before']} (
                    {shown.rows.filter((row) => row.outcome === outcome).length}
                    )
                  </option>
                ))}
              </select>
            </label>
            {issues.length > 0 && (
              <a
                className="rf-secondary-button inline-flex items-center gap-2 text-xs"
                href={download(issueReport)}
                download="kontrol-edilecek-satirlar.csv"
              >
                <Download size={14} aria-hidden /> Kontrol listesini indir
              </a>
            )}
          </div>
          <ul
            className="space-y-3 sm:hidden"
            aria-label={`${noun} aktarımı satır sonuçları`}
          >
            {rows.map((row) => (
              <li
                key={row.line}
                className="space-y-2 rounded-xl border border-border p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 break-words text-sm font-medium">
                    {row.name || 'Adsız satır'}
                  </p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    Satır {row.line}
                  </span>
                </div>
                <StatusChip
                  tone={OUTCOME[row.outcome].tone}
                  label={OUTCOME[row.outcome][done ? 'after' : 'before']}
                />
                {row.errors && (
                  <p className="text-xs leading-5 text-muted-foreground">
                    {row.errors.join('; ')}
                  </p>
                )}
                {row.filled && (
                  <p className="text-xs leading-5 text-muted-foreground">
                    {done ? 'Tamamlanan' : 'Tamamlanacak'}:{' '}
                    {row.filled
                      .map((field) => labels[field] ?? field)
                      .join(', ')}
                  </p>
                )}
                {row.matchedId && cardHref && (
                  <Link
                    href={cardHref(row.matchedId)}
                    className="inline-flex py-1 text-xs text-primary underline"
                  >
                    Kayıtlı kartı incele
                  </Link>
                )}
              </li>
            ))}
            {rows.length === 0 && (
              <li className="p-4 text-center text-sm text-muted-foreground">
                Bu filtreye uygun satır yok.
              </li>
            )}
          </ul>
          <div className="hidden overflow-x-auto rounded-xl border border-border sm:block">
            <table className="w-full min-w-[560px] text-sm">
              <caption className="sr-only">
                {noun} aktarımı satır sonuçları
              </caption>
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="p-3">
                    Satır
                  </th>
                  <th scope="col" className="p-3">
                    Ad
                  </th>
                  <th scope="col" className="p-3">
                    Sonuç
                  </th>
                  <th scope="col" className="p-3">
                    Ayrıntı
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.line} className="border-t border-border">
                    <td className="p-3 tabular-nums">{row.line}</td>
                    <td className="p-3 font-medium">{row.name || '—'}</td>
                    <td className="p-3">
                      <StatusChip
                        tone={OUTCOME[row.outcome].tone}
                        label={OUTCOME[row.outcome][done ? 'after' : 'before']}
                      />
                    </td>
                    <td className="max-w-sm p-3 text-xs leading-5">
                      {row.errors?.join('; ')}
                      {row.filled &&
                        `${done ? 'Tamamlanan' : 'Tamamlanacak'}: ${row.filled.map((field) => labels[field] ?? field).join(', ')}`}
                      {row.matchedId && cardHref && (
                        <>
                          {' '}
                          <Link
                            href={cardHref(row.matchedId)}
                            className="text-primary underline"
                          >
                            Kayıtlı kartı incele
                          </Link>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Bu filtreye uygun satır yok.
              </p>
            )}
          </div>
          {pages > 1 && (
            <nav
              aria-label="Aktarım sonuçları sayfaları"
              className="flex items-center justify-between text-sm"
            >
              <button
                type="button"
                className="rf-secondary-button"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                Önceki
              </button>
              <span>
                {currentPage + 1} / {pages}
              </span>
              <button
                type="button"
                className="rf-secondary-button"
                disabled={currentPage === pages - 1}
                onClick={() => setPage(currentPage + 1)}
              >
                Sonraki
              </button>
            </nav>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              {issues.length
                ? `${issues.length} satır ${done ? 'atlandı' : 'atlanacak'}; kontrol listesini indirip düzeltebilirsiniz.`
                : 'Tüm satırlar kontrol edildi.'}
            </p>
            {preview && (
              <button
                type="button"
                className="rf-primary-button text-sm"
                disabled={
                  busy || preview.summary.new + preview.summary.filled === 0
                }
                onClick={() => void confirm()}
              >
                {busy
                  ? 'Aktarılıyor…'
                  : `${preview.summary.new + preview.summary.filled} geçerli satırı aktar`}
              </button>
            )}
            {done && (
              <Link
                href={listHref}
                className="rf-primary-button inline-flex text-sm"
              >
                Listeye dön
              </Link>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
