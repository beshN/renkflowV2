import { BRAND_ARTWORK } from './artwork';

/** Approved symbol and lettering; currentColor follows the surrounding theme. */
export function BrandSymbol({className}:{className?:string}) {
  const art=BRAND_ARTWORK.mark;
  return <svg className={className} data-brand-symbol="renkflow" viewBox={`0 0 ${art.width} ${art.height}`} fill="currentColor" aria-hidden="true" focusable="false"><path fillRule="evenodd" d={art.path}/></svg>;
}
export function BrandWordmark({className}:{className?:string}) {
  const art=BRAND_ARTWORK.wordmark;
  return <svg className={className} data-brand-wordmark="renkflow" viewBox={`0 0 ${art.width} ${art.height}`} fill="currentColor" aria-hidden="true" focusable="false"><path fillRule="evenodd" d={art.path}/></svg>;
}
