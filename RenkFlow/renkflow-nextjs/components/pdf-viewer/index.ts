/**
 * PDF Viewer Components
 * 
 * A comprehensive PDF viewer solution with performance optimizations,
 * accessibility features, and enhanced user experience.
 * 
 * @example
 * ```tsx
 * import { PDFViewer, ErrorOverlay, LoadingOverlay } from '@/components/pdf-viewer';
 * 
 * function MyComponent() {
 *   return (
 *     <PDFViewer
 *       fileUrl="/document.pdf"
 *       fileName="document.pdf"
 *       onClose={() => setShowViewer(false)}
 *     />
 *   );
 * }
 * ```
 */

// Main Components
export { default as PDFViewer } from './PDFViewer';
export { default as ErrorOverlay } from './ErrorOverlay';
export { default as LoadingOverlay } from './LoadingOverlay';

// Types
export type {
  DocumentFile,
  ViewState,
  SidebarMode,
  ViewerState,
} from './types';

export type {
  ErrorOverlayProps,
  ErrorType,
} from './ErrorOverlay';

export type {
  LoadingOverlayProps,
  LoadingStage,
} from './LoadingOverlay';

// Constants & Mock Data
export { MOCK_FILES } from './constants';
export type { ExtendedDocumentFile } from './constants';

// Re-export for convenience
export { default } from './PDFViewer';
