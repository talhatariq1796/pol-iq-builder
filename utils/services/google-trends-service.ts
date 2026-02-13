import { layers } from '../../config/layers';
import type { LayerConfig } from '../../types/layers';

interface TrendsDataOptions {
  region?: 'ON' | 'BC' | 'ALL';
  minSearchVolume?: number;
  sortByVolume?: boolean;
  limit?: number;
}

interface TrendsDataResult {
  term: string;
  layerId: string;
  region: 'ON' | 'BC';
  volume: number;
}

export class GoogleTrendsService {
  // Cache of trend data for performance
  private static trendsCache: Record<string, TrendsDataResult[]> = {};
  private static cacheExpiration: Date | null = null;
  private static CACHE_DURATION_MS = 3600000; // 1 hour

  /**
   * Get Google Trends data from layers
   */
  public static getTrendsData(options: TrendsDataOptions = {}): TrendsDataResult[] {
    // Return from cache if available and not expired
    const cacheKey = JSON.stringify(options);
    if (
      this.trendsCache[cacheKey] &&
      this.cacheExpiration &&
      this.cacheExpiration > new Date()
    ) {
      return this.trendsCache[cacheKey];
    }

    const {
      region = 'ALL',
      minSearchVolume = 0,
      sortByVolume = true,
      // By default, do NOT limit results
      limit = Number.MAX_SAFE_INTEGER // Effectively no limit unless explicitly specified
    } = options;

    console.log(`[GoogleTrendsService] Getting trends data with options:`, { 
      region, 
      minSearchVolume, 
      sortByVolume, 
      limit: limit === Number.MAX_SAFE_INTEGER ? 'unlimited' : limit
    });

    // Get all trend layers
    const trendLayers = Object.values(layers).filter(layer => {
      if (layer.status !== 'active') return false;
      if (!layer.metadata?.tags?.includes('trends')) return false;
      
      // Filter by region if specified
      if (region !== 'ALL') {
        if (region === 'ON' && !layer.id.includes('ON')) return false;
        if (region === 'BC' && !layer.id.includes('BC')) return false;
      }
      
      return true;
    });

    console.log(`[GoogleTrendsService] Found ${trendLayers.length} trend layers`);

    // Map layers to trend data results
    const results: TrendsDataResult[] = trendLayers.map(layer => {
      // Extract the search term from the layer name (removing quotes)
      const term = layer.name.replace(/"/g, '');
      // Determine region from layer ID
      const layerRegion = layer.id.includes('ON') ? 'ON' as const : 'BC' as const;
      
      // For a real implementation, we would query the layer to get actual values
      // Here we're using a placeholder value based on layer index position
      const layerIndex = Object.keys(layers).indexOf(layer.id);
      const volumeBase = (layerIndex % 10) * 10 + 50; // Just a demo value between 50-150
      
      return {
        term,
        layerId: layer.id,
        region: layerRegion,
        volume: volumeBase
      };
    }).filter(result => result.volume >= minSearchVolume);

    // Sort results if needed
    if (sortByVolume) {
      results.sort((a, b) => b.volume - a.volume);
    }

    // Apply limit ONLY if explicitly specified with a reasonable value
    // (we've set a default of MAX_SAFE_INTEGER above to avoid accidental limiting)
    const limitedResults = limit < Number.MAX_SAFE_INTEGER ? results.slice(0, limit) : results;

    console.log(`[GoogleTrendsService] Returning ${limitedResults.length} trends results out of ${results.length} total`);

    // Update cache
    this.trendsCache[cacheKey] = limitedResults;
    this.cacheExpiration = new Date(Date.now() + this.CACHE_DURATION_MS);

    return limitedResults;
  }
  
  /**
   * Create a virtual feature set for trends visualization
   * This can be used directly in the visualization process
   */
  public static createVirtualTrendsFeatures(keyword: string, region: 'ON' | 'BC' = 'ON') {
    console.log(`[GoogleTrendsService] Creating virtual features for '${keyword}' in ${region}`);
    
    // Get trends data
    const trendsData = this.getPopularSearchTerms(region);
    
    // Create features in the format expected by visualization components
    return trendsData.map(item => ({
      id: `trend-${item.term}`,
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [0, 0] // Placeholder coordinates, will be joined with boundaries later
      },
      properties: {
        OBJECTID: Math.floor(Math.random() * 1000000),
        value: item.volume,
        term: item.term,
        region: item.region,
        keyword: keyword // Add original search keyword
      }
    }));
  }

  /**
   * Get trending topics for a specific query
   * @param query User query
   * @param options Options for filtering trend data
   */
  public static getTrendingTopicsForQuery(
    query: string,
    options: TrendsDataOptions = {}
  ): TrendsDataResult[] {
    const queryLower = query.toLowerCase();
    const allTrends = this.getTrendsData(options);
    
    // Extract keywords from the query
    const keywords = this.extractKeywords(queryLower);
    
    // Score each trend based on relevance to query
    const scoredTrends = allTrends.map(trend => {
      const termLower = trend.term.toLowerCase();
      let score = 0;
      
      // Direct match with trend term
      if (queryLower.includes(termLower)) {
        score += 100;
      }
      
      // Score based on keyword matches
      keywords.forEach(keyword => {
        if (termLower.includes(keyword)) {
          score += 20;
        }
      });
      
      return {
        ...trend,
        score
      };
    });
    
    // Filter for trends with non-zero scores and sort by score
    return scoredTrends
      .filter(trend => trend.score > 0)
      .sort((a, b) => b.score - a.score);
  }
  
  /**
   * Compare search interest between terms
   */
  public static compareTerms(
    terms: string[],
    region: 'ON' | 'BC' = 'ON'
  ): { term: string; volume: number }[] {
    const allTrends = this.getTrendsData({ region });
    
    return terms.map(term => {
      const matchingTrend = allTrends.find(
        trend => trend.term.toLowerCase() === term.toLowerCase()
      );
      
      return {
        term,
        volume: matchingTrend?.volume || 0
      };
    }).sort((a, b) => b.volume - a.volume);
  }
  
  /**
   * Extract keywords from a query
   */
  private static extractKeywords(query: string): string[] {
    // Remove common words and tokenize
    const stopWords = ['and', 'the', 'in', 'for', 'of', 'on', 'to', 'with', 'a', 'is', 'are', 'what', 'show', 'me', 'tell', 'where', 'how', 'why', 'who', 'which'];
    
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter(word => 
        word.length > 2 && 
        !stopWords.includes(word) &&
        !word.match(/^\d+$/) // Exclude pure numbers
      );
  }
  
  /**
   * Get most popular search terms
   */
  public static getPopularSearchTerms(
    region: 'ON' | 'BC' | 'ALL' = 'ALL',
    limit: number = Number.MAX_SAFE_INTEGER // Default to no limit
  ): TrendsDataResult[] {
    console.log(`[GoogleTrendsService] Getting popular search terms for region: ${region}, limit: ${limit === Number.MAX_SAFE_INTEGER ? 'unlimited' : limit}`);
    
    const result = this.getTrendsData({
      region,
      sortByVolume: true,
      limit
    });
    
    console.log(`[GoogleTrendsService] Returning ${result.length} popular search terms`);
    return result;
  }
}

export default GoogleTrendsService; 