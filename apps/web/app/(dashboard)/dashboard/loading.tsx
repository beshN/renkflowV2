export default function DashboardLoading() {
  return (
    <div className="flex-1 p-4 md:p-8 pt-16 md:pt-8 space-y-4">
      <div className="h-8 w-64 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="h-28 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
        <div className="h-28 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
        <div className="h-28 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
        <div className="h-28 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-64 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
        <div className="h-64 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
      </div>
    </div>
  );
}
