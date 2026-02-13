import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Renderer from '@arcgis/core/renderers/Renderer';
import Extent from '@arcgis/core/geometry/Extent';
import Graphic from '@arcgis/core/Graphic';
import Polygon from '@arcgis/core/geometry/Polygon';
import Point from '@arcgis/core/geometry/Point';
import * as projection from '@arcgis/core/geometry/projection';
import { mapFeatureFields, createFieldDefinitions, createPopupFieldInfos } from '../field-mapping';
import { LayerField } from '../../types/geospatial-ai-types';
import { FieldMappingHelper } from './field-mapping-helper';
import SpatialReference from '@arcgis/core/geometry/SpatialReference';
import Geometry from '@arcgis/core/geometry/Geometry';
import Viewpoint from '@arcgis/core/Viewpoint';
import { PopupConfiguration } from '@/types/popup-config';
import { createDefaultPopupConfig, createPopupTemplateFromConfig } from '@/utils/popup-utils';
import { StandardizedLegendData, LegendType, colorToRgba, getSymbolShape, getSymbolSize } from '@/types/legend';
import { LegendItem } from '@/components/MapLegend';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer';
import { DEFAULT_FILL_ALPHA } from './constants';
import { createStandardizedPopupTemplate, StandardizedPopupConfig } from '../popup-utils';

// Define Web Mercator spatial reference constant
const webMercator = new SpatialReference({ wkid: 102100 });

export type BlendMode = 
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion';

export interface BlendModeOptions {
  mode: BlendMode;
  opacity?: number;
  transition?: {
    duration?: number;
    easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  };
}

export interface VisualizationOptions {
  title?: string;
  opacity?: number;
  visible?: boolean;
  mode?: 'highlight' | 'distribution' | 'density' | 'correlation' | 'topN';
  filterLayer?: {
    features: any[];
    field: string;
    threshold: 'top10percent' | number;
  };
  symbolConfig?: {
    color?: [number, number, number, number];
    size?: number;
    outline?: {
      color: [number, number, number, number];
      width: number;
    };
  };
  outline?: __esri.SimpleLineSymbolProperties | null;
  breaks?: number[];
  colorScheme?: string;
  labels?: boolean;
  popupConfig?: PopupConfiguration;
  opacityTransition?: {
    duration?: number;
    easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  };
  blendMode?: BlendModeOptions;
}

export interface BaseVisualizationData {
  features: any[];
  layerName: string;
  rendererField?: string;
  spatialReference?: __esri.SpatialReference;
  layerConfig?: {
    fields: Array<{
      name: string;
      label?: string;
      alias?: string;
      alternateNames?: string[];
      type: "string" | "oid" | "small-integer" | "integer" | "single" | "double" | "long" | "date" | "big-integer" | "date-only" | "time-only" | "timestamp-offset" | "geometry" | "blob" | "raster" | "guid" | "global-id" | "xml";
    }>;
  };
}

export interface VisualizationResult {
  layer: __esri.FeatureLayer | null;
  extent: __esri.Extent | null;
  renderer?: __esri.Renderer;
  legendInfo?: StandardizedLegendData;
  shouldZoom?: boolean;
  options?: {
    visible?: boolean;
    opacity?: number;
  };
}

export interface FilterDefinition {
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'starts-with' | 'ends-with';
  value: any;
}

export interface FilterGroup {
  operator: 'AND' | 'OR';
  filters: (FilterDefinition | FilterGroup)[];
}

export interface FilterOptions {
  filterDefinition: FilterDefinition | FilterGroup;
  highlightColor?: [number, number, number, number];
  highlightOutline?: {
    color: [number, number, number, number];
    width: number;
  };
}

export interface ZoomToFeatureOptions {
  featureId?: string | number;
  featureIndex?: number;
  padding?: number;
  duration?: number;
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

export interface TooltipField {
  field: string;
  label?: string;
  format?: {
    type: 'number' | 'date' | 'string';
    places?: number;
    prefix?: string;
    suffix?: string;
    dateFormat?: string;
  };
}

export interface TooltipOptions {
  fields: TooltipField[];
  title?: string;
  showGeometryInfo?: boolean;
  customContent?: (feature: __esri.Graphic) => string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  offset?: number;
}

export interface LegendUpdateEvent {
  type: 'filter' | 'data' | 'renderer' | 'visibility';
  details?: {
    filter?: FilterOptions;
    data?: BaseVisualizationData;
    renderer?: __esri.Renderer;
    visible?: boolean;
  };
}

export interface LegendUpdateCallback {
  (legendData: StandardizedLegendData): void;
}

interface TransitionOptions {
  duration?: number;
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  delay?: number;
  onComplete?: () => void;
}

class TransitionManager {
  private transitions: Map<string, number> = new Map();

  public startTransition(
    key: string,
    startValue: number,
    endValue: number,
    options: TransitionOptions = {}
  ): void {
    const {
      duration = 500,
      easing = 'ease-out',
      delay = 0,
      onComplete
    } = options;

    // Clear any existing transition
    this.cancelTransition(key);

    // Apply delay if specified
    if (delay > 0) {
      setTimeout(() => this.executeTransition(key, startValue, endValue, duration, easing, onComplete), delay);
    } else {
      this.executeTransition(key, startValue, endValue, duration, easing, onComplete);
    }
  }

  private executeTransition(
    key: string,
    startValue: number,
    endValue: number,
    duration: number,
    easing: string,
    onComplete?: () => void
  ): void {
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Apply easing function
      let easedProgress = progress;
      switch (easing) {
        case 'ease-in':
          easedProgress = progress * progress;
          break;
        case 'ease-out':
          easedProgress = 1 - Math.pow(1 - progress, 2);
          break;
        case 'ease-in-out':
          easedProgress = progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
          break;
      }

      const currentValue = startValue + (endValue - startValue) * easedProgress;
      this.updateValue(key, currentValue);

      if (progress < 1) {
        this.transitions.set(key, requestAnimationFrame(animate));
      } else {
        this.transitions.delete(key);
        onComplete?.();
      }
    };

