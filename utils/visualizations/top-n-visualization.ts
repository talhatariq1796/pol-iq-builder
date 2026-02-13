import { DEFAULT_FILL_ALPHA } from "./constants";
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
import { VisualizationOptions, BaseVisualization, BaseVisualizationData, VisualizationResult } from './base-visualization';
import Extent from '@arcgis/core/geometry/Extent';
import Graphic from '@arcgis/core/Graphic';
import SpatialReference from '@arcgis/core/geometry/SpatialReference';
import { isFinite } from 'lodash';
import Polygon from '@arcgis/core/geometry/Polygon';
import Point from '@arcgis/core/geometry/Point';
import Polyline from '@arcgis/core/geometry/Polyline';
import * as projection from '@arcgis/core/geometry/projection';
import PopupTemplate from '@arcgis/core/PopupTemplate';
import FieldInfo from '@arcgis/core/popup/FieldInfo';
import { StandardizedLegendData, LegendType } from '@/types/legend';
import { FieldMappingHelper } from './field-mapping-helper';

// Custom interface for geometries with rings (polygon or polyline)
type GeometryWithRings = __esri.Geometry & {
  rings?: number[][][];
  coordinates?: number[][][];
};

interface FilterCondition {
  field: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  value: number;
}

export interface TopNData extends BaseVisualizationData {
  field: string;
  n: number;
  filterConditions?: FilterCondition[];
  title?: string;
  layerConfig: {
    fields: Array<{
      name: string;
      type: "string" | "oid" | "small-integer" | "integer" | "single" | "double" | "long" | "date" | "big-integer" | "date-only" | "time-only" | "timestamp-offset" | "geometry" | "blob" | "raster" | "guid" | "global-id" | "xml";
      label?: string;
      alias?: string;
    }>;
  };
  geometryType?: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  validationTimeMs: string;
}

export class TopNVisualization extends BaseVisualization<TopNData> {
  private polygonRenderer: __esri.Renderer;
  private pointRenderer: __esri.Renderer;

  constructor() {
    super();
    // Create basic renderers that will be configured with actual data values later
    this.polygonRenderer = new SimpleRenderer({
      symbol: new SimpleFillSymbol({
        color: [49, 163, 84, 0.9],
        outline: { color: [0, 0, 0, 0], width: 0 }
      })
    });

    this.pointRenderer = new SimpleRenderer({
      symbol: new SimpleMarkerSymbol({
        color: [49, 163, 84, 0.9],
        size: 10,
        outline: { color: [0, 0, 0, 0], width: 0 }
      })
    });
  }

  private configureRenderer(field: string, values: number[]): void {
    // Sort values in descending order
    const sortedValues = [...values].sort((a, b) => b - a);
    
    // Calculate breaks using actual data values
    const maxValue = sortedValues[0];
    const q2 = sortedValues[Math.floor(sortedValues.length * 0.25)] || maxValue * 0.75;
    const q3 = sortedValues[Math.floor(sortedValues.length * 0.5)] || maxValue * 0.5;

    // Configure polygon renderer
    this.polygonRenderer = new SimpleRenderer({
      symbol: new SimpleFillSymbol({
        color: [49, 163, 84, 0.9],
        outline: { color: [0, 0, 0, 0], width: 0 }
      }),
      visualVariables: [{
        type: "color" as const,
        field: field,
        stops: [
          { value: maxValue, color: [230, 0, 0, 0.9] },    // Highest values - Red
          { value: q2, color: [49, 163, 84, 0.9] },        // High values - Green
          { value: q3, color: [161, 217, 155, 0.8] }       // Lower values - Light green
        ]
      }, {
        type: "size" as const,
        field: field,
        stops: [
          { value: maxValue, size: 2 },
          { value: q2, size: 1 },
          { value: q3, size: 0.5 }
        ],
        target: "outline"
      }] as unknown as __esri.VisualVariable[]
    });

    // Configure point renderer
    this.pointRenderer = new SimpleRenderer({
      symbol: new SimpleMarkerSymbol({
        color: [49, 163, 84, 0.9],
        size: 10,
        outline: { color: [0, 0, 0, 0], width: 0 }
      }),
      visualVariables: [{
        type: "color" as const,
        field: field,
        stops: [
          { value: maxValue, color: [230, 0, 0, 0.9] },    // Highest values - Red
          { value: q2, color: [49, 163, 84, 0.9] },        // High values - Green
          { value: q3, color: [161, 217, 155, 0.8] }       // Lower values - Light green
        ]
      }] as unknown as __esri.VisualVariable[]
    });
  }

