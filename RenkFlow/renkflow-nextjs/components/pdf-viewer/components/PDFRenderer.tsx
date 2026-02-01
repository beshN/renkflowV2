'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { useVirtualizer } from '@tanstack/react-virtual';
import { usePDFStore } from '@/stores/usePDFStore';
import { cn } from '@/lib/utils';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

interface PDFRendererProps {
  className?: string;
  onDocumentLoadSuccess?: (numPages: number) => void;
  onDocumentLoadError?: (error: Error) => void;
  onPageChange?: (page: number) => void;
}

export const PDFRenderer: React.FC<PDFRendererProps> = ({
  className,
  onDocumentLoadSuccess,
  onDocumentLoadError,
  onPageChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  
  // Store selectors
  const fileUrl = usePDFStore((state) => state.fileUrl);
  const numPages = usePDFStore((state) => state.numPages);
  const pageNumber = usePDFStore((state) => state.pageNumber);
  const scale = usePDFStore((state) => state.scale);
  const rotation = usePDFStore((state) => state.rotation);
  const viewMode = usePDFStore((state) => state.viewMode);
  const enableTextLayer = usePDFStore((state) => state.enableTextLayer);
  const enableAnnotationLayer = usePDFStore((state) => state.enableAnnotationLayer);
  const renderQuality = usePDFStore((state) => state.renderQuality);
  
  // Store actions
  const setNumPages = usePDFStore((state) => state.setNumPages);
  const setMetadata = usePDFStore((state) => state.setMetadata);
  const setLoading = usePDFStore((state) => state.setLoading);
  const setLoadProgress = usePDFStore((state) => state.setLoadProgress);
  const setLoadingStage = usePDFStore((state) => state.setLoadingStage);
  const setError = usePDFStore((state) => state.setError);
  const setPageNumber = usePDFStore((state) => state.setPageNumber);
  
  // Measure container width for responsive scaling
  useEffect(() => {
    if (!containerRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);
  
  // Calculate effective scale based on container width
  const effectiveScale = useCallback(() => {
    if (!containerWidth) return scale;
    const baseWidth = 612; // Standard PDF page width in points
    const maxWidth = containerWidth - 32; // Account for padding
    return Math.min(scale, maxWidth / baseWidth);
  }, [containerWidth, scale]);
  
  // Virtualization for continuous mode
  const rowVirtualizer = useVirtualizer({
    count: numPages,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 842 * effectiveScale() + 32, // A4 height + gap
    overscan: 2,
    enabled: viewMode === 'continuous',
  });
  
  // Track visible page for page number updates
  useEffect(() => {
    if (viewMode !== 'continuous' || !containerRef.current) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const page = parseInt(entry.target.getAttribute('data-page') || '1', 10);
            if (page !== pageNumber) {
              setPageNumber(page);
              onPageChange?.(page);
            }
          }
        });
      },
      {
        root: containerRef.current,
        threshold: 0.5,
      }
    );
    
    const pages = containerRef.current.querySelectorAll('[data-page]');
    pages.forEach((page) => observer.observe(page));
    
    return () => observer.disconnect();
  }, [viewMode, pageNumber, setPageNumber, onPageChange]);
  
  // Document load handlers
  const handleDocumentLoadSuccess = useCallback(
    async (pdf: any) => {
      setNumPages(pdf.numPages);
      setLoading(false);
      setLoadingStage('complete');
      
      // Extract metadata
      try {
        const metadata = await pdf.getMetadata();
        if (metadata?.info) {
          setMetadata({
            title: metadata.info.Title,
            author: metadata.info.Author,
            subject: metadata.info.Subject,
            keywords: metadata.info.Keywords,
            creator: metadata.info.Creator,
            producer: metadata.info.Producer,
            creationDate: metadata.info.CreationDate ? new Date(metadata.info.CreationDate) : undefined,
            modificationDate: metadata.info.ModDate ? new Date(metadata.info.ModDate) : undefined,
          });
        }
      } catch (err) {
        console.warn('Failed to extract PDF metadata:', err);
      }
      
      onDocumentLoadSuccess?.(pdf.numPages);
    },
    [setNumPages, setLoading, setLoadingStage, setMetadata, onDocumentLoadSuccess]
  );
  
  const handleDocumentLoadError = useCallback(
    (error: Error) => {
      console.error('PDF load error:', error);
      
      let errorType: 'network' | 'corrupt' | 'password' | 'not-found' | 'unknown' = 'unknown';
      let errorMessage = 'PDF yüklenemedi';
      
      if (error.message.includes('404') || error.message.includes('Not Found')) {
        errorType = 'not-found';
        errorMessage = 'PDF dosyası bulunamadı';
      } else if (error.message.includes('password') || error.message.includes('encrypted')) {
        errorType = 'password';
        errorMessage = 'PDF şifre korumalı';
      } else if (error.message.includes('Invalid PDF')) {
        errorType = 'corrupt';
        errorMessage = 'PDF dosyası bozuk veya geçersiz';
      } else if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
        errorType = 'network';
        errorMessage = 'Ağ hatası: PDF indirilemedi';
      }
      
      setError(errorMessage, errorType);
      setLoading(false);
      onDocumentLoadError?.(error);
    },
    [setError, setLoading, onDocumentLoadError]
  );
  
  const handleLoadProgress = useCallback(
    ({ loaded, total }: { loaded: number; total: number }) => {
      const progress = Math.round((loaded / total) * 100);
      setLoadProgress(progress);
      
      if (progress < 30) {
        setLoadingStage('downloading');
      } else if (progress < 70) {
        setLoadingStage('parsing');
      } else {
        setLoadingStage('rendering');
      }
    },
    [setLoadProgress, setLoadingStage]
  );
  
  // Render single page mode
  const renderSinglePage = () => (
    <div className="flex items-center justify-center min-h-full p-4">
      <div
        data-page={pageNumber}
        className="shadow-2xl rounded-lg overflow-hidden bg-white"
      >
        <Page
          pageNumber={pageNumber}
          scale={effectiveScale()}
          rotate={rotation}
          renderTextLayer={enableTextLayer}
          renderAnnotationLayer={enableAnnotationLayer}
          devicePixelRatio={renderQuality}
          loading={
            <div className="flex items-center justify-center w-full h-[842px] bg-slate-100">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent" />
            </div>
          }
        />
      </div>
    </div>
  );
  
  // Render continuous scroll mode with virtualization
  const renderContinuousMode = () => {
    const virtualItems = rowVirtualizer.getVirtualItems();
    
    return (
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualRow) => {
          const pageNum = virtualRow.index + 1;
          return (
            <div
              key={virtualRow.key}
              data-page={pageNum}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className="flex items-center justify-center p-4"
            >
              <div className="shadow-2xl rounded-lg overflow-hidden bg-white">
                <Page
                  pageNumber={pageNum}
                  scale={effectiveScale()}
                  rotate={rotation}
                  renderTextLayer={enableTextLayer}
                  renderAnnotationLayer={enableAnnotationLayer}
                  devicePixelRatio={renderQuality}
                  loading={
                    <div className="flex items-center justify-center w-full h-[842px] bg-slate-100">
                      <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent" />
                    </div>
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  };
  
  // Render two-page spread mode
  const renderTwoPageMode = () => {
    const leftPage = pageNumber % 2 === 0 ? pageNumber - 1 : pageNumber;
    const rightPage = leftPage + 1;
    
    return (
      <div className="flex items-center justify-center min-h-full p-4 gap-4">
        <div
          data-page={leftPage}
          className="shadow-2xl rounded-lg overflow-hidden bg-white"
        >
          <Page
            pageNumber={leftPage}
            scale={effectiveScale() * 0.7}
            rotate={rotation}
            renderTextLayer={enableTextLayer}
            renderAnnotationLayer={enableAnnotationLayer}
            devicePixelRatio={renderQuality}
            loading={
              <div className="flex items-center justify-center w-full h-[842px] bg-slate-100">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent" />
              </div>
            }
          />
        </div>
        
        {rightPage <= numPages && (
          <div
            data-page={rightPage}
            className="shadow-2xl rounded-lg overflow-hidden bg-white"
          >
            <Page
              pageNumber={rightPage}
              scale={effectiveScale() * 0.7}
              rotate={rotation}
              renderTextLayer={enableTextLayer}
              renderAnnotationLayer={enableAnnotationLayer}
              devicePixelRatio={renderQuality}
              loading={
                <div className="flex items-center justify-center w-full h-[842px] bg-slate-100">
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent" />
                </div>
              }
            />
          </div>
        )}
      </div>
    );
  };
  
  if (!fileUrl) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <p>PDF dosyası seçilmedi</p>
      </div>
    );
  }
  
  return (
    <div
      ref={containerRef}
      className={cn(
        'flex-1 overflow-auto bg-slate-100 dark:bg-slate-900',
        className
      )}
    >
      <Document
        file={fileUrl}
        onLoadSuccess={handleDocumentLoadSuccess}
        onLoadError={handleDocumentLoadError}
        onLoadProgress={handleLoadProgress}
        loading={
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400">PDF yükleniyor...</p>
            </div>
          </div>
        }
        error={
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-red-500">
              <p className="font-semibold mb-2">PDF yüklenemedi</p>
              <p className="text-sm text-slate-500">Lütfen tekrar deneyin</p>
            </div>
          </div>
        }
      >
        {viewMode === 'single' && renderSinglePage()}
        {viewMode === 'continuous' && renderContinuousMode()}
        {viewMode === 'two-page' && renderTwoPageMode()}
      </Document>
    </div>
  );
};

export default PDFRenderer;
