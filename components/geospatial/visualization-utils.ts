import { VisualizationOptions } from '../../config/dynamic-layers';
import { ProcessedLayerResult } from '../../types/geospatial-chat-component';
import * as Extent from '@arcgis/core/geometry/Extent';
import { EnhancedAnalysisResult } from './enhanced-analysis-types';
import { Extent as ArcGISExtent } from '@arcgis/core/geometry';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import React from 'react';

/**
 * Represents the result of a visualization operation
 */
export interface VisualizationResult {
  layer: FeatureLayer | null;
  extent: ArcGISExtent | null;
  panel?: React.ReactNode;
  metrics?: {
    thresholds?: Record<string, number>;
    r?: number;
    pValue?: number;
  };
}

/**
 * Data structure for correlation analysis results
 */
export interface CorrelationData {
  primaryField: string;
  primaryValue?: string;
  comparisonField: string;
  comparisonValue?: string;
  metrics: { r: number; pValue?: number } | { r: number | undefined };
  featureData: any[];
}

/**
 * Data structure for joint high analysis results
 */
export interface JointHighData {
  primaryField: string;
  primaryName: string;
  primaryValue?: string;
  comparisonField: string;
  comparisonName: string;
  thresholds: any;
  featureData: any[];
}

/**
 * Type for processed features resulting from layer data processing
 */
export type ProcessedFeaturesResult = {
  features: any[]; // Change to LocalGeospatialFeature[] when importing that type
  extent: __esri.Extent | null;
  populationLookup?: Map<string, number>;
};

/**
 * Validates if an extent object is valid and usable
 */
export const validateExtent = (extent: __esri.Extent | null | undefined): extent is __esri.Extent => {
  if (!extent) {
    return false;
  }

  // More robust property check that directly accesses properties
  const xminExists = typeof extent.xmin === 'number';
  const yminExists = typeof extent.ymin === 'number';
  const xmaxExists = typeof extent.xmax === 'number';
  const ymaxExists = typeof extent.ymax === 'number';
  const srExists = !!extent.spatialReference;
  
  const hasRequiredProps = xminExists && yminExists && xmaxExists && ymaxExists && srExists;
  
  if (!hasRequiredProps) {
    return false;
  }

  // Check numeric values are finite
  const areNumeric = isFinite(extent.xmin) && isFinite(extent.ymin) && 
                    isFinite(extent.xmax) && isFinite(extent.ymax);
  if (!areNumeric) {
    return false;
  }

  // Check coordinate order
  if (extent.xmin >= extent.xmax || extent.ymin >= extent.ymax) {
    return false;
  }

  // Check spatial reference is valid
  if (!extent.spatialReference) {
    return false;
  }

  return true;
};

/**
 * Creates a default extent for the map
 */
export const createDefaultExtent = (): __esri.Extent => {
  return new Extent.default({
    xmin: -141,
    ymin: 41,
    xmax: -52,
    ymax: 83,
    spatialReference: { wkid: 4326 }
  });
};

/**
 * Helper function to extract and normalize data from any visualization source
 * This standardizes how we access data regardless of the source type
 */
export const extractNormalizedSourceData = (
  source: any
): Array<any> => {
  if (!source) {
    return [];
  }

  let sourceArray: any[] = [];
  
  // Handle different source formats consistently
  if (Array.isArray(source)) {
    sourceArray = source;
  } else if (typeof source.toArray === 'function') {
    // Use toArray() method if available on Collection objects
    sourceArray = source.toArray();
  } else {
    try {
      // Fallback to regular array conversion
      sourceArray = Array.from(source as any);
    } catch (e) {
      console.error('Failed to convert source to array:', e);
      return [];
    }
  }
  
  return sourceArray;
};

/**
 * Generates a default analysis message when no AI-generated analysis is available
 */
