import { ImageResponse } from 'next/og';

export const alt = 'RenkFlow · Ölçüye özel her proje için tek operasyon altyapısı';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const BARS = [
  { label: '6017 · 100×150 taşıyıcı', length: 7000, cuts: [5400, 1450] },
  { label: '5979 · çiftli ray', length: 9000, cuts: [4200, 4200] },
  { label: '108 · 40×60 dikme', length: 6000, cuts: [2650, 2650] },
];

/** Social share card: headline plus a cutting-plan motif, in the site's light theme. */
export default function OpengraphImage() {
  const track = 460;
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#fafafa', color: '#111113', padding: '72px 80px', fontSize: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: '#111113', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>R</div>
            <div style={{ fontSize: 30, letterSpacing: -0.5 }}>RenkFlow</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 64, lineHeight: 1.05, letterSpacing: -2.5, color: '#6b6b73' }}>Ölçüye özel her proje için</div>
            <div style={{ fontSize: 64, lineHeight: 1.05, letterSpacing: -2.5 }}>tek operasyon altyapısı.</div>
            <div style={{ marginTop: 28, fontSize: 24, color: '#6b6b73' }}>Pergola · giyotin cam · tente · alüminyum tavan</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 26, width: track + 40, paddingLeft: 40 }}>
          {BARS.map((bar) => {
            const rest = bar.length - bar.cuts.reduce((a, b) => a + b, 0) - bar.cuts.length * 5;
            const width = (bar.length / 9000) * track;
            return (
              <div key={bar.label} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, color: '#6b6b73' }}>
                  <span style={{ color: '#111113' }}>{bar.label}</span>
                  <span>{`${bar.length} mm`}</span>
                </div>
                <div style={{ display: 'flex', width, height: 34, borderRadius: 8, background: '#ececef', overflow: 'hidden' }}>
                  {bar.cuts.map((cut, index) => (
                    <div key={index} style={{ width: (cut / bar.length) * width, height: '100%', marginRight: 3, background: '#2d55f5', color: '#fff', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{String(cut)}</div>
                  ))}
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#6b6b73' }}>{rest >= 500 ? String(rest) : ''}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ),
    size,
  );
}
