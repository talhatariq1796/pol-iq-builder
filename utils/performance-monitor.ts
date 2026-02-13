import type { LayerConfig } from '@/types/layers';
import type { LayerMatch } from '@/types/geospatial-ai-types';

interface PerformanceMetric {
  timestamp: number;
  duration: number;
  component: string;
  operation: string;
  details?: Record<string, any>;
}

interface PerformanceStats {
  avgDuration: number;
  maxDuration: number;
  minDuration: number;
  totalOperations: number;
  successRate: number;
  errorRate: number;
  lastUpdated: number;
}

interface ComponentStats {
  [component: string]: {
    [operation: string]: PerformanceStats;
  };
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[];
  private stats: ComponentStats;
  private readonly maxMetrics: number = 1000;
  private readonly statsUpdateInterval: number = 60000; // 1 minute

  constructor() {
    this.metrics = [];
    this.stats = {};
  }

  startOperation(component: string, operation: string, details?: Record<string, any>): () => void {
    const startTime = performance.now();
    const metric: PerformanceMetric = {
      timestamp: Date.now(),
      duration: 0,
      component,
      operation,
      details
    };

    return () => {
      metric.duration = performance.now() - startTime;
      this.addMetric(metric);
      this.updateStats();
    };
  }

  private addMetric(metric: PerformanceMetric) {
    this.metrics.push(metric);
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }
  }

  private updateStats() {
    const now = Date.now();
    const components = new Set(this.metrics.map(m => m.component));

    components.forEach(component => {
      if (!this.stats[component]) {
        this.stats[component] = {};
      }

      const componentMetrics = this.metrics.filter(m => m.component === component);
      const operations = new Set(componentMetrics.map(m => m.operation));

      operations.forEach(operation => {
        const operationMetrics = componentMetrics.filter(m => m.operation === operation);
        const durations = operationMetrics.map(m => m.duration);
        const errors = operationMetrics.filter(m => m.details?.error).length;

        this.stats[component][operation] = {
          avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
          maxDuration: Math.max(...durations),
          minDuration: Math.min(...durations),
          totalOperations: durations.length,
          successRate: (durations.length - errors) / durations.length,
          errorRate: errors / durations.length,
          lastUpdated: now
        };
      });
    });
  }

  getComponentStats(component: string): Record<string, PerformanceStats> {
    return this.stats[component] || {};
  }

  getOperationStats(component: string, operation: string): PerformanceStats | null {
    return this.stats[component]?.[operation] || null;
  }

  getLayerPerformanceStats(layerId: string): PerformanceStats | null {
    return this.getOperationStats('layer', layerId);
  }

  getQueryPerformanceStats(query: string): PerformanceStats | null {
    return this.getOperationStats('query', query);
  }

  getLayerMatchPerformance(layerMatch: LayerMatch): PerformanceStats | null {
    return this.getOperationStats('layerMatch', layerMatch.layerId);
  }

  getRecentMetrics(limit: number = 10): PerformanceMetric[] {
    return this.metrics.slice(-limit);
  }

  getSlowestOperations(limit: number = 5): PerformanceMetric[] {
    return [...this.metrics]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  getErrorMetrics(): PerformanceMetric[] {
    return this.metrics.filter(m => m.details?.error);
  }

  getPerformanceReport(): Record<string, any> {
    const report: Record<string, any> = {
      timestamp: Date.now(),
      totalMetrics: this.metrics.length,
      components: {},
      slowestOperations: this.getSlowestOperations(5).map(m => ({
        component: m.component,
        operation: m.operation,
        duration: m.duration,
        timestamp: m.timestamp
      })),
      errorCount: this.getErrorMetrics().length
    };

    Object.entries(this.stats).forEach(([component, operations]) => {
      report.components[component] = {
        totalOperations: Object.values(operations).reduce((sum, stat) => sum + stat.totalOperations, 0),
        avgSuccessRate: Object.values(operations).reduce((sum, stat) => sum + stat.successRate, 0) / Object.keys(operations).length,
        operations: Object.entries(operations).map(([op, stat]) => ({
          name: op,
          ...stat
        }))
      };
    });

    return report;
  }

  clearMetrics(): void {
    this.metrics = [];
    this.stats = {};
  }

  // Helper method to monitor layer operations
  monitorLayerOperation(
    layer: LayerConfig,
    operation: string,
    callback: () => Promise<any>
  ): Promise<any> {
    const endOperation = this.startOperation('layer', layer.id, {
      layerName: layer.name,
      layerType: layer.type,
      operation
    });

    return callback().finally(endOperation);
  }

  // Helper method to monitor query operations
  monitorQueryOperation(
    query: string,
    callback: () => Promise<any>
  ): Promise<any> {
    const endOperation = this.startOperation('query', query);

    return callback().finally(endOperation);
  }

  // Helper method to monitor layer matching
  monitorLayerMatching(
    layerMatch: LayerMatch,
    callback: () => Promise<any>
  ): Promise<any> {
    const endOperation = this.startOperation('layerMatch', layerMatch.layerId, {
      matchMethod: layerMatch.matchMethod,
      confidence: layerMatch.confidence
    });

    return callback().finally(endOperation);
  }
} 