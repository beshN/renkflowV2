'use client';

import { ReactNode, useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { RouteTransition } from '@/components/layout/RouteTransition';
import { ExperienceBackdrop } from '@/components/layout/ExperienceBackdrop';
import { AuthProviders } from '@/lib/context/Providers';
import { AIChatbot } from '@/components/ai/AIChatbot';
import { cn } from '@/lib/utils';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  return (
    <div className="rf-app-shell rf-dashboard-shell relative flex min-h-screen overflow-hidden">
      <ExperienceBackdrop variant="dashboard" />

      <AuthProviders>
        <Sidebar onDesktopExpandedChange={setIsSidebarExpanded} />

        <main
          className={cn(
            'relative z-10 flex min-w-0 flex-1 pb-20 md:pb-0',
            'transition-[margin-left,width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
            isSidebarExpanded ? 'md:ml-72 md:w-[calc(100%-18rem)]' : 'md:ml-[5.5rem] md:w-[calc(100%-5.5rem)]',
          )}
        >
          <ErrorBoundary>
            <RouteGuard>
              <RouteTransition className="w-full">{children}</RouteTransition>
            </RouteGuard>
          </ErrorBoundary>
        </main>

        <MobileBottomNav />
        <AIChatbot />
      </AuthProviders>
    </div>
  );
}
