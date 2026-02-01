'use client';

import React, { useRef } from 'react';

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
}

export function useSwipe({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  threshold = 60,
}: SwipeHandlers) {
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart: React.TouchEventHandler = (event) => {
    const touch = event.touches[0];
    if (!touch) return;
    startRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const onTouchEnd: React.TouchEventHandler = (event) => {
    const start = startRef.current;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX > threshold) onSwipeRight?.();
      if (deltaX < -threshold) onSwipeLeft?.();
    } else {
      if (deltaY > threshold) onSwipeDown?.();
      if (deltaY < -threshold) onSwipeUp?.();
    }

    startRef.current = null;
  };

  return { onTouchStart, onTouchEnd };
}
