import { DEFAULT_FILL_ALPHA } from "./constants";
import Point from '@arcgis/core/geometry/Point';
import Polygon from '@arcgis/core/geometry/Polygon';
import * as geometryEngine from '@arcgis/core/geometry/geometryEngine';
import { SimpleRenderer } from '@arcgis/core/renderers';
import { SimpleMarkerSymbol, SimpleFillSymbol } from '@arcgis/core/symbols';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Graphic from '@arcgis/core/Graphic';
import { BaseVisualization, BaseVisualizationData, VisualizationOptions, VisualizationResult } from './base-visualization';
import Color from '@arcgis/core/Color';
import { isFinite } from 'lodash';
import SpatialReference from '@arcgis/core/geometry/SpatialReference';
import Extent from '@arcgis/core/geometry/Extent';
import ColorVariable from '@arcgis/core/renderers/visualVariables/ColorVariable';
import SizeVariable from '@arcgis/core/renderers/visualVariables/SizeVariable';
import { StandardizedLegendData } from '@/types/legend';
import { FieldMappingHelper } from './field-mapping-helper';

interface HotspotData extends BaseVisualizationData {
  features: Array<{
    geometry: {
      type: string;
      x?: number;
      y?: number;
      coordinates?: number[] | number[][];
      rings?: number[][][];
    };
    properties?: {
      CONAME?: string;
      [key: string]: any;
    };
    attributes?: {
      CONAME?: string;
      [key: string]: any;
    };
  }>;
  analysisType?: 'interaction' | 'density';
  layers?: Array<{
    features: any[];
    name: string;
  }>;
}

interface ColorStop {
  value: number;
  color: number[];
}

interface SizeStop {
  value: number;
  size: number;
}

interface VisualVariable {
  type: string;
  field: string;
}

interface ColorVisualVariable extends VisualVariable {
  type: "color";
  stops: ColorStop[];
  legendOptions: {
    title: string;
    showLegend: boolean;
  };
}

interface SizeVisualVariable extends VisualVariable {
  type: "size";
  stops: SizeStop[];
}

class SpatialIndex {
  private grid: Map<string, Point[]> = new Map();
  private cellSize: number;

  constructor(points: Point[], cellSize: number = 10000) { // 10km default cell size
    this.cellSize = cellSize;
    this.buildIndex(points);
  }

  private buildIndex(points: Point[]): void {
    points.forEach(point => {
      const cellKey = this.getCellKey(point);
      if (!this.grid.has(cellKey)) {
        this.grid.set(cellKey, []);
      }
      this.grid.get(cellKey)!.push(point);
    });
  }

  private getCellKey(point: Point): string {
    const x = Math.floor(point.x / this.cellSize);
    const y = Math.floor(point.y / this.cellSize);
    return `${x},${y}`;
  }

  getNearbyPoints(point: Point, radius: number): Point[] {
    const nearbyPoints: Point[] = [];
    const cellRadius = Math.ceil(radius / this.cellSize);
    const centerCell = this.getCellKey(point);
    const [centerX, centerY] = centerCell.split(',').map(Number);

    // Check cells within radius
    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dy = -cellRadius; dy <= cellRadius; dy++) {
        const cellKey = `${centerX + dx},${centerY + dy}`;
        const cellPoints = this.grid.get(cellKey);
        if (cellPoints) {
          nearbyPoints.push(...cellPoints);
        }
      }
    }

    return nearbyPoints;
  }
}

export class HotspotVisualization extends BaseVisualization<HotspotData> {
  protected renderer: SimpleRenderer | null = null;
  protected layer: FeatureLayer | null = null;
  protected extent: Extent | null = null;
  protected title: string = 'Hotspot Analysis';
  private spatialIndex: SpatialIndex | null = null;
  private featurePoints: Point[] = [];

  async create(data: HotspotData, options: VisualizationOptions = {}): Promise<VisualizationResult> {
    try {
      console.log('Creating hotspot visualization:', {
        featureCount: data.features?.length,
        layerName: data.layerName,
        analysisType: data.analysisType
      });

      // Initialize layer
      await this.initializeLayer(data, options);

      if (!this.layer || !this.extent) {
        throw new Error('Failed to initialize layer or calculate extent');
      }

      return {
        layer: this.layer,
        extent: this.extent,
        renderer: this.renderer || undefined,
        legendInfo: this.getLegendInfo()
      };
    } catch (error) {
      console.error('Error creating hotspot visualization:', error);
      throw error;
    }
  }

