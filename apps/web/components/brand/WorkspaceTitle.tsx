'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { DASHBOARD_NAV_GROUPS } from '@/lib/core/dashboard-nav';

const routes=DASHBOARD_NAV_GROUPS.flatMap(group=>group.items).filter(item=>!item.action).sort((a,b)=>b.href.length-a.href.length);
/** Browser tabs use the current workspace module and the shared product name. */
export function WorkspaceTitle() {
  const pathname=usePathname();
  useEffect(()=>{
    const page=routes.find(item=>pathname===item.href || pathname.startsWith(item.href+'/'));
    document.title=page ? `${page.label} | RenkFlow` : 'RenkFlow';
  },[pathname]);
  return null;
}
