/* eslint-disable @typescript-eslint/no-explicit-any */
import { ProcessedAnalysisData, AnalysisOptions } from '../analysis/types';
import { AnalysisConfigurationManager } from '../analysis/AnalysisConfigurationManager';
import { createHash } from 'crypto';

/**
 * Cache entry structure with TTL and metadata
 */
interface CacheEntry {
  key: string;
  data: ProcessedAnalysisData;
  timestamp: number;
  ttl: number;
  expiresAt: number;
  query: string;
  options: AnalysisOptions;
  hitCount: number;
  lastAccessed: number;
  size: number; // Approximate size in bytes
}

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
  totalEntries: number;
  totalSize: number; // Approximate size in bytes
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
  entriesByTTL: Record<number, number>;
  oldestEntry: number | null;
  newestEntry: number | null;
  averageSize: number;
}

/**
 * Cache configuration options
 */
export interface CacheConfig {
  maxEntries: number;
  maxSizeBytes: number;
  defaultTtlMs: number;
  cleanupIntervalMs: number;
  enableMetrics: boolean;
  keyFields: string[];
  // Real estate specific settings
  fsaBoundaryTtlMs: number;
  clusteringTtlMs: number;
  spatialFilterTtlMs: number;
}

/**
 * Smart caching system for processor results
 * 
 * Features:
 * - TTL-based expiration with different TTLs for different query types
 * - Memory-efficient LRU eviction
 * - FSA boundary and clustering parameter awareness
 * - Cache hit/miss metrics
 * - Automatic cleanup and memory management
 * - Query similarity matching
 */
export class CacheManager {
  private static instance: CacheManager | null = null;
  private cache = new Map<string, CacheEntry>();
  private config: CacheConfig;
  private metrics = {
    hits: 0,
    misses: 0,
    evictions: 0,
    cleanups: 0
  };
  private cleanupTimer: NodeJS.Timeout | null = null;
  private configManager: AnalysisConfigurationManager;

