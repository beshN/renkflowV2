import { PICKER_PRODUCTS, type FairKind } from './products';

/**
 * Photos from Renk Alüminyum's own application archive (renkaluminyum.com, see
 * docs/product-3d/source-manifest.json), cropped and compressed under public/images/configurator.
 * Small enough for the kiosk to keep all of them offline.
 */
const BASE = '/images/configurator';

export const productImage = (kind: FairKind) => `${BASE}/products/${kind}.webp`;

/** Full-screen scenes of the kiosk's idle screen, each tied to the product it shows. */
export const ATTRACT_SLIDES: ReadonlyArray<{ src: string; kind: FairKind }> = [
  { src: `${BASE}/attract/1.webp`, kind: 'rolling-roof' },
  { src: `${BASE}/attract/2.webp`, kind: 'makasli' },
  { src: `${BASE}/attract/3.webp`, kind: 'pergola' },
  { src: `${BASE}/attract/4.webp`, kind: 'sliding-glass' },
  { src: `${BASE}/attract/5.webp`, kind: 'pergola' },
  { src: `${BASE}/attract/6.webp`, kind: 'wind-piston' },
];

const KINDS: FairKind[] = PICKER_PRODUCTS.map((p) => p.kind);

const LOGOS = ['renk-logo', 'renk-logo-white', 'renk-wordmark', 'renk-wordmark-white'].map((name) => `${BASE}/brand/${name}.svg`);

/** Every image the configurator shows, for the kiosk's offline cache. */
export const CONFIGURATOR_MEDIA: string[] = [...LOGOS, ...ATTRACT_SLIDES.map((s) => s.src), ...KINDS.map(productImage)];