  private getRendererForGeometryType(geometryType: string): __esri.Renderer {
    return geometryType === 'point' ? this.pointRenderer : this.polygonRenderer;
  }

  private validateInput(data: TopNData): ValidationResult {
    console.log('=== Validating TopN Input Data ===');
    
    const errors: string[] = [];
    const validation: ValidationResult = {
      isValid: true,
      errors: [],
      validationTimeMs: '0'
    };

    // Validate required fields
    if (!data.features || data.features.length === 0) {
      errors.push('No features provided');
      validation.isValid = false;
    }

    if (!data.field) {
      errors.push('No field specified for sorting');
      validation.isValid = false;
    }

    if (!data.n || data.n <= 0) {
      errors.push('Invalid N value');
      validation.isValid = false;
    }

    validation.errors = errors;
    console.log('Input validation:', validation);
    console.log('Input validation complete');
    
    return validation;
  }

  private validateFeatures(features: __esri.Graphic[]): ValidationResult {
    const startTime = performance.now();
    const validation = {
      total: features.length,
      validGeometry: 0,
      validAttributes: 0,
      geometryTypes: new Set<string>(),
      spatialReferences: new Set<number>()
    };

    const errors: string[] = [];

    if (!features?.length) {
      errors.push('No features provided');
      return {
        isValid: false,
        errors,
        validationTimeMs: (performance.now() - startTime).toFixed(2)
      };
    }

    features.forEach((feature, index) => {
      // Validate geometry
      if (feature.geometry) {
        const geomType = feature.geometry.type?.toLowerCase();
        validation.geometryTypes.add(geomType);

        // Check for valid polygon geometry
        if (geomType === 'polygon') {
          const rings = (feature.geometry as any).rings;
          if (Array.isArray(rings) && rings.length > 0) {
            // Validate ring structure
            const hasValidRings = rings.every((ring: number[][]) => 
              Array.isArray(ring) && 
              ring.length >= 3 && 
              ring.every((coord: number[]) => 
                Array.isArray(coord) && 
                coord.length === 2 && 
                typeof coord[0] === 'number' && 
                typeof coord[1] === 'number' &&
                !isNaN(coord[0]) && 
                !isNaN(coord[1])
              )
            );

            if (hasValidRings) {
              validation.validGeometry++;
            } else {
              console.warn(`Feature ${index} has invalid ring structure:`, rings);
            }
          }
        }

        // Track spatial reference
        if (feature.geometry.spatialReference?.wkid) {
          validation.spatialReferences.add(feature.geometry.spatialReference.wkid);
        }
      }

      // Validate attributes
      if (feature.attributes && Object.keys(feature.attributes).length > 0) {
        validation.validAttributes++;
      }
    });

    // Check for validation issues
    if (validation.validGeometry === 0) {
      errors.push('No features have valid geometries');
    }

    if (validation.validAttributes === 0) {
      errors.push('No features have valid attributes');
    }

    if (validation.spatialReferences.size > 1) {
      console.warn('Multiple spatial references detected:', Array.from(validation.spatialReferences));
    }

    console.log('Feature validation:', {
      total: validation.total,
      validGeometry: validation.validGeometry,
      validAttributes: validation.validAttributes,
      geometryTypes: Array.from(validation.geometryTypes),
      spatialReferences: Array.from(validation.spatialReferences)
    });

    return {
      isValid: errors.length === 0,
      errors,
      validationTimeMs: (performance.now() - startTime).toFixed(2)
    };
  }

