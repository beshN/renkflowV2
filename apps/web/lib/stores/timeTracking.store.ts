/**
 * Time Tracking Store - Zustand
 * Timer state, entries, and Pomodoro management
 */

import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  TimeEntry,
  TimerState,
  PomodoroConfig,
  PomodoroState,
  WeeklyTimesheet,
  TimesheetEntry,
} from '@/lib/types/enterprise';

// ============================================
// Default Configurations
// ============================================

const DEFAULT_POMODORO_CONFIG: PomodoroConfig = {
  workDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  sessionsBeforeLongBreak: 4,
  autoStartBreaks: false,
  autoStartWork: false,
  notifications: true,
  sounds: true,
};

const DEFAULT_TIMER_STATE: TimerState = {
  isRunning: false,
  isPaused: false,
  currentEntryId: null,
  startTime: null,
  pausedAt: null,
  accumulatedTime: 0,
  taskId: null,
  description: '',
};

const DEFAULT_POMODORO_STATE: PomodoroState = {
  isActive: false,
  type: 'work',
  sessionsCompleted: 0,
  currentSession: 1,
  timeRemaining: 25 * 60, // 25 minutes in seconds
};

// ============================================
// Store State
// ============================================

interface TimeTrackingState {
  // Timer
  timer: TimerState;
  
  // Time entries
  entries: TimeEntry[];
  
  // Pomodoro
  pomodoroConfig: PomodoroConfig;
  pomodoroState: PomodoroState;
  
  // Preferences
  idleThreshold: number; // seconds before idle detection
  defaultBillable: boolean;
  roundTo: number; // round to nearest X minutes (0 = no rounding)
  
  // UI state
  isTimerExpanded: boolean;
  showIdlePrompt: boolean;
  idleStartTime: number | null;
}

interface TimeTrackingActions {
  // Timer actions
  startTimer: (taskId?: string, description?: string) => void;
  stopTimer: () => TimeEntry | null;
  pauseTimer: () => void;
  resumeTimer: () => void;
  discardTimer: () => void;
  updateTimerDescription: (description: string) => void;
  updateTimerTask: (taskId: string | null) => void;
  
