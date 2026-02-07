import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { NewInventoryItemForm } from '@/components/features/inventory/NewInventoryItemForm';

export default function NewInventoryPage() {
  return (
    <div className="flex-1 flex flex-col">
      <Navbar title="Yeni Envanter Kalemi" showSearch={false} />

      <main className="flex-1 p-4 md:p-8 pt-16 md:pt-8 space-y-4 max-w-3xl w-full">
        <Link href="/inventory" className="text-sm text-blue-600 hover:underline">← Envantere dön</Link>
        <NewInventoryItemForm />
      </main>
    </div>
  );
}
