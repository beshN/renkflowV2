/**
 * A short burst of "aluminium offcuts" from a point on screen, in the spirit of the
 * completion moments collected on Design Spells. Imperative and attached to
 * document.body so it survives the client-side navigation that usually follows a
 * successful save. No-op for reduced motion and outside the browser.
 */
export function celebrate(origin?: { x: number; y: number }) {
  if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const x = origin?.x ?? window.innerWidth / 2;
  const y = origin?.y ?? window.innerHeight * 0.35;
  const layer = document.createElement('div');
  layer.setAttribute('aria-hidden', 'true');
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden';
  document.body.appendChild(layer);

  const tones = ['#c9ccd3', '#9ea3ad', '#e4e6ea', '#2f55f4', '#7b818c'];
  const pieces = 26;
  let finished = 0;
  for (let i = 0; i < pieces; i += 1) {
    const piece = document.createElement('span');
    const long = Math.random() > 0.45;
    const w = long ? 3 + Math.random() * 2 : 5 + Math.random() * 3;
    const h = long ? 12 + Math.random() * 10 : 5 + Math.random() * 3;
    piece.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-radius:1px;background:${tones[i % tones.length]};box-shadow:inset 0 0 0 0.5px rgba(0,0,0,.12)`;
    layer.appendChild(piece);
    const angle = (Math.PI * 2 * i) / pieces + (Math.random() - 0.5) * 0.6;
    const speed = 110 + Math.random() * 160;
    const dx = Math.cos(angle) * speed;
    const dy = Math.sin(angle) * speed - 60;
    const spin = (Math.random() - 0.5) * 720;
    piece.animate(
      [
        { transform: 'translate(-50%, -50%) rotate(0deg)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.45 },
        { transform: `translate(calc(-50% + ${dx * 1.25}px), calc(-50% + ${dy + 220}px)) rotate(${spin}deg)`, opacity: 0 },
      ],
      { duration: 1100 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' },
    ).onfinish = () => {
      finished += 1;
      if (finished === pieces) layer.remove();
    };
  }
  window.setTimeout(() => layer.remove(), 2500);
}
