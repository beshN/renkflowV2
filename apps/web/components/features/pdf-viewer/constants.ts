import { DocumentFile } from './types';

// ============================================================================
// Extended DocumentFile Interface
// ============================================================================

/** Extended DocumentFile with additional test properties */
export interface ExtendedDocumentFile extends DocumentFile {
  /** Optional description of the file */
  description?: string;
  /** Whether this is a test file */
  isTestFile?: boolean;
  /** Expected error type for test files */
  expectedError?: string;
}

// ============================================================================
// Mock PDF URLs for Testing
// ============================================================================

/**
 * Sample PDF URLs for testing purposes
 * These are public domain or sample PDFs that can be used for testing
 */
const SAMPLE_PDF_URLS = {
  /** Sample PDF from pdfobject.com - CORS friendly */
  sample: 'https://pdfobject.com/pdf/sample.pdf',
  /** PDF.js test document */
  pdfjsTest: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf',
  /** Small test PDF */
  small: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
} as const;

/**
 * Generate a mock thumbnail URL
 * In production, this would be a real thumbnail service
 */
const generateThumbnailUrl = (seed: string): string => {
  // Using a placeholder service for demo purposes
  return `https://placehold.co/200x280/e2e8f0/64748b?text=${encodeURIComponent(seed)}`;
};

// ============================================================================
// Mock Files
// ============================================================================

/**
 * Mock document files for testing and development
 * 
 * These files cover various scenarios:
 * - Normal PDF files
 * - Large PDF files
 * - Password protected (simulated)
 * - Corrupted/invalid URLs (for error testing)
 * - Single page PDFs
 * - Multi-page PDFs
 */
export const MOCK_FILES: ExtendedDocumentFile[] = [
  {
    id: 'sample-1',
    name: 'Ornek_Dokuman.pdf',
    size: '45 KB',
    type: 'pdf',
    pageCount: 1,
    thumbnailUrl: generateThumbnailUrl('PDF-1'),
    pages: [SAMPLE_PDF_URLS.sample],
    description: 'Örnek tek sayfalık PDF dosyası',
  },
  {
    id: 'sample-2',
    name: 'PDF.js_Test_Dokumani.pdf',
    size: '1.2 MB',
    type: 'pdf',
    pageCount: 14,
    thumbnailUrl: generateThumbnailUrl('PDF-14'),
    pages: [SAMPLE_PDF_URLS.pdfjsTest],
    description: 'PDF.js test dokümanı - 14 sayfa',
  },
  {
    id: 'sample-3',
    name: 'Kucuk_Test.pdf',
    size: '12 KB',
    type: 'pdf',
    pageCount: 1,
    thumbnailUrl: generateThumbnailUrl('PDF-S'),
    pages: [SAMPLE_PDF_URLS.small],
    description: 'Küçük boyutlu test PDF',
  },
  {
    id: 'error-network',
    name: 'Ağ_Hatasi_Test.pdf',
    size: '0 KB',
    type: 'pdf',
    pageCount: 0,
    thumbnailUrl: generateThumbnailUrl('ERR-NET'),
    pages: ['https://invalid-url-that-will-fail.com/document.pdf'],
    description: 'Ağ hatası testi için - geçersiz URL',
    isTestFile: true,
    expectedError: 'network',
  },
  {
    id: 'error-notfound',
    name: 'Bulunamadi_Test.pdf',
    size: '0 KB',
    type: 'pdf',
    pageCount: 0,
    thumbnailUrl: generateThumbnailUrl('ERR-404'),
    pages: ['https://httpstat.us/404'],
    description: '404 hatası testi için',
    isTestFile: true,
    expectedError: 'not-found',
  },
  {
    id: 'multi-page',
    name: 'Cok_Sayfali_Dokuman.pdf',
    size: '2.5 MB',
    type: 'pdf',
    pageCount: 5,
    thumbnailUrl: generateThumbnailUrl('PDF-5'),
    pages: [
      SAMPLE_PDF_URLS.sample,
      SAMPLE_PDF_URLS.small,
      SAMPLE_PDF_URLS.sample,
      SAMPLE_PDF_URLS.small,
      SAMPLE_PDF_URLS.sample,
    ],
    description: 'Çok sayfalı örnek doküman',
  },
];

// ============================================================================
// Viewer Configuration Constants
// ============================================================================

/**
 * Default configuration for the PDF viewer
 */
export const VIEWER_CONFIG = {
  /** Minimum zoom level (25%) */
  MIN_ZOOM: 0.25,
  /** Maximum zoom level (400%) */
  MAX_ZOOM: 4.0,
  /** Default zoom level (100%) */
  DEFAULT_ZOOM: 1.0,
  /** Zoom step increment */
  ZOOM_STEP: 0.25,
  /** Default rotation (0 degrees) */
  DEFAULT_ROTATION: 0,
  /** Rotation step (90 degrees) */
  ROTATION_STEP: 90,
  /** Maximum retry attempts for loading */
  MAX_RETRY_ATTEMPTS: 3,
  /** Debounce delay for search (ms) */
  SEARCH_DEBOUNCE: 300,
  /** Throttle delay for scroll events (ms) */
  SCROLL_THROTTLE: 150,
  /** Mobile breakpoint (px) */
  MOBILE_BREAKPOINT: 768,
  /** Double tap timeout (ms) */
  DOUBLE_TAP_TIMEOUT: 300,
} as const;

/**
 * Loading stages for the viewer
 */
export const LOADING_STAGES = {
  DOWNLOADING: 'downloading' as const,
  PARSING: 'parsing' as const,
  RENDERING: 'rendering' as const,
  COMPLETE: 'complete' as const,
};

/**
 * Error types for the viewer
 */
export const ERROR_TYPES = {
  NETWORK: 'network' as const,
  CORRUPT: 'corrupt' as const,
  PASSWORD: 'password' as const,
  NOT_FOUND: 'not-found' as const,
  UNKNOWN: 'unknown' as const,
};

/**
 * View modes for the viewer
 */
export const VIEW_MODES = {
  SINGLE: 'single' as const,
  CONTINUOUS: 'continuous' as const,
  TWO_PAGE: 'two-page' as const,
};

/**
 * Keyboard shortcuts configuration
 */
export const KEYBOARD_SHORTCUTS = {
  CLOSE: 'Escape',
  SEARCH: 'Ctrl+F',
  ZOOM_IN: 'Ctrl++',
  ZOOM_OUT: 'Ctrl+-',
  ZOOM_RESET: 'Ctrl+0',
  FIT_WIDTH: 'Ctrl+W',
  FIT_PAGE: 'Ctrl+1',
  ROTATE: 'Ctrl+R',
  PRINT: 'Ctrl+P',
  DOWNLOAD: 'Ctrl+S',
  BOOKMARK: 'Ctrl+B',
  FULLSCREEN: 'F11',
  TOGGLE_THUMBNAILS: 'T',
  PREV_PAGE: 'ArrowLeft',
  NEXT_PAGE: 'ArrowRight',
  FIRST_PAGE: 'Home',
  LAST_PAGE: 'End',
} as const;

export default MOCK_FILES;
