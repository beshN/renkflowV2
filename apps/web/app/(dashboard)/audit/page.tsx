'use client';

import { AppleNavbar } from '@/components/layout/AppleNavbar';
import { AuditViewer } from '@/components/audit/AuditViewer';

export default function AuditPage() {
  return <div className="min-h-screen"><AppleNavbar title="Denetim izi" showSearch={false} />
    <main className="mx-auto max-w-6xl p-4 md:p-6"><AuditViewer /></main>
  </div>;
}
