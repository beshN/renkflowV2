"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, ScanLine, Printer, ArrowUpRight } from "lucide-react";
export function WarehouseShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="rf-page space-y-6">
      <header className="rf-warehouse-header">
        <div>
          <p className="rf-eyebrow">RENK ALÜMİNYUM / MALZEME OPERASYONLARI</p>
          <h1 className="rf-page-title">Depo kontrol merkezi</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Malzemenin yerini, hareketini ve üretime hazır durumunu tek çalışma
            alanından yönetin.
          </p>
        </div>
        <Link href="/inventory" className="rf-secondary-button self-start">
          Stok bakiyeleri
          <ArrowUpRight size={16} />
        </Link>
      </header>
      <nav className="rf-module-nav" aria-label="Depo modülleri">
        {[
          { href: "/warehouse", label: "Depo & raflar", Icon: Boxes },
          {
            href: "/warehouse/scan",
            label: "Tarama terminali",
            Icon: ScanLine,
          },
          { href: "/warehouse/labels", label: "Etiket merkezi", Icon: Printer },
        ].map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={pathname === href ? "page" : undefined}
          >
            <Icon size={17} />
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
