/**
 * Task Dependencies System
 * Graph structure, validation, and critical path analysis
 */

import type {
  Dependency,
  DependencyType,
  DependencyNode,
  CriticalPathResult,
  Milestone,
  FloatAnalysis,
} from '@/lib/types/enterprise';

// ============================================
// Graph Data Structure (Adjacency List)
// ============================================

export class DependencyGraph {
  private nodes: Map<string, DependencyNode> = new Map();
  private adjacencyList: Map<string, Set<string>> = new Map(); // outgoing edges
  private reverseAdjacencyList: Map<string, Set<string>> = new Map(); // incoming edges
  private dependencies: Map<string, Dependency> = new Map();

  constructor(tasks: DependencyNode[], dependencies: Dependency[]) {
    // Initialize nodes
    tasks.forEach((task) => {
      this.nodes.set(task.taskId, { ...task });
      this.adjacencyList.set(task.taskId, new Set());
      this.reverseAdjacencyList.set(task.taskId, new Set());
    });

    // Initialize edges from dependencies
    dependencies.forEach((dep) => {
      this.addDependency(dep);
    });
  }

  addDependency(dep: Dependency): boolean {
    // Validate that both tasks exist
    if (!this.nodes.has(dep.sourceTaskId) || !this.nodes.has(dep.targetTaskId)) {
      return false;
    }

    // Check for self-dependency
    if (dep.sourceTaskId === dep.targetTaskId) {
      return false;
    }

    // Check if adding this would create a cycle
    if (this.wouldCreateCycle(dep.sourceTaskId, dep.targetTaskId)) {
      return false;
    }

    // Add the edge
    this.adjacencyList.get(dep.sourceTaskId)?.add(dep.targetTaskId);
    this.reverseAdjacencyList.get(dep.targetTaskId)?.add(dep.sourceTaskId);
    this.dependencies.set(dep.id, dep);

    // Update node dependency lists
    const sourceNode = this.nodes.get(dep.sourceTaskId);
    const targetNode = this.nodes.get(dep.targetTaskId);
    if (sourceNode) sourceNode.dependents.push(dep.id);
    if (targetNode) targetNode.dependencies.push(dep.id);

    return true;
  }

  removeDependency(depId: string): boolean {
    const dep = this.dependencies.get(depId);
    if (!dep) return false;

    this.adjacencyList.get(dep.sourceTaskId)?.delete(dep.targetTaskId);
    this.reverseAdjacencyList.get(dep.targetTaskId)?.delete(dep.sourceTaskId);
    this.dependencies.delete(depId);

    // Update node dependency lists
    const sourceNode = this.nodes.get(dep.sourceTaskId);
    const targetNode = this.nodes.get(dep.targetTaskId);
    if (sourceNode) {
      sourceNode.dependents = sourceNode.dependents.filter((id) => id !== depId);
    }
    if (targetNode) {
      targetNode.dependencies = targetNode.dependencies.filter((id) => id !== depId);
    }

    return true;
  }

  // ============================================
  // Cycle Detection (DFS-based)
  // ============================================

  wouldCreateCycle(from: string, to: string): boolean {
    // Check if adding edge from -> to would create a cycle
    // This happens if there's already a path from 'to' to 'from'
    const visited = new Set<string>();
    const stack = [to];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === from) return true;
      if (visited.has(current)) continue;

