import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Image from 'next/image';
import { Document, Page, pdfjs } from 'react-pdf';
import { DocumentFile, SidebarMode } from './types';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set worker source - use CDN for reliability across environments
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  file: DocumentFile;
  onClose: () => void;
  onError: () => void;
}

// --- Helper Component for Sidebar Thumbnails ---
const PdfThumbnail = ({ fileUrl, pageNumber, onClick, isActive }: { fileUrl: string, pageNumber: number, onClick: () => void, isActive: boolean }) => {
    return (
        <div className={`flex flex-col items-center space-y-2 cursor-pointer group`} onClick={onClick}>
            <div className={`relative w-full p-1 border-2 rounded-lg bg-white transition-all ${isActive ? 'border-primary ring-2 ring-primary/20' : 'border-gray-100 dark:border-gray-700 group-hover:border-gray-300'}`}>
                <div className="aspect-[3/4] overflow-hidden rounded bg-gray-100 relative flex items-center justify-center">
                     <Document file={fileUrl} loading={<div className="animate-pulse w-full h-full bg-gray-100" />}>
                        <Page 
                            pageNumber={pageNumber} 
                            width={100} 
                            renderTextLayer={false} 
                            renderAnnotationLayer={false}
                        />
                     </Document>
                </div>
                <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] px-1.5 rounded">{pageNumber}</div>
            </div>
        </div>
    );
};

