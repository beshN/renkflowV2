import React, { useEffect, useState } from 'react';
import { DocumentFile } from './types';

interface LoadingOverlayProps {
  file: DocumentFile | null;
  onClose: () => void;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ file, onClose }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + Math.random() * 15;
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-gray-900/90 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 relative overflow-hidden">
        {/* Close Button */}
        <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
            <span className="material-icons-outlined">close</span>
        </button>

        <div className="flex flex-col items-center text-center space-y-6">
          <div className="relative w-20 h-20">
             <div className="absolute inset-0 rounded-full border-4 border-gray-100 dark:border-gray-700"></div>
             <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
             <div className="absolute inset-0 flex items-center justify-center">
                 <span className="material-icons-outlined text-3xl text-primary">description</span>
             </div>
          </div>
          
          <div className="space-y-2 w-full">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Opening Document</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate px-4">{file?.name || 'Loading...'}</p>
          </div>

          <div className="w-full space-y-2">
             <div className="h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                 <div 
                    className="h-full bg-primary transition-all duration-300 ease-out rounded-full relative overflow-hidden"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                 >
                    <div className="absolute inset-0 bg-white/30 animate-progressBar"></div>
                 </div>
             </div>
             <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">{Math.round(Math.min(progress, 100))}%</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingOverlay;