  getLegendInfo(): StandardizedLegendData {
    const colorVariable = this.renderer?.visualVariables?.find(v => v.type === 'color');
    const stops = (colorVariable && 'stops' in colorVariable ? colorVariable.stops : []) as Array<{ value: number; color: Color }>;
    
    // Use the analysisType for display name
    const analysisTypeName = this.data?.analysisType || 'density';
    
    return {
      title: this.layer?.title || `${analysisTypeName} Hotspot Analysis`,
      type: "class-breaks",
      description: `Hotspot analysis showing ${analysisTypeName} patterns`,
      items: stops.map(stop => ({
        label: stop.value.toString(),
        color: `rgba(${stop.color.toRgba().join(',')})`,
        outlineColor: 'rgba(128, 128, 128, 0.5)',
        shape: 'square' as const,
        size: 16
      }))
    };
  }

  protected async processFeatures(data: HotspotData): Promise<__esri.Graphic[]> {
    try {
      console.log('Processing features:', {
        featureCount: data.features.length,
        analysisType: data.analysisType,
        hasAdditionalLayers: !!data.layers?.length
      });

      // Convert all features to points once
      this.featurePoints = data.features.map(feature => {
        try {
          let point: Point | null = null;
          
          if (feature.geometry.type === 'point') {
            // Handle point geometry
            if (feature.geometry.x !== undefined && feature.geometry.y !== undefined &&
                !isNaN(feature.geometry.x) && !isNaN(feature.geometry.y)) {
              // Create point directly if x/y are valid numbers
              point = new Point({
                x: feature.geometry.x,
                y: feature.geometry.y,
                spatialReference: { wkid: 102100 }
              });
            } else if (Array.isArray(feature.geometry.coordinates) && 
                      feature.geometry.coordinates.length >= 2) {
              const [x, y] = feature.geometry.coordinates;
              if (typeof x === 'number' && typeof y === 'number' && !isNaN(x) && !isNaN(y)) {
                // Create point from coordinates array if values are valid numbers
                point = new Point({
                  x,
                  y,
                  spatialReference: { wkid: 102100 }
                });
              }
            }
          } else if (feature.geometry.type === 'polygon') {
            // Handle polygon geometry
            const rings = feature.geometry.rings || 
                        (Array.isArray(feature.geometry.coordinates) ? 
                         feature.geometry.coordinates : null);
            
            if (rings && Array.isArray(rings[0]) && rings[0].length >= 3) {
              const polygon = new Polygon({
                rings: rings as number[][][],
                spatialReference: { wkid: 102100 }
              });
              // Explicitly check and set point to make sure it's never undefined
              const centroid = polygon.centroid;
              if (centroid) {
                point = centroid;
              }
            }
          }

          // Validate point before returning
          if (point && isFinite(point.x) && isFinite(point.y)) {
            return point;
          }
          return null;
        } catch (error) {
          console.warn('Error converting feature to point:', error);
          return null;
        }
      }).filter((p): p is Point => p !== null);

      // Log point conversion results
      console.log('Point conversion summary:', {
        totalFeatures: data.features.length,
        convertedPoints: this.featurePoints.length,
        samplePoints: this.featurePoints.slice(0, 3).map(p => ({
          x: p.x,
          y: p.y,
          spatialReference: p.spatialReference?.wkid
        }))
      });

      if (this.featurePoints.length === 0) {
        throw new Error('No valid points could be created from features');
      }

      // Initialize spatial index with converted points
      this.spatialIndex = new SpatialIndex(this.featurePoints);

      // Create graphics with proper structure
      const processedFeatures = this.featurePoints.map((point, index) => {
        return new Graphic({
          geometry: point,
          attributes: {
            OBJECTID: index + 1,
            score: 0, // Will be calculated later
            CONAME: data.features[index].properties?.CONAME || 
                   data.features[index].attributes?.CONAME || 
                   `Location ${index + 1}`
          }
        });
      });

      // Calculate scores in batches
      const batchSize = 100;
      for (let i = 0; i < processedFeatures.length; i += batchSize) {
        const batch = processedFeatures.slice(i, i + batchSize);
        await Promise.all(batch.map(async (graphic) => {
          try {
            const point = graphic.geometry as Point;
            const score = data.analysisType === 'interaction' && data.layers?.length
              ? this.calculateInteractionScore(point, data.layers)
              : this.calculateDensityScore(point);
            graphic.attributes.score = score;
          } catch (error) {
            console.warn(`Error calculating score for feature ${graphic.attributes.OBJECTID}:`, error);
          }
        }));
      }

      const firstFeature = processedFeatures[0];
      console.log('Feature processing complete:', {
        inputCount: data.features.length,
        processedCount: processedFeatures.length,
        sampleFeature: firstFeature ? {
          geometry: {
            type: (firstFeature.geometry as Point).type,
            x: (firstFeature.geometry as Point).x,
            y: (firstFeature.geometry as Point).y
          },
          attributes: firstFeature.attributes
        } : 'none'
      });

      return processedFeatures;
    } catch (error) {
      console.error('Error in processFeatures:', error);
      throw error;
    }
  }

