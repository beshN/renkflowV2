import type { Metadata } from 'next'

/** Metadata for private workspace pages: titled, never indexed. */
export function workspaceMetadata(title: string): Metadata {
  return { title, robots: { index: false, follow: false } }
}

/** Metadata for auth screens: titled, never indexed. */
export const authMetadata = workspaceMetadata
