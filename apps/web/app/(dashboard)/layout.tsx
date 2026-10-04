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
import { WorkspaceHeader } from '@/components/layout/WorkspaceHeader';
import { WorkspaceCommands } from '@/components/layout/WorkspaceCommands';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarEffectivelyExpanded, setIsSidebarEffectivelyExpanded] = useState(true);
  useEffect(() => {
    try { setIsSidebarCollapsed(localStorage.getItem('rf.sidebar.pinned') === 'false'); } catch { /* Use the expanded menu. */ }
  }, []);

  return (
    <div className="rf-app-shell rf-dashboard-shell relative flex min-h-screen overflow-x-clip">

      <AuthProviders>
        <WorkspaceCommands>
        <a href="#workspace-content" className="rf-skip-link">İçeriğe geç</a>
        <AppleSidebar 
          collapsed={isSidebarCollapsed} 
          setCollapsed={setIsSidebarCollapsed}
          onExpandedChange={setIsSidebarEffectivelyExpanded}
        />

        <div
          className={cn(
            'relative z-10 flex min-w-0 flex-1 flex-col pb-20 md:pb-0',
            'md:transition-[margin-left] md:duration-150 ease-out motion-reduce:transition-none',
            isSidebarEffectivelyExpanded ? 'md:ml-[252px]' : 'md:ml-[72px]'
          )}
        >
          <WorkspaceHeader />
          <div id="assistant-context-slot" />
          <main id="workspace-content" tabIndex={-1} className="min-w-0 flex-1 outline-none">
          <ErrorBoundary>
            <RouteGuard>
              <RouteTransition className="w-full h-full">{children}</RouteTransition>
            </RouteGuard>
          </ErrorBoundary>
          </main>
        </div>

        <MobileBottomNav />
        <AIChatbot />
        </WorkspaceCommands>
      </AuthProviders>
    </div>
  );
}
