import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useSpotlight } from './SpotlightEffect';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  spotlight?: boolean;
  spotlightColor?: string;
}

export function Card({ children, className, hover = false, spotlight, spotlightColor }: CardProps) {
  const { position, opacity, handleMouseMove, handleMouseEnter, handleMouseLeave } = useSpotlight();

  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-[0_20px_40px_-35px_rgba(15,23,42,0.35)]',
        hover && 'transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_55px_-35px_rgba(15,23,42,0.5)]',
        spotlight && "relative overflow-hidden",
        className
      )}
      onMouseMove={spotlight ? handleMouseMove : undefined}
      onMouseEnter={spotlight ? handleMouseEnter : undefined}
      onMouseLeave={spotlight ? handleMouseLeave : undefined}
    >
      {spotlight && (
        <div
          className="pointer-events-none absolute -inset-px transition-opacity duration-300"
          style={{
            opacity,
            background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, ${spotlightColor || 'rgba(255, 255, 255, 0.15)'}, transparent 40%)`,
          }}
        />
      )}
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return (
    <div className={cn('mb-4', className)}>
      {children}
    </div>
  );
}

interface CardTitleProps {
  children: ReactNode;
  className?: string;
}

export function CardTitle({ children, className }: CardTitleProps) {
  return (
    <h3 className={cn('text-lg font-semibold text-text-light dark:text-text-dark', className)}>
      {children}
    </h3>
  );
}

interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className }: CardContentProps) {
  return (
    <div className={cn(className)}>
      {children}
    </div>
  );
}
