import { DEFAULT_FILL_ALPHA } from "./constants";
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import ClassBreaksRenderer from '@arcgis/core/renderers/ClassBreaksRenderer';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import { VisualizationOptions, BaseVisualization, BaseVisualizationData, VisualizationResult } from './base-visualization';
import PopupTemplate from "@arcgis/core/PopupTemplate";
import FieldsContent from "@arcgis/core/popup/content/FieldsContent";
import Graphic from '@arcgis/core/Graphic';
import { Geometry, Extent, SpatialReference, Point, Polygon, Multipoint, Polyline } from '@arcgis/core/geometry';
import { LayerField } from '../../types/geospatial-ai-types';
import { createDefaultPopupConfig, createPopupTemplateFromConfig } from '@/utils/popup-utils';
import { PopupConfiguration } from '@/types/popup-config';
import { StandardizedLegendData, colorToRgba, getSymbolShape, getSymbolSize } from '@/types/legend';
import { LegendItem } from '@/components/MapLegend';
import { optimizeAnalysisFeatures } from '../feature-optimization';
import { FieldMappingHelper } from './field-mapping-helper';
import { FIELD_ALIASES } from '../field-aliases';
import { getQuintileColorScheme } from '@/lib/analysis/utils/QuintileUtils';

// Define FieldType to match ArcGIS expected types
type FieldType = "string" | "oid" | "small-integer" | "integer" | "single" | "double" | "long" | "date" | "big-integer" | "date-only" | "time-only" | "timestamp-offset" | "geometry" | "blob" | "raster" | "guid" | "global-id" | "xml";

// Define a union type for all possible geometry types
type GeometryType = Extent | Point | Polygon | Multipoint | Polyline;

export interface DifferenceVisualizationData extends BaseVisualizationData {
  features: Array<{
    attributes: {
      OBJECTID: number;
      primary_value: number;
      secondary_value: number;
      difference_value: number;
      [key: string]: any;
    };
    geometry?: GeometryType;
  }>;
  layerName: string;
  rendererField: string;
  primaryField: string;
  secondaryField: string;
  primaryLabel: string;
  secondaryLabel: string;
  differenceField: string;
  unitType: 'percentage' | 'currency' | 'count' | 'index';
  layerConfig: {
    name: string;
    fields: Array<{
      name: string;
      type: FieldType;
    }>;
  };
}

interface FeatureWithProperties extends Graphic {
  properties?: { [key: string]: any };
  geometry: GeometryType;
  attributes: { [key: string]: any };
}

interface DifferenceVisualizationOptions extends VisualizationOptions {
  primaryLabel?: string;
  secondaryLabel?: string;
  unitType?: 'percentage' | 'currency' | 'count' | 'index';
  rendererField?: string;
}

export interface DifferenceOptions {
  colorScheme?: string;
  classificationMethod?: string;
  classificationBreaks?: number[];
  popupConfig?: PopupConfiguration;
}

export class DifferenceVisualization extends BaseVisualization<DifferenceVisualizationData> {
  protected renderer: ClassBreaksRenderer;
  protected options: DifferenceVisualizationOptions;
  protected data: DifferenceVisualizationData | null;

  constructor() {
    super();
    this.data = null;
    this.options = {};
    this.renderer = this.createDefaultRenderer();
  }

  /**
   * Creates the default diverging renderer for difference visualization using the same colors as strategic analysis
   */
  private createDefaultRenderer(): ClassBreaksRenderer {
    // Use Firefly colors for strategic analysis
    const colors = [
      '#ff0040', // Firefly Deep Pink (lowest strategic value)
      '#ffbf00', // Firefly Orange  
      '#ffff80', // Firefly Light Yellow
      '#00ff40', // Firefly Lime Green
      '#00ff80'  // Firefly Bright Green (highest strategic value)
    ];

    return new ClassBreaksRenderer({
      field: "difference_value",
      classBreakInfos: [
        {
          minValue: -Infinity,
          maxValue: -20,
          symbol: new SimpleFillSymbol({
            color: colors[0], // Uses color directly like VisualizationRenderer
            outline: { color: 'transparent', width: 0 }
          }),
          label: "Secondary >20 higher"
        },
        {
          minValue: -20,
          maxValue: -5,
          symbol: new SimpleFillSymbol({
            color: colors[1], // Uses color directly like VisualizationRenderer
            outline: { color: 'transparent', width: 0 }
          }),
          label: "Secondary 5-20 higher"
        },
        {
          minValue: -5,
          maxValue: 5,
          symbol: new SimpleFillSymbol({
            color: colors[2], // Uses color directly like VisualizationRenderer
            outline: { color: 'transparent', width: 0 }
          }),
          label: "Similar (±5)"
        },
        {
          minValue: 5,
          maxValue: 20,
          symbol: new SimpleFillSymbol({
            color: colors[3], // Uses color directly like VisualizationRenderer
            outline: { color: 'transparent', width: 0 }
          }),
          label: "Primary 5-20 higher"
        },
        {
          minValue: 20,
          maxValue: Infinity,
          symbol: new SimpleFillSymbol({
            color: colors[4], // Uses color directly like VisualizationRenderer
            outline: { color: 'transparent', width: 0 }
          }),
          label: "Primary >20 higher"
        }
      ]
    });
  }

