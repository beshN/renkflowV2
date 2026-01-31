'use client';

import { Sidebar } from '@/components/layout/Sidebar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ReactNode } from 'react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50/50 dark:bg-slate-950/50 relative overflow-hidden">
      {/* Subtle Aurora Background for Dashboard */}
      <div className="fixed inset-0 pointer-events-none z-[-1]">
        <div className="absolute top-[0%] left-[0%] w-[40%] h-[40%] rounded-full bg-blue-500/5 blur-[100px]" />
        <div className="absolute bottom-[0%] right-[0%] w-[40%] h-[40%] rounded-full bg-purple-500/5 blur-[100px]" />
        <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] rounded-full bg-indigo-500/5 blur-[100px]" />
      </div>

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
