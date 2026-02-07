'use client';

import React from 'react';
import { usePDFStore } from '@/stores/usePDFStore';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import {
  FileText,
  Bookmark,
  BookmarkCheck,
  Highlighter,
  Layers,
  X,
} from 'lucide-react';
import type { SidebarTab } from '@/stores/usePDFStore';
import { LayersPanel } from './LayersPanel';

interface PDFSidebarProps {
  className?: string;
  onThumbnailClick?: (page: number) => void;
}

export const PDFSidebar: React.FC<PDFSidebarProps> = ({
  className,
  onThumbnailClick,
}) => {
  const showSidebar = usePDFStore((state) => state.showSidebar);
  const sidebarTab = usePDFStore((state) => state.sidebarTab);
  const pageNumber = usePDFStore((state) => state.pageNumber);
  const numPages = usePDFStore((state) => state.numPages);
  const bookmarks = usePDFStore((state) => state.bookmarks);
  const annotations = usePDFStore((state) => state.annotations);
  const formFields = usePDFStore((state) => state.formFields);
  const selectedAnnotation = usePDFStore((state) => state.selectedAnnotation);
  const enableAnnotationLayer = usePDFStore((state) => state.enableAnnotationLayer);
  
  const setShowSidebar = usePDFStore((state) => state.setShowSidebar);
  const setSidebarTab = usePDFStore((state) => state.setSidebarTab);
  const goToPage = usePDFStore((state) => state.goToPage);
  const removeBookmark = usePDFStore((state) => state.removeBookmark);
  const deleteAnnotation = usePDFStore((state) => state.deleteAnnotation);
  const setSelectedAnnotation = usePDFStore((state) => state.setSelectedAnnotation);
  const setEnableAnnotationLayer = usePDFStore((state) => state.setEnableAnnotationLayer);
  
  if (!showSidebar) return null;
  
  const tabs: { id: SidebarTab; icon: any; label: string; count?: number }[] = [
    { id: 'thumbnails', icon: FileText, label: 'Sayfalar', count: numPages },
    { id: 'bookmarks', icon: Bookmark, label: 'Yer İmleri', count: bookmarks.length },
    { id: 'annotations', icon: Highlighter, label: 'Açıklamalar', count: annotations.length },
    { id: 'layers', icon: Layers, label: 'Katmanlar' },
  ];
  
  return (
    <aside className={cn(
      'w-64 bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col',
      className
    )}>
      {/* Tabs Header */}
      <div className="flex items-center border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setSidebarTab(tab.id)}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs font-medium transition-colors relative',
                sidebarTab === tab.id
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="truncate max-w-full px-1">{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={cn(
                  'absolute top-1 right-1 text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-semibold',
                  sidebarTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                )}>
                  {tab.count > 99 ? '99+' : tab.count}
                </span>
              )}
            </button>
          );
        })}
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowSidebar(false)}
          className="h-10 w-10 flex-shrink-0"
          title="Kenar Çubuğunu Gizle"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* Thumbnails Tab */}
        {sidebarTab === 'thumbnails' && (
          <div className="space-y-3">
            {Array.from({ length: numPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => {
                  goToPage(page);
                  onThumbnailClick?.(page);
                }}
                className={cn(
                  'w-full p-2 rounded-lg border-2 transition-all hover:border-blue-400 dark:hover:border-blue-600',
                  page === pageNumber
                    ? 'border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-950/30'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                )}
              >
                <div className="aspect-[8.5/11] bg-white dark:bg-slate-800 rounded shadow-sm mb-2 flex items-center justify-center text-slate-400">
                  <FileText className="h-8 w-8" />
                </div>
                <div className="text-xs font-medium text-center">
                  Sayfa {page}
                </div>
              </button>
            ))}
          </div>
        )}
        
        {/* Bookmarks Tab */}
        {sidebarTab === 'bookmarks' && (
          <div className="space-y-2">
            {bookmarks.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Bookmark className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium mb-1">Henüz yer imi yok</p>
                <p className="text-xs">Ctrl+B ile ekleyin</p>
              </div>
            ) : (
              bookmarks.map((bookmark) => (
                <div
                  key={bookmark.page}
                  className={cn(
                    'group flex items-start gap-2 p-3 rounded-lg transition-colors cursor-pointer',
                    bookmark.page === pageNumber
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                  )}
                  onClick={() => goToPage(bookmark.page)}
                >
                  <BookmarkCheck className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{bookmark.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Sayfa {bookmark.page}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e: React.MouseEvent<HTMLElement>) => {
                      e.stopPropagation();
                      removeBookmark(bookmark.page);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        )}
        
        {/* Annotations Tab */}
        {sidebarTab === 'annotations' && (
          <div className="space-y-2">
            {annotations.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Highlighter className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium mb-1">Henüz açıklama yok</p>
                <p className="text-xs">Araç çubuğundan ekleyin</p>
              </div>
            ) : (
              annotations.map((annotation) => (
                <div
                  key={annotation.id}
                  className={cn(
                    'group flex items-start gap-2 p-3 rounded-lg transition-colors cursor-pointer',
                    selectedAnnotation === annotation.id
                      ? 'bg-blue-100 dark:bg-blue-900/30 ring-2 ring-blue-500'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                  )}
                  onClick={() => {
                    setSelectedAnnotation(annotation.id);
                    goToPage(annotation.page);
                  }}
                >
                  <div
                    className="w-5 h-5 rounded flex-shrink-0 mt-0.5 border border-slate-300 dark:border-slate-600"
                    style={{ 
                      backgroundColor: annotation.color,
                      opacity: annotation.opacity 
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-slate-500 uppercase">
                        {annotation.type}
                      </span>
                      <span className="text-xs text-slate-400">
                        Sayfa {annotation.page}
                      </span>
                    </div>
                    {annotation.text && (
                      <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">
                        {annotation.text}
                      </p>
                    )}
                    {annotation.author && (
                      <p className="text-xs text-slate-400 mt-1">
                        {annotation.author}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                    onClick={(e: React.MouseEvent<HTMLElement>) => {
                      e.stopPropagation();
                      deleteAnnotation(annotation.id);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        )}
        
        {/* Layers Tab */}
        {sidebarTab === 'layers' && <LayersPanel />}
      </div>
    </aside>
  );
};

export default PDFSidebar;
