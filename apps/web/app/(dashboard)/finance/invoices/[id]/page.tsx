'use client';

import { useParams } from 'next/navigation';
import { InvoiceDocument } from '@/components/finance/InvoiceScreens';

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  return <div className="rf-page space-y-5"><InvoiceDocument id={id} /></div>;
}
