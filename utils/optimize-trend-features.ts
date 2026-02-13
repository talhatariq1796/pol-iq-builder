/**
 * Utility to optimize trend feature data for AI analysis
 * This separates geometry from attributes to reduce blob size while maintaining
 * enough data for AI analysis and visualization
 */

import { optimizeFeatures } from './feature-optimization';

interface TrendsSummary {
  region: string;
  searchTerm: string;
  provider: string;
  dataDate: string;
  regionType: string;
  note?: string;
}

interface OptimizedTrendsData {
  features: any[];
  totalFeatures: number;
  timestamp: string;
  isComplete: boolean;
  summary: TrendsSummary;
}

/**
 * Optimizes feature data for trends analysis by removing unnecessary geometry and attributes
 */
export async function optimizeTrendFeatures(
  features: any[], 
  layerConfig: any, 
  keyword: string, 
  region: string
): Promise<OptimizedTrendsData> {
  // Define fields to include (important attributes for analysis)
  const fieldsToInclude = [
    'CSDNAME', 'NAME', 'name', 'CSDUID', 'ID', 
    layerConfig.rendererField
  ].filter(Boolean) as string[];
  
  // Create summary data
  const summaryData: TrendsSummary = {
    region,
    searchTerm: keyword,
    provider: 'Google Trends',
    dataDate: new Date().toISOString().split('T')[0],
    regionType: layerConfig.id.includes('ON') ? 'Ontario Census Subdivisions' :
                layerConfig.id.includes('BC') ? 'British Columbia Census Subdivisions' : 
                'Census Subdivisions'
  };

  // Optimize features with all important fields
  const optimized = optimizeFeatures(features, layerConfig, {
    includeFields: fieldsToInclude,
    metadataFields: [layerConfig.rendererField].filter(Boolean) as string[],
    addLayerMetadata: true
  });

  // Return result with summary
  return {
    ...optimized,
    summary: summaryData
  };
} 