export default function InventoryDetailLoading() {
  return (
    <div className="flex-1 p-4 md:p-8">
      <div className="space-y-4">
        <div className="h-10 w-56 animate-pulse rounded-lg bg-muted" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="h-20 animate-pulse rounded-xl bg-muted" />
          <div className="h-20 animate-pulse rounded-xl bg-muted" />
          <div className="h-20 animate-pulse rounded-xl bg-muted" />
          <div className="h-20 animate-pulse rounded-xl bg-muted" />
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-muted" />
      </div>
    </div>
  );
}
