/** Pure ZPL II: UTF-8 bytes with ^FH, no printer I/O. Font 0 requires a printer
 * with Turkish glyph coverage; physical printing is unverified. */
export type LabelSize = { widthMm?: number; heightMm?: number; dpi?: number };
export type ZplLabel =
  | { kind: "cut"; orderNumber: string; profileCode: string; lengthMm: number; quantity: number; workOrder: string; code: string; notice?: string }
  | { kind: "shipment"; customer: string; orderNumber: string; packageNumber: string; packageTotal: string; summary: string }
  | { kind: "location"; locationCode: string; code: string };

/** Encode every UTF-8 byte, including ^, ~ and the hex escape marker itself. */
export function escapeZpl(value: string): string {
  return Array.from(new TextEncoder().encode(value.replace(/[\r\n\t]/g, " ")),
    (byte) => "_" + byte.toString(16).toUpperCase().padStart(2, "0")).join("");
}
export function labelDots(size: LabelSize = {}) {
  const { widthMm = 100, heightMm = 50, dpi = 203 } = size;
  if (![widthMm, heightMm, dpi].every(Number.isFinite) || widthMm < 80 || widthMm > 150 || heightMm < 50 || heightMm > 150 || dpi < 152 || dpi > 600)
    throw new Error("Etiket boyutu 80–150 × 50–150 mm, çözünürlük 152–600 dpi olmalı");
  return { width: Math.round(widthMm * dpi / 25.4), height: Math.round(heightMm * dpi / 25.4) };
}
export function generateZpl(label: ZplLabel, size: LabelSize = {}): string {
  const { width, height } = labelDots(size);
  const scale = Math.min(width / 799, height / 400);
  const d = (n: number) => Math.round(n * scale);
  const text = (y: number, value: string) => {
    // Reject overflow instead of silently truncating production identifiers.
    if (Array.from(value).length > 50) throw new Error("Etiket satırı çok uzun (en fazla 50 karakter)");
    return `^FO${d(24)},${d(y)}^A0N,${d(25)},${d(14)}^FH_^FD${escapeZpl(value)}^FS`;
  };
  let lines: string[];
  if (label.kind === "cut") {
    if (![label.lengthMm, label.quantity].every((n) => Number.isFinite(n) && n > 0) || !Number.isInteger(label.quantity)) throw new Error("Geçersiz mm / adet");
    lines = ["Kesim parçası", `Sipariş: ${label.orderNumber}`, `Profil: ${label.profileCode}`,
      `Boy: ${label.lengthMm} mm · Adet: ${label.quantity}`, `İş emri: ${label.workOrder}`];
  } else if (label.kind === "shipment") {
    lines = ["Paket / sevk", `Müşteri: ${label.customer}`, `Sipariş: ${label.orderNumber}`,
      `Paket: ${label.packageNumber} / ${label.packageTotal}`, label.summary];
  } else lines = ["Raf / stok konumu", label.locationCode];
  const output = [`^XA^CI28^PW${width}^LL${height}^LH0,0`, ...lines.map((line, i) => text(22 + i * 34, line))];
  if (label.kind !== "shipment") {
    // Reuse the existing scanner's RF identity or UUID. QR has a four-module quiet zone.
    if (!/^(RF-[ILJCPR]-[A-F0-9]{12}|[a-f0-9-]{36})$/i.test(label.code)) throw new Error("Geçersiz etiket kimliği");
    output.push(`^FO${d(28)},${d(222)}^BQN,2,${Math.max(2, d(4))}^FH_^FDLA,${escapeZpl(label.code)}^FS`);
    output.push(`^FO${d(230)},${d(256)}^A0N,${d(20)},${d(12)}^FH_^FD${escapeZpl(label.code)}^FS`);
  }
  if (label.kind === "cut" && label.notice) output.push(text(354, label.notice));
  return [...output, "^XZ"].join("\n");
}
