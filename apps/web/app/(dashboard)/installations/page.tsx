'use client';

import { Suspense } from 'react';
import { Skeleton } from '@/components/kit';
import { InstallationsWorkspace } from '@/components/field/InstallationsWorkspace';
import { useAuth } from '@/lib/context/AuthContext';

export default function InstallationsPage() {
  const { user } = useAuth();
  return <div className="rf-page space-y-5"><Suspense fallback={<Skeleton className="h-64" />}><InstallationsWorkspace field={user?.role === 'worker'} /></Suspense></div>;
}
