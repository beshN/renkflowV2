import Image from "next/image";

/** Renk Alüminyum's logo; the white one is for dark photos and overlays. `height` is in CSS px. */
export function BrandLogo({ white = false, height = 36 }: { white?: boolean; height?: number }) {
  return (
    <Image
      src={`/images/configurator/brand/renk-logo${white ? "-white" : ""}.webp`}
      alt="Renk Alüminyum"
      width={228}
      height={60}
      unoptimized
      priority
      style={{ height, width: "auto" }}
    />
  );
}