      visited.add(current);
      const neighbors = this.adjacencyList.get(current);
      if (neighbors) {
        neighbors.forEach((n) => stack.push(n));
      }
    }

    return false;
  }

  detectCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string): boolean => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = this.adjacencyList.get(node);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            if (dfs(neighbor)) return true;
          } else if (recursionStack.has(neighbor)) {
            // Found a cycle
            const cycleStart = path.indexOf(neighbor);
            cycles.push(path.slice(cycleStart));
            return true;
          }
        }
      }

      path.pop();
      recursionStack.delete(node);
      return false;
    };

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId);
      }
    }

    return cycles;
  }

  // ============================================
  // Topological Sort (Kahn's Algorithm)
  // ============================================

  topologicalSort(): string[] | null {
    const inDegree = new Map<string, number>();
    const queue: string[] = [];
    const result: string[] = [];

    // Initialize in-degrees
    for (const nodeId of this.nodes.keys()) {
      inDegree.set(nodeId, this.reverseAdjacencyList.get(nodeId)?.size || 0);
    }

    // Find all nodes with no incoming edges
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      const neighbors = this.adjacencyList.get(current);
      if (neighbors) {
        for (const neighbor of neighbors) {
          const newDegree = (inDegree.get(neighbor) || 0) - 1;
          inDegree.set(neighbor, newDegree);
          if (newDegree === 0) {
            queue.push(neighbor);
          }
        }
      }
    }

    // If result doesn't include all nodes, there's a cycle
    if (result.length !== this.nodes.size) {
      return null;
    }

    return result;
  }

  // ============================================
  // Critical Path Method (CPM)
  // ============================================

  calculateCriticalPath(): CriticalPathResult {
    const nodes = Array.from(this.nodes.values());
    const sortedIds = this.topologicalSort();

    if (!sortedIds) {
      throw new Error('Cannot calculate critical path: graph contains cycles');
    }

    // Forward pass - calculate early start and early finish
    for (const taskId of sortedIds) {
      const node = this.nodes.get(taskId)!;
      const predecessors = this.reverseAdjacencyList.get(taskId);

      let earlyStart = node.startDate;

      if (predecessors && predecessors.size > 0) {
        let maxEarlyFinish = new Date(0);
        for (const predId of predecessors) {
          const predNode = this.nodes.get(predId)!;
          const dep = this.findDependency(predId, taskId);
          
          let finishDate = predNode.earlyFinish || predNode.endDate;
          
          // Apply lag
          if (dep) {
            finishDate = this.applyLag(finishDate, dep);
          }

          if (finishDate > maxEarlyFinish) {
            maxEarlyFinish = finishDate;
          }
        }
        earlyStart = maxEarlyFinish;
      }

      node.earlyStart = earlyStart;
      node.earlyFinish = this.addHours(earlyStart, node.duration);
    }

    // Find project end date
    let projectEnd = new Date(0);
    for (const node of nodes) {
      if (node.earlyFinish && node.earlyFinish > projectEnd) {
        projectEnd = node.earlyFinish;
      }
    }

    // Backward pass - calculate late start and late finish
    for (let i = sortedIds.length - 1; i >= 0; i--) {
      const taskId = sortedIds[i];
      const node = this.nodes.get(taskId)!;
      const successors = this.adjacencyList.get(taskId);

      let lateFinish = projectEnd;

      if (successors && successors.size > 0) {
        let minLateStart = new Date(8640000000000000); // Max date
        for (const succId of successors) {
          const succNode = this.nodes.get(succId)!;
          const dep = this.findDependency(taskId, succId);
          
          let startDate = succNode.lateStart || succNode.startDate;
          
          // Apply lag (reverse)
          if (dep) {
            startDate = this.applyLag(startDate, dep, true);
          }

          if (startDate < minLateStart) {
            minLateStart = startDate;
          }
        }
        lateFinish = minLateStart;
      }

      node.lateFinish = lateFinish;
      node.lateStart = this.subtractHours(lateFinish, node.duration);

      // Calculate float
      node.totalFloat = this.getHoursDiff(node.earlyStart!, node.lateStart!);
      node.freeFloat = this.calculateFreeFloat(node, taskId);

      // Mark as critical if float is 0
      node.isCritical = node.totalFloat === 0;
    }

    // Build critical path
    const criticalPath: string[] = [];
    for (const taskId of sortedIds) {
      const node = this.nodes.get(taskId)!;
      if (node.isCritical) {
        criticalPath.push(taskId);
      }
    }

    // Calculate total duration
    const startNode = nodes.reduce((min, n) => 
      (n.earlyStart! < min.earlyStart!) ? n : min
    );
    const endNode = nodes.reduce((max, n) => 
      (n.earlyFinish! > max.earlyFinish!) ? n : max
    );

    const totalDuration = this.getHoursDiff(startNode.earlyStart!, endNode.earlyFinish!);

    // Build float analysis
    const floatAnalysis: FloatAnalysis[] = nodes.map((node) => ({
      taskId: node.taskId,
      taskName: node.taskName,
      totalFloat: node.totalFloat,
      freeFloat: node.freeFloat,
      isCritical: node.isCritical,
    }));

    // Find milestones (tasks with 0 duration or marked as milestone)
    const milestones: Milestone[] = nodes
      .filter((n) => n.duration === 0)
      .map((n) => ({
        id: n.taskId,
        name: n.taskName,
        date: n.earlyStart!,
        taskId: n.taskId,
        isCompleted: n.progress === 100,
      }));

    return {
      criticalPath,
      totalDuration,
      startDate: startNode.earlyStart!,
      endDate: endNode.earlyFinish!,
      milestones,
      floatAnalysis,
    };
  }

  // ============================================
  // Delay Impact Analysis
  // ============================================

  analyzeDelayImpact(taskId: string, delayHours: number): {
    affectedTasks: string[];
    newEndDate: Date;
    delayPropagation: Map<string, number>;
  } {
    const delayPropagation = new Map<string, number>();
    const affectedTasks: string[] = [];

    const node = this.nodes.get(taskId);
    if (!node) {
      throw new Error(`Task ${taskId} not found`);
    }

    // BFS to propagate delay
    const queue: { id: string; delay: number }[] = [{ id: taskId, delay: delayHours }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { id, delay } = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);

      const currentNode = this.nodes.get(id)!;
      
      // Only propagate if delay exceeds float
      const effectiveDelay = Math.max(0, delay - currentNode.totalFloat);
      if (effectiveDelay > 0 || id === taskId) {
        delayPropagation.set(id, delay);
        affectedTasks.push(id);

        // Propagate to successors
        const successors = this.adjacencyList.get(id);
        if (successors) {
          for (const succId of successors) {
            const dep = this.findDependency(id, succId);
            const lagHours = dep ? dep.lagDays * 24 + dep.lagHours : 0;
            queue.push({ id: succId, delay: effectiveDelay });
          }
        }
      }
    }

    // Calculate new end date
    const result = this.calculateCriticalPath();
    const newEndDate = this.addHours(result.endDate, delayHours);

    return {
      affectedTasks,
      newEndDate,
      delayPropagation,
    };
  }

  // ============================================
  // Helper Methods
  // ============================================

  private findDependency(sourceId: string, targetId: string): Dependency | undefined {
    for (const dep of this.dependencies.values()) {
      if (dep.sourceTaskId === sourceId && dep.targetTaskId === targetId) {
        return dep;
      }
    }
    return undefined;
  }

  private applyLag(date: Date, dep: Dependency, reverse = false): Date {
    const lagMs = (dep.lagDays * 24 + dep.lagHours) * 60 * 60 * 1000;
    return new Date(date.getTime() + (reverse ? -lagMs : lagMs));
  }

  private addHours(date: Date, hours: number): Date {
    return new Date(date.getTime() + hours * 60 * 60 * 1000);
  }

  private subtractHours(date: Date, hours: number): Date {
    return new Date(date.getTime() - hours * 60 * 60 * 1000);
  }

  private getHoursDiff(start: Date, end: Date): number {
    return Math.round((end.getTime() - start.getTime()) / (60 * 60 * 1000));
  }

  private calculateFreeFloat(node: DependencyNode, taskId: string): number {
    const successors = this.adjacencyList.get(taskId);
    if (!successors || successors.size === 0) return 0;

    let minSuccEarlyStart = new Date(8640000000000000);
    for (const succId of successors) {
      const succNode = this.nodes.get(succId)!;
      if (succNode.earlyStart! < minSuccEarlyStart) {
        minSuccEarlyStart = succNode.earlyStart!;
      }
    }

    return this.getHoursDiff(node.earlyFinish!, minSuccEarlyStart);
  }

  // ============================================
  // Getters
  // ============================================

  getNode(taskId: string): DependencyNode | undefined {
    return this.nodes.get(taskId);
  }

  getNodes(): DependencyNode[] {
    return Array.from(this.nodes.values());
  }

  getDependencies(): Dependency[] {
    return Array.from(this.dependencies.values());
  }

  getPredecessors(taskId: string): string[] {
    return Array.from(this.reverseAdjacencyList.get(taskId) || []);
  }

  getSuccessors(taskId: string): string[] {
    return Array.from(this.adjacencyList.get(taskId) || []);
  }
}

