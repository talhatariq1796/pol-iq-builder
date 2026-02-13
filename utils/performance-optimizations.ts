import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { Extent } from '@arcgis/core/geometry';
import SpatialReference from '@arcgis/core/geometry/SpatialReference';
import * as geometryEngineAsync from '@arcgis/core/geometry/geometryEngineAsync';

/**
 * Performance optimization utilities for the visualization system
 */

// Cache for storing processed features and calculations
const featureCache = new Map<string, any>();
const calculationCache = new Map<string, any>();

// Configuration for progressive loading
export interface ProgressiveLoadingConfig {
  batchSize: number;
  delayBetweenBatches: number;
  maxFeaturesPerBatch: number;
}

const defaultProgressiveLoadingConfig: ProgressiveLoadingConfig = {
  batchSize: 100,
  delayBetweenBatches: 50,
  maxFeaturesPerBatch: 1000
};

/**
 * Progressive loading of features to improve initial render time
 */
export async function loadFeaturesProgressively(
  features: Graphic[],
  layer: FeatureLayer,
  config: ProgressiveLoadingConfig = defaultProgressiveLoadingConfig
): Promise<void> {
  const totalFeatures = features.length;
  const batches = Math.ceil(totalFeatures / config.batchSize);
  
  for (let i = 0; i < batches; i++) {
    const start = i * config.batchSize;
    const end = Math.min(start + config.batchSize, totalFeatures);
    const batch = features.slice(start, end);
    
    // Add batch to layer
    await layer.applyEdits({
      addFeatures: batch
    });
    
    // Wait before processing next batch
    if (i < batches - 1) {
      await new Promise(resolve => setTimeout(resolve, config.delayBetweenBatches));
    }
  }
}

/**
 * Optimize feature processing by caching results
 */
export function getCachedFeatureProcessing(
  features: Graphic[],
  processingKey: string,
  processor: (features: Graphic[]) => any
): any {
  const cacheKey = `${processingKey}-${features.length}`;
  
  if (featureCache.has(cacheKey)) {
    return featureCache.get(cacheKey);
  }
  
  const result = processor(features);
  featureCache.set(cacheKey, result);
  return result;
}

/**
 * Optimize extent calculation for large feature sets
 */
export async function calculateOptimizedExtent(
  features: Graphic[],
  targetSR?: SpatialReference
): Promise<Extent | null> {
  if (features.length === 0) return null;
  
  // For small feature sets, use direct calculation
  if (features.length <= 100) {
    const geometries = features
      .map(f => f.geometry)
      .filter((g): g is __esri.GeometryUnion => g != null && g.type != null)
      .map(g => g as __esri.Polygon); // Cast to Polygon for union operation
    
    if (geometries.length === 0) return null;
    
    return (await geometryEngineAsync.union(geometries))?.extent || null;
  }
  
  // For large feature sets, use sampling
  const sampleSize = Math.min(100, features.length);
  const step = Math.floor(features.length / sampleSize);
  const sampledFeatures = features.filter((_, i) => i % step === 0);
  
  const geometries = sampledFeatures
    .map(f => f.geometry)
    .filter((g): g is __esri.GeometryUnion => g != null && g.type != null)
    .map(g => g as __esri.Polygon); // Cast to Polygon for union operation
  
  if (geometries.length === 0) return null;
  
  const extent = (await geometryEngineAsync.union(geometries))?.extent || null;
  
  // Expand extent to account for sampled features
  if (extent) {
    extent.expand(1.1);
  }
  
  return extent;
}

/**
 * Optimize spatial clustering for large point datasets
 */
export function optimizeSpatialClustering(
  points: Graphic[],
  maxPoints: number = 1000
): Graphic[] {
  if (points.length <= maxPoints) return points;
  
  // Use grid-based sampling for large datasets
  const gridSize = Math.ceil(Math.sqrt(points.length / maxPoints));
  const grid: Map<string, Graphic[]> = new Map();
  
  points.forEach(point => {
    if (!point.geometry) return;
    
    const x = Math.floor((point.geometry as any).x / gridSize);
    const y = Math.floor((point.geometry as any).y / gridSize);
    const key = `${x},${y}`;
    
    if (!grid.has(key)) {
      grid.set(key, []);
    }
    grid.get(key)?.push(point);
  });
  
  // Sample one point from each grid cell
  return Array.from(grid.values())
    .map(cell => cell[Math.floor(Math.random() * cell.length)])
    .filter((point): point is Graphic => point != null);
}

/**
 * Clear all caches
 */
export function clearCaches(): void {
  featureCache.clear();
  calculationCache.clear();
}

/**
 * Memory management utilities
 */
export const memoryManagement = {
  /**
   * Estimate memory usage of features
   */
  estimateFeatureMemoryUsage(features: Graphic[]): number {
    return features.reduce((total, feature) => {
      // Rough estimate: 100 bytes per attribute + geometry size
      const attributeSize = JSON.stringify(feature.attributes).length;
      const geometrySize = feature.geometry ? JSON.stringify(feature.geometry).length : 0;
      return total + attributeSize + geometrySize + 100;
    }, 0);
  },
  
  /**
   * Check if memory usage is within acceptable limits
   */
  isMemoryUsageAcceptable(features: Graphic[], maxMemoryMB: number = 100): boolean {
    const estimatedMemory = this.estimateFeatureMemoryUsage(features);
    return estimatedMemory < maxMemoryMB * 1024 * 1024;
  },
  
  /**
   * Get recommended batch size based on feature complexity
   */
  getRecommendedBatchSize(features: Graphic[]): number {
    const avgFeatureSize = this.estimateFeatureMemoryUsage(features) / features.length;
    if (avgFeatureSize > 10000) return 100;
    if (avgFeatureSize > 5000) return 500;
    return 1000;
  }
};

/**
 * Performance monitoring utilities
 */
export const performanceMonitoring = {
  timers: new Map<string, number>(),
  
  startTimer(key: string): void {
    this.timers.set(key, performance.now());
  },
  
  endTimer(key: string): number {
    const startTime = this.timers.get(key);
    if (startTime === undefined) return 0;
    
    const duration = performance.now() - startTime;
    this.timers.delete(key);
    return duration;
  },
  
  logPerformance(key: string, duration: number): void {
    console.log(`Performance [${key}]: ${duration.toFixed(2)}ms`);
  }
}; 