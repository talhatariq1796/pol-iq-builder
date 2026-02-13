/* eslint-disable @typescript-eslint/no-explicit-any */
import { 
  DataProcessorStrategy, 
  RawAnalysisResult, 
  ProcessedAnalysisData,
  AnalysisOptions,
  ProcessingContext
} from '../analysis/types';
import { BaseProcessor } from '../analysis/strategies/processors/BaseProcessor';
import { CacheManager, CacheStats } from './CacheManager';

/**
 * Cache-enabled base processor that wraps the existing BaseProcessor
 * with intelligent caching capabilities.
 * 
 * This decorator pattern allows us to add caching to any processor
 * without modifying the existing processor implementations.
 */
export class CachedBaseProcessor implements DataProcessorStrategy {
  protected processor: BaseProcessor;
  protected cacheManager: CacheManager;
  protected endpoint: string;

  constructor(processor: BaseProcessor, endpoint: string) {
    this.processor = processor;
    this.endpoint = endpoint;
    this.cacheManager = CacheManager.getInstance();
  }

  /**
   * Validate raw data - delegates to wrapped processor
   */
  validate(rawData: RawAnalysisResult): boolean {
    return this.processor.validate(rawData);
  }

  /**
   * Process with caching - checks cache first, then processes and caches
   */
  process(rawData: RawAnalysisResult, context?: ProcessingContext): ProcessedAnalysisData {
    // Extract query and options from context if provided
    const query = typeof context === 'string' ? context : context?.query;
    const options = typeof context === 'object' ? (context as any).options : undefined;
    
    // If no query provided, proceed without caching
    if (!query) {
      console.log('[CachedBaseProcessor] No query provided, skipping cache');
      return this.processor.process(rawData);
    }

    // Try to get from cache first
    const cached = this.cacheManager.get(this.endpoint, query, options);
    if (cached) {
      console.log(`[CachedBaseProcessor] Cache hit for ${this.endpoint}: ${query.substring(0, 50)}...`);
      return cached;
    }

    // Try to find similar cached result
    const similar = this.cacheManager.findSimilar(this.endpoint, query, options, 0.8);
    if (similar) {
      console.log(`[CachedBaseProcessor] Similar cache hit for ${this.endpoint}: ${query.substring(0, 50)}...`);
      return similar;
    }

    // Cache miss - process and cache the result
    const startTime = Date.now();
    const result = this.processor.process(rawData);
    const processingTime = Date.now() - startTime;

    // Cache the result
    this.cacheManager.set(this.endpoint, query, options, result);
    
    console.log(`[CachedBaseProcessor] Processed and cached ${this.endpoint} (${processingTime}ms): ${query.substring(0, 50)}...`);
    
    return result;
  }

  /**
   * Get cache statistics for this processor
   */
  public getCacheStats(): CacheStats {
    return this.cacheManager.getStats();
  }

  /**
   * Invalidate cache entries for this processor
   */
  public invalidateCache(criteria?: {
    queryPattern?: string;
    spatialFilterIds?: string[];
  }): number {
    return this.cacheManager.invalidate({
      endpoint: this.endpoint,
      ...criteria
    });
  }

  /**
   * Clear all cache entries for this processor
   */
  public clearCache(): void {
    this.cacheManager.invalidate({ endpoint: this.endpoint });
  }

  /**
   * Get the wrapped processor instance
   */
  public getProcessor(): BaseProcessor {
    return this.processor;
  }

  /**
   * Get the endpoint this processor handles
   */
  public getEndpoint(): string {
    return this.endpoint;
  }
}

/**
 * Factory for creating cached processors
 */
export class CachedProcessorFactory {
  private static cacheManager: CacheManager | null = null;

  /**
   * Initialize the cache manager with custom configuration
   */
  public static initializeCache(config?: Parameters<typeof CacheManager.getInstance>[0]): void {
    this.cacheManager = CacheManager.getInstance(config);
  }

  /**
   * Wrap any processor with caching capabilities
   */
  public static wrapProcessor(processor: BaseProcessor, endpoint: string): CachedBaseProcessor {
    return new CachedBaseProcessor(processor, endpoint);
  }

  /**
   * Create a cached processor for a specific endpoint and processor type
   */
  public static createCachedProcessor<T extends BaseProcessor>(
    ProcessorClass: new () => T,
    endpoint: string
  ): CachedBaseProcessor {
    const processor = new ProcessorClass();
    return new CachedBaseProcessor(processor, endpoint);
  }

  /**
   * Get global cache statistics across all processors
   */
  public static getGlobalCacheStats(): CacheStats | null {
    return this.cacheManager ? this.cacheManager.getStats() : null;
  }

  /**
   * Invalidate cache across all processors
   */
  public static invalidateGlobalCache(criteria?: {
    queryPattern?: string;
    spatialFilterIds?: string[];
    projectType?: string;
  }): number {
    return this.cacheManager ? this.cacheManager.invalidate(criteria || {}) : 0;
  }

  /**
   * Clear all cached results
   */
  public static clearGlobalCache(): void {
    if (this.cacheManager) {
      this.cacheManager.clear();
    }
  }
}