    this.transitions.set(key, requestAnimationFrame(animate));
  }

  public cancelTransition(key: string): void {
    const animationFrame = this.transitions.get(key);
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      this.transitions.delete(key);
    }
  }

  public cancelAllTransitions(): void {
    this.transitions.forEach((animationFrame) => {
      cancelAnimationFrame(animationFrame);
    });
    this.transitions.clear();
  }

  protected updateValue(key: string, value: number): void {
    // To be implemented by subclasses
  }
}

export abstract class BaseVisualization<T extends BaseVisualizationData> {
  protected layer: FeatureLayer | null = null;
  protected renderer: __esri.Renderer | null = null;
  protected extent: __esri.Extent | null = null;
  protected data: T | null = null;
  protected activeFilter: FilterOptions | null = null;
  protected mapView: __esri.MapView | null = null;
  protected tooltipOptions: TooltipOptions | null = null;
  protected legendUpdateCallbacks: Set<LegendUpdateCallback> = new Set();
  protected currentOpacity: number = 1;
  protected opacityTransitionTimeout: number | null = null;
  protected currentBlendMode: BlendMode = 'normal';
  protected transitionManager: TransitionManager;

  constructor() {
    this.transitionManager = new TransitionManager();
  }

  abstract create(data: T, options?: VisualizationOptions): Promise<VisualizationResult>;
  
  protected async initializeLayer(
    data: T,
    options: VisualizationOptions = {},
    fields?: __esri.FieldProperties[],
    view?: __esri.MapView
  ): Promise<void> {
    this.data = data;
    
    /*console.log('=== Base Visualization Initialize ===', {
      layerName: data.layerName,
      rendererField: data.rendererField,
      featureCount: data.features?.length,
      configuredFields: data.layerConfig?.fields?.map(f => ({
        name: f.name,
        type: f.type,
        label: f.label
      }))
    });*/

    try {
      // Ensure consistent spatial reference
      const spatialRef = data.spatialReference || { wkid: 102100 };  // Web Mercator
      
      // Map features and collect statistics
      const mappedFeatures = data.features.map((f, i) => this.mapFeature(f, i));
      const stats = {
        total: mappedFeatures.length,
        withGeometry: mappedFeatures.filter(f => f.geometry).length,
        withoutGeometry: mappedFeatures.filter(f => !f.geometry).length,
        geometryTypes: new Set(mappedFeatures.filter(f => f.geometry).map(f => f.geometry?.type).filter((type): type is "extent" | "multipoint" | "point" | "polygon" | "polyline" | "mesh" => type !== undefined))
      };

     // console.log('Feature mapping summary:', stats);

      // Use provided fields or create them from the first feature
      const layerFields = fields || this.createFields(mappedFeatures[0]);

      // Create layer with mapped features
      this.layer = new FeatureLayer({
        source: mappedFeatures,
        objectIdField: "OBJECTID",
        fields: layerFields,
        renderer: this.renderer || undefined,
        opacity: options.opacity ?? DEFAULT_FILL_ALPHA,
        title: options.title || data.layerName,
        visible: options.visible ?? true,
        spatialReference: spatialRef,
      });

      // Calculate extent after layer creation
      await this.calculateExtent(mappedFeatures);

      // Ensure renderer is properly set
      if (this.renderer) {
        this.layer.renderer = this.renderer;
      }

      this.mapView = view || null;

      // Set initial opacity
      if (options.opacity !== undefined) {
        this.setOpacity(options.opacity, options.opacityTransition);
      }

      // Set initial blend mode if specified
      if (options.blendMode) {
        this.setBlendMode(options.blendMode);
      }
    } catch (error: unknown) {
      console.error('Error initializing layer:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to initialize layer: ${error.message}`);
      }
      throw new Error('Failed to initialize layer: Unknown error');
    }
  }

  protected findPrimaryNumericField(fields: LayerField[], attributes: { [key: string]: any }): string {
    /*console.log('Finding primary numeric field:', {
      availableFields: fields.map(f => ({ name: f.name, type: f.type })),
      attributeKeys: Object.keys(attributes)
    });*/

    // Check if we have any configured fields
    if (!fields || fields.length === 0) {
      throw new Error('No fields configured in the layer configuration. Please configure fields with appropriate types.');
    }

    // Check if we have any numeric fields configured
    const numericFields = fields.filter(field => 
      ['double', 'single', 'integer', 'small-integer'].includes(field.type)
    );

    if (numericFields.length === 0) {
      throw new Error(`No numeric fields configured in layer configuration. Found fields: ${fields.map(f => `${f.name} (${f.type})`).join(', ')}`);
    }

    // Check which numeric fields exist in the attributes
    const availableNumericFields = numericFields.filter(field => 
      attributes[field.name] !== undefined &&
      typeof attributes[field.name] === 'number'
    );

    if (availableNumericFields.length === 0) {
      const missingFields = numericFields.map(f => f.name).join(', ');
      throw new Error(`Configured numeric fields not found in feature attributes: ${missingFields}. Available attributes: ${Object.keys(attributes).join(', ')}`);
    }

    console.log('Using configured numeric field:', availableNumericFields[0].name);
    return availableNumericFields[0].name;
  }

