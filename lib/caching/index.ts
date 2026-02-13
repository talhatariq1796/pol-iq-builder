/**
 * Smart Caching System for Real Estate Analysis Platform
 * 
 * Provides intelligent caching for processor results with:
 * - TTL-based expiration optimized for real estate query patterns
 * - FSA boundary and clustering parameter awareness
 * - Memory-efficient LRU eviction
 * - Cache hit/miss metrics and monitoring
 * - Query similarity matching for enhanced cache reuse
 * - Automatic cleanup and memory management
 */

export { CacheManager, type CacheConfig, type CacheStats } from './CacheManager';
export { 
  CachedBaseProcessor, 
  CachedProcessorFactory 
} from './CachedBaseProcessor';
export {
  CacheIntegration,
  GlobalCacheIntegration
} from './CacheIntegration';

// Re-export for convenience
export type { ProcessedAnalysisData, AnalysisOptions } from '../analysis/types';