/* eslint-disable @typescript-eslint/no-explicit-any */
import { 
  RawAnalysisResult, 
  ProcessedAnalysisData, 
  DataProcessorStrategy,
  AnalysisOptions,
  ProcessingContext
} from '../analysis/types';
import { CacheManager, CacheStats } from './CacheManager';

/**
 * Cache integration helper that can be used to wrap existing processor logic
 * without modifying the original processor implementations.
 * 
 * This provides a non-invasive way to add caching to the existing DataProcessor.
 */
export class CacheIntegration {
  private cacheManager: CacheManager;
  private enabled: boolean;

  constructor(enabled: boolean = true) {
    this.cacheManager = CacheManager.getInstance();
    this.enabled = enabled;
  }

  /**
   * Wrap a processor function with caching logic
   */
  public wrapProcessorFunction<T extends ProcessedAnalysisData>(
    endpoint: string,
    processorFn: (rawData: RawAnalysisResult) => T,
    rawData: RawAnalysisResult,
    query?: string,
    options?: AnalysisOptions
  ): T {
    // Skip caching if disabled or no query
    if (!this.enabled || !query) {
      return processorFn(rawData);
    }

    // Try cache first
    const cached = this.cacheManager.get(endpoint, query, options);
    if (cached) {
      console.log(`[CacheIntegration] Cache hit for ${endpoint}`);
      return cached as T;
    }

    // Try similar query
    const similar = this.cacheManager.findSimilar(endpoint, query, options, 0.8);
    if (similar) {
      console.log(`[CacheIntegration] Similar cache hit for ${endpoint}`);
      return similar as T;
    }

    // Process and cache
    const startTime = Date.now();
    const result = processorFn(rawData);
    const processingTime = Date.now() - startTime;

    // Cache the result
    this.cacheManager.set(endpoint, query, options, result);
    
    console.log(`[CacheIntegration] Processed and cached ${endpoint} in ${processingTime}ms`);
    return result;
  }

  /**
   * Enable or disable caching
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if caching is enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get cache statistics
   */
  public getStats(): CacheStats {
    return this.cacheManager.getStats();
  }

  /**
   * Invalidate cache entries
   */
  public invalidate(criteria?: {
    endpoint?: string;
    queryPattern?: string;
    spatialFilterIds?: string[];
    projectType?: string;
  }): number {
    return this.cacheManager.invalidate(criteria || {});
  }

  /**
   * Clear all cache
   */
  public clear(): void {
    this.cacheManager.clear();
  }

  /**
   * Create a cached version of a processor
   */
  public createCachedProcessor(
    originalProcessor: DataProcessorStrategy,
    endpoint: string
  ): CachedProcessorWrapper {
    return new CachedProcessorWrapper(originalProcessor, endpoint, this.cacheManager);
  }

  /**
   * Get cache manager instance
   */
  public getCacheManager(): CacheManager {
    return this.cacheManager;
  }
}

/**
 * Wrapper that makes any processor cacheable
 */
class CachedProcessorWrapper implements DataProcessorStrategy {
  private processor: DataProcessorStrategy;
  private endpoint: string;
  private cacheManager: CacheManager;

  constructor(
    processor: DataProcessorStrategy,
    endpoint: string,
    cacheManager: CacheManager
  ) {
    this.processor = processor;
    this.endpoint = endpoint;
    this.cacheManager = cacheManager;
  }

  validate(rawData: RawAnalysisResult): boolean {
    return this.processor.validate(rawData);
  }

  async process(
    rawData: RawAnalysisResult,
    context?: ProcessingContext
  ): Promise<ProcessedAnalysisData> {
    // Extract query and options from context
    const query = typeof context === 'string' ? context : context?.query;
    const options = typeof context === 'object' ? (context as any).options : undefined;
    
    // If no query, process without caching
    if (!query) {
      return await Promise.resolve(this.processor.process(rawData));
    }

    // Try cache first
    const cached = this.cacheManager.get(this.endpoint, query, options);
    if (cached) {
      console.log(`[CachedProcessorWrapper] Cache hit for ${this.endpoint}`);
      return cached;
    }

    // Try similar query
    const similar = this.cacheManager.findSimilar(this.endpoint, query, options, 0.8);
    if (similar) {
      console.log(`[CachedProcessorWrapper] Similar cache hit for ${this.endpoint}`);
      return similar;
    }

    // Process and cache
    const result = await Promise.resolve(this.processor.process(rawData));
    this.cacheManager.set(this.endpoint, query, options, result);
    
    return result;
  }
}

/**
 * Global cache integration singleton
 */
export class GlobalCacheIntegration {
  private static instance: CacheIntegration | null = null;

  public static getInstance(): CacheIntegration {
    if (!GlobalCacheIntegration.instance) {
      GlobalCacheIntegration.instance = new CacheIntegration(true);
      console.log('[GlobalCacheIntegration] Initialized global cache integration');
    }
    return GlobalCacheIntegration.instance;
  }

  public static resetInstance(): void {
    if (GlobalCacheIntegration.instance) {
      GlobalCacheIntegration.instance.clear();
    }
    GlobalCacheIntegration.instance = null;
  }
}