// ============================================
// Dependency Validation
// ============================================

export function validateDependency(
  dep: Partial<Dependency>,
  existingDependencies: Dependency[],
  tasks: { id: string }[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required fields
  if (!dep.sourceTaskId) errors.push('Kaynak görev gerekli');
  if (!dep.targetTaskId) errors.push('Hedef görev gerekli');
  if (!dep.type) errors.push('Bağımlılık tipi gerekli');

  // Check if tasks exist
  const taskIds = new Set(tasks.map((t) => t.id));
  if (dep.sourceTaskId && !taskIds.has(dep.sourceTaskId)) {
    errors.push('Kaynak görev bulunamadı');
  }
  if (dep.targetTaskId && !taskIds.has(dep.targetTaskId)) {
    errors.push('Hedef görev bulunamadı');
  }

  // Check self-reference
  if (dep.sourceTaskId && dep.sourceTaskId === dep.targetTaskId) {
    errors.push('Görev kendine bağımlı olamaz');
  }

  // Check for duplicate
  const isDuplicate = existingDependencies.some(
    (d) =>
      d.sourceTaskId === dep.sourceTaskId &&
      d.targetTaskId === dep.targetTaskId
  );
  if (isDuplicate) {
    errors.push('Bu bağımlılık zaten mevcut');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================
// Dependency Type Helpers
// ============================================

export const DEPENDENCY_TYPE_LABELS: Record<DependencyType, string> = {
  FS: 'Bitir-Başla (FS)',
  SS: 'Başla-Başla (SS)',
  FF: 'Bitir-Bitir (FF)',
  SF: 'Başla-Bitir (SF)',
};

export const DEPENDENCY_TYPE_DESCRIPTIONS: Record<DependencyType, string> = {
  FS: 'Görev B, Görev A bittikten sonra başlar',
  SS: 'Görev B, Görev A başladığında başlar',
  FF: 'Görev B, Görev A bittiğinde biter',
  SF: 'Görev B, Görev A başladığında biter',
};

export function getDefaultDependencyType(): DependencyType {
  return 'FS';
}

// ============================================
// Export Utilities
// ============================================

export function exportDependenciesToMermaid(
  tasks: { id: string; name: string }[],
  dependencies: Dependency[]
): string {
  let mermaid = 'gantt\n';
  mermaid += '    title Proje Zaman Çizelgesi\n';
  mermaid += '    dateFormat YYYY-MM-DD\n\n';

  // Add tasks
  tasks.forEach((task) => {
    mermaid += `    ${task.name} : ${task.id}, 1d\n`;
  });

  // Note: Mermaid Gantt doesn't support dependencies directly
  // but we can add a comment section
  if (dependencies.length > 0) {
    mermaid += '\n    %% Dependencies:\n';
    dependencies.forEach((dep) => {
      mermaid += `    %% ${dep.sourceTaskId} --${dep.type}--> ${dep.targetTaskId}\n`;
    });
  }

  return mermaid;
}