  private constructor(config?: Partial<CacheConfig>) {
    this.configManager = AnalysisConfigurationManager.getInstance();
    this.config = {
      maxEntries: 100,
      maxSizeBytes: 50 * 1024 * 1024, // 50MB default
      defaultTtlMs: 30 * 60 * 1000, // 30 minutes
      cleanupIntervalMs: 5 * 60 * 1000, // 5 minutes
      enableMetrics: true,
      keyFields: ['endpoint', 'query', 'spatialFilterIds', 'clustering'],
      // Real estate specific TTLs
      fsaBoundaryTtlMs: 60 * 60 * 1000, // 1 hour (boundaries change infrequently)
      clusteringTtlMs: 15 * 60 * 1000, // 15 minutes (clustering can be dynamic)
      spatialFilterTtlMs: 45 * 60 * 1000, // 45 minutes (spatial filters are semi-static)
      ...config
    };

    this.startCleanupTimer();
    console.log('[CacheManager] Initialized with config:', {
      maxEntries: this.config.maxEntries,
      maxSizeMB: Math.round(this.config.maxSizeBytes / 1024 / 1024),
      defaultTtlMinutes: Math.round(this.config.defaultTtlMs / 60 / 1000),
      cleanupIntervalMinutes: Math.round(this.config.cleanupIntervalMs / 60 / 1000)
    });
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: Partial<CacheConfig>): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager(config);
    }
    return CacheManager.instance;
  }

  /**
   * Generate cache key based on query content and parameters
   */
  public generateCacheKey(
    endpoint: string,
    query: string,
    options: AnalysisOptions = {}
  ): string {
    // Extract relevant parameters for cache key
    const keyData = {
      endpoint: endpoint.toLowerCase(),
      query: this.normalizeQuery(query),
      // Include spatial and clustering parameters that affect results
      spatialFilterIds: options.spatialFilterIds ? [...options.spatialFilterIds].sort() : null,
      clustering: (options as any).clustering ? {
        enabled: (options as any).clustering.enabled,
        method: (options as any).clustering.method,
        minClusterSize: (options as any).clustering.minClusterSize,
        maxClusters: (options as any).clustering.maxClusters
      } : null,
      // Include FSA boundary parameters
      fsaBoundary: (options as any).fsaBoundary || null,
      // Include project type as it affects processing
      projectType: this.configManager.getCurrentProjectType()
    };

    // Create hash from normalized key data
    const keyString = JSON.stringify(keyData);
    const hash = createHash('sha256').update(keyString).digest('hex').substring(0, 16);
    
    // Create human-readable prefix for debugging
    const prefix = `${endpoint.replace('/', '')}_${this.getQueryType(query)}_${hash}`;
    
    return prefix;
  }

  /**
   * Get cached result if available and not expired
   */
  public get(
    endpoint: string,
    query: string,
    options: AnalysisOptions = {}
  ): ProcessedAnalysisData | null {
    const key = this.generateCacheKey(endpoint, query, options);
    const entry = this.cache.get(key);

    if (!entry) {
      this.metrics.misses++;
      return null;
    }

    const now = Date.now();
    
    // Check if expired
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      this.metrics.misses++;
      console.log(`[CacheManager] Cache entry expired: ${key}`);
      return null;
    }

    // Update access statistics
    entry.hitCount++;
    entry.lastAccessed = now;
    this.metrics.hits++;

    console.log(`[CacheManager] Cache hit: ${key} (hits: ${entry.hitCount})`);
    return entry.data;
  }

  /**
   * Store result in cache
   */
  public set(
    endpoint: string,
    query: string,
    options: AnalysisOptions = {},
    data: ProcessedAnalysisData
  ): void {
    const key = this.generateCacheKey(endpoint, query, options);
    const now = Date.now();
    const ttl = this.determineTTL(endpoint, query, options);
    const size = this.estimateSize(data);

    // Check if we need to evict entries
    this.evictIfNecessary(size);

    const entry: CacheEntry = {
      key,
      data,
      timestamp: now,
      ttl,
      expiresAt: now + ttl,
      query: query.substring(0, 200), // Store truncated query for debugging
      options,
      hitCount: 0,
      lastAccessed: now,
      size
    };

    this.cache.set(key, entry);
    
    console.log(`[CacheManager] Cached result: ${key} (TTL: ${Math.round(ttl / 60000)}min, Size: ${Math.round(size / 1024)}KB)`);
  }

  /**
   * Check if a similar query result exists in cache
   */
  public findSimilar(
    endpoint: string,
    query: string,
    options: AnalysisOptions = {},
    similarityThreshold: number = 0.8
  ): ProcessedAnalysisData | null {
    const normalizedQuery = this.normalizeQuery(query);
    
    for (const entry of this.cache.values()) {
      // Skip if different endpoint
      if (!entry.key.startsWith(endpoint.replace('/', ''))) {
        continue;
      }

      // Skip if expired
      if (Date.now() > entry.expiresAt) {
        continue;
      }

      // Check query similarity
      const entryQueryNormalized = this.normalizeQuery(entry.query);
      const similarity = this.calculateQuerySimilarity(normalizedQuery, entryQueryNormalized);
      
      if (similarity >= similarityThreshold) {
        // Check if spatial/clustering parameters are compatible
        if (this.areOptionsCompatible(options, entry.options)) {
          console.log(`[CacheManager] Found similar cached query (similarity: ${similarity.toFixed(2)}): ${entry.key}`);
          
          // Update access statistics
          entry.hitCount++;
          entry.lastAccessed = Date.now();
          this.metrics.hits++;
          
          return entry.data;
        }
      }
    }

    this.metrics.misses++;
    return null;
  }

  /**
   * Invalidate cache entries matching criteria
   */
  public invalidate(criteria: {
    endpoint?: string;
    queryPattern?: string;
    spatialFilterIds?: string[];
    projectType?: string;
  }): number {
    let removed = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      let shouldRemove = false;

      if (criteria.endpoint && !entry.key.startsWith(criteria.endpoint.replace('/', ''))) {
        continue;
      }

      if (criteria.queryPattern) {
        const pattern = new RegExp(criteria.queryPattern, 'i');
        if (pattern.test(entry.query)) {
          shouldRemove = true;
        }
      }

      if (criteria.spatialFilterIds && entry.options.spatialFilterIds) {
        // Check if any spatial filter overlaps
        const hasOverlap = entry.options.spatialFilterIds.some(id => 
          criteria.spatialFilterIds!.includes(id)
        );
        if (hasOverlap) {
          shouldRemove = true;
        }
      }

      if (criteria.projectType) {
        // This would require storing project type in cache entry - adding for future
        shouldRemove = true; // For now, invalidate all when project type changes
      }

      if (shouldRemove) {
        this.cache.delete(key);
        removed++;
      }
    }

    console.log(`[CacheManager] Invalidated ${removed} cache entries`, criteria);
    return removed;
  }

  /**
   * Get cache statistics
   */
  public getStats(): CacheStats {
    const entries = Array.from(this.cache.values());
    const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
    const totalRequests = this.metrics.hits + this.metrics.misses;
    
    const entriesByTTL: Record<number, number> = {};
    entries.forEach(entry => {
      const ttlMinutes = Math.round(entry.ttl / 60000);
      entriesByTTL[ttlMinutes] = (entriesByTTL[ttlMinutes] || 0) + 1;
    });

    return {
      totalEntries: entries.length,
      totalSize,
      hitRate: totalRequests > 0 ? this.metrics.hits / totalRequests : 0,
      missRate: totalRequests > 0 ? this.metrics.misses / totalRequests : 0,
      totalHits: this.metrics.hits,
      totalMisses: this.metrics.misses,
      entriesByTTL,
      oldestEntry: entries.length > 0 ? Math.min(...entries.map(e => e.timestamp)) : null,
      newestEntry: entries.length > 0 ? Math.max(...entries.map(e => e.timestamp)) : null,
      averageSize: entries.length > 0 ? totalSize / entries.length : 0
    };
  }

  /**
   * Clear all cache entries
   */
  public clear(): void {
    const entriesCleared = this.cache.size;
    this.cache.clear();
    console.log(`[CacheManager] Cleared ${entriesCleared} cache entries`);
  }

  /**
   * Clear expired entries manually
   */
  public clearExpired(): number {
    const now = Date.now();
    let removed = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }
    
    this.metrics.cleanups++;
    console.log(`[CacheManager] Cleaned up ${removed} expired entries`);
    return removed;
  }

  /**
   * Shutdown and cleanup resources
   */
  public shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
    console.log('[CacheManager] Shutdown complete');
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.clearExpired();
      this.enforceMemoryLimits();
    }, this.config.cleanupIntervalMs);
  }

  private determineTTL(endpoint: string, query: string, options: AnalysisOptions): number {
    // Real estate specific TTL logic
    if (options.spatialFilterIds && options.spatialFilterIds.length > 0) {
      return this.config.spatialFilterTtlMs;
    }
    
    if ((options as any).clustering && (options as any).clustering.enabled) {
      return this.config.clusteringTtlMs;
    }
    
    // FSA boundary queries can be cached longer
    if (query.toLowerCase().includes('fsa') || query.toLowerCase().includes('boundary')) {
      return this.config.fsaBoundaryTtlMs;
    }
    
    // Market analysis queries are fairly stable
    if (endpoint.includes('market') || endpoint.includes('price') || endpoint.includes('cma')) {
      return this.config.defaultTtlMs * 1.5; // 45 minutes
    }
    
    return this.config.defaultTtlMs;
  }

  private normalizeQuery(query: string): string {
    return query.toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .trim();
  }

  private getQueryType(query: string): string {
    const q = query.toLowerCase();
    if (q.includes('price') || q.includes('cost')) return 'price';
    if (q.includes('market') || q.includes('trend')) return 'market';
    if (q.includes('cluster') || q.includes('group')) return 'cluster';
    if (q.includes('compare') || q.includes('vs')) return 'compare';
    if (q.includes('predict') || q.includes('forecast')) return 'predict';
    return 'general';
  }

  private calculateQuerySimilarity(query1: string, query2: string): number {
    const words1 = new Set(query1.split(' '));
    const words2 = new Set(query2.split(' '));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private areOptionsCompatible(options1: AnalysisOptions, options2: AnalysisOptions): boolean {
    // Check spatial filter compatibility
    if (options1.spatialFilterIds && options2.spatialFilterIds) {
      const overlap = options1.spatialFilterIds.filter(id => 
        options2.spatialFilterIds!.includes(id)
      );
      // Require at least 70% overlap
      const minLength = Math.min(options1.spatialFilterIds.length, options2.spatialFilterIds.length);
      return overlap.length / minLength >= 0.7;
    }

    // If one has spatial filters and the other doesn't, they're not compatible
    if (options1.spatialFilterIds || options2.spatialFilterIds) {
      return false;
    }

    // Check clustering compatibility
    const clustering1 = (options1 as any).clustering;
    const clustering2 = (options2 as any).clustering;
    
    if (clustering1 && clustering2) {
      return clustering1.enabled === clustering2.enabled &&
             clustering1.method === clustering2.method &&
             Math.abs((clustering1.minClusterSize || 0) - (clustering2.minClusterSize || 0)) <= 2;
    }

    return !clustering1 && !clustering2;
  }

  private estimateSize(data: ProcessedAnalysisData): number {
    // Rough estimation of memory usage
    const jsonString = JSON.stringify(data);
    return jsonString.length * 2; // Approximate bytes (UTF-16)
  }

  private evictIfNecessary(newEntrySize: number): void {
    const currentSize = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.size, 0);
    
    // Check if we're over limits
    const wouldExceedSize = currentSize + newEntrySize > this.config.maxSizeBytes;
    const wouldExceedCount = this.cache.size >= this.config.maxEntries;
    
    if (wouldExceedSize || wouldExceedCount) {
      this.evictLRU(newEntrySize);
    }
  }

  private evictLRU(spaceNeeded: number): void {
    // Sort by last accessed (LRU first)
    const sortedEntries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);
    
    let freedSpace = 0;
    let evicted = 0;
    
    for (const [key, entry] of sortedEntries) {
      this.cache.delete(key);
      freedSpace += entry.size;
      evicted++;
      
      // Stop when we've freed enough space and are under count limit
      if (freedSpace >= spaceNeeded && this.cache.size < this.config.maxEntries * 0.8) {
        break;
      }
    }
    
    this.metrics.evictions += evicted;
    console.log(`[CacheManager] Evicted ${evicted} LRU entries, freed ${Math.round(freedSpace / 1024)}KB`);
  }

  private enforceMemoryLimits(): void {
    const stats = this.getStats();
    
    // If we're over 90% of memory limit, proactively evict
    if (stats.totalSize > this.config.maxSizeBytes * 0.9) {
      const targetSize = this.config.maxSizeBytes * 0.7; // Target 70% usage
      this.evictLRU(stats.totalSize - targetSize);
    }
  }
}