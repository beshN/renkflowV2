export default function DashboardLoading() {
  return (
    <div className="flex-1 p-4 md:p-8">
      <div className="space-y-4">
        <div className="h-28 animate-pulse rounded-2xl bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="h-24 animate-pulse rounded-xl bg-muted" />
          <div className="h-24 animate-pulse rounded-xl bg-muted" />
          <div className="h-24 animate-pulse rounded-xl bg-muted" />
          <div className="h-24 animate-pulse rounded-xl bg-muted" />
        </div>
        <div className="h-56 animate-pulse rounded-2xl bg-muted" />
      </div>
    </div>
  );
}