  /**
   * Creates a custom renderer with proper labels based on the data
   */
  private createDifferenceRenderer(
    primaryLabel: string, 
    secondaryLabel: string, 
    unitType: string,
    differenceStats: { min: number; max: number; mean: number }
  ): ClassBreaksRenderer {
    const unit = unitType === 'percentage' ? '%' : '';
    
    // Calculate appropriate break points based on data distribution
    const { min, max } = differenceStats;
    const range = max - min;
    
    // Use adaptive break points based on data range
    let breakPoint1, breakPoint2;
    if (range <= 10) {
      breakPoint1 = 2;
      breakPoint2 = 5;
    } else if (range <= 50) {
      breakPoint1 = 5;
      breakPoint2 = 15;
    } else {
      breakPoint1 = 10;
      breakPoint2 = 25;
    }

    // Use Firefly colors for strategic analysis
    const colors = [
      '#ff0040', // Firefly Deep Pink (lowest strategic value)
      '#ffbf00', // Firefly Orange  
      '#ffff80', // Firefly Light Yellow
      '#00ff40', // Firefly Lime Green
      '#00ff80'  // Firefly Bright Green (highest strategic value)
    ];

    return new ClassBreaksRenderer({
      field: "difference_value",
      classBreakInfos: [
        {
          minValue: -Infinity,
          maxValue: -breakPoint2,
          symbol: new SimpleFillSymbol({
            color: colors[0], // Uses color directly like VisualizationRenderer
            outline: { color: 'transparent', width: 0 }
          }),
          label: `${secondaryLabel} >${breakPoint2}${unit} higher`
        },
        {
          minValue: -breakPoint2,
          maxValue: -breakPoint1,
          symbol: new SimpleFillSymbol({
            color: colors[1], // Uses color directly like VisualizationRenderer
            outline: { color: 'transparent', width: 0 }
          }),
          label: `${secondaryLabel} ${breakPoint1}-${breakPoint2}${unit} higher`
        },
        {
          minValue: -breakPoint1,
          maxValue: breakPoint1,
          symbol: new SimpleFillSymbol({
            color: colors[2], // Uses color directly like VisualizationRenderer
            outline: { color: 'transparent', width: 0 }
          }),
          label: `Similar (±${breakPoint1}${unit})`
        },
        {
          minValue: breakPoint1,
          maxValue: breakPoint2,
          symbol: new SimpleFillSymbol({
            color: colors[3], // Uses color directly like VisualizationRenderer
            outline: { color: 'transparent', width: 0 }
          }),
          label: `${primaryLabel} ${breakPoint1}-${breakPoint2}${unit} higher`
        },
        {
          minValue: breakPoint2,
          maxValue: Infinity,
          symbol: new SimpleFillSymbol({
            color: colors[4], // Uses color directly like VisualizationRenderer
            outline: { color: 'transparent', width: 0 }
          }),
          label: `${primaryLabel} >${breakPoint2}${unit} higher`
        }
      ]
    });
  }

  /**
   * Creates field definitions for difference visualization
   */
  private createDifferenceFields(): __esri.FieldProperties[] {
    return [
      {
        name: 'OBJECTID',
        type: 'oid',
        alias: 'Object ID'
      },
      {
        name: 'primary_value',
        type: 'double',
        alias: 'Primary Value'
      },
      {
        name: 'secondary_value',
        type: 'double',
        alias: 'Secondary Value'
      },
      {
        name: 'difference_value',
        type: 'double',
        alias: 'Difference Value'
      }
    ];
  }

