# RenkFlow brand identity — 13 October 2026

The approved monogram and lettering come from the supplied monochrome logo reference, as vector outlines. The wordmark is artwork, not a font substitution. `components/brand/artwork.ts` and `public/brand/*.svg` share the same outlines.

`BrandMark` is the shared lockup; `BrandSymbol` is the symbol. Automatic color follows the interface theme, `tone="light"` supports fixed dark backgrounds. The sidebar keeps its symbol mounted and reveals the wordmark using scoped CSS, with a reduced-motion fallback. Browser tab titles include the current workspace module and RenkFlow. Favicons support system light/dark preferences; actual raster sizes are recorded in the PWA manifest, including a maskable icon. Brand assets are updated for existing email paths and old public logo URLs. Social cards, loading pages and platform credits on printouts use the approved identity. Issuing-company logos remain company data.

This release changes branding only. It contains no MES, stock, recipe, AI behavior, auth, database migration, provider configuration or landing-layout redesign.
