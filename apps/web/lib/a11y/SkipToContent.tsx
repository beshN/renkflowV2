'use client';

import React from 'react';

export function SkipToContent({ targetId = 'main-content' }: { targetId?: string }) {
  return (
    <a
      href={`#${targetId}`}
      className="skip-link"
    >
      İçeriğe atla
    </a>
  );
}
