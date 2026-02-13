'use client';

import React, { 
  useState, 
  useCallback, 
  useEffect, 
  useRef, 
  useMemo,
  memo,
  useReducer,
} from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  X,
  ZoomIn,
  ZoomOut,
  Download,
  Printer,
  Search,
  ChevronUp,
  ChevronDown,
  Menu,
  ChevronLeft,
  RotateCw,
  Maximize,
  Minimize,
  ChevronsLeft,
  ChevronsRight,
  Bookmark,
  BookmarkCheck,
  Check,
  Share2,
  Loader2,
  RotateCcw,
  Columns,
  FileText,
  Settings,
  ExternalLink,
  Minus,
  Plus,
  AlertCircle,
  RefreshCw,
  Highlighter,
  Underline,
  Strikethrough,
  StickyNote,
  Type,
  Square,
  Circle,
  ArrowRight,
  Pencil,
  Eraser,
  PenTool,
  MousePointer,
  Hand,
  Ruler,
  Copy,
  Scissors,
  Palette,
  Save,
  Undo,
  Redo,
  Eye,
  EyeOff,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
// @ts-ignore - CSS imports are handled by bundler
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
// @ts-ignore - CSS imports are handled by bundler
import 'react-pdf/dist/esm/Page/TextLayer.css';

// ============================================================================
// PDF.js Worker Configuration
// ============================================================================

// Use dynamic import for better performance
const PDFJS_VERSION = '4.9.155';

if (typeof window !== 'undefined') {
  // Use CDN worker with fallback
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;
}

// ============================================================================
// Types & Interfaces
// ============================================================================

interface PDFViewerProps {
  fileUrl: string;
  fileName: string;
  onClose: () => void;
}

interface BookmarkItem {
  page: number;
  title: string;
  timestamp: number;
}

type AnnotationType = 'highlight' | 'underline' | 'strikethrough' | 'note' | 'text' | 'rectangle' | 'circle' | 'arrow' | 'freehand' | 'signature';
type ToolMode = 'select' | 'hand' | 'text' | AnnotationType;

interface Annotation {
  id: string;
  type: AnnotationType;
  page: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  color: string;
  opacity: number;
  points?: { x: number; y: number }[];
  timestamp: number;
  author?: string;
}

interface FormField {
  id: string;
  page: number;
  type: 'text' | 'checkbox' | 'radio' | 'signature';
  x: number;
  y: number;
  width: number;
  height: number;
  value: string;
  label?: string;
}

type ViewMode = 'single' | 'continuous' | 'two-page';
type SidebarTab = 'thumbnails' | 'bookmarks' | 'annotations' | 'layers';
type LoadingStage = 'downloading' | 'parsing' | 'rendering' | 'complete';
type ErrorType = 'network' | 'corrupt' | 'password' | 'not-found' | 'unknown';

interface ViewerState {
  numPages: number;
  pageNumber: number;
  scale: number;
  rotation: number;
  loading: boolean;
  loadProgress: number;
  loadingStage: LoadingStage;
  error: string | null;
  errorType: ErrorType;
  retryCount: number;
  showSearch: boolean;
  showThumbnails: boolean;
  showBookmarks: boolean;
  showSettings: boolean;
  showSidebar: boolean;
  sidebarTab: SidebarTab;
  isFullscreen: boolean;
  viewMode: ViewMode;
  searchText: string;
  searchResults: { page: number; matches: number }[];
  currentSearchIndex: number;
  isSearching: boolean;
  isDownloading: boolean;
  isPrinting: boolean;
  downloadProgress: number;
  copied: boolean;
  pageInputValue: string;
  isMobile: boolean;
  toolMode: ToolMode;
  selectedAnnotation: string | null;
  annotationColor: string;
  annotationOpacity: number;
  showAnnotationTools: boolean;
  showFormTools: boolean;
  isDrawing: boolean;
  canUndo: boolean;
  canRedo: boolean;
  showLayers: boolean;
  textSelectionMode: boolean;
}

type ViewerAction =
  | { type: 'SET_NUM_PAGES'; payload: number }
  | { type: 'SET_PAGE_NUMBER'; payload: number }
  | { type: 'SET_SCALE'; payload: number }
  | { type: 'SET_ROTATION'; payload: number }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_LOAD_PROGRESS'; payload: number }
  | { type: 'SET_LOADING_STAGE'; payload: LoadingStage }
  | { type: 'SET_ERROR'; payload: { message: string; type: ErrorType } | null }
  | { type: 'INCREMENT_RETRY' }
  | { type: 'RESET_RETRY' }
  | { type: 'TOGGLE_SEARCH' }
  | { type: 'SET_SHOW_SEARCH'; payload: boolean }
  | { type: 'TOGGLE_THUMBNAILS' }
  | { type: 'SET_SHOW_THUMBNAILS'; payload: boolean }
  | { type: 'TOGGLE_BOOKMARKS' }
  | { type: 'SET_SHOW_BOOKMARKS'; payload: boolean }
  | { type: 'TOGGLE_SETTINGS' }
  | { type: 'SET_SHOW_SETTINGS'; payload: boolean }
  | { type: 'SET_SHOW_SIDEBAR'; payload: boolean }
  | { type: 'SET_SIDEBAR_TAB'; payload: SidebarTab }
  | { type: 'SET_FULLSCREEN'; payload: boolean }
  | { type: 'SET_VIEW_MODE'; payload: ViewMode }
  | { type: 'SET_SEARCH_TEXT'; payload: string }
  | { type: 'SET_SEARCH_RESULTS'; payload: { page: number; matches: number }[] }
  | { type: 'SET_CURRENT_SEARCH_INDEX'; payload: number }
  | { type: 'SET_IS_SEARCHING'; payload: boolean }
  | { type: 'SET_IS_DOWNLOADING'; payload: boolean }
  | { type: 'SET_IS_PRINTING'; payload: boolean }
  | { type: 'SET_DOWNLOAD_PROGRESS'; payload: number }
  | { type: 'SET_COPIED'; payload: boolean }
  | { type: 'SET_PAGE_INPUT_VALUE'; payload: string }
  | { type: 'SET_IS_MOBILE'; payload: boolean }
  | { type: 'SET_TOOL_MODE'; payload: ToolMode }
  | { type: 'SET_SELECTED_ANNOTATION'; payload: string | null }
  | { type: 'SET_ANNOTATION_COLOR'; payload: string }
  | { type: 'SET_ANNOTATION_OPACITY'; payload: number }
  | { type: 'TOGGLE_ANNOTATION_TOOLS' }
  | { type: 'TOGGLE_FORM_TOOLS' }
  | { type: 'SET_IS_DRAWING'; payload: boolean }
  | { type: 'SET_CAN_UNDO'; payload: boolean }
  | { type: 'SET_CAN_REDO'; payload: boolean }
  | { type: 'TOGGLE_LAYERS' }
  | { type: 'SET_TEXT_SELECTION_MODE'; payload: boolean }
  | { type: 'RESET_STATE' };

// ============================================================================
// Reducer
// ============================================================================

const initialState: ViewerState = {
  numPages: 0,
  pageNumber: 1,
  scale: 1.0,
  rotation: 0,
  loading: true,
  loadProgress: 0,
  loadingStage: 'downloading',
  error: null,
  errorType: 'unknown',
  retryCount: 0,
  showSearch: false,
  showThumbnails: true,
  showBookmarks: false,
  showSettings: false,
  showSidebar: true,
  sidebarTab: 'thumbnails',
  isFullscreen: false,
  viewMode: 'continuous',
  searchText: '',
  searchResults: [],
  currentSearchIndex: 0,
  isSearching: false,
  isDownloading: false,
  isPrinting: false,
  downloadProgress: 0,
  copied: false,
  pageInputValue: '1',
  isMobile: false,
  toolMode: 'select',
  selectedAnnotation: null,
  annotationColor: '#FFEB3B',
  annotationOpacity: 0.5,
  showAnnotationTools: false,
  showFormTools: false,
  isDrawing: false,
  canUndo: false,
  canRedo: false,
  showLayers: false,
  textSelectionMode: true,
};

