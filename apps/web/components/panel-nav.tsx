"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, Calculator, CirclePlus, LayoutDashboard, Settings, ShoppingBag, Users } from "lucide-react";
import type { OrganizationRole } from "@/lib/types";

const items = [
  { href: "/panel", label: "Genel Bakış", icon: LayoutDashboard, exact: true, roles: ["owner", "admin", "office", "production"] },
  { href: "/panel/siparisler", label: "Siparişler", icon: ShoppingBag, exact: true, roles: ["owner", "admin", "office", "production"] },
  { href: "/panel/siparisler/yeni", label: "Yeni Sipariş", icon: CirclePlus, roles: ["owner", "admin", "office"] },
  { href: "/panel/uretim", label: "Üretim", icon: Boxes, roles: ["owner", "admin", "office", "production"] },
  { href: "/panel/hesap-kurallari", label: "Hesap Kuralları", icon: Calculator, roles: ["owner", "admin", "office"] },
  { href: "/panel/ekip", label: "Ekip", icon: Users, roles: ["owner", "admin"] },
  { href: "/panel/ayarlar", label: "Ayarlar", icon: Settings, roles: ["owner", "admin"] },
];

export function PanelNav({ role }: { role: OrganizationRole }) {
  const pathname = usePathname();
  return (
    <nav className="panel-nav">
      {items.filter((item) => item.roles.includes(role)).map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return <Link key={href} href={href} className={active ? "active" : ""}><Icon size={18} /><span>{label}</span></Link>;
      })}
    </nav>
  );
}
