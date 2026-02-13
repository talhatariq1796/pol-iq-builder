/**
 * Spider Visualization Module
 * 
 * This module provides utilities for creating spider visualizations that show
 * relationships between a central point and surrounding points.
 */

// Base class for spider visualizations
export class SpiderVisualization {
  constructor() {
    this.name = 'Spider Visualization';
  }

  /**
   * Create a spider visualization renderer
   * @param {Object} options - Configuration options
   * @param {Array} options.features - Features to visualize
   * @param {Object} options.centerPoint - Central point for the spider
   * @param {string} options.field - Field to visualize
   * @returns {Object} Renderer configuration
   */
  createRenderer(options) {
    const { features, centerPoint, field } = options;
    
    console.log(`Creating spider visualization for field: ${field}`);
    
    return {
      type: 'simple',
      symbol: {
        type: 'simple-line',
        width: 1,
        color: [31, 120, 180, 0.8]
      },
      visualVariables: [
        {
          type: 'size',
          field: field,
          minDataValue: 0,
          maxDataValue: 100,
          minSize: 0.5,
          maxSize: 3
        },
        {
          type: 'opacity',
          field: field,
          stops: [
            { value: 0, opacity: 0.3 },
            { value: 50, opacity: 0.6 },
            { value: 100, opacity: 0.9 }
          ]
        }
      ]
    };
  }
  
  /**
   * Create lines connecting the center point to each feature
   * @param {Object} centerPoint - Central point
   * @param {Array} features - Features to connect
   * @returns {Array} Line features
   */
  createSpiderLines(centerPoint, features) {
    console.log(`Creating spider lines from center point to ${features.length} features`);
    
    return features.map(feature => {
      // Create a line from center point to feature
      return {
        geometry: {
          type: 'polyline',
          paths: [
            [
              [centerPoint.x, centerPoint.y],
              [feature.geometry.x, feature.geometry.y]
            ]
          ]
        },
        attributes: {
          ...feature.attributes,
          DISTANCE: this.calculateDistance(centerPoint, feature.geometry)
        }
      };
    });
  }
  
  /**
   * Calculate distance between two points
   * @param {Object} point1 - First point
   * @param {Object} point2 - Second point
   * @returns {number} Distance
   */
  calculateDistance(point1, point2) {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

export default SpiderVisualization;
