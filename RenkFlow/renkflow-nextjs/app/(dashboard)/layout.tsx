'use client';

import { Sidebar } from '@/components/layout/Sidebar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ReactNode } from 'react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen relative overflow-hidden">
      {/* Premium Surface Background */}
      <div className="fixed inset-0 pointer-events-none z-[-1] dashboard-surface" />
      <div className="fixed inset-0 pointer-events-none z-[-1] dashboard-grid opacity-60" />

      <Sidebar />
      <main className="flex-1 w-full min-w-0 pb-20 md:pb-0 z-10">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>
      <MobileBottomNav />
    </div>
  );
}
