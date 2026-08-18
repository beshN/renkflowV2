"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, Calculator, CirclePlus, LayoutDashboard, Settings, ShoppingBag, Users } from "lucide-react";

const items = [
  { href: "/panel", label: "Genel Bakış", icon: LayoutDashboard, exact: true },
  { href: "/panel/siparisler", label: "Siparişler", icon: ShoppingBag },
  { href: "/panel/siparisler/yeni", label: "Yeni Sipariş", icon: CirclePlus },
  { href: "/panel/uretim", label: "Üretim", icon: Boxes },
  { href: "/panel/hesap-kurallari", label: "Hesap Kuralları", icon: Calculator },
  { href: "/panel/ekip", label: "Ekip", icon: Users },
  { href: "/panel/ayarlar", label: "Ayarlar", icon: Settings },
];

export function PanelNav() {
  const pathname = usePathname();
  return (
    <nav className="panel-nav">
      {items.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return <Link key={href} href={href} className={active ? "active" : ""}><Icon size={18} /><span>{label}</span></Link>;
      })}
    </nav>
  );
}
