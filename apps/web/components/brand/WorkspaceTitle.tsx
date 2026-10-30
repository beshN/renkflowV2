'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { DASHBOARD_NAV_GROUPS } from '@/lib/core/dashboard-nav';

// Screens opened from an action or the account menu rather than a menu row.
const EXTRA=[{href:'/new-order',label:'Yeni sipariş'},{href:'/account',label:'Hesabım'},{href:'/notifications',label:'Bildirimler'},{href:'/search',label:'Arama'}];
const routes=[...DASHBOARD_NAV_GROUPS.flatMap(group=>group.items).filter(item=>!item.action),...EXTRA].sort((a,b)=>b.href.length-a.href.length);
/** Browser tabs use the current workspace module and the shared product name. */
export function WorkspaceTitle() {
  const pathname=usePathname();
  useEffect(()=>{
    const page=routes.find(item=>pathname===item.href || pathname.startsWith(item.href+'/'));
    document.title=page ? `${page.label} | RenkFlow` : 'RenkFlow';
  },[pathname]);
  return null;
}
