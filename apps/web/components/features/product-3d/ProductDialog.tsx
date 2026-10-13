"use client";
import { useState } from "react";
import { Box, X } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { AwningConfigurator } from "@/components/features/awning/AwningConfigurator";
import type { AwningConfiguration } from "@/lib/features/awning/configuration";
import {
  PRODUCT_CATALOG,
  productMeta,
  type ProductKind,
  type ProductVisualization,
} from "@/lib/features/product-3d/catalog";
import { ProductConfigurator } from "./ProductConfigurator";
export function ProductDialog({
  visualization,
  awningConfiguration,
  previewImage,
  readOnly = false,
  label = "3D görünüm",
  onApply,
  onApplyAwning,
}: {
  visualization?: ProductVisualization | null;
  awningConfiguration?: AwningConfiguration | null;
  previewImage?: string | null;
  readOnly?: boolean;
  label?: string;
  onApply?: (v: ProductVisualization) => void;
  onApplyAwning?: (c: AwningConfiguration, image?: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [selected, setSelected] = useState<ProductKind | "makasli" | "">(
      visualization?.configuration.kind ??
        (awningConfiguration ? "makasli" : ""),
    );
  const title =
    selected === "makasli"
      ? "WINMAX Makaslı Tente"
      : selected
        ? productMeta(selected).name
        : "Ürün seçin";
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v)
          setSelected(
            visualization?.configuration.kind ??
              (awningConfiguration ? "makasli" : ""),
          );
      }}
    >
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 text-xs font-medium text-primary"
        >
          <Box size={15} />
          {label}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-0 z-[81] overflow-y-auto bg-card p-5 sm:inset-6 sm:rounded-xl sm:p-7 xl:inset-x-[8%]">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-xl font-semibold">
                {title}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-muted-foreground">
                Ölçü ve donanıma özel etkileşimli 3D görünüm
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border"
              aria-label="3D görünümü kapat"
            >
              <X size={20} />
            </Dialog.Close>
          </div>
          {!readOnly && (
            <label className="mb-5 block max-w-sm text-xs">
              Ürün
              <select
                aria-label="3D ürün seçimi"
                className="rf-input mt-2 w-full"
                value={selected}
                onChange={(e) => setSelected(e.target.value as typeof selected)}
              >
                <option value="">Ürün seçin…</option>
                <option value="makasli">WINMAX Makaslı Tente</option>
                {PRODUCT_CATALOG.map((p) => (
                  <option key={p.kind} value={p.kind}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {selected === "makasli" ? (
            <AwningConfigurator
              value={awningConfiguration ?? undefined}
              readOnly={readOnly}
              previewImage={previewImage ?? undefined}
              onApply={(c, image) => {
                onApplyAwning?.(c, image);
                setOpen(false);
              }}
            />
          ) : selected ? (
            <ProductConfigurator
              key={selected}
              kind={selected}
              value={
                visualization?.configuration.kind === selected
                  ? visualization
                  : undefined
              }
              readOnly={readOnly}
              onApply={(v) => {
                onApply?.(v);
                setOpen(false);
              }}
            />
          ) : (
            <p className="rounded-md border border-border p-6 text-sm text-muted-foreground">
              İncelemek istediğiniz ürünü seçin.
            </p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
