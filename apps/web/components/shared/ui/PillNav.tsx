'use client';

import { ReactNode, useState } from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface PillNavItem {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: string | number;
  disabled?: boolean;
}

interface PillNavProps {
  items: PillNavItem[];
  activeId?: string;
  onChange?: (id: string) => void;
  variant?: 'default' | 'filled' | 'outline' | 'glass' | 'gradient';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  fullWidth?: boolean;
}

export function PillNav({
  items,
  activeId,
  onChange,
  variant = 'default',
  size = 'default',
  className,
  fullWidth = false,
}: PillNavProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [internalActiveId, setInternalActiveId] = useState(items[0]?.id);
  
  const currentActiveId = activeId ?? internalActiveId;

  const handleClick = (id: string) => {
    if (onChange) {
      onChange(id);
    } else {
      setInternalActiveId(id);
    }
  };

  const sizeStyles = {
    sm: 'text-xs px-3 py-1.5 gap-1',
    default: 'text-sm px-4 py-2 gap-1.5',
    lg: 'text-base px-5 py-2.5 gap-2',
  };

  const containerVariants = {
    default: 'bg-gray-100 dark:bg-gray-800',
    filled: 'bg-white dark:bg-gray-900 shadow-sm border border-gray-200 dark:border-gray-700',
    outline: 'border-2 border-gray-200 dark:border-gray-700',
    glass: 'bg-white/60 dark:bg-gray-900/60 backdrop-blur-md border border-white/20 dark:border-gray-700/20',
    gradient: 'bg-gradient-to-r from-gray-100 via-white to-gray-100 dark:from-gray-800 dark:via-gray-900 dark:to-gray-800',
  };

  const activeVariants = {
    default: 'bg-white dark:bg-gray-700 shadow-sm',
    filled: 'bg-sky-500 text-white shadow-md',
    outline: 'bg-gray-900 dark:bg-white text-white dark:text-gray-900',
    glass: 'bg-white/80 dark:bg-gray-700/80 shadow-sm backdrop-blur-sm',
    gradient: 'bg-gradient-to-r from-sky-500 to-emerald-500 text-white shadow-md',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full p-1 transition-colors',
        containerVariants[variant],
        fullWidth && 'w-full',
        className
      )}
    >
      {items.map((item) => {
        const isActive = currentActiveId === item.id;
        const isHovered = hoveredId === item.id;

        return (
          <button
            key={item.id}
            onClick={() => !item.disabled && handleClick(item.id)}
            onMouseEnter={() => setHoveredId(item.id)}
            onMouseLeave={() => setHoveredId(null)}
            disabled={item.disabled}
            className={cn(
              'relative inline-flex items-center justify-center font-medium rounded-full transition-all duration-200',
              sizeStyles[size],
              fullWidth && 'flex-1',
              item.disabled && 'opacity-50 cursor-not-allowed',
              !isActive && !item.disabled && 'hover:text-gray-900 dark:hover:text-white',
              isActive && 'text-gray-900 dark:text-white'
            )}
          >
            {/* Background indicator */}
            <AnimatePresence>
              {isActive && (
                <motion.div
                  layoutId="pill-active-bg"
                  className={cn(
                    'absolute inset-0 rounded-full',
                    activeVariants[variant]
                  )}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
            </AnimatePresence>

            {/* Hover indicator */}
            {!isActive && isHovered && !item.disabled && (
              <motion.div
                className="absolute inset-0 rounded-full bg-gray-200/50 dark:bg-gray-600/30"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            )}

            {/* Content */}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span
                  className={cn(
                    'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold rounded-full',
                    isActive
                      ? variant === 'filled' || variant === 'gradient'
                        ? 'bg-white/20 text-white'
                        : 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300'
                      : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                  )}
                >
                  {item.badge}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

interface PillTabsProps {
  tabs: { id: string; label: string; content: ReactNode; icon?: ReactNode }[];
  defaultTab?: string;
  variant?: 'default' | 'filled' | 'outline' | 'glass' | 'gradient';
  className?: string;
  contentClassName?: string;
}

export function PillTabs({
  tabs,
  defaultTab,
  variant = 'default',
  className,
  contentClassName,
}: PillTabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  const activeContent = tabs.find((tab) => tab.id === activeTab)?.content;

  return (
    <div className={className}>
      <PillNav
        items={tabs.map((tab) => ({
          id: tab.id,
          label: tab.label,
          icon: tab.icon,
        }))}
        activeId={activeTab}
        onChange={setActiveTab}
        variant={variant}
      />
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className={cn('mt-4', contentClassName)}
        >
          {activeContent}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

interface SegmentedControlProps {
  options: { value: string; label: string }[];
  value?: string;
  onChange?: (value: string) => void;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

export function SegmentedControl({
  options,
  value,
  onChange,
  size = 'default',
  className,
}: SegmentedControlProps) {
  const [internalValue, setInternalValue] = useState(options[0]?.value);
  const currentValue = value ?? internalValue;

  const handleChange = (newValue: string) => {
    if (onChange) {
      onChange(newValue);
    } else {
      setInternalValue(newValue);
    }
  };

  const sizeStyles = {
    sm: 'text-xs h-7',
    default: 'text-sm h-9',
    lg: 'text-base h-11',
  };

  return (
    <div
      className={cn(
        'inline-flex items-stretch rounded-lg bg-gray-100 dark:bg-gray-800 p-1',
        className
      )}
    >
      {options.map((option, index) => {
        const isActive = currentValue === option.value;

        return (
          <button
            key={option.value}
            onClick={() => handleChange(option.value)}
            className={cn(
              'relative px-4 font-medium rounded-md transition-all duration-200',
              sizeStyles[size],
              index > 0 && 'ml-1',
              isActive
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
