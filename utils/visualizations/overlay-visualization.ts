import { DEFAULT_FILL_ALPHA } from "./constants";
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Renderer from '@arcgis/core/renderers/Renderer';
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import Extent from '@arcgis/core/geometry/Extent';
import { BaseVisualization, BaseVisualizationData, VisualizationOptions, VisualizationResult } from './base-visualization';
import { intersect, planarArea, contains } from '@arcgis/core/geometry/geometryEngine';
import Color from '@arcgis/core/Color';
import Graphic from '@arcgis/core/Graphic';
import { isFinite } from 'lodash';
import SpatialReference from '@arcgis/core/geometry/SpatialReference';
import { StandardizedLegendData } from '@/types/legend';

export interface OverlayData extends BaseVisualizationData {
  layer1: {
    features: __esri.Graphic[];
    name: string;
    type: 'point' | 'polygon';
  };
  layer2: {
    features: __esri.Graphic[];
    name: string;
    type: 'point' | 'polygon';
  };
}

export class OverlayVisualization extends BaseVisualization<OverlayData> {
  protected renderer: SimpleRenderer;
  protected title: string = 'Overlay Analysis';

  constructor() {
    super();
    this.renderer = new SimpleRenderer({
      symbol: new SimpleFillSymbol({
        color: new Color([255, 127, 0, 0.6]),
        outline: {
          color: [128, 128, 128, 0.8],
          width: 1
        }
      })
    });
  }

  private validateInputData(data: OverlayData): void {
    if (!data.layer1?.features?.length) {
      throw new Error('No features provided for Layer 1');
    }

    if (!data.layer2?.features?.length) {
      throw new Error('No features provided for Layer 2');
    }

    if (!['point', 'polygon'].includes(data.layer1.type)) {
      throw new Error(`Invalid layer type for Layer 1: ${data.layer1.type}`);
    }

    if (!['point', 'polygon'].includes(data.layer2.type)) {
      throw new Error(`Invalid layer type for Layer 2: ${data.layer2.type}`);
    }
  }

  private validateLayerFeatures(features: __esri.Graphic[], layerName: string, expectedType: 'point' | 'polygon'): void {
    const validation = {
      total: features.length,
      validGeometry: 0,
      validAttributes: 0,
      invalidGeometry: [] as number[],
      invalidAttributes: [] as number[],
      spatialReferences: new Set<number>(),
      geometryTypes: new Set<string>()
    };

    features.forEach((feature, index) => {
      // Validate geometry
      if (feature.geometry) {
        if (feature.geometry.type === expectedType) {
          validation.validGeometry++;
          validation.geometryTypes.add(feature.geometry.type);
          if (feature.geometry.spatialReference?.wkid) {
            validation.spatialReferences.add(feature.geometry.spatialReference.wkid);
          }
        } else {
          validation.invalidGeometry.push(index);
        }
      } else {
        validation.invalidGeometry.push(index);
      }

      // Validate attributes
      if (feature.attributes && Object.keys(feature.attributes).length > 0) {
        validation.validAttributes++;
      } else {
        validation.invalidAttributes.push(index);
      }
    });

    if (validation.validGeometry === 0) {
      throw new Error(`No features in ${layerName} have valid ${expectedType} geometries`);
    }

    if (validation.spatialReferences.size > 1) {
      console.warn(`Multiple spatial references detected in ${layerName}:`, Array.from(validation.spatialReferences));
    }
  }

  private findPointsInPolygons(points: __esri.Graphic[], polygons: __esri.Graphic[]): __esri.Graphic[] {
    return points.reduce<__esri.Graphic[]>((acc, point) => {
      const containingPolygons = polygons.filter(polygon => {
        try {
          return contains(polygon.geometry as any, point.geometry as any);
        } catch (error) {
          return false;
        }
      });

      if (containingPolygons.length > 0) {
        // Create a new graphic for each point with its containing polygon info
        containingPolygons.forEach(polygon => {
          acc.push(new Graphic({
            geometry: point.geometry as any,
            attributes: {
              OBJECTID: acc.length + 1,
              pointId: point.attributes?.OBJECTID || 'unknown',
              polygonId: polygon.attributes?.OBJECTID || 'unknown',
              pointAttributes: JSON.stringify(point.attributes),
              polygonAttributes: JSON.stringify(polygon.attributes)
            }
          }));
        });
      }

      return acc;
    }, []);
  }

