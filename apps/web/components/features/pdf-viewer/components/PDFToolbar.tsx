'use client';

import React, { useCallback, useState } from 'react';
import { usePDFStore } from '@/stores/usePDFStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Maximize,
  Minimize,
  Download,
  Printer,
  Share2,
  Search,
  Settings,
  Columns,
  FileText,
  Bookmark,
  X,
  Check,
  Loader2,
  Menu,
} from 'lucide-react';
import type { ViewMode } from '@/stores/usePDFStore';

interface PDFToolbarProps {
  fileName?: string;
  onClose?: () => void;
  onDownload?: () => void;
  onPrint?: () => void;
  onShare?: () => void;
  className?: string;
}

export const PDFToolbar: React.FC<PDFToolbarProps> = ({
  fileName,
  onClose,
  onDownload,
  onPrint,
  onShare,
  className,
}) => {
  const [pageInputValue, setPageInputValue] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const pageNumber = usePDFStore((state) => state.pageNumber);
  const numPages = usePDFStore((state) => state.numPages);
  const scale = usePDFStore((state) => state.scale);
  const rotation = usePDFStore((state) => state.rotation);
  const viewMode = usePDFStore((state) => state.viewMode);
  const isFullscreen = usePDFStore((state) => state.isFullscreen);
  const showSidebar = usePDFStore((state) => state.showSidebar);
  const isMobile = usePDFStore((state) => state.isMobile);
  const renderQuality = usePDFStore((state) => state.renderQuality);
  
  const nextPage = usePDFStore((state) => state.nextPage);
  const previousPage = usePDFStore((state) => state.previousPage);
  const goToPage = usePDFStore((state) => state.goToPage);
  const zoomIn = usePDFStore((state) => state.zoomIn);
  const zoomOut = usePDFStore((state) => state.zoomOut);
  const setScale = usePDFStore((state) => state.setScale);
  const rotate = usePDFStore((state) => state.rotate);
  const setViewMode = usePDFStore((state) => state.setViewMode);
  const setFullscreen = usePDFStore((state) => state.setFullscreen);
  const toggleSidebar = usePDFStore((state) => state.toggleSidebar);
  const toggleSearch = usePDFStore((state) => state.toggleSearch);
  const toggleBookmark = usePDFStore((state) => state.toggleBookmark);
  const isPageBookmarked = usePDFStore((state) => state.isPageBookmarked);
  const setRenderQuality = usePDFStore((state) => state.setRenderQuality);
  
  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInputValue(e.target.value);
  };
  
  const handlePageInputSubmit = () => {
    const page = parseInt(pageInputValue, 10);
    if (!isNaN(page) && page >= 1 && page <= numPages) {
      goToPage(page);
    }
    setPageInputValue('');
  };
  
  const handlePageInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handlePageInputSubmit();
    }
  };
  
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  }, [setFullscreen]);
  
  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    try {
      await onDownload?.();
    } finally {
      setIsDownloading(false);
    }
  }, [onDownload]);
  
  const handlePrint = useCallback(async () => {
    setIsPrinting(true);
    try {
      await onPrint?.();
    } finally {
      setIsPrinting(false);
    }
  }, [onPrint]);
  
  const handleShare = useCallback(async () => {
    setCopied(true);
    await onShare?.();
    setTimeout(() => setCopied(false), 2000);
  }, [onShare]);
  
  const zoomPercentage = Math.round(scale * 100);
  
  return (
    <header className={cn(
      'bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-3 py-2',
      className
    )}>
      <div className="flex items-center justify-between gap-2">
        {/* Left Section */}
        <div className="flex items-center gap-2">
          {/* Mobile Menu */}
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="h-9 w-9"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
          
          {/* File Name */}
          <div className="hidden sm:block">
            <h1 className="text-sm font-semibold text-slate-900 dark:text-white truncate max-w-xs">
              {fileName || 'PDF Viewer'}
            </h1>
          </div>
        </div>
        
        {/* Center Section - Navigation & Zoom */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Page Navigation */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={previousPage}
              disabled={pageNumber <= 1}
              title="Önceki sayfa"
              className="h-9 w-9"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            
            <div className="flex items-center gap-1 px-2">
              <Input
                type="text"
                value={pageInputValue || pageNumber}
                onChange={handlePageInputChange}
                onKeyDown={handlePageInputKeyDown}
                onBlur={handlePageInputSubmit}
                className="w-12 h-8 text-center text-sm"
                placeholder={pageNumber.toString()}
              />
              <span className="text-sm text-slate-500">/ {numPages}</span>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={nextPage}
              disabled={pageNumber >= numPages}
              title="Sonraki sayfa"
              className="h-9 w-9"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
          
          <div className="hidden sm:block h-6 w-px bg-slate-200 dark:bg-slate-700" />
          
          {/* Zoom Controls */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={zoomOut}
              disabled={scale <= 0.25}
              title="Uzaklaştır"
              className="h-9 w-9"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            
            <div className="hidden sm:flex items-center px-2 min-w-[60px] justify-center">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {zoomPercentage}%
              </span>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={zoomIn}
              disabled={scale >= 4.0}
              title="Yakınlaştır"
              className="h-9 w-9"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Rotation */}
          <div className="hidden md:flex items-center gap-1">
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => rotate(-90)}
              title="Sola döndür"
              className="h-9 w-9"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => rotate(90)}
              title="Sağa döndür"
              className="h-9 w-9"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Right Section - Actions */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* View Mode */}
          <div className="hidden lg:flex items-center gap-1 bg-slate-100 dark:bg-slate-900 rounded-md p-0.5">
            <Button
              variant={viewMode === 'single' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('single')}
              title="Tek sayfa"
              className="h-8 w-8"
            >
              <FileText className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'continuous' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('continuous')}
              title="Sürekli kaydırma"
              className="h-8 w-8"
            >
              <Columns className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'two-page' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('two-page')}
              title="İki sayfa"
              className="h-8 w-8"
            >
              <Columns className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="hidden sm:block h-6 w-px bg-slate-200 dark:bg-slate-700" />
          
          {/* Search */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSearch}
            title="Ara (Ctrl+F)"
            className="h-9 w-9"
          >
            <Search className="h-5 w-5" />
          </Button>
          
          {/* Bookmark */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => toggleBookmark(pageNumber)}
            title="Yer İmi (Ctrl+B)"
            className="h-9 w-9"
          >
            <Bookmark 
              className={cn(
                'h-5 w-5',
                isPageBookmarked(pageNumber) && 'fill-blue-500 text-blue-500'
              )} 
            />
          </Button>
          
          {/* Settings */}
          <div className="relative hidden lg:block">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
              title="Ayarlar"
              className="h-9 w-9"
            >
              <Settings className="h-5 w-5" />
            </Button>
            
            {showSettings && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 p-3">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">Ayarlar</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setShowSettings(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-2 block">
                      Render Kalitesi: {renderQuality}x
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="4"
                      step="1"
                      value={renderQuality}
                      onChange={(e) => setRenderQuality(parseInt(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                      <span>Düşük</span>
                      <span>Yüksek</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="hidden sm:block h-6 w-px bg-slate-200 dark:bg-slate-700" />
          
          {/* Fullscreen */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            title="Tam Ekran (F11)"
            className="hidden sm:flex h-9 w-9"
          >
            {isFullscreen ? (
              <Minimize className="h-5 w-5" />
            ) : (
              <Maximize className="h-5 w-5" />
            )}
          </Button>
          
          {/* Share */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleShare}
            title="Paylaş"
            className="hidden sm:flex h-9 w-9"
          >
            {copied ? (
              <Check className="h-5 w-5 text-green-500" />
            ) : (
              <Share2 className="h-5 w-5" />
            )}
          </Button>
          
          {/* Download */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDownload}
            disabled={isDownloading}
            title="İndir (Ctrl+S)"
            className="h-9 w-9"
          >
            {isDownloading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Download className="h-5 w-5" />
            )}
          </Button>
          
          {/* Print */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrint}
            disabled={isPrinting}
            title="Yazdır (Ctrl+P)"
            className="hidden sm:flex h-9 w-9"
          >
            {isPrinting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Printer className="h-5 w-5" />
            )}
          </Button>
          
          {/* Close */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            title="Kapat (Esc)"
            className="h-9 w-9"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default PDFToolbar;
