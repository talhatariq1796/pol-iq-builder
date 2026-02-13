import { DEFAULT_FILL_ALPHA } from "./constants";
import { StandardizedLegendData } from '@/types/legend';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Renderer from '@arcgis/core/renderers/Renderer';
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer';
import ObjectSymbol3DLayer from '@arcgis/core/symbols/ObjectSymbol3DLayer';
import PointSymbol3D from '@arcgis/core/symbols/PointSymbol3D';
import Extent from '@arcgis/core/geometry/Extent';
import { BaseVisualization, BaseVisualizationData, VisualizationOptions, VisualizationResult } from './base-visualization';
import SizeVariable from '@arcgis/core/renderers/visualVariables/SizeVariable';
import ColorVariable from '@arcgis/core/renderers/visualVariables/ColorVariable';
import Color from '@arcgis/core/Color';
import Point from "@arcgis/core/geometry/Point";
import Polygon from "@arcgis/core/geometry/Polygon";
import Graphic from "@arcgis/core/Graphic";

export interface Symbol3DData extends BaseVisualizationData {
  features: __esri.Graphic[];
  targetStoreFeatures?: __esri.Graphic[];
  heightField?: string;
  colorField?: string;
  sizeField?: string;
  symbolType?: '3d-cylinder' | '3d-cube' | '3d-cone' | '3d-sphere';
  heightScale?: number;
  minHeight?: number;
  maxHeight?: number;
  layerName: string;
}

interface Symbol3DVisualizationParams {
  features: __esri.Graphic[];
  targetStoreFeatures: __esri.Graphic[];
  heightField?: string;
  colorField?: string;
  sizeField?: string;
  symbolType?: string;
}

// Type guard for Point geometry
function isPoint(geometry: __esri.Geometry): geometry is Point {
  return geometry.type === 'point';
}

export class Symbol3DVisualization extends BaseVisualization<Symbol3DData> {
  protected renderer: __esri.SimpleRenderer;
  protected title: string = '3D Visualization';
  protected layer: FeatureLayer | null = null;
  protected extent: Extent | null = null;
  protected data: Symbol3DData | null = null;
  private features: __esri.Graphic[] = [];
  private polygonFeatures: __esri.Graphic[] = [];
  private colorRamp = [
    [237, 248, 251],
    [179, 205, 227],
    [140, 150, 198],
    [136, 86, 167],
    [129, 15, 124]
  ];

  constructor() {
    super();
    this.renderer = new SimpleRenderer();
  }

  private calculateBreaks(values: number[], numBreaks: number = 5): number[] {
    const sortedValues = values.filter(v => v != null).sort((a, b) => a - b);
    const step = Math.floor(sortedValues.length / numBreaks);
    return Array.from({length: numBreaks - 1}, (_, i) => {
      const index = Math.min((i + 1) * step, sortedValues.length - 1);
      return sortedValues[index];
    });
  }

  private getColorFromValue(value: number, breaks: number[]): Color {
    const index = breaks.findIndex(b => value <= b);
    const colorValues = index === -1 ? 
      this.colorRamp[this.colorRamp.length - 1] : 
      this.colorRamp[index];
    return new Color(colorValues);
  }

  private createSymbol3D(symbolType: Symbol3DData['symbolType'] = '3d-cylinder'): PointSymbol3D {
    type PrimitiveType = "diamond" | "sphere" | "cylinder" | "cube" | "cone" | "inverted-cone" | "tetrahedron";
    const primitiveType: PrimitiveType = ({
      '3d-cylinder': 'cylinder',
      '3d-cube': 'cube',
      '3d-cone': 'cone',
      '3d-sphere': 'sphere'
    }[symbolType] as PrimitiveType) || 'cylinder';

    return new PointSymbol3D({
      symbolLayers: [
        new ObjectSymbol3DLayer({
          material: { color: new Color([0, 0, 0, 0]) }, // Transparent
          height: 100000,
          anchor: "bottom",
          width: 50000,
          depth: 50000,
          resource: { primitive: primitiveType },
          castShadows: true,
          heading: 0
        })
      ],
      verticalOffset: {
        screenLength: 40,
        maxWorldLength: 100000,
        minWorldLength: 50000
      },
      callout: {
        type: "line",
        size: 1.5,
        color: new Color([150, 150, 150, DEFAULT_FILL_ALPHA]),
        border: {
          color: new Color([50, 50, 50, DEFAULT_FILL_ALPHA])
        }
      }
    });
  }

