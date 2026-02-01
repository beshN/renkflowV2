'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePDFStore } from '@/stores/usePDFStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { Search, X, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import { pdfjs } from 'react-pdf';

interface PDFSearchProps {
  className?: string;
}

export const PDFSearch: React.FC<PDFSearchProps> = ({ className }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pdfDocument, setPdfDocument] = useState<any>(null);
  
  const fileUrl = usePDFStore((state) => state.fileUrl);
  const numPages = usePDFStore((state) => state.numPages);
  const searchText = usePDFStore((state) => state.searchText);
  const searchResults = usePDFStore((state) => state.searchResults);
  const currentSearchIndex = usePDFStore((state) => state.currentSearchIndex);
  const isSearching = usePDFStore((state) => state.isSearching);
  const showSearch = usePDFStore((state) => state.showSearch);
  
  const setSearchText = usePDFStore((state) => state.setSearchText);
  const setSearchResults = usePDFStore((state) => state.setSearchResults);
  const setIsSearching = usePDFStore((state) => state.setIsSearching);
  const nextSearchResult = usePDFStore((state) => state.nextSearchResult);
  const previousSearchResult = usePDFStore((state) => state.previousSearchResult);
  const clearSearch = usePDFStore((state) => state.clearSearch);
  const goToPage = usePDFStore((state) => state.goToPage);
  const setShowSearch = usePDFStore((state) => state.setShowSearch);
  
  // Load PDF document for text extraction
  useEffect(() => {
    if (!fileUrl) return;
    
    const loadDocument = async () => {
      try {
        const loadingTask = pdfjs.getDocument(fileUrl);
        const pdf = await loadingTask.promise;
        setPdfDocument(pdf);
      } catch (error) {
        console.error('Failed to load PDF for search:', error);
      }
    };
    
    loadDocument();
  }, [fileUrl]);
  
  // Focus input when search panel opens
  useEffect(() => {
    if (showSearch && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showSearch]);
  
  // Perform search across all pages
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim() || !pdfDocument || numPages === 0) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    const results: any[] = [];
    
    try {
      // Search through all pages
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Extract text items
        const textItems = textContent.items.map((item: any) => ({
          text: item.str,
          transform: item.transform,
        }));
        
        // Combine text
        const pageText = textItems.map((item: any) => item.text).join(' ');
        
        // Find matches (case-insensitive)
        const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const matches = [...pageText.matchAll(regex)];
        
        if (matches.length > 0) {
          const pageMatches = matches.map((match, index) => ({
            text: match[0],
            index: match.index || 0,
            rect: [0, 0, 0, 0] as [number, number, number, number], // Simplified for now
          }));
          
          results.push({
            page: pageNum,
            matches: matches.length,
            items: pageMatches,
          });
        }
      }
      
      setSearchResults(results);
      
      // Navigate to first result
      if (results.length > 0) {
        goToPage(results[0].page);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  }, [pdfDocument, numPages, setSearchResults, setIsSearching, goToPage]);
  
  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchText.length >= 2) {
        performSearch(searchText);
      } else {
        setSearchResults([]);
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchText, performSearch, setSearchResults]);
  
  // Handle navigation to search result
  const handleNavigateToResult = useCallback((index: number) => {
    if (searchResults.length === 0) return;
    
    const result = searchResults[index];
    if (result) {
      goToPage(result.page);
    }
  }, [searchResults, goToPage]);
  
  // Navigate to next result
  const handleNext = useCallback(() => {
    nextSearchResult();
    handleNavigateToResult(currentSearchIndex + 1 >= searchResults.length ? 0 : currentSearchIndex + 1);
  }, [nextSearchResult, handleNavigateToResult, currentSearchIndex, searchResults.length]);
  
  // Navigate to previous result
  const handlePrevious = useCallback(() => {
    const newIndex = currentSearchIndex === 0 ? searchResults.length - 1 : currentSearchIndex - 1;
    previousSearchResult();
    handleNavigateToResult(newIndex);
  }, [previousSearchResult, handleNavigateToResult, currentSearchIndex, searchResults.length]);
  
  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        handlePrevious();
      } else {
        handleNext();
      }
      e.preventDefault();
    } else if (e.key === 'Escape') {
      setShowSearch(false);
      clearSearch();
    }
  }, [handleNext, handlePrevious, setShowSearch, clearSearch]);
  
  const totalMatches = searchResults.reduce((sum, result) => sum + result.matches, 0);
  
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
                    {currentSearchIndex + 1} / {totalMatches}
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
              disabled={searchResults.length === 0 || isSearching}
              title="Önceki (Shift+Enter)"
              className="h-9 w-9"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              disabled={searchResults.length === 0 || isSearching}
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
            onClick={() => {
              setShowSearch(false);
              clearSearch();
            }}
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
