'use client';

/**
 * Timer Widget Component
 * One-click timer with Pomodoro support
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useTimeTrackingStore } from '@/lib/stores/timeTracking.store';
import {
  Play,
  Pause,
  Square,
  Clock,
  Coffee,
  Timer,
  ChevronDown,
  ChevronUp,
  X,
  Check,
  Settings,
  Maximize2,
  Minimize2,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface TimerWidgetProps {
  taskId?: string;
  taskName?: string;
  compact?: boolean;
  className?: string;
}

// ============================================
// Time Formatting
// ============================================

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

// ============================================
// Main Timer Widget
// ============================================

export function TimerWidget({
  taskId,
  taskName,
  compact = false,
  className,
}: TimerWidgetProps) {
  const {
    timer,
    pomodoroState,
    pomodoroConfig,
    isTimerExpanded,
    startTimer,
    stopTimer,
    pauseTimer,
    resumeTimer,
    discardTimer,
    updateTimerDescription,
    startPomodoro,
    stopPomodoro,
    skipPomodoroPhase,
    tickPomodoro,
    toggleTimerExpanded,
    getCurrentDuration,
    getTodayTotal,
  } = useTimeTrackingStore();

  const [currentDuration, setCurrentDuration] = useState(0);
  const [description, setDescription] = useState('');
  const [showPomodoro, setShowPomodoro] = useState(false);

  // Update timer display
  useEffect(() => {
    if (!timer.isRunning && !timer.isPaused) {
      setCurrentDuration(0);
      return;
    }

    const interval = setInterval(() => {
      setCurrentDuration(getCurrentDuration());
    }, 1000);

    return () => clearInterval(interval);
  }, [timer.isRunning, timer.isPaused, getCurrentDuration]);

  // Pomodoro tick
  useEffect(() => {
    if (!pomodoroState.isActive) return;

    const interval = setInterval(() => {
      tickPomodoro();
    }, 1000);

    return () => clearInterval(interval);
  }, [pomodoroState.isActive, tickPomodoro]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement) return;
      
      if (event.code === 'Space' && event.ctrlKey) {
        event.preventDefault();
        if (timer.isRunning) {
          pauseTimer();
        } else if (timer.isPaused) {
          resumeTimer();
        } else {
          startTimer(taskId, description);
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [timer, taskId, description, startTimer, pauseTimer, resumeTimer]);

  const handleStart = useCallback(() => {
    startTimer(taskId, description || taskName || '');
  }, [startTimer, taskId, description, taskName]);

  const handleStop = useCallback(() => {
    const entry = stopTimer();
    if (entry) {
      setDescription('');
    }
  }, [stopTimer]);

  const isActive = timer.isRunning || timer.isPaused;
  const todayTotal = getTodayTotal();

  // Compact version for task rows
  if (compact) {
    return (
      <button
        onClick={isActive ? handleStop : handleStart}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-lg text-sm font-medium transition-colors',
          isActive
            ? 'bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50'
            : 'bg-green-100 text-green-600 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50',
          className
        )}
      >
        {isActive ? (
          <>
            <Square size={14} />
            {formatDuration(currentDuration)}
          </>
        ) : (
          <>
            <Play size={14} />
            Başlat
          </>
        )}
      </button>
    );
  }

  return (
    <div
      className={cn(
        'bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-slate-500" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Zaman Takibi
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowPomodoro(!showPomodoro)}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              showPomodoro || pomodoroState.isActive
                ? 'bg-red-100 text-red-600 dark:bg-red-900/30'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500'
            )}
            title="Pomodoro"
          >
            <Timer size={16} />
          </button>
          <button
            onClick={toggleTimerExpanded}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500"
          >
            {isTimerExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isTimerExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            {/* Timer Display */}
            <div className="p-4">
              {/* Pomodoro Mode */}
              {showPomodoro && (
                <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {pomodoroState.isActive
                        ? pomodoroState.type === 'work'
                          ? `Pomodoro #${pomodoroState.currentSession}`
                          : pomodoroState.type === 'short_break'
                          ? 'Kısa Mola'
                          : 'Uzun Mola'
                        : 'Pomodoro'}
                    </span>
                    {pomodoroState.isActive && (
                      <button
                        onClick={skipPomodoroPhase}
                        className="text-xs text-slate-500 hover:text-slate-700"
                      >
                        Atla →
                      </button>
                    )}
                  </div>

                  {pomodoroState.isActive ? (
                    <div className="flex items-center justify-between">
                      <div className="text-2xl font-mono font-bold text-slate-900 dark:text-white">
                        {formatDuration(pomodoroState.timeRemaining)}
                      </div>
                      <button
                        onClick={stopPomodoro}
                        className="px-3 py-1.5 text-sm bg-red-100 text-red-600 hover:bg-red-200 rounded-lg"
                      >
                        Durdur
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startPomodoro(taskId)}
                      className="w-full py-2 text-sm font-medium bg-red-500 text-white hover:bg-red-600 rounded-lg flex items-center justify-center gap-2"
                    >
                      <Play size={16} />
                      Pomodoro Başlat ({pomodoroConfig.workDuration} dk)
                    </button>
                  )}

                  {/* Session indicators */}
                  <div className="flex items-center gap-1 mt-2">
                    {Array.from({ length: pomodoroConfig.sessionsBeforeLongBreak }).map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          'w-2 h-2 rounded-full',
                          i < pomodoroState.sessionsCompleted
                            ? 'bg-red-500'
                            : 'bg-slate-300 dark:bg-slate-600'
                        )}
                      />
                    ))}
                    <Coffee size={12} className="ml-1 text-slate-400" />
                  </div>
                </div>
              )}

              {/* Main Timer */}
              <div className="text-center">
                <div
                  className={cn(
                    'text-4xl font-mono font-bold mb-4 transition-colors',
                    isActive
                      ? timer.isPaused
                        ? 'text-amber-500 animate-pulse'
                        : 'text-green-500'
                      : 'text-slate-400'
                  )}
                >
                  {formatDuration(currentDuration)}
                </div>

                {/* Description Input */}
                <input
                  type="text"
                  value={isActive ? timer.description : description}
                  onChange={(e) =>
                    isActive
                      ? updateTimerDescription(e.target.value)
                      : setDescription(e.target.value)
                  }
                  placeholder="Ne üzerinde çalışıyorsunuz?"
                  className="w-full px-3 py-2 mb-4 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />

                {/* Task Info */}
                {taskName && (
                  <div className="mb-4 text-sm text-slate-500">
                    <span className="font-medium">{taskName}</span>
                  </div>
                )}

                {/* Control Buttons */}
                <div className="flex items-center justify-center gap-2">
                  {isActive ? (
                    <>
                      <button
                        onClick={timer.isPaused ? resumeTimer : pauseTimer}
                        className={cn(
                          'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
                          timer.isPaused
                            ? 'bg-green-500 text-white hover:bg-green-600'
                            : 'bg-amber-500 text-white hover:bg-amber-600'
                        )}
                      >
                        {timer.isPaused ? <Play size={18} /> : <Pause size={18} />}
                        {timer.isPaused ? 'Devam' : 'Duraklat'}
                      </button>
                      <button
                        onClick={handleStop}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white hover:bg-red-600 rounded-lg font-medium"
                      >
                        <Square size={18} />
                        Bitir
                      </button>
                      <button
                        onClick={discardTimer}
                        className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                        title="İptal"
                      >
                        <X size={18} />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleStart}
                      className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white hover:bg-green-600 rounded-lg font-medium text-lg"
                    >
                      <Play size={20} />
                      Başlat
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Footer - Today's Total */}
            <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Bugün toplam</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {formatDuration(todayTotal + (isActive ? currentDuration : 0))}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsed View */}
      {!isTimerExpanded && isActive && (
        <div className="px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'w-2 h-2 rounded-full',
                timer.isPaused ? 'bg-amber-500 animate-pulse' : 'bg-green-500 animate-pulse'
              )}
            />
            <span className="font-mono font-medium text-slate-900 dark:text-white">
              {formatDuration(currentDuration)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={timer.isPaused ? resumeTimer : pauseTimer}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              {timer.isPaused ? (
                <Play size={16} className="text-green-500" />
              ) : (
                <Pause size={16} className="text-amber-500" />
              )}
            </button>
            <button
              onClick={handleStop}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              <Square size={16} className="text-red-500" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Floating Timer Button
// ============================================

export function FloatingTimerButton({ className }: { className?: string }) {
  const { timer, getCurrentDuration, startTimer, stopTimer } = useTimeTrackingStore();
  const [currentDuration, setCurrentDuration] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!timer.isRunning) return;

    const interval = setInterval(() => {
      setCurrentDuration(getCurrentDuration());
    }, 1000);

    return () => clearInterval(interval);
  }, [timer.isRunning, getCurrentDuration]);

  const isActive = timer.isRunning || timer.isPaused;

  return (
    <div className={cn('fixed bottom-6 right-6 z-50', className)}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="absolute bottom-16 right-0 w-80"
          >
            <TimerWidget />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-4 py-3 rounded-full shadow-lg font-medium transition-colors',
          isActive
            ? 'bg-green-500 text-white hover:bg-green-600'
            : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100'
        )}
      >
        {isActive ? (
          <>
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="font-mono">{formatDuration(currentDuration)}</span>
          </>
        ) : (
          <>
            <Clock size={20} />
            <span>Zaman Takibi</span>
          </>
        )}
      </motion.button>
    </div>
  );
}