  private applyFilterConditions(features: __esri.Graphic[], conditions: FilterCondition[]): __esri.Graphic[] {
    console.log('Applying filter conditions:', conditions);
    
    return features.filter(feature => {
      return conditions.every(condition => {
        const value = feature.attributes[condition.field];
        if (typeof value !== 'number' || !isFinite(value)) {
          console.warn(`Invalid value for field ${condition.field}:`, value);
          return false;
        }

        switch (condition.operator) {
          case '>':
            return value > condition.value;
          case '<':
            return value < condition.value;
          case '>=':
            return value >= condition.value;
          case '<=':
            return value <= condition.value;
          case '==':
            return value === condition.value;
          case '!=':
            return value !== condition.value;
          default:
            return false;
        }
      });
    });
  }

  private calculateTopN(features: Graphic[], field: string, n: number): Graphic[] {
    console.log('Calculating top N features:', {
      totalFeatures: features.length,
      field: field,
      n: n
    });

    // Filter valid features (has geometry and valid field value)
    const validFeatures = features.filter(f => {
      const rawValue = f.attributes[field];
      const value = Number(rawValue);
      console.log('Processing feature value:', {
        raw: rawValue,
        converted: value,
        attributes: Object.keys(f.attributes),
        type: typeof rawValue
      });
      const hasValidValue = isFinite(value);
      const geometry = f.geometry;
      
      // Generic geometry validation
      const hasValidGeometry = geometry ? this.validateGeometry(geometry) : false;

      if (!hasValidValue || !hasValidGeometry) {
        console.warn('Invalid feature:', {
          value,
          hasValidValue,
          hasValidGeometry,
          geometryType: geometry?.type,
          spatialReference: geometry?.spatialReference?.wkid
        });
      }

      return hasValidValue && hasValidGeometry;
    });

    console.log('Valid features:', {
      count: validFeatures.length,
      sampleFeatures: validFeatures.slice(0, 3).map(f => ({
        value: f.attributes[field],
        geometryType: f.geometry?.type,
        spatialReference: f.geometry?.spatialReference?.wkid
      }))
    });

    // Sort features by value in descending order
    const sortedFeatures = validFeatures.sort((a, b) => {
      const valueA = Number(a.attributes[field]);
      const valueB = Number(b.attributes[field]);
      return valueB - valueA;
    });

    // Take top N features
    const topFeatures = sortedFeatures.slice(0, n);

    // Find the name/description field for feature descriptions
    const nameField = this.findNameField(topFeatures[0]) || 'OBJECTID';
    const titleField = topFeatures[0]?.attributes?.DESCRIPTION ? 'DESCRIPTION' : nameField;

    console.log('Selected features:', {
      total: topFeatures.length,
      sampleFeatures: topFeatures.map(f => ({
        value: f.attributes[field],
        attributes: f.attributes
      }))
    });

    // Create ranked features
    const rankedFeatures = topFeatures.map((feature, index) => {
      const rank = index + 1;
      const value = Number(feature.attributes[field]);
      
      try {
        // Create a new geometry with explicit spatial reference
        const sourceGeometry = feature.geometry;
        const targetSpatialReference = sourceGeometry?.spatialReference || new SpatialReference({ wkid: 102100 });
        
        if (!sourceGeometry) {
          throw new Error('Source geometry is null or undefined');
        }
        const newGeometry = this.createGeometry(sourceGeometry, targetSpatialReference);

        if (!newGeometry) {
          throw new Error('Failed to create valid geometry');
        }

        // Create a descriptive label using available fields
        const description = this.createFeatureDescription(feature, field, rank, nameField);

        return new Graphic({
          geometry: newGeometry as any,
          attributes: {
            OBJECTID: feature.attributes.OBJECTID || index + 1,
            ...feature.attributes,
            RANK: rank,
            DESCRIPTION: description
          }
        });
      } catch (error) {
        console.error('Error creating ranked feature:', error, {
          featureId: feature.attributes.OBJECTID,
          rank,
          geometryType: feature.geometry?.type,
          spatialReference: feature.geometry?.spatialReference?.wkid
        });
        return null;
      }
    }).filter((f): f is Graphic => f !== null);

    console.log('Ranked features:', {
      count: rankedFeatures.length,
      sampleFeatures: rankedFeatures.slice(0, 3).map(f => ({
        rank: f.attributes.RANK,
        value: f.attributes[field],
        description: f.attributes.DESCRIPTION,
        geometryType: f.geometry?.type
      }))
    });

    return rankedFeatures;
  }