  protected mapFeature(feature: any, index: number = 0): Graphic {
    // Combine attributes and properties
    const combinedAttributes = {
      ...feature.attributes,
      ...feature.properties,
      OBJECTID: index + 1
    };

    // Get geometry from feature
    let mappedGeometry = feature.geometry;
    if (!mappedGeometry) {
      return new Graphic({
        attributes: combinedAttributes
      });
    }

    // Ensure geometry has a type
    if (!mappedGeometry.type) {
      return new Graphic({
        attributes: combinedAttributes
      });
    }

    // Set spatial references
    const sourceSpatialRef = mappedGeometry.spatialReference || { wkid: 4326 }; // Default to WGS84
    const targetSpatialRef = { wkid: 102100 }; // Web Mercator

    // Only log first feature spatial reference
    if (index === 0) {
      /*console.log('Feature spatial reference:', {
        source: sourceSpatialRef,
        target: targetSpatialRef,
        needsProjection: sourceSpatialRef.wkid !== targetSpatialRef.wkid
      });*/
    }

    try {
      // Load projection engine if needed
      if (!projection.isLoaded()) {
        projection.load();
      }

      // Handle polygon geometry (both ArcGIS and GeoJSON formats)
      if (mappedGeometry.type?.toLowerCase().includes('polygon')) {
        // Get rings from either format
        let rings: number[][][] = [];
        
        if (mappedGeometry.rings) {
          rings = mappedGeometry.rings;
        } else if (mappedGeometry.coordinates) {
          if (Array.isArray(mappedGeometry.coordinates[0]) && Array.isArray(mappedGeometry.coordinates[0][0])) {
            rings = mappedGeometry.coordinates;
          } else if (Array.isArray(mappedGeometry.coordinates[0])) {
            rings = [mappedGeometry.coordinates];
          }
        }

        if (!rings || !rings.length) {
          return new Graphic({
            attributes: combinedAttributes
          });
        }

        // Validate and clean rings
        const validRings = rings.map(ring => {
          if (!Array.isArray(ring) || ring.length < 3) return null;
          
          const validCoords = ring.filter(coord => 
            Array.isArray(coord) && 
            coord.length >= 2 && 
            typeof coord[0] === 'number' && 
            typeof coord[1] === 'number' &&
            !isNaN(coord[0]) && 
            !isNaN(coord[1])
          );

          return validCoords.length >= 3 ? validCoords : null;
        }).filter((ring): ring is number[][] => ring !== null);

        if (!validRings.length) {
          return new Graphic({
            attributes: combinedAttributes
          });
        }

        // Create polygon with source spatial reference
        const polygon = new Polygon({
          rings: validRings,
          spatialReference: sourceSpatialRef
        });

        // Project to Web Mercator if needed
        if (sourceSpatialRef.wkid !== targetSpatialRef.wkid) {
          try {
            mappedGeometry = projection.project(polygon, targetSpatialRef) as __esri.Polygon;
          } catch (projError) {
            console.error('Error projecting polygon:', projError);
            mappedGeometry = polygon;
          }
        } else {
          mappedGeometry = polygon;
        }
      }

      return new Graphic({
        geometry: mappedGeometry,
        attributes: combinedAttributes
      });
    } catch (error) {
      console.error(`Error mapping feature ${index}:`, error);
      return new Graphic({
        attributes: combinedAttributes
      });
    }
  }

  protected createFields(sampleFeature: Graphic): __esri.FieldProperties[] {
    const fields: __esri.FieldProperties[] = [];

    // Add OBJECTID field
    fields.push({
      name: 'OBJECTID',
      type: 'oid',
      alias: 'Object ID'
    });

    // Add fields from sample feature attributes
    Object.entries(sampleFeature.attributes).forEach(([name, value]) => {
      if (name === 'OBJECTID') return;

      // Try to find field in layer config
      const configField = this.data?.layerConfig?.fields?.find(f => f.name === name);
      
      if (configField) {
        fields.push({
          name: configField.name,
          type: configField.type,
          alias: configField.label || configField.alias || configField.name
        });
      } else {
        // Determine field type from value
        let type: "string" | "oid" | "small-integer" | "integer" | "single" | "double" | "long" | "date";
        if (typeof value === 'number') {
          type = Number.isInteger(value) ? 'integer' : 'double';
        } else if (typeof value === 'string') {
          type = 'string';
        } else if (value instanceof Date) {
          type = 'date';
        } else {
          type = 'string'; // Default to string for unknown types
        }

        fields.push({
          name,
          type,
          alias: name
        });
      }
    });

    /*console.log('Created fields:', fields.map(f => ({
      name: f.name,
      type: f.type,
      alias: f.alias
    })));*/

    return fields;
  }

  protected createPopupFields(fields: __esri.FieldProperties[]): {
    fieldName: string;
    label: string;
    format: {
      places: number;
      digitSeparator: boolean;
    };
  }[] {
    return fields.map(field => ({
      fieldName: field.name || 'unknown',
      label: FieldMappingHelper.getFriendlyFieldName(field.name || 'unknown') || field.alias || field.name || 'Unknown Field',
      format: {
        places: field.type === 'double' || field.type === 'single' ? 2 : 0,
        digitSeparator: true
      }
    }));
  }

