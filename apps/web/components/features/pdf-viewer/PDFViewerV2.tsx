'use client';

import React, { useEffect, useCallback, useState } from 'react';
import { usePDFStore } from '@/stores/usePDFStore';
import { PDFRenderer } from './components/PDFRenderer';
import { PDFToolbar } from './components/PDFToolbar';
import { PDFSidebar } from './components/PDFSidebar';
import { PDFSearch } from './components/PDFSearch';
import { AnnotationTools } from './components/AnnotationTools';
import { LoadingOverlay } from './LoadingOverlay';
import { ErrorOverlay } from './ErrorOverlay';
import { cn } from '@/lib/utils';

interface PDFViewerV2Props {
  fileUrl: string;
  fileName: string;
  onClose?: () => void;
  className?: string;
}

export const PDFViewerV2: React.FC<PDFViewerV2Props> = ({
  fileUrl,
  fileName,
  onClose,
  className,
}) => {
  const [attempt, setAttempt] = useState(0);
  // Store selectors
  const loading = usePDFStore((state) => state.loading);
  const loadProgress = usePDFStore((state) => state.loadProgress);
  const loadingStage = usePDFStore((state) => state.loadingStage);
  const error = usePDFStore((state) => state.error);
  const errorType = usePDFStore((state) => state.errorType);
  const retryCount = usePDFStore((state) => state.retryCount);
  const isFullscreen = usePDFStore((state) => state.isFullscreen);
  
  // Store actions
  const setDocument = usePDFStore((state) => state.setDocument);
  const resetDocument = usePDFStore((state) => state.resetDocument);
  const setLoading = usePDFStore((state) => state.setLoading);
  const setError = usePDFStore((state) => state.setError);
  const incrementRetry = usePDFStore((state) => state.incrementRetry);
  const setIsMobile = usePDFStore((state) => state.setIsMobile);
  const setFullscreen = usePDFStore((state) => state.setFullscreen);
  const toggleSearch = usePDFStore((state) => state.toggleSearch);
  const toggleSidebar = usePDFStore((state) => state.toggleSidebar);
  const nextPage = usePDFStore((state) => state.nextPage);
  const previousPage = usePDFStore((state) => state.previousPage);
  const zoomIn = usePDFStore((state) => state.zoomIn);
  const zoomOut = usePDFStore((state) => state.zoomOut);
  const undo = usePDFStore((state) => state.undo);
  const redo = usePDFStore((state) => state.redo);
  
  // Initialize document
  useEffect(() => {
    setDocument(fileUrl, fileName);
    setLoading(true);
    
    return () => {
      resetDocument();
    };
  }, [fileUrl, fileName, setDocument, setLoading, resetDocument]);

  useEffect(() => {
    if (!loading || error) return;
    const timer = setTimeout(() => {
      setError('Belge beklenen sürede açılamadı. Bağlantınızı kontrol ederek yeniden deneyin.', 'network');
      setLoading(false);
    }, 45_000);
    return () => clearTimeout(timer);
  }, [loading, error, attempt, setError, setLoading]);
  
  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, [setIsMobile]);
  
  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [setFullscreen]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      const ctrl = e.ctrlKey || e.metaKey;
      
      // Navigation
      if (e.key === 'ArrowLeft' && !ctrl) {
        previousPage();
        e.preventDefault();
      } else if (e.key === 'ArrowRight' && !ctrl) {
        nextPage();
        e.preventDefault();
      }
      
      // Zoom
      else if (e.key === '+' && ctrl) {
        zoomIn();
        e.preventDefault();
      } else if (e.key === '-' && ctrl) {
        zoomOut();
        e.preventDefault();
      }
      
      // Search
      else if (e.key === 'f' && ctrl) {
        toggleSearch();
        e.preventDefault();
      }
      
      // Sidebar
      else if (e.key === 't' && !ctrl) {
        toggleSidebar();
        e.preventDefault();
      }
      
      // Undo/Redo
      else if (e.key === 'z' && ctrl && !e.shiftKey) {
        undo();
        e.preventDefault();
      } else if (e.key === 'y' && ctrl) {
        redo();
        e.preventDefault();
      } else if (e.key === 'z' && ctrl && e.shiftKey) {
        redo();
        e.preventDefault();
      }
      
      // Close
      else if (e.key === 'Escape') {
        onClose?.();
      }
      
      // Fullscreen
      else if (e.key === 'F11') {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen();
        } else {
          document.exitFullscreen();
        }
        e.preventDefault();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    nextPage,
    previousPage,
    zoomIn,
    zoomOut,
    toggleSearch,
    toggleSidebar,
    undo,
    redo,
    onClose,
  ]);
  
  // Handle retry
  const handleRetry = useCallback(() => {
    if (retryCount < 3) {
      incrementRetry();
      setError(null);
      setLoading(true);
      setAttempt(value => value + 1);
    }
  }, [retryCount, incrementRetry, setError, setLoading]);
  
  // Handle download
  const handleDownload = useCallback(async () => {
    try {
      const response = await fetch(fileUrl, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`);
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.rel = 'noopener noreferrer';
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      setError('Belge indirilemedi. Yeni sekmede açmayı deneyin.', 'network');
    }
  }, [fileUrl, fileName, setError]);
  
  // Handle print
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleOpenInNewTab = useCallback(() => {
    if (typeof window === 'undefined') return;
    const nextWindow = window.open(fileUrl, '_blank', 'noopener,noreferrer');
    if (!nextWindow) {
      console.warn('Could not open PDF in a new tab');
    }
  }, [fileUrl]);
  
  // Handle share
  const handleShare = useCallback(async () => {
    const shareUrl = fileUrl.startsWith('http')
      ? fileUrl
      : new URL(fileUrl, window.location.origin).toString();

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
    } catch (err) {
      console.error('Share error:', err);
    }
  }, [fileUrl]);
  
  return (
    <div
      className={cn(
        'fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-sm flex flex-col',
        isFullscreen && 'bg-black',
        className
      )}
    >
      {/* Loading Overlay */}
      {loading && !error && (
        <LoadingOverlay
          actualProgress={loadProgress}
          stage={loadingStage}
          onClose={onClose}
        />
      )}
      
      {/* Error Overlay */}
      {error && (
        <ErrorOverlay
          message={error}
          errorType={errorType}
          onRetry={handleRetry}
          onClose={onClose || (() => {})}
          additionalActions={
            <button
              onClick={handleOpenInNewTab}
              className="px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-slate-400/50"
            >
              Yeni Sekmede Aç
            </button>
          }
          retryCount={retryCount}
        />
      )}
      
      {/* Main Content */}
      {!error && (
        <>
          {/* Toolbar */}
          <PDFToolbar
            fileName={fileName}
            onClose={onClose}
            onDownload={handleDownload}
            onPrint={handlePrint}
            onShare={handleShare}
          />
          
          {/* Search Bar */}
          <PDFSearch />
          
          {/* Content Area */}
          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar */}
            <PDFSidebar />
            
            {/* PDF Renderer */}
            <PDFRenderer
              key={`${fileUrl}:${attempt}`}
              onDocumentLoadSuccess={(numPages) => {
                console.log(`PDF loaded: ${numPages} pages`);
              }}
              onDocumentLoadError={(error) => {
                console.error('PDF load error:', error);
              }}
            />
          </div>
          
          {/* Annotation Tools (Floating) */}
          <div className="fixed bottom-6 right-6 z-50">
            <AnnotationTools />
          </div>
        </>
      )}
    </div>
  );
};

export default PDFViewerV2;
