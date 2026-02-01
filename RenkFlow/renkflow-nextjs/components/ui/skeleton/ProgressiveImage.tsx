'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface ProgressiveImageProps {
  src: string;
  lowResSrc?: string;
  alt: string;
  className?: string;
  imgClassName?: string;
}

export function ProgressiveImage({
  src,
  lowResSrc,
  alt,
  className,
  imgClassName,
}: ProgressiveImageProps) {
  const [isLoaded, setIsLoaded] = React.useState(false);

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {lowResSrc && (
        <img
          src={lowResSrc}
          alt=""
          aria-hidden="true"
          className={cn(
            'absolute inset-0 h-full w-full object-cover blur-xl scale-110 transition-opacity duration-500',
            isLoaded ? 'opacity-0' : 'opacity-100'
          )}
        />
      )}
      <img
        src={src}
        alt={alt}
        className={cn(
          'h-full w-full object-cover transition-opacity duration-500',
          isLoaded ? 'opacity-100' : 'opacity-0',
          imgClassName
        )}
        onLoad={() => setIsLoaded(true)}
      />
    </div>
  );
}