  protected calculateExtent(
    features: __esri.Graphic[],
    options: { padding?: number; spatialReference?: __esri.SpatialReference } = {}
  ): __esri.Extent | null {
    const { padding = 1.2, spatialReference = webMercator } = options;

    //console.log("[calculateExtent] Starting extent calculation with", features.length, "features");
    //console.log("[calculateExtent] Target spatial reference:", spatialReference?.toJSON());

    if (!features || features.length === 0) {
      console.warn("[calculateExtent] No features provided for extent calculation");
      return null;
    }

    // Track extents for each feature
    const validExtents: __esri.Extent[] = [];
    let firstFeature = null;

    for (let i = 0; i < features.length; i++) {
      const feature = features[i];
      if (!feature || !feature.geometry) {
        continue;
      }

      if (!firstFeature) {
        firstFeature = feature;
        /*console.log(
          "[calculateExtent] First feature geometry type:",
          feature.geometry.type,
          "with spatial reference:",
          feature.geometry.spatialReference?.toJSON()
        );*/
      }

      try {
        // Get extent from feature geometry
        const featureExtent = feature.geometry.extent;
        if (!featureExtent) {
          console.warn(`[calculateExtent] Feature ${i} has no extent`);
          continue;
        }

        //console.log(`[calculateExtent] Feature ${i} raw extent:`, featureExtent.toJSON());

        // Ensure extent is in the target spatial reference
        let projectedExtent = featureExtent;
        if (
          featureExtent.spatialReference &&
          spatialReference &&
          featureExtent.spatialReference.wkid !== spatialReference.wkid
        ) {
          try {
            /*console.log(
              `[calculateExtent] Projecting extent from ${featureExtent.spatialReference.wkid} to ${spatialReference.wkid}`
            );*/
            projectedExtent = projection.project(featureExtent, spatialReference) as __esri.Extent;
            //console.log(`[calculateExtent] Projected extent:`, projectedExtent.toJSON());
          } catch (error) {
            console.error(`[calculateExtent] Error projecting extent for feature ${i}:`, error);
            // Skip this extent if projection fails
            continue;
          }
        }

        // Validate extent before adding
        if (this.isValidExtent(projectedExtent)) {
          validExtents.push(projectedExtent);
        } else {
          console.warn(
            `[calculateExtent] Feature ${i} has invalid extent:`,
            projectedExtent.toJSON()
          );
        }
      } catch (error) {
        console.error(`[calculateExtent] Error processing extent for feature ${i}:`, error);
      }
    }

    //  console.log("[calculateExtent] Collected", validExtents.length, "valid extents");

    if (validExtents.length === 0) {
      console.warn("[calculateExtent] No valid extents found among features");
      return null;
    }

    // Combine all valid extents
    let finalExtent = validExtents[0].clone();
    for (let i = 1; i < validExtents.length; i++) {
      finalExtent = finalExtent.union(validExtents[i]);
    }

   // console.log("[calculateExtent] Combined extent before padding:", finalExtent.toJSON());

    // Expand the extent by the padding factor
    finalExtent = finalExtent.expand(padding);
    
  //   console.log("[calculateExtent] Final extent after padding:", finalExtent.toJSON());

    // Final validation
    if (!this.isValidExtent(finalExtent)) {
      console.warn("[calculateExtent] Final extent is invalid:", finalExtent.toJSON());
      return null;
    }

    return finalExtent;
  }

  // Helper method to validate an extent
  protected isValidExtent(extent: __esri.Extent): boolean {
    // Check for NaN values
    if (
      isNaN(extent.xmin) ||
      isNaN(extent.ymin) ||
      isNaN(extent.xmax) ||
      isNaN(extent.ymax)
    ) {
      console.warn("[isValidExtent] Extent contains NaN values:", extent.toJSON());
      return false;
    }

    // Check for unreasonably large values (likely projection errors)
    const MAX_REASONABLE_COORDINATE = 50000000; // 50 million (larger than Earth's circumference in meters)
    if (
      Math.abs(extent.xmin) > MAX_REASONABLE_COORDINATE ||
      Math.abs(extent.ymin) > MAX_REASONABLE_COORDINATE ||
      Math.abs(extent.xmax) > MAX_REASONABLE_COORDINATE ||
      Math.abs(extent.ymax) > MAX_REASONABLE_COORDINATE
    ) {
      console.warn("[isValidExtent] Extent contains extreme coordinate values:", extent.toJSON());
      return false;
    }

    // Check for zero or negative width/height
    if (extent.width <= 0 || extent.height <= 0) {
      console.warn(
        "[isValidExtent] Extent has zero or negative dimensions - width:",
        extent.width,
        "height:",
        extent.height
      );
      return false;
    }

    return true;
  }

  protected validateData(data: T): void {
    if (!data.features?.length) {
      throw new Error('No features provided');
    }

    if (!data.layerName) {
      throw new Error('Layer name is required');
    }

    // Validate features have required properties
    data.features.forEach((feature, index) => {
      if (!feature.geometry) {
        throw new Error(`Feature at index ${index} is missing geometry`);
      }
      if (!feature.attributes) {
        throw new Error(`Feature at index ${index} is missing attributes`);
      }
    });
  }

  public getLayer(): FeatureLayer | null {
    return this.layer;
  }

  public getRenderer(): __esri.Renderer | null {
    return this.renderer;
  }

  public getExtent(): __esri.Extent | null {
    return this.extent;
  }

  public abstract getLegendInfo(): StandardizedLegendData;

  /**
   * Apply popup template to a layer
   * This centralized method ensures consistent popup application across all visualization types
   */
  protected applyPopupTemplate(
    layer: __esri.FeatureLayer, 
    popupConfig?: PopupConfiguration
  ): void {
    if (!layer) return;
    
    // Use the provided popup config or generate a default one
    const config = popupConfig || createDefaultPopupConfig(layer);
    const popupTemplate = createPopupTemplateFromConfig(config);
    layer.popupTemplate = popupTemplate;
  }

  /**
   * Apply standardized popup template with bar chart content
   * This method creates consistent popups across all visualization types
   */
  protected applyStandardizedPopup(
    layer: __esri.FeatureLayer,
    barChartFields: string[] = [],
    listFields: string[] = [],
    visualizationType?: string
  ): void {
    if (!layer) return;

    // Get all numeric fields for bar chart if none specified
    if (barChartFields.length === 0 && layer.fields) {
      barChartFields = layer.fields
        .filter(field => 
          ['double', 'single', 'integer', 'small-integer'].includes(field.type) &&
          !['OBJECTID', 'FID', 'Shape__Area', 'Shape__Length'].includes(field.name)
        )
        .map(field => field.name)
        .slice(0, 5); // Limit to 5 fields for readability
    }

    // Get all other fields for list if none specified
    if (listFields.length === 0 && layer.fields) {
      listFields = layer.fields
        .filter(field => 
          !['OBJECTID', 'FID', 'Shape__Area', 'Shape__Length'].includes(field.name) &&
          !barChartFields.includes(field.name)
        )
        .map(field => field.name)
        .slice(0, 8); // Limit to 8 additional fields
    }

    const config: StandardizedPopupConfig = {
      titleFields: ['DESCRIPTION', 'ID', 'FSA_ID', 'NAME', 'OBJECTID'],
      barChartFields,
      listFields,
      visualizationType
    };

    const popupTemplate = createStandardizedPopupTemplate(config);
    layer.popupTemplate = popupTemplate;
  }

