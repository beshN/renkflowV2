'use client';

import { useEffect, useSyncExternalStore } from 'react';

/**
 * Whether the logged-in workspace shell is on screen. The dashboard layout marks itself with
 * `useMarkWorkspaceShell()`; site-wide pieces mounted in the root layout (the cookie banner)
 * read `useWorkspaceShellMounted()` instead of keeping a list of in-app routes.
 */
let mounted = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
const snapshot = () => mounted > 0;

export function useMarkWorkspaceShell() {
  useEffect(() => {
    mounted += 1;
    emit();
    return () => { mounted -= 1; emit(); };
  }, []);
}

export function useWorkspaceShellMounted() {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}

/**
 * Public screens with their own chrome and offline handling (the product configurator): the site
 * cookie banner and the workspace's sync bar stay away from them.
 */
let standalone = 0;
const standaloneSnapshot = () => standalone > 0;

export function useMarkStandaloneScreen() {
  useEffect(() => {
    standalone += 1;
    emit();
    return () => { standalone -= 1; emit(); };
  }, []);
}

export function useStandaloneScreenMounted() {
  return useSyncExternalStore(subscribe, standaloneSnapshot, () => false);
}
