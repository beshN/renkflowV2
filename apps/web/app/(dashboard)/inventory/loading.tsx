export default function InventoryLoading() {
  return (
    <div className="flex-1 p-4 md:p-8 pt-16 md:pt-8 space-y-4">
      <div className="h-8 w-48 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
      <div className="h-20 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
      <div className="h-96 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
    </div>
  );
}