  private validateGeometry(geometry: __esri.Geometry): boolean {
    if (!geometry || !geometry.type) return false;

    switch (geometry.type.toLowerCase()) {
      case 'polygon': {
        const poly = geometry as __esri.Polygon;
        return !!(poly.rings?.length > 0 && poly.rings.every(ring => 
          Array.isArray(ring) && ring.length >= 3 && ring.every(coord => 
            Array.isArray(coord) && coord.length === 2 && 
            isFinite(coord[0]) && isFinite(coord[1])
          )
        ));
      }
      case 'point': {
        const point = geometry as __esri.Point;
        return !!(isFinite(point.x) && isFinite(point.y));
      }
      case 'polyline': {
        const line = geometry as __esri.Polyline;
        return !!(line.paths?.length > 0 && line.paths.every(path => 
          Array.isArray(path) && path.length >= 2 && path.every(coord => 
            Array.isArray(coord) && coord.length === 2 && 
            isFinite(coord[0]) && isFinite(coord[1])
          )
        ));
      }
      default:
        return false;
    }
  }

  private findNameField(feature: Graphic): string | null {
    if (!feature?.attributes) {
      throw new Error('Cannot find name field: Feature has no attributes.');
    }

    // Common name field patterns
    const namePatterns = [
      /^name$/i,
      /^description$/i,
      /^title$/i,
      /^label$/i,
      /.*name.*/i,
      /.*description.*/i,
      /.*title.*/i,
      /.*label.*/i
    ];

    // Try to find a matching field
    for (const pattern of namePatterns) {
      const field = Object.keys(feature.attributes).find(key => pattern.test(key));
      if (field) {
        console.log(`[TopNVisualization] Found name field: ${field}`);
        return field;
    }
    }

    // If no name field found, provide detailed error message
    const availableFields = Object.keys(feature.attributes)
      .map(field => `${field} (${typeof feature.attributes[field]})`)
      .join(', ');

    throw new Error(
      `No suitable name field found. Looking for fields matching these patterns: ${namePatterns.map(p => p.toString()).join(', ')}. ` +
      `Available fields: ${availableFields}`
    );
  }

  private createGeometry(sourceGeometry: __esri.Geometry, targetSpatialReference: __esri.SpatialReference): __esri.Geometry {
    switch (sourceGeometry.type.toLowerCase()) {
      case 'polygon': {
        const poly = sourceGeometry as __esri.Polygon;
        const validRings = poly.rings.map(ring => 
          ring.map(coord => {
            const [x, y] = coord;
            return [
              typeof x === 'number' && isFinite(x) ? x : 0,
              typeof y === 'number' && isFinite(y) ? y : 0
            ];
          })
        ).filter(ring => ring.length >= 3);

        if (!validRings.length) {
          throw new Error('No valid rings after normalization');
        }

        return new Polygon({
          rings: validRings,
          spatialReference: targetSpatialReference
        });
      }

      case 'point': {
        const point = sourceGeometry as __esri.Point;
        return new Point({
          x: point.x,
          y: point.y,
          spatialReference: targetSpatialReference
        });
      }

      case 'polyline': {
        const line = sourceGeometry as __esri.Polyline;
        const validPaths = line.paths.map(path => 
          path.map(coord => {
            const [x, y] = coord;
            return [
              typeof x === 'number' && isFinite(x) ? x : 0,
              typeof y === 'number' && isFinite(y) ? y : 0
            ];
          })
        ).filter(path => path.length >= 2);

        if (!validPaths.length) {
          throw new Error('No valid paths after normalization');
        }

        return new Polyline({
          paths: validPaths,
          spatialReference: targetSpatialReference
        });
      }

      default:
        throw new Error(`Unsupported geometry type: ${sourceGeometry.type}`);
    }
  }

