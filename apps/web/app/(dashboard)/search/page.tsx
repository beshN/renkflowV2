import { OrderSearch } from '@/components/features/orders/OrderSearch';

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return <OrderSearch initialQuery={q || ''} />;
}
