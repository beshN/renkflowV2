'use client';

import { useEffect, useState } from 'react';
import { requestJson } from '@/lib/shared/network';
import { readNumber } from '@/lib/features/products/csv';
import { formatQty } from '@/lib/features/inventory/vocabulary';
import { ColorPicker } from '@/components/colors/ColorPicker';
import { ProductDrawing } from '@/components/drawing/ProductDrawing';
import { ProductConfigurator as Product3DEditor } from '@/components/features/product-3d/ProductConfigurator';
import { visualizationForRecipe } from '@/lib/features/product-3d/catalog';
import { SkeletonRows } from '@/components/kit';
import type { ConfigurationChoice, ProductConfiguration } from '@/lib/features/products/configuration';
import { formatCurrency } from '@/lib/utils';

type ParameterDefinition = { key: string; label: string; type: 'number' | 'boolean'; unit?: string; required?: boolean; defaultValue?: number | boolean; minimum?: number; maximum?: number; integer?: boolean };
type Options = {
  family: { key: string; label: string; dimensions: Array<{ key: 'widthMm' | 'projectionMm' | 'mountingHeightMm'; label: string }> };
  recipes: Array<{ id: string; code: string; name: string; version: number; parameters: ParameterDefinition[]; limits: Record<string, number> }>;
  colors: { favorites: Array<{ name: string; inStock: boolean }>; stock: string[] };
  matrix: { currency: string } | null;
};

const money = (n: number, currency: string) => formatCurrency(n, currency as Parameters<typeof formatCurrency>[1]);

