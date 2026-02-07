export interface DocumentFile {
  id: string;
  name: string;
  size: string;
  type: 'pdf' | 'img' | 'doc';
  pageCount: number;
  thumbnailUrl: string;
  pages: string[]; // Changed from contentUrl to support multiple pages
  searchUrl?: string; // Optional highlight view
}

export type ViewState = 'dashboard' | 'loading' | 'error' | 'viewer';

export type SidebarMode = 'none' | 'thumbnails' | 'search';

export interface ViewerState {
  file: DocumentFile | null;
  zoom: number;
  currentPage: number;
  sidebarMode: SidebarMode;
  searchQuery: string;
}