  public static requiresSceneView(): boolean {
    return true;
  }

  private ensureValidGeometry(feature: __esri.Graphic | any): __esri.Graphic | null {
    try {
      // Log the full feature structure for debugging
      console.log('Processing feature:', {
        type: feature?.type,
        hasAccessor: '__accessor__' in feature,
        hasGeometry: !!feature?.geometry,
        geometryType: feature?.geometry?.type,
        geometryKeys: feature?.geometry ? Object.keys(feature.geometry) : [],
        hasAttributes: !!feature?.attributes,
        attributeKeys: feature?.attributes ? Object.keys(feature.attributes) : []
      });

      // First try to get attributes, since we know they contain coordinates
      if (feature.attributes) {
        const attrs = feature.attributes;
        
        // Case-insensitive search for latitude/longitude fields
        const attrKeys = Object.keys(attrs);
        const latField = attrKeys.find(key => key.toUpperCase() === 'LATITUDE');
        const lonField = attrKeys.find(key => key.toUpperCase() === 'LONGITUDE');
        
        if (latField && lonField && 
            typeof attrs[latField] === 'number' && typeof attrs[lonField] === 'number') {
          console.log('Creating point from LATITUDE/LONGITUDE fields:', attrs[lonField], attrs[latField]);
          return new Graphic({
            geometry: new Point({
              x: attrs[lonField],
              y: attrs[latField],
              spatialReference: { wkid: 4326 }
            }),
            attributes: attrs
          });
        }
      }

      // If it's an ArcGIS Accessor instance
      if ('__accessor__' in feature) {
        // Try to access geometry properties directly first
        if (feature.geometry) {
          // Try to get coordinates using ArcGIS API methods
          try {
            const coords = feature.geometry.coordinates || 
                         [feature.geometry.x, feature.geometry.y] ||
                         [feature.geometry.longitude, feature.geometry.latitude];
            
            if (coords && coords.length >= 2) {
              return new Graphic({
                geometry: new Point({
                  x: coords[0],
                  y: coords[1],
                  spatialReference: feature.geometry.spatialReference || { wkid: 102100 }
                }),
                attributes: feature.attributes || {}
              });
            }
          } catch (e) {
            console.warn('Error accessing geometry coordinates:', e);
          }
        }

        // Try to get coordinates from attributes with various field names
        if (feature.attributes) {
          const attrs = feature.attributes;
          
          // Try common variations of coordinate field names
          const coordFields = [
            ['x', 'y'],
            ['lon', 'lat'],
            ['lng', 'lat'],
            ['long', 'lat'],
            ['x_coord', 'y_coord'],
            ['xcoord', 'ycoord'],
            ['store_x', 'store_y'],
            ['location_x', 'location_y']
          ];
          
          for (const [xField, yField] of coordFields) {
            if (xField in attrs && yField in attrs &&
                typeof attrs[xField] === 'number' && typeof attrs[yField] === 'number') {
              return new Graphic({
                geometry: new Point({
                  x: attrs[xField],
                  y: attrs[yField],
                  spatialReference: { wkid: 4326 }
                }),
                attributes: attrs
              });
            }
          }
        }
      }

      // If it's a GeospatialFeature
      if ('type' in feature && feature.type === 'Feature') {
        const gf = feature;
        if (!gf.geometry || !gf.geometry.coordinates) {
          console.warn('Invalid GeospatialFeature geometry:', gf);
          return null;
        }

        // Handle point geometry
        if (gf.geometry.type.toLowerCase() === 'point') {
          const [x, y] = gf.geometry.coordinates;
          return new Graphic({
            geometry: new Point({
              x,
              y,
              spatialReference: { wkid: 4326 }
            }),
            attributes: gf.properties || {}
          });
        }
        return null;
      }

      // If it's already a Graphic
      if (feature.geometry) {
        // If it's already a Point geometry
        if (feature.geometry.type === 'point') {
          return new Graphic({
            geometry: new Point({
              x: feature.geometry.x,
              y: feature.geometry.y,
              spatialReference: feature.geometry.spatialReference || { wkid: 102100 }
            }),
            attributes: feature.attributes || {}
          });
        }

        // If it has coordinates array (GeoJSON-style)
        if (feature.geometry.coordinates) {
          const [x, y] = feature.geometry.coordinates;
          return new Graphic({
            geometry: new Point({
              x,
              y,
              spatialReference: { wkid: 4326 }
            }),
            attributes: feature.attributes || {}
          });
        }
      }

      console.warn('Could not extract valid geometry from feature:', feature);
      return null;
    } catch (error) {
      console.error('Error processing geometry:', error);
      return null;
    }
  }