  /**
   * Get fields relevant for popup display based on visualization type
   */
  protected getPopupFields(visualizationType?: string): { barChartFields: string[], listFields: string[] } {
    const commonBarFields = ['thematic_value', 'value', 'score', 'count', 'total'];
    const commonListFields = ['DESCRIPTION', 'ID', 'NAME', 'type', 'category'];

    // Customize fields based on visualization type
    switch (visualizationType) {
      case 'correlation':
        return {
          barChartFields: ['correlation_score', 'primary_value', 'secondary_value'],
          listFields: ['DESCRIPTION', 'ID', 'p_value', 'cluster_type']
        };
      
      case 'difference':
        return {
          barChartFields: ['difference_value', 'primary_value', 'secondary_value'],
          listFields: ['DESCRIPTION', 'ID']
        };
      
      case 'multivariate':
        return {
          barChartFields: [], // Will be determined dynamically by multivariate visualization
          listFields: ['DESCRIPTION', 'ID', 'profile_type']
        };
      
      case 'joint-high':
        return {
          barChartFields: ['joint_score', 'primary_value', 'secondary_value'],
          listFields: ['DESCRIPTION', 'ID']
        };
      
      case 'ranking':
        return {
          barChartFields: ['rank_value', 'percentile'],
          listFields: ['DESCRIPTION', 'ID', 'rank_position']
        };
      
      default:
        return {
          barChartFields: commonBarFields,
          listFields: commonListFields
        };
    }
  }

  // Add helper method to convert renderer to standardized legend data
  protected convertRendererToLegendData(
    title: string,
    type: LegendType,
    description?: string
  ): StandardizedLegendData {
    if (!this.renderer) {
      return {
        title,
        type,
        description,
        items: []
      };
    }

    const items: LegendItem[] = [];

    // Handle ClassBreaksRenderer
    if (this.renderer.type === 'class-breaks') {
      const classRenderer = this.renderer as __esri.ClassBreaksRenderer;
      classRenderer.classBreakInfos
        .filter(breakInfo => 
          breakInfo.minValue !== 88888888 && 
          breakInfo.maxValue !== 88888888 && 
          breakInfo.label !== "No Data"
        )
        .forEach(breakInfo => {
          const symbol = breakInfo.symbol as __esri.SimpleMarkerSymbol | __esri.SimpleFillSymbol;
          if (!symbol?.color) return;

          const outlineColor = 'outline' in symbol && symbol.outline?.color 
            ? colorToRgba(symbol.outline.color) 
            : undefined;

          items.push({
            label: breakInfo.label || `${breakInfo.minValue} - ${breakInfo.maxValue}`,
            color: colorToRgba(symbol.color),
            outlineColor,
            shape: getSymbolShape(symbol),
            size: getSymbolSize(symbol)
          });
        });
    }
    // Handle UniqueValueRenderer
    else if (this.renderer.type === 'unique-value') {
      const uniqueRenderer = this.renderer as __esri.UniqueValueRenderer;
      (uniqueRenderer.uniqueValueInfos ?? []).forEach(info => {
        const symbol = info.symbol as __esri.SimpleMarkerSymbol | __esri.SimpleFillSymbol;
        if (!symbol?.color) return;

        const outlineColor = 'outline' in symbol && symbol.outline?.color 
          ? colorToRgba(symbol.outline.color) 
          : undefined;

        items.push({
          label: info.label || String(info.value),
          color: colorToRgba(symbol.color),
          outlineColor,
          shape: getSymbolShape(symbol),
          size: getSymbolSize(symbol)
        });
      });
    }
    // Handle SimpleRenderer
    else if (this.renderer.type === 'simple') {
      const simpleRenderer = this.renderer as __esri.SimpleRenderer;
      const symbol = simpleRenderer.symbol as __esri.SimpleMarkerSymbol | __esri.SimpleFillSymbol;
      if (symbol?.color) {
        const outlineColor = 'outline' in symbol && symbol.outline?.color 
          ? colorToRgba(symbol.outline.color) 
          : undefined;

        items.push({
          label: title,
          color: colorToRgba(symbol.color),
          outlineColor,
          shape: getSymbolShape(symbol),
          size: getSymbolSize(symbol)
        });
      }
    }

    return {
      title,
      type,
      description,
      items
    };
  }

  /**
   * Register a callback for legend updates
   * @param callback Function to call when legend data changes
   */
  public onLegendUpdate(callback: LegendUpdateCallback): void {
    this.legendUpdateCallbacks.add(callback);
  }

  /**
   * Remove a legend update callback
   * @param callback The callback to remove
   */
  public offLegendUpdate(callback: LegendUpdateCallback): void {
    this.legendUpdateCallbacks.delete(callback);
  }

  /**
   * Notify all registered callbacks of a legend update
   * @param event The event that triggered the update
   */
  protected notifyLegendUpdate(event: LegendUpdateEvent): void {
    const legendData = this.getLegendInfo();
    this.legendUpdateCallbacks.forEach(callback => callback(legendData));
  }

  /**
   * Update the visualization's data and trigger legend update
   * @param data New data for the visualization
   * @param options Optional visualization options
   */
  public async updateData(data: T, options?: VisualizationOptions): Promise<void> {
    await this.create(data, options);
    this.notifyLegendUpdate({
      type: 'data',
      details: { data }
    });
  }