  private createFeatureDescription(feature: Graphic, field: string, rank: number, nameField: string | null): string {
    const value = Number(feature.attributes[field]);
    const name = nameField ? feature.attributes[nameField] : '';
    const formattedValue = `$${value.toLocaleString()}`;
    
    if (name) {
      return `${rank}. ${name}: ${formattedValue}`;
    } else {
      return `${rank}. ${field} = ${formattedValue}`;
    }
  }

  async create(data: TopNData, options: VisualizationOptions = {}): Promise<VisualizationResult> {
    console.log('=== Creating TopN Visualization ===');
    
    // Validate input data
    const inputValidation = this.validateInput(data);
    if (!inputValidation.isValid) {
      throw new Error(`Invalid input data: ${inputValidation.errors.join(', ')}`);
    }

    // Apply filter conditions if any
    let processedFeatures = data.filterConditions?.length 
      ? this.applyFilterConditions(data.features, data.filterConditions)
      : data.features;

    // Get all values for the field to configure renderer
    const values = processedFeatures
      .map(f => Number(f.attributes[data.field]))
      .filter(v => isFinite(v));
    
    // Configure renderers with actual data values
    this.configureRenderer(data.field, values);

    // Calculate top N features
    processedFeatures = this.calculateTopN(processedFeatures, data.field, data.n);

    // Validate processed features
    const featureValidation = this.validateFeatures(processedFeatures);
    if (!featureValidation.isValid) {
      throw new Error(`Feature validation failed: ${featureValidation.errors.join(', ')}`);
    }

    // Set renderer based on geometry type
    const geometryType = processedFeatures[0]?.geometry?.type?.toLowerCase() || 'polygon';
    this.renderer = this.getRendererForGeometryType(geometryType);

    // Find the field configuration for the primary field
    const primaryFieldConfig = data.layerConfig.fields.find(f => f.name === data.field);
    const primaryFieldLabel = primaryFieldConfig?.label || primaryFieldConfig?.alias || data.field;

    // Ensure rank field is defined in layer configuration
    const layerConfig = {
      fields: [
        ...data.layerConfig.fields,
        {
          name: 'rank',
          type: 'integer' as const,
          label: 'Rank',
          alias: 'Rank'
        }
      ]
    };

    // Get common spatial reference from features or use Web Mercator
    const commonSpatialReference = processedFeatures[0]?.geometry?.spatialReference || 
      new SpatialReference({ wkid: 102100 });

    // Initialize layer with explicit geometry type and spatial reference
    const layer = new FeatureLayer({
      source: processedFeatures,
      objectIdField: "OBJECTID",
      fields: layerConfig.fields,
      geometryType: geometryType as any,
      spatialReference: commonSpatialReference,
      renderer: this.renderer,
      title: options.title || `Top ${data.n} Areas by ${primaryFieldLabel}`,
      visible: true,
      opacity: 0.8
    });

    this.layer = layer;

    // Calculate extent from processed features
    await this.calculateExtent(processedFeatures);

    // Log layer creation details
    console.log('TopN layer created:', {
      layerId: this.layer.id,
      title: this.layer.title,
      featureCount: processedFeatures.length,
      geometryType: this.layer.geometryType,
      spatialReference: this.layer.spatialReference?.wkid,
      visible: this.layer.visible,
      opacity: this.layer.opacity,
      extent: this.extent ? {
        xmin: this.extent.xmin,
        ymin: this.extent.ymin,
        xmax: this.extent.xmax,
        ymax: this.extent.ymax,
        spatialReference: this.extent.spatialReference?.wkid
      } : null,
      sampleFeature: processedFeatures[0] ? {
        hasGeometry: !!processedFeatures[0].geometry,
        geometryType: processedFeatures[0].geometry?.type,
        rings: (processedFeatures[0].geometry as __esri.Polygon).rings?.length,
        spatialReference: processedFeatures[0].geometry?.spatialReference?.wkid
      } : null
    });

    if (!this.layer || !this.extent) {
      throw new Error('Layer or extent not initialized');
    }

    // Final result object
    return {
      layer,
      extent: this.extent,
      renderer: this.renderer,
      legendInfo: this.getLegendInfo(),
      shouldZoom: true
    };
  }

