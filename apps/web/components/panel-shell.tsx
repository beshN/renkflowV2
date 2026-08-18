"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, ChevronLeft, ChevronRight, Command, LogOut, Moon, Search, Sun } from "lucide-react";
import { signOutAction, switchOrganizationAction } from "@/app/actions/auth";
import { BrandLogo } from "@/components/brand-logo";
import { PanelNav } from "@/components/panel-nav";
import type { OrganizationRole } from "@/lib/types";

const roleNames: Record<OrganizationRole, string> = {
  owner: "Kurucu",
  admin: "Yönetici",
  office: "Ofis",
  production: "Üretim",
};

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
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);

  function toggleSidebar() {
    setCollapsed((value) => {
      return !value;
    });
  }

  function toggleTheme() {
    setDark((value) => {
      const next = !value;
      document.documentElement.dataset.theme = next ? "dark" : "light";
      return next;
    });
  }

  return (
    <div className={`panel-layout ${collapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-logo-row">
          <Link className="brand sidebar-brand" href="/panel" aria-label="RenkFlow paneli">
            <BrandLogo compact={collapsed} priority />
          </Link>
          <button type="button" className="sidebar-toggle" onClick={toggleSidebar} aria-label={collapsed ? "Menüyü genişlet" : "Menüyü daralt"}>
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

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

        <div className="sidebar-profile">
          <span>{userName.slice(0, 1).toUpperCase()}</span>
          <div><b>{userName}</b><small>{roleNames[role]}</small></div>
          <form action={signOutAction}>
            <button type="submit" aria-label="Oturumu kapat" title="Oturumu kapat"><LogOut size={16} /></button>
          </form>
        </div>
      </aside>

      <div className="panel-main">
        <header className="topbar">
          <div className="mobile-brand"><BrandLogo /></div>
          <form className="global-search" action="/panel/arama" method="get">
            <Search size={17} aria-hidden="true" />
            <input name="q" placeholder="Sipariş, müşteri, proje veya PDF ara…" aria-label="Panelde ara" />
            <span><Command size={12} /> K</span>
          </form>
          <div className="topbar-actions">
            <button type="button" className="icon-button" onClick={toggleTheme} aria-label={dark ? "Açık temaya geç" : "Koyu temaya geç"}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Link className="icon-button notification-button" href="/panel/bildirimler" aria-label="Bildirimler"><Bell size={18} /><i /></Link>
            <div className="user-chip"><span>{userName.slice(0, 1).toUpperCase()}</span><div><b>{userName}</b><small>{roleNames[role]}</small></div></div>
          </div>
        </header>
        <main className="panel-content">{children}</main>
      </div>
      <PanelNav role={role} mobile />
    </div>
  );
}