  /**
   * Update the visualization's renderer and trigger legend update
   * @param renderer New renderer for the visualization
   */
  public updateRenderer(renderer: __esri.Renderer): void {
    if (!this.layer) {
      throw new Error('Layer not initialized');
    }

    this.renderer = renderer;
    this.layer.renderer = renderer;
    this.notifyLegendUpdate({
      type: 'renderer',
      details: { renderer }
    });
  }

  /**
   * Update the visualization's visibility and trigger legend update
   * @param visible New visibility state
   */
  public setVisible(visible: boolean): void {
    if (!this.layer) {
      throw new Error('Layer not initialized');
    }

    this.layer.visible = visible;
    this.notifyLegendUpdate({
      type: 'visibility',
      details: { visible }
    });
  }

  /**
   * Apply a filter to the visualization
   * @param filterOptions The filter definition and highlighting options
   */
  public async applyFilter(filterOptions: FilterOptions): Promise<void> {
    if (!this.layer) {
      throw new Error('Layer not initialized');
    }

    this.activeFilter = filterOptions;
    const whereClause = this.buildWhereClause(filterOptions.filterDefinition);
    
    // Apply the filter
    this.layer.definitionExpression = whereClause;

    // If highlight color is specified, create a highlight effect
    if (filterOptions.highlightColor) {
      const highlightSymbol = new SimpleFillSymbol({
        color: filterOptions.highlightColor,
        outline: filterOptions.highlightOutline ? {
          color: filterOptions.highlightOutline.color,
          width: filterOptions.highlightOutline.width
        } : {
          color: [0, 0, 0, 0], // No border
          width: 0
        }
      });

      // Create a new renderer that combines the original renderer with the highlight
      const originalRenderer = this.layer.renderer;
      if (originalRenderer) {
        const highlightRenderer = new SimpleRenderer({
          symbol: highlightSymbol
        });

        // Apply the highlight renderer
        this.layer.renderer = highlightRenderer;
      }
    }

    this.notifyLegendUpdate({
      type: 'filter',
      details: { filter: filterOptions }
    });
  }

  /**
   * Clear the current filter
   */
  public clearFilter(): void {
    if (this.layer && this.activeFilter) {
      this.layer.definitionExpression = null;
      if (this.renderer) {
        this.layer.renderer = this.renderer;
      }
    }

    this.notifyLegendUpdate({
      type: 'filter',
      details: { filter: undefined }
    });
  }

  /**
   * Build a WHERE clause from a filter definition
   */
  private buildWhereClause(filter: FilterDefinition | FilterGroup): string {
    if ('operator' in filter && ('AND' === filter.operator || 'OR' === filter.operator)) {
      // Handle filter group
      const subClauses = filter.filters.map(f => this.buildWhereClause(f));
      return `(${subClauses.join(` ${filter.operator} `)})`;
    } else {
      // Handle single filter
      const { field, operator, value } = filter as FilterDefinition;
      const escapedField = `"${field}"`;
      
      switch (operator) {
        case '=':
          return typeof value === 'string' ? `${escapedField} = '${value}'` : `${escapedField} = ${value}`;
        case '!=':
          return typeof value === 'string' ? `${escapedField} != '${value}'` : `${escapedField} != ${value}`;
        case '>':
          return `${escapedField} > ${value}`;
        case '<':
          return `${escapedField} < ${value}`;
        case '>=':
          return `${escapedField} >= ${value}`;
        case '<=':
          return `${escapedField} <= ${value}`;
        case 'contains':
          return `${escapedField} LIKE '%${value}%'`;
        case 'starts-with':
          return `${escapedField} LIKE '${value}%'`;
        case 'ends-with':
          return `${escapedField} LIKE '%${value}'`;
        default:
          throw new Error(`Unsupported operator: ${operator}`);
      }
    }
  }

  /**
   * Zooms to a specific feature in the visualization
   * @param options Options for zooming to the feature
   * @returns Promise that resolves when the zoom is complete
   */
  public async zoomToFeature(options: ZoomToFeatureOptions): Promise<void> {
    if (!this.layer) {
      throw new Error('Layer not initialized');
    }

    if (!this.mapView) {
      throw new Error('Map view not initialized');
    }

    let feature: __esri.Graphic | null = null;

    // Find the feature by ID or index
    if (options.featureId !== undefined) {
      const query = this.layer.createQuery();
      query.where = `OBJECTID = ${options.featureId}`;
      const result = await this.layer.queryFeatures(query);
      feature = result.features[0] || null;
    } else if (options.featureIndex !== undefined && this.data?.features) {
      feature = this.data.features[options.featureIndex];
    }

    if (!feature || !feature.geometry) {
      throw new Error('Feature not found or has no geometry');
    }

    // Calculate the extent for the feature
    const extent = this.calculateExtent([feature], {
      padding: options.padding || 50,
      spatialReference: this.data?.spatialReference
    });

    if (!extent || !this.isValidExtent(extent)) {
      throw new Error('Could not calculate valid extent for feature');
    }

    // Animate to the feature extent
    await this.mapView.goTo(extent, {
      duration: options.duration || 1000,
      easing: options.easing || 'ease-out'
    });
  }

  /**
   * Configure tooltips for the visualization
   * @param options Tooltip configuration options
   */
  public configureTooltips(options: TooltipOptions): void {
    if (!this.layer) {
      throw new Error('Layer not initialized');
    }

    this.tooltipOptions = options;

    // Create popup template for tooltips
    const popupTemplate = {
      title: options.title || '{layerName}',
      content: this.createTooltipContent.bind(this),
      outFields: options.fields.map(f => f.field)
    };

    // Apply popup template to layer
    this.layer.popupTemplate = popupTemplate;

    // Enable popup on hover
    this.layer.popupEnabled = true;
  }

