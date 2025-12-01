export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-4 border-border-light dark:border-border-dark"></div>
          <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
        </div>
        <p className="text-sm text-subtle-light dark:text-subtle-dark">Yükleniyor...</p>
      </div>
    </div>
  );
}