  protected async initializeLayer(data: HotspotData, options: VisualizationOptions = {}): Promise<void> {
    try {
      // Single entry point log with essential info
      console.log('[HotspotVisualization] Initializing:', {
        featureCount: data.features.length,
        layerName: data.layerName || this.title,
        analysisType: data.analysisType || 'density'
      });

      // Process features based on analysis type
      const validFeatures = await this.processFeatures(data);

      if (validFeatures.length === 0) {
        throw new Error('No valid features for hotspot analysis');
      }

      // Calculate quartiles from scores
      const scores = validFeatures.map(f => f.attributes.score).sort((a, b) => a - b);
      const q1Index = Math.floor(scores.length * 0.25);
      const q2Index = Math.floor(scores.length * 0.5);
      const q3Index = Math.floor(scores.length * 0.75);
      const quartiles = {
        q1: scores[q1Index],
        q2: scores[q2Index],
        q3: scores[q3Index]
      };

      console.log('Score quartiles:', quartiles);

      // Create renderer with visualization parameters
      this.renderer = new SimpleRenderer({
        symbol: new SimpleMarkerSymbol({
          color: [255, 255, 255, 0.6],
          size: 12,
          outline: {
            color: [128, 128, 128, 0.5],
            width: 1
          }
        }),
        visualVariables: [
          new ColorVariable({
            field: 'score',
            stops: [
              { value: scores[0], color: new Color([239, 59, 44, DEFAULT_FILL_ALPHA]) },      // red
              { value: quartiles.q1, color: new Color([255, 127, 0, DEFAULT_FILL_ALPHA]) },   // orange
              { value: quartiles.q2, color: new Color([158, 215, 152, DEFAULT_FILL_ALPHA]) }, // light green
              { value: quartiles.q3, color: new Color([49, 163, 84, DEFAULT_FILL_ALPHA]) }    // green
            ],
            legendOptions: {
              title: data.analysisType === 'interaction' 
                ? `Interaction Strength (${data.layers?.length || 1} layers)` 
                : "Concentration",
              showLegend: true
            }
          }),
          new SizeVariable({
            field: 'score',
            stops: [
              { value: scores[0], size: 8 },
              { value: quartiles.q1, size: 12 },
              { value: quartiles.q2, size: 16 },
              { value: quartiles.q3, size: 20 }
            ]
          })
        ]
      });

      // Create feature layer with explicit geometry configuration
      this.layer = new FeatureLayer({
        source: validFeatures,
        objectIdField: "OBJECTID",
        fields: [
          {
            name: "OBJECTID",
            type: "oid",
            alias: "Object ID"
          },
          {
            name: "score",
            type: "double",
            alias: "Score"
          },
          {
            name: "CONAME",
            type: "string",
            alias: "Name"
          }
        ],
        geometryType: "point",
        hasZ: false,
        hasM: false,
        spatialReference: { wkid: 102100 },
        renderer: this.renderer,
        title: options.title || data.layerName || this.title,
        displayField: "CONAME",
      });

      // Calculate extent from features
      if (validFeatures.length > 0) {
        const points = validFeatures
          .map(f => f.geometry as Point)
          .filter(p => p && typeof p.x === 'number' && typeof p.y === 'number');

        if (points.length > 0) {
          const xCoords = points.map(p => p.x);
          const yCoords = points.map(p => p.y);
          
          const xmin = Math.min(...xCoords);
          const ymin = Math.min(...yCoords);
          const xmax = Math.max(...xCoords);
          const ymax = Math.max(...yCoords);

          this.extent = new Extent({
            xmin,
            ymin,
            xmax,
            ymax,
            spatialReference: { wkid: 102100 }
          });

          // Add padding to extent
          this.extent.expand(1.2);
        }
      }

      console.log('[HotspotVisualization] Layer state:', {
        title: this.layer.title,
        geometryType: this.layer.geometryType,
        loaded: this.layer.loaded,
        featureCount: validFeatures.length,
        hasValidExtent: !!this.extent,
        sampleFeature: validFeatures[0] ? {
          geometry: {
            x: (validFeatures[0].geometry as Point).x,
            y: (validFeatures[0].geometry as Point).y
          },
          attributes: validFeatures[0].attributes
        } : 'none'
      });

    } catch (error) {
      console.error('Error in initializeLayer:', error);
      throw error;
    }
  }