function viewerReducer(state: ViewerState, action: ViewerAction): ViewerState {
  switch (action.type) {
    case 'SET_NUM_PAGES':
      return { ...state, numPages: action.payload };
    case 'SET_PAGE_NUMBER':
      return { ...state, pageNumber: action.payload, pageInputValue: String(action.payload) };
    case 'SET_SCALE':
      return { ...state, scale: action.payload };
    case 'SET_ROTATION':
      return { ...state, rotation: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_LOAD_PROGRESS':
      return { ...state, loadProgress: action.payload };
    case 'SET_LOADING_STAGE':
      return { ...state, loadingStage: action.payload };
    case 'SET_ERROR':
      return action.payload 
        ? { ...state, error: action.payload.message, errorType: action.payload.type }
        : { ...state, error: null, errorType: 'unknown' };
    case 'INCREMENT_RETRY':
      return { ...state, retryCount: state.retryCount + 1 };
    case 'RESET_RETRY':
      return { ...state, retryCount: 0 };
    case 'TOGGLE_SEARCH':
      return { ...state, showSearch: !state.showSearch };
    case 'SET_SHOW_SEARCH':
      return { ...state, showSearch: action.payload };
    case 'TOGGLE_THUMBNAILS':
      return { ...state, showThumbnails: !state.showThumbnails };
    case 'SET_SHOW_THUMBNAILS':
      return { ...state, showThumbnails: action.payload };
    case 'TOGGLE_BOOKMARKS':
      return { ...state, showBookmarks: !state.showBookmarks };
    case 'SET_SHOW_BOOKMARKS':
      return { ...state, showBookmarks: action.payload };
    case 'TOGGLE_SETTINGS':
      return { ...state, showSettings: !state.showSettings };
    case 'SET_SHOW_SETTINGS':
      return { ...state, showSettings: action.payload };
    case 'SET_FULLSCREEN':
      return { ...state, isFullscreen: action.payload };
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload };
    case 'SET_SEARCH_TEXT':
      return { ...state, searchText: action.payload };
    case 'SET_SEARCH_RESULTS':
      return { ...state, searchResults: action.payload };
    case 'SET_CURRENT_SEARCH_INDEX':
      return { ...state, currentSearchIndex: action.payload };
    case 'SET_IS_SEARCHING':
      return { ...state, isSearching: action.payload };
    case 'SET_IS_DOWNLOADING':
      return { ...state, isDownloading: action.payload };
    case 'SET_IS_PRINTING':
      return { ...state, isPrinting: action.payload };
    case 'SET_DOWNLOAD_PROGRESS':
      return { ...state, downloadProgress: action.payload };
    case 'SET_COPIED':
      return { ...state, copied: action.payload };
    case 'SET_PAGE_INPUT_VALUE':
      return { ...state, pageInputValue: action.payload };
    case 'SET_IS_MOBILE':
      return { ...state, isMobile: action.payload, showThumbnails: action.payload ? false : state.showThumbnails };
    case 'SET_SHOW_SIDEBAR':
      return { ...state, showSidebar: action.payload };
    case 'SET_SIDEBAR_TAB':
      return { ...state, sidebarTab: action.payload, showSidebar: true };
    case 'SET_TOOL_MODE':
      return { ...state, toolMode: action.payload };
    case 'SET_SELECTED_ANNOTATION':
      return { ...state, selectedAnnotation: action.payload };
    case 'SET_ANNOTATION_COLOR':
      return { ...state, annotationColor: action.payload };
    case 'SET_ANNOTATION_OPACITY':
      return { ...state, annotationOpacity: action.payload };
    case 'TOGGLE_ANNOTATION_TOOLS':
      return { ...state, showAnnotationTools: !state.showAnnotationTools, showFormTools: false };
    case 'TOGGLE_FORM_TOOLS':
      return { ...state, showFormTools: !state.showFormTools, showAnnotationTools: false };
    case 'SET_IS_DRAWING':
      return { ...state, isDrawing: action.payload };
    case 'SET_CAN_UNDO':
      return { ...state, canUndo: action.payload };
    case 'SET_CAN_REDO':
      return { ...state, canRedo: action.payload };
    case 'TOGGLE_LAYERS':
      return { ...state, showLayers: !state.showLayers };
    case 'SET_TEXT_SELECTION_MODE':
      return { ...state, textSelectionMode: action.payload };
    case 'RESET_STATE':
      return { ...initialState, isMobile: state.isMobile };
    default:
      return state;
  }
}

// ============================================================================
// Custom Hooks
// ============================================================================

function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        setStoredValue(JSON.parse(item));
      }
    } catch {
      // Ignore errors
    }
    setIsHydrated(true);
  }, [key]);

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setStoredValue((prev) => {
      const newValue = value instanceof Function ? value(prev) : value;
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(key, JSON.stringify(newValue));
        } catch {
          // Quota exceeded or other error
        }
      }
      return newValue;
    });
  }, [key]);

  return [isHydrated ? storedValue : initialValue, setValue];
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

function useThrottle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastArgsRef = useRef<Parameters<T> | null>(null);
  const lastRunRef = useRef<number>(0);

  return useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = limit - (now - lastRunRef.current);

    lastArgsRef.current = args;

    if (remaining <= 0) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      lastRunRef.current = now;
      func(...args);
    } else if (!timeoutRef.current) {
      timeoutRef.current = setTimeout(() => {
        lastRunRef.current = Date.now();
        timeoutRef.current = null;
        if (lastArgsRef.current) {
          func(...lastArgsRef.current);
        }
      }, remaining);
    }
  }, [func, limit]);
}

// ============================================================================
// Memoized Components
// ============================================================================

const ThumbnailPage = memo(function ThumbnailPage({
  fileUrl,
  page,
  rotation,
  isActive,
  isBookmarked,
  searchMatchCount,
  onClick,
}: {
  fileUrl: string;
  page: number;
  rotation: number;
  isActive: boolean;
  isBookmarked: boolean;
  searchMatchCount: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full group relative rounded-md overflow-hidden border-2 transition-all',
        isActive
          ? 'border-blue-500 shadow-md'
          : 'border-transparent hover:border-slate-300 dark:hover:border-slate-600'
      )}
    >
      <div className="bg-white p-1 relative">
        <Document file={fileUrl} className="flex justify-center" loading={null}>
          <Page
            pageNumber={page}
            width={120}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            rotate={rotation}
            loading={
              <div className="w-[120px] h-[160px] bg-slate-100 animate-pulse rounded" />
            }
          />
        </Document>
        {isBookmarked && (
          <div className="absolute top-1 right-1">
            <BookmarkCheck className="h-4 w-4 text-blue-500" />
          </div>
        )}
        {searchMatchCount > 0 && (
          <div className="absolute top-1 left-1 bg-yellow-400 text-yellow-900 text-[10px] px-1 rounded">
            {searchMatchCount}
          </div>
        )}
      </div>
      <span
        className={cn(
          'text-[10px] sm:text-xs font-medium mt-1 sm:mt-2 block text-center',
          isActive ? 'text-blue-500' : 'text-slate-500'
        )}
      >
        Sayfa {page}
      </span>
    </button>
  );
});

const PDFPage = memo(function PDFPage({
  page,
  scale,
  rotation,
  width,
  isHighlighted,
  isActive,
  onRef,
}: {
  page: number;
  scale: number;
  rotation: number;
  width?: number;
  isHighlighted: boolean;
  isActive: boolean;
  onRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={onRef}
      data-page={page}
      className={cn(
        'bg-white rounded-lg shadow-lg overflow-hidden transition-all',
        isHighlighted && 'ring-2 ring-yellow-400',
        isActive && 'ring-2 ring-blue-400'
      )}
    >
      <Page
        pageNumber={page}
        scale={scale}
        width={width}
        rotate={rotation}
        renderTextLayer={true}
        renderAnnotationLayer={true}
        className="select-text"
        loading={
          <div className="flex items-center justify-center h-[500px] w-[400px] bg-slate-50">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        }
        error={
          <div className="flex items-center justify-center h-[300px] w-[400px] bg-slate-50 text-slate-400 text-sm">
            Sayfa yüklenemedi
          </div>
        }
      />
    </div>
  );
});

// ============================================================================
// Main Component
// ============================================================================

export default function PDFViewer({
  fileUrl,
  fileName,
  onClose,
}: PDFViewerProps) {
  const [state, dispatch] = useReducer(viewerReducer, initialState);
  const [bookmarks, setBookmarks] = useLocalStorage<BookmarkItem[]>(`pdf-bookmarks-${fileName}`, []);
  const [annotations, setAnnotations] = useLocalStorage<Annotation[]>(`pdf-annotations-${fileName}`, []);
  const [formFields, setFormFields] = useLocalStorage<FormField[]>(`pdf-forms-${fileName}`, []);
  const [annotationHistory, setAnnotationHistory] = useState<Annotation[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const pdfDocRef = useRef<pdfjs.PDFDocumentProxy | null>(null);
  const printIframeRef = useRef<HTMLIFrameElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Touch gesture state
  const gestureRef = useRef({
    startDistance: 0,
    startScale: 1,
    lastTap: 0,
    isPinching: false,
  });

  // Scale ref for touch gestures
  const scaleRef = useRef(state.scale);
  scaleRef.current = state.scale;

  // ============================================================================
  // Cleanup
  // ============================================================================

  useEffect(() => {
    return () => {
      // Cancel any pending requests
      abortControllerRef.current?.abort();
      
      // Cleanup print iframe
      if (printIframeRef.current) {
        try {
          document.body.removeChild(printIframeRef.current);
        } catch {
          // Ignore
        }
      }
      
      // Cleanup object URLs
      pageRefs.current.clear();
    };
  }, []);

  // ============================================================================
  // Mobile Detection
  // ============================================================================

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768 || 'ontouchstart' in window;
      dispatch({ type: 'SET_IS_MOBILE', payload: mobile });
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // ============================================================================
  // Document Handlers
  // ============================================================================

  const onDocumentLoadSuccess = useCallback((pdf: pdfjs.PDFDocumentProxy) => {
    pdfDocRef.current = pdf;
    dispatch({ type: 'SET_NUM_PAGES', payload: pdf.numPages });
    dispatch({ type: 'SET_LOADING', payload: false });
    dispatch({ type: 'SET_LOAD_PROGRESS', payload: 100 });
    dispatch({ type: 'SET_LOADING_STAGE', payload: 'complete' });
    dispatch({ type: 'SET_ERROR', payload: null });
    dispatch({ type: 'RESET_RETRY' });
  }, []);

  const onDocumentLoadError = useCallback((err: Error) => {
    console.error('PDF load error:', err);
    
    let errorType: ErrorType = 'unknown';
    let errorMessage = 'PDF yüklenemedi';
    
    const errorStr = err.message.toLowerCase();
    
    if (errorStr.includes('network') || errorStr.includes('fetch') || errorStr.includes('failed to fetch')) {
      errorType = 'network';
      errorMessage = 'Ağ bağlantısı hatası. İnternet bağlantınızı kontrol edin.';
    } else if (errorStr.includes('password') || errorStr.includes('encrypted')) {
      errorType = 'password';
      errorMessage = 'Bu PDF şifre korumalı.';
    } else if (errorStr.includes('corrupt') || errorStr.includes('invalid') || errorStr.includes('damaged')) {
      errorType = 'corrupt';
      errorMessage = 'PDF dosyası bozuk görünüyor.';
    } else if (errorStr.includes('404') || errorStr.includes('not found')) {
      errorType = 'not-found';
      errorMessage = 'PDF dosyası bulunamadı.';
    } else {
      errorMessage = `Yükleme Hatası: ${err.message}`;
    }
    
    dispatch({ type: 'SET_LOADING', payload: false });
    dispatch({ type: 'SET_ERROR', payload: { message: errorMessage, type: errorType } });
  }, []);

  const onLoadProgress = useCallback(({ loaded, total }: { loaded: number; total: number }) => {
    if (total > 0) {
      const progress = Math.round((loaded / total) * 100);
      dispatch({ type: 'SET_LOAD_PROGRESS', payload: progress });
      
      // Update loading stage based on progress
      if (progress < 30) {
        dispatch({ type: 'SET_LOADING_STAGE', payload: 'downloading' });
      } else if (progress < 70) {
        dispatch({ type: 'SET_LOADING_STAGE', payload: 'parsing' });
      } else {
        dispatch({ type: 'SET_LOADING_STAGE', payload: 'rendering' });
      }
    }
  }, []);

  const handleRetry = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: null });
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_LOAD_PROGRESS', payload: 0 });
    dispatch({ type: 'SET_LOADING_STAGE', payload: 'downloading' });
    dispatch({ type: 'INCREMENT_RETRY' });
  }, []);

  // ============================================================================
  // Zoom Handlers
  // ============================================================================

  const handleZoomTo = useCallback((value: number) => {
    const clampedValue = Math.max(0.25, Math.min(4.0, value));
    dispatch({ type: 'SET_SCALE', payload: clampedValue });
  }, []);

  const handleZoomIn = useCallback(() => {
    handleZoomTo(scaleRef.current + 0.25);
  }, [handleZoomTo]);

  const handleZoomOut = useCallback(() => {
    handleZoomTo(scaleRef.current - 0.25);
  }, [handleZoomTo]);

  const handleZoomReset = useCallback(() => {
    handleZoomTo(1.0);
  }, [handleZoomTo]);

  const handleFitWidth = useCallback(() => {
    if (mainContentRef.current) {
      const containerWidth = mainContentRef.current.clientWidth - 64;
      const pageWidth = 612;
      const newScale = containerWidth / pageWidth;
      handleZoomTo(newScale);
    }
  }, [handleZoomTo]);

  const handleFitPage = useCallback(() => {
    if (mainContentRef.current) {
      const containerWidth = mainContentRef.current.clientWidth - 64;
      const containerHeight = mainContentRef.current.clientHeight - 64;
      const pageWidth = 612;
      const pageHeight = 792;
      const scaleW = containerWidth / pageWidth;
      const scaleH = containerHeight / pageHeight;
      handleZoomTo(Math.min(scaleW, scaleH));
    }
  }, [handleZoomTo]);

  // ============================================================================
  // Rotation Handlers
  // ============================================================================

  const handleRotate = useCallback(() => {
    dispatch({ type: 'SET_ROTATION', payload: (state.rotation + 90) % 360 });
  }, [state.rotation]);

  const handleRotateBack = useCallback(() => {
    dispatch({ type: 'SET_ROTATION', payload: (state.rotation - 90 + 360) % 360 });
  }, [state.rotation]);

  // ============================================================================
  // Fullscreen Handler
  // ============================================================================

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen();
        dispatch({ type: 'SET_FULLSCREEN', payload: true });
      } else {
        await document.exitFullscreen();
        dispatch({ type: 'SET_FULLSCREEN', payload: false });
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  }, []);

  // ============================================================================
  // Print Handler
  // ============================================================================

  const handlePrint = useCallback(async () => {
    if (state.isPrinting) return;
    
    dispatch({ type: 'SET_IS_PRINTING', payload: true });
    
    try {
      if (printIframeRef.current) {
        document.body.removeChild(printIframeRef.current);
      }
      
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
      document.body.appendChild(iframe);
      printIframeRef.current = iframe;
      
      iframe.src = fileUrl;
      
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Print timeout'));
        }, 30000);
        
        iframe.onload = () => {
          clearTimeout(timeout);
          setTimeout(() => {
            try {
              iframe.contentWindow?.focus();
              iframe.contentWindow?.print();
              resolve();
            } catch {
              const printWindow = window.open(fileUrl, '_blank');
              if (printWindow) {
                printWindow.onload = () => {
                  printWindow.print();
                };
              }
              resolve();
            }
          }, 500);
        };
        
        iframe.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Failed to load PDF for printing'));
        };
      });
      
      setTimeout(() => {
        if (printIframeRef.current) {
          document.body.removeChild(printIframeRef.current);
          printIframeRef.current = null;
        }
      }, 1000);
      
    } catch (err) {
      console.error('Print error:', err);
      window.open(fileUrl, '_blank');
    } finally {
      dispatch({ type: 'SET_IS_PRINTING', payload: false });
    }
  }, [fileUrl, state.isPrinting]);

  // ============================================================================
  // Download Handler
  // ============================================================================

  const handleDownload = useCallback(async () => {
    if (state.isDownloading) return;
    
    dispatch({ type: 'SET_IS_DOWNLOADING', payload: true });
    dispatch({ type: 'SET_DOWNLOAD_PROGRESS', payload: 0 });
    
    abortControllerRef.current = new AbortController();
    
    try {
      const response = await fetch(fileUrl, {
        signal: abortControllerRef.current.signal,
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      
      if (!response.body) {
        throw new Error('No response body');
      }
      
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let loaded = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        chunks.push(value);
        loaded += value.length;
        
        if (total > 0) {
          dispatch({ type: 'SET_DOWNLOAD_PROGRESS', payload: Math.round((loaded / total) * 100) });
        }
      }
      
      const allChunks = new Uint8Array(loaded);
      let position = 0;
      for (const chunk of chunks) {
        allChunks.set(chunk, position);
        position += chunk.length;
      }
      
      const blob = new Blob([allChunks], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);
      
      dispatch({ type: 'SET_DOWNLOAD_PROGRESS', payload: 100 });
      
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Download error:', err);
        // Fallback: direct link download
        const link = document.createElement('a');
        link.href = fileUrl;
        link.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } finally {
      dispatch({ type: 'SET_IS_DOWNLOADING', payload: false });
      setTimeout(() => dispatch({ type: 'SET_DOWNLOAD_PROGRESS', payload: 0 }), 1000);
    }
  }, [fileUrl, fileName, state.isDownloading]);

  // ============================================================================
  // Navigation Handlers
  // ============================================================================

  const goToPage = useCallback((page: number) => {
    const validPage = Math.max(1, Math.min(page, state.numPages));
    dispatch({ type: 'SET_PAGE_NUMBER', payload: validPage });
    
    if (state.viewMode === 'single') return;

    requestAnimationFrame(() => {
      const pageElement = pageRefs.current.get(validPage);
      if (pageElement) {
        pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }, [state.numPages, state.viewMode]);

  const goToFirstPage = useCallback(() => goToPage(1), [goToPage]);
  const goToLastPage = useCallback(() => goToPage(state.numPages), [goToPage, state.numPages]);
  const goToPrevPage = useCallback(() => goToPage(state.pageNumber - 1), [goToPage, state.pageNumber]);
  const goToNextPage = useCallback(() => goToPage(state.pageNumber + 1), [goToPage, state.pageNumber]);

  // ============================================================================
  // Page Input Handlers
  // ============================================================================

  const handlePageInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d+$/.test(value)) {
      dispatch({ type: 'SET_PAGE_INPUT_VALUE', payload: value });
    }
  }, []);

  const handlePageInputSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const page = parseInt(state.pageInputValue, 10);
    if (!isNaN(page) && page >= 1 && page <= state.numPages) {
      goToPage(page);
    } else {
      dispatch({ type: 'SET_PAGE_INPUT_VALUE', payload: String(state.pageNumber) });
    }
  }, [state.pageInputValue, state.numPages, state.pageNumber, goToPage]);

  const handlePageInputBlur = useCallback(() => {
    const page = parseInt(state.pageInputValue, 10);
    if (isNaN(page) || page < 1 || page > state.numPages) {
      dispatch({ type: 'SET_PAGE_INPUT_VALUE', payload: String(state.pageNumber) });
    }
  }, [state.pageInputValue, state.numPages, state.pageNumber]);

  // ============================================================================
  // Search Handlers
  // ============================================================================

  const debouncedSearchText = useDebounce(state.searchText, 300);

  const performSearch = useCallback(async () => {
    if (!debouncedSearchText.trim() || !pdfDocRef.current) {
      dispatch({ type: 'SET_SEARCH_RESULTS', payload: [] });
      return;
    }

    dispatch({ type: 'SET_IS_SEARCHING', payload: true });
    const results: { page: number; matches: number }[] = [];
    const searchLower = debouncedSearchText.toLowerCase().trim();

    try {
      const doc = pdfDocRef.current;
      
      for (let i = 1; i <= state.numPages; i++) {
        try {
          const page = await doc.getPage(i);
          const textContent = await page.getTextContent();
          const text = textContent.items
            .map((item) => ('str' in item ? item.str : ''))
            .join(' ')
            .toLowerCase();
          
          const escapedSearch = searchLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(escapedSearch, 'gi');
          const matches = (text.match(regex) || []).length;
          
          if (matches > 0) {
            results.push({ page: i, matches });
          }
          
          // Cleanup page resources
          page.cleanup();
        } catch {
          continue;
        }
      }
    } catch (err) {
      console.error('Search error:', err);
    }

    dispatch({ type: 'SET_SEARCH_RESULTS', payload: results });
    dispatch({ type: 'SET_CURRENT_SEARCH_INDEX', payload: 0 });
    dispatch({ type: 'SET_IS_SEARCHING', payload: false });

    if (results.length > 0) {
      goToPage(results[0].page);
    }
  }, [debouncedSearchText, state.numPages, goToPage]);

  useEffect(() => {
    if (debouncedSearchText) {
      performSearch();
    } else {
      dispatch({ type: 'SET_SEARCH_RESULTS', payload: [] });
    }
  }, [debouncedSearchText, performSearch]);

  const goToNextSearchResult = useCallback(() => {
    if (state.searchResults.length === 0) return;
    const nextIndex = (state.currentSearchIndex + 1) % state.searchResults.length;
    dispatch({ type: 'SET_CURRENT_SEARCH_INDEX', payload: nextIndex });
    goToPage(state.searchResults[nextIndex].page);
  }, [state.searchResults, state.currentSearchIndex, goToPage]);

  const goToPrevSearchResult = useCallback(() => {
    if (state.searchResults.length === 0) return;
    const prevIndex = (state.currentSearchIndex - 1 + state.searchResults.length) % state.searchResults.length;
    dispatch({ type: 'SET_CURRENT_SEARCH_INDEX', payload: prevIndex });
    goToPage(state.searchResults[prevIndex].page);
  }, [state.searchResults, state.currentSearchIndex, goToPage]);

  // ============================================================================
  // Bookmark Handlers
  // ============================================================================

  const toggleBookmark = useCallback((page: number) => {
    setBookmarks((prev) => {
      const exists = prev.find((b) => b.page === page);
      if (exists) {
        return prev.filter((b) => b.page !== page);
      }
      return [...prev, { page, title: `Sayfa ${page}`, timestamp: Date.now() }].sort(
        (a, b) => a.page - b.page
      );
    });
  }, [setBookmarks]);

  const isPageBookmarked = useCallback(
    (page: number) => bookmarks.some((b) => b.page === page),
    [bookmarks]
  );

  // ============================================================================
  // Annotation Handlers
  // ============================================================================

  const addAnnotation = useCallback((annotation: Omit<Annotation, 'id' | 'timestamp'>) => {
    const newAnnotation: Annotation = {
      ...annotation,
      id: `ann-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    
    setAnnotations((prev) => {
      const updated = [...prev, newAnnotation];
      // Save to history for undo/redo
      setAnnotationHistory((history) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(updated);
        return newHistory;
      });
      setHistoryIndex((idx) => idx + 1);
      dispatch({ type: 'SET_CAN_UNDO', payload: true });
      dispatch({ type: 'SET_CAN_REDO', payload: false });
      return updated;
    });
  }, [historyIndex, setAnnotations]);

  const updateAnnotation = useCallback((id: string, updates: Partial<Annotation>) => {
    setAnnotations((prev) => {
      const updated = prev.map((ann) => (ann.id === id ? { ...ann, ...updates } : ann));
      setAnnotationHistory((history) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(updated);
        return newHistory;
      });
      setHistoryIndex((idx) => idx + 1);
      dispatch({ type: 'SET_CAN_UNDO', payload: true });
      dispatch({ type: 'SET_CAN_REDO', payload: false });
      return updated;
    });
  }, [historyIndex, setAnnotations]);

  const deleteAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => {
      const updated = prev.filter((ann) => ann.id !== id);
      setAnnotationHistory((history) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(updated);
        return newHistory;
      });
      setHistoryIndex((idx) => idx + 1);
      dispatch({ type: 'SET_CAN_UNDO', payload: true });
      dispatch({ type: 'SET_CAN_REDO', payload: false });
      return updated;
    });
    if (state.selectedAnnotation === id) {
      dispatch({ type: 'SET_SELECTED_ANNOTATION', payload: null });
    }
  }, [historyIndex, state.selectedAnnotation, setAnnotations]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setAnnotations(annotationHistory[newIndex] || []);
      dispatch({ type: 'SET_CAN_UNDO', payload: newIndex > 0 });
      dispatch({ type: 'SET_CAN_REDO', payload: true });
    }
  }, [historyIndex, annotationHistory, setAnnotations]);

  const handleRedo = useCallback(() => {
    if (historyIndex < annotationHistory.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setAnnotations(annotationHistory[newIndex]);
      dispatch({ type: 'SET_CAN_UNDO', payload: true });
      dispatch({ type: 'SET_CAN_REDO', payload: newIndex < annotationHistory.length - 1 });
    }
  }, [historyIndex, annotationHistory, setAnnotations]);

  const handleSaveAnnotations = useCallback(async () => {
    // In a real implementation, this would save to a backend
    try {
      const data = JSON.stringify({ annotations, formFields }, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileName.replace('.pdf', '')}-annotations.json`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Save annotations error:', err);
    }
  }, [annotations, formFields, fileName]);

  const getPageAnnotations = useCallback(
    (page: number) => annotations.filter((ann) => ann.page === page),
    [annotations]
  );

  // ============================================================================
  // Share & Copy Handlers
  // ============================================================================

  const handleCopyLink = useCallback(async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(fileUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = fileUrl;
        textArea.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      dispatch({ type: 'SET_COPIED', payload: true });
      setTimeout(() => dispatch({ type: 'SET_COPIED', payload: false }), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }, [fileUrl]);

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: fileName,
          url: fileUrl,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  }, [fileName, fileUrl, handleCopyLink]);

  const handleOpenInNewTab = useCallback(() => {
    window.open(fileUrl, '_blank', 'noopener,noreferrer');
  }, [fileUrl]);

  // ============================================================================
  // Keyboard Shortcuts
  // ============================================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
        }
        if (e.key === 'Enter' && e.target === searchInputRef.current) {
          e.preventDefault();
          if (state.searchResults.length > 0) {
            goToNextSearchResult();
          }
        }
        return;
      }

      const ctrl = e.ctrlKey || e.metaKey;

      switch (e.key) {
        case 'Escape':
          if (state.showSearch) {
            dispatch({ type: 'SET_SHOW_SEARCH', payload: false });
            dispatch({ type: 'SET_SEARCH_TEXT', payload: '' });
            dispatch({ type: 'SET_SEARCH_RESULTS', payload: [] });
          } else if (state.showBookmarks) {
            dispatch({ type: 'SET_SHOW_BOOKMARKS', payload: false });
          } else if (state.showSettings) {
            dispatch({ type: 'SET_SHOW_SETTINGS', payload: false });
          } else {
            onClose();
          }
          break;
        case 'ArrowLeft':
          if (!ctrl) {
            e.preventDefault();
            goToPrevPage();
          }
          break;
        case 'ArrowRight':
          if (!ctrl) {
            e.preventDefault();
            goToNextPage();
          }
          break;
        case 'ArrowUp':
          if (ctrl && state.searchResults.length > 0) {
            e.preventDefault();
            goToPrevSearchResult();
          }
          break;
        case 'ArrowDown':
          if (ctrl && state.searchResults.length > 0) {
            e.preventDefault();
            goToNextSearchResult();
          }
          break;
        case 'Home':
          e.preventDefault();
          goToFirstPage();
          break;
        case 'End':
          e.preventDefault();
          goToLastPage();
          break;
        case '+':
        case '=':
          if (ctrl) {
            e.preventDefault();
            handleZoomIn();
          }
          break;
        case '-':
          if (ctrl) {
            e.preventDefault();
            handleZoomOut();
          }
          break;
        case '0':
          if (ctrl) {
            e.preventDefault();
            handleZoomReset();
          }
          break;
        case 'f':
          if (ctrl) {
            e.preventDefault();
            dispatch({ type: 'SET_SHOW_SEARCH', payload: true });
            setTimeout(() => searchInputRef.current?.focus(), 100);
          }
          break;
        case 'r':
          if (ctrl) {
            e.preventDefault();
            handleRotate();
          }
          break;
        case 'p':
          if (ctrl) {
            e.preventDefault();
            handlePrint();
          }
          break;
        case 's':
          if (ctrl) {
            e.preventDefault();
            handleDownload();
          }
          break;
        case 'b':
          if (ctrl) {
            e.preventDefault();
            toggleBookmark(state.pageNumber);
          }
          break;
        case 'F11':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 't':
          if (!ctrl) {
            dispatch({ type: 'TOGGLE_THUMBNAILS' });
          }
          break;
        case 'w':
          if (ctrl) {
            e.preventDefault();
            handleFitWidth();
          }
          break;
        case '1':
          if (ctrl) {
            e.preventDefault();
            handleFitPage();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    state.showSearch,
    state.showBookmarks,
    state.showSettings,
    state.searchResults.length,
    state.pageNumber,
    goToPrevPage,
    goToNextPage,
    goToFirstPage,
    goToLastPage,
    goToPrevSearchResult,
    goToNextSearchResult,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    handleRotate,
    handlePrint,
    handleDownload,
    toggleBookmark,
    toggleFullscreen,
    handleFitWidth,
    handleFitPage,
    onClose,
  ]);

  // ============================================================================
  // Fullscreen Change Listener
  // ============================================================================

  useEffect(() => {
    const handleFullscreenChange = () => {
      dispatch({ type: 'SET_FULLSCREEN', payload: !!document.fullscreenElement });
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // ============================================================================
  // Scroll Spy with IntersectionObserver
  // ============================================================================

  const handleIntersection = useThrottle((entries: IntersectionObserverEntry[]) => {
    const visibleEntries = entries.filter((e) => e.isIntersecting);
    if (visibleEntries.length > 0) {
      const mostVisible = visibleEntries.reduce((prev, curr) =>
        curr.intersectionRatio > prev.intersectionRatio ? curr : prev
      );
      const pageNum = parseInt(mostVisible.target.getAttribute('data-page') || '1', 10);
      if (pageNum !== state.pageNumber) {
        dispatch({ type: 'SET_PAGE_NUMBER', payload: pageNum });
      }
    }
  }, 150);

  useEffect(() => {
    if (state.viewMode === 'single' || state.loading) return;

    const observer = new IntersectionObserver(
      (entries) => handleIntersection(entries),
      {
        threshold: [0.1, 0.3, 0.5, 0.7, 0.9],
        rootMargin: '-10% 0px -10% 0px',
      }
    );

    pageRefs.current.forEach((element) => {
      observer.observe(element);
    });

    return () => observer.disconnect();
  }, [state.numPages, state.loading, state.viewMode, state.pageNumber, handleIntersection]);

  // ============================================================================
  // Mouse Wheel Zoom
  // ============================================================================

  useEffect(() => {
    const container = mainContentRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        handleZoomTo(scaleRef.current + delta);
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [handleZoomTo]);

  // ============================================================================
  // Touch Gestures
  // ============================================================================

  useEffect(() => {
    const container = mainContentRef.current;
    if (!container) return;

    const getDistance = (t1: Touch, t2: Touch) => {
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      return Math.hypot(dx, dy);
    };

    const handleTouchStart = (e: TouchEvent) => {
      const gesture = gestureRef.current;

      if (e.touches.length === 2) {
        gesture.isPinching = true;
        gesture.startDistance = getDistance(e.touches[0], e.touches[1]);
        gesture.startScale = scaleRef.current;
      } else if (e.touches.length === 1) {
        const now = Date.now();
        const timeDiff = now - gesture.lastTap;

        if (timeDiff < 300 && timeDiff > 0) {
          e.preventDefault();
          if (scaleRef.current > 1.5) {
            handleZoomTo(1.0);
          } else {
            handleZoomTo(2.5);
          }
        }
        gesture.lastTap = now;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const gesture = gestureRef.current;

      if (e.touches.length === 2 && gesture.isPinching) {
        e.preventDefault();

        const currentDistance = getDistance(e.touches[0], e.touches[1]);
        const scaleFactor = currentDistance / gesture.startDistance;
        const newScale = gesture.startScale * scaleFactor;

        const clampedScale = Math.max(0.5, Math.min(4.0, newScale));
        dispatch({ type: 'SET_SCALE', payload: clampedScale });
      }
    };

    const handleTouchEnd = () => {
      const gesture = gestureRef.current;
      gesture.isPinching = false;

      const currentScale = scaleRef.current;
      if (currentScale < 0.5) {
        handleZoomTo(0.5);
      } else if (currentScale > 4.0) {
        handleZoomTo(4.0);
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [handleZoomTo]);

  // ============================================================================
  // Memoized Values
  // ============================================================================

  const thumbnailList = useMemo(() => {
    if (state.loading) return null;
    return Array.from({ length: state.numPages }, (_, i) => i + 1);
  }, [state.numPages, state.loading]);

  const pageList = useMemo(() => {
    if (state.loading) return null;
    if (state.viewMode === 'single') {
      return [state.pageNumber];
    }
    return Array.from({ length: state.numPages }, (_, i) => i + 1);
  }, [state.numPages, state.loading, state.viewMode, state.pageNumber]);

  const getPageWidth = useCallback(() => {
    if (!mainContentRef.current) return undefined;
    const containerWidth = mainContentRef.current.clientWidth;

    if (state.viewMode === 'two-page' && !state.isMobile) {
      return Math.min((containerWidth - 80) / 2, 500) * state.scale;
    }

    return undefined;
  }, [state.viewMode, state.isMobile, state.scale]);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm"
    >
      <div className="h-full w-full flex flex-col p-2 sm:p-4 md:p-6">
        {/* Header */}
        <header className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-white/40 dark:border-slate-700/50 rounded-lg shadow-lg mb-2 sm:mb-4 flex items-center justify-between p-2 sm:p-3 gap-2 sm:gap-4 flex-wrap">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => dispatch({ type: 'TOGGLE_THUMBNAILS' })}
              title="Küçük resimleri aç/kapat (T)"
              className="h-8 w-8 sm:h-10 sm:w-10"
            >
              {state.showThumbnails ? (
                <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              ) : (
                <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
            </Button>
            <div className="min-w-0">
              <h1 className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-white truncate max-w-[120px] sm:max-w-[200px] md:max-w-none">
                {fileName}
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">
                Sayfa {state.pageNumber} / {state.numPages || '...'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
            {/* Page Navigation */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-700">
              <Button
                variant="ghost"
                size="icon"
                onClick={goToFirstPage}
                disabled={state.pageNumber <= 1 || state.loading}
                title="İlk sayfa (Home)"
                className="h-7 w-7 sm:h-8 sm:w-8 hidden sm:flex"
              >
                <ChevronsLeft className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={goToPrevPage}
                disabled={state.pageNumber <= 1 || state.loading}
                title="Önceki sayfa"
                className="h-7 w-7 sm:h-8 sm:w-8"
              >
                <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
              <form onSubmit={handlePageInputSubmit} className="flex items-center">
                <Input
                  value={state.pageInputValue}
                  onChange={handlePageInputChange}
                  onBlur={handlePageInputBlur}
                  disabled={state.loading}
                  className="w-8 sm:w-12 h-7 sm:h-8 text-center border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-xs sm:text-sm p-0"
                />
                <span className="text-xs sm:text-sm text-slate-500 pr-1 sm:pr-2">
                  / {state.numPages || '...'}
                </span>
              </form>
              <Button
                variant="ghost"
                size="icon"
                onClick={goToNextPage}
                disabled={state.pageNumber >= state.numPages || state.loading}
                title="Sonraki sayfa"
                className="h-7 w-7 sm:h-8 sm:w-8"
              >
                <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 rotate-[-90deg]" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={goToLastPage}
                disabled={state.pageNumber >= state.numPages || state.loading}
                title="Son sayfa (End)"
                className="h-7 w-7 sm:h-8 sm:w-8 hidden sm:flex"
              >
                <ChevronsRight className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            </div>

            {/* Zoom Controls - Desktop */}
            <div className="hidden md:flex items-center bg-slate-100 dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-700">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomOut}
                disabled={state.scale <= 0.25}
                title="Uzaklaştır (Ctrl+-)"
                className="h-8 w-8"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <button
                onClick={handleZoomReset}
                onDoubleClick={handleFitWidth}
                className="px-2 sm:px-3 text-xs sm:text-sm font-medium min-w-[50px] sm:min-w-[60px] text-center hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                title="Sıfırlamak için tıkla, genişliğe sığdırmak için çift tıkla"
              >
                {Math.round(state.scale * 100)}%
              </button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomIn}
                disabled={state.scale >= 4.0}
                title="Yakınlaştır (Ctrl++)"
                className="h-8 w-8"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Mobile Zoom */}
            <div className="flex md:hidden items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomOut}
                disabled={state.scale <= 0.25}
                className="h-7 w-7"
              >
                <ZoomOut className="h-3 w-3" />
              </Button>
              <span className="text-[10px] min-w-[32px] text-center">{Math.round(state.scale * 100)}%</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomIn}
                disabled={state.scale >= 4.0}
                className="h-7 w-7"
              >
                <ZoomIn className="h-3 w-3" />
              </Button>
            </div>

            {/* Rotate */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRotate}
              title="Döndür (Ctrl+R)"
              className="hidden sm:flex h-8 w-8 sm:h-10 sm:w-10"
            >
              <RotateCw className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>

            {/* Bookmark current page */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => toggleBookmark(state.pageNumber)}
              title={isPageBookmarked(state.pageNumber) ? 'Yer imini kaldır (Ctrl+B)' : 'Yer imi ekle (Ctrl+B)'}
              className="hidden sm:flex h-8 w-8 sm:h-10 sm:w-10"
            >
              {isPageBookmarked(state.pageNumber) ? (
                <BookmarkCheck className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
              ) : (
                <Bookmark className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
            </Button>

            {/* Bookmarks panel toggle */}
            {bookmarks.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => dispatch({ type: 'TOGGLE_BOOKMARKS' })}
                title="Yer imlerini göster"
                className="hidden sm:flex h-8 w-8 sm:h-10 sm:w-10 relative"
              >
                <Bookmark className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                  {bookmarks.length}
                </span>
              </Button>
            )}

            {/* Search */}
            {state.showSearch && (
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-700 px-1 sm:px-2">
                <Input
                  ref={searchInputRef}
                  placeholder="Ara..."
                  value={state.searchText}
                  onChange={(e) => dispatch({ type: 'SET_SEARCH_TEXT', payload: e.target.value })}
                  className="w-20 sm:w-32 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-7 sm:h-8 text-xs sm:text-sm"
                />
                {state.isSearching ? (
                  <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin text-slate-400" />
                ) : state.searchResults.length > 0 ? (
                  <span className="text-[10px] sm:text-xs text-slate-500 px-1 whitespace-nowrap">
                    {state.currentSearchIndex + 1}/{state.searchResults.length}
                  </span>
                ) : state.searchText && !state.isSearching ? (
                  <span className="text-[10px] sm:text-xs text-slate-400 px-1">0</span>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 sm:h-8 sm:w-8"
                  onClick={goToPrevSearchResult}
                  disabled={state.searchResults.length === 0}
                >
                  <ChevronUp className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 sm:h-8 sm:w-8"
                  onClick={goToNextSearchResult}
                  disabled={state.searchResults.length === 0}
                >
                  <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 sm:h-8 sm:w-8"
                  onClick={() => {
                    dispatch({ type: 'SET_SHOW_SEARCH', payload: false });
                    dispatch({ type: 'SET_SEARCH_TEXT', payload: '' });
                    dispatch({ type: 'SET_SEARCH_RESULTS', payload: [] });
                  }}
                >
                  <X className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                dispatch({ type: 'TOGGLE_SEARCH' });
                if (!state.showSearch) {
                  setTimeout(() => searchInputRef.current?.focus(), 100);
                }
              }}
              title="Ara (Ctrl+F)"
              className="h-7 w-7 sm:h-10 sm:w-10"
            >
              <Search className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>

            <div className="hidden sm:block h-6 w-px bg-slate-200 dark:bg-slate-700" />

            {/* Settings */}
            <div className="relative hidden sm:block">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => dispatch({ type: 'TOGGLE_SETTINGS' })}
                title="Ayarlar"
                className="h-8 w-8 sm:h-10 sm:w-10"
              >
                <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>

              {state.showSettings && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 p-3">
                  <h3 className="text-sm font-semibold mb-3 text-slate-900 dark:text-white">Görünüm Seçenekleri</h3>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-slate-500 mb-1.5 block">Görünüm Modu</label>
                      <div className="flex gap-1">
                        <Button
                          variant={state.viewMode === 'single' ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1 h-8 text-xs"
                          onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'single' })}
                        >
                          <FileText className="h-3 w-3 mr-1" />
                          Tekli
                        </Button>
                        <Button
                          variant={state.viewMode === 'continuous' ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1 h-8 text-xs"
                          onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'continuous' })}
                        >
                          <Menu className="h-3 w-3 mr-1" />
                          Kaydır
                        </Button>
                        <Button
                          variant={state.viewMode === 'two-page' ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1 h-8 text-xs"
                          onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'two-page' })}
                        >
                          <Columns className="h-3 w-3 mr-1" />
                          İkili
                        </Button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-slate-500 mb-1.5 block">Yakınlaştırma</label>
                      <div className="grid grid-cols-3 gap-1">
                        {[50, 75, 100, 125, 150, 200].map((zoom) => (
                          <Button
                            key={zoom}
                            variant={Math.round(state.scale * 100) === zoom ? 'default' : 'outline'}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleZoomTo(zoom / 100)}
                          >
                            {zoom}%
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-slate-500 mb-1.5 block">Sığdırma</label>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-8 text-xs bg-transparent"
                          onClick={handleFitWidth}
                        >
                          Genişliğe Sığdır
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-8 text-xs bg-transparent"
                          onClick={handleFitPage}
                        >
                          Sayfaya Sığdır
                        </Button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-slate-500 mb-1.5 block">Döndürme</label>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-8 text-xs bg-transparent"
                          onClick={handleRotateBack}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Sola
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-8 text-xs bg-transparent"
                          onClick={handleRotate}
                        >
                          <RotateCw className="h-3 w-3 mr-1" />
                          Sağa
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Annotation Tools */}
            <div className="hidden lg:block h-6 w-px bg-slate-200 dark:bg-slate-700" />
            
            <div className="relative hidden lg:block">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => dispatch({ type: 'TOGGLE_ANNOTATION_TOOLS' })}
                title="Açıklama Araçları"
                className="h-8 w-8 sm:h-10 sm:w-10"
              >
                <Highlighter className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>

              {state.showAnnotationTools && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 p-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Açıklama Araçları</h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => dispatch({ type: 'TOGGLE_ANNOTATION_TOOLS' })}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-slate-500 mb-1.5 block">Araç Seçimi</label>
                      <div className="grid grid-cols-4 gap-1">
                        {[
                          { mode: 'select' as ToolMode, icon: MousePointer, label: 'Seç' },
                          { mode: 'hand' as ToolMode, icon: Hand, label: 'El' },
                          { mode: 'highlight' as ToolMode, icon: Highlighter, label: 'Vurgula' },
                          { mode: 'underline' as ToolMode, icon: Underline, label: 'Alt Çizgi' },
                          { mode: 'strikethrough' as ToolMode, icon: Strikethrough, label: 'Üstü Çizili' },
                          { mode: 'note' as ToolMode, icon: StickyNote, label: 'Not' },
                          { mode: 'text' as ToolMode, icon: Type, label: 'Metin' },
                          { mode: 'rectangle' as ToolMode, icon: Square, label: 'Dikdörtgen' },
                          { mode: 'circle' as ToolMode, icon: Circle, label: 'Daire' },
                          { mode: 'arrow' as ToolMode, icon: ArrowRight, label: 'Ok' },
                          { mode: 'freehand' as ToolMode, icon: Pencil, label: 'Serbest' },
                          { mode: 'signature' as ToolMode, icon: PenTool, label: 'İmza' },
                        ].map(({ mode, icon: Icon, label }) => (
                          <Button
                            key={mode}
                            variant={state.toolMode === mode ? 'default' : 'outline'}
                            size="sm"
                            className="h-12 flex flex-col items-center justify-center gap-1 text-[10px]"
                            onClick={() => dispatch({ type: 'SET_TOOL_MODE', payload: mode })}
                            title={label}
                          >
                            <Icon className="h-4 w-4" />
                            <span className="truncate w-full text-center">{label}</span>
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-slate-500 mb-1.5 block">Renk</label>
                      <div className="grid grid-cols-8 gap-1">
                        {[
                          '#FFEB3B', '#FFC107', '#FF9800', '#FF5722',
                          '#F44336', '#E91E63', '#9C27B0', '#673AB7',
                          '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4',
                          '#009688', '#4CAF50', '#8BC34A', '#CDDC39',
                        ].map((color) => (
                          <button
                            key={color}
                            className={cn(
                              'w-6 h-6 rounded border-2 transition-all',
                              state.annotationColor === color
                                ? 'border-slate-900 dark:border-white scale-110'
                                : 'border-transparent hover:border-slate-300'
                            )}
                            style={{ backgroundColor: color }}
                            onClick={() => dispatch({ type: 'SET_ANNOTATION_COLOR', payload: color })}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-slate-500 mb-1.5 block">
                        Opaklık: {Math.round(state.annotationOpacity * 100)}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={state.annotationOpacity}
                        onChange={(e) => dispatch({ type: 'SET_ANNOTATION_OPACITY', payload: parseFloat(e.target.value) })}
                        className="w-full"
                      />
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 text-xs"
                        onClick={handleUndo}
                        disabled={!state.canUndo}
                      >
                        <Undo className="h-3 w-3 mr-1" />
                        Geri Al
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 text-xs"
                        onClick={handleRedo}
                        disabled={!state.canRedo}
                      >
                        <Redo className="h-3 w-3 mr-1" />
                        Yinele
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 text-xs"
                        onClick={handleSaveAnnotations}
                      >
                        <Save className="h-3 w-3 mr-1" />
                        Kaydet
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar Tabs */}
            <div className="hidden lg:flex items-center bg-slate-100 dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-700">
              <Button
                variant={state.sidebarTab === 'thumbnails' ? 'default' : 'ghost'}
                size="icon"
                onClick={() => dispatch({ type: 'SET_SIDEBAR_TAB', payload: 'thumbnails' })}
                title="Küçük Resimler"
                className="h-8 w-8"
              >
                <FileText className="h-4 w-4" />
              </Button>
              <Button
                variant={state.sidebarTab === 'bookmarks' ? 'default' : 'ghost'}
                size="icon"
                onClick={() => dispatch({ type: 'SET_SIDEBAR_TAB', payload: 'bookmarks' })}
                title="Yer İmleri"
                className="h-8 w-8"
              >
                <Bookmark className="h-4 w-4" />
              </Button>
              <Button
                variant={state.sidebarTab === 'annotations' ? 'default' : 'ghost'}
                size="icon"
                onClick={() => dispatch({ type: 'SET_SIDEBAR_TAB', payload: 'annotations' })}
                title="Açıklamalar"
                className="h-8 w-8 relative"
              >
                <Highlighter className="h-4 w-4" />
                {annotations.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                    {annotations.length}
                  </span>
                )}
              </Button>
              <Button
                variant={state.sidebarTab === 'layers' ? 'default' : 'ghost'}
                size="icon"
                onClick={() => dispatch({ type: 'SET_SIDEBAR_TAB', payload: 'layers' })}
                title="Katmanlar"
                className="h-8 w-8"
              >
                <Layers className="h-4 w-4" />
              </Button>
            </div>

            <div className="hidden sm:block h-6 w-px bg-slate-200 dark:bg-slate-700" />

            {/* Action Buttons */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              title="Tam Ekran (F11)"
              className="hidden sm:flex h-8 w-8 sm:h-10 sm:w-10"
            >
              {state.isFullscreen ? (
                <Minimize className="h-4 w-4 sm:h-5 sm:w-5" />
              ) : (
                <Maximize className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleShare}
              title="Paylaş / Bağlantıyı kopyala"
              className="hidden sm:flex h-8 w-8 sm:h-10 sm:w-10"
            >
              {state.copied ? (
                <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
              ) : (
                <Share2 className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleDownload}
              disabled={state.isDownloading}
              title="İndir (Ctrl+S)"
              className="h-7 w-7 sm:h-10 sm:w-10 relative"
            >
              {state.isDownloading ? (
                <>
                  <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                  {state.downloadProgress > 0 && state.downloadProgress < 100 && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-medium">
                      {state.downloadProgress}%
                    </span>
                  )}
                </>
              ) : (
                <Download className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrint}
              disabled={state.isPrinting}
              title="Yazdır (Ctrl+P)"
              className="hidden sm:flex h-8 w-8 sm:h-10 sm:w-10"
            >
              {state.isPrinting ? (
                <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
              ) : (
                <Printer className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              title="Kapat (Esc)"
              className="h-7 w-7 sm:h-10 sm:w-10"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden bg-white dark:bg-slate-900 rounded-lg shadow-lg relative">
          {/* Unified Sidebar */}
          {state.showSidebar && !state.isMobile && (
            <aside className="w-56 sm:w-64 bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 overflow-y-auto flex-shrink-0">
              <div className="sticky top-0 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 p-3 z-10">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {state.sidebarTab === 'thumbnails' && 'Sayfalar'}
                    {state.sidebarTab === 'bookmarks' && 'Yer İmleri'}
                    {state.sidebarTab === 'annotations' && 'Açıklamalar'}
                    {state.sidebarTab === 'layers' && 'Katmanlar'}
                  </h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => dispatch({ type: 'SET_SHOW_SIDEBAR', payload: false })}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="p-3">
                {state.sidebarTab === 'thumbnails' && (
                  <div className="space-y-3">
                    {thumbnailList?.map((page) => (
                      <ThumbnailPage
                        key={page}
                        fileUrl={fileUrl}
                        page={page}
                        rotation={state.rotation}
                        isActive={page === state.pageNumber}
                        isBookmarked={isPageBookmarked(page)}
                        searchMatchCount={state.searchResults.find((r) => r.page === page)?.matches || 0}
                        onClick={() => goToPage(page)}
                      />
                    ))}
                  </div>
                )}

                {state.sidebarTab === 'bookmarks' && (
                  <div className="space-y-2">
                    {bookmarks.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-sm">
                        <Bookmark className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Henüz yer imi yok</p>
                        <p className="text-xs mt-1">Ctrl+B ile ekleyin</p>
                      </div>
                    ) : (
                      bookmarks.map((bookmark) => (
                        <div
                          key={bookmark.page}
                          className={cn(
                            'group w-full flex items-center gap-2 p-2 rounded-md text-left transition-colors cursor-pointer',
                            bookmark.page === state.pageNumber
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                          )}
                          onClick={() => goToPage(bookmark.page)}
                        >
                          <BookmarkCheck className="h-4 w-4 text-blue-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{bookmark.title}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e: React.MouseEvent<HTMLElement>) => {
                              e.stopPropagation();
                              toggleBookmark(bookmark.page);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {state.sidebarTab === 'annotations' && (
                  <div className="space-y-2">
                    {annotations.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-sm">
                        <Highlighter className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Henüz açıklama yok</p>
                        <p className="text-xs mt-1">Araç çubuğundan ekleyin</p>
                      </div>
                    ) : (
                      annotations.map((annotation) => (
                        <div
                          key={annotation.id}
                          className={cn(
                            'group w-full flex items-start gap-2 p-2 rounded-md text-left transition-colors cursor-pointer',
                            state.selectedAnnotation === annotation.id
                              ? 'bg-blue-100 dark:bg-blue-900/30'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                          )}
                          onClick={() => {
                            dispatch({ type: 'SET_SELECTED_ANNOTATION', payload: annotation.id });
                            goToPage(annotation.page);
                          }}
                        >
                          <div
                            className="w-4 h-4 rounded flex-shrink-0 mt-0.5"
                            style={{ backgroundColor: annotation.color, opacity: annotation.opacity }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-500">Sayfa {annotation.page}</p>
                            <p className="text-sm truncate">{annotation.type}</p>
                            {annotation.text && (
                              <p className="text-xs text-slate-500 truncate mt-1">{annotation.text}</p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e: React.MouseEvent<HTMLElement>) => {
                              e.stopPropagation();
                              deleteAnnotation(annotation.id);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {state.sidebarTab === 'layers' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 bg-slate-100 dark:bg-slate-800 rounded-md">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        <span className="text-sm">PDF İçeriği</span>
                      </div>
                      <input type="checkbox" defaultChecked className="rounded" />
                    </div>
                    <div className="flex items-center justify-between p-2 bg-slate-100 dark:bg-slate-800 rounded-md">
                      <div className="flex items-center gap-2">
                        <Highlighter className="h-4 w-4" />
                        <span className="text-sm">Açıklamalar ({annotations.length})</span>
                      </div>
                      <input type="checkbox" defaultChecked className="rounded" />
                    </div>
                    <div className="flex items-center justify-between p-2 bg-slate-100 dark:bg-slate-800 rounded-md">
                      <div className="flex items-center gap-2">
                        <Square className="h-4 w-4" />
                        <span className="text-sm">Form Alanları ({formFields.length})</span>
                      </div>
                      <input type="checkbox" defaultChecked className="rounded" />
                    </div>
                  </div>
                )}
              </div>
            </aside>
          )}


          {/* PDF Display */}
          <main
            ref={mainContentRef}
            className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-900 p-4 sm:p-8"
            style={{ touchAction: gestureRef.current.isPinching ? 'none' : 'pan-x pan-y' }}
          >
            <div
              className={cn(
                'mx-auto',
                state.viewMode === 'two-page' && !state.isMobile ? 'max-w-7xl' : 'max-w-5xl'
              )}
            >
              {state.error ? (
                <div className="flex items-center justify-center h-96">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <p className="text-red-500 font-semibold mb-2">PDF yüklenemedi</p>
                    <p className="text-slate-500 text-sm mb-4 max-w-xs mx-auto">{state.error}</p>
                    <div className="flex gap-2 justify-center flex-wrap">
                      <Button onClick={handleRetry} disabled={state.retryCount >= 3}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        {state.retryCount >= 3 ? 'Maksimum deneme' : 'Tekrar Dene'}
                      </Button>
                      <Button variant="outline" onClick={handleDownload}>
                        <Download className="h-4 w-4 mr-2" />
                        İndir
                      </Button>
                      <Button variant="outline" onClick={handleOpenInNewTab}>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Yeni Sekmede Aç
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <Document
                  key={state.retryCount}
                  file={fileUrl}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={onDocumentLoadError}
                  onLoadProgress={onLoadProgress}
                  loading={
                    <div className="flex items-center justify-center h-96">
                      <div className="text-center">
                        <div className="relative w-16 h-16 mx-auto mb-4">
                          <div className="absolute inset-0 rounded-full border-4 border-slate-200 dark:border-slate-700" />
                          <svg className="absolute inset-0 w-16 h-16 -rotate-90">
                            <circle
                              cx="32"
                              cy="32"
                              r="28"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="4"
                              strokeDasharray={`${state.loadProgress * 1.76} 176`}
                              className="text-blue-500 transition-all duration-300"
                            />
                          </svg>
                          <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-slate-600 dark:text-slate-400">
                            {state.loadProgress}%
                          </span>
                        </div>
                        <p className="text-slate-500">PDF yükleniyor...</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {state.loadingStage === 'downloading' && 'İndiriliyor...'}
                          {state.loadingStage === 'parsing' && 'Ayrıştırılıyor...'}
                          {state.loadingStage === 'rendering' && 'Hazırlanıyor...'}
                        </p>
                      </div>
                    </div>
                  }
                  className={cn(
                    'flex gap-4 sm:gap-6',
                    state.viewMode === 'two-page' && !state.isMobile
                      ? 'flex-row flex-wrap justify-center'
                      : 'flex-col items-center'
                  )}
                >
                  {pageList?.map((page) => (
                    <PDFPage
                      key={page}
                      page={page}
                      scale={state.scale}
                      rotation={state.rotation}
                      width={getPageWidth()}
                      isHighlighted={state.searchResults.some((r) => r.page === page)}
                      isActive={page === state.pageNumber}
                      onRef={(el) => {
                        if (el) {
                          pageRefs.current.set(page, el);
                        } else {
                          pageRefs.current.delete(page);
                        }
                      }}
                    />
                  ))}
                </Document>
              )}
            </div>
          </main>
        </div>

        {/* Footer Status Bar */}
        <footer className="mt-2 sm:mt-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur-lg border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-1.5 sm:p-2 flex items-center justify-between text-[10px] sm:text-xs text-slate-500">
          <div className="flex items-center gap-2 sm:gap-4">
            <span>
              Sayfa {state.pageNumber} / {state.numPages || '...'}
            </span>
            <span className="hidden sm:inline">|</span>
            <span className="hidden sm:inline">Yakınlaştırma: {Math.round(state.scale * 100)}%</span>
            {state.rotation > 0 && (
              <>
                <span className="hidden sm:inline">|</span>
                <span className="hidden sm:inline">Döndürme: {state.rotation}°</span>
              </>
            )}
            {bookmarks.length > 0 && (
              <>
                <span className="hidden sm:inline">|</span>
                <span className="hidden sm:inline">
                  {bookmarks.length} yer imi
                </span>
              </>
            )}
            <span className="hidden lg:inline">|</span>
            <span className="hidden lg:inline capitalize">
              {state.viewMode === 'single' && 'Tekli'}
              {state.viewMode === 'continuous' && 'Kaydırma'}
              {state.viewMode === 'two-page' && 'İkili'}
            </span>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <kbd className="px-1 sm:px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[9px] sm:text-[10px]">Esc</kbd>
            <span>Kapat</span>
            <span className="mx-1 sm:mx-2">|</span>
            <kbd className="px-1 sm:px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[9px] sm:text-[10px]">Ctrl+F</kbd>
            <span>Ara</span>
            <span className="mx-1 sm:mx-2">|</span>
            <kbd className="px-1 sm:px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[9px] sm:text-[10px]">Ctrl+B</kbd>
            <span>Yer İmi</span>
          </div>
        </footer>
      </div>

      {/* Click outside to close settings */}
      {state.showSettings && (
        <div className="fixed inset-0 z-40" onClick={() => dispatch({ type: 'SET_SHOW_SETTINGS', payload: false })} />
      )}
    </div>
  );
}