  protected calculateExtent(features: any[]): __esri.Extent | null {
    try {
      let xmin = Infinity;
      let ymin = Infinity;
      let xmax = -Infinity;
      let ymax = -Infinity;
      let spatialReference = { wkid: 102100 };

      features.forEach(feature => {
        if (!feature.geometry || !isPoint(feature.geometry)) return;
        
        if (typeof feature.geometry.x !== 'number' || typeof feature.geometry.y !== 'number') return;

        xmin = Math.min(xmin, feature.geometry.x);
        ymin = Math.min(ymin, feature.geometry.y);
        xmax = Math.max(xmax, feature.geometry.x);
        ymax = Math.max(ymax, feature.geometry.y);
        
        if (feature.geometry.spatialReference) {
          spatialReference = feature.geometry.spatialReference;
        }
      });

      // If no valid coordinates were found, use default extent
      if (xmin === Infinity || ymin === Infinity || xmax === -Infinity || ymax === -Infinity) {
        const defaultExtent = new Extent({
          xmin: -13046927.906568646,
          ymin: 3856945.6796721765,
          xmax: -13046327.906568646,
          ymax: 3857545.6796721765,
          spatialReference: { wkid: 102100 }
        });
        this.extent = defaultExtent;
        return defaultExtent;
      }

      // Add padding (10% of the extent size)
      const width = xmax - xmin;
      const height = ymax - ymin;
      const padding = Math.max(width, height) * 0.1;

      const calculatedExtent = new Extent({
        xmin: xmin - padding,
        ymin: ymin - padding,
        xmax: xmax + padding,
        ymax: ymax + padding,
        spatialReference
      });
      
      // Also set the extent property for compatibility
      this.extent = calculatedExtent;
      return calculatedExtent;
    } catch (error) {
      console.error('Error calculating extent:', error);
      const defaultExtent = new Extent({
        xmin: -13046927.906568646,
        ymin: 3856945.6796721765,
        xmax: -13046327.906568646,
        ymax: 3857545.6796721765,
        spatialReference: { wkid: 102100 }
      });
      this.extent = defaultExtent;
      return defaultExtent;
    }
  }

