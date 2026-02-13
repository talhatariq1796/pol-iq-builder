import { AnalysisResult } from '@/types/analysis';

interface CacheEntry {
  result: AnalysisResult;
  timestamp: number;
  expiresAt: number;
}

export class AnalysisCache {
  private static instance: AnalysisCache;
  private cache: Map<string, CacheEntry>;
  private readonly DEFAULT_TTL = 3600000; // 1 hour in milliseconds
  private readonly MAX_CACHE_SIZE = 100;

  private constructor() {
    this.cache = new Map();
    this.startCleanupInterval();
  }

  public static getInstance(): AnalysisCache {
    if (!AnalysisCache.instance) {
      AnalysisCache.instance = new AnalysisCache();
    }
    return AnalysisCache.instance;
  }

  private generateCacheKey(query: any): string {
    return JSON.stringify({
      analysis_type: query.analysis_type,
      target_variable: query.target_variable,
      demographic_filters: query.demographic_filters,
      original_query: query.original_query
    });
  }

  public get(query: any): AnalysisResult | null {
    const key = this.generateCacheKey(query);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.result;
  }

  public set(query: any, result: AnalysisResult, ttl: number = this.DEFAULT_TTL): void {
    const key = this.generateCacheKey(query);
    
    // Check cache size and remove oldest entries if needed
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.removeOldestEntries();
    }

    this.cache.set(key, {
      result,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl
    });
  }

  private removeOldestEntries(): void {
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove 20% of oldest entries
    const entriesToRemove = Math.ceil(this.MAX_CACHE_SIZE * 0.2);
    entries.slice(0, entriesToRemove).forEach(([key]) => {
      this.cache.delete(key);
    });
  }

  private startCleanupInterval(): void {
    // Clean up expired entries every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (now > entry.expiresAt) {
          this.cache.delete(key);
        }
      }
    }, 300000);
  }

  public clear(): void {
    this.cache.clear();
  }

  public getStats(): { size: number; oldestEntry: number; newestEntry: number } {
    if (this.cache.size === 0) {
      return { size: 0, oldestEntry: 0, newestEntry: 0 };
    }

    const timestamps = Array.from(this.cache.values()).map(entry => entry.timestamp);
    return {
      size: this.cache.size,
      oldestEntry: Math.min(...timestamps),
      newestEntry: Math.max(...timestamps)
    };
  }
} 