  /**
   * Create tooltip content for a feature
   * @param feature The feature to create tooltip content for
   * @returns HTML string for tooltip content
   */
  private createTooltipContent(feature: __esri.Graphic): string {
    if (!this.tooltipOptions) {
      return '';
    }

    // Use custom content if provided
    if (this.tooltipOptions.customContent) {
      return this.tooltipOptions.customContent(feature);
    }

    const content: string[] = [];

    // Add field values
    this.tooltipOptions.fields.forEach(field => {
      const value = feature.attributes[field.field];
      if (value !== undefined && value !== null) {
        let formattedValue = value;

        // Format the value based on field configuration
        if (field.format) {
          switch (field.format.type) {
            case 'number':
              formattedValue = this.formatNumber(value, field.format);
              break;
            case 'date':
              formattedValue = this.formatDate(value, field.format);
              break;
            // String formatting is handled by adding prefix/suffix
          }

          if (field.format.prefix) {
            formattedValue = field.format.prefix + formattedValue;
          }
          if (field.format.suffix) {
            formattedValue = formattedValue + field.format.suffix;
          }
        }

        content.push(`<strong>${field.label || field.field}:</strong> ${formattedValue}`);
      }
    });

    // Add geometry information if requested
    if (this.tooltipOptions.showGeometryInfo && feature.geometry) {
      const geometryInfo = this.getGeometryInfo(feature.geometry);
      if (geometryInfo) {
        content.push(`<strong>Geometry:</strong> ${geometryInfo}`);
      }
    }

    return content.join('<br>');
  }

  /**
   * Format a number value according to the specified format
   */
  private formatNumber(value: number, format: TooltipField['format']): string {
    if (!format || format.type !== 'number') {
      return value.toString();
    }

    const places = format.places ?? 2;
    return value.toLocaleString(undefined, {
      minimumFractionDigits: places,
      maximumFractionDigits: places
    });
  }

  /**
   * Format a date value according to the specified format
   */
  private formatDate(value: any, format: TooltipField['format']): string {
    if (!format || format.type !== 'date') {
      return value.toString();
    }

    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }

    const dateFormat = format.dateFormat || 'MMM d, yyyy';
    // Simple date formatting - could be enhanced with a proper date formatting library
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Get geometry information for display in tooltip
   */
  private getGeometryInfo(geometry: __esri.Geometry): string | null {
    if (!geometry) return null;

    switch (geometry.type) {
      case 'point': {
        const point = geometry as __esri.Point;
        if (point.longitude === null || point.longitude === undefined ||
            point.latitude === null || point.latitude === undefined) {
          return 'Point (coordinates unavailable)';
        }
        return `Point (${point.longitude.toFixed(4)}, ${point.latitude.toFixed(4)})`;
      }
      case 'polyline': {
        const polyline = geometry as __esri.Polyline;
        const length = this.calculateLength(polyline);
        return `Line (${length.toFixed(2)} units)`;
      }
      case 'polygon': {
        const polygon = geometry as __esri.Polygon;
        const area = this.calculateArea(polygon);
        return `Polygon (${area.toFixed(2)} square units)`;
      }
      default:
        return geometry.type;
    }
  }

  /**
   * Calculate the length of a polyline
   */
  private calculateLength(polyline: __esri.Polyline): number {
    // Simple length calculation - could be enhanced with proper geodesic calculations
    let length = 0;
    polyline.paths.forEach(path => {
      for (let i = 1; i < path.length; i++) {
        const dx = path[i][0] - path[i-1][0];
        const dy = path[i][1] - path[i-1][1];
        length += Math.sqrt(dx * dx + dy * dy);
      }
    });
    return length;
  }

  /**
   * Calculate the area of a polygon
   */
  private calculateArea(polygon: __esri.Polygon): number {
    // Simple area calculation - could be enhanced with proper geodesic calculations
    let area = 0;
    polygon.rings.forEach(ring => {
      for (let i = 0; i < ring.length; i++) {
        const j = (i + 1) % ring.length;
        area += ring[i][0] * ring[j][1];
        area -= ring[j][0] * ring[i][1];
      }
    });
    return Math.abs(area / 2);
  }

  /**
   * Set the opacity of the visualization layer
   * @param opacity Opacity value between 0 and 1
   * @param options Optional transition options
   */
  public setOpacity(opacity: number, options?: TransitionOptions): void {
    if (!this.layer) {
      throw new Error('Layer not initialized');
    }

    // Clamp opacity between 0 and 1
    const clampedOpacity = Math.max(0, Math.min(1, opacity));
    this.currentOpacity = clampedOpacity;

    if (options?.duration && options.duration > 0) {
      this.transitionManager.startTransition(
        'opacity',
        this.layer.opacity,
        clampedOpacity,
        {
          ...options,
          onComplete: () => {
            this.layer!.opacity = clampedOpacity;
            this.notifyLegendUpdate({
              type: 'renderer',
              details: { renderer: this.renderer || undefined }
            });
          }
        }
      );
    } else {
      this.layer.opacity = clampedOpacity;
      this.notifyLegendUpdate({
        type: 'renderer',
        details: { renderer: this.renderer || undefined }
      });
    }
  }

  /**
   * Get the current opacity of the visualization layer
   */
  public getOpacity(): number {
    return this.currentOpacity;
  }

  /**
   * Fade in the visualization layer
   * @param duration Duration of the fade in milliseconds
   */
  public fadeIn(duration: number = 500): void {
    this.setOpacity(1, { duration, easing: 'ease-out' });
  }

  /**
   * Fade out the visualization layer
   * @param duration Duration of the fade in milliseconds
   */
  public fadeOut(duration: number = 500): void {
    this.setOpacity(0, { duration, easing: 'ease-in' });
  }

