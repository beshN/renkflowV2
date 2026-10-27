/**
 * One colourful brush stroke across the page, in the RAL strip colours. Imperative and
 * attached to document.body like celebrate(); pointer-events none, gone after ~2.5 s.
 * Reduced motion: the stroke appears whole and only fades.
 */
const COLORS = ['#6b4a3a', '#c9a07a', '#a5a8a6', '#4a5256', '#3b78ad'];
const BRUSH_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M27 3 14 17l3 3L29 6c.9-1.2-.8-3.4-2-3Z" fill="#6b4a3a" stroke="#fff" stroke-width="1.2"/><path d="m12.5 18.5 3 3-1.5 1.5c-1.3 3.4-5.6 6-10.5 6 2.4-2 1.5-5 4-8l5-2.5Z" fill="#c9a07a" stroke="#1e2427" stroke-width="1.2"/></svg>',
)}") 3 29, crosshair`;

let active = false;

export function paintStroke() {
  if (typeof window === 'undefined' || active) return;
  active = true;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const y = h * (0.35 + Math.random() * 0.3);
  const lift = h * 0.12;
  const d = `M ${-w * 0.05} ${y + lift * 0.4} C ${w * 0.22} ${y - lift}, ${w * 0.42} ${y + lift}, ${w * 0.6} ${y - lift * 0.2} S ${w * 0.9} ${y - lift * 0.6}, ${w * 1.05} ${y + lift * 0.3}`;
  const width = Math.max(26, Math.min(56, w * 0.05));
  const ns = 'http://www.w3.org/2000/svg';

  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9999;overflow:visible';
  const defs = document.createElementNS(ns, 'defs');
  const gradient = document.createElementNS(ns, 'linearGradient');
  gradient.id = 'rf-paint-gradient';
  gradient.setAttribute('x1', '0'); gradient.setAttribute('x2', '1'); gradient.setAttribute('y1', '0'); gradient.setAttribute('y2', '0');
  COLORS.forEach((color, i) => {
    const stop = document.createElementNS(ns, 'stop');
    stop.setAttribute('offset', String(i / (COLORS.length - 1)));
    stop.setAttribute('stop-color', color);
    gradient.appendChild(stop);
  });
  defs.appendChild(gradient);
  svg.appendChild(defs);

  // A wide body plus a few thin bristle lines riding along it.
  const strokes: Array<{ dy: number; width: number; opacity: number; color: string }> = [
    { dy: 0, width, opacity: 0.92, color: 'url(#rf-paint-gradient)' },
    { dy: -width * 0.36, width: width * 0.12, opacity: 0.5, color: '#f1f0ea' },
    { dy: width * 0.3, width: width * 0.09, opacity: 0.35, color: '#1e2427' },
    { dy: width * 0.05, width: width * 0.06, opacity: 0.4, color: '#ffffff' },
  ];
  const paths = strokes.map((s) => {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    path.setAttribute('transform', `translate(0 ${s.dy})`);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', s.color);
    path.setAttribute('stroke-width', String(s.width));
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-opacity', String(s.opacity));
    path.setAttribute('pathLength', '1');
    path.setAttribute('stroke-dasharray', '1 1');
    path.setAttribute('stroke-dashoffset', reduce ? '0' : '1');
    svg.appendChild(path);
    return path;
  });
  document.body.appendChild(svg);

  const cursor = document.createElement('style');
  cursor.textContent = `*{cursor:${BRUSH_CURSOR} !important}`;
  document.head.appendChild(cursor);

  if (!reduce) {
    paths.forEach((path, i) => path.animate(
      [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
      { duration: 700, delay: i * 40, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'forwards' },
    ));
  }
  const fade = svg.animate([{ opacity: 1 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration: 2600, easing: 'ease-out', fill: 'forwards' });
  const cleanup = () => { svg.remove(); cursor.remove(); active = false; };
  fade.onfinish = cleanup;
  window.setTimeout(cleanup, 3200);
}