  private validateFields(data: Symbol3DData): void {
    console.log('=== Validating Fields ===');
    const startTime = performance.now();

    const numericFields = new Set<string>();
    const invalidFields = new Set<string>();
    const missingFields = new Set<string>();

    // Check required fields
    [data.heightField, data.colorField, data.sizeField].forEach(field => {
      if (!field) return;
      
      let foundInAnyFeature = false;
      let allValuesNumeric = true;

      this.polygonFeatures.forEach(feature => {
        if (!(field in (feature.attributes || {}))) {
          if (!foundInAnyFeature) missingFields.add(field);
          return;
        }
        
        foundInAnyFeature = true;
        const value = feature.attributes[field];
        
        if (typeof value !== 'number' || isNaN(value)) {
          allValuesNumeric = false;
          invalidFields.add(field);
        }
      });

      if (foundInAnyFeature && allValuesNumeric) {
        numericFields.add(field);
      }
    });

    console.log('Field validation results:', {
      validNumericFields: Array.from(numericFields),
      invalidFields: Array.from(invalidFields),
      missingFields: Array.from(missingFields),
      validationTimeMs: (performance.now() - startTime).toFixed(2)
    });

    if (missingFields.size > 0) {
      throw new Error(`Missing required fields: ${Array.from(missingFields).join(', ')}`);
    }

    if (invalidFields.size > 0) {
      throw new Error(`Fields contain non-numeric values: ${Array.from(invalidFields).join(', ')}`);
    }
  }

