import Image from "next/image";

export function BrandLogo({
  compact = false,
  priority = false,
  className = "",
}: {
  compact?: boolean;
  priority?: boolean;
  className?: string;
}) {
  return (
    <span className={`brand-logo ${compact ? "brand-logo-compact" : ""} ${className}`.trim()}>
      <Image
        className="brand-logo-image"
        src={compact ? "/logo-r.png" : "/logo-full.png"}
        alt="RenkFlow"
        width={1024}
        height={1024}
        priority={priority}
        sizes={compact ? "72px" : "244px"}
      />
    </span>
  );
}
