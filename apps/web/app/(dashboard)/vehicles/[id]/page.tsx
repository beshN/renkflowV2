'use client';

import { use } from 'react';
import { VehicleDetail } from '@/components/fleet/VehicleDetail';

export default function VehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <div className="rf-page space-y-5"><VehicleDetail id={id} /></div>;
}