  private validateFeatures(features: __esri.Graphic[]): void {
    console.log('=== Validating Features ===');
    const startTime = performance.now();

    const validation = {
      total: features.length,
      validGeometry: 0,
      validAttributes: 0,
      invalidGeometry: [] as number[],
      invalidAttributes: [] as number[],
      spatialReferences: new Set<number>()
    };

    features.forEach((feature, index) => {
      // Validate geometry
      const geometry = feature.geometry as __esri.Point;
      if (geometry && 
          geometry.type === 'point' && 
          typeof geometry.x === 'number' && 
          typeof geometry.y === 'number') {
        validation.validGeometry++;
        if (geometry.spatialReference?.wkid) {
          validation.spatialReferences.add(geometry.spatialReference.wkid);
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

    console.log('Feature validation results:', {
      ...validation,
      spatialReferences: Array.from(validation.spatialReferences),
      validationTimeMs: (performance.now() - startTime).toFixed(2)
    });

    if (validation.validGeometry === 0) {
      throw new Error('No features have valid point geometries');
    }

    if (validation.spatialReferences.size > 1) {
      console.warn('Multiple spatial references detected:', Array.from(validation.spatialReferences));
    }
  }

  async create(
    data: Symbol3DData,
    options?: VisualizationOptions
  ): Promise<{ layer: __esri.FeatureLayer; extent: __esri.Extent }> {
    const startTime = performance.now();
    console.log('=== Symbol3D Visualization Create ===');
    console.log('Input data:', {
      featureCount: data.features?.length || 0,
      storeCount: data.targetStoreFeatures?.length || 0,
      fields: { 
        heightField: data.heightField, 
        colorField: data.colorField, 
        sizeField: data.sizeField 
      },
      symbolType: data.symbolType || '3d-cylinder'
    });

    // Validate input data
    if (!data.features?.length) {
      throw new Error('No source features provided for visualization');
    }

    if (!data.targetStoreFeatures?.length) {
      throw new Error('No store features provided for visualization');
    }

    // Store polygon features and validate fields
    this.polygonFeatures = data.features;
    this.validateFields(data);

    // Process store features with enhanced validation
    console.log('=== Processing Store Features ===');
    const processingStartTime = performance.now();
    
    const processedFeatures = data.targetStoreFeatures
      .map((storeFeature, index) => {
        try {
          const feature = this.ensureValidGeometry(storeFeature);
          if (!feature) {
            console.warn(`Failed to process store feature ${index}`);
            return null;
          }
          return feature;
        } catch (error) {
          console.error(`Error processing store feature ${index}:`, error);
          return null;
        }
      })
      .filter((feature): feature is __esri.Graphic => feature !== null);

    console.log('Feature processing results:', {
      inputCount: data.targetStoreFeatures.length,
      validCount: processedFeatures.length,
      invalidCount: data.targetStoreFeatures.length - processedFeatures.length,
      processingTimeMs: (performance.now() - processingStartTime).toFixed(2)
    });

    if (processedFeatures.length === 0) {
      throw new Error('No valid features after geometry processing');
    }

    // Validate processed features
    this.validateFeatures(processedFeatures);
    this.features = processedFeatures;

    // Create fields with validation
    console.log('=== Creating Fields ===');
    const fieldsStartTime = performance.now();
    const fields = this.createFields(processedFeatures[0].attributes);
    
    console.log('Fields created:', {
      count: fields.length,
      types: fields.reduce((acc, f) => {
        acc[f.type] = (acc[f.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      creationTimeMs: (performance.now() - fieldsStartTime).toFixed(2)
    });

    // Create renderer with visual variables
    console.log('=== Creating Renderer ===');
    const rendererStartTime = performance.now();
    const renderer = this.create3DRenderer(data.heightField, data.colorField, data.sizeField);
    
    console.log('Renderer created:', {
      type: renderer.type,
      visualVariablesCount: renderer.visualVariables?.length || 0,
      symbolType: (renderer.symbol as PointSymbol3D).symbolLayers.getItemAt(0)?.type,
      creationTimeMs: (performance.now() - rendererStartTime).toFixed(2)
    });

    // Create and load the layer
    console.log('=== Creating Feature Layer ===');
    const layerStartTime = performance.now();
    
    const layer = new FeatureLayer({
      title: options?.title || this.title,
      source: processedFeatures,
      objectIdField: 'OBJECTID',
      fields,
      renderer,
      elevationInfo: {
        mode: 'relative-to-ground'
      },
      visible: true
    });

    try {
      await layer.load();
      await layer.when();
      
      console.log('Layer created successfully:', {
        id: layer.id,
        title: layer.title,
        loaded: layer.loaded,
        geometryType: layer.geometryType,
        features: processedFeatures.length,
        spatialReference: layer.spatialReference?.wkid,
        creationTimeMs: (performance.now() - layerStartTime).toFixed(2)
      });

      // Calculate and validate extent
      console.log('=== Calculating Extent ===');
      const extentStartTime = performance.now();
      const extent = this.calculateExtent(processedFeatures);
      
      console.log('Extent calculated:', {
        xmin: extent?.xmin?.toFixed(2) ?? '0',
        ymin: extent?.ymin?.toFixed(2) ?? '0',
        xmax: extent?.xmax?.toFixed(2) ?? '0',
        ymax: extent?.ymax?.toFixed(2) ?? '0',
        width: extent ? (extent.xmax - extent.xmin).toFixed(2) : '0',
        height: extent ? (extent.ymax - extent.ymin).toFixed(2) : '0',
        spatialReference: extent?.spatialReference?.wkid ?? '0',
        calculationTimeMs: (performance.now() - extentStartTime).toFixed(2)
      });

      if (!extent) {
        throw new Error('Failed to calculate extent');
      }

      const totalTime = performance.now() - startTime;
      console.log('=== Symbol3D Visualization Complete ===');
      console.log('Performance summary:', {
        totalTimeMs: totalTime.toFixed(2),
        processingTimeMs: (processingStartTime - startTime).toFixed(2),
        fieldsTimeMs: (fieldsStartTime - processingStartTime).toFixed(2),
        rendererTimeMs: (rendererStartTime - fieldsStartTime).toFixed(2),
        layerTimeMs: (layerStartTime - rendererStartTime).toFixed(2),
        extentTimeMs: (performance.now() - layerStartTime).toFixed(2)
      });

      return { layer, extent };
    } catch (err) {
      console.error('Error creating layer:', err);
      const error = err as Error;
      throw new Error(`Failed to create 3D symbol layer: ${error.message}`);
    }
  }

  getRenderer(): Renderer {
    return this.renderer;
  }

  getLegendInfo(): StandardizedLegendData {
    return {
      title: this.title,
      type: "class-breaks",
      description: "3D symbol visualization showing height and color variations",
      items: [{
        label: '3D Symbol',
        color: 'rgba(0, 116, 217, DEFAULT_FILL_ALPHA)',
        shape: 'square',
        size: 16
      }]
    };
  }

  protected createFields(sampleAttributes: { [key: string]: any }): __esri.Field[] {
    return Object.keys(sampleAttributes).map(fieldName => ({
      name: fieldName,
      type: typeof sampleAttributes[fieldName] === 'number' ? 'double' : 'string',
      alias: fieldName
    })) as __esri.Field[];
  }

  private getFieldFromPolygons(fieldName: string): { field: string; values: number[] } | null {
    // Try to find the field in any polygon feature
    for (const feature of this.polygonFeatures) {
      const value = feature.attributes?.[fieldName];
      if (typeof value === 'number' && !isNaN(value)) {
        // Found a matching field, get all values from features with this field
        const values = this.polygonFeatures
          .map(f => {
            const val = f.attributes?.[fieldName];
            return typeof val === 'number' && !isNaN(val) ? val : null;
          })
          .filter((v): v is number => v !== null);

        if (values.length > 0) {
          return { field: fieldName, values };
        }
      }
    }
    return null;
  }

  private create3DRenderer(heightField?: string, colorField?: string, sizeField?: string): __esri.SimpleRenderer {
    const visualVariables: (__esri.SizeVariable | __esri.ColorVariable)[] = [];

    // Get all available numeric fields from polygon features
    const allNumericFields = new Set<string>();
    this.polygonFeatures.forEach(feature => {
      Object.entries(feature.attributes || {})
        .filter(([_, value]) => typeof value === 'number')
        .forEach(([field]) => allNumericFields.add(field));
    });

    console.log('All available numeric fields:', Array.from(allNumericFields));

    // Try to find the specified fields or suitable alternatives
    let heightData = heightField ? this.getFieldFromPolygons(heightField) : null;
    let colorData = colorField ? this.getFieldFromPolygons(colorField) : null;
    let sizeData = sizeField ? this.getFieldFromPolygons(sizeField) : null;

    // If specified fields weren't found, try to find suitable alternatives
    const availableFields = Array.from(allNumericFields)
      .filter(field => !['OBJECTID', 'Shape__Area', 'Shape__Length', 'CreationDate', 'EditDate'].includes(field));
    
    if (!heightData && availableFields.length > 0) {
      heightData = this.getFieldFromPolygons(availableFields[0]);
    }
    if (!colorData && availableFields.length > 1) {
      colorData = this.getFieldFromPolygons(availableFields[1]);
    }
    if (!sizeData && availableFields.length > 2) {
      sizeData = this.getFieldFromPolygons(availableFields[2]);
    }

    // Add height variation
    if (heightData) {
      visualVariables.push(
        new SizeVariable({
          field: heightData.field,
          axis: "height",
          minDataValue: Math.min(...heightData.values),
          maxDataValue: Math.max(...heightData.values),
          minSize: 10000,
          maxSize: 200000,
          legendOptions: {
            title: heightData.field,
            showLegend: true
          }
        })
      );
    }

    // Add color variation
    if (colorData) {
      visualVariables.push(
        new ColorVariable({
          field: colorData.field,
          stops: [
            { value: Math.min(...colorData.values), color: new Color([98, 211, 255, 0.8]) },
            { value: (Math.min(...colorData.values) + Math.max(...colorData.values)) / 2, color: new Color([0, 149, 255, 0.8]) },
            { value: Math.max(...colorData.values), color: new Color([0, 70, 255, 0.8]) }
          ],
          legendOptions: {
            title: colorData.field,
            showLegend: true
          }
        })
      );
    }

    // Add size variation
    if (sizeData) {
      visualVariables.push(
        new SizeVariable({
          field: sizeData.field,
          axis: "width-and-depth",
          minDataValue: Math.min(...sizeData.values),
          maxDataValue: Math.max(...sizeData.values),
          minSize: 10000,
          maxSize: 50000,
          legendOptions: {
            title: sizeData.field,
            showLegend: true
          }
        })
      );
    }

    return new SimpleRenderer({
      symbol: this.createSymbol3D(),
      visualVariables
    });
  }
} 