import { DEFAULT_FILL_ALPHA } from "./constants";
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Renderer from '@arcgis/core/renderers/Renderer';
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import Extent from '@arcgis/core/geometry/Extent';
import { BaseVisualization, BaseVisualizationData, VisualizationOptions, VisualizationResult } from './base-visualization';
import Color from '@arcgis/core/Color';
import Polyline from '@arcgis/core/geometry/Polyline';
import Graphic from '@arcgis/core/Graphic';
import SizeVariable from '@arcgis/core/renderers/visualVariables/SizeVariable';
import { SpiderMapData } from './types';
import { StandardizedLegendData } from '@/types/legend';

export interface SpiderData extends BaseVisualizationData {
  points: __esri.Graphic[];
  connections: {
    from: string;
    to: string;
    weight?: number;
  }[];
  idField: string;
}

export class SpiderVisualization extends BaseVisualization<SpiderData> {
  protected renderer: Renderer;
  protected title: string;
  protected layer: FeatureLayer | null = null;
  protected extent: Extent | null = null;
  protected data: SpiderData | null = null;

  constructor() {
    super();
    this.renderer = new SimpleRenderer({
      symbol: new SimpleLineSymbol({
        color: new Color([0, 122, 194, 0.6]),
        width: 1.5,
        style: 'solid'
      }),
      visualVariables: [
        new SizeVariable({
          field: 'weight',
          minDataValue: 0,
          maxDataValue: 1,
          minSize: 1,
          maxSize: 4,
          legendOptions: {
            title: 'Connection Strength',
            showLegend: true
          }
        })
      ]
    });
    this.title = 'Spider Map Analysis';
  }

  private createSpiderLine(
    fromPoint: __esri.Point,
    toPoint: __esri.Point,
    weight: number = 1
  ): Graphic | null {
    try {
      if (!fromPoint?.x || !fromPoint?.y || !toPoint?.x || !toPoint?.y) {
        console.warn('Invalid point coordinates:', {
          from: { x: fromPoint?.x, y: fromPoint?.y },
          to: { x: toPoint?.x, y: toPoint?.y }
        });
        return null;
      }

      if (!fromPoint.spatialReference || !toPoint.spatialReference) {
        console.warn('Missing spatial reference:', {
          fromSR: fromPoint.spatialReference?.wkid,
          toSR: toPoint.spatialReference?.wkid
        });
        return null;
      }

      if (fromPoint.spatialReference.wkid !== toPoint.spatialReference.wkid) {
        console.warn('Mismatched spatial references:', {
          fromSR: fromPoint.spatialReference.wkid,
          toSR: toPoint.spatialReference.wkid
        });
        return null;
      }

      return new Graphic({
        geometry: new Polyline({
          paths: [
            [
              [fromPoint.x, fromPoint.y],
              [toPoint.x, toPoint.y]
            ]
          ],
          spatialReference: fromPoint.spatialReference
        }),
        attributes: {
          weight: weight || 1,
          OBJECTID: Math.floor(Math.random() * 1000000),
          fromX: fromPoint.x,
          fromY: fromPoint.y,
          toX: toPoint.x,
          toY: toPoint.y
        }
      });
    } catch (error) {
      console.error('Error creating spider line:', error);
      return null;
    }
  }

