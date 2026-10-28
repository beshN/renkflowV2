import Image from "next/image";

const LOGOS = {
  /** RENK with "Aluminum pergola & shading systems": for large placements, where the line stays legible. */
  full: { file: "renk-logo", width: 1685, height: 548 },
  /** RENK alone: for headers. */
  mark: { file: "renk-wordmark", width: 1522, height: 401 },
};

/** Renk Alüminyum's logo (vector); the white one is for dark photos and overlays. `height` is any CSS length. */
export function BrandLogo({ variant = "mark", white = false, height = 36 }: { variant?: keyof typeof LOGOS; white?: boolean; height?: number | string }) {
  const logo = LOGOS[variant];
  return (
    <Image
      src={`/images/configurator/brand/${logo.file}${white ? "-white" : ""}.svg`}
      alt="Renk Alüminyum"
      width={logo.width}
      height={logo.height}
      unoptimized
      priority
      style={{ height, width: "auto" }}
    />
  );
}