/** The bill of materials and cut list a configuration gave, as the quote and the order show it. */
export function BomTables({ bom }: { bom: ProductConfiguration['bom'] }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <table className="w-full text-left text-xs">
        <caption className="mb-1 text-left font-medium">Kesim listesi (1 ürün)</caption>
        <thead><tr>{['Profil', 'Boy', 'Parça'].map((h) => <th key={h} className="p-1 text-muted-foreground">{h}</th>)}</tr></thead>
        <tbody>
          {bom.cuts.map((c, i) => <tr key={i} className="border-t border-border"><td className="p-1">{c.name}</td><td className="p-1 tabular-nums">{formatQty(c.lengthMm)} mm</td><td className="p-1 tabular-nums">{c.quantity}</td></tr>)}
          {!bom.cuts.length && <tr><td className="p-1 text-muted-foreground" colSpan={3}>Kesim yok</td></tr>}
        </tbody>
      </table>
      <table className="w-full text-left text-xs">
        <caption className="mb-1 text-left font-medium">Malzeme listesi (1 ürün)</caption>
        <thead><tr>{['Malzeme', 'Miktar'].map((h) => <th key={h} className="p-1 text-muted-foreground">{h}</th>)}</tr></thead>
        <tbody>{bom.materials.map((m) => <tr key={m.itemId} className="border-t border-border"><td className="p-1">{m.name}</td><td className="p-1 tabular-nums">{formatQty(m.quantity, m.uom)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

/**
 * Measure-based configuration of one quote line: recipe (model), measures, options, colour. The
 * server works out the bill of materials and the price; this only collects the choice and shows it.
 */
export function ProductConfigurator({ family, currency, initial, onApply, onClose }: {
  family: string;
  currency: string;
  initial?: ConfigurationChoice;
  onApply: (configuration: ProductConfiguration) => void;
  onClose: () => void;
}) {
  const [options, setOptions] = useState<Options | null>(null);
  const [error, setError] = useState('');
  const [recipeId, setRecipeId] = useState(initial?.recipeId ?? '');
  const [dims, setDims] = useState<Record<string, string>>({
    widthMm: initial ? String(initial.parameters.widthMm) : '',
    projectionMm: initial ? String(initial.parameters.projectionMm) : '',
    mountingHeightMm: initial ? String(initial.parameters.mountingHeightMm) : '',
  });
  const [motor, setMotor] = useState(initial?.parameters.motor ?? false);
  const [led, setLed] = useState(initial?.parameters.led ?? false);
  const [custom, setCustom] = useState<Record<string, number | boolean | string>>(initial?.parameters.customParameters ?? {});
  const [color, setColor] = useState(initial?.color ?? '');
  const [preview, setPreview] = useState<ProductConfiguration | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void requestJson<Options>(`/api/v1/products/configure?family=${family}`, { signal: controller.signal }).then((r) => {
      if (controller.signal.aborted) return;
      if (r.ok && r.data) {
        setOptions(r.data);
        if (recipeId && !r.data.recipes.some((x) => x.id === recipeId)) {
          setRecipeId('');
          setError('Kalemdeki reçete sürümü artık güncel değil; güncel modeli seçip yeniden hesaplayın.');
        } else if (!recipeId && r.data.recipes.length === 1) setRecipeId(r.data.recipes[0].id);
      } else setError(r.error || 'Yapılandırma seçenekleri alınamadı');
    });
    return () => controller.abort();
  }, [family]);

  const recipe = options?.recipes.find((r) => r.id === recipeId);
  const visual = visualizationForRecipe({ family, color, parameters: { widthMm: readNumber(dims.widthMm ?? '') ?? 0, projectionMm: readNumber(dims.projectionMm ?? '') ?? 0, mountingHeightMm: readNumber(dims.mountingHeightMm ?? '') ?? 0, led } });

  const calculate = async () => {
    setError('');
    setPreview(null);
    const parameters: Record<string, number> = {};
    for (const d of options!.family.dimensions) {
      const n = readNumber(dims[d.key] ?? '');
      if (n === null || !Number.isInteger(n) || n <= 0) return setError(`${d.label}: tam sayı mm girin`);
      parameters[d.key] = n;
    }
    const customParameters: Record<string, number | boolean> = {};
    for (const p of recipe?.parameters ?? []) {
      const v = custom[p.key];
      if (p.type === 'boolean') customParameters[p.key] = Boolean(v ?? p.defaultValue);
      else if (v !== undefined && v !== '') {
        const n = typeof v === 'number' ? v : readNumber(String(v));
        if (n === null) return setError(`${p.label}: sayı girin`);
        customParameters[p.key] = n;
      }
    }
    setBusy(true);
    try {
      const r = await requestJson<{ data: ProductConfiguration }>('/api/v1/products/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency, choice: { family, recipeId, color, parameters: { ...parameters, motor, led, customParameters } } }),
      });
      if (r.ok && r.data) setPreview(r.data.data);
      else setError(r.error || 'Hesaplanamadı');
    } finally {
      setBusy(false);
    }
  };

  if (!options) return error ? <div className="rounded-md border border-border p-3 text-xs" role="alert">{error}</div> : <SkeletonRows rows={3} className="rounded-md border border-border p-3" />;
  if (!options.recipes.length)
    return (
      <div className="rounded-md border border-amber-300 p-3 text-xs text-amber-800 dark:text-amber-200" role="alert">
        {options.family.label} için yayında reçete yok. Reçeteyi Ürün reçeteleri ekranından yükleyip örneklerle doğrulayarak yayınlayın.
        <button type="button" className="ml-3 underline" onClick={onClose}>Kapat</button>
      </div>
    );
  return (
    <div className="space-y-3 rounded-md border border-border p-3" role="group" aria-label={`${options.family.label} yapılandırma`}>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="text-xs sm:col-span-2">Model
          <select className="rf-input mt-2 w-full" value={recipeId} onChange={(e) => { setRecipeId(e.target.value); setCustom({}); setPreview(null); }}>
            <option value="">Seçin</option>
            {options.recipes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        {options.family.dimensions.map((d) => (
          <label key={d.key} className="text-xs">{d.label}
            <input className="rf-input mt-2 w-full" inputMode="numeric" value={dims[d.key] ?? ''} onChange={(e) => { setDims({ ...dims, [d.key]: e.target.value }); setPreview(null); }} />
          </label>
        ))}
        {['wind-manual','wind-piston','giyotin'].includes(family)?<p className="text-xs">{family==='giyotin'?'Motorlu mekanizma':family==='wind-piston'?'Pistonlu mekanizma':'Manuel mekanizma'}</p>:<label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={motor} onChange={(e) => { setMotor(e.target.checked); setPreview(null); }} /> Motor</label>}
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={led} onChange={(e) => { setLed(e.target.checked); setPreview(null); }} /> LED</label>
        {recipe?.parameters.map((p) =>
          p.type === 'boolean' ? (
            <label key={p.key} className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={Boolean(custom[p.key] ?? p.defaultValue)} onChange={(e) => { setCustom({ ...custom, [p.key]: e.target.checked }); setPreview(null); }} /> {p.label}
            </label>
          ) : (
            <label key={p.key} className="text-xs">{p.label}{p.unit ? ` (${p.unit})` : ''}{p.minimum !== undefined && p.maximum !== undefined ? ` ${p.minimum}–${p.maximum}` : ''}
              <input className="rf-input mt-2 w-full" inputMode="decimal" placeholder={p.defaultValue !== undefined ? String(p.defaultValue) : 'gerekli'} value={String(custom[p.key] ?? '')} onChange={(e) => { setCustom({ ...custom, [p.key]: e.target.value }); setPreview(null); }} />
            </label>
          ),
        )}
      </div>
      {/* Redraws as the measures are typed; the frame takes the chosen colour. */}
      <div className="rounded-md border border-border bg-background p-2">
        {visual ? <Product3DEditor value={visual} readOnly /> : <ProductDrawing family={family} widthMm={readNumber(dims.widthMm ?? '')} projectionMm={readNumber(dims.projectionMm ?? '')} heightMm={readNumber(dims.mountingHeightMm ?? '')} color={color} className="h-auto w-full max-h-72" />}
      </div>
      <ColorPicker
        value={color}
        onChange={(next) => { setColor(next); setPreview(null); }}
        favorites={options.colors.favorites.map((c) => c.name)}
        stockColors={options.colors.stock}
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rf-secondary-button" disabled={busy || !recipeId || !color} onClick={() => void calculate()}>{busy ? 'Hesaplanıyor…' : 'Fiyatı hesapla'}</button>
        <button type="button" className="rf-secondary-button" onClick={onClose}>Vazgeç</button>
      </div>
      {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
      {preview && (
        <div className="space-y-3">
          <details><summary className="cursor-pointer text-xs font-medium">Malzeme ve kesim listesi</summary><div className="mt-3"><BomTables bom={preview.bom} /></div></details>
          {preview.price.source === 'matrix' ? (
            <p className="text-sm">Birim fiyat (fiyat matrisinden): <strong>{money(preview.price.matrixUnitPrice!, currency)}</strong> <span className="text-xs text-muted-foreground">{preview.price.lines.map((l) => `${l.label}: ${money(l.amount, currency)}`).join(' · ')}</span></p>
          ) : (
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">{preview.price.message}. Birim fiyatı kalemde elle girin; kalem &quot;fiyat elle girildi&quot; diye işaretlenir.</p>
          )}
          <button type="button" className="rf-primary-button" onClick={() => onApply(preview)}>Kaleme uygula</button>
        </div>
      )}
    </div>
  );
}
