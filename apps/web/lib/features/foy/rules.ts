import { upper } from './layout';
import { checkedLabels, type FoyCutRow, type FoyDoc } from './types';

/**
 * Cross-checks of an imalat föyü. Each rule was read off Renk's own sheets and holds on every
 * makaslı pergola sheet checked so far; a sheet that breaks one gets a note, never a correction.
 * Confirmed by the workshop: dere and boru are cut as the list says (pieces chosen for least scrap,
 * never split again), and the 40×60 LED profile count grows on big awnings, so more is not an error.
 */
export type FoyCheck = {
  id: string;
  severity: 'ok' | 'info' | 'warn';
  title: string;
  detail: string;
};

export type FoyFeatures = {
  motor: string | null;
  motorControl: string | null;
  dimmer: boolean;
  ledEveryProfile: boolean;
  valance: 'logolu' | 'baskısız' | 'düz' | 'var' | null;
  noSteel: boolean;
  noTopSheet: boolean;
  weldOnSite: boolean;
  valanceAfterInstall: boolean;
  systems: number;
};

const fmt = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 1, useGrouping: false });
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol + 1e-9;
const total = (rows: FoyCutRow[]) => rows.reduce((s, r) => s + (r.lengthCm ?? 0) * (r.quantity ?? 0), 0);

export function foyFeatures(doc: FoyDoc): FoyFeatures {
  const notes = upper(doc.notes.join(' | '));
  const iron = upper(doc.ironNotes.join(' | '));
  const motor = notes.match(/\b(BECKER|SOMFY|NICE|CHERUBINI|MOTTURA|ALUTECH)\b/);
  return {
    motor: motor ? motor[1].charAt(0) + motor[1].slice(1).toLocaleLowerCase('tr-TR') : null,
    motorControl: /BUTON/.test(notes) ? 'Buton' : /KUMANDA/.test(notes) ? 'Kumanda' : null,
    dimmer: /DİMER|DIMMER|DİMMER/.test(notes),
    ledEveryProfile: /HER PROFİLDE LED/.test(notes),
    valance: /LOGOLU SAÇAK/.test(notes) ? 'logolu' : /BASKISIZ SAÇAK/.test(notes) ? 'baskısız' : /DÜZ SAÇAK/.test(notes) ? 'düz' : /SAÇAK (OLACAK|PROFİLİ)/.test(notes) ? 'var' : null,
    noSteel: /DEMİR OLMAYACAK/.test(notes),
    noTopSheet: /SAC[Iİ]? OLMAYACAK/.test(notes),
    weldOnSite: /KAYNAK/.test(notes) || /KAYNAT/.test(iron),
    valanceAfterInstall: /SAÇAK.*MONTAJDAN SONRA/.test(notes),
    systems: Math.max(1, doc.systems.length),
  };
}

