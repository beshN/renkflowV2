'use client';

import { ReactNode, useEffect, useState } from 'react';
import { AppleSidebar } from '@/components/layout/AppleSidebar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { RouteTransition } from '@/components/layout/RouteTransition';
import { AuthProviders } from '@/lib/context/Providers';
import { AIChatbot } from '@/components/ai/AIChatbot';
import { cn } from '@/lib/utils';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isSidebarEffectivelyExpanded, setIsSidebarEffectivelyExpanded] = useState(false);
  useEffect(() => {
    if (localStorage.getItem('rf.sidebar.pinned') === 'true') setIsSidebarCollapsed(false);
  }, []);

  return (
    <div className="rf-app-shell rf-dashboard-shell relative flex min-h-screen overflow-hidden bg-neutral-50 dark:bg-black">

      <AuthProviders>
        <AppleSidebar 
          collapsed={isSidebarCollapsed} 
          setCollapsed={setIsSidebarCollapsed}
          onExpandedChange={setIsSidebarEffectivelyExpanded}
        />

        <main
          className={cn(
            'relative z-10 flex min-w-0 flex-1 flex-col pb-20 md:pb-0',
            'transition-[margin-left] duration-150 ease-out motion-reduce:transition-none',
            isSidebarEffectivelyExpanded ? 'md:ml-[17.5rem] md:w-[calc(100%-17.5rem)]' : 'md:ml-20 md:w-[calc(100%-5rem)]'
          )}
        >
          <ErrorBoundary>
            <RouteGuard>
              <RouteTransition className="w-full h-full">{children}</RouteTransition>
            </RouteGuard>
          </ErrorBoundary>
        </main>

        <MobileBottomNav />
        <AIChatbot />
      </AuthProviders>
    </div>
  );
}
