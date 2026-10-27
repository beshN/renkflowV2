'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowUpRight, Expand, Monitor, MousePointer2, RotateCcw, Smartphone, ZoomIn, ZoomOut } from 'lucide-react';
import { useMarkStandaloneScreen } from '@/lib/shared/hooks/useWorkspacePresence';
import styles from './KioskSimulator.module.css';

export function KioskSimulator({ fairCode, fairName }: { fairCode: string; fairName: string }) {
  useMarkStandaloneScreen();
  const [portrait, setPortrait] = useState(false);
  const [session, setSession] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const [closeup, setCloseup] = useState(false);
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
    <div ref={root} className={`${styles.root} ${immersive ? styles.immersive : ''} ${portrait ? styles.portrait : ''} ${closeup ? styles.closeup : ''}`}>
      <div className={styles.boothBackground} aria-hidden="true" />
      <div className={styles.atmosphere} aria-hidden="true" />
      <header className={styles.header}>
        <a href={kioskPath} className={styles.brand}><span className={styles.brandIcon}>R</span><span>RENK<span className={styles.brandSub}>ALÜMİNYUM</span></span></a>
        <span className={styles.headerLabel}>FUAR STANDI <span>/</span> İNTERAKTİF KİOSK</span>
        <a className={styles.directLink} href={kioskPath} target="_blank" rel="noreferrer">Siteyi aç <ArrowUpRight size={15} /></a>
      </header>

      <main className={styles.main}>
        <h1 className={styles.srOnly}>Fuar standında kiosk deneyimi</h1>
        <section className={styles.workspace} aria-label="Etkileşimli kiosk simülatörü">
          <div className={styles.toolbar}>
            <div className={styles.viewSwitch} role="group" aria-label="Ekran yönü">
              <button type="button" aria-pressed={!portrait} onClick={() => setPortrait(false)}><Monitor size={16} />Yatay</button>
              <button type="button" aria-pressed={portrait} onClick={() => setPortrait(true)}><Smartphone size={16} />Dikey</button>
            </div>
            <div className={styles.actions}>
              <button type="button" onClick={() => setCloseup((value) => !value)} aria-pressed={closeup}>{closeup ? <ZoomOut size={16} /> : <ZoomIn size={16} />}<span>{closeup ? 'Standa dön' : 'Ekrana yaklaş'}</span></button>
              <button type="button" onClick={restart} title="Yeni ziyaretçi: ekranı başlangıca döndür"><RotateCcw size={15} /><span>Baştan başla</span></button>
              <button type="button" onClick={() => void fullscreen()} aria-label={immersive ? 'Geniş görünümden çık' : 'Tam ekran aç'}><Expand size={15} /><span>{immersive ? 'Küçült' : 'Tam ekran'}</span></button>
            </div>
          </div>

          <div className={styles.scene}>
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
                <div className={styles.deviceBottom}><span>RENK <b>INTERACTIVE</b></span><i /></div>
              </div>
            </div>
            <div className={styles.stand} aria-hidden="true">
              <div className={styles.columnSide} />
              <div className={styles.column}>
                <div className={styles.columnBrand}>RENK<span>ALÜMİNYUM</span></div>
                <div className={styles.columnAccent} />
                <span className={styles.columnTagline}>HAYAL ET.<br />TASARLA.<br />DENEYİMLE.</span>
              </div>
              <div className={styles.base} />
              <div className={styles.contactShadow} />
            </div>
          </div>
          {error && <p role="status" className={styles.error}>{error}</p>}
        </section>
      </main>
      <footer className={styles.footer}>
        <span className={styles.hint}><MousePointer2 size={16} /><span>Ekrana tıkla, tasarımını oluştur.<small>QR kodunu telefonunla okutarak devam et.</small></span></span>
        <span className={styles.fairBadge}><span className={styles.statusDot} /><span>{fairName}<small>{width} × {height} · Test ortamı</small></span></span>
      </footer>
    </div>
  );
}