  /**
   * Set the blend mode for the visualization layer
   * @param options Blend mode configuration
   */
  public setBlendMode(options: BlendModeOptions): void {
    if (!this.layer) {
      throw new Error('Layer not initialized');
    }

    this.currentBlendMode = options.mode;

    // Apply blend mode to the layer
    this.layer.blendMode = options.mode;

    // If opacity is specified, update it with transition
    if (options.opacity !== undefined) {
      this.setOpacity(options.opacity, options.transition);
    }

    // Notify legend update
    this.notifyLegendUpdate({
      type: 'renderer',
      details: { renderer: this.renderer || undefined }
    });
  }

  /**
   * Get the current blend mode of the visualization layer
   */
  public getBlendMode(): BlendMode {
    return this.currentBlendMode;
  }

  /**
   * Apply a blend mode effect to the layer's renderer
   * @param renderer The renderer to apply the blend mode to
   * @param blendMode The blend mode to apply
   */
  protected applyBlendModeToRenderer(renderer: __esri.Renderer, blendMode: BlendMode): void {
    if (!renderer) return;

    // Apply blend mode to all symbols in the renderer
    if ('symbol' in renderer) {
      // SimpleRenderer
      const simpleRenderer = renderer as __esri.SimpleRenderer;
      if (simpleRenderer.symbol) {
        this.applyBlendModeToSymbol(simpleRenderer.symbol, blendMode);
      }
    } else if ('classBreakInfos' in renderer) {
      // ClassBreaksRenderer
      const classBreaksRenderer = renderer as __esri.ClassBreaksRenderer;
      classBreaksRenderer.classBreakInfos?.forEach(breakInfo => {
        if (breakInfo.symbol) {
          this.applyBlendModeToSymbol(breakInfo.symbol, blendMode);
        }
      });
    } else if ('uniqueValueInfos' in renderer) {
      // UniqueValueRenderer
      const uniqueValueRenderer = renderer as __esri.UniqueValueRenderer;
      uniqueValueRenderer.uniqueValueInfos?.forEach(valueInfo => {
        if (valueInfo.symbol) {
          this.applyBlendModeToSymbol(valueInfo.symbol, blendMode);
        }
      });
    }
  }

  /**
   * Apply blend mode to a symbol
   * @param symbol The symbol to apply the blend mode to
   * @param blendMode The blend mode to apply
   */
  private applyBlendModeToSymbol(symbol: __esri.Symbol, blendMode: BlendMode): void {
    if (!symbol) return;

    // Apply blend mode to the symbol's color
    if ('color' in symbol) {
      const colorSymbol = symbol as __esri.Symbol & { color: string | number[] };
      if (colorSymbol.color) {
        // Convert color to RGBA array if it's not already
        const color = Array.isArray(colorSymbol.color) 
          ? colorSymbol.color 
          : this.parseColor(colorSymbol.color);
        
        // Apply blend mode to color
        colorSymbol.color = this.applyBlendModeToColor(color, blendMode);
      }
    }

    // Apply to outline if present
    if ('outline' in symbol) {
      const outlineSymbol = symbol as __esri.Symbol & { outline: __esri.Symbol };
      if (outlineSymbol.outline) {
        this.applyBlendModeToSymbol(outlineSymbol.outline, blendMode);
      }
    }
  }

  /**
   * Parse a color string to RGBA array
   * @param color Color string (hex, rgb, rgba)
   * @returns RGBA array [r, g, b, a]
   */
  private parseColor(color: string | number[]): number[] {
    if (Array.isArray(color)) return color;

    // Handle hex colors
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = hex.length > 6 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      return [r, g, b, a];
    }

    // Handle rgb/rgba colors
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (match) {
      const r = parseInt(match[1]);
      const g = parseInt(match[2]);
      const b = parseInt(match[3]);
      const a = match[4] ? parseFloat(match[4]) : 1;
      return [r, g, b, a];
    }

    // Default to white if parsing fails
    return [0, 0, 0, 0]; // Transparent instead of white
  }

  /**
   * Apply blend mode to a color
   * @param color RGBA array [r, g, b, a]
   * @param blendMode The blend mode to apply
   * @returns Modified RGBA array
   */
  private applyBlendModeToColor(color: number[], blendMode: BlendMode): number[] {
    const [r, g, b, a] = color;
    const normalized = [r / 255, g / 255, b / 255, a];

    let result: number[];
    switch (blendMode) {
      case 'multiply':
        result = normalized.map(c => c * c);
        break;
      case 'screen':
        result = normalized.map(c => 1 - (1 - c) * (1 - c));
        break;
      case 'overlay':
        result = normalized.map(c => c < 0.5 ? 2 * c * c : 1 - 2 * (1 - c) * (1 - c));
        break;
      case 'darken':
        result = normalized.map(c => Math.min(c, c * c));
        break;
      case 'lighten':
        result = normalized.map(c => Math.max(c, c * c));
        break;
      case 'color-dodge':
        result = normalized.map(c => c === 0 ? 0 : Math.min(1, c / (1 - c)));
        break;
      case 'color-burn':
        result = normalized.map(c => c === 1 ? 1 : Math.max(0, 1 - (1 - c) / c));
        break;
      case 'hard-light':
        result = normalized.map(c => c < 0.5 ? 2 * c * c : 1 - 2 * (1 - c) * (1 - c));
        break;
      case 'soft-light':
        result = normalized.map(c => c < 0.5 ? 2 * c * c + c * c * (1 - 2 * c) : Math.sqrt(c) * (2 * c - 1) + 2 * c * (1 - c));
        break;
      case 'difference':
        result = normalized.map(c => Math.abs(c - c));
        break;
      case 'exclusion':
        result = normalized.map(c => c + c - 2 * c * c);
        break;
      default:
        return color;
    }

    // Convert back to 0-255 range
    return [
      Math.round(result[0] * 255),
      Math.round(result[1] * 255),
      Math.round(result[2] * 255),
      result[3]
    ];
  }

  public dispose(): void {
    this.transitionManager.cancelAllTransitions();
    // ... existing disposal code ...
  }
}