export const generateDefaultAnalysisMessage = (
  layerResults: ProcessedLayerResult[],
  analysis: EnhancedAnalysisResult,
  visualizationResult: VisualizationResult
): string => {
  // Get layer name and title with safety checks
  const layerName = layerResults?.[0]?.layerName || 
                   visualizationResult?.layer?.title || 
                   'Data';
  const queryType = analysis?.queryType || 'data';
  const rendererField = layerResults?.[0]?.layerConfig?.rendererField || 'value';
  
  // Calculate some basic stats if we have features
  let stats = { min: 0, max: 0, count: 0, hasData: false };
  
  // Extract source data using the shared helper
  const sourceArray = extractNormalizedSourceData(visualizationResult?.layer?.source);
  const hasSource = sourceArray.length > 0;
  
  if (hasSource) {
    try {
      // Safe access to source elements
      const values: number[] = [];
      for (let i = 0; i < sourceArray.length; i++) {
        const g = sourceArray[i];
        if (g && g.attributes) {
          const val = g.attributes.thematic_value || g.attributes.value;
          if (typeof val === 'number' && !isNaN(val)) {
            values.push(val);
          }
        }
      }
      
      if (values.length > 0) {
        stats = {
          min: Math.min(...values),
          max: Math.max(...values),
          count: values.length,
          hasData: true
        };
      }
    } catch (e) {
      console.error('Error calculating stats:', e);
    }
  }
  
  // --- Use shared narrative generators for correlation and jointHigh analysis ---
  if ((queryType === 'correlation' || queryType === 'jointHigh') && visualizationResult?.layer) {
    // Use the shared helper to get normalized source data
    const sourceArray = extractNormalizedSourceData(visualizationResult?.layer?.source);
    
    if (queryType === 'correlation') {
      // Use display names if available
      const primary = analysis?.relevantFields?.[0] || 'Primary Variable';
      const comparison = analysis?.relevantFields?.[1] || 'Comparison Variable';
      
      // Create data structure for correlation analysis
      const correlationData = {
        primaryField: primary,
        primaryValue: layerResults[0]?.layerName || primary, // Add a fallback value
        comparisonField: comparison,
        comparisonValue: analysis?.comparisonParty || comparison, // Use analysis.comparisonParty instead
        metrics: visualizationResult.metrics?.r !== undefined ? 
          { r: visualizationResult.metrics.r, pValue: visualizationResult.metrics.pValue } : 
          { r: analysis?.metrics?.r },
        featureData: sourceArray
      };
      
      return `Correlation analysis for ${correlationData.primaryValue || 'data'} and ${correlationData.comparisonValue || 'comparison'}`;
    }
    
    if (queryType === 'jointHigh') {
      // Assume layerConfigs is available in the original scope, so we'll need to pass it in production
      const primaryName = layerResults[0]?.layerName || 'Primary';
      const comparisonName = layerResults[1]?.layerName || 'Comparison';
      
      // Get field names
      const primaryField = analysis?.relevantFields?.[0] || primaryName;
      const comparisonField = analysis?.relevantFields?.[1] || comparisonName;
      
      // Create data structure for jointHigh analysis
      const jointHighData = {
        primaryField: primaryField,
        primaryName: primaryName,
        primaryValue: layerResults[0]?.layerName || primaryField, // Add a fallback value
        comparisonField: comparisonField,
        comparisonName: comparisonName,
        thresholds: analysis?.thresholds || (visualizationResult?.metrics?.thresholds || {}),
        featureData: sourceArray
      };
      
      return `Joint-high analysis for ${jointHighData.primaryValue || 'data'}`;
    }
  }
  
  // Base message that's safe for any visualization type
  let message = `I've created a visualization showing ${layerName} data. `;
  
  // Add type-specific details
  switch (queryType) {
    case 'topN':
      message += `This visualization highlights the top regions with the highest values for ${rendererField}. `;
      if (stats.hasData) {
        message += `Values range from ${Math.round(stats.min)} to ${Math.round(stats.max)} across ${stats.count} areas. `;
        message += `The areas with higher values are shown in darker colors on the map.`;
      }
      break;
      
    case 'correlation':
      message += `This visualization shows the relationship between different variables in the data. `;
      if (analysis.relevantFields && analysis.relevantFields.length >= 2) {
        message += `I've analyzed the relationship between ${analysis.relevantFields[0]} and ${analysis.relevantFields[1]}. `;
        message += `Areas with interesting correlation patterns are highlighted on the map.`;
      }
      break;
      
    case 'trends':
      // If this is a trends query, use the dedicated trends narrative generator
      if (analysis.trendsKeyword) {
        // Extract normalized source data using the shared helper function 
        const sourceArray = extractNormalizedSourceData(visualizationResult?.layer?.source);
        
        // Process the array to create geoData structure
        const geoData = sourceArray
          .filter(g => g && g.attributes)
          .map(g => ({
            geoName: String(g.attributes.name || g.attributes.ZIP || g.attributes.CSDNAME || `Region`),
            value: Number(g.attributes.value || g.attributes.thematic_value || 0)
          }));
        
        const trendsData = {
          keyword: analysis.trendsKeyword,
          timeframe: analysis.timeframe || 'past 12 months',
          searchType: analysis.searchType || 'web search',
          category: analysis.category || 'all categories',
          geoData
        };
        
        return `Trends analysis for ${trendsData.keyword || 'search term'}`;
      }
      // Fallthrough to default if trendsKeyword is missing
      
    case 'distribution':
    case 'single-layer':
    default:
      message += `The map displays the distribution of ${rendererField} values across different geographic areas. `;
      if (stats.hasData) {
        message += `Values range from ${Math.round(stats.min)} to ${Math.round(stats.max)}. `;
        message += `Areas with higher values appear in darker shades on the map.`;
      }
      break;
  }
  
  return message;
}; 