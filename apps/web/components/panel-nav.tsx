"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bell,
  Boxes,
  Building2,
  Calculator,
  CirclePlus,
  ClipboardList,
  KanbanSquare,
  LayoutDashboard,
  PackageSearch,
  Search,
  Settings,
  ShoppingBag,
  Truck,
  Users,
  WalletCards,
} from "lucide-react";
import type { OrganizationRole } from "@/lib/types";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: OrganizationRole[];
  exact?: boolean;
};

const allRoles: OrganizationRole[] = ["owner", "admin", "office", "production"];
const officeRoles: OrganizationRole[] = ["owner", "admin", "office"];
const managementRoles: OrganizationRole[] = ["owner", "admin"];

const groups: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Operasyon çekirdeği",
    items: [
      { href: "/panel", label: "Kontrol Paneli", icon: LayoutDashboard, exact: true, roles: allRoles },
      { href: "/panel/siparisler", label: "Sipariş Operasyonları", icon: ShoppingBag, exact: true, roles: allRoles },
      { href: "/panel/siparisler/yeni", label: "Yeni Sipariş Girişi", icon: CirclePlus, roles: officeRoles },
      { href: "/panel/is-emirleri", label: "İş Emri Takibi", icon: ClipboardList, roles: allRoles },
      { href: "/panel/kanban", label: "Akış Kanbanı", icon: KanbanSquare, roles: allRoles },
      { href: "/panel/uretim", label: "Üretim Merkezi", icon: Boxes, roles: allRoles },
      { href: "/panel/arama", label: "Kayıt Arama", icon: Search, roles: allRoles },
      { href: "/panel/bildirimler", label: "Bildirim Merkezi", icon: Bell, roles: allRoles },
    ],
  },
  {
    label: "Yönetim ve raporlama",
    items: [
      { href: "/panel/finans", label: "Finans Kontrolü", icon: WalletCards, roles: managementRoles },
      { href: "/panel/crm", label: "CRM ve Müşteriler", icon: Building2, roles: officeRoles },
      { href: "/panel/tedarikciler", label: "Tedarikçiler", icon: Truck, roles: officeRoles },
      { href: "/panel/envanter", label: "Envanter İhtiyaçları", icon: PackageSearch, roles: officeRoles },
      { href: "/panel/raporlar", label: "Operasyon Raporları", icon: BarChart3, roles: officeRoles },
      { href: "/panel/analitik", label: "Karar Analitiği", icon: Activity, roles: officeRoles },
      { href: "/panel/hesap-kurallari", label: "Hesap Kuralları", icon: Calculator, roles: officeRoles },
    ],
  },
  {
    label: "Organizasyon",
    items: [
      { href: "/panel/ekip", label: "Takım ve Üyelikler", icon: Users, roles: managementRoles },
      { href: "/panel/ayarlar", label: "Sistem Ayarları", icon: Settings, roles: managementRoles },
    ],
  },
];

export function PanelNav({ role, mobile = false }: { role: OrganizationRole; mobile?: boolean }) {
  const pathname = usePathname();
  const visibleGroups = groups
    .map((group) => ({ ...group, items: group.items.filter((item) => item.roles.includes(role)) }))
    .filter((group) => group.items.length > 0);

  if (mobile) {
    const mobileItems = visibleGroups.flatMap((group) => group.items).filter((item) => [
      "/panel",
      "/panel/siparisler",
      "/panel/is-emirleri",
      "/panel/uretim",
      "/panel/arama",
    ].includes(item.href));
    return (
      <nav className="mobile-panel-nav" aria-label="Mobil panel menüsü">
        {mobileItems.map((item) => <NavLink key={item.href} item={item} pathname={pathname} />)}
      </nav>
    );
  }

  return (
    <nav className="panel-nav" aria-label="Panel menüsü">
      {visibleGroups.map((group) => (
        <div className="panel-nav-group" key={group.label}>
          <p>{group.label}</p>
          {group.items.map((item) => <NavLink key={item.href} item={item} pathname={pathname} />)}
        </div>
      ))}
    </nav>
  );
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
  const Icon = item.icon;
  return (
    <Link href={item.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
      <Icon size={18} strokeWidth={active ? 2.35 : 1.8} />
      <span>{item.label}</span>
    </Link>
  );
}
