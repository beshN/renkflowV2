'use client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ExternalLink, Globe2 } from 'lucide-react';
export function CompanyAddressSettings() {
  const [address, setAddress] = useState(''),
    [saved, setSaved] = useState<{
      address: string;
      version: number;
      url: string | null;
    } | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [reload, setReload] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setError('');
    fetch('/api/v1/company/address', {
      cache: 'no-store',
      signal: abort.signal,
    })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw Error(body.error);
        setSaved(body.data);
        setAddress(body.data.address);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message || 'Adres alınamadı.');
      });
    return () => abort.abort();
  }, [reload]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!saved) return;
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/v1/company/address', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, version: saved.version }),
      });
      const body = await r.json();
      if (!r.ok) throw Error(body.error);
      setSaved(body.data);
      setAddress(body.data.address);
      toast.success('Şirket adresi kaydedildi.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Adres kaydedilemedi.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <Globe2 size={20} aria-hidden />
        <div>
          <h2 className="font-semibold">Şirket adresi</h2>
          <p className="text-sm text-muted-foreground">
            Ekibiniz kendi adresinden, kendi şirketine giriş yapar.
          </p>
        </div>
      </div>
      {error && (
        <div role="alert" className="rf-alert">
          {error}{' '}
          <button
            type="button"
            onClick={() => setReload((v) => v + 1)}
            className="underline"
          >
            Yenile
          </button>
        </div>
      )}
      <form onSubmit={save} className="space-y-3">
        <label htmlFor="company-address" className="block text-sm font-medium">
          Adresiniz
        </label>
        <div className="flex items-center gap-2">
          <input
            id="company-address"
            required
            pattern="[a-z0-9][a-z0-9-]*"
            maxLength={63}
            autoCapitalize="none"
            autoCorrect="off"
            value={address}
            onChange={(e) => setAddress(e.target.value.toLowerCase())}
            className="rf-input min-w-0 flex-1"
            placeholder="renkaluminyum"
          />
          <span className="text-sm text-muted-foreground">.renkflow.com</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Adres kaydı şirketinize aittir. HTTPS ve DNS bağlantısı
          tamamlandığında kullanılabilir. Adres değişince eski şirket bağlantısı
          kapanır.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            className="rf-primary-button px-4 py-2"
            disabled={busy || !saved || saved.address === address}
          >
            {busy ? 'Kaydediliyor…' : 'Adresi kaydet'}
          </button>
          {saved?.url && (
            <a
              href={saved.url}
              target="_blank"
              rel="noreferrer"
              className="rf-secondary-button px-4 py-2"
            >
              Şirket adresini aç <ExternalLink size={14} />
            </a>
          )}
        </div>
      </form>
    </section>
  );
}
