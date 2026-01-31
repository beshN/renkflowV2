'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';

interface DocumentViewerProps {
  isOpen: boolean;
  onClose: () => void;
  documentUrl: string;
  documentName: string;
}

export function DocumentViewer({ isOpen, onClose, documentUrl, documentName }: DocumentViewerProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<any>(null);

  const isPDF = documentName.toLowerCase().endsWith('.pdf');

  const loadPDF = useCallback(async () => {
    try {
      // @ts-ignore - PDF.js loaded from CDN
      const pdfjsLib = (window as any).pdfjsLib;
      
      if (!pdfjsLib) {
        setError('PDF.js henüz yüklenmedi, lütfen bekleyin...');
        setIsLoading(false);
        return;
      }

      // Set worker - updated to match package.json version
      pdfjsLib.GlobalWorkerOptions.workerSrc = 
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.worker.min.js';

      // Load PDF with proper error handling
      const loadingTask = pdfjsLib.getDocument({
        url: documentUrl,
        withCredentials: false,
        isEvalSupported: false,
        cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/cmaps/',
        cMapPacked: true,
      });

      const pdf = await loadingTask.promise;
      pdfDocRef.current = pdf;
      setTotalPages(pdf.numPages);
      setCurrentPage(1);
      setIsLoading(false);
    } catch (err: any) {
      console.error('PDF load error:', err);
      let errorMessage = 'PDF yüklenemedi';
      
      if (err.message?.includes('Invalid PDF')) {
        errorMessage = 'Geçersiz PDF dosyası';
      } else if (err.message?.includes('fetch')) {
        errorMessage = 'PDF dosyasına erişilemiyor. Lütfen bağlantınızı kontrol edin.';
      }
      
      setError(errorMessage);
      setIsLoading(false);
    }
  }, [documentUrl]);

  useEffect(() => {
    if (!isOpen || !isPDF || !documentUrl) return;

    setIsLoading(true);
    setError(null);

    // Check if PDF.js is already loaded
    if ((window as any).pdfjsLib) {
      loadPDF();
      return;
    }

    // Load PDF.js from CDN - updated to match package.json version
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.min.js';
    script.async = true;
    script.id = 'pdfjs-script';
    
    script.onload = () => {
      loadPDF();
    };

    script.onerror = () => {
      setError('PDF.js kütüphanesi yüklenemedi');
      setIsLoading(false);
    };

    // Check if script already exists
    const existingScript = document.getElementById('pdfjs-script');
    if (!existingScript) {
      document.head.appendChild(script);
    } else {
      loadPDF();
    }

    return () => {
      if (pdfDocRef.current) {
        try {
          pdfDocRef.current.destroy();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };
  }, [isOpen, documentUrl, isPDF, loadPDF]);

  const renderPage = async (pageNum: number, pdf?: any) => {
    const pdfDoc = pdf || pdfDocRef.current;
    if (!pdfDoc || !canvasRef.current) return;

    try {
      const page = await pdfDoc.getPage(pageNum);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) return;

      const viewport = page.getViewport({ scale });
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;
    } catch (err) {
      console.error('Page render error:', err);
    }
  };

  useEffect(() => {
    if (pdfDocRef.current && !isLoading) {
      renderPage(currentPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, scale, isLoading]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));
  const handleZoomReset = () => setScale(1.0);

  if (!isOpen) return null;

  // For images, show simple modal
  if (!isPDF) {
    const isImage = documentName.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    if (!isImage) return null;

    return createPortal(
      <div 
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90"
        onClick={onClose}
      >
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 bg-black/50 backdrop-blur-sm border-b border-white/10">
          <h3 className="text-white font-medium truncate max-w-md">{documentName}</h3>
          <button onClick={onClose} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg">
            <span className="material-symbols-outlined text-[24px]">close</span>
          </button>
        </div>
        <div className="relative max-w-[90vw] max-h-[90vh]">
          <Image 
            src={documentUrl} 
            alt={documentName} 
            width={1200}
            height={800}
            className="object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>,
      document.body
    );
  }

  // PDF Viewer
  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-background-light dark:bg-background-dark">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-card-light dark:bg-card-dark border-b border-border-light dark:border-border-dark">
        <h3 className="text-text-light dark:text-text-dark font-medium truncate max-w-md">
          {documentName}
        </h3>
        
        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <div className="flex items-center bg-background-light dark:bg-background-dark rounded-lg p-1 mr-4 border border-border-light dark:border-border-dark">
            <button 
              onClick={handleZoomOut} 
              className="p-2 text-text-light dark:text-text-dark hover:bg-card-light dark:hover:bg-card-dark rounded-md"
              title="Uzaklaştır"
            >
              <span className="material-symbols-outlined text-[20px]">remove</span>
            </button>
            <span className="px-3 text-text-light dark:text-text-dark text-sm font-mono min-w-[60px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button 
              onClick={handleZoomIn} 
              className="p-2 text-text-light dark:text-text-dark hover:bg-card-light dark:hover:bg-card-dark rounded-md"
              title="Yakınlaştır"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
            </button>
            <div className="w-px h-6 bg-border-light dark:bg-border-dark mx-2"></div>
            <button 
              onClick={handleZoomReset} 
              className="p-2 text-text-light dark:text-text-dark hover:bg-card-light dark:hover:bg-card-dark rounded-md"
              title="Sıfırla"
            >
              <span className="material-symbols-outlined text-[20px]">restart_alt</span>
            </button>
          </div>

          {/* Download */}
          <a 
            href={documentUrl} 
            download={documentName}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium"
          >
            <span className="material-symbols-outlined text-[20px]">download</span>
            İndir
          </a>

          {/* Close */}
          <button 
            onClick={onClose}
            className="p-2 text-text-light dark:text-text-dark hover:bg-card-light dark:hover:bg-card-dark rounded-lg"
          >
            <span className="material-symbols-outlined text-[24px]">close</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto flex flex-col items-center p-8 bg-subtle-light dark:bg-subtle-dark">
        {isLoading && (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-4">
              <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
              <p className="text-text-light dark:text-text-dark">PDF yükleniyor...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-4 text-red-500">
              <span className="material-symbols-outlined text-4xl">error</span>
              <p>{error}</p>
              <button 
                onClick={() => loadPDF()}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
              >
                Tekrar Dene
              </button>
            </div>
          </div>
        )}

        {!isLoading && !error && (
          <canvas 
            ref={canvasRef}
            className="shadow-2xl bg-white"
          />
        )}
      </div>

      {/* Footer - Page Navigation */}
      {!isLoading && !error && totalPages > 0 && (
        <div className="flex items-center justify-center gap-4 p-4 bg-card-light dark:bg-card-dark border-t border-border-light dark:border-border-dark">
          <button
            onClick={handlePrevPage}
            disabled={currentPage === 1}
            className="p-2 text-text-light dark:text-text-dark hover:bg-background-light dark:hover:bg-background-dark rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          
          <span className="text-text-light dark:text-text-dark text-sm">
            Sayfa {currentPage} / {totalPages}
          </span>
          
          <button
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            className="p-2 text-text-light dark:text-text-dark hover:bg-background-light dark:hover:bg-background-dark rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}
