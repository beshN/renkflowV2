import React from 'react';

interface ErrorOverlayProps {
  onRetry: () => void;
  onClose: () => void;
}

const ErrorOverlay: React.FC<ErrorOverlayProps> = ({ onRetry, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 dark:bg-gray-900/95 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-md p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-red-100 dark:border-red-900/30 text-center relative">
        <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="material-icons-outlined text-4xl text-red-500 dark:text-red-400">error_outline</span>
        </div>
        
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Failed to Load</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
          We couldn&apos;t load the document you requested. It might be corrupted or in an unsupported format.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button 
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
                Cancel
            </button>
            <button 
                onClick={onRetry}
                className="px-6 py-2.5 rounded-xl bg-primary text-white font-medium shadow-lg shadow-primary/30 hover:bg-primary/90 hover:shadow-primary/40 transition-all active:scale-95"
            >
                Try Again
            </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorOverlay;
