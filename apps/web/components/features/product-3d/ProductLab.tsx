"use client";
import { useState } from "react";
import { ProductConfigurator } from "./ProductConfigurator";
import {
  productMeta,
  type ProductKind,
  type ProductVisualization,
} from "@/lib/features/product-3d/catalog";

/** Mounted only by the development-only lab route. No customer data or database writes. */
export function ProductLab({ kind }: { kind: ProductKind }) {
  const [saved, setSaved] = useState<ProductVisualization>(),
    [readOnly, setReadOnly] = useState(false);
  const [artifact, setArtifact] = useState("");
  async function save(v: ProductVisualization) {
    setSaved(v);
    setArtifact("");
    if (v.image) {
      const result = await fetch("/api/product-3d-lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
      if (result.ok) setArtifact((await result.json()).file);
    }
  }
  return (
    <>
      <ProductConfigurator
        key={readOnly ? "saved" : "editor"}
        kind={saved?.configuration.kind ?? kind}
        value={saved}
        readOnly={readOnly}
        showProductPicker={!readOnly}
        onApply={save}
      />
      {saved && (
        <div className="mt-5 flex flex-wrap items-center gap-4 rounded border border-border p-4 text-sm">
          <p role="status">
            Test görünümü kaydedildi:{" "}
            {productMeta(saved.configuration.kind).name}
          </p>
          {artifact && <p role="status">İnceleme dosyası hazır: {artifact}</p>}
          {saved.image && (
            <a
              href={saved.image}
              download={`${saved.configuration.kind}-3d.jpg`}
              className="underline"
            >
              İnceleme görselini indir
            </a>
          )}
          <button
            type="button"
            className="min-h-11 rounded border border-border px-3"
            onClick={() => setReadOnly((v) => !v)}
          >
            {readOnly ? "Düzenlemeye dön" : "Kaydedilmiş görünümü aç"}
          </button>
        </div>
      )}
    </>
  );
}