  private calculateInteractionScore(point: Point, layers: Array<{ features: any[]; name: string }>): number {
    let totalScore = 0;
    let totalFeatures = 0;
    const layerScores: { [key: string]: number } = {};

    // Calculate score based on proximity to features in all layers
    layers.forEach(layer => {
      let layerScore = 0;
      let layerFeatureCount = 0;

      layer.features.forEach(feature => {
        try {
          // Get feature location
          let featurePoint: Point;
          if (feature.geometry.type === 'point') {
            const coordinates = Array.isArray(feature.geometry.coordinates) ? 
              feature.geometry.coordinates.slice(0, 2).map(Number) : [0, 0];
            
            featurePoint = new Point({
              x: feature.geometry.x || coordinates[0],
              y: feature.geometry.y || coordinates[1],
              spatialReference: { wkid: 102100 }
            });
          } else if (feature.geometry.type === 'polygon') {
            const rings = feature.geometry.rings || 
                         (Array.isArray(feature.geometry.coordinates) && Array.isArray(feature.geometry.coordinates[0]) ? 
                          [feature.geometry.coordinates as number[][]] : 
                          [[]]);
            
            const polygon = new Polygon({
              rings,
              spatialReference: { wkid: 102100 }
            });
            
            // Get centroid and ensure it's a valid Point
            const centroid = polygon.centroid;
            if (centroid) {
              featurePoint = centroid;
            } else {
              // If there's no valid centroid, return early
              return;
            }
          } else {
            return;
          }

          // Calculate distance-based score
          const distance = geometryEngine.distance(point, featurePoint, 'meters');
          if (distance !== null) {
            // Score decreases with distance, max score at 0 distance
            const score = Math.max(0, 1 - (distance / 10000)); // 10km radius
            layerScore += score;
            layerFeatureCount++;
          }
        } catch (error) {
          console.warn('Error calculating interaction score:', error);
        }
      });

      if (layerFeatureCount > 0) {
        layerScores[layer.name] = layerScore / layerFeatureCount;
        totalScore += layerScore;
        totalFeatures += layerFeatureCount;
      }
    });

    // Calculate weighted average of layer scores
    const layerCount = Object.keys(layerScores).length;
    if (layerCount > 0) {
      // Normalize scores to account for number of layers
      return totalFeatures > 0 ? (totalScore / totalFeatures) * (layerCount / layers.length) : 0;
    }

    return 0;
  }

  private calculateDensityScore(point: Point): number {
    if (!this.spatialIndex) return 0;

    const searchRadius = 15000; // 15km radius
    const nearbyPoints = this.spatialIndex.getNearbyPoints(point, searchRadius);
    
    if (nearbyPoints.length <= 1) return 0;

    let totalScore = 0;
    let weightSum = 0;

    // Use squared distance for faster comparison
    const searchRadiusSquared = searchRadius * searchRadius;

    nearbyPoints.forEach(nearbyPoint => {
      // Skip self
      if (nearbyPoint.x === point.x && nearbyPoint.y === point.y) {
        return;
      }

      // Calculate squared distance (faster than exact distance)
      const dx = nearbyPoint.x - point.x;
      const dy = nearbyPoint.y - point.y;
      const distanceSquared = dx * dx + dy * dy;

      if (distanceSquared <= searchRadiusSquared) {
        // Use inverse distance weighting
        const distance = Math.sqrt(distanceSquared);
        const weight = 1 / (1 + distance / searchRadius);
        totalScore += weight;
        weightSum += 1;
      }
    });

    // Return raw score - we'll use quartiles in the renderer
    return weightSum > 0 ? totalScore / weightSum : 0;
  }
}
