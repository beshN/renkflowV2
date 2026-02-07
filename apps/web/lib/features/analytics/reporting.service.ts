/**
 * Advanced Reporting Service
 * Report builder, chart generation, and scheduled reports
 */

import type {
  Report,
  ReportExecution,
  ChartType,
  BurndownData,
  CumulativeFlowData,
  CycleTimeData,
  VelocityData,
} from '@/lib/types/enterprise';

// ============================================
// Report Builder
// ============================================

export class ReportBuilder {
  private report: Partial<Report> = {};

  constructor(tenantId: string, createdBy: string) {
    this.report = {
      tenantId,
      createdBy,
      type: 'custom',
      visualizations: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  setName(name: string): ReportBuilder {
    this.report.name = name;
    return this;
  }

  setDescription(description: string): ReportBuilder {
    this.report.description = description;
    return this;
  }

  setCategory(category: Report['category']): ReportBuilder {
    this.report.category = category;
    return this;
  }

  setDataSource(dataSource: Report['dataSource']): ReportBuilder {
    this.report.dataSource = dataSource;
    return this;
  }

  addVisualization(
    type: ChartType,
    title: string,
    config: Record<string, unknown>,
    position: { x: number; y: number; w: number; h: number }
  ): ReportBuilder {
    this.report.visualizations = this.report.visualizations || [];
    this.report.visualizations.push({
      id: `viz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      title,
      config,
      position,
    });
    return this;
  }

  setSchedule(schedule: Report['schedule']): ReportBuilder {
    this.report.schedule = schedule;
    return this;
  }

  build(): Report {
    if (!this.report.name) throw new Error('Report name is required');
    if (!this.report.dataSource) throw new Error('Data source is required');

    return {
      ...this.report,
      id: `report_${Date.now()}`,
    } as Report;
  }
}

// ============================================
// Chart Data Generators
// ============================================

export class ChartDataGenerator {
  // Burndown Chart
  static generateBurndownData(
    tasks: { id: string; status: string; createdAt: string; completedAt?: string }[],
    startDate: Date,
    endDate: Date
  ): BurndownData[] {
    const data: BurndownData[] = [];
    const totalTasks = tasks.length;
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const idealBurnRate = totalTasks / totalDays;

    let remainingTasks = totalTasks;
    let addedTasks = 0;
    let completedTasks = 0;

    for (let i = 0; i <= totalDays; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      // Count tasks completed on this day
      const completedToday = tasks.filter((t) => {
        if (!t.completedAt) return false;
        return t.completedAt.split('T')[0] === dateStr;
      }).length;

      // Count tasks added on this day
      const addedToday = tasks.filter((t) => {
        return t.createdAt.split('T')[0] === dateStr;
      }).length;

      completedTasks += completedToday;
      addedTasks += addedToday;
      remainingTasks = totalTasks + addedTasks - completedTasks;

      data.push({
        date: dateStr,
        idealRemaining: Math.max(0, totalTasks - (idealBurnRate * i)),
        actualRemaining: remainingTasks,
        completed: completedToday,
        added: addedToday,
      });
    }

    return data;
  }

  // Cumulative Flow Diagram
  static generateCumulativeFlowData(
    tasks: { id: string; status: string; statusChanges: { status: string; date: string }[] }[],
    startDate: Date,
    endDate: Date,
    statuses: string[]
  ): CumulativeFlowData[] {
    const data: CumulativeFlowData[] = [];
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    for (let i = 0; i <= totalDays; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      const statusCounts: Record<string, number> = {};
      statuses.forEach((s) => (statusCounts[s] = 0));

      tasks.forEach((task) => {
        // Find the status at this point in time
        const changesBeforeDate = task.statusChanges
          .filter((sc) => sc.date.split('T')[0] <= dateStr)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const statusAtDate = changesBeforeDate[0]?.status || task.status;
        if (statusCounts[statusAtDate] !== undefined) {
          statusCounts[statusAtDate]++;
        }
      });

      data.push({
        date: dateStr,
        statuses: statusCounts,
      });
    }

    return data;
  }

  // Cycle Time Analysis
  static generateCycleTimeData(
    tasks: {
      id: string;
      name: string;
      createdAt: string;
      startedAt?: string;
      completedAt?: string;
    }[]
  ): CycleTimeData[] {
    return tasks
      .filter((t) => t.completedAt && t.startedAt)
      .map((task) => {
        const created = new Date(task.createdAt);
        const started = new Date(task.startedAt!);
        const completed = new Date(task.completedAt!);

        const leadTime = (completed.getTime() - created.getTime()) / (1000 * 60 * 60);
        const cycleTime = (completed.getTime() - started.getTime()) / (1000 * 60 * 60);
        const waitTime = (started.getTime() - created.getTime()) / (1000 * 60 * 60);

        return {
          taskId: task.id,
          taskName: task.name,
          startDate: task.startedAt!,
          endDate: task.completedAt!,
          cycleTime,
          leadTime,
          waitTime,
          workTime: cycleTime, // Simplified - would need actual work time tracking
        };
      });
  }

  // Velocity Chart
  static generateVelocityData(
    sprints: {
      name: string;
      startDate: string;
      endDate: string;
      plannedPoints: number;
      completedPoints: number;
    }[]
  ): VelocityData[] {
    return sprints.map((sprint, index) => {
      const previousVelocity = index > 0 ? sprints[index - 1].completedPoints : sprint.completedPoints;
      const trend = previousVelocity > 0
        ? ((sprint.completedPoints - previousVelocity) / previousVelocity) * 100
        : 0;

      return {
        period: sprint.name,
        planned: sprint.plannedPoints,
        completed: sprint.completedPoints,
        velocity: sprint.completedPoints,
        trend,
      };
    });
  }

  // Status Distribution (Pie/Donut)
  static generateStatusDistribution(
    tasks: { status: string }[]
  ): { status: string; count: number; percentage: number }[] {
    const counts: Record<string, number> = {};
    tasks.forEach((t) => {
      counts[t.status] = (counts[t.status] || 0) + 1;
    });

    const total = tasks.length;
    return Object.entries(counts).map(([status, count]) => ({
      status,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    }));
  }

  // Time Series (Line/Area)
  static generateTimeSeriesData(
    data: { date: string; value: number }[],
    groupBy: 'day' | 'week' | 'month' = 'day'
  ): { date: string; value: number }[] {
    if (groupBy === 'day') return data;

    const grouped: Record<string, number[]> = {};

    data.forEach((d) => {
      const date = new Date(d.date);
      let key: string;

      if (groupBy === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay() + 1);
        key = weekStart.toISOString().split('T')[0];
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(d.value);
    });

    return Object.entries(grouped)
      .map(([date, values]) => ({
        date,
        value: values.reduce((sum, v) => sum + v, 0) / values.length,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // Heatmap Data (Activity/Workload)
  static generateHeatmapData(
    activities: { date: string; hour: number; count: number }[]
  ): { day: number; hour: number; value: number }[][] {
    const heatmap: { day: number; hour: number; value: number }[][] = Array.from(
      { length: 7 },
      (_, day) =>
        Array.from({ length: 24 }, (_, hour) => ({
          day,
          hour,
          value: 0,
        }))
    );

    activities.forEach((a) => {
      const date = new Date(a.date);
      const day = date.getDay();
      const hour = a.hour;
      heatmap[day][hour].value += a.count;
    });

    return heatmap;
  }
}

// ============================================
// Report Executor
// ============================================

export class ReportExecutor {
  static async execute(
    report: Report,
    parameters?: Record<string, unknown>
  ): Promise<ReportExecution> {
    const startTime = Date.now();
    const execution: ReportExecution = {
      id: `exec_${Date.now()}`,
      reportId: report.id,
      executedAt: new Date().toISOString(),
      executedBy: parameters?.userId as string || 'system',
      duration: 0,
      rowCount: 0,
      status: 'success',
    };

    try {
      // Fetch data based on data source
      const data = await this.fetchData(report.dataSource, parameters);
      execution.rowCount = Array.isArray(data) ? data.length : 1;

      // Generate output based on format
      if (report.schedule?.format) {
        execution.outputUrl = await this.generateOutput(report, data, report.schedule.format);
      }

      execution.duration = Date.now() - startTime;
      return execution;
    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      execution.duration = Date.now() - startTime;
      return execution;
    }
  }

  private static async fetchData(
    dataSource: Report['dataSource'],
    parameters?: Record<string, unknown>
  ): Promise<unknown[]> {
    // This would query the database based on dataSource configuration
    // For now, return mock data
    console.log('[ReportExecutor] Fetching data for:', dataSource.type);
    return [];
  }

  private static async generateOutput(
    report: Report,
    data: unknown[],
    format: 'pdf' | 'excel' | 'csv'
  ): Promise<string> {
    // This would generate the actual file
    console.log(`[ReportExecutor] Generating ${format} output for report: ${report.name}`);
    return `/reports/${report.id}/${Date.now()}.${format}`;
  }
}

// ============================================
// Pre-built Report Templates
// ============================================

export const REPORT_TEMPLATES: Partial<Report>[] = [
  {
    name: 'Günlük Üretim Raporu',
    description: 'Günlük üretim özeti ve performans metrikleri',
    type: 'template',
    category: 'production',
    dataSource: {
      type: 'orders',
      filters: [
        { field: 'date', operator: 'equals', value: '{{today}}' },
      ],
      groupBy: ['status'],
      aggregations: [
        { field: 'id', function: 'count', alias: 'count' },
        { field: 'totalAmount', function: 'sum', alias: 'revenue' },
      ],
    },
    visualizations: [
      {
        id: 'status-pie',
        type: 'pie',
        title: 'Durum Dağılımı',
        config: { field: 'status' },
        position: { x: 0, y: 0, w: 6, h: 4 },
      },
      {
        id: 'hourly-production',
        type: 'bar',
        title: 'Saatlik Üretim',
        config: { xField: 'hour', yField: 'count' },
        position: { x: 6, y: 0, w: 6, h: 4 },
      },
    ],
  },
  {
    name: 'Haftalık Performans Raporu',
    description: 'Haftalık sipariş ve gelir analizi',
    type: 'template',
    category: 'productivity',
    dataSource: {
      type: 'orders',
      filters: [],
      groupBy: ['date'],
      aggregations: [
        { field: 'id', function: 'count', alias: 'orderCount' },
        { field: 'totalAmount', function: 'sum', alias: 'revenue' },
      ],
      dateRange: {
        field: 'date',
        preset: 'this_week',
      },
    },
    visualizations: [
      {
        id: 'daily-orders',
        type: 'line',
        title: 'Günlük Sipariş Sayısı',
        config: { xField: 'date', yField: 'orderCount' },
        position: { x: 0, y: 0, w: 12, h: 4 },
      },
      {
        id: 'daily-revenue',
        type: 'area',
        title: 'Günlük Gelir',
        config: { xField: 'date', yField: 'revenue' },
        position: { x: 0, y: 4, w: 12, h: 4 },
      },
    ],
  },
  {
    name: 'Çalışan Verimliliği',
    description: 'Çalışan bazlı performans metrikleri',
    type: 'template',
    category: 'resources',
    dataSource: {
      type: 'time_entries',
      filters: [],
      groupBy: ['userId'],
      aggregations: [
        { field: 'duration', function: 'sum', alias: 'totalHours' },
        { field: 'id', function: 'count', alias: 'entryCount' },
      ],
    },
    visualizations: [
      {
        id: 'hours-by-user',
        type: 'bar',
        title: 'Çalışan Bazlı Saat',
        config: { xField: 'userName', yField: 'totalHours' },
        position: { x: 0, y: 0, w: 8, h: 4 },
      },
      {
        id: 'workload-heatmap',
        type: 'heatmap',
        title: 'İş Yükü Dağılımı',
        config: {},
        position: { x: 8, y: 0, w: 4, h: 4 },
      },
    ],
  },
  {
    name: 'Sipariş Teslim Analizi',
    description: 'Teslim süresi ve gecikme analizi',
    type: 'template',
    category: 'quality',
    dataSource: {
      type: 'orders',
      filters: [
        { field: 'status', operator: 'equals', value: 'delivered' },
      ],
      groupBy: [],
      aggregations: [],
    },
    visualizations: [
      {
        id: 'delivery-time',
        type: 'line',
        title: 'Ortalama Teslim Süresi',
        config: {},
        position: { x: 0, y: 0, w: 6, h: 4 },
      },
      {
        id: 'on-time-rate',
        type: 'gauge',
        title: 'Zamanında Teslim Oranı',
        config: { min: 0, max: 100, thresholds: [60, 80, 95] },
        position: { x: 6, y: 0, w: 6, h: 4 },
      },
    ],
  },
  {
    name: 'Finansal Özet',
    description: 'Gelir, gider ve karlılık raporu',
    type: 'template',
    category: 'finance',
    dataSource: {
      type: 'orders',
      filters: [],
      groupBy: ['month'],
      aggregations: [
        { field: 'totalAmount', function: 'sum', alias: 'revenue' },
      ],
    },
    visualizations: [
      {
        id: 'revenue-trend',
        type: 'area',
        title: 'Gelir Trendi',
        config: { xField: 'month', yField: 'revenue' },
        position: { x: 0, y: 0, w: 12, h: 4 },
      },
      {
        id: 'revenue-breakdown',
        type: 'stacked_bar',
        title: 'Gelir Dağılımı',
        config: {},
        position: { x: 0, y: 4, w: 8, h: 4 },
      },
      {
        id: 'top-customers',
        type: 'table',
        title: 'En İyi Müşteriler',
        config: { limit: 10 },
        position: { x: 8, y: 4, w: 4, h: 4 },
      },
    ],
  },
];

// ============================================
// Chart Type Labels
// ============================================

export const CHART_TYPE_LABELS: Record<ChartType, string> = {
  bar: 'Çubuk Grafik',
  stacked_bar: 'Yığılmış Çubuk',
  line: 'Çizgi Grafik',
  area: 'Alan Grafik',
  pie: 'Pasta Grafik',
  donut: 'Halka Grafik',
  funnel: 'Huni',
  heatmap: 'Isı Haritası',
  scatter: 'Dağılım',
  radar: 'Radar',
  treemap: 'Ağaç Haritası',
  sankey: 'Sankey',
  gauge: 'Gösterge',
  number: 'Sayı',
  table: 'Tablo',
  pivot: 'Pivot Tablo',
};
