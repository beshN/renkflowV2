'use client';

import { Suspense } from 'react';
import { Skeleton } from '@/components/kit';
import { StatementView } from '@/components/finance/InvoiceScreens';

export default function StatementPage() {
  return <div className="rf-page space-y-5"><Suspense fallback={<Skeleton className="h-48" />}><StatementView /></Suspense></div>;
}
