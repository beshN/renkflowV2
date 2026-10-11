'use client';

import { Suspense } from 'react';
import { Skeleton } from '@/components/kit';
import { LeadsWorkspace } from '@/components/field/LeadsWorkspace';

export default function LeadsPage() {
  return <div className="rf-page space-y-5"><Suspense fallback={<Skeleton className="h-64" />}><LeadsWorkspace /></Suspense></div>;
}
