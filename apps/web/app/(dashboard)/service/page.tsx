'use client';

import { Suspense } from 'react';
import { Skeleton } from '@/components/kit';
import { ServiceWorkspace } from '@/components/field/ServiceWorkspace';
import { useAuth } from '@/lib/context/AuthContext';

export default function ServicePage() {
  const { user } = useAuth();
  return <div className="rf-page space-y-5"><Suspense fallback={<Skeleton className="h-64" />}><ServiceWorkspace field={user?.role === 'worker'} manager={user?.role === 'owner' || user?.role === 'admin'} /></Suspense></div>;
}
