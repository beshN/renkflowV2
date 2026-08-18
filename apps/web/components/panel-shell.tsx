import Link from "next/link";
import { Bell, ChevronDown } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import { PanelNav } from "@/components/panel-nav";

export function PanelShell({
  organizationName,
  userName,
  role,
  children,
}: {
  organizationName: string;
  userName: string;
  role: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel-layout">
      <aside className="sidebar">
        <Link className="brand sidebar-brand" href="/panel"><span className="brand-mark">R</span><span>RenkFlow</span></Link>
        <div className="workspace-switcher"><span>{organizationName.slice(0, 1).toUpperCase()}</span><div><small>Çalışma alanı</small><b>{organizationName}</b></div><ChevronDown size={15} /></div>
        <PanelNav />
        <div className="sidebar-focus"><span>RenkFlow Core</span><b>Sipariş → PDF → Üretim</b><small>v2.0 yeniden kurulum</small></div>
      </aside>
      <div className="panel-main">
        <header className="topbar">
          <div><span className="mobile-brand">RenkFlow</span></div>
          <div className="topbar-actions">
            <button className="icon-button" aria-label="Bildirimler"><Bell size={18} /></button>
            <div className="user-chip"><span>{userName.slice(0, 1).toUpperCase()}</span><div><b>{userName}</b><small>{role}</small></div></div>
            <form action={signOutAction}><button className="signout-button">Çıkış</button></form>
          </div>
        </header>
        <main className="panel-content">{children}</main>
      </div>
    </div>
  );
}