export function checkFoy(doc: FoyDoc): FoyCheck[] {
  const out: FoyCheck[] = [];
  const add = (c: FoyCheck) => out.push(c);
  const f = foyFeatures(doc);

  if (doc.unreadPages.length) add({ id: 'image_pages', severity: 'warn', title: 'Resim sayfa', detail: `${doc.unreadPages.join(', ')}. sayfa resim olarak gömülü; metinden okunamadı. Görsel okuma gerekiyor.` });
  if (doc.template === 'unknown') {
    add({ id: 'template', severity: 'warn', title: 'Föy şablonu tanınmadı', detail: 'Belgede makaslı pergola ya da rüzgâr kırıcı föyünün başlıkları yok.' });
    return out;
  }
  if (!doc.date) add({ id: 'date', severity: 'warn', title: 'Tarih yok', detail: 'Föyde tarih okunamadı.' });
  if (!doc.customer) add({ id: 'customer', severity: 'warn', title: 'Müşteri alanı boş', detail: doc.address ? `Ad yalnız adres alanında yazıyor: ${doc.address}. Müşteri kartıyla eşleştirin.` : 'Föyde müşteri adı yok.' });
  if (!doc.ral) add({ id: 'ral', severity: 'warn', title: 'RAL yok', detail: 'Föyde RAL kodu okunamadı.' });

  if (doc.template === 'windbreaker') return [...out, ...windbreakerChecks(doc)];

  if (doc.series.length && !checkedLabels(doc.series).length) add({ id: 'series', severity: 'warn', title: 'Seri işaretli değil', detail: `${doc.series.map((o) => o.label).join(' / ')} kutularından hiçbiri işaretli değil.` });
  if (doc.series.some((o) => o.checked === null) || doc.lights.some((o) => o.checked === null)) add({ id: 'boxes', severity: 'info', title: 'İşaret kutusu okunamadı', detail: 'Bazı seçenek kutuları çizimden okunamadı; föyle karşılaştırın.' });

  if (!doc.systems.length) {
    add({ id: 'schema', severity: 'warn', title: 'Bölme şeması okunamadı', detail: 'Demir/ray ölçüleri bulunamadı.' });
    return out;
  }

  // ── Bay schema ──
  doc.systems.forEach((s, k) => {
    const tag = doc.systems.length > 1 ? `${k + 1}. sistem: ` : '';
    const bad = s.bays.filter((b) => b.ironInner !== null && b.railInner !== null && !near(b.railInner, b.ironInner - 1, 0.05));
    if (s.bays.some((b) => b.ironInner === null || b.railInner === null)) add({ id: `bays_${k}`, severity: 'warn', title: `${tag}Bölme ölçüsü eksik`, detail: 'Bazı bölmelerde demir ya da ray ölçüsü okunamadı.' });
    else if (bad.length) add({ id: `rail_inner_${k}`, severity: 'warn', title: `${tag}Ray içten içe tutmuyor`, detail: bad.map((b) => `demir ${fmt(b.ironInner!)} → ray ${fmt(b.railInner!)} (beklenen ${fmt(b.ironInner! - 1)})`).join('; ') });
    else add({ id: `rail_inner_${k}`, severity: 'ok', title: `${tag}Ray = demir − 1`, detail: s.bays.map((b) => `${fmt(b.ironInner!)}→${fmt(b.railInner!)}`).join(', ') });

    const irons = s.bays.map((b) => b.ironInner).filter((v): v is number => v !== null);
    if (s.railOuter !== null && irons.length === s.bays.length) {
      const expected = irons.reduce((a, b) => a + b, 0) + 10 * (irons.length + 1) + 1;
      add(near(s.railOuter, expected, 0.2)
        ? { id: `rail_outer_${k}`, severity: 'ok', title: `${tag}Ray dıştan dışa tutuyor`, detail: `Σ demir ${fmt(expected - 10 * (irons.length + 1) - 1)} + ${irons.length + 1} dikme payı = ${fmt(expected)}` }
        : { id: `rail_outer_${k}`, severity: 'warn', title: `${tag}Ray dıştan dışa tutmuyor`, detail: `Föyde ${fmt(s.railOuter)}, bölmelerden ${fmt(expected)} çıkıyor (fark ${fmt(s.railOuter - expected)}).` });
    }
    if (s.projection === null) add({ id: `projection_${k}`, severity: 'warn', title: `${tag}Açılım yok`, detail: 'Yan görünüşte açılım ölçüsü okunamadı.' });
  });

  const outers = doc.systems.map((s) => s.railOuter).filter((v): v is number => v !== null);
  const outerSum = outers.reduce((a, b) => a + b, 0);
  const rows = (kind: FoyCutRow['kind']) => doc.cutList.filter((r) => r.kind === kind);

  // ── Dere / boru: the listed pieces must add up to the rail width ──
  if (outers.length === doc.systems.length) {
    const dere = rows('dere');
    if (dere.length) {
      const sum = total(dere);
      add(near(sum, outerSum, 0.2)
        ? { id: 'dere', severity: 'ok', title: 'Dere toplamı tutuyor', detail: `${dere.map((r) => `${fmt(r.lengthCm!)}×${r.quantity}`).join(' + ')} = ${fmt(sum)}` }
        : { id: 'dere', severity: 'warn', title: 'Dere toplamı tutmuyor', detail: `Parçalar ${fmt(sum)}, ray dıştan dışa toplamı ${fmt(outerSum)}.` });
    } else add({ id: 'dere', severity: 'warn', title: 'Dere yok', detail: 'Kesim listesinde dere satırı yok.' });
    const boru = rows('boru');
    if (boru.length) {
      const sum = total(boru);
      const expected = outerSum - 8 * doc.systems.length;
      add(near(sum, expected, 0.2)
        ? { id: 'boru', severity: 'ok', title: 'Boru toplamı tutuyor', detail: `${boru.map((r) => `${fmt(r.lengthCm!)}×${r.quantity}`).join(' + ')} = ${fmt(sum)} (ray − 8)` }
        : { id: 'boru', severity: 'warn', title: 'Boru toplamı tutmuyor', detail: `Parçalar ${fmt(sum)}, beklenen ${fmt(expected)} (ray dıştan dışa − 8).` });
    } else add({ id: 'boru', severity: 'warn', title: 'Boru yok', detail: 'Kesim listesinde boru satırı yok.' });
  }

  // ── LED profile (40×60) ──
  const led = rows('led');
  const bayIrons = doc.systems.flatMap((s) => s.bays.map((b) => b.ironInner)).filter((v): v is number => v !== null);
  if (led.length) {
    const off = led.filter((r) => r.lengthCm !== null && !bayIrons.some((i) => near(r.lengthCm!, i - 13, 0.35)));
    const missing = [...new Set(bayIrons)].filter((i) => !led.some((r) => r.lengthCm !== null && near(r.lengthCm, i - 13, 0.35)));
    add(off.length || missing.length
      ? { id: 'led_length', severity: 'warn', title: 'LED profil boyu tutmuyor', detail: [off.length && `listede ${off.map((r) => fmt(r.lengthCm!)).join(', ')} hiçbir bölmeye uymuyor (demir − 13)`, missing.length && `${missing.map(fmt).join(', ')} bölmesi için LED profili yok`].filter(Boolean).join('; ') + '.' }
      : { id: 'led_length', severity: 'ok', title: 'LED profil boyu = demir − 13', detail: led.map((r) => fmt(r.lengthCm!)).join(', ') });
    const projections = doc.systems.map((s) => s.projection);
    if (projections.every((p) => p !== null)) {
      const expected = doc.systems.reduce((sum, s) => sum + s.bays.length * Math.max(0, Math.round((s.projection! - 100) / 50)), 0);
      const actual = led.reduce((s, r) => s + (r.quantity ?? 0), 0);
      if (actual < expected) add({ id: 'led_count', severity: 'warn', title: 'LED profili az', detail: `Listede ${actual} adet; bu açılımda en az ${expected} bekleniyor (bölme başına (açılım − 100) / 50).` });
      else if (actual > expected) add({ id: 'led_count', severity: 'info', title: 'LED profili fazla', detail: `Listede ${actual}, standart ${expected}. Büyük tentede fazla LED profili normal; bilgi olarak.` });
      else add({ id: 'led_count', severity: 'ok', title: 'LED profili adedi standart', detail: `${actual} adet` });
    }
  } else add({ id: 'led_length', severity: 'warn', title: 'LED profili yok', detail: 'Kesim listesinde 40×60 satırı yok.' });

  // ── Fabric and valance ──
  const fabricRows = rows('kumas');
  const first = doc.systems[0];
  if (doc.fabricSize?.widthCm != null && first.railOuter !== null) {
    const w = first.railOuter - 10;
    add(near(doc.fabricSize.widthCm, w, 0.6)
      ? { id: 'fabric_width', severity: 'ok', title: 'Kumaş eni = ray − 10', detail: `${fmt(doc.fabricSize.widthCm)}` }
      : { id: 'fabric_width', severity: 'warn', title: 'Kumaş eni tutmuyor', detail: `Föyde ${fmt(doc.fabricSize.widthCm)}, beklenen ${fmt(w)} (ray dıştan dışa − 10).` });
  } else if (!doc.fabricSize) add({ id: 'fabric_width', severity: 'warn', title: 'Kumaş ölçüsü yok', detail: 'Kumaş kutusu okunamadı.' });
  if (doc.fabricSize?.lengthCm != null && first.projection !== null) {
    const l = first.projection + 50;
    add(near(doc.fabricSize.lengthCm, l, 0.6)
      ? { id: 'fabric_length', severity: 'ok', title: 'Kumaş boyu = açılım + 50', detail: `${fmt(doc.fabricSize.lengthCm)}` }
      : { id: 'fabric_length', severity: 'warn', title: 'Kumaş boyu tutmuyor', detail: `Föyde ${fmt(doc.fabricSize.lengthCm)}, beklenen ${fmt(l)} (açılım + 50).` });
  }
  if (fabricRows.length && doc.fabricSize) {
    const r = fabricRows[0];
    if (r.lengthCm !== null && r.widthCm !== null && (!near(r.lengthCm, doc.fabricSize.widthCm ?? -1, 0.6) || !near(r.widthCm, doc.fabricSize.lengthCm ?? -1, 0.6)))
      add({ id: 'fabric_list', severity: 'warn', title: 'Kumaş listesi ile kutu farklı', detail: `Listede ${fmt(r.lengthCm)}×${fmt(r.widthCm)}, kutuda ${fmt(doc.fabricSize.widthCm ?? 0)}×${fmt(doc.fabricSize.lengthCm ?? 0)}.` });
    const qty = fabricRows.reduce((s, x) => s + (x.quantity ?? 0), 0);
    if (qty && qty !== f.systems) add({ id: 'fabric_qty', severity: 'warn', title: 'Kumaş adedi sistem sayısından farklı', detail: `${qty} kumaş, ${f.systems} sistem.` });
  }
  if (doc.valanceSize) {
    const expectedH = f.valance === 'logolu' ? 56 : 36;
    const wOk = doc.fabricSize?.widthCm == null || doc.valanceSize.widthCm == null || near(doc.valanceSize.widthCm, doc.fabricSize.widthCm, 0.6);
    const hOk = doc.valanceSize.heightCm == null || doc.valanceSize.heightCm === expectedH;
    add(wOk && hOk
      ? { id: 'valance', severity: 'ok', title: 'Saçak ölçüsü tutuyor', detail: `${fmt(doc.valanceSize.widthCm ?? 0)}×${fmt(doc.valanceSize.heightCm ?? 0)}${f.valance === 'logolu' ? ' (logolu)' : ''}` }
      : { id: 'valance', severity: 'warn', title: 'Saçak ölçüsü farklı', detail: `${fmt(doc.valanceSize.widthCm ?? 0)}×${fmt(doc.valanceSize.heightCm ?? 0)}; beklenen en kumaş eni, yükseklik ${expectedH}${f.valance === 'logolu' ? ' (logolu)' : ''}.` });
  } else if (f.valanceAfterInstall) add({ id: 'valance', severity: 'info', title: 'Saçak montajdan sonra ölçülecek', detail: 'Ölçünün boş olması föyün notuna uygun; hata değil.' });
  else if (f.valance) add({ id: 'valance', severity: 'warn', title: 'Saçak ölçüsü yok', detail: 'Notta saçak var ama ölçüsü yazılmamış.' });

  // ── Steel ──
  const steel = rows('demir');
  if (f.noSteel && steel.length) add({ id: 'steel', severity: 'warn', title: 'Demir olmayacak ama listede var', detail: steel.map((r) => r.profile).join(', ') });
  return out;
}

