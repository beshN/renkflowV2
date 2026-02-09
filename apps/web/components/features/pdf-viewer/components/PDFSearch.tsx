'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePDFStore } from '@/stores/usePDFStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { Search, X, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import { pdfjs } from 'react-pdf';
import type { SearchResult } from '@/stores/usePDFStore';

interface PDFSearchProps {
  className?: string;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const PDFSearch: React.FC<PDFSearchProps> = ({ className }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pdfDocument, setPdfDocument] = useState<any>(null);
  const [flatMatches, setFlatMatches] = useState<Array<{ page: number }>>([]);
  const pageTextCacheRef = useRef<Map<number, string>>(new Map());
  const searchJobIdRef = useRef(0);
  
  const fileUrl = usePDFStore((state) => state.fileUrl);
  const numPages = usePDFStore((state) => state.numPages);
  const searchText = usePDFStore((state) => state.searchText);
  const searchResults = usePDFStore((state) => state.searchResults);
  const currentSearchIndex = usePDFStore((state) => state.currentSearchIndex);
  const isSearching = usePDFStore((state) => state.isSearching);
  const showSearch = usePDFStore((state) => state.showSearch);
  
  const setSearchText = usePDFStore((state) => state.setSearchText);
  const setSearchResults = usePDFStore((state) => state.setSearchResults);
  const setCurrentSearchIndex = usePDFStore((state) => state.setCurrentSearchIndex);
  const setIsSearching = usePDFStore((state) => state.setIsSearching);
  const clearSearch = usePDFStore((state) => state.clearSearch);
  const goToPage = usePDFStore((state) => state.goToPage);
  const setShowSearch = usePDFStore((state) => state.setShowSearch);
  
  // Load PDF document for text extraction
  useEffect(() => {
    setPdfDocument(null);
    setFlatMatches([]);
    pageTextCacheRef.current.clear();
    searchJobIdRef.current += 1;

    if (!fileUrl) return;
    
    let isCancelled = false;
    const loadDocument = async () => {
      const loadingTask = pdfjs.getDocument(fileUrl);
      try {
        const pdf = await loadingTask.promise;
        if (!isCancelled) {
          setPdfDocument(pdf);
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('Failed to load PDF for search:', error);
        }
      }

      return loadingTask;
    };

    const loadingTaskPromise = loadDocument();

    return () => {
      isCancelled = true;
      loadingTaskPromise.then((task) => {
        task?.destroy?.();
      }).catch(() => {
        // no-op
      });
    };
  }, [fileUrl]);

  useEffect(() => {
    if (!showSearch) {
      return;
    }
    if (searchText.length < 2) {
      setSearchResults([]);
      setFlatMatches([]);
      setCurrentSearchIndex(0);
    }
  }, [searchText, showSearch, setSearchResults, setCurrentSearchIndex]);

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim() || !pdfDocument || numPages === 0) {
      setSearchResults([]);
      setFlatMatches([]);
      setCurrentSearchIndex(0);
      return;
    }

    const currentJobId = ++searchJobIdRef.current;
    setIsSearching(true);

    const groupedResults: SearchResult[] = [];
    const matches: Array<{ page: number }> = [];
    const regex = new RegExp(escapeRegex(query), 'gi');

    try {
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        if (currentJobId !== searchJobIdRef.current) return;

        let pageText = pageTextCacheRef.current.get(pageNum);
        if (pageText === undefined) {
          const page = await pdfDocument.getPage(pageNum);
          const textContent = await page.getTextContent();
          const extractedText = textContent.items.map((item: any) => item.str || '').join(' ');
          pageTextCacheRef.current.set(pageNum, extractedText);
          pageText = extractedText;
        }
        const textToSearch = pageText ?? '';

        const pageMatches: SearchResult['items'] = [];
        regex.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(textToSearch)) !== null) {
          pageMatches.push({
            text: match[0],
            index: match.index,
            rect: [0, 0, 0, 0],
          });
          matches.push({ page: pageNum });
        }

        if (pageMatches.length > 0) {
          groupedResults.push({
            page: pageNum,
            matches: pageMatches.length,
            items: pageMatches,
          });
        }
      }

      if (currentJobId !== searchJobIdRef.current) return;
      setSearchResults(groupedResults);
      setFlatMatches(matches);

      if (matches.length > 0) {
        setCurrentSearchIndex(0);
        goToPage(matches[0].page);
      } else {
        setCurrentSearchIndex(0);
      }
    } catch (error) {
      if (currentJobId === searchJobIdRef.current) {
        console.error('Search error:', error);
      }
    } finally {
      if (currentJobId === searchJobIdRef.current) {
        setIsSearching(false);
      }
    }
  }, [
    pdfDocument,
    numPages,
    setSearchResults,
    setFlatMatches,
    setCurrentSearchIndex,
    setIsSearching,
    goToPage,
  ]);
  
  // Focus input when search panel opens
  useEffect(() => {
    if (showSearch && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showSearch]);
  
  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchText.length >= 2) {
        performSearch(searchText);
      } else {
        setSearchResults([]);
        setFlatMatches([]);
        setCurrentSearchIndex(0);
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchText, performSearch, setSearchResults, setCurrentSearchIndex]);
  
  // Handle navigation to search result
  const handleNavigateToResult = useCallback((index: number) => {
    if (flatMatches.length === 0) return;

    const boundedIndex = Math.max(0, Math.min(index, flatMatches.length - 1));
    const result = flatMatches[boundedIndex];
    if (!result) return;

    setCurrentSearchIndex(boundedIndex);
    goToPage(result.page);
  }, [flatMatches, goToPage, setCurrentSearchIndex]);

  const handleNext = useCallback(() => {
    if (flatMatches.length === 0) return;
    const nextIndex = (currentSearchIndex + 1) % flatMatches.length;
    handleNavigateToResult(nextIndex);
  }, [currentSearchIndex, flatMatches.length, handleNavigateToResult]);

  const handlePrevious = useCallback(() => {
    if (flatMatches.length === 0) return;
    const newIndex = currentSearchIndex === 0 ? flatMatches.length - 1 : currentSearchIndex - 1;
    handleNavigateToResult(newIndex);
  }, [currentSearchIndex, flatMatches.length, handleNavigateToResult]);

  const handleClose = useCallback(() => {
    setShowSearch(false);
    clearSearch();
    setFlatMatches([]);
    setCurrentSearchIndex(0);
    searchJobIdRef.current += 1;
  }, [setShowSearch, clearSearch, setCurrentSearchIndex]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        handlePrevious();
      } else {
        handleNext();
      }
      e.preventDefault();
    } else if (e.key === 'Escape') {
      handleClose();
    }
  }, [handleNext, handlePrevious, handleClose]);

  const totalMatches = flatMatches.length;
  const currentMatchNumber = totalMatches > 0 ? Math.min(currentSearchIndex + 1, totalMatches) : 0;
  
  if (!showSearch) return null;
  
  return (
    <div className={cn(
      'bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-3',
      className
    )}>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2">
          {/* Search Icon */}
          <Search className="h-5 w-5 text-slate-400 flex-shrink-0" />
          
          {/* Search Input */}
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              type="text"
              placeholder="PDF içinde ara... (En az 2 karakter)"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pr-20 h-9"
            />
            
            {/* Search Status */}
            {searchText && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                ) : totalMatches > 0 ? (
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    {currentMatchNumber} / {totalMatches}
                  </span>
                ) : searchText.length >= 2 ? (
                  <span className="text-xs text-red-500">Sonuç yok</span>
                ) : null}
              </div>
            )}
          </div>
          
          {/* Navigation Buttons */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevious}
              disabled={totalMatches === 0 || isSearching}
              title="Önceki (Shift+Enter)"
              className="h-9 w-9"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              disabled={totalMatches === 0 || isSearching}
              title="Sonraki (Enter)"
              className="h-9 w-9"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Close Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            title="Kapat (Esc)"
            className="h-9 w-9"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Search Results Summary */}
        {searchText.length >= 2 && !isSearching && searchResults.length > 0 && (
          <div className="mt-2 text-xs text-slate-500">
            {searchResults.length} sayfada {totalMatches} sonuç bulundu
          </div>
        )}
      </div>
    </div>
  );
};

export default PDFSearch;
