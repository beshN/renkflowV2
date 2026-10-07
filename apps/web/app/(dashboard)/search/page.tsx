import { WorkspaceSearch } from '@/components/features/search/WorkspaceSearch';

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return <WorkspaceSearch initialQuery={q || ''} />;
}
