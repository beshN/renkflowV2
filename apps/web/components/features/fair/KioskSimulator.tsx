'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowUpRight, Expand, Maximize2, Monitor, MousePointer2, RotateCcw, Smartphone } from 'lucide-react';
import { useMarkStandaloneScreen } from '@/lib/shared/hooks/useWorkspacePresence';
import styles from './KioskSimulator.module.css';

export function KioskSimulator({ fairCode, fairName }: { fairCode: string; fairName: string }) {
  useMarkStandaloneScreen();
  const [portrait, setPortrait] = useState(false);
  const [session, setSession] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const [error, setError] = useState('');
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [kioskPath, setKioskPath] = useState(`/configurator/fair/${encodeURIComponent(fairCode)}`);
  const width = portrait ? 1080 : 1920;
  const height = portrait ? 1920 : 1080;
  const scale = bounds.width && bounds.height ? Math.min((bounds.width - 48) / width, (bounds.height - 52) / height, 1) : 0;

  useEffect(() => {
    // Use the short route on a configurator domain, and the full route inside RenkFlow.
    if (!window.location.pathname.startsWith('/configurator/')) setKioskPath(`/fair/${encodeURIComponent(fairCode)}`);
  }, [fairCode]);

  useEffect(() => {
    if (!stage.current) return;
    const observer = new ResizeObserver(([entry]) => setBounds({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const changed = () => setImmersive(document.fullscreenElement === root.current);
    document.addEventListener('fullscreenchange', changed);
    return () => document.removeEventListener('fullscreenchange', changed);
  }, []);

  async function fullscreen() {
    setError('');
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (immersive) setImmersive(false);
      else if (root.current?.requestFullscreen) await root.current.requestFullscreen();
      else setImmersive((value) => !value);
    } catch {
      setImmersive((value) => !value);
      setError('Tarayıcı tam ekranı açamadı. Geniş görünüm etkinleştirildi.');
    }
  }

  function restart() {
    setLoaded(false);
    setSession((value) => value + 1);
  }

  const screenStyle = { '--screen-width': `${Math.max(0, width * scale)}px`, '--screen-height': `${Math.max(0, height * scale)}px` } as CSSProperties;

  return (
    <div ref={root} className={`${styles.root} ${immersive ? styles.immersive : ''}`}>
      <header className={styles.header}>
        <a href={kioskPath} className={styles.brand}><span className={styles.brandIcon}>R</span><span>RENK<span className={styles.brandSub}>ALÜMİNYUM</span></span></a>
        <span className={styles.headerLabel}>DİJİTAL DENEYİM ALANI <span>/</span> KİOSK SİMÜLATÖRÜ</span>
        <a className={styles.directLink} href={kioskPath} target="_blank" rel="noreferrer">Siteyi aç <ArrowUpRight size={15} /></a>
      </header>

      <main className={styles.main}>
        <aside className={styles.sidebar}>
          <span className={styles.eyebrow}><span /> FUAR DENEYİMİ</span>
          <h1>Standın <br />ekranı, <br /><em>şimdi burada.</em></h1>
          <p className={styles.intro}>Kioskun ekranına tıklayarak ürünleri keşfet, tasarımını oluştur ve telefonunda devam et.</p>
          <div className={styles.instructions}>
            <div><span>01</span><p><strong>Ekrandan tasarla</strong>Ürün seç, ölçüleri ve renkleri değiştir.</p></div>
            <div><span>02</span><p><strong>QR’ı telefonunla okut</strong>Tasarımını kendi telefonunda aç.</p></div>
            <div><span>03</span><p><strong>Teklif iste</strong>Talebini gönder, satış panelinde gör.</p></div>
          </div>
          <p className={styles.note}><MousePointer2 size={16} /><span>Fareyle tıklayabilir veya dokunmatik ekranından kullanabilirsin.</span></p>
        </aside>

        <section className={styles.workspace} aria-label="Etkileşimli kiosk simülatörü">
          <div className={styles.toolbar}>
            <div className={styles.viewSwitch} role="group" aria-label="Ekran yönü">
              <button type="button" aria-pressed={!portrait} onClick={() => setPortrait(false)}><Monitor size={16} />Yatay</button>
              <button type="button" aria-pressed={portrait} onClick={() => setPortrait(true)}><Smartphone size={16} />Dikey</button>
            </div>
            <div className={styles.actions}>
              <button type="button" onClick={restart} title="Yeni ziyaretçi: ekranı başlangıca döndür"><RotateCcw size={15} /><span>Baştan başla</span></button>
              <button type="button" onClick={() => void fullscreen()} aria-label={immersive ? 'Geniş görünümden çık' : 'Tam ekran aç'}><Expand size={15} /><span>{immersive ? 'Küçült' : 'Tam ekran'}</span></button>
            </div>
          </div>

          <div className={styles.scene}>
            <div className={styles.sceneTop}><span><span className={styles.statusDot} /> TEST ORTAMI</span><span>{width} × {height}</span></div>
            <div ref={stage} className={styles.stage}>
              <div className={styles.device} style={screenStyle}>
                <div className={styles.camera} />
                <div className={styles.screen} aria-busy={!loaded}>
                  {scale > 0 && <iframe
                    key={session}
                    src={kioskPath}
                    title="Renk Alüminyum fuar kiosku — etkileşimli ekran"
                    width={width}
                    height={height}
                    style={{ transform: `scale(${scale})` }}
                    allow="fullscreen; clipboard-write"
                    allowFullScreen
                    onLoad={() => setLoaded(true)}
                  />}
                  {!loaded && <div className={styles.loading} role="status"><Monitor size={28} /><span>Kiosk açılıyor…</span></div>}
                </div>
                <div className={styles.deviceBottom}><span>RENK</span><i /></div>
              </div>
            </div>
            <div className={styles.stand}><div /><span>DESIGN. EXPERIENCE. CONNECT.</span></div>
            <div className={styles.floor} />
            <div className={styles.sceneBottom}><span>{fairName}</span><span><Maximize2 size={12} /> ÖLÇEĞE SIĞDIRILMIŞ EKRAN</span></div>
          </div>
          {error && <p role="status" className={styles.error}>{error}</p>}
          <p className={styles.caption}>Bu ekrandaki site etkileşimlidir. Oluşturduğun tasarımlar ve teklif talepleri test ortamına kaydedilir.</p>
        </section>
      </main>
      <footer className={styles.footer}><span>RENK ALÜMİNYUM <span>© {new Date().getFullYear()}</span></span><span>FUAR ÖNCESİ PROVA</span></footer>
    </div>
  );
}
