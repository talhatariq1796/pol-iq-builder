import { LayerConfig } from '@/types/layers';

interface LayerMetrics {
  usageCount: number;
  errorCount: number;
  totalLoadTime: number;
  loadCount: number;
  lastAccess: Date;
}

class LayerMetricsTracker {
  private static instance: LayerMetricsTracker;
  private metrics: Map<string, LayerMetrics> = new Map();
  private readonly STORAGE_KEY = 'layer_metrics';

  private constructor() {
    this.loadMetrics();
  }

  public static getInstance(): LayerMetricsTracker {
    if (!LayerMetricsTracker.instance) {
      LayerMetricsTracker.instance = new LayerMetricsTracker();
    }
    return LayerMetricsTracker.instance;
  }

  private loadMetrics(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        Object.entries(parsed).forEach(([key, value]) => {
          this.metrics.set(key, {
            ...value as LayerMetrics,
            lastAccess: new Date((value as LayerMetrics).lastAccess)
          });
        });
      }
    } catch (error) {
      console.error('Failed to load layer metrics:', error);
    }
  }

  private saveMetrics(): void {
    try {
      const toStore = Object.fromEntries(this.metrics);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(toStore));
    } catch (error) {
      console.error('Failed to save layer metrics:', error);
    }
  }

  public trackLayerAccess(layerId: string): void {
    const current = this.metrics.get(layerId) || {
      usageCount: 0,
      errorCount: 0,
      totalLoadTime: 0,
      loadCount: 0,
      lastAccess: new Date()
    };

    this.metrics.set(layerId, {
      ...current,
      usageCount: current.usageCount + 1,
      lastAccess: new Date()
    });

    this.saveMetrics();
  }

  public trackLayerError(layerId: string): void {
    const current = this.metrics.get(layerId) || {
      usageCount: 0,
      errorCount: 0,
      totalLoadTime: 0,
      loadCount: 0,
      lastAccess: new Date()
    };

    this.metrics.set(layerId, {
      ...current,
      errorCount: current.errorCount + 1,
      lastAccess: new Date()
    });

    this.saveMetrics();
  }

  public trackLayerLoadTime(layerId: string, loadTime: number): void {
    const current = this.metrics.get(layerId) || {
      usageCount: 0,
      errorCount: 0,
      totalLoadTime: 0,
      loadCount: 0,
      lastAccess: new Date()
    };

    this.metrics.set(layerId, {
      ...current,
      totalLoadTime: current.totalLoadTime + loadTime,
      loadCount: current.loadCount + 1,
      lastAccess: new Date()
    });

    this.saveMetrics();
  }

  public getLayerMetrics(layerId: string): LayerMetrics {
    return this.metrics.get(layerId) || {
      usageCount: 0,
      errorCount: 0,
      totalLoadTime: 0,
      loadCount: 0,
      lastAccess: new Date()
    };
  }

  public getErrorRate(layerId: string): number {
    const metrics = this.getLayerMetrics(layerId);
    if (metrics.usageCount === 0) return 0;
    return metrics.errorCount / metrics.usageCount;
  }

  public getAverageLoadTime(layerId: string): number {
    const metrics = this.getLayerMetrics(layerId);
    if (metrics.loadCount === 0) return 0;
    return metrics.totalLoadTime / metrics.loadCount;
  }
}

export const layerMetricsTracker = LayerMetricsTracker.getInstance(); 