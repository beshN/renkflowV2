import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// ============================================================================
// Types
// ============================================================================

export type LoadingStage = 'downloading' | 'parsing' | 'rendering' | 'complete';
export type ErrorType = 'network' | 'corrupt' | 'password' | 'not-found' | 'unknown';
export type AnnotationType = 'highlight' | 'underline' | 'strikethrough' | 'note' | 'text' | 'rectangle' | 'circle' | 'arrow' | 'freehand' | 'signature';
export type ToolMode = 'select' | 'hand' | 'text' | AnnotationType;
export type ViewMode = 'single' | 'continuous' | 'two-page';
export type SidebarTab = 'thumbnails' | 'bookmarks' | 'annotations' | 'layers';

export interface Annotation {
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

export interface BookmarkItem {
  page: number;
  title: string;
  timestamp: number;
}

export interface FormField {
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

export interface SearchResult {
  page: number;
  matches: number;
  items: Array<{
    text: string;
    index: number;
    rect: [number, number, number, number];
  }>;
}

export interface PDFMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modificationDate?: Date;
}

// ============================================================================
// Store State Interface
// ============================================================================

interface PDFState {
  // Document State
  fileUrl: string | null;
  fileName: string | null;
  numPages: number;
  metadata: PDFMetadata | null;
  
  // View State
  pageNumber: number;
  scale: number;
  rotation: number;
  viewMode: ViewMode;
  
  // Loading & Error State
  loading: boolean;
  loadProgress: number;
  loadingStage: LoadingStage;
  error: string | null;
  errorType: ErrorType;
  retryCount: number;
  
  // UI State
  showSearch: boolean;
  showSidebar: boolean;
  sidebarTab: SidebarTab;
  isFullscreen: boolean;
  isMobile: boolean;
  
  // Search State
  searchText: string;
  searchResults: SearchResult[];
  currentSearchIndex: number;
  isSearching: boolean;
  
  // Tool State
  toolMode: ToolMode;
  selectedAnnotation: string | null;
  annotationColor: string;
  annotationOpacity: number;
  showAnnotationTools: boolean;
  isDrawing: boolean;
  
  // Data
  annotations: Annotation[];
  bookmarks: BookmarkItem[];
  formFields: FormField[];
  
  // History
  annotationHistory: Annotation[][];
  historyIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  
  // Performance
  renderQuality: number;
  enableTextLayer: boolean;
  enableAnnotationLayer: boolean;
  cacheSize: number;
  
  // Layer Controls
  pdfContentVisible: boolean;
  pdfContentOpacity: number;
  annotationLayerVisible: boolean;
  annotationLayerOpacity: number;
  formLayerVisible: boolean;
  formLayerOpacity: number;
  
  // Password Protection
  isPasswordProtected: boolean;
  passwordAttempts: number;
}

// ============================================================================
// Store Actions Interface
// ============================================================================

interface PDFActions {
  // Document Actions
  setDocument: (fileUrl: string, fileName: string) => void;
  setNumPages: (numPages: number) => void;
  setMetadata: (metadata: PDFMetadata) => void;
  resetDocument: () => void;
  
  // Navigation Actions
  setPageNumber: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  goToPage: (page: number) => void;
  