  /**
   * Validates the difference data structure
   */
  protected validateData(data: DifferenceVisualizationData): void {
    if (!data.features || !Array.isArray(data.features)) {
      throw new Error('Features array is required for difference analysis');
    }

    if (data.features.length === 0) {
      throw new Error('At least one feature is required for difference analysis');
    }

    if (!data.primaryField || !data.secondaryField) {
      throw new Error('Both primary and secondary fields are required for difference analysis');
    }

    // Validate that features have the required fields
    const sampleFeature = data.features[0];
    const attributes = { ...(sampleFeature.attributes || {}) };
    
    if (attributes[data.primaryField] == null && attributes[data.secondaryField] == null) {
      throw new Error(`Neither primary field '${data.primaryField}' nor secondary field '${data.secondaryField}' found in feature data`);
    }

    console.log('[DifferenceViz] Data validation passed:', {
      featureCount: data.features.length,
      primaryField: data.primaryField,
      secondaryField: data.secondaryField,
      sampleAttributes: Object.keys(attributes)
    });
  }

  /**
   * Calculates the difference between primary and secondary values for each feature
   */
  private calculateDifferences(
    features: Graphic[], 
    primaryField: string, 
    secondaryField: string
  ): { differences: number[]; stats: { min: number; max: number; mean: number } } {
    const differences: number[] = [];
    
    for (const feature of features) {
      const attributes = { ...(feature.attributes || {}) };
      
      const primaryValue = this.parseNumericValue(attributes[primaryField]) || 0;
      const secondaryValue = this.parseNumericValue(attributes[secondaryField]) || 0;
      
      // Difference = Primary - Secondary
      // Positive = Primary > Secondary
      // Negative = Primary < Secondary
      const difference = primaryValue - secondaryValue;
      differences.push(difference);
      
      // Store the difference in the feature attributes
      feature.attributes = {
        ...feature.attributes,
        difference_value: difference,
        primary_value: primaryValue,
        secondary_value: secondaryValue
      };
    }

    // Calculate statistics
    const validDifferences = differences.filter(d => isFinite(d));
    const stats = {
      min: Math.min(...validDifferences),
      max: Math.max(...validDifferences),
      mean: validDifferences.reduce((sum, d) => sum + d, 0) / validDifferences.length
    };

    console.log('[DifferenceViz] Calculated differences:', {
      total: differences.length,
      valid: validDifferences.length,
      stats
    });

    return { differences, stats };
  }

  /**
   * Parses a numeric value from various formats
   */
  private parseNumericValue(value: any): number | null {
    if (value == null || value === '') return null;
    
    if (typeof value === 'number') {
      return isFinite(value) ? value : null;
    }
    
    if (typeof value === 'string') {
      // Remove common non-numeric characters
      const cleaned = value.replace(/[$,%]/g, '');
      const parsed = parseFloat(cleaned);
      return isFinite(parsed) ? parsed : null;
    }
    
    return null;
  }

  /**
   * Processes features for difference analysis
   */
  protected async processFeatures(features: any[]): Promise<Graphic[]> {
    console.log('[DifferenceViz] Processing features for difference analysis:', features.length);
    
    const processedFeatures: Graphic[] = [];
    
    for (let i = 0; i < features.length; i++) {
      const feature = features[i];
      
      try {
        let graphic: Graphic;
        
        if (feature instanceof Graphic) {
          graphic = feature.clone();
        } else {
          // Create graphic from GeoJSON-like feature
          graphic = new Graphic({
            geometry: feature.geometry,
            attributes: { 
              OBJECTID: feature.id || i + 1,
              ...feature.attributes,
              ...feature.properties
            }
          });
        }
        
        // Validate geometry exists and is valid
        if (!graphic.geometry) {
          console.warn(`[DifferenceViz] Feature ${i} has no geometry, skipping`);
          continue;
        }
        
        // Validate geometry type
        if (!graphic.geometry.type) {
          console.warn(`[DifferenceViz] Feature ${i} has invalid geometry type, skipping`);
          continue;
        }
        
        // Ensure attributes exist
        if (!graphic.attributes) {
          graphic.attributes = { OBJECTID: i + 1 };
        }
        
        processedFeatures.push(graphic);
      } catch (error) {
        console.warn(`[DifferenceViz] Failed to process feature ${i}:`, error);
        continue;
      }
    }
    
    console.log('[DifferenceViz] Successfully processed features:', {
      total: processedFeatures.length,
      withGeometry: processedFeatures.filter(f => f.geometry).length,
      geometryTypes: [...new Set(processedFeatures.map(f => f.geometry?.type).filter(Boolean))]
    });
    
    return processedFeatures;
  }

