export default function InventoryDetailLoading() {
  return (
    <div className="flex-1 p-4 md:p-8 pt-16 md:pt-8 space-y-4">
      <div className="h-8 w-56 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="h-24 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
        <div className="h-24 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
        <div className="h-24 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
        <div className="h-24 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
      </div>
      <div className="h-72 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
    </div>
  );
}