  protected async initializeLayer(data: OverlayData, options: VisualizationOptions = {}): Promise<void> {
    // Validate input data
    this.validateInputData(data);
    this.validateLayerFeatures(data.layer1.features, data.layer1.name, data.layer1.type);
    this.validateLayerFeatures(data.layer2.features, data.layer2.name, data.layer2.type);

    let resultFeatures: __esri.Graphic[];
    let layerGeometryType: 'point' | 'polygon';

    if (data.layer1.type === 'point' && data.layer2.type === 'polygon') {
      // Point-in-polygon analysis
      resultFeatures = this.findPointsInPolygons(data.layer1.features, data.layer2.features);
      layerGeometryType = 'point';
    } else if (data.layer1.type === 'polygon' && data.layer2.type === 'point') {
      // Point-in-polygon analysis (reversed)
      resultFeatures = this.findPointsInPolygons(data.layer2.features, data.layer1.features);
      layerGeometryType = 'point';
    } else {
      // Polygon intersection analysis
      resultFeatures = data.layer1.features.reduce<__esri.Graphic[]>((acc, feature1) => {
        const intersections = data.layer2.features.map(feature2 => {
          try {
            const intersection = intersect(feature1.geometry as any, feature2.geometry as any) as __esri.Polygon;
            if (intersection) {
              const area = planarArea(intersection, "square-meters");
              return new Graphic({
                geometry: intersection,
                attributes: {
                  OBJECTID: acc.length + 1,
                  layer1Name: data.layer1.name,
                  layer2Name: data.layer2.name,
                  layer1Attributes: JSON.stringify(feature1.attributes),
                  layer2Attributes: JSON.stringify(feature2.attributes),
                  area: area,
                  layer1Id: feature1.attributes?.OBJECTID || 'unknown',
                  layer2Id: feature2.attributes?.OBJECTID || 'unknown'
                }
              });
            }
            return null;
          } catch (error) {
            return null;
          }
        }).filter((g): g is Graphic => g !== null);

        return [...acc, ...intersections];
      }, []);

      layerGeometryType = 'polygon';
    }

    if (resultFeatures.length === 0) {
      throw new Error('No overlapping features found');
    }

    // Map features using base class method
    const mappedFeatures = resultFeatures.map(feature => this.mapFeature(feature));

    // Create feature layer
    this.layer = new FeatureLayer({
      source: mappedFeatures,
      objectIdField: "OBJECTID",
      geometryType: layerGeometryType,
      fields: this.createFields(mappedFeatures[0].attributes),
      renderer: this.renderer,
      opacity: options.opacity ?? 0.7,
      visible: options.visible ?? true,
      title: options.title || "Overlay Analysis",
      listMode: "show"
    });

    // Calculate extent using base class's method
    await this.calculateExtent(mappedFeatures);
  }

  async create(data: OverlayData, options: VisualizationOptions = {}): Promise<VisualizationResult> {
    // Validate input data using base class method
    this.validateData(data);

    // Initialize layer using overridden initializeLayer method
    await this.initializeLayer(data, options);

    return {
      layer: this.layer!,
      extent: this.extent!,
      renderer: this.renderer,
      legendInfo: this.getLegendInfo()
    };
  }

  getLegendInfo(): StandardizedLegendData {
    return {
      title: this.title,
      type: "class-breaks",
      description: "Overlay analysis showing combined features",
      items: [{
        label: 'Overlay',
        color: 'rgba(0, 116, 217, DEFAULT_FILL_ALPHA)',
        shape: 'square',
        size: 16
      }]
    };
  }
}