  /**
   * Creates the main visualization
   */
  async create(data: DifferenceVisualizationData, options: DifferenceVisualizationOptions = {}): Promise<VisualizationResult> {
    console.log('[DifferenceViz] Creating difference visualization:', {
      featureCount: data.features?.length,
      primaryField: data.primaryField,
      secondaryField: data.secondaryField,
      primaryLabel: data.primaryLabel,
      secondaryLabel: data.secondaryLabel
    });

    this.validateData(data);
    this.data = data;
    this.options = { ...options };

    try {
      // Process features
      const processedFeatures = await this.processFeatures(data.features);
      
      if (processedFeatures.length === 0) {
        throw new Error('No valid features found for difference analysis');
      }

      // Debug geometry information
      const geometryStats = {
        total: processedFeatures.length,
        withGeometry: processedFeatures.filter(f => f.geometry).length,
        geometryTypes: [...new Set(processedFeatures.filter(f => f.geometry).map(f => f.geometry?.type))]
      };
      
      console.log('[DifferenceViz] Geometry statistics:', geometryStats);
      
      if (geometryStats.withGeometry === 0) {
        throw new Error('No features with valid geometry found for difference analysis');
      }

      // Calculate differences
      const { differences, stats } = this.calculateDifferences(
        processedFeatures, 
        data.primaryField, 
        data.secondaryField
      );

      // Create custom renderer with proper labels
      this.renderer = this.createDifferenceRenderer(
        data.primaryLabel || 'Primary',
        data.secondaryLabel || 'Secondary',
        data.unitType || 'percentage',
        stats
      );

      // Create layer fields for difference visualization
      const layerFields = this.createDifferenceFields();

      // Initialize the layer WITHOUT renderer first, using processed features
      const layerData = {
        ...data,
        features: processedFeatures as any // Use the processed features with difference calculations
      };
      
      await this.initializeLayer(layerData as any, options, layerFields);

      if (!this.layer) {
        throw new Error('Failed to initialize layer for difference visualization');
      }

      // CRITICAL: Apply the renderer AFTER layer initialization
      // This ensures the custom difference renderer is used instead of default
      this.layer.renderer = this.renderer;
      console.log('[DifferenceViz] Applied difference renderer:', {
        rendererType: this.renderer.type,
        rendererField: this.renderer.field,
        classBreakCount: this.renderer.classBreakInfos?.length
      });

      // CRITICAL FIX: Ensure layer is visible and properly configured
      this.layer.visible = true;
      this.layer.opacity = options.opacity ?? 0.8;
      
      // Clear any potential definition expression that might hide features
      if (this.layer.definitionExpression) {
        console.log('[DifferenceViz] Clearing definition expression:', this.layer.definitionExpression);
        this.layer.definitionExpression = '';
      }
      
      // Store reference to visualization for debugging
      this.layer.set('visualization', this);
      
      // Force the layer to refresh and ensure it's added to the map
      this.layer.refresh();
      
      // Additional debugging for rendering issues
      console.log('[DifferenceViz] Layer configured:', {
        visible: this.layer.visible,
        opacity: this.layer.opacity,
        sourceCount: this.layer.source?.length,
        rendererType: this.layer.renderer?.type,
        rendererField: this.layer.renderer?.field,
        fullExtent: this.layer.fullExtent,
        spatialReference: this.layer.spatialReference
      });
      
      // Validate renderer field exists in features
      if (this.layer.source && this.layer.source.length > 0) {
        const sampleFeature = this.layer.source.getItemAt(0);
        const hasRendererField = sampleFeature?.attributes?.hasOwnProperty(this.renderer.field);
        console.log('[DifferenceViz] Renderer field validation:', {
          rendererField: this.renderer.field,
          hasRendererField,
          sampleAttributes: Object.keys(sampleFeature?.attributes || {}),
          sampleValues: {
            primary_value: sampleFeature?.attributes?.primary_value,
            secondary_value: sampleFeature?.attributes?.secondary_value,
            difference_value: sampleFeature?.attributes?.difference_value
          }
        });
        
        if (!hasRendererField) {
          console.error('[DifferenceViz] CRITICAL: Renderer field not found in features!');
        }
      }

      // Apply standardized popup with bar chart content
      if (options.popupConfig) {
        this.applyPopupTemplate(this.layer, options.popupConfig);
      } else {
        // Use standardized popup with difference-specific fields
        const popupFields = this.getPopupFields('difference');
        this.applyStandardizedPopup(
          this.layer,
          popupFields.barChartFields,
          popupFields.listFields,
          'difference'
        );
      }

      // Calculate extent using base class method (like other visualizations)
      this.extent = super.calculateExtent(processedFeatures);
      
      console.log('[DifferenceViz] Extent calculated:', {
        hasExtent: !!this.extent,
        extent: this.extent ? {
          xmin: this.extent.xmin,
          ymin: this.extent.ymin,
          xmax: this.extent.xmax,
          ymax: this.extent.ymax
        } : null
      });

      console.log('[DifferenceViz] Successfully created difference visualization');

      return {
        layer: this.layer,
        extent: this.extent,
        renderer: this.renderer,
        legendInfo: this.getLegendInfo(),
        shouldZoom: true
      };

    } catch (error) {
      console.error('[DifferenceViz] Error creating difference visualization:', error);
      throw error;
    }
  }

  /**
   * Creates a popup template for difference visualization
   */
  private createDifferencePopupTemplate(data: DifferenceVisualizationData): PopupTemplate {
    const primaryLabel = data.primaryLabel || 'Primary';
    const secondaryLabel = data.secondaryLabel || 'Secondary';
    const unit = data.unitType === 'percentage' ? '%' : '';

    return new PopupTemplate({
      title: `${primaryLabel} vs ${secondaryLabel} Difference`,
      content: [
        new FieldsContent({
          fieldInfos: [
            {
              fieldName: "primary_value",
              label: `${primaryLabel} Value`,
              format: {
                places: 1,
                digitSeparator: true
              }
            },
            {
              fieldName: "secondary_value", 
              label: `${secondaryLabel} Value`,
              format: {
                places: 1,
                digitSeparator: true
              }
            },
            {
              fieldName: "difference_value",
              label: `Difference (${primaryLabel} - ${secondaryLabel})`,
              format: {
                places: 1,
                digitSeparator: true
              }
            }
          ]
        })
      ]
    });
  }

  /**
   * Get standardized legend data
   */
  getLegendInfo(): StandardizedLegendData {
    // Use standardized field mapping for legend title
    const primaryName = this.data?.primaryField ? FieldMappingHelper.getFriendlyFieldName(this.data.primaryField) : (this.data?.primaryLabel || 'Primary');
    const secondaryName = this.data?.secondaryField ? FieldMappingHelper.getFriendlyFieldName(this.data.secondaryField) : (this.data?.secondaryLabel || 'Secondary');
    const title = `${primaryName} vs ${secondaryName} Difference`;
    
    // Use base class method for consistent legend generation, but ensure proper structure
    const baseLegend = this.convertRendererToLegendData(
      title,
      'class-breaks',
      `Comparison showing areas where ${primaryName} or ${secondaryName} has higher values`
    );
    
    // Ensure all legend items have the required properties for MapLegend compatibility
    const itemsWithRequiredProps = baseLegend.items?.map(item => ({
      label: item.label,
      color: item.color,
      outlineColor: item.outlineColor || 'rgba(128, 128, 128, 0.5)',
      shape: 'square' as const,
      size: 16
    }));

    return {
      ...baseLegend,
      items: itemsWithRequiredProps
    };
  }

  /**
   * Validates that the required fields exist for difference calculation
   */
  static validateDifferenceFields(
    features: any[], 
    primaryField: string, 
    secondaryField: string
  ): { isValid: boolean; errorMessage?: string } {
    if (!features || features.length === 0) {
      return { isValid: false, errorMessage: 'No features provided for validation' };
    }

    const sampleFeature = features[0];
    const attributes = { 
      ...(sampleFeature.attributes || {}), 
      ...(sampleFeature.properties || {}) 
    };

    const primaryExists = attributes[primaryField] !== undefined;
    const secondaryExists = attributes[secondaryField] !== undefined;

    if (!primaryExists && !secondaryExists) {
      return { 
        isValid: false, 
        errorMessage: `Neither primary field '${primaryField}' nor secondary field '${secondaryField}' found in data` 
      };
    }

    if (!primaryExists) {
      return { 
        isValid: false, 
        errorMessage: `Primary field '${primaryField}' not found in data` 
      };
    }

    if (!secondaryExists) {
      return { 
        isValid: false, 
        errorMessage: `Secondary field '${secondaryField}' not found in data` 
      };
    }

    // Check for sufficient numeric data
    const validFeatures = features.filter(f => {
      const attrs = { ...(f.attributes || {}), ...(f.properties || {}) };
      const primaryVal = attrs[primaryField];
      const secondaryVal = attrs[secondaryField];
      return primaryVal != null && secondaryVal != null && 
             !isNaN(Number(primaryVal)) && !isNaN(Number(secondaryVal));
    });

    if (validFeatures.length < 10) {
      return { 
        isValid: false, 
        errorMessage: `Insufficient valid data for difference analysis (found ${validFeatures.length}, need at least 10)` 
      };
    }

    return { isValid: true };
  }
} 