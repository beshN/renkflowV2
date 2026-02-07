/**
 * Resource & Capacity Planning Store - Zustand
 * Workload management, resource allocation, capacity planning
 */

import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  Resource,
  ResourceType,
  ResourceAllocation,
  ResourceCapacity,
  WorkloadSummary,
  CapacityPlan,
} from '@/lib/types/enterprise';

// ============================================
// Types
// ============================================

interface ResourceState {
  // Resources
  resources: Resource[];
  
  // Allocations
  allocations: ResourceAllocation[];
  
  // Capacity Plans
  capacityPlans: CapacityPlan[];
  activeCapacityPlanId: string | null;
  
  // View state
  viewPeriod: 'week' | 'month' | 'quarter';
  selectedResourceId: string | null;
  selectedDate: string;
  
  // Filters
  filters: {
    resourceTypes: ResourceType[];
    showOverallocated: boolean;
    showUnderallocated: boolean;
  };
  
  // Loading
  isLoading: boolean;
  error: string | null;
}

interface ResourceActions {
  // Resource CRUD
  addResource: (resource: Omit<Resource, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateResource: (resourceId: string, updates: Partial<Resource>) => void;
  deleteResource: (resourceId: string) => void;
  
  // Allocation management
  createAllocation: (allocation: Omit<ResourceAllocation, 'id'>) => void;
  updateAllocation: (allocationId: string, updates: Partial<ResourceAllocation>) => void;
  deleteAllocation: (allocationId: string) => void;
  
  // Capacity planning
  createCapacityPlan: (plan: Omit<CapacityPlan, 'id' | 'createdAt' | 'updatedAt'>) => void;
  setActiveCapacityPlan: (planId: string | null) => void;
  
  // Computed getters
  getResourceCapacity: (resourceId: string, startDate: string, endDate: string) => ResourceCapacity;
  getWorkloadSummary: (userId: string, startDate: string, endDate: string) => WorkloadSummary;
  getOverallocatedResources: () => Resource[];
  getAvailableResources: (date: string, hoursNeeded: number) => Resource[];
  
  // View actions
  setViewPeriod: (period: 'week' | 'month' | 'quarter') => void;
  selectResource: (resourceId: string | null) => void;
  setSelectedDate: (date: string) => void;
  
  // Filters
  setResourceTypeFilter: (types: ResourceType[]) => void;
  toggleOverallocatedFilter: () => void;
  toggleUnderallocatedFilter: () => void;
  
  // Data loading
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

type ResourceStore = ResourceState & ResourceActions;

// ============================================
// Helper Functions
// ============================================

function generateId(): string {
  return `res_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getWorkingDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);
  while (current <= endDate) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

function parseDate(dateStr: string): Date {
  return new Date(dateStr);
}

// ============================================
// Initial State
// ============================================

const initialState: ResourceState = {
  resources: [],
  allocations: [],
  capacityPlans: [],
  activeCapacityPlanId: null,
  viewPeriod: 'week',
  selectedResourceId: null,
  selectedDate: new Date().toISOString().split('T')[0],
  filters: {
    resourceTypes: [],
    showOverallocated: false,
    showUnderallocated: false,
  },
  isLoading: false,
  error: null,
};

// ============================================
// Store Implementation
// ============================================

export const useResourceStore = create<ResourceStore>()(
  devtools(
    persist(
      subscribeWithSelector(
        immer((set, get) => ({
          ...initialState,

          // Resource CRUD
          addResource: (resource) => {
            const newResource: Resource = {
              ...resource,
              id: generateId(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            } as Resource;

            set((state) => {
              state.resources.push(newResource);
            });
          },

          updateResource: (resourceId, updates) => {
            set((state) => {
              const index = state.resources.findIndex((r) => r.id === resourceId);
              if (index !== -1) {
                state.resources[index] = {
                  ...state.resources[index],
                  ...updates,
                  updatedAt: new Date().toISOString(),
                };
              }
            });
          },

          deleteResource: (resourceId) => {
            set((state) => {
              state.resources = state.resources.filter((r) => r.id !== resourceId);
              state.allocations = state.allocations.filter((a) => a.resourceId !== resourceId);
            });
          },

          // Allocation management
          createAllocation: (allocation) => {
            const newAllocation: ResourceAllocation = {
              ...allocation,
              id: generateId(),
            };

            set((state) => {
              state.allocations.push(newAllocation);
            });
          },

          updateAllocation: (allocationId, updates) => {
            set((state) => {
              const index = state.allocations.findIndex((a) => a.id === allocationId);
              if (index !== -1) {
                state.allocations[index] = {
                  ...state.allocations[index],
                  ...updates,
                };
              }
            });
          },

          deleteAllocation: (allocationId) => {
            set((state) => {
              state.allocations = state.allocations.filter((a) => a.id !== allocationId);
            });
          },

          // Capacity planning
          createCapacityPlan: (plan) => {
            const newPlan: CapacityPlan = {
              ...plan,
              id: generateId(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            set((state) => {
              state.capacityPlans.push(newPlan);
            });
          },

          setActiveCapacityPlan: (planId) => {
            set((state) => {
              state.activeCapacityPlanId = planId;
            });
          },

          // Computed getters
          getResourceCapacity: (resourceId, startDate, endDate) => {
            const state = get();
            const resource = state.resources.find((r) => r.id === resourceId);
            
            if (!resource) {
              return {
                resourceId,
                resourceName: 'Unknown',
                resourceType: 'human' as ResourceType,
                period: { start: startDate, end: endDate },
                totalCapacity: 0,
                allocatedHours: 0,
                availableHours: 0,
                utilizationRate: 0,
                overallocated: false,
                allocations: [],
              };
            }

            const start = parseDate(startDate);
            const end = parseDate(endDate);
            const workingDays = getWorkingDays(start, end);
            const totalCapacity = workingDays * resource.capacity.hoursPerDay * (resource.capacity.efficiency / 100);

            const relevantAllocations = state.allocations.filter((a) => {
              if (a.resourceId !== resourceId) return false;
              const allocStart = parseDate(a.startDate);
              const allocEnd = parseDate(a.endDate);
              return allocStart <= end && allocEnd >= start;
            });

            const allocatedHours = relevantAllocations.reduce((sum, a) => sum + a.hoursAllocated, 0);
            const availableHours = Math.max(0, totalCapacity - allocatedHours);
            const utilizationRate = totalCapacity > 0 ? (allocatedHours / totalCapacity) * 100 : 0;

            return {
              resourceId,
              resourceName: resource.name,
              resourceType: resource.type,
              period: { start: startDate, end: endDate },
              totalCapacity,
              allocatedHours,
              availableHours,
              utilizationRate,
              overallocated: allocatedHours > totalCapacity,
              allocations: relevantAllocations,
            };
          },

          getWorkloadSummary: (userId, startDate, endDate) => {
            const state = get();
            const resource = state.resources.find(
              (r) => r.type === 'human' && r.metadata?.userId === userId
            );

            if (!resource) {
              return {
                userId,
                userName: 'Unknown',
                period: { start: startDate, end: endDate },
                targetHours: 40,
                allocatedHours: 0,
                completedHours: 0,
                utilizationRate: 0,
                status: 'under' as const,
                tasks: [],
              };
            }

            const capacity = get().getResourceCapacity(resource.id, startDate, endDate);
            const status: 'under' | 'optimal' | 'over' = 
              capacity.utilizationRate < 70 ? 'under' :
              capacity.utilizationRate > 100 ? 'over' : 'optimal';

            return {
              userId,
              userName: resource.name,
              userAvatar: resource.metadata?.avatar as string | undefined,
              period: { start: startDate, end: endDate },
              targetHours: capacity.totalCapacity,
              allocatedHours: capacity.allocatedHours,
              completedHours: capacity.allocations
                .filter((a) => a.status === 'completed')
                .reduce((sum, a) => sum + a.hoursUsed, 0),
              utilizationRate: capacity.utilizationRate,
              status,
              tasks: capacity.allocations.map((a) => ({
                taskId: a.taskId,
                taskName: a.taskName,
                hours: a.hoursAllocated,
              })),
            };
          },

          getOverallocatedResources: () => {
            const state = get();
            const today = new Date().toISOString().split('T')[0];
            const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            return state.resources.filter((r) => {
              const capacity = get().getResourceCapacity(r.id, today, nextWeek);
              return capacity.overallocated;
            });
          },

          getAvailableResources: (date, hoursNeeded) => {
            const state = get();
            const endDate = new Date(parseDate(date).getTime() + 24 * 60 * 60 * 1000)
              .toISOString()
              .split('T')[0];

            return state.resources.filter((r) => {
              if (!r.isActive) return false;
              const capacity = get().getResourceCapacity(r.id, date, endDate);
              return capacity.availableHours >= hoursNeeded;
            });
          },

          // View actions
          setViewPeriod: (period) => {
            set((state) => {
              state.viewPeriod = period;
            });
          },

          selectResource: (resourceId) => {
            set((state) => {
              state.selectedResourceId = resourceId;
            });
          },

          setSelectedDate: (date) => {
            set((state) => {
              state.selectedDate = date;
            });
          },

          // Filters
          setResourceTypeFilter: (types) => {
            set((state) => {
              state.filters.resourceTypes = types;
            });
          },

          toggleOverallocatedFilter: () => {
            set((state) => {
              state.filters.showOverallocated = !state.filters.showOverallocated;
            });
          },

          toggleUnderallocatedFilter: () => {
            set((state) => {
              state.filters.showUnderallocated = !state.filters.showUnderallocated;
            });
          },

          // Data loading
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
        name: 'renkflow-resource-store',
        partialize: (state) => ({
          resources: state.resources,
          allocations: state.allocations,
          viewPeriod: state.viewPeriod,
          filters: state.filters,
        }),
      }
    ),
    { name: 'ResourceStore' }
  )
);

// ============================================
// Selectors
// ============================================

export const selectResources = (state: ResourceStore) => state.resources;
export const selectAllocations = (state: ResourceStore) => state.allocations;
export const selectActiveResources = (state: ResourceStore) => 
  state.resources.filter((r) => r.isActive);
export const selectResourcesByType = (type: ResourceType) => (state: ResourceStore) =>
  state.resources.filter((r) => r.type === type);
export const selectSelectedResource = (state: ResourceStore) =>
  state.resources.find((r) => r.id === state.selectedResourceId);

// ============================================
// Resource Type Labels
// ============================================

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  human: 'Personel',
  machine: 'Makine',
  material: 'Malzeme',
  facility: 'Tesis',
  tool: 'Araç',
};

export const RESOURCE_TYPE_ICONS: Record<ResourceType, string> = {
  human: 'Users',
  machine: 'Cog',
  material: 'Package',
  facility: 'Building',
  tool: 'Wrench',
};
