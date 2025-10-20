"use client"

import type React from "react"

// Stub file to satisfy build system
// This file is not actually used in the application
// All text is now hardcoded in Turkish

export function useLanguage() {
  return {
    language: "tr" as const,
    setLanguage: () => {},
    t: (key: string) => key,
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  return children
}
