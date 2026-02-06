'use client';

import { Sidebar } from '@/components/layout/Sidebar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { AIChatbot } from '@/components/ai/AIChatbot';
import { ReactNode, useState } from 'react';
import { cn } from '@/lib/utils';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  return (
    <div className="flex min-h-screen relative overflow-hidden">
      {/* Premium Surface Background */}
      <div className="fixed inset-0 pointer-events-none z-[-1] dashboard-surface" />
      <div className="fixed inset-0 pointer-events-none z-[-1] dashboard-grid opacity-60" />

      <Sidebar onDesktopExpandedChange={setIsSidebarExpanded} />
      <main
        className={cn(
          "flex-1 w-full min-w-0 pb-20 md:pb-0 z-10",
          "transition-[margin-left,width] duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]",
          "md:origin-left",
          isSidebarExpanded
            ? "md:ml-72 md:w-[calc(100%-18rem)]"
            : "md:ml-20 md:w-[calc(100%-5rem)]"
        )}
      >
        <ErrorBoundary>
          <RouteGuard>
            {children}
          </RouteGuard>
        </ErrorBoundary>
      </main>
      <MobileBottomNav />
      <AIChatbot />
    </div>
  );
}