  async create(data: SpiderData, options: VisualizationOptions = {}): Promise<VisualizationResult> {
    console.log('=== Creating Spider Map Visualization ===');
    console.log('Input data:', {
      pointCount: data.points?.length,
      connectionCount: data.connections?.length,
      idField: data.idField
    });

    const { points, connections, idField } = data;

    // Validate input data
    if (!points?.length) {
      throw new Error('No points provided for spider map visualization');
    }

    if (!connections?.length) {
      throw new Error('No connections provided for spider map visualization');
    }

    if (!idField) {
      throw new Error('No ID field specified for spider map visualization');
    }

    // Validate point geometries
    const validPoints = points.filter(point => {
      if (!point?.geometry || point.geometry.type !== 'point') {
        console.warn('Invalid point geometry:', {
          hasGeometry: !!point?.geometry,
          type: point?.geometry?.type
        });
        return false;
      }
      if (!point.attributes?.[idField]) {
        console.warn('Missing ID field in point:', {
          idField,
          attributes: Object.keys(point.attributes || {})
        });
        return false;
      }
      return true;
    });

    if (validPoints.length === 0) {
      throw new Error('No valid points for spider map visualization');
    }

    console.log('Point validation:', {
      total: points.length,
      valid: validPoints.length,
      invalid: points.length - validPoints.length
    });

    // Create a map of points by ID for quick lookup
    const pointsMap = new Map(
      validPoints.map(point => [point.attributes[idField], point])
    );

    console.log('Points map created:', {
      uniqueIds: pointsMap.size,
      sampleIds: Array.from(pointsMap.keys()).slice(0, 5)
    });

    // Validate and create spider lines for each connection
    const validConnections = connections.filter(conn => {
      const fromPoint = pointsMap.get(conn.from);
      const toPoint = pointsMap.get(conn.to);
      if (!fromPoint || !toPoint) {
        console.warn('Invalid connection:', {
          from: conn.from,
          to: conn.to,
          hasFromPoint: !!fromPoint,
          hasToPoint: !!toPoint
        });
        return false;
      }
      return true;
    });

    console.log('Connection validation:', {
      total: connections.length,
      valid: validConnections.length,
      invalid: connections.length - validConnections.length
    });

    const spiderLines = validConnections
      .map(conn => {
        const fromPoint = pointsMap.get(conn.from)!.geometry as __esri.Point;
        const toPoint = pointsMap.get(conn.to)!.geometry as __esri.Point;
        return this.createSpiderLine(fromPoint, toPoint, conn.weight);
      })
      .filter((line): line is Graphic => line !== null);

    if (spiderLines.length === 0) {
      throw new Error('No valid spider lines created');
    }

    console.log('Spider lines created:', {
      total: spiderLines.length,
      weightStats: {
        min: Math.min(...spiderLines.map(line => line.attributes.weight)),
        max: Math.max(...spiderLines.map(line => line.attributes.weight)),
        avg: spiderLines.reduce((sum, line) => sum + line.attributes.weight, 0) / spiderLines.length
      }
    });

    // Calculate extent from all points
    const extent = validPoints.reduce((ext, point) => {
      const geomExtent = point.geometry?.extent;
      if (!geomExtent) {
        console.warn('Point geometry has no extent', point);
        return ext;
      }
      return ext ? ext.union(geomExtent as __esri.Extent) : geomExtent.clone();
    }, null as Extent | null);

    if (!extent) {
      throw new Error('No valid extent could be calculated from points');
    }

    console.log('Creating feature layer:', {
      title: options?.title || this.title,
      lines: spiderLines.length,
      spatialReference: validPoints[0]?.geometry?.spatialReference?.wkid
    });

    // Create feature layer
    const layer = new FeatureLayer({
      title: options?.title || this.title,
      source: spiderLines,
      renderer: this.renderer,
      spatialReference: validPoints[0]?.geometry?.spatialReference,
      popupTemplate: {
        title: 'Connection Details',
        content: [
          {
            type: 'fields',
            fieldInfos: [
              {
                fieldName: 'weight',
                label: 'Connection Strength',
                format: {
                  places: 2,
                  digitSeparator: true
                }
              }
            ]
          }
        ]
      }
    });

    // Add padding to extent
    extent.expand(1.2);

    // Wait for layer to load and validate
    try {
      await layer.load();
      console.log('Layer loaded successfully:', {
        id: layer.id,
        title: layer.title,
        loaded: layer.loaded,
        geometryType: layer.geometryType,
        features: (layer.source as any)?.length
      });
    } catch (error) {
      console.error('Error loading layer:', error);
      throw new Error('Failed to load spider map layer');
    }

    this.layer = layer;
    this.extent = extent;
    this.data = data;

    return {
      layer,
      extent
    };
  }

  getRenderer(): Renderer {
    return this.renderer;
  }

  getLegendInfo(): StandardizedLegendData {
    return {
      title: this.title,
      type: "class-breaks",
      description: "Spider visualization showing relationships between variables",
      items: [{
        label: 'Spider',
        color: 'rgba(0, 116, 217, DEFAULT_FILL_ALPHA)',
        shape: 'square',
        size: 16
      }]
    };
  }
} 