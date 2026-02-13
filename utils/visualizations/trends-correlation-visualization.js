/**
 * Trends and Correlation Visualization Module
 * 
 * This module provides utilities for creating visualizations that show
 * trends over time or correlations between variables.
 */

// Base class for trends and correlation visualizations
export class TrendsCorrelationVisualization {
  constructor() {
    this.name = 'Trends & Correlation Visualization';
  }

  /**
   * Create a trends visualization renderer
   * @param {Object} options - Configuration options
   * @param {Array} options.features - Features to visualize
   * @param {string} options.field - Field to visualize
   * @param {string} options.timeField - Time field for trends
   * @returns {Object} Renderer configuration
   */
  createTrendsRenderer(options) {
    const { features, field, timeField } = options;
    
    console.log(`Creating trends visualization for field: ${field} over time: ${timeField}`);
    
    return {
      type: 'simple',
      symbol: {
        type: 'simple-marker',
        size: 6,
        color: [31, 120, 180],
        outline: {
          width: 0.5,
          color: 'white'
        }
      },
      visualVariables: [
        {
          type: 'color',
          field: field,
          stops: [
            { value: 0, color: [255, 255, 178] },
            { value: 50, color: [253, 141, 60] },
            { value: 100, color: [189, 0, 38] }
          ]
        }
      ]
    };
  }
  
  /**
   * Create a correlation visualization renderer
   * @param {Object} options - Configuration options
   * @param {Array} options.features - Features to visualize
   * @param {string} options.field1 - First field for correlation
   * @param {string} options.field2 - Second field for correlation
   * @returns {Object} Renderer configuration
   */
  createCorrelationRenderer(options) {
    const { features, field1, field2 } = options;
    
    console.log(`Creating correlation visualization between ${field1} and ${field2}`);
    
    // Calculate correlation
    const correlation = this.calculateCorrelation(features, field1, field2);
    console.log(`Correlation coefficient: ${correlation.toFixed(2)}`);
    
    return {
      type: 'simple',
      symbol: {
        type: 'simple-marker',
        size: 8,
        color: [31, 120, 180],
        outline: {
          width: 0.5,
          color: 'white'
        }
      },
      visualVariables: [
        {
          type: 'color',
          field: field1,
          stops: [
            { value: 0, color: [255, 255, 178] },
            { value: 50, color: [253, 141, 60] },
            { value: 100, color: [189, 0, 38] }
          ]
        },
        {
          type: 'size',
          field: field2,
          minDataValue: 0,
          maxDataValue: 100,
          minSize: 4,
          maxSize: 16
        }
      ]
    };
  }
  
  /**
   * Calculate correlation between two fields
   * @param {Array} features - Features to analyze
   * @param {string} field1 - First field
   * @param {string} field2 - Second field
   * @returns {number} Correlation coefficient
   */
  calculateCorrelation(features, field1, field2) {
    // Calculate Pearson correlation coefficient
    const values1 = features.map(f => f.attributes[field1]);
    const values2 = features.map(f => f.attributes[field2]);
    
    const mean1 = values1.reduce((sum, val) => sum + val, 0) / values1.length;
    const mean2 = values2.reduce((sum, val) => sum + val, 0) / values2.length;
    
    let numerator = 0;
    let denominator1 = 0;
    let denominator2 = 0;
    
    for (let i = 0; i < values1.length; i++) {
      const diff1 = values1[i] - mean1;
      const diff2 = values2[i] - mean2;
      
      numerator += diff1 * diff2;
      denominator1 += diff1 * diff1;
      denominator2 += diff2 * diff2;
    }
    
    return numerator / Math.sqrt(denominator1 * denominator2);
  }
  
  /**
   * Analyze trends over time
   * @param {Array} features - Features to analyze
   * @param {string} field - Field to analyze
   * @param {string} timeField - Time field
   * @returns {Object} Trend analysis results
   */
  analyzeTrends(features, field, timeField) {
    console.log(`Analyzing trends for ${field} over ${timeField}`);
    
    // Group features by time
    const featuresByTime = features.reduce((groups, feature) => {
      const time = feature.attributes[timeField];
      if (!groups[time]) {
        groups[time] = [];
      }
      groups[time].push(feature);
      return groups;
    }, {});
    
    // Calculate statistics for each time period
    const timeStats = Object.entries(featuresByTime).map(([time, timeFeatures]) => {
      const values = timeFeatures.map(f => f.attributes[field]);
      
      return {
        time,
        count: values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((sum, val) => sum + val, 0) / values.length
      };
    });
    
    // Sort by time
    timeStats.sort((a, b) => a.time - b.time);
    
    return {
      timeStats,
      overall: {
        count: features.length,
        timeRange: [timeStats[0].time, timeStats[timeStats.length - 1].time]
      }
    };
  }
}

export default TrendsCorrelationVisualization;
