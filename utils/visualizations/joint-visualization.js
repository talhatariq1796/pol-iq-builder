/**
 * Joint Visualization Module
 * 
 * This module provides utilities for creating joint visualizations that combine
 * multiple data sources or visualization types.
 */

// Base class for joint visualizations
export class JointHighVisualization {
  constructor() {
    this.name = 'Joint High Visualization';
  }

  /**
   * Create a joint visualization renderer
   * @param {Object} options - Configuration options
   * @param {Array} options.features - Features to visualize
   * @param {string} options.primaryField - Primary field to visualize
   * @param {string} options.secondaryField - Secondary field to visualize
   * @returns {Object} Renderer configuration
   */
  createRenderer(options) {
    const { features, primaryField, secondaryField } = options;
    
    console.log(`Creating joint visualization for fields: ${primaryField} and ${secondaryField}`);
    
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
          field: primaryField,
          stops: [
            { value: 0, color: [255, 255, 178] },
            { value: 50, color: [253, 141, 60] },
            { value: 100, color: [189, 0, 38] }
          ]
        },
        {
          type: 'size',
          field: secondaryField,
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
}

export default JointHighVisualization;