  getRenderer(geometryType: string = 'polygon'): __esri.Renderer {
    return this.getRendererForGeometryType(geometryType);
  }

  getLegendInfo(): StandardizedLegendData {
    // Use standardized field mapping for legend title
    const rendererField = this.data?.field || 'value';
    const friendlyFieldName = FieldMappingHelper.getFriendlyFieldName(rendererField);
    
    return {
      title: `Top ${friendlyFieldName} Areas`,
      type: 'simple' as LegendType,
      description: `Highest ranking areas for ${friendlyFieldName}`,
      items: [
        {
          label: `High ${friendlyFieldName}`,
          color: '#33a852',
          outlineColor: '#29753d',
          shape: 'square' as const,
          size: 16
        }
      ]
    };
  }

  protected calculateExtent(
    features: __esri.Graphic[],
    options: { padding?: number; spatialReference?: __esri.SpatialReference } = {}
  ): __esri.Extent | null {
    console.log('=== Calculating TopN Extent ===', {
      totalFeatures: features.length,
      geometryType: features[0]?.geometry?.type,
      sampleFeature: features[0]
    });

    if (!features.length) {
      console.warn('[TopNVisualization] No features provided for extent calculation');
      return null;
    }

    let xmin = Infinity;
    let ymin = Infinity;
    let xmax = -Infinity;
    let ymax = -Infinity;
    let hasValidExtent = false;

    for (const feature of features) {
      if (!feature.geometry?.extent) {
        console.log('Feature has no geometry extent:', {
          hasGeometry: !!feature.geometry,
          geometryType: feature.geometry?.type,
          attributes: feature.attributes
        });
        continue;
      }

      const extent = feature.geometry.extent;
      if (isFinite(extent.xmin) && isFinite(extent.ymin) && 
          isFinite(extent.xmax) && isFinite(extent.ymax)) {
        xmin = Math.min(xmin, extent.xmin);
        ymin = Math.min(ymin, extent.ymin);
        xmax = Math.max(xmax, extent.xmax);
        ymax = Math.max(ymax, extent.ymax);
        hasValidExtent = true;
      }
    }

    if (!hasValidExtent) {
      console.error('[TopNVisualization] Failed to calculate extent: no valid extents found');
      return null;
    }

    const extentObj = new Extent({
      xmin,
      ymin,
      xmax,
      ymax,
      spatialReference: features[0]?.geometry?.spatialReference
    });

    // Add padding to the extent for better visualization
    const paddingFactor = options.padding || 1.2;
    extentObj.expand(paddingFactor);
    
    // Store the extent for later use
    this.extent = extentObj;
    
    return extentObj;
  }

  protected processMicroserviceResponse(response: any): TopNData {
    const inputRecords = (response?.inputRecords || response?.records || response?.data || []);
    const features = inputRecords.map((record: any, index: number) => ({
      attributes: {
        ...record,
        ID: record.ID,
        OBJECTID: index + 1
      }
    }));
    return {
      features,
      field: 'thematic_value',
      n: 10,
      layerName: 'Top N Analysis',
      layerConfig: {
        fields: Object.keys(inputRecords[0] || {}).map(name => ({ name, type: typeof inputRecords[0][name] === 'number' ? 'double' : 'string' }))
      },
      geometryType: 'polygon',
    };
  }
} 