  // Manual entry actions
  addManualEntry: (entry: Omit<TimeEntry, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateEntry: (entryId: string, updates: Partial<TimeEntry>) => void;
  deleteEntry: (entryId: string) => void;
  
  // Pomodoro actions
  startPomodoro: (taskId?: string) => void;
  stopPomodoro: () => void;
  skipPomodoroPhase: () => void;
  updatePomodoroConfig: (config: Partial<PomodoroConfig>) => void;
  tickPomodoro: () => void;
  
  // Idle detection
  handleIdleDetected: () => void;
  handleIdleResume: (keepTime: boolean) => void;
  
  // Preferences
  setIdleThreshold: (seconds: number) => void;
  setDefaultBillable: (billable: boolean) => void;
  setRoundTo: (minutes: number) => void;
  
  // UI actions
  toggleTimerExpanded: () => void;
  
  // Computed
  getCurrentDuration: () => number;
  getTodayTotal: () => number;
  getWeeklyTimesheet: (weekStart: Date) => WeeklyTimesheet;
}

type TimeTrackingStore = TimeTrackingState & TimeTrackingActions;

// ============================================
// Helper Functions
// ============================================

function generateId(): string {
  return `time_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function roundDuration(seconds: number, roundToMinutes: number): number {
  if (roundToMinutes === 0) return seconds;
  const roundToSeconds = roundToMinutes * 60;
  return Math.round(seconds / roundToSeconds) * roundToSeconds;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  return new Date(d.setDate(diff));
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

// ============================================
// Store Implementation
// ============================================

export const useTimeTrackingStore = create<TimeTrackingStore>()(
  devtools(
    persist(
      subscribeWithSelector(
        immer((set, get) => ({
          // Initial state
          timer: DEFAULT_TIMER_STATE,
          entries: [],
          pomodoroConfig: DEFAULT_POMODORO_CONFIG,
          pomodoroState: DEFAULT_POMODORO_STATE,
          idleThreshold: 300, // 5 minutes
          defaultBillable: false,
          roundTo: 0,
          isTimerExpanded: true,
          showIdlePrompt: false,
          idleStartTime: null,

          // Timer actions
          startTimer: (taskId, description = '') => {
            set((state) => {
              if (state.timer.isRunning) return; // Already running

              state.timer = {
                isRunning: true,
                isPaused: false,
                currentEntryId: generateId(),
                startTime: Date.now(),
                pausedAt: null,
                accumulatedTime: 0,
                taskId: taskId || null,
                description,
              };
            });
          },

          stopTimer: () => {
            const state = get();
            if (!state.timer.isRunning && !state.timer.isPaused) return null;

            const duration = state.getCurrentDuration();
            const roundedDuration = roundDuration(duration, state.roundTo);

            const entry: TimeEntry = {
              id: state.timer.currentEntryId || generateId(),
              tenantId: '', // Will be set by server
              userId: '', // Will be set by server
              taskId: state.timer.taskId || undefined,
              description: state.timer.description,
              startTime: new Date(state.timer.startTime!).toISOString(),
              endTime: new Date().toISOString(),
              duration: roundedDuration,
              billable: state.defaultBillable,
              tags: [],
              status: 'stopped',
              source: 'timer',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            set((s) => {
              s.entries.push(entry);
              s.timer = DEFAULT_TIMER_STATE;
            });

            return entry;
          },

          pauseTimer: () => {
            set((state) => {
              if (!state.timer.isRunning) return;

              const now = Date.now();
              const elapsed = Math.floor((now - state.timer.startTime!) / 1000);
              
              state.timer.isRunning = false;
              state.timer.isPaused = true;
              state.timer.pausedAt = now;
              state.timer.accumulatedTime += elapsed;
            });
          },

          resumeTimer: () => {
            set((state) => {
              if (!state.timer.isPaused) return;

              state.timer.isRunning = true;
              state.timer.isPaused = false;
              state.timer.startTime = Date.now();
              state.timer.pausedAt = null;
            });
          },

          discardTimer: () => {
            set((state) => {
              state.timer = DEFAULT_TIMER_STATE;
            });
          },

          updateTimerDescription: (description) => {
            set((state) => {
              state.timer.description = description;
            });
          },

          updateTimerTask: (taskId) => {
            set((state) => {
              state.timer.taskId = taskId;
            });
          },

          // Manual entry actions
          addManualEntry: (entry) => {
            const newEntry: TimeEntry = {
              ...entry,
              id: generateId(),
              source: 'manual',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            set((state) => {
              state.entries.push(newEntry);
            });
          },

          updateEntry: (entryId, updates) => {
            set((state) => {
              const index = state.entries.findIndex((e) => e.id === entryId);
              if (index !== -1) {
                state.entries[index] = {
                  ...state.entries[index],
                  ...updates,
                  updatedAt: new Date().toISOString(),
                };
              }
            });
          },

          deleteEntry: (entryId) => {
            set((state) => {
              state.entries = state.entries.filter((e) => e.id !== entryId);
            });
          },

          // Pomodoro actions
          startPomodoro: (taskId) => {
            set((state) => {
              state.pomodoroState = {
                isActive: true,
                type: 'work',
                sessionsCompleted: 0,
                currentSession: 1,
                timeRemaining: state.pomodoroConfig.workDuration * 60,
              };

              // Also start timer
              state.timer = {
                isRunning: true,
                isPaused: false,
                currentEntryId: generateId(),
                startTime: Date.now(),
                pausedAt: null,
                accumulatedTime: 0,
                taskId: taskId || null,
                description: `Pomodoro #${state.pomodoroState.currentSession}`,
              };
            });
          },

          stopPomodoro: () => {
            get().stopTimer();
            set((state) => {
              state.pomodoroState = DEFAULT_POMODORO_STATE;
            });
          },

          skipPomodoroPhase: () => {
            set((state) => {
              const config = state.pomodoroConfig;
              const pomo = state.pomodoroState;

              if (pomo.type === 'work') {
                const sessionsCompleted = pomo.sessionsCompleted + 1;
                const isLongBreak = sessionsCompleted % config.sessionsBeforeLongBreak === 0;

                state.pomodoroState = {
                  isActive: true,
                  type: isLongBreak ? 'long_break' : 'short_break',
                  sessionsCompleted,
                  currentSession: pomo.currentSession,
                  timeRemaining: (isLongBreak ? config.longBreakDuration : config.shortBreakDuration) * 60,
                };

                // Stop timer for break
                get().stopTimer();
              } else {
                // End break, start new work session
                state.pomodoroState = {
                  isActive: true,
                  type: 'work',
                  sessionsCompleted: pomo.sessionsCompleted,
                  currentSession: pomo.currentSession + 1,
                  timeRemaining: config.workDuration * 60,
                };

                // Start timer for work
                state.timer = {
                  isRunning: true,
                  isPaused: false,
                  currentEntryId: generateId(),
                  startTime: Date.now(),
                  pausedAt: null,
                  accumulatedTime: 0,
                  taskId: state.timer.taskId,
                  description: `Pomodoro #${pomo.currentSession + 1}`,
                };
              }
            });
          },

          updatePomodoroConfig: (config) => {
            set((state) => {
              state.pomodoroConfig = { ...state.pomodoroConfig, ...config };
            });
          },

          tickPomodoro: () => {
            set((state) => {
              if (!state.pomodoroState.isActive) return;

              state.pomodoroState.timeRemaining -= 1;

              if (state.pomodoroState.timeRemaining <= 0) {
                get().skipPomodoroPhase();
              }
            });
          },

          // Idle detection
          handleIdleDetected: () => {
            set((state) => {
              if (state.timer.isRunning) {
                state.showIdlePrompt = true;
                state.idleStartTime = Date.now();
              }
            });
          },

          handleIdleResume: (keepTime) => {
            set((state) => {
              if (!keepTime && state.idleStartTime) {
                // Subtract idle time from accumulated
                const idleDuration = Math.floor((Date.now() - state.idleStartTime) / 1000);
                state.timer.accumulatedTime = Math.max(0, state.timer.accumulatedTime - idleDuration);
              }
              state.showIdlePrompt = false;
              state.idleStartTime = null;
            });
          },

          // Preferences
          setIdleThreshold: (seconds) => {
            set((state) => {
              state.idleThreshold = seconds;
            });
          },

          setDefaultBillable: (billable) => {
            set((state) => {
              state.defaultBillable = billable;
            });
          },

          setRoundTo: (minutes) => {
            set((state) => {
              state.roundTo = minutes;
            });
          },

          // UI actions
          toggleTimerExpanded: () => {
            set((state) => {
              state.isTimerExpanded = !state.isTimerExpanded;
            });
          },

          // Computed
          getCurrentDuration: () => {
            const { timer } = get();
            if (!timer.startTime) return timer.accumulatedTime;

            if (timer.isPaused) return timer.accumulatedTime;

            const elapsed = Math.floor((Date.now() - timer.startTime) / 1000);
            return timer.accumulatedTime + elapsed;
          },

          getTodayTotal: () => {
            const today = new Date();
            const { entries } = get();

            return entries
              .filter((e) => {
                const entryDate = new Date(e.startTime);
                return isSameDay(entryDate, today);
              })
              .reduce((sum, e) => sum + e.duration, 0);
          },

          getWeeklyTimesheet: (weekStart) => {
            const { entries } = get();
            const days: TimesheetEntry[] = [];

            for (let i = 0; i < 7; i++) {
              const date = new Date(weekStart);
              date.setDate(date.getDate() + i);
              const dateStr = date.toISOString().split('T')[0];

              const dayEntries = entries.filter((e) => {
                const entryDate = new Date(e.startTime);
                return isSameDay(entryDate, date);
              });

              const totalHours = dayEntries.reduce((sum, e) => sum + e.duration, 0) / 3600;
              const billableHours = dayEntries
                .filter((e) => e.billable)
                .reduce((sum, e) => sum + e.duration, 0) / 3600;

              days.push({
                date: dateStr,
                entries: dayEntries,
                totalHours,
                billableHours,
                nonBillableHours: totalHours - billableHours,
              });
            }

            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);

            const totalHours = days.reduce((sum, d) => sum + d.totalHours, 0);
            const billableHours = days.reduce((sum, d) => sum + d.billableHours, 0);

            return {
              weekStart: weekStart.toISOString().split('T')[0],
              weekEnd: weekEnd.toISOString().split('T')[0],
              days,
              totalHours,
              billableHours,
              targetHours: 40, // Standard 40-hour week
              overtimeHours: Math.max(0, totalHours - 40),
            };
          },
        }))
      ),
      {
        name: 'renkflow-time-tracking',
        partialize: (state) => ({
          entries: state.entries.slice(-1000), // Keep last 1000 entries
          pomodoroConfig: state.pomodoroConfig,
          idleThreshold: state.idleThreshold,
          defaultBillable: state.defaultBillable,
          roundTo: state.roundTo,
        }),
      }
    ),
    { name: 'TimeTrackingStore' }
  )
);

// ============================================
// Selectors
// ============================================

export const selectTimer = (state: TimeTrackingStore) => state.timer;
export const selectPomodoro = (state: TimeTrackingStore) => ({
  config: state.pomodoroConfig,
  state: state.pomodoroState,
});
export const selectIsTimerRunning = (state: TimeTrackingStore) => 
  state.timer.isRunning || state.timer.isPaused;
export const selectTodayEntries = (state: TimeTrackingStore) => {
  const today = new Date();
  return state.entries.filter((e) => isSameDay(new Date(e.startTime), today));
};
