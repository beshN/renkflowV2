/**
 * Portfolio Management Store - Zustand
 * Multi-project oversight and program management
 */

import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  Portfolio,
  PortfolioSummary,
  PortfolioHealth,
  ProjectInPortfolio,
} from '@/lib/types/enterprise';

// ============================================
// Types
// ============================================

interface PortfolioState {
  // Portfolios
  portfolios: Portfolio[];
  activePortfolioId: string | null;
  
  // Projects in portfolios
  projects: ProjectInPortfolio[];
  
  // View state
  viewMode: 'grid' | 'list' | 'timeline';
  sortBy: 'name' | 'health' | 'progress' | 'startDate' | 'endDate';
  sortDirection: 'asc' | 'desc';
  
  // Filters
  filters: {
    health: PortfolioHealth[];
    status: string[];
    search: string;
  };
  
  // Loading
  isLoading: boolean;
  error: string | null;
}

interface PortfolioActions {
  // Portfolio CRUD
  createPortfolio: (portfolio: Omit<Portfolio, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updatePortfolio: (portfolioId: string, updates: Partial<Portfolio>) => void;
  deletePortfolio: (portfolioId: string) => void;
  archivePortfolio: (portfolioId: string) => void;
  
  // Portfolio navigation
  selectPortfolio: (portfolioId: string | null) => void;
  
  // Project management
  addProjectToPortfolio: (portfolioId: string, projectId: string) => void;
  removeProjectFromPortfolio: (portfolioId: string, projectId: string) => void;
  updateProjectInPortfolio: (projectId: string, updates: Partial<ProjectInPortfolio>) => void;
  
  // Milestones
  addMilestone: (portfolioId: string, milestone: { id: string; name: string; date: string; status: 'pending' | 'completed' | 'missed' }) => void;
  updateMilestone: (portfolioId: string, milestoneId: string, updates: Partial<{ id: string; name: string; date: string; status: 'pending' | 'completed' | 'missed' }>) => void;
  deleteMilestone: (portfolioId: string, milestoneId: string) => void;
  
  // Goals
  addGoal: (portfolioId: string, goal: Portfolio['goals'][0]) => void;
  updateGoal: (portfolioId: string, goalId: string, updates: Partial<Portfolio['goals'][0]>) => void;
  deleteGoal: (portfolioId: string, goalId: string) => void;
  
  // Computed getters
  getPortfolioSummary: (portfolioId: string) => PortfolioSummary;
  getPortfolioHealth: (portfolioId: string) => PortfolioHealth;
  getProjectsByPortfolio: (portfolioId: string) => ProjectInPortfolio[];
  
  // View actions
  setViewMode: (mode: 'grid' | 'list' | 'timeline') => void;
  setSortBy: (sortBy: PortfolioState['sortBy']) => void;
  toggleSortDirection: () => void;
  
  // Filters
  setHealthFilter: (health: PortfolioHealth[]) => void;
  setStatusFilter: (status: string[]) => void;
  setSearchFilter: (search: string) => void;
  clearFilters: () => void;
  
  // Loading
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

type PortfolioStore = PortfolioState & PortfolioActions;

// ============================================
// Helper Functions
// ============================================

function generateId(prefix = 'pf'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function calculateHealth(projects: ProjectInPortfolio[]): PortfolioHealth {
  if (projects.length === 0) return 'green';
  
  const delayedCount = projects.filter((p) => p.health === 'red').length;
  const atRiskCount = projects.filter((p) => p.health === 'yellow').length;
  
  if (delayedCount > projects.length * 0.3) return 'red';
  if (delayedCount > 0 || atRiskCount > projects.length * 0.5) return 'yellow';
  return 'green';
}

function calculateProgress(projects: ProjectInPortfolio[]): number {
  if (projects.length === 0) return 0;
  return projects.reduce((sum, p) => sum + p.progress, 0) / projects.length;
}

// ============================================
// Initial State
// ============================================

const initialState: PortfolioState = {
  portfolios: [],
  activePortfolioId: null,
  projects: [],
  viewMode: 'grid',
  sortBy: 'name',
  sortDirection: 'asc',
  filters: {
    health: [],
    status: [],
    search: '',
  },
  isLoading: false,
  error: null,
};

// ============================================
// Store Implementation
// ============================================

export const usePortfolioStore = create<PortfolioStore>()(
  devtools(
    persist(
      subscribeWithSelector(
        immer((set, get) => ({
          ...initialState,

          // Portfolio CRUD
          createPortfolio: (portfolio) => {
            const id = generateId('pf');
            const newPortfolio: Portfolio = {
              ...portfolio,
              id,
              projectIds: portfolio.projectIds || [],
              tags: portfolio.tags || [],
              goals: portfolio.goals || [],
              isArchived: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            } as Portfolio;

            set((state) => {
              state.portfolios.push(newPortfolio);
              state.activePortfolioId = id;
            });

            return id;
          },

          updatePortfolio: (portfolioId, updates) => {
            set((state) => {
              const index = state.portfolios.findIndex((p) => p.id === portfolioId);
              if (index !== -1) {
                state.portfolios[index] = {
                  ...state.portfolios[index],
                  ...updates,
                  updatedAt: new Date().toISOString(),
                };
              }
            });
          },

          deletePortfolio: (portfolioId) => {
            set((state) => {
              state.portfolios = state.portfolios.filter((p) => p.id !== portfolioId);
              if (state.activePortfolioId === portfolioId) {
                state.activePortfolioId = null;
              }
            });
          },

          archivePortfolio: (portfolioId) => {
            get().updatePortfolio(portfolioId, { isArchived: true });
          },

          // Portfolio navigation
          selectPortfolio: (portfolioId) => {
            set((state) => {
              state.activePortfolioId = portfolioId;
            });
          },

          // Project management
          addProjectToPortfolio: (portfolioId, projectId) => {
            set((state) => {
              const portfolio = state.portfolios.find((p) => p.id === portfolioId);
              if (portfolio && !portfolio.projectIds.includes(projectId)) {
                portfolio.projectIds.push(projectId);
                portfolio.updatedAt = new Date().toISOString();
              }
            });
          },

          removeProjectFromPortfolio: (portfolioId, projectId) => {
            set((state) => {
              const portfolio = state.portfolios.find((p) => p.id === portfolioId);
              if (portfolio) {
                portfolio.projectIds = portfolio.projectIds.filter((id) => id !== projectId);
                portfolio.updatedAt = new Date().toISOString();
              }
            });
          },

          updateProjectInPortfolio: (projectId, updates) => {
            set((state) => {
              const index = state.projects.findIndex((p) => p.id === projectId);
              if (index !== -1) {
                state.projects[index] = {
                  ...state.projects[index],
                  ...updates,
                  lastUpdated: new Date().toISOString(),
                };
              }
            });
          },

          // Milestones
          addMilestone: (portfolioId, milestone) => {
            set((state) => {
              const portfolio = state.portfolios.find((p) => p.id === portfolioId);
              if (portfolio) {
                if (!portfolio.timeline) {
                  portfolio.timeline = {
                    startDate: new Date().toISOString(),
                    endDate: new Date().toISOString(),
                    milestones: [],
                  };
                }
                portfolio.timeline.milestones.push({
                  ...milestone,
                  id: generateId('ms'),
                });
                portfolio.updatedAt = new Date().toISOString();
              }
            });
          },

          updateMilestone: (portfolioId, milestoneId, updates) => {
            set((state) => {
              const portfolio = state.portfolios.find((p) => p.id === portfolioId);
              if (portfolio?.timeline) {
                const milestone = portfolio.timeline.milestones.find((m) => m.id === milestoneId);
                if (milestone) {
                  Object.assign(milestone, updates);
                  portfolio.updatedAt = new Date().toISOString();
                }
              }
            });
          },

          deleteMilestone: (portfolioId, milestoneId) => {
            set((state) => {
              const portfolio = state.portfolios.find((p) => p.id === portfolioId);
              if (portfolio?.timeline) {
                portfolio.timeline.milestones = portfolio.timeline.milestones.filter(
                  (m) => m.id !== milestoneId
                );
                portfolio.updatedAt = new Date().toISOString();
              }
            });
          },

          // Goals
          addGoal: (portfolioId, goal) => {
            set((state) => {
              const portfolio = state.portfolios.find((p) => p.id === portfolioId);
              if (portfolio) {
                portfolio.goals.push({
                  ...goal,
                  id: generateId('goal'),
                });
                portfolio.updatedAt = new Date().toISOString();
              }
            });
          },

          updateGoal: (portfolioId, goalId, updates) => {
            set((state) => {
              const portfolio = state.portfolios.find((p) => p.id === portfolioId);
              if (portfolio) {
                const goal = portfolio.goals.find((g) => g.id === goalId);
                if (goal) {
                  Object.assign(goal, updates);
                  portfolio.updatedAt = new Date().toISOString();
                }
              }
            });
          },

          deleteGoal: (portfolioId, goalId) => {
            set((state) => {
              const portfolio = state.portfolios.find((p) => p.id === portfolioId);
              if (portfolio) {
                portfolio.goals = portfolio.goals.filter((g) => g.id !== goalId);
                portfolio.updatedAt = new Date().toISOString();
              }
            });
          },

          // Computed getters
          getPortfolioSummary: (portfolioId) => {
            const state = get();
            const portfolio = state.portfolios.find((p) => p.id === portfolioId);
            
            if (!portfolio) {
              return {
                portfolioId,
                portfolioName: 'Unknown',
                projectCount: 0,
                health: 'green' as PortfolioHealth,
                progress: 0,
                budget: { allocated: 0, spent: 0, remaining: 0, variance: 0 },
                schedule: { onTrack: 0, atRisk: 0, delayed: 0 },
                resources: { allocated: 0, utilized: 0, available: 0 },
                risks: { high: 0, medium: 0, low: 0 },
              };
            }

            const projects = state.projects.filter((p) => 
              portfolio.projectIds.includes(p.id)
            );

            const health = calculateHealth(projects);
            const progress = calculateProgress(projects);

            const budget = portfolio.budget || { allocated: 0, spent: 0, currency: 'TRY' };
            const budgetRemaining = budget.allocated - budget.spent;
            const budgetVariance = budget.allocated > 0 
              ? ((budget.spent - budget.allocated) / budget.allocated) * 100 
              : 0;

            return {
              portfolioId,
              portfolioName: portfolio.name,
              projectCount: projects.length,
              health,
              progress,
              budget: {
                allocated: budget.allocated,
                spent: budget.spent,
                remaining: budgetRemaining,
                variance: budgetVariance,
              },
              schedule: {
                onTrack: projects.filter((p) => p.health === 'green').length,
                atRisk: projects.filter((p) => p.health === 'yellow').length,
                delayed: projects.filter((p) => p.health === 'red').length,
              },
              resources: {
                allocated: 0, // Would calculate from resource store
                utilized: 0,
                available: 0,
              },
              risks: {
                high: 0, // Would calculate from risk tracking
                medium: 0,
                low: 0,
              },
            };
          },

          getPortfolioHealth: (portfolioId) => {
            const state = get();
            const portfolio = state.portfolios.find((p) => p.id === portfolioId);
            if (!portfolio) return 'green';

            const projects = state.projects.filter((p) => 
              portfolio.projectIds.includes(p.id)
            );

            return calculateHealth(projects);
          },

          getProjectsByPortfolio: (portfolioId) => {
            const state = get();
            const portfolio = state.portfolios.find((p) => p.id === portfolioId);
            if (!portfolio) return [];

            return state.projects.filter((p) => 
              portfolio.projectIds.includes(p.id)
            );
          },

          // View actions
          setViewMode: (mode) => {
            set((state) => {
              state.viewMode = mode;
            });
          },

          setSortBy: (sortBy) => {
            set((state) => {
              state.sortBy = sortBy;
            });
          },

          toggleSortDirection: () => {
            set((state) => {
              state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
            });
          },

          // Filters
          setHealthFilter: (health) => {
            set((state) => {
              state.filters.health = health;
            });
          },

          setStatusFilter: (status) => {
            set((state) => {
              state.filters.status = status;
            });
          },

          setSearchFilter: (search) => {
            set((state) => {
              state.filters.search = search;
            });
          },

          clearFilters: () => {
            set((state) => {
              state.filters = { health: [], status: [], search: '' };
            });
          },

          // Loading
          setLoading: (loading) => {
            set((state) => {
              state.isLoading = loading;
            });
          },

          setError: (error) => {
            set((state) => {
              state.error = error;
            });
          },
        }))
      ),
      {
        name: 'renkflow-portfolio-store',
        partialize: (state) => ({
          portfolios: state.portfolios,
          projects: state.projects,
          viewMode: state.viewMode,
          sortBy: state.sortBy,
          sortDirection: state.sortDirection,
        }),
      }
    ),
    { name: 'PortfolioStore' }
  )
);

// ============================================
// Selectors
// ============================================

export const selectPortfolios = (state: PortfolioStore) => 
  state.portfolios.filter((p) => !p.isArchived);
export const selectArchivedPortfolios = (state: PortfolioStore) => 
  state.portfolios.filter((p) => p.isArchived);
export const selectActivePortfolio = (state: PortfolioStore) =>
  state.portfolios.find((p) => p.id === state.activePortfolioId);
export const selectFilteredProjects = (state: PortfolioStore) => {
  let projects = state.projects;

  if (state.filters.health.length > 0) {
    projects = projects.filter((p) => state.filters.health.includes(p.health));
  }

  if (state.filters.status.length > 0) {
    projects = projects.filter((p) => state.filters.status.includes(p.status));
  }

  if (state.filters.search) {
    const search = state.filters.search.toLowerCase();
    projects = projects.filter(
      (p) =>
        p.name.toLowerCase().includes(search) ||
        p.owner.name.toLowerCase().includes(search)
    );
  }

  // Sort
  projects = [...projects].sort((a, b) => {
    let comparison = 0;
    switch (state.sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'health':
        const healthOrder = { green: 0, yellow: 1, red: 2 };
        comparison = healthOrder[a.health] - healthOrder[b.health];
        break;
      case 'progress':
        comparison = a.progress - b.progress;
        break;
      case 'startDate':
        comparison = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        break;
      case 'endDate':
        comparison = new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
        break;
    }
    return state.sortDirection === 'asc' ? comparison : -comparison;
  });

  return projects;
};

// ============================================
// Health Status Labels
// ============================================

export const PORTFOLIO_HEALTH_LABELS: Record<PortfolioHealth, string> = {
  green: 'Yolunda',
  yellow: 'Riskli',
  red: 'Kritik',
};

export const PORTFOLIO_HEALTH_COLORS: Record<PortfolioHealth, string> = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
};

export const PROJECT_STATUS_LABELS: Record<ProjectInPortfolio['status'], string> = {
  not_started: 'Başlamadı',
  in_progress: 'Devam Ediyor',
  on_hold: 'Beklemede',
  completed: 'Tamamlandı',
  cancelled: 'İptal Edildi',
};