function windbreakerChecks(doc: FoyDoc): FoyCheck[] {
  const wb = doc.windbreaker;
  const out: FoyCheck[] = [];
  if (!wb) return out;
  if (wb.orderDate && wb.deliveryDate && wb.deliveryDate < wb.orderDate) out.push({ id: 'delivery', severity: 'warn', title: 'Teslim siparişten önce', detail: `${wb.orderDate} → ${wb.deliveryDate}` });
  if (wb.widthCm !== null && wb.pistonTable.length) {
    const exact = wb.pistonTable.find((p) => p.widthCm === wb.widthCm);
    const kg = exact?.kg ?? Math.round(wb.widthCm / 10 + 1);
    out.push({ id: 'piston', severity: 'info', title: `Piston ${fmt(kg)} kg`, detail: exact ? `Föydeki tablodan (${fmt(wb.widthCm)} cm).` : `Tabloda ${fmt(wb.widthCm)} cm yok; tablodaki eğilimle (genişlik / 10 + 1) hesaplandı, usta onaylasın.` });
  }
  if (wb.frameCm !== null && wb.sashCm !== null && !near(wb.sashCm, wb.frameCm - 2, 0.05)) out.push({ id: 'sash', severity: 'info', title: 'Kanat = kasa − 2 değil', detail: `Kasa ${fmt(wb.frameCm)}, kanat ${fmt(wb.sashCm)}. Tek örnekten çıkan kural; bilgi olarak.` });
  return out;
}
