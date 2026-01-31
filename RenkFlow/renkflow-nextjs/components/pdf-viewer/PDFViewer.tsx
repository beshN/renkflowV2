'use client'

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'
import 'react-pdf/dist/esm/Page/TextLayer.css'

// Set up PDF.js worker with fallback
if (typeof window !== 'undefined') {
  // Hardcoded version to ensure match with installed pdfjs-dist
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.9.155/build/pdf.worker.min.mjs`
}

interface PDFViewerProps {
  fileUrl: string
  fileName: string
  onClose: () => void
}

interface BookmarkItem {
  page: number
  title: string
  timestamp: number
}

type ViewMode = 'single' | 'continuous' | 'two-page'

// Custom hook for local storage with SSR safety
function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key)
      if (item) {
        setStoredValue(JSON.parse(item))
      }
    } catch {
      // Ignore errors
    }
    setIsHydrated(true)
  }, [key])

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setStoredValue(prev => {
      const newValue = value instanceof Function ? value(prev) : value
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(key, JSON.stringify(newValue))
        } catch {
          // Quota exceeded or other error
        }
      }
      return newValue
    })
  }, [key])

  return [isHydrated ? storedValue : initialValue, setValue]
}

// Custom hook for debounce
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// Throttle function with proper typing
// Throttle function with proper typing
function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false
  let lastArgs: Parameters<T> | null = null

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
        if (lastArgs) {
          func(...lastArgs)
          lastArgs = null
        }
      }, limit)
    } else {
      lastArgs = args
    }
  }
}

export default function PDFViewer({
  fileUrl,
  fileName,
}: PDFViewerProps) {
  // Core state
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [scale, setScale] = useState<number>(1.0)
  const [rotation, setRotation] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadProgress, setLoadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  // UI state
  const [showSearch, setShowSearch] = useState(false)
  const [showThumbnails, setShowThumbnails] = useState(true)
  const [showBookmarks, setShowBookmarks] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [pageInputValue, setPageInputValue] = useState('1')
  const [isMobile, setIsMobile] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('continuous')

  // Download/Print state
  const [isDownloading, setIsDownloading] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)

  // Search state
  const [searchText, setSearchText] = useState('')
  const [searchResults, setSearchResults] = useState<{page: number, matches: number}[]>([])
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0)
  const [isSearching, setIsSearching] = useState(false)
  const debouncedSearchText = useDebounce(searchText, 300)

  // Bookmarks
  const [bookmarks, setBookmarks] = useLocalStorage<BookmarkItem[]>(`pdf-bookmarks-${fileName}`, [])

  // Copy state
  const [copied, setCopied] = useState(false)

  // Refs
  const containerRef = useRef<HTMLDivElement>(null)
  const mainContentRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const pdfDocRef = useRef<pdfjs.PDFDocumentProxy | null>(null)
  const printIframeRef = useRef<HTMLIFrameElement | null>(null)

  // Touch gesture state - improved for pinch-to-zoom
  const gestureRef = useRef<{
    startDistance: number
    startScale: number
    startX: number
    startY: number
    isPinching: boolean
    lastTap: number
    touchCount: number
    isScrolling: boolean
  }>({
    startDistance: 0,
    startScale: 1,
    startX: 0,
    startY: 0,
    isPinching: false,
    lastTap: 0,
    touchCount: 0,
    isScrolling: false,
  })

  // Refs for avoiding stale closures
  const scaleRef = useRef<number>(1)
  scaleRef.current = scale

  // Check mobile
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (mobile) {
        setShowThumbnails(false)
      }
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Document load handler
  const onDocumentLoadSuccess = useCallback((pdf: any) => {
    setNumPages(pdf.numPages)
    setLoading(false)
    setLoadProgress(100)
    setError(null)
    setRetryCount(0)
  }, [])

  // Document load error handler with retry logic
  const onDocumentLoadError = useCallback((err: Error) => {
    console.error('PDF load error:', err)
    setLoading(false)
    
    // Provide user-friendly error messages
    let errorMessage = 'Failed to load PDF'
    if (err.message.includes('network') || err.message.includes('fetch')) {
      errorMessage = 'Network error. Please check your connection.'
    } else if (err.message.includes('password')) {
      errorMessage = 'This PDF is password protected.'
    } else if (err.message.includes('corrupt') || err.message.includes('Invalid')) {
      errorMessage = 'The PDF file appears to be corrupted.'
    } else {
        // Show detailed error for debugging
        errorMessage = `Load Error: ${err.message}`
    }
    
    setError(errorMessage)
  }, [])

  // Load progress handler
  const onLoadProgress = useCallback(({ loaded, total }: { loaded: number; total: number }) => {
    if (total > 0) {
      setLoadProgress(Math.round((loaded / total) * 100))
    } else if (loaded > 0) {
      // If total is unknown, show indeterminate progress
      setLoadProgress(Math.min(loaded / 1000, 99))
    }
  }, [])

  // Retry loading
  const handleRetry = useCallback(() => {
    setError(null)
    setLoading(true)
    setLoadProgress(0)
    setRetryCount(prev => prev + 1)
  }, [])

  // Zoom handlers - optimized without animation to avoid complexity
  const handleZoomTo = useCallback((value: number) => {
    const clampedValue = Math.max(0.25, Math.min(4.0, value))
    setScale(clampedValue)
  }, [])

  const handleZoomIn = useCallback(() => {
    handleZoomTo(scaleRef.current + 0.25)
  }, [handleZoomTo])

  const handleZoomOut = useCallback(() => {
    handleZoomTo(scaleRef.current - 0.25)
  }, [handleZoomTo])

  const handleZoomReset = useCallback(() => {
    handleZoomTo(1.0)
  }, [handleZoomTo])

  // Fit to width
  const handleFitWidth = useCallback(() => {
    if (mainContentRef.current) {
      const containerWidth = mainContentRef.current.clientWidth - 64
      const pageWidth = 612
      const newScale = containerWidth / pageWidth
      handleZoomTo(newScale)
    }
  }, [handleZoomTo])

  // Fit to page
  const handleFitPage = useCallback(() => {
    if (mainContentRef.current) {
      const containerWidth = mainContentRef.current.clientWidth - 64
      const containerHeight = mainContentRef.current.clientHeight - 64
      const pageWidth = 612
      const pageHeight = 792
      const scaleW = containerWidth / pageWidth
      const scaleH = containerHeight / pageHeight
      handleZoomTo(Math.min(scaleW, scaleH))
    }
  }, [handleZoomTo])

  // Rotation handlers
  const handleRotate = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360)
  }, [])

  const handleRotateBack = useCallback(() => {
    setRotation((prev) => (prev - 90 + 360) % 360)
  }, [])

  // Fullscreen handlers
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen()
        setIsFullscreen(true)
      } else {
        await document.exitFullscreen()
        setIsFullscreen(false)
      }
    } catch (err) {
      console.error('Fullscreen error:', err)
    }
  }, [])

  // Improved Print handler - robust cross-browser solution
  const handlePrint = useCallback(async () => {
    if (isPrinting) return
    
    setIsPrinting(true)
    
    try {
      // Method 1: Try using the built-in print for PDFs
      // Create a hidden iframe for printing
      if (printIframeRef.current) {
        document.body.removeChild(printIframeRef.current)
      }
      
      const iframe = document.createElement('iframe')
      iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
      document.body.appendChild(iframe)
      printIframeRef.current = iframe
      
      // Set the source
      iframe.src = fileUrl
      
      // Wait for load and print
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Print timeout'))
        }, 30000)
        
        iframe.onload = () => {
          clearTimeout(timeout)
          setTimeout(() => {
            try {
              iframe.contentWindow?.focus()
              iframe.contentWindow?.print()
              resolve()
            } catch (e) {
              // Fallback: open in new window for printing
              const printWindow = window.open(fileUrl, '_blank')
              if (printWindow) {
                printWindow.onload = () => {
                  printWindow.print()
                }
              }
              resolve()
            }
          }, 500)
        }
        
        iframe.onerror = () => {
          clearTimeout(timeout)
          reject(new Error('Failed to load PDF for printing'))
        }
      })
      
      // Clean up after printing dialog closes
      setTimeout(() => {
        if (printIframeRef.current) {
          document.body.removeChild(printIframeRef.current)
          printIframeRef.current = null
        }
      }, 1000)
      
    } catch (err) {
      console.error('Print error:', err)
      // Final fallback: open in new tab
      window.open(fileUrl, '_blank')
    } finally {
      setIsPrinting(false)
    }
  }, [fileUrl, isPrinting])

  // Improved Download handler with progress tracking
  const handleDownload = useCallback(async () => {
    if (isDownloading) return
    
    setIsDownloading(true)
    setDownloadProgress(0)
    
    try {
      // Fetch with progress tracking
      const response = await fetch(fileUrl)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const contentLength = response.headers.get('content-length')
      const total = contentLength ? parseInt(contentLength, 10) : 0
      
      if (!response.body) {
        throw new Error('No response body')
      }
      
      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let loaded = 0
      
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break
        
        chunks.push(value)
        loaded += value.length
        
        if (total > 0) {
          setDownloadProgress(Math.round((loaded / total) * 100))
        } else {
          // Indeterminate progress
          setDownloadProgress(Math.min(loaded / 10000, 99))
        }
      }
      
      // Combine chunks into blob
      const blob = new Blob(chunks as any, { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      
      // Create download link
      const link = document.createElement('a')
      link.href = url
      link.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
      }, 100)
      
      setDownloadProgress(100)
      
    } catch (err) {
      console.error('Download error:', err)
      
      // Fallback: direct link download
      try {
        const link = document.createElement('a')
        link.href = fileUrl
        link.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } catch {
        // Final fallback: open in new tab
        window.open(fileUrl, '_blank')
      }
    } finally {
      setIsDownloading(false)
      setTimeout(() => setDownloadProgress(0), 1000)
    }
  }, [fileUrl, fileName, isDownloading])

  // Open in new tab
  const handleOpenInNewTab = useCallback(() => {
    window.open(fileUrl, '_blank', 'noopener,noreferrer')
  }, [fileUrl])

  // Copy link with proper fallback
  const handleCopyLink = useCallback(async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(fileUrl)
      } else {
        // Fallback for older browsers or non-secure contexts
        const textArea = document.createElement('textarea')
        textArea.value = fileUrl
        textArea.style.cssText = 'position:fixed;left:-9999px;top:-9999px;'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Copy failed:', err)
    }
  }, [fileUrl])

  // Share handler
  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: fileName,
          url: fileUrl,
        })
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          handleCopyLink()
        }
      }
    } else {
      handleCopyLink()
    }
  }, [fileName, fileUrl, handleCopyLink])

  // Page navigation - optimized
  const goToPage = useCallback((page: number) => {
    const validPage = Math.max(1, Math.min(page, numPages))
    setPageNumber(validPage)
    setPageInputValue(String(validPage))
    
    if (viewMode === 'single') {
      return
    }

    // Smooth scroll to page
    requestAnimationFrame(() => {
      const pageElement = pageRefs.current.get(validPage)
      if (pageElement) {
        pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    })
  }, [numPages, viewMode])

  const goToFirstPage = useCallback(() => goToPage(1), [goToPage])
  const goToLastPage = useCallback(() => goToPage(numPages), [goToPage, numPages])
  const goToPrevPage = useCallback(() => goToPage(pageNumber - 1), [goToPage, pageNumber])
  const goToNextPage = useCallback(() => goToPage(pageNumber + 1), [goToPage, pageNumber])

  // Page input handler
  const handlePageInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // Only allow numbers
    if (value === '' || /^\d+$/.test(value)) {
      setPageInputValue(value)
    }
  }, [])

  const handlePageInputSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const page = parseInt(pageInputValue, 10)
    if (!isNaN(page) && page >= 1 && page <= numPages) {
      goToPage(page)
    } else {
      setPageInputValue(String(pageNumber))
    }
  }, [pageInputValue, goToPage, numPages, pageNumber])

  const handlePageInputBlur = useCallback(() => {
    const page = parseInt(pageInputValue, 10)
    if (isNaN(page) || page < 1 || page > numPages) {
      setPageInputValue(String(pageNumber))
    }
  }, [pageInputValue, numPages, pageNumber])

  // Search handlers - improved with real text extraction
  const performSearch = useCallback(async () => {
    if (!debouncedSearchText.trim() || !pdfDocRef.current) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    const results: {page: number, matches: number}[] = []
    const searchLower = debouncedSearchText.toLowerCase().trim()

    try {
      const doc = pdfDocRef.current
      
      for (let i = 1; i <= numPages; i++) {
        try {
          const page = await doc.getPage(i)
          const textContent = await page.getTextContent()
          const text = textContent.items
            .map((item) => ('str' in item ? item.str : ''))
            .join(' ')
            .toLowerCase()
          
          // Escape special regex characters and create pattern
          const escapedSearch = searchLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const regex = new RegExp(escapedSearch, 'gi')
          const matches = (text.match(regex) || []).length
          
          if (matches > 0) {
            results.push({ page: i, matches })
          }
        } catch {
          // Skip pages that fail to load
          continue
        }
      }
    } catch (err) {
      console.error('Search error:', err)
    }

    setSearchResults(results)
    setCurrentSearchIndex(0)
    setIsSearching(false)

    if (results.length > 0) {
      goToPage(results[0].page)
    }
  }, [debouncedSearchText, numPages, goToPage])

  // Trigger search when debounced text changes
  useEffect(() => {
    if (debouncedSearchText) {
      performSearch()
    } else {
      setSearchResults([])
    }
  }, [debouncedSearchText, performSearch])

  const goToNextSearchResult = useCallback(() => {
    if (searchResults.length === 0) return
    const nextIndex = (currentSearchIndex + 1) % searchResults.length
    setCurrentSearchIndex(nextIndex)
    goToPage(searchResults[nextIndex].page)
  }, [searchResults, currentSearchIndex, goToPage])

  const goToPrevSearchResult = useCallback(() => {
    if (searchResults.length === 0) return
    const prevIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length
    setCurrentSearchIndex(prevIndex)
    goToPage(searchResults[prevIndex].page)
  }, [searchResults, currentSearchIndex, goToPage])

  // Bookmark handlers
  const toggleBookmark = useCallback((page: number) => {
    setBookmarks(prev => {
      const exists = prev.find(b => b.page === page)
      if (exists) {
        return prev.filter(b => b.page !== page)
      }
      return [...prev, { page, title: `Page ${page}`, timestamp: Date.now() }].sort((a, b) => a.page - b.page)
    })
  }, [setBookmarks])

  const isPageBookmarked = useCallback((page: number) => {
    return bookmarks.some(b => b.page === page)
  }, [bookmarks])

  // Handle close
  const handleClose = useCallback(() => {
    // Cleanup before closing
    if (printIframeRef.current) {
      document.body.removeChild(printIframeRef.current)
      printIframeRef.current = null
    }
    // Use history back if available, otherwise just call parent
    window.history.back()
  }, [])

  // Keyboard shortcuts - comprehensive
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur()
        }
        if (e.key === 'Enter' && e.target === searchInputRef.current) {
          e.preventDefault()
          if (searchResults.length > 0) {
            goToNextSearchResult()
          }
        }
        return
      }

      const ctrl = e.ctrlKey || e.metaKey

      switch (e.key) {
        case 'Escape':
          if (showSearch) {
            setShowSearch(false)
            setSearchText('')
            setSearchResults([])
          } else if (showBookmarks) {
            setShowBookmarks(false)
          } else if (showSettings) {
            setShowSettings(false)
          } else {
            handleClose()
          }
          break
        case 'ArrowLeft':
          if (!ctrl) {
            e.preventDefault()
            goToPrevPage()
          }
          break
        case 'ArrowRight':
          if (!ctrl) {
            e.preventDefault()
            goToNextPage()
          }
          break
        case 'ArrowUp':
          if (ctrl && searchResults.length > 0) {
            e.preventDefault()
            goToPrevSearchResult()
          }
          break
        case 'ArrowDown':
          if (ctrl && searchResults.length > 0) {
            e.preventDefault()
            goToNextSearchResult()
          }
          break
        case 'Home':
          e.preventDefault()
          goToFirstPage()
          break
        case 'End':
          e.preventDefault()
          goToLastPage()
          break
        case '+':
        case '=':
          if (ctrl) {
            e.preventDefault()
            handleZoomIn()
          }
          break
        case '-':
          if (ctrl) {
            e.preventDefault()
            handleZoomOut()
          }
          break
        case '0':
          if (ctrl) {
            e.preventDefault()
            handleZoomReset()
          }
          break
        case 'f':
          if (ctrl) {
            e.preventDefault()
            setShowSearch(true)
            setTimeout(() => searchInputRef.current?.focus(), 100)
          }
          break
        case 'r':
          if (ctrl) {
            e.preventDefault()
            handleRotate()
          }
          break
        case 'p':
          if (ctrl) {
            e.preventDefault()
            handlePrint()
          }
          break
        case 's':
          if (ctrl) {
            e.preventDefault()
            handleDownload()
          }
          break
        case 'b':
          if (ctrl) {
            e.preventDefault()
            toggleBookmark(pageNumber)
          }
          break
        case 'g':
          if (ctrl) {
            e.preventDefault()
            const pageInput = document.querySelector('input[type="text"]') as HTMLInputElement
            pageInput?.focus()
            pageInput?.select()
          }
          break
        case 'F11':
          e.preventDefault()
          toggleFullscreen()
          break
        case 't':
          if (!ctrl) {
            setShowThumbnails(prev => !prev)
          }
          break
        case 'w':
          if (ctrl) {
            e.preventDefault()
            handleFitWidth()
          }
          break
        case '1':
          if (ctrl) {
            e.preventDefault()
            handleFitPage()
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    showSearch, showBookmarks, showSettings, searchResults.length, pageNumber, searchResults,
    goToPrevPage, goToNextPage, goToFirstPage, goToLastPage,
    goToPrevSearchResult, goToNextSearchResult,
    handleZoomIn, handleZoomOut, handleZoomReset,
    handleRotate, handlePrint, handleDownload,
    toggleBookmark, toggleFullscreen, handleFitWidth, handleFitPage, handleClose
  ])

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Scroll spy for current page - optimized with IntersectionObserver
  useEffect(() => {
    if (viewMode === 'single' || loading) return

    const handleIntersection = throttle((entries: IntersectionObserverEntry[]) => {
      const visibleEntries = entries.filter(e => e.isIntersecting)
      if (visibleEntries.length > 0) {
        const mostVisible = visibleEntries.reduce((prev, curr) => 
          curr.intersectionRatio > prev.intersectionRatio ? curr : prev
        )
        const pageNum = parseInt(mostVisible.target.getAttribute('data-page') || '1', 10)
        if (pageNum !== pageNumber) {
          setPageNumber(pageNum)
          setPageInputValue(String(pageNum))
        }
      }
    }, 150)

    const observer = new IntersectionObserver(handleIntersection, { 
      threshold: [0.1, 0.3, 0.5, 0.7, 0.9], 
      rootMargin: '-10% 0px -10% 0px' 
    })

    // Observe all pages
    pageRefs.current.forEach((element) => {
      observer.observe(element)
    })

    return () => observer.disconnect()
  }, [numPages, loading, viewMode, pageNumber])

  // Mouse wheel zoom - optimized
  useEffect(() => {
    const container = mainContentRef.current
    if (!container) return

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const delta = e.deltaY > 0 ? -0.1 : 0.1
        handleZoomTo(scaleRef.current + delta)
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [handleZoomTo])

  // Touch gestures for mobile - improved pinch-to-zoom
  useEffect(() => {
    const container = mainContentRef.current
    if (!container) return

    const getDistance = (t1: Touch, t2: Touch) => {
      const dx = t1.clientX - t2.clientX
      const dy = t1.clientY - t2.clientY
      return Math.hypot(dx, dy)
    }

    const handleTouchStart = (e: TouchEvent) => {
      const gesture = gestureRef.current
      gesture.touchCount = e.touches.length

      if (e.touches.length === 2) {
        // Start pinch gesture
        gesture.isPinching = true
        gesture.isScrolling = false
        gesture.startDistance = getDistance(e.touches[0], e.touches[1])
        gesture.startScale = scaleRef.current
      } else if (e.touches.length === 1) {
        gesture.isScrolling = true
        gesture.isPinching = false
        
        // Handle double-tap
        const now = Date.now()
        const timeDiff = now - gesture.lastTap
        
        if (timeDiff < 300 && timeDiff > 0) {
          // Double tap detected
          e.preventDefault()
          if (scaleRef.current > 1.5) {
            handleZoomTo(1.0)
          } else {
            handleZoomTo(2.5)
          }
        }
        gesture.lastTap = now
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      const gesture = gestureRef.current

      if (e.touches.length === 2 && gesture.isPinching) {
        e.preventDefault()
        
        const currentDistance = getDistance(e.touches[0], e.touches[1])
        const scaleFactor = currentDistance / gesture.startDistance
        const newScale = gesture.startScale * scaleFactor
        
        // Apply scale with clamping
        const clampedScale = Math.max(0.5, Math.min(4.0, newScale))
        setScale(clampedScale)
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      const gesture = gestureRef.current
      
      if (e.touches.length < 2) {
        gesture.isPinching = false
      }
      
      if (e.touches.length === 0) {
        gesture.isScrolling = false
        
        // Snap to bounds
        const currentScale = scaleRef.current
        if (currentScale < 0.5) {
          handleZoomTo(0.5)
        } else if (currentScale > 4.0) {
          handleZoomTo(4.0)
        }
      }
      
      gesture.touchCount = e.touches.length
    }

    container.addEventListener('touchstart', handleTouchStart, { passive: false })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })
    container.addEventListener('touchcancel', handleTouchEnd, { passive: true })

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
      container.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [handleZoomTo])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (printIframeRef.current) {
        document.body.removeChild(printIframeRef.current)
      }
    }
  }, [])

  // Memoized thumbnail list
  const thumbnailList = useMemo(() => {
    if (loading) return null
    return Array.from({ length: numPages }, (_, i) => i + 1)
  }, [numPages, loading])

  // Memoized page list based on view mode
  const pageList = useMemo(() => {
    if (loading) return null
    if (viewMode === 'single') {
      return [pageNumber]
    }
    return Array.from({ length: numPages }, (_, i) => i + 1)
  }, [numPages, loading, viewMode, pageNumber])

  // Calculate page width based on container
  const getPageWidth = useCallback(() => {
    if (!mainContentRef.current) return undefined
    const containerWidth = mainContentRef.current.clientWidth
    
    if (viewMode === 'two-page' && !isMobile) {
      return Math.min((containerWidth - 80) / 2, 500) * scale
    }
    
    return undefined
  }, [viewMode, isMobile, scale])

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm"
    >
      <div className="h-full w-full flex flex-col p-2 sm:p-4 md:p-6">
        {/* Header */}
        <header className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-lg border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg mb-2 sm:mb-4 flex items-center justify-between p-2 sm:p-3 gap-2 sm:gap-4 flex-wrap">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowThumbnails(!showThumbnails)}
              title="Toggle thumbnails (T)"
              className="h-8 w-8 sm:h-10 sm:w-10"
            >
              {showThumbnails ? (
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
                Page {pageNumber} of {numPages || '...'}
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
                disabled={pageNumber <= 1 || loading}
                title="First page (Home)"
                className="h-7 w-7 sm:h-8 sm:w-8 hidden sm:flex"
              >
                <ChevronsLeft className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={goToPrevPage}
                disabled={pageNumber <= 1 || loading}
                title="Previous page"
                className="h-7 w-7 sm:h-8 sm:w-8"
              >
                <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
              <form onSubmit={handlePageInputSubmit} className="flex items-center">
                <Input
                  value={pageInputValue}
                  onChange={handlePageInputChange}
                  onBlur={handlePageInputBlur}
                  disabled={loading}
                  className="w-8 sm:w-12 h-7 sm:h-8 text-center border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-xs sm:text-sm p-0"
                />
                <span className="text-xs sm:text-sm text-slate-500 pr-1 sm:pr-2">/ {numPages || '...'}</span>
              </form>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={goToNextPage}
                disabled={pageNumber >= numPages || loading}
                title="Next page"
                className="h-7 w-7 sm:h-8 sm:w-8"
              >
                <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 rotate-[-90deg]" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={goToLastPage}
                disabled={pageNumber >= numPages || loading}
                title="Last page (End)"
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
                disabled={scale <= 0.25}
                title="Zoom out (Ctrl+-)"
                className="h-8 w-8"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <button
                onClick={handleZoomReset}
                onDoubleClick={handleFitWidth}
                className="px-2 sm:px-3 text-xs sm:text-sm font-medium min-w-[50px] sm:min-w-[60px] text-center hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                title="Click to reset, double-click to fit width"
              >
                {Math.round(scale * 100)}%
              </button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleZoomIn}
                disabled={scale >= 4.0}
                title="Zoom in (Ctrl++)"
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
                disabled={scale <= 0.25}
                className="h-7 w-7"
              >
                <ZoomOut className="h-3 w-3" />
              </Button>
              <span className="text-[10px] min-w-[32px] text-center">{Math.round(scale * 100)}%</span>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleZoomIn}
                disabled={scale >= 4.0}
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
              title="Rotate (Ctrl+R)"
              className="hidden sm:flex h-8 w-8 sm:h-10 sm:w-10"
            >
              <RotateCw className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>

            {/* Bookmark current page */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => toggleBookmark(pageNumber)}
              title={isPageBookmarked(pageNumber) ? "Remove bookmark (Ctrl+B)" : "Add bookmark (Ctrl+B)"}
              className="hidden sm:flex h-8 w-8 sm:h-10 sm:w-10"
            >
              {isPageBookmarked(pageNumber) ? (
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
                onClick={() => setShowBookmarks(!showBookmarks)}
                title="Show bookmarks"
                className="hidden sm:flex h-8 w-8 sm:h-10 sm:w-10 relative"
              >
                <Bookmark className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                  {bookmarks.length}
                </span>
              </Button>
            )}

            {/* Search */}
            {showSearch && (
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-700 px-1 sm:px-2">
                <Input
                  ref={searchInputRef}
                  placeholder="Search..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="w-20 sm:w-32 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-7 sm:h-8 text-xs sm:text-sm"
                />
                {isSearching ? (
                  <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin text-slate-400" />
                ) : searchResults.length > 0 ? (
                  <span className="text-[10px] sm:text-xs text-slate-500 px-1 whitespace-nowrap">
                    {currentSearchIndex + 1}/{searchResults.length}
                  </span>
                ) : searchText && !isSearching ? (
                  <span className="text-[10px] sm:text-xs text-slate-400 px-1">0</span>
                ) : null}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 sm:h-8 sm:w-8"
                  onClick={goToPrevSearchResult}
                  disabled={searchResults.length === 0}
                >
                  <ChevronUp className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 sm:h-8 sm:w-8"
                  onClick={goToNextSearchResult}
                  disabled={searchResults.length === 0}
                >
                  <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 sm:h-8 sm:w-8"
                  onClick={() => {
                    setShowSearch(false)
                    setSearchText('')
                    setSearchResults([])
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
                setShowSearch(!showSearch)
                if (!showSearch) {
                  setTimeout(() => searchInputRef.current?.focus(), 100)
                }
              }}
              title="Search (Ctrl+F)"
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
                onClick={() => setShowSettings(!showSettings)}
                title="Settings"
                className="h-8 w-8 sm:h-10 sm:w-10"
              >
                <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              
              {showSettings && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 p-3">
                  <h3 className="text-sm font-semibold mb-3 text-slate-900 dark:text-white">View Options</h3>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-slate-500 mb-1.5 block">View Mode</label>
                      <div className="flex gap-1">
                        <Button
                          variant={viewMode === 'single' ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1 h-8 text-xs"
                          onClick={() => setViewMode('single')}
                        >
                          <FileText className="h-3 w-3 mr-1" />
                          Single
                        </Button>
                        <Button
                          variant={viewMode === 'continuous' ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1 h-8 text-xs"
                          onClick={() => setViewMode('continuous')}
                        >
                          <Menu className="h-3 w-3 mr-1" />
                          Scroll
                        </Button>
                        <Button
                          variant={viewMode === 'two-page' ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1 h-8 text-xs"
                          onClick={() => setViewMode('two-page')}
                        >
                          <Columns className="h-3 w-3 mr-1" />
                          2-Up
                        </Button>
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-xs text-slate-500 mb-1.5 block">Zoom Presets</label>
                      <div className="grid grid-cols-3 gap-1">
                        {[50, 75, 100, 125, 150, 200].map(zoom => (
                          <Button
                            key={zoom}
                            variant={Math.round(scale * 100) === zoom ? 'default' : 'outline'}
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
                      <label className="text-xs text-slate-500 mb-1.5 block">Fit Options</label>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-8 text-xs bg-transparent"
                          onClick={handleFitWidth}
                        >
                          Fit Width
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-8 text-xs bg-transparent"
                          onClick={handleFitPage}
                        >
                          Fit Page
                        </Button>
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-xs text-slate-500 mb-1.5 block">Rotation</label>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-8 text-xs bg-transparent"
                          onClick={handleRotateBack}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Left
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-8 text-xs bg-transparent"
                          onClick={handleRotate}
                        >
                          <RotateCw className="h-3 w-3 mr-1" />
                          Right
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleFullscreen}
              title="Fullscreen (F11)"
              className="hidden sm:flex h-8 w-8 sm:h-10 sm:w-10"
            >
              {isFullscreen ? (
                <Minimize className="h-4 w-4 sm:h-5 sm:w-5" />
              ) : (
                <Maximize className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
            </Button>

            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleShare}
              title="Share / Copy link"
              className="hidden sm:flex h-8 w-8 sm:h-10 sm:w-10"
            >
              {copied ? (
                <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
              ) : (
                <Share2 className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
            </Button>

            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleDownload}
              disabled={isDownloading}
              title="Download (Ctrl+S)"
              className="h-7 w-7 sm:h-10 sm:w-10 relative"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                  {downloadProgress > 0 && downloadProgress < 100 && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-medium">
                      {downloadProgress}%
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
              disabled={isPrinting}
              title="Print (Ctrl+P)"
              className="hidden sm:flex h-8 w-8 sm:h-10 sm:w-10"
            >
              {isPrinting ? (
                <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
              ) : (
                <Printer className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleClose}
              title="Close (Esc)"
              className="h-7 w-7 sm:h-10 sm:w-10"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden bg-white dark:bg-slate-900 rounded-lg shadow-lg relative">
          {/* Thumbnails Sidebar */}
          {showThumbnails && !isMobile && (
            <aside className="w-40 sm:w-48 bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 overflow-y-auto p-2 sm:p-4 flex-shrink-0">
              <h2 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white mb-2 sm:mb-4">
                Pages
              </h2>
              <div className="space-y-2 sm:space-y-4">
                {thumbnailList?.map((page) => (
                  <button
                    key={page}
                    onClick={() => goToPage(page)}
                    className={cn(
                      'w-full group relative rounded-md overflow-hidden border-2 transition-all',
                      page === pageNumber
                        ? 'border-blue-500 shadow-md'
                        : 'border-transparent hover:border-slate-300 dark:hover:border-slate-600'
                    )}
                  >
                    <div className="bg-white p-1 relative">
                      <Document file={fileUrl} className="flex justify-center">
                        <Page
                          pageNumber={page}
                          width={120}
                          renderTextLayer={false}
                          renderAnnotationLayer={false}
                          rotate={rotation}
                        />
                      </Document>
                      {isPageBookmarked(page) && (
                        <div className="absolute top-1 right-1">
                          <BookmarkCheck className="h-4 w-4 text-blue-500" />
                        </div>
                      )}
                      {searchResults.some(r => r.page === page) && (
                        <div className="absolute top-1 left-1 bg-yellow-400 text-yellow-900 text-[10px] px-1 rounded">
                          {searchResults.find(r => r.page === page)?.matches}
                        </div>
                      )}
                    </div>
                    <span
                      className={cn(
                        'text-[10px] sm:text-xs font-medium mt-1 sm:mt-2 block text-center',
                        page === pageNumber
                          ? 'text-blue-500'
                          : 'text-slate-500'
                      )}
                    >
                      Page {page}
                    </span>
                  </button>
                ))}
              </div>
            </aside>
          )}

          {/* Bookmarks Panel */}
          {showBookmarks && bookmarks.length > 0 && (
            <aside className="w-48 sm:w-56 bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 overflow-y-auto p-4 flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Bookmarks
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setShowBookmarks(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                {bookmarks.map((bookmark) => (
                  <div
                    key={bookmark.page}
                    className={cn(
                      'group w-full flex items-center gap-2 p-2 rounded-md text-left transition-colors cursor-pointer',
                      bookmark.page === pageNumber
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
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleBookmark(bookmark.page)
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </aside>
          )}

          {/* PDF Display */}
          <main 
            ref={mainContentRef}
            className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-900 p-4 sm:p-8"
            style={{ touchAction: gestureRef.current.isPinching ? 'none' : 'pan-x pan-y' }}
          >
            <div className={cn(
              "mx-auto",
              viewMode === 'two-page' && !isMobile ? "max-w-7xl" : "max-w-5xl"
            )}>
              {error ? (
                <div className="flex items-center justify-center h-96">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <p className="text-red-500 font-semibold mb-2">
                      Failed to load PDF
                    </p>
                    <p className="text-slate-500 text-sm mb-4 max-w-xs mx-auto">
                      {error}
                    </p>
                    <div className="flex gap-2 justify-center flex-wrap">
                      <Button onClick={handleRetry} disabled={retryCount >= 3}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        {retryCount >= 3 ? 'Max retries' : 'Retry'}
                      </Button>
                      <Button variant="outline" onClick={handleDownload}>
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                      <Button variant="outline" onClick={handleOpenInNewTab}>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open in Tab
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <Document
                  key={retryCount} // Force re-render on retry
                  file={fileUrl}
                  onLoadSuccess={(pdf) => {
                    pdfDocRef.current = pdf
                    onDocumentLoadSuccess(pdf)
                  }}
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
                              strokeDasharray={`${loadProgress * 1.76} 176`}
                              className="text-blue-500 transition-all duration-300"
                            />
                          </svg>
                          <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-slate-600 dark:text-slate-400">
                            {loadProgress}%
                          </span>
                        </div>
                        <p className="text-slate-500">Loading PDF...</p>
                      </div>
                    </div>
                  }
                  className={cn(
                    "flex gap-4 sm:gap-6",
                    viewMode === 'two-page' && !isMobile ? "flex-row flex-wrap justify-center" : "flex-col items-center"
                  )}
                >
                  {pageList?.map((page) => (
                    <div
                      key={page}
                      ref={(el) => {
                        if (el) pageRefs.current.set(page, el)
                      }}
                      data-page={page}
                      className={cn(
                        "bg-white rounded-lg shadow-lg overflow-hidden transition-all",
                        searchResults.some(r => r.page === page) && "ring-2 ring-yellow-400",
                        page === pageNumber && viewMode === 'single' && "ring-2 ring-blue-400"
                      )}
                    >
                      <Page
                        pageNumber={page}
                        scale={scale}
                        width={getPageWidth()}
                        rotate={rotation}
                        renderTextLayer={true}
                        renderAnnotationLayer={true}
                        className="select-text"
                        loading={
                          <div className="flex items-center justify-center h-[500px] w-[400px] bg-slate-50">
                            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                          </div>
                        }
                      />
                    </div>
                  ))}
                </Document>
              )}
            </div>
          </main>
        </div>

        {/* Footer Status Bar */}
        <footer className="mt-2 sm:mt-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur-lg border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-1.5 sm:p-2 flex items-center justify-between text-[10px] sm:text-xs text-slate-500">
          <div className="flex items-center gap-2 sm:gap-4">
            <span>Page {pageNumber} of {numPages || '...'}</span>
            <span className="hidden sm:inline">|</span>
            <span className="hidden sm:inline">Zoom: {Math.round(scale * 100)}%</span>
            {rotation > 0 && (
              <>
                <span className="hidden sm:inline">|</span>
                <span className="hidden sm:inline">Rotation: {rotation}deg</span>
              </>
            )}
            {bookmarks.length > 0 && (
              <>
                <span className="hidden sm:inline">|</span>
                <span className="hidden sm:inline">{bookmarks.length} bookmark{bookmarks.length > 1 ? 's' : ''}</span>
              </>
            )}
            <span className="hidden lg:inline">|</span>
            <span className="hidden lg:inline capitalize">{viewMode} view</span>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <kbd className="px-1 sm:px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[9px] sm:text-[10px]">Esc</kbd>
            <span>Close</span>
            <span className="mx-1 sm:mx-2">|</span>
            <kbd className="px-1 sm:px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[9px] sm:text-[10px]">Ctrl+F</kbd>
            <span>Search</span>
            <span className="mx-1 sm:mx-2">|</span>
            <kbd className="px-1 sm:px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[9px] sm:text-[10px]">Ctrl+B</kbd>
            <span>Bookmark</span>
            <span className="mx-1 sm:mx-2">|</span>
            <span className="hidden lg:inline">Pinch/Scroll to Zoom</span>
          </div>
        </footer>
      </div>

      {/* Click outside to close settings */}
      {showSettings && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