  // View Actions
  setScale: (scale: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  setRotation: (rotation: number) => void;
  rotate: (degrees: number) => void;
  setViewMode: (mode: ViewMode) => void;
  
  // Loading & Error Actions
  setLoading: (loading: boolean) => void;
  setLoadProgress: (progress: number) => void;
  setLoadingStage: (stage: LoadingStage) => void;
  setError: (error: string | null, type?: ErrorType) => void;
  incrementRetry: () => void;
  resetRetry: () => void;
  
  // UI Actions
  toggleSearch: () => void;
  setShowSearch: (show: boolean) => void;
  toggleSidebar: () => void;
  setShowSidebar: (show: boolean) => void;
  setSidebarTab: (tab: SidebarTab) => void;
  setFullscreen: (fullscreen: boolean) => void;
  setIsMobile: (isMobile: boolean) => void;
  
  // Search Actions
  setSearchText: (text: string) => void;
  setSearchResults: (results: SearchResult[]) => void;
  setCurrentSearchIndex: (index: number) => void;
  setIsSearching: (searching: boolean) => void;
  nextSearchResult: () => void;
  previousSearchResult: () => void;
  clearSearch: () => void;
  
  // Tool Actions
  setToolMode: (mode: ToolMode) => void;
  setSelectedAnnotation: (id: string | null) => void;
  setAnnotationColor: (color: string) => void;
  setAnnotationOpacity: (opacity: number) => void;
  toggleAnnotationTools: () => void;
  setIsDrawing: (drawing: boolean) => void;
  
  // Annotation Actions
  addAnnotation: (annotation: Omit<Annotation, 'id' | 'timestamp'>) => void;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  deleteAnnotation: (id: string) => void;
  clearAnnotations: () => void;
  getPageAnnotations: (page: number) => Annotation[];
  
  // Bookmark Actions
  addBookmark: (page: number, title: string) => void;
  removeBookmark: (page: number) => void;
  toggleBookmark: (page: number) => void;
  isPageBookmarked: (page: number) => boolean;
  clearBookmarks: () => void;
  
  // Form Actions
  addFormField: (field: Omit<FormField, 'id'>) => void;
  updateFormField: (id: string, updates: Partial<FormField>) => void;
  deleteFormField: (id: string) => void;
  clearFormFields: () => void;
  
  // History Actions
  undo: () => void;
  redo: () => void;
  
  // Performance Actions
  setRenderQuality: (quality: number) => void;
  setEnableTextLayer: (enable: boolean) => void;
  setEnableAnnotationLayer: (enable: boolean) => void;
  setCacheSize: (size: number) => void;
  
  // Layer Control Actions
  setPdfContentVisible: (visible: boolean) => void;
  setPdfContentOpacity: (opacity: number) => void;
  setAnnotationLayerVisible: (visible: boolean) => void;
  setAnnotationLayerOpacity: (opacity: number) => void;
  setFormLayerVisible: (visible: boolean) => void;
  setFormLayerOpacity: (opacity: number) => void;
  
  // Password Protection Actions
  setIsPasswordProtected: (isProtected: boolean) => void;
  incrementPasswordAttempts: () => void;
  resetPasswordAttempts: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: PDFState = {
  fileUrl: null,
  fileName: null,
  numPages: 0,
  metadata: null,
  
  pageNumber: 1,
  scale: 1.0,
  rotation: 0,
  viewMode: 'continuous',
  
  loading: false,
  loadProgress: 0,
  loadingStage: 'downloading',
  error: null,
  errorType: 'unknown',
  retryCount: 0,
  
  showSearch: false,
  showSidebar: true,
  sidebarTab: 'thumbnails',
  isFullscreen: false,
  isMobile: false,
  
  searchText: '',
  searchResults: [],
  currentSearchIndex: 0,
  isSearching: false,
  
  toolMode: 'select',
  selectedAnnotation: null,
  annotationColor: '#FFEB3B',
  annotationOpacity: 0.5,
  showAnnotationTools: false,
  isDrawing: false,
  
  annotations: [],
  bookmarks: [],
  formFields: [],
  
  annotationHistory: [],
  historyIndex: -1,
  canUndo: false,
  canRedo: false,
  
  renderQuality: 2,
  enableTextLayer: true,
  enableAnnotationLayer: true,
  cacheSize: 50,
  
  pdfContentVisible: true,
  pdfContentOpacity: 1.0,
  annotationLayerVisible: true,
  annotationLayerOpacity: 1.0,
  formLayerVisible: true,
  formLayerOpacity: 1.0,
  
  isPasswordProtected: false,
  passwordAttempts: 0,
};

// ============================================================================
// Store Implementation
// ============================================================================

export const usePDFStore = create<PDFState & PDFActions>()(
  devtools(
    persist(
      immer((set, get) => ({
        ...initialState,
        
        // Document Actions
        setDocument: (fileUrl, fileName) => set((state) => {
          state.fileUrl = fileUrl;
          state.fileName = fileName;
          state.pageNumber = 1;
          state.error = null;
          state.retryCount = 0;
        }),
        
        setNumPages: (numPages) => set((state) => {
          state.numPages = numPages;
        }),
        
        setMetadata: (metadata) => set((state) => {
          state.metadata = metadata;
        }),
        
        resetDocument: () => set((state) => {
          Object.assign(state, initialState);
        }),
        
        // Navigation Actions
        setPageNumber: (page) => set((state) => {
          const validPage = Math.max(1, Math.min(page, state.numPages));
          state.pageNumber = validPage;
        }),
        
        nextPage: () => set((state) => {
          if (state.pageNumber < state.numPages) {
            state.pageNumber += 1;
          }
        }),
        
        previousPage: () => set((state) => {
          if (state.pageNumber > 1) {
            state.pageNumber -= 1;
          }
        }),
        
        goToPage: (page) => {
          get().setPageNumber(page);
        },
        
        // View Actions
        setScale: (scale) => set((state) => {
          state.scale = Math.max(0.25, Math.min(scale, 4.0));
        }),
        
        zoomIn: () => set((state) => {
          state.scale = Math.min(state.scale + 0.25, 4.0);
        }),
        
        zoomOut: () => set((state) => {
          state.scale = Math.max(state.scale - 0.25, 0.25);
        }),
        
        resetZoom: () => set((state) => {
          state.scale = 1.0;
        }),
        
        setRotation: (rotation) => set((state) => {
          state.rotation = rotation % 360;
        }),
        
        rotate: (degrees) => set((state) => {
          state.rotation = (state.rotation + degrees) % 360;
        }),
        
        setViewMode: (mode) => set((state) => {
          state.viewMode = mode;
        }),
        
        // Loading & Error Actions
        setLoading: (loading) => set((state) => {
          state.loading = loading;
        }),
        
        setLoadProgress: (progress) => set((state) => {
          state.loadProgress = Math.max(0, Math.min(progress, 100));
        }),
        
        setLoadingStage: (stage) => set((state) => {
          state.loadingStage = stage;
        }),
        
        setError: (error, type = 'unknown') => set((state) => {
          state.error = error;
          state.errorType = type;
          state.loading = false;
        }),
        
        incrementRetry: () => set((state) => {
          state.retryCount += 1;
        }),
        
        resetRetry: () => set((state) => {
          state.retryCount = 0;
        }),
        
        // UI Actions
        toggleSearch: () => set((state) => {
          state.showSearch = !state.showSearch;
        }),
        
        setShowSearch: (show) => set((state) => {
          state.showSearch = show;
        }),
        
        toggleSidebar: () => set((state) => {
          state.showSidebar = !state.showSidebar;
        }),
        
        setShowSidebar: (show) => set((state) => {
          state.showSidebar = show;
        }),
        
        setSidebarTab: (tab) => set((state) => {
          state.sidebarTab = tab;
          state.showSidebar = true;
        }),
        
        setFullscreen: (fullscreen) => set((state) => {
          state.isFullscreen = fullscreen;
        }),
        
        setIsMobile: (isMobile) => set((state) => {
          state.isMobile = isMobile;
          if (isMobile) {
            state.showSidebar = false;
          }
        }),
        
        // Search Actions
        setSearchText: (text) => set((state) => {
          state.searchText = text;
        }),
        
        setSearchResults: (results) => set((state) => {
          state.searchResults = results;
          state.currentSearchIndex = results.length > 0 ? 0 : -1;
        }),
        
        setCurrentSearchIndex: (index) => set((state) => {
          state.currentSearchIndex = index;
        }),
        
        setIsSearching: (searching) => set((state) => {
          state.isSearching = searching;
        }),
        
        nextSearchResult: () => set((state) => {
          if (state.searchResults.length > 0) {
            state.currentSearchIndex = (state.currentSearchIndex + 1) % state.searchResults.length;
          }
        }),
        
        previousSearchResult: () => set((state) => {
          if (state.searchResults.length > 0) {
            state.currentSearchIndex = 
              state.currentSearchIndex === 0 
                ? state.searchResults.length - 1 
                : state.currentSearchIndex - 1;
          }
        }),
        
        clearSearch: () => set((state) => {
          state.searchText = '';
          state.searchResults = [];
          state.currentSearchIndex = 0;
          state.isSearching = false;
        }),
        
        // Tool Actions
        setToolMode: (mode) => set((state) => {
          state.toolMode = mode;
        }),
        
        setSelectedAnnotation: (id) => set((state) => {
          state.selectedAnnotation = id;
        }),
        
        setAnnotationColor: (color) => set((state) => {
          state.annotationColor = color;
        }),
        
        setAnnotationOpacity: (opacity) => set((state) => {
          state.annotationOpacity = Math.max(0, Math.min(opacity, 1));
        }),
        
        toggleAnnotationTools: () => set((state) => {
          state.showAnnotationTools = !state.showAnnotationTools;
        }),
        
        setIsDrawing: (drawing) => set((state) => {
          state.isDrawing = drawing;
        }),
        
        // Annotation Actions
        addAnnotation: (annotation) => set((state) => {
          const newAnnotation: Annotation = {
            ...annotation,
            id: `ann-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
          };
          
          state.annotations.push(newAnnotation);
          
          // Update history
          const newHistory = state.annotationHistory.slice(0, state.historyIndex + 1);
          newHistory.push([...state.annotations]);
          state.annotationHistory = newHistory;
          state.historyIndex += 1;
          state.canUndo = true;
          state.canRedo = false;
        }),
        
        updateAnnotation: (id, updates) => set((state) => {
          const index = state.annotations.findIndex(ann => ann.id === id);
          if (index !== -1) {
            state.annotations[index] = { ...state.annotations[index], ...updates };
            
            // Update history
            const newHistory = state.annotationHistory.slice(0, state.historyIndex + 1);
            newHistory.push([...state.annotations]);
            state.annotationHistory = newHistory;
            state.historyIndex += 1;
            state.canUndo = true;
            state.canRedo = false;
          }
        }),
        
        deleteAnnotation: (id) => set((state) => {
          state.annotations = state.annotations.filter(ann => ann.id !== id);
          
          if (state.selectedAnnotation === id) {
            state.selectedAnnotation = null;
          }
          
          // Update history
          const newHistory = state.annotationHistory.slice(0, state.historyIndex + 1);
          newHistory.push([...state.annotations]);
          state.annotationHistory = newHistory;
          state.historyIndex += 1;
          state.canUndo = true;
          state.canRedo = false;
        }),
        
        clearAnnotations: () => set((state) => {
          state.annotations = [];
          state.selectedAnnotation = null;
          state.annotationHistory = [];
          state.historyIndex = -1;
          state.canUndo = false;
          state.canRedo = false;
        }),
        
        getPageAnnotations: (page) => {
          return get().annotations.filter(ann => ann.page === page);
        },
        
        // Bookmark Actions
        addBookmark: (page, title) => set((state) => {
          const exists = state.bookmarks.some(b => b.page === page);
          if (!exists) {
            state.bookmarks.push({ page, title, timestamp: Date.now() });
            state.bookmarks.sort((a, b) => a.page - b.page);
          }
        }),
        
        removeBookmark: (page) => set((state) => {
          state.bookmarks = state.bookmarks.filter(b => b.page !== page);
        }),
        
        toggleBookmark: (page) => {
          const state = get();
          if (state.isPageBookmarked(page)) {
            state.removeBookmark(page);
          } else {
            state.addBookmark(page, `Sayfa ${page}`);
          }
        },
        
        isPageBookmarked: (page) => {
          return get().bookmarks.some(b => b.page === page);
        },
        
        clearBookmarks: () => set((state) => {
          state.bookmarks = [];
        }),
        
        // Form Actions
        addFormField: (field) => set((state) => {
          const newField: FormField = {
            ...field,
            id: `form-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          };
          state.formFields.push(newField);
        }),
        
        updateFormField: (id, updates) => set((state) => {
          const index = state.formFields.findIndex(f => f.id === id);
          if (index !== -1) {
            state.formFields[index] = { ...state.formFields[index], ...updates };
          }
        }),
        
        deleteFormField: (id) => set((state) => {
          state.formFields = state.formFields.filter(f => f.id !== id);
        }),
        
        clearFormFields: () => set((state) => {
          state.formFields = [];
        }),
        
        // History Actions
        undo: () => set((state) => {
          if (state.historyIndex > 0) {
            state.historyIndex -= 1;
            state.annotations = [...(state.annotationHistory[state.historyIndex] || [])];
            state.canUndo = state.historyIndex > 0;
            state.canRedo = true;
          }
        }),
        
        redo: () => set((state) => {
          if (state.historyIndex < state.annotationHistory.length - 1) {
            state.historyIndex += 1;
            state.annotations = [...state.annotationHistory[state.historyIndex]];
            state.canUndo = true;
            state.canRedo = state.historyIndex < state.annotationHistory.length - 1;
          }
        }),
        
        // Performance Actions
        setRenderQuality: (quality) => set((state) => {
          state.renderQuality = Math.max(1, Math.min(quality, 4));
        }),
        
        setEnableTextLayer: (enable) => set((state) => {
          state.enableTextLayer = enable;
        }),
        
        setEnableAnnotationLayer: (enable) => set((state) => {
          state.enableAnnotationLayer = enable;
        }),
        
        setCacheSize: (size) => set((state) => {
          state.cacheSize = Math.max(10, Math.min(size, 200));
        }),
        
        // Layer Control Actions
        setPdfContentVisible: (visible) => set((state) => {
          state.pdfContentVisible = visible;
        }),
        
        setPdfContentOpacity: (opacity) => set((state) => {
          state.pdfContentOpacity = Math.max(0, Math.min(opacity, 1));
        }),
        
        setAnnotationLayerVisible: (visible) => set((state) => {
          state.annotationLayerVisible = visible;
        }),
        
        setAnnotationLayerOpacity: (opacity) => set((state) => {
          state.annotationLayerOpacity = Math.max(0, Math.min(opacity, 1));
        }),
        
        setFormLayerVisible: (visible) => set((state) => {
          state.formLayerVisible = visible;
        }),
        
        setFormLayerOpacity: (opacity) => set((state) => {
          state.formLayerOpacity = Math.max(0, Math.min(opacity, 1));
        }),
        
        // Password Protection Actions
        setIsPasswordProtected: (isProtected) => set((state) => {
          state.isPasswordProtected = isProtected;
        }),
        
        incrementPasswordAttempts: () => set((state) => {
          state.passwordAttempts += 1;
        }),
        
        resetPasswordAttempts: () => set((state) => {
          state.passwordAttempts = 0;
        }),
      })),
      {
        name: 'pdf-viewer-storage',
        partialize: (state) => ({
          // Only persist user preferences, not document state
          viewMode: state.viewMode,
          scale: state.scale,
          showSidebar: state.showSidebar,
          sidebarTab: state.sidebarTab,
          annotationColor: state.annotationColor,
          annotationOpacity: state.annotationOpacity,
          renderQuality: state.renderQuality,
          enableTextLayer: state.enableTextLayer,
          enableAnnotationLayer: state.enableAnnotationLayer,
          cacheSize: state.cacheSize,
        }),
      }
    ),
    { name: 'PDFStore' }
  )
);

// ============================================================================
// Selectors (for performance optimization)
// ============================================================================

export const selectDocumentInfo = (state: PDFState & PDFActions) => ({
  fileUrl: state.fileUrl,
  fileName: state.fileName,
  numPages: state.numPages,
  metadata: state.metadata,
});

export const selectViewState = (state: PDFState & PDFActions) => ({
  pageNumber: state.pageNumber,
  scale: state.scale,
  rotation: state.rotation,
  viewMode: state.viewMode,
});

export const selectSearchState = (state: PDFState & PDFActions) => ({
  searchText: state.searchText,
  searchResults: state.searchResults,
  currentSearchIndex: state.currentSearchIndex,
  isSearching: state.isSearching,
});

export const selectAnnotationState = (state: PDFState & PDFActions) => ({
  annotations: state.annotations,
  selectedAnnotation: state.selectedAnnotation,
  toolMode: state.toolMode,
  annotationColor: state.annotationColor,
  annotationOpacity: state.annotationOpacity,
  canUndo: state.canUndo,
  canRedo: state.canRedo,
});
