/* eslint-disable prefer-const */
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import { VisualizationOptions, BaseVisualization, BaseVisualizationData, VisualizationResult } from './base-visualization';
import Extent from '@arcgis/core/geometry/Extent';
import Graphic from '@arcgis/core/Graphic';
import Point from '@arcgis/core/geometry/Point';
import SpatialReference from '@arcgis/core/geometry/SpatialReference';
import * as projection from '@arcgis/core/geometry/projection';
import { createGeometry } from "../../utils/geometry";
import type { GeometryObject } from "../../types/geospatial-ai-types";
import Polygon from '@arcgis/core/geometry/Polygon';
import MapView from '@arcgis/core/views/MapView';
import { mapFeatureFields, createFieldDefinitions, createPopupFieldInfos } from '../field-mapping';
import { LayerField } from '../../types/geospatial-ai-types';
import { StandardizedLegendData, LegendType, colorToRgba, getSymbolShape, getSymbolSize } from '@/types/legend';
import { LegendItem } from '@/components/MapLegend';

export interface PointVisualizationOptions extends VisualizationOptions {
  filterLayer?: {
    features: any[];
    field: string;
    threshold: 'top10percent' | number;
  };
  shouldReplace?: boolean;
  featuresUrl?: string;
  title?: string;
  mapView?: MapView;
  extentPadding?: number;
}

export interface PointVisualizationData extends BaseVisualizationData {
  features: any[];
  layerName: string;
  rendererField?: string;
  spatialReference?: __esri.SpatialReference;
  layerConfig?: {
    fields: LayerField[];
  };
}

export class PointLayerVisualization extends BaseVisualization<PointVisualizationData> {
  protected declare layer: __esri.FeatureLayer;
  protected declare renderer: __esri.Renderer;
  protected declare extent: __esri.Extent;

  private extractZipCode(address: string): string | null {
    const zipRegex = /\b\d{5}(?:-\d{4})?\b/;
    const match = address.match(zipRegex);
    return match ? match[0] : null;
  }

  protected async initializeLayer(data: PointVisualizationData, options: PointVisualizationOptions = {}): Promise<void> {
    console.log('=== Point Layer Visualization Initialize ===', {
      featureCount: data.features.length,
      layerName: data.layerName,
      rendererField: data.rendererField,
      layerConfig: data.layerConfig,
      firstFeature: data.features[0]
    });

    // Ensure layer config exists with proper field mapping
    if (!data.layerConfig) {
      data.layerConfig = {
        fields: []
      };
    }

    // Get the primary display field from config or determine dynamically
    const primaryField = this.determinePrimaryField(data);
    
    // Add primary field if not present
    const hasPrimaryField = data.layerConfig.fields.some(f => 
      f.name === primaryField || 
      f.alias === primaryField || 
      (f.alternateNames && f.alternateNames.includes(primaryField))
    );

    if (!hasPrimaryField) {
      data.layerConfig.fields.push({
        name: primaryField,
        type: 'string',
        alias: 'Store Name',
        label: 'Store Name',
        alternateNames: ['NAME', 'CONAME', 'COMPANY_NAME', 'BUSINESS_NAME', 'StoreName', 'STORE_NAME']
      });
    } else {
      // Update existing field to include CONAME as alternate name
      const existingField = data.layerConfig.fields.find(f => 
        f.name === primaryField || 
        f.alias === primaryField || 
        (f.alternateNames && f.alternateNames.includes(primaryField))
      );
      if (existingField) {
        existingField.alternateNames = existingField.alternateNames || [];
        if (!existingField.alternateNames.includes('CONAME')) {
          existingField.alternateNames.push('CONAME');
        }
      }
    }

    // Store data for use in other methods
    this.data = data;

    try {
      // Map fields for the first feature to get field structure
      const mappedFeature = this.mapFeature(data.features[0]);
      const fields = this.createFields(mappedFeature);

      // Create renderer before creating the layer
      this.renderer = this.getRenderer(options.symbolConfig);

      console.log('=== Creating Feature Layer ===', {
        primaryField,
        mappedFeatureAttributes: mappedFeature.attributes,
        fields: fields.map(f => ({ name: f.name, type: f.type, alias: f.alias }))
      });

      // Create graphics from features
      const graphics = data.features.map(f => this.mapFeature(f));

      // Log sample graphics for debugging
      console.log('=== Sample Graphics ===', {
        count: graphics.length,
        firstGraphic: graphics[0],
        hasGeometry: graphics.every(g => g.geometry !== undefined),
        geometryTypes: [...new Set(graphics.map(g => g.geometry?.type))]
      });

      this.layer = new FeatureLayer({
        source: graphics,
        objectIdField: "OBJECTID",
        fields: fields,
        renderer: this.renderer,  // Use the already created renderer
        opacity: options.opacity ?? 0.8,
        title: options.title || data.layerName,
        visible: options.visible ?? true,
      });
      
      // CRITICAL FIX: Store a reference to this visualization on the layer
      // This allows MapApp to find the visualization and get legend info
      this.layer.set('visualization', this);

      // Apply standardized popup template
      const popupFields = this.getPopupFields('default');
      this.applyStandardizedPopup(
        this.layer,
        popupFields.barChartFields,
        popupFields.listFields,
        'point-layer'
      );

      await this.calculateExtent(graphics);
      
    } catch (error: unknown) {
      console.error('Error initializing layer:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to initialize layer: ${error.message}`);
      }
      throw new Error('Failed to initialize layer: Unknown error');
    }
  }

