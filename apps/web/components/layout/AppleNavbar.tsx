'use client';

import type { ReactNode } from 'react';

interface AppleNavbarProps { title: string; showSearch?: boolean; action?: ReactNode }

// WorkspaceHeader owns global navigation and search. This is the page toolbar; its title matches
// PageHeader so the heading does not change size between modules.
export function AppleNavbar({ title, action }: AppleNavbarProps) {
  return <div className="rf-page-toolbar mx-auto flex w-full max-w-[1600px] flex-wrap items-end justify-between gap-3 border-b border-border px-4 pb-4 pt-5 md:px-7 md:pt-7">
    <h1 className="rf-page-title !mt-0">{title}</h1>
    {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
  </div>;
}
