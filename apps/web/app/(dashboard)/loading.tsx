import { Skeleton } from '@/components/kit/Skeleton';

/** While a workspace screen loads: a page-shaped placeholder inside the kept shell. */
export default function WorkspaceLoading() {
  return (
    <div className="rf-page space-y-5" role="status">
      <span className="sr-only">Sayfa açılıyor</span>
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-64 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((k) => <Skeleton key={k} className="h-20" />)}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
