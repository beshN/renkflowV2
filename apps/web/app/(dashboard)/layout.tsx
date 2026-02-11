'use client';

import { Sidebar } from '@/components/layout/Sidebar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { AIChatbot } from '@/components/ai/AIChatbot';
import { AuthProviders } from '@/lib/context/Providers';
import { ReactNode, useState } from 'react';
import { cn } from '@/lib/utils';
import { ExperienceBackdrop } from '@/components/layout/ExperienceBackdrop';
import { RouteTransition } from '@/components/layout/RouteTransition';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  return (
    <div className="rf-app-shell flex min-h-screen relative overflow-hidden">
      <ExperienceBackdrop variant="dashboard" />

      <AuthProviders>
        <Sidebar onDesktopExpandedChange={setIsSidebarExpanded} />
        <main
          className={cn(
            "flex-1 w-full min-w-0 pb-20 md:pb-0 z-10",
            "transition-[margin-left,width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
            "md:will-change-[margin-left,width]",
            "md:origin-left",
            isSidebarExpanded
              ? "md:ml-72 md:w-[calc(100%-18rem)]"
              : "md:ml-20 md:w-[calc(100%-5rem)]"
          )}
        >
          <ErrorBoundary>
            <RouteGuard>
              <RouteTransition>{children}</RouteTransition>
            </RouteGuard>
          </ErrorBoundary>
        </main>
        <MobileBottomNav />
        <AIChatbot />
      </AuthProviders>
    </div>
  );
}
