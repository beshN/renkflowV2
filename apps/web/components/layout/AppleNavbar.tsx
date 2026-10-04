'use client';

import type { ReactNode } from 'react';

interface AppleNavbarProps { title: string; showSearch?: boolean; action?: ReactNode }

// WorkspaceHeader owns global navigation and search. This is the page toolbar.
export function AppleNavbar({ title, action }: AppleNavbarProps) {
  return <div className="rf-page-toolbar flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-5 md:px-7">
    <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
    {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
  </div>;
}
