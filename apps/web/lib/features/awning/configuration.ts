import { z } from "zod";
const hex = z.string().regex(/^#[0-9a-f]{6}$/i);
export const AwningConfigurationSchema = z.object({
  version: z.literal(1),
  productCode: z.literal("WINMAX-MAKASLI"),
  widthMm: z
    .number()
    .finite()
    .min(2500, "En 2500–15000 mm aralığında olmalı")
    .max(15000, "En 2500–15000 mm aralığında olmalı"),
  projectionMm: z
    .number()
    .finite()
    .min(1500, "Açılım 1500–5000 mm aralığında olmalı")
    .max(5000, "Açılım 1500–5000 mm aralığında olmalı"),
  mountingHeightMm: z
    .number()
    .finite()
    .min(2200, "Montaj yüksekliği 2200–4500 mm aralığında olmalı")
    .max(4500, "Montaj yüksekliği 2200–4500 mm aralığında olmalı"),
  bodyColor: hex,
  bodyName: z.string().trim().min(1).max(80),
  fabricColor: hex,
  fabricName: z.string().trim().min(1).max(80),
  motor: z.enum(["remote", "remote_wall"]),
  led: z.enum(["off", "warm", "white"]),
  brightness: z.number().int().min(0).max(100),
});
export type AwningConfiguration = z.infer<typeof AwningConfigurationSchema>;
export const AwningPreviewSchema = z
  .string()
  .max(1_000_000)
  .regex(/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/);
export const DEFAULT_AWNING: AwningConfiguration = {
  version: 1,
  productCode: "WINMAX-MAKASLI",
  widthMm: 6000,
  projectionMm: 4000,
  mountingHeightMm: 3000,
  bodyColor: "#343a40",
  bodyName: "Antrasit",
  fabricColor: "#e8e3d5",
  fabricName: "Kırık beyaz",
  motor: "remote",
  led: "warm",
  brightness: 75,
};
export const BODY_COLORS = [
  ["Antrasit", "#343a40"],
  ["Beyaz", "#e9e9e4"],
  ["Gri", "#89908e"],
  ["Siyah", "#202427"],
  ["Kahverengi", "#594639"],
] as const;
export const FABRIC_COLORS = [
  ["Kırık beyaz", "#e8e3d5"],
  ["Kum beji", "#c2ae8b"],
  ["Gri", "#979e9f"],
  ["Bordo", "#7b2438"],
  ["Orman yeşili", "#3e6254"],
] as const;
export function toSceneState(c: AwningConfiguration, opening = 85, time = 0) {
  return {
    width: c.widthMm / 10,
    depth: c.projectionMm / 10,
    height: c.mountingHeightMm / 10,
    body: c.bodyColor,
    bodyName: c.bodyName,
    fabric: c.fabricColor,
    fabricName: c.fabricName,
    light: c.led,
    brightness: c.brightness,
    motor:
      c.motor === "remote_wall"
        ? "UBESER · Kumanda + duvar butonu"
        : "UBESER · Kumandalı",
    opening,
    time,
  };
}
export function awningSummary(c: AwningConfiguration) {
  return `En ${c.widthMm} mm · Açılım ${c.projectionMm} mm · Montaj ${c.mountingHeightMm} mm · ${c.bodyName} · ${c.fabricName} · ${c.motor === "remote_wall" ? "Kumanda + duvar butonu" : "Kumandalı"} · ${c.led === "off" ? "LED yok" : c.led === "warm" ? "Gün ışığı LED" : "Beyaz LED"}`;
}
export function applyAwning<T extends { heightMm?: number }>(
  item: T,
  configuration: AwningConfiguration,
  previewImage?: string,
) {
  const c = AwningConfigurationSchema.parse(configuration);
  return {
    ...item,
    productVisualization: undefined,
    awningConfiguration: c,
    widthMm: c.widthMm,
    projectionMm: c.projectionMm,
    mountingHeightMm: c.mountingHeightMm,
    color: c.bodyName,
    motorType: c.motor,
    ledType: c.led,
    fabricType: c.fabricName,
    ...(previewImage
      ? { awningPreview: AwningPreviewSchema.parse(previewImage) }
      : {}),
  };
}
