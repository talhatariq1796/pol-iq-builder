// lib/enhanced-query-analyzer.ts
// Enhanced Query Analyzer with Geographic Recognition

import { geographicRecognitionService, GeographicRecognitionResult } from './geographic-recognition-service';

export interface EnhancedAnalysisResult {
  // Existing query analysis
  queryType: 'single_layer' | 'difference' | 'bivariate' | 'hotspot' | 'multivariate' | 'joint_high' | 'ranking' | 'unknown';
  entities: string[];
  intent: string;
  confidence: number;
  layers: string[];
  timeframe: string;
  searchType: 'web' | 'local';
  relevantLayers: string[];
  explanation: string;
  
  // New geographic analysis
  geographicContext?: GeographicRecognitionResult;
  spatialFilter?: {
    geometry: any;
    type: 'point' | 'bbox' | 'polygon';
    buffer?: number;
  };
  enhancedQuery?: string;
}

export class EnhancedQueryAnalyzer {
  
  /**
   * Analyze query with geographic recognition
   */
  async analyzeQueryWithGeography(query: string): Promise<EnhancedAnalysisResult> {
    try {
      // Step 1: Extract geographic context
      const geographicContext = await geographicRecognitionService.extractGeographicEntities(query);
      
      // Step 2: Enhance query with geographic context
      const enhancedQuery = this.enhanceQueryWithGeography(query, geographicContext);
      
      // Step 3: Perform standard query analysis (using existing logic)
      const baseAnalysis = await this.performBaseAnalysis(enhancedQuery);
      
      // Step 4: Combine results
      const result: EnhancedAnalysisResult = {
        ...baseAnalysis,
        geographicContext,
        spatialFilter: geographicContext.spatialFilter,
        enhancedQuery
      };
      
      return result;
    } catch (error) {
      console.error('Error in enhanced query analysis:', error);
      
      // Fallback to basic analysis
      const baseAnalysis = await this.performBaseAnalysis(query);
      return {
        ...baseAnalysis,
        enhancedQuery: query
      };
    }
  }
  
  /**
   * Enhance query text with geographic context
   */
  private enhanceQueryWithGeography(
    originalQuery: string, 
    geographicContext: GeographicRecognitionResult
  ): string {
    if (!geographicContext.primaryLocation) {
      return originalQuery;
    }
    
    const location = geographicContext.primaryLocation;
    let enhancedQuery = originalQuery;
    
    // Add geographic context to query for better analysis
    if (location.type === 'region') {
      enhancedQuery += ` (geographic filter: ${location.details?.fullName || location.text})`;
    } else if (location.type === 'locality') {
      enhancedQuery += ` (city filter: ${location.details?.fullName || location.text})`;
    } else if (location.type === 'postal') {
      enhancedQuery += ` (postal code filter: ${location.text})`;
    }
    
    return enhancedQuery;
  }
  
  /**
   * Perform base query analysis (placeholder for existing logic)
   */
  private async performBaseAnalysis(query: string): Promise<Omit<EnhancedAnalysisResult, 'geographicContext' | 'spatialFilter' | 'enhancedQuery'>> {
    // This would integrate with your existing query-analyzer.ts logic
    // For now, returning a basic structure
    
    return {
      queryType: 'single_layer',
      entities: [],
      intent: 'analysis',
      confidence: 0.8,
      layers: [],
      timeframe: '',
      searchType: 'local',
      relevantLayers: [],
      explanation: 'Enhanced query analysis with geographic context'
    };
  }
  
  /**
   * Get examples of supported geographic queries
   */
  getSupportedGeographicQueries(): string[] {
    return [
      "Show me Nike sales in Eastern Pennsylvania",
      "Find Adidas stores near Philadelphia",
      "Compare brand performance in California vs Texas",
      "Analyze retail trends in ZIP code 19101",
      "Show demographic data for Southern Ontario",
      "Map business locations around New York City",
      "Revenue analysis for the Pacific Northwest",
      "Store density in Metro Atlanta area"
    ];
  }
}

// Usage example function
export async function testGeographicRecognition() {
  const analyzer = new EnhancedQueryAnalyzer();
  
  const testQueries = [
    "Show me Nike sales in Eastern Pennsylvania",
    "Find stores near Philadelphia",
    "Compare performance in California vs Texas",
    "Analyze trends in ZIP code 19101"
  ];
  
  console.log('Testing Geographic Recognition:');
  
  for (const query of testQueries) {
    console.log(`\nQuery: "${query}"`);
    
    try {
      const result = await analyzer.analyzeQueryWithGeography(query);
      
      console.log('Geographic Entities:', result.geographicContext?.entities?.map(e => ({
        text: e.text,
        type: e.type,
        confidence: e.confidence,
        fullName: e.details?.fullName
      })));
      
      console.log('Primary Location:', result.geographicContext?.primaryLocation?.text);
      console.log('Spatial Filter:', result.spatialFilter?.type);
      console.log('Enhanced Query:', result.enhancedQuery);
      
    } catch (error) {
      console.error('Error:', error);
    }
  }
}

export const enhancedQueryAnalyzer = new EnhancedQueryAnalyzer(); 