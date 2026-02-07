export function LoadingSpinner() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-50" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-gray-200 dark:border-gray-700"></div>
          <div className="absolute top-0 left-0 w-16 h-16 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" style={{ animationDuration: '0.6s' }}></div>
        </div>
        <p className="text-base font-medium text-gray-600 dark:text-gray-300">Yükleniyor...</p>
      </div>
    </div>
  );
}