const PDFViewer: React.FC<PDFViewerProps> = ({ file, onClose, onError }) => {
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('none');
  const [zoom, setZoom] = useState(100);
  const [numPages, setNumPages] = useState<number>(0);
  const [activePage, setActivePage] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Error state for fallback
  const [hasError, setHasError] = useState(false);
  
  // Touch state for Pinch-to-Zoom
  const [initialTouchDistance, setInitialTouchDistance] = useState<number | null>(null);
  const [initialZoom, setInitialZoom] = useState<number>(100);

  // Check if it's a real PDF (embedded) or Image-based
  const isRealPdf = file.type === 'pdf' || file.name.toLowerCase().endsWith('.pdf');
  const fileUrl = file.pages[0];

  // Memoize PDF options to prevent re-render warnings
  const pdfOptions = useMemo(() => ({
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/standard_fonts/',
  }), []);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setHasError(false);
  }

  function onDocumentLoadError() {
      console.error('PDF Render Error, switching to fallback');
      setHasError(true);
      // We don't call onError() immediately, we show the fallback iframe first
  }

  // Initial Setup
  useEffect(() => {
      setActivePage(1);
      setZoom(100);
      setHasError(false);
  }, [file.id]);

  const handleZoomIn = useCallback(() => setZoom((prev) => Math.min(prev + 25, 200)), []);
  const handleZoomOut = useCallback(() => setZoom((prev) => Math.max(prev - 25, 50)), []);

  const toggleSidebar = () => setSidebarMode(prev => prev === 'thumbnails' ? 'none' : 'thumbnails');

  const handleNextPage = () => setActivePage(p => Math.min(p + 1, numPages || 1));
  const handlePrevPage = () => setActivePage(p => Math.max(p - 1, 1));

  const handleDownload = async () => {
    try {
      // Fetch the file as blob
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      
      // Create blob URL
      const blobUrl = window.URL.createObjectURL(blob);
      
      // Create temporary link
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = file.name;
      link.style.display = 'none';
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      }, 100);
    } catch (error) {
      console.error('Download error:', error);
      // Fallback: open in new tab if download fails
      window.open(fileUrl, '_blank');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Pinch to Zoom
  const getDistance = (touches: React.TouchList) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      setInitialTouchDistance(getDistance(e.touches));
      setInitialZoom(zoom);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialTouchDistance !== null) {
      const distance = getDistance(e.touches);
      const scale = distance / initialTouchDistance;
      setZoom(Math.max(50, Math.min(initialZoom * scale, 300)));
      e.preventDefault(); 
    }
  };

  const handleTouchEnd = () => setInitialTouchDistance(null);

  // If error or fallback, show simple viewer
  const showFallback = hasError || !isRealPdf;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-[60] animate-fadeIn" onClick={onClose} />
      
      {/* Modal Container */}
      <div className={`fixed z-[61] flex items-center justify-center pointer-events-none transition-all duration-300 ${
        isFullscreen ? 'inset-0' : 'inset-4 md:inset-8 lg:inset-16'
      }`}>
        <div className="w-full h-full max-w-7xl bg-surface-light dark:bg-surface-dark rounded-lg shadow-2xl overflow-hidden flex flex-col md:flex-row pointer-events-auto animate-scaleIn">
          {/* Print-only: Hide header when printing */}
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              .pdf-viewer-header { display: none !important; }
              .pdf-viewer-sidebar { display: none !important; }
            }
          `}} />
        
        {/* Sidebar (Only show if real PDF and no error) */}
        {!hasError && (
            <div className={`pdf-viewer-sidebar bg-background-light dark:bg-background-dark border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out flex flex-col z-20 ${sidebarMode !== 'none' ? 'w-full md:w-80 absolute md:relative h-full shadow-xl md:shadow-none' : 'w-0 overflow-hidden'}`}>
            {/* Thumbnails */}
            {sidebarMode === 'thumbnails' && (
                <>
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Pages</h2>
                    <button onClick={() => setSidebarMode('none')} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"><span className="material-symbols-outlined">chevron_left</span></button>
                </div>
                <div className="p-4 overflow-y-auto custom-scrollbar flex-1 bg-white dark:bg-gray-900">
                    <div className="grid grid-cols-2 gap-4">
                    {isRealPdf && Array.from({ length: numPages }).map((_, i) => (
                        <PdfThumbnail 
                            key={i} 
                            fileUrl={fileUrl} 
                            pageNumber={i + 1} 
                            onClick={() => setActivePage(i + 1)} 
                            isActive={activePage === i + 1}
                        />
                    ))}
                    </div>
                </div>
                </>
            )}
            </div>
        )}

        {/* Main Viewer Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-gray-100 dark:bg-gray-900 relative">
          <header className="pdf-viewer-header flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-surface-light dark:bg-surface-dark flex-shrink-0 z-30 shadow-sm">
            <div className="flex items-center space-x-3 min-w-0">
              {!hasError && <button onClick={toggleSidebar} className={`p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 ${sidebarMode !== 'none' ? 'bg-gray-100 dark:bg-gray-800 text-primary' : ''}`} title="Küçük resimleri göster/gizle"><span className="material-symbols-outlined">menu</span></button>}
              <div className="min-w-0">
                <h1 className="text-sm font-semibold text-gray-800 dark:text-white truncate max-w-[200px]">{file.name}</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    {hasError ? 'Native Viewer' : `PDF • ${file.size}`}
                </p>
              </div>
            </div>
            
            {/* Controls (Hide standard controls if error/fallback) */}
            {!hasError && (
                <div className="flex items-center space-x-1 sm:space-x-3">
                <div className="flex items-center bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-sm">
                    <button onClick={handlePrevPage} disabled={activePage <= 1} className="p-1.5 text-gray-500 hover:text-gray-800 disabled:opacity-30"><span className="material-symbols-outlined text-lg">chevron_left</span></button>
                    <span className="px-2 text-xs font-mono font-medium text-gray-700 dark:text-gray-300 w-12 text-center">{activePage} / {numPages || 1}</span>
                    <button onClick={handleNextPage} disabled={activePage >= (numPages || 1)} className="p-1.5 text-gray-500 hover:text-gray-800 disabled:opacity-30"><span className="material-symbols-outlined text-lg">chevron_right</span></button>
                </div>
                <div className="hidden md:flex items-center bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-sm">
                    <button onClick={handleZoomOut} className="p-1.5 text-gray-500 hover:text-gray-800"><span className="material-symbols-outlined text-lg">remove</span></button>
                    <span className="px-2 text-xs font-mono font-medium text-gray-700 dark:text-gray-300 w-12 text-center">{Math.round(zoom)}%</span>
                    <button onClick={handleZoomIn} className="p-1.5 text-gray-500 hover:text-gray-800"><span className="material-symbols-outlined text-lg">add</span></button>
                </div>
                </div>
            )}

            <div className="flex items-center space-x-1 sm:space-x-2 border-l border-gray-200 dark:border-gray-700 pl-2 sm:pl-3">
              <button onClick={toggleFullscreen} className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" title={isFullscreen ? "Küçült" : "Tam Ekran"}><span className="material-symbols-outlined text-xl">{isFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span></button>
              <button onClick={handlePrint} className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" title="Yazdır"><span className="material-symbols-outlined text-xl">print</span></button>
              <button onClick={handleDownload} className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" title="İndir"><span className="material-symbols-outlined text-xl">download</span></button>
              <button onClick={onClose} className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400" title="Kapat"><span className="material-symbols-outlined text-xl">close</span></button>
            </div>
          </header>
          <main 
            className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900 custom-scrollbar p-4 sm:p-8 flex items-start justify-center touch-none"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div 
                className={`relative bg-white shadow-2xl transition-transform duration-100 ease-out origin-top border border-gray-200 dark:border-gray-800 ${hasError ? 'w-full h-full' : ''}`}
                style={{ 
                    width: (!hasError && isRealPdf) ? 'auto' : (hasError ? '100%' : `${800 * (zoom / 100)}px`),
                    minHeight: (!hasError && isRealPdf) ? 'auto' : (hasError ? '100%' : `${1100 * (zoom / 100)}px`)
                }}
            >
                {isRealPdf && !hasError ? (
                    <Document
                        file={fileUrl}
                        onLoadSuccess={onDocumentLoadSuccess}
                        onLoadError={onDocumentLoadError}
                        loading={<div className="p-10 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}
                        error={<div className="p-10 text-red-500">PDF yüklenemedi. Tarayıcıda açılıyor...</div>}
                        options={pdfOptions}
                    >
                        <Page 
                            pageNumber={activePage} 
                            scale={zoom / 100}
                            renderTextLayer={true}
                            renderAnnotationLayer={true}
                            loading={<div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}
                            canvasBackground="white"
                            devicePixelRatio={Math.min(window.devicePixelRatio || 1, 2)}
                        />
                    </Document>
                ) : isRealPdf && hasError ? (
                    // Fallback Iframe for PDF Error
                    <iframe 
                        src={fileUrl}
                        className="w-full h-full border-0 min-h-[500px]"
                        title="PDF Viewer"
                    />
                ) : (
                    // Image fallback
                    <div className="relative w-full h-auto">
                      <Image 
                        src={fileUrl} 
                        alt="Document Page" 
                        width={800}
                        height={1100}
                        className="w-full h-auto block select-none" 
                        draggable={false} 
                      />
                    </div>
                )}
            </div>
          </main>
        </div>
      </div>
    </div>
    </>
  );
};

export default PDFViewer;