  async create(data: PointVisualizationData, options: PointVisualizationOptions = {}): Promise<VisualizationResult> {
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

  getRenderer(symbolConfig?: VisualizationOptions['symbolConfig']): __esri.Renderer {
    const defaultSymbol = new SimpleMarkerSymbol({
      color: symbolConfig?.color || [0, 122, 194, 0.8],
      size: symbolConfig?.size || 8,
      outline: {
        color: symbolConfig?.outline?.color || [0, 0, 0, 0],
        width: symbolConfig?.outline?.width || 0
      }
    });

    return new SimpleRenderer({
      symbol: defaultSymbol
    });
  }

  getLegendInfo(): StandardizedLegendData {
    const title = this.layer?.title || "Points";
    
    // Use base class method for consistent legend generation
    return this.convertRendererToLegendData(
      title,
      'simple',
      `Point layer showing ${this.data?.features?.length || 0} locations`
    );
  }

  protected mapFeature(feature: any): Graphic {
    console.log('=== Point Layer Feature Mapping ===', {
      hasProperties: !!feature.properties,
      hasAttributes: !!feature.attributes,
      properties: feature.properties,
      attributes: feature.attributes,
      rendererField: feature.properties?.rendererField,
      rendererValue: feature.properties?.rendererValue,
      geometry: feature.geometry
    });

    // Create point geometry from coordinates
    let geometry: __esri.Point | undefined;
    if (feature.geometry?.type === 'point' && Array.isArray(feature.geometry.coordinates)) {
      geometry = new Point({
        x: feature.geometry.coordinates[0],
        y: feature.geometry.coordinates[1],
        spatialReference: { wkid: 4326 }
      });
    }

    // Map the fields using the field mapping utility
    const mappedAttributes = mapFeatureFields(feature, this.data?.layerConfig?.fields || []);

    // Create a new attributes object combining mapped fields and ensuring OBJECTID
    const combinedAttributes: { [key: string]: any } = {
      ...mappedAttributes,
      OBJECTID: feature.attributes?.OBJECTID || feature.properties?.OBJECTID || Date.now()
    };

    // Ensure renderer field and value are set
    if (feature.properties?.rendererField && feature.properties?.rendererValue) {
      combinedAttributes[feature.properties.rendererField] = feature.properties.rendererValue;
    }

    // Create the feature with combined attributes
    const mappedFeature = new Graphic({
      geometry,
      attributes: combinedAttributes
    });

    console.log('=== Point Layer Mapping Result ===', {
      hasGeometry: !!mappedFeature.geometry,
      attributes: mappedFeature.attributes,
      mappedFields: Object.keys(mappedFeature.attributes)
    });

    return mappedFeature;
  }

  private determinePrimaryField(data: PointVisualizationData): string {
    // First try renderer field from data
    if (data.rendererField) {
      return data.rendererField;
    }

    // Then check layer config
    if (data.layerConfig?.fields) {
      // Look for fields with name-like properties
      const nameFields = data.layerConfig.fields.filter(f => 
        /name|title|label/i.test(f.name) || 
        /name|title|label/i.test(f.alias || '')
      );
      if (nameFields.length > 0) {
        return nameFields[0].name;
      }
    }

    // Check first feature for common name fields
    if (data.features[0]?.attributes) {
      const commonFields = ['name', 'title', 'label', 'displayName'];
      for (const field of commonFields) {
        if (data.features[0].attributes[field]) {
          return field;
        }
      }
    }

    // Default to first string field
    if (data.layerConfig?.fields) {
      const stringField = data.layerConfig.fields.find(f => f.type === 'string');
      if (stringField) {
        return stringField.name;
      }
    }

    // Final fallback
    return 'name';
  }
} 