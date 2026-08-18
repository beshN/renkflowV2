import Link from "next/link";
import { signOutAction, switchOrganizationAction } from "@/app/actions/auth";
import { BrandLogo } from "@/components/brand-logo";
import { PanelNav } from "@/components/panel-nav";
import type { OrganizationRole } from "@/lib/types";

export function PanelShell({
  organizationName,
  organizationId,
  workspaces,
  userName,
  role,
  children,
}: {
  organizationName: string;
  organizationId: string;
  workspaces: Array<{ id: string; name: string }>;
  userName: string;
  role: OrganizationRole;
  children: React.ReactNode;
}) {
  return (
    <div className="panel-layout">
      <aside className="sidebar">
        <Link className="brand sidebar-brand" href="/panel" aria-label="RenkFlow paneli"><BrandLogo priority /></Link>
        <form action={switchOrganizationAction} className="workspace-switcher">
          <span>{organizationName.slice(0, 1).toUpperCase()}</span>
          <label>
            <small>Çalışma alanı</small>
            <select name="organizationId" defaultValue={organizationId} aria-label="Çalışma alanı">
              {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
            </select>
          </label>
          {workspaces.length > 1 ? <button type="submit">Geç</button> : null}
        </form>
        <PanelNav role={role} />
        <div className="sidebar-focus"><span>RenkFlow Core</span><b>Sipariş → PDF → Üretim</b><small>v2.0 yeniden kurulum</small></div>
      </aside>
      <div className="panel-main">
        <header className="topbar">
          <div className="mobile-brand"><BrandLogo compact /></div>
          <div className="topbar-actions">
            <div className="user-chip"><span>{userName.slice(0, 1).toUpperCase()}</span><div><b>{userName}</b><small>{role}</small></div></div>
            <form action={signOutAction}><button type="submit" className="signout-button">Çıkış</button></form>
          </div>
        </header>
        <main className="panel-content">{children}</main>
      </div>
    </div>
  );
}
