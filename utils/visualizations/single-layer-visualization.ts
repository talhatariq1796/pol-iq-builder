import { DEFAULT_FILL_ALPHA } from "./constants";
/* eslint-disable no-prototype-builtins */
/* eslint-disable prefer-const */
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import ClassBreaksRenderer from '@arcgis/core/renderers/ClassBreaksRenderer';
import Graphic from '@arcgis/core/Graphic';
import { Polygon } from '@arcgis/core/geometry';
import SpatialReference from '@arcgis/core/geometry/SpatialReference';
import * as geometryEngineAsync from '@arcgis/core/geometry/geometryEngineAsync';
import * as labelPointOperator from "@arcgis/core/geometry/operators/labelPointOperator.js";
import * as projection from '@arcgis/core/geometry/projection';
import { BaseVisualization, BaseVisualizationData, VisualizationOptions, VisualizationResult } from './base-visualization';
import { createQuartileRenderer } from '../createQuartileRenderer';
import { createGeometry } from '../geometry';
import { createDefaultPopupConfig, createPopupTemplateFromConfig } from '@/utils/popup-utils';
import { PopupConfiguration } from '@/types/popup-config';
import { AnalysisContext } from '../feature-optimization';
import { DBSCAN } from 'density-clustering';
import Color from "@arcgis/core/Color";
import { StandardizedLegendData, LegendType, colorToRgba, getSymbolShape, getSymbolSize } from '@/types/legend';
import { LegendItem } from '@/components/MapLegend';
import { ColorStop } from '../types';
import { 
  MicroserviceResponse, 
  isValidMicroserviceResponse, 
  isMicroserviceError,
  convertToVisualizationData 
} from '../../types/microservice-types';
import { FieldMappingHelper } from './field-mapping-helper';

type FieldType = "string" | "oid" | "small-integer" | "integer" | "single" | "double" | "long" | "date" | "big-integer" | "date-only" | "time-only" | "timestamp-offset" | "geometry" | "blob" | "raster" | "guid" | "global-id" | "xml";

interface LayerField {
  name: string;
  type: FieldType;
  label?: string;
}

export interface SingleLayerData extends BaseVisualizationData {
  features: any[];
  layerName: string;
  rendererField: string;
  layerConfig: {
    fields: LayerField[];
    sourceSR?: number;
  };
}

export interface SingleLayerOptions extends VisualizationOptions {
  mode?: 'highlight' | 'distribution' | 'density' | 'correlation' | 'topN';
  rendererField?: string;
  colorRamp?: [number, number, number][];
  numBreaks?: number;
  extent?: __esri.Extent;
  analysisContext?: AnalysisContext;
  mapView?: __esri.MapView | __esri.SceneView;
  identifierField?: string;
  limit?: number;
}

export class SingleLayerVisualization extends BaseVisualization<SingleLayerData> {
  protected layer: FeatureLayer | null = null;
  protected renderer: SimpleRenderer | ClassBreaksRenderer | null = null;
  protected extent: __esri.Extent | null = null;
  protected data: SingleLayerData | null = null;
  protected options: SingleLayerOptions = {};

  private calculateBreakPoints(values: number[]): number[] {
    if (values.length === 0) return [];
    
    // Sort values
    const sortedValues = [...values].sort((a, b) => a - b);
    
    // Calculate quartile positions
    const q1Index = Math.floor(sortedValues.length * 0.25);
    const q2Index = Math.floor(sortedValues.length * 0.5);
    const q3Index = Math.floor(sortedValues.length * 0.75);
    
    // Get quartile values
    return [
      sortedValues[q1Index],  // 25th percentile
      sortedValues[q2Index],  // 50th percentile (median)
      sortedValues[q3Index]   // 75th percentile
    ];
  }

  private formatBreakLabel(value: number): string {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  }

  protected async processFeatures(features: any[]): Promise<Graphic[]> {
    // *** ADDED: Log the received layerConfig ***
    console.log('[processFeatures] Received layerConfig:', this.data?.layerConfig);
    // *** ADDED: Log the rendererField from data ***
    const rendererFieldName = this.data?.rendererField;
    console.log(`[processFeatures] Using rendererField from data: ${rendererFieldName}`);

    if (!rendererFieldName) {
      console.error("[processFeatures] Critical error: rendererField is missing from data object.");
      return []; // Cannot proceed without knowing which field to use
    }

    console.log(`[processFeatures] Starting simplified processing of ${features.length} features`);
    
    // Try a completely simplified approach
    const validGraphics: Graphic[] = [];
    
    for (let i = 0; i < features.length; i++) {
      const feature = features[i];
      const safeIndex = (i % 2147483647) + 1;
      
      try {
        // Get renderer value
        const sourceAttrs = { ...feature.attributes, ...feature.properties };
        let rendererValue = sourceAttrs[rendererFieldName];
        
        // Simple value conversion to number
        let numericValue: number | null = null;
        if (typeof rendererValue === 'number' && !isNaN(rendererValue)) {
          numericValue = rendererValue;
        } else if (typeof rendererValue === 'string') {
          const parsed = parseFloat(rendererValue.replace(/,/g, ''));
          numericValue = !isNaN(parsed) ? parsed : null;
        }
        
        // Use stored original Esri geometry if present; otherwise fall back to feature.geometry
        const originalEsriGeom = feature.properties?._originalEsriGeometry || feature.geometry;
        
        // Create geometry with minimal processing
        let geom = createGeometry(originalEsriGeom);
        if (!geom || geom.type !== 'polygon') {
          console.warn(`Feature ${i} invalid geometry type, skipping`);
          continue;
        }
        
        // Try to simplify the geometry if needed - USE ASYNC
        if (!(await geometryEngineAsync.isSimple(geom as any))) {
          console.log(`Feature ${i} has non-simple geometry, attempting to simplify`);
          const simplifiedGeom = await geometryEngineAsync.simplify(geom as any);
          
          // If simplification succeeded, use the simplified geometry
          if (simplifiedGeom) {
            geom = simplifiedGeom;
          } else {
            console.warn(`Failed to simplify feature ${i}, using original geometry`);
          }
        }
        
        // Create graphic with all original attributes, plus calculated values
        const outputAttributes: Record<string, any> = {
          ...sourceAttrs, // Copy all original attributes
          OBJECTID: safeIndex, // Overwrite with our safe index
          thematic_value: numericValue, // Add calculated thematic value
        };



        // *** Placeholder for potential centroid calculation fix ***
        // if (geom.type === 'polygon') {
        //   try {
        //      // Incorrect: const center = await geometryEngineAsync.centroid(geom);
        //      // Correct async approach (example):
        //      const labelPoint = await geometryEngineAsync.labelPoint(geom);
        //      if (labelPoint) {
        //          outputAttributes.centroid_x = labelPoint.longitude;
        //          outputAttributes.centroid_y = labelPoint.latitude;
        //      } else {
        //          // Fallback using synchronous engine (if needed, less ideal)
        //          // import geometryEngine from '@arcgis/core/geometry/geometryEngine';
        //          // const syncCentroid = geometryEngine.centroid(geom);
        //          // if (syncCentroid) { ... }
        //      }
        //   } catch (centroidError) {
        //      console.warn(`Feature ${i} failed centroid calculation:`, centroidError);
        //   }
        // }

        const graphic = new Graphic({
          geometry: geom as any,
          attributes: outputAttributes
        });
        
        validGraphics.push(graphic);
        
        // Log progress
        if (i % 500 === 0) {
          console.log(`[processFeatures] Processed ${i}/${features.length} features`);
        }
      } catch (error) {
        console.warn(`Error processing feature ${i}:`, error);
      }
    }
    
    console.log(`[processFeatures] Successfully created ${validGraphics.length} graphics out of ${features.length} features`);
    return validGraphics;
  }

  protected calculateBreaks(values: number[], numBreaks: number): number[] {
    const sorted = values.slice().sort((a, b) => a - b);
    const breaks: number[] = [];
    const step = sorted.length / numBreaks;

    for (let i = 1; i < numBreaks; i++) {
      const index = Math.floor(step * i);
      breaks.push(sorted[index]);
    }

    return breaks;
  }

  protected getColorRamp(count: number): [number, number, number][] {
    // Use a green color ramp for distribution visualization
    const colors: [number, number, number][] = [];
    for (let i = 0; i < count; i++) {
      const intensity = i / (count - 1);
      colors.push([
        Math.round(200 * (1 - intensity)),
        Math.round(200 + (55 * intensity)),
        Math.round(200 * (1 - intensity))
      ]);
    }
    return colors;
  }

  protected createFieldsFromSample(sampleFeature: Graphic): __esri.FieldProperties[] {
    // --- REMOVE MINIMAL FIELDS DEBUGGING BLOCK --- 
    // console.warn("[createFieldsFromSample] REVERTING TO SIMPLIFIED FIELDS FOR DEBUGGING: OBJECTID and thematic_value (double) ONLY.");
    // const fields: __esri.FieldProperties[] = [
    //     { name: "OBJECTID", type: "oid", alias: "OBJECTID" },
    //     { name: "thematic_value", type: "double", alias: "Value" } // Assume double for simplicity
    // ];
    // console.log('[createFieldsFromSample] Simplified fields defined for FeatureLayer:', fields);
    // return fields;
    // --- END REMOVAL ---

    // --- RESTORE REFINED FIELD DEFINITION --- 
    // --- REFINED FIELD DEFINITION ---
    if (!sampleFeature?.attributes) {
        console.warn("[createFieldsFromSample] Sample feature has no attributes. Defining minimal fields.");
        return [
            { name: "OBJECTID", type: "oid", alias: "OBJECTID" },
            { name: "thematic_value", type: "double", alias: "Value" } // Fallback
        ];
    }

    const fields: __esri.FieldProperties[] = [
        { name: "OBJECTID", type: "oid", alias: "OBJECTID" } // Always include OBJECTID
    ];
    const essentialPopupFields = ['ID', 'DESCRIPTION', 'CreationDate', 'EditDate'];
    const attributes = sampleFeature.attributes;

    // 1. Determine type and existence of thematic_value
    const rendererFieldName = this.data?.rendererField;
    let thematicValueType: FieldType = 'double'; // Default type
    let thematicValueExistsInSample = attributes.hasOwnProperty('thematic_value');

    if (thematicValueExistsInSample) {
        thematicValueType = this.getFieldType(attributes['thematic_value'], 'thematic_value');
    } else if (rendererFieldName && attributes.hasOwnProperty(rendererFieldName)) {
        // If thematic_value wasn't in the processed attributes, derive type from original field
        thematicValueType = this.getFieldType(attributes[rendererFieldName], rendererFieldName);
    } else {
        console.warn(`[createFieldsFromSample] Cannot determine type for thematic_value. Defaulting to double.`);
    }

    // 2. Always add thematic_value definition with a user-friendly alias
    const friendlyAlias = FieldMappingHelper.getFriendlyFieldName(rendererFieldName || 'thematic_value');
    fields.push({ name: "thematic_value", type: thematicValueType, alias: friendlyAlias });

    // 3. Add definitions ONLY for essential popup fields if they exist in the sample
    for (const key of essentialPopupFields) {
        if (attributes.hasOwnProperty(key)) {
            // Avoid duplicate definition if rendererField happens to be an essential field
            if (!fields.some(f => f.name === key)) {
                 fields.push({
                    name: key,
                    type: this.getFieldType(attributes[key], key),
                    alias: FieldMappingHelper.getFriendlyFieldName(key)
                 });
            }
        }
    }

    // --- Ensure all field aliases are human-readable ---
    fields.forEach(f => {
        if (f.name && (!f.alias || f.alias === f.name)) {
            f.alias = FieldMappingHelper.getFriendlyFieldName(f.name);
        }
    });

    console.log('[createFieldsFromSample] Refined fields defined for FeatureLayer:', fields.map(f => ({ name: f.name, type: f.type })));
    return fields;
    // --- END REFINED FIELD DEFINITION ---
    // --- END RESTORE --- 

    /* --- PREVIOUS SIMPLIFIED FIELDS (COMMENTED OUT) ---
    // ...
    */

    /* --- ORIGINAL DETAILED FIELD CREATION (COMMENTED OUT) ---
    if (!sampleFeature?.attributes) return [];
    const fields: __esri.FieldProperties[] = [];
    // Ensure OBJECTID is first
    fields.push({ name: "OBJECTID", type: "oid", alias: "OBJECTID" });

    // *** ADDED: Get the renderer field name from data ***
    const rendererFieldName = this.data?.rendererField;
    let thematicValueType: FieldType = 'double'; // Default type
    let thematicValueExists = false;

    for (const [key, value] of Object.entries(sampleFeature.attributes)) {
      if (key === 'OBJECTID') continue;

      // *** ADDED: Specifically handle thematic_value or determine its type ***
      if (key === 'thematic_value') {
          thematicValueExists = true;
          thematicValueType = this.getFieldType(value, key); // Get type from the processed value
          fields.push({
             name: key,
             type: thematicValueType,
             alias: "Value" // Use a user-friendly alias
          });
      } else if (key === rendererFieldName) {
          // If the original renderer field is still present and *not* thematic_value,
          // capture its type in case thematic_value wasn't set in the sample.
          if (!thematicValueExists) {
              thematicValueType = this.getFieldType(value, key);
          }
          // Optionally add the original field too, or skip it if thematic_value is preferred
           fields.push({
             name: key,
             type: this.getFieldType(value, key),
             alias: key // Use key as alias for simplicity
           });
      } else {
          // Add other fields
          fields.push({
            name: key,
            type: this.getFieldType(value, key),
            alias: key // Use key as alias for simplicity
          });
      }
    }

    // *** ADDED: Ensure 'thematic_value' field is defined even if not in sample attributes ***
    if (!thematicValueExists) {
        console.warn(`[createFieldsFromSample] 'thematic_value' was not present in the sample feature's processed attributes. Adding definition manually using type: ${thematicValueType}`);
        fields.push({
            name: "thematic_value",
            type: thematicValueType, // Use type derived from original rendererField or default
            alias: FieldMappingHelper.getFriendlyFieldName("thematic_value")
        });
    }

    console.log('[createFieldsFromSample] Final fields defined for FeatureLayer:', fields.map(f => ({ name: f.name, type: f.type })));
    return fields;
    */
  }

  protected getFieldType(value: any, fieldName: string): FieldType {
    if (fieldName === 'OBJECTID') return 'oid';
    if (fieldName === 'latitude' || fieldName === 'longitude') return 'double';
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') {
        if (Number.isInteger(value)) return 'integer';
        return 'double';
    }
    if (value instanceof Date) return 'date';
    // Basic check for potential GUID
    if (typeof value === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value)) {
        return 'guid';
    }
    return 'string'; // Default fallback
  }

  protected createFieldInfos(fields: LayerField[]): __esri.FieldProperties[] {
    return fields.map(field => ({
      name: field.name,
      type: field.type,
      alias: field.label || field.name // Use label if available, otherwise name
    }));
  }

  protected async calculateExtentFromFeatures(features: Graphic[]): Promise<__esri.Extent | null> {
    if (!features || features.length === 0) {
      console.warn('[calculateExtent] No features provided.');
      return null;
    }

    // --- LOGGING: Initial feature count ---
    console.log(`[calculateExtent] Starting extent calculation for ${features.length} input features.`);
    // --- END LOGGING ---

    // More robust filtering: check geometry, extent, finite values, and non-zero dimensions
    const validGeometries = features
      .map(f => f.geometry)
      .filter((g): g is __esri.Polygon => // Assuming polygon for single layer viz
          g !== null &&
          g !== undefined &&
          g.type === 'polygon' &&
          !!g.extent &&
          isFinite(g.extent.xmin) &&
          isFinite(g.extent.ymin) &&
          isFinite(g.extent.xmax) &&
          isFinite(g.extent.ymax) &&
          g.extent.width > 1e-6 && // Use a small tolerance instead of zero
          g.extent.height > 1e-6 // Use a small tolerance instead of zero
      );

    // --- LOGGING: Count after filtering ---
    console.log(`[calculateExtent] Found ${validGeometries.length} valid geometries with non-zero dimension extents after filtering.`);
    // --- END LOGGING ---

    // --- MODIFICATION START: Union extents instead of geometries ---
    let finalExtent: __esri.Extent | null = null;
    try {
        if (validGeometries.length > 0) {
            // --- LOGGING: First valid extent ---
            if (validGeometries[0]?.extent) {
                console.log('[calculateExtent] First valid geometry extent:', JSON.stringify(validGeometries[0].extent.toJSON()));
            }
            // --- END LOGGING ---

            // Initialize with the first valid extent
            if (!validGeometries[0]?.extent) {
                console.warn('[calculateExtent] First geometry has no extent');
                return null;
            }
            finalExtent = validGeometries[0].extent.clone();

            // Loop through the rest and union their extents
            for (let i = 1; i < validGeometries.length; i++) {
                if (validGeometries[i]?.extent) { // Double check extent exists
                    finalExtent = finalExtent.union(validGeometries[i].extent as __esri.Extent);
                }
            }

            // --- LOGGING: Final unioned extent ---
            console.log('[calculateExtent] Final unioned extent before validation:', finalExtent ? JSON.stringify(finalExtent.toJSON()) : 'null');
            // --- END LOGGING ---

            // Validate the final combined extent
            if (!finalExtent || !isFinite(finalExtent.xmin) || !isFinite(finalExtent.ymin) ||
                !isFinite(finalExtent.xmax) || !isFinite(finalExtent.ymax) ||
                finalExtent.width <= 1e-6 || finalExtent.height <= 1e-6) {
                console.warn('[calculateExtent] Final unioned extent is invalid or has zero dimensions:', finalExtent ? JSON.stringify(finalExtent.toJSON()) : 'null');
                // Fallback to the first valid extent if union fails validation
                if (validGeometries[0]?.extent) {
                    finalExtent = validGeometries[0].extent.clone();
                    console.log('[calculateExtent] Using fallback extent (first valid): ', finalExtent ? JSON.stringify(finalExtent.toJSON()) : 'null');
                } else {
                    console.warn('[calculateExtent] No valid fallback extent available');
                    return null;
                }
            }
        } else {
            // This case should ideally not be reached due to the check above
            console.warn('[calculateExtent] No valid geometries found after filtering, returning null.');
            return null; // Return null explicitly
        }

        console.log('[calculateExtent] Returning final calculated extent:', finalExtent ? JSON.stringify(finalExtent.toJSON()) : 'null');
        return finalExtent ? finalExtent.clone() : null;

    } catch (error) {
        console.error('[calculateExtent] Error during extent union:', error);
        // Fallback to the first valid extent on error
        if (validGeometries.length > 0 && validGeometries[0]?.extent) {
            console.log('[calculateExtent] Error fallback: Returning first valid extent.');
            return validGeometries[0].extent.clone();
        } else {
             console.log('[calculateExtent] Error fallback: No valid extent to return, returning null.');
            return null; // No valid extent to fall back to
        }
    }
    // --- MODIFICATION END ---
  }

  protected getRendererFromValues(values: number[], field: string): ClassBreaksRenderer {
    const breaks = this.calculateBreaks(values, 5);
    const colors = this.getColorRamp(breaks.length + 1);

    return new ClassBreaksRenderer({
      field,
      defaultSymbol: new SimpleFillSymbol({
        color: [200, 200, 200, 0.6],
        outline: { color: [0, 0, 0, 0], width: 0 }
      }),
      classBreakInfos: breaks.map((breakValue, index) => ({
        minValue: index === 0 ? Math.min(...values) : breaks[index - 1],
        maxValue: breakValue,
        symbol: new SimpleFillSymbol({
          color: [...colors[index], DEFAULT_FILL_ALPHA],
          outline: { color: [0, 0, 0, 0], width: 0 }
        })
      }))
    });
  }

  async create(
    data: SingleLayerData,
    options?: SingleLayerOptions & { popupConfig?: PopupConfiguration }
  ): Promise<VisualizationResult> {
    this.data = data;
    this.options = options || {};
    const analysisContext = options?.analysisContext;
    const populationLookup = analysisContext?.populationLookup;
    const mapView = options?.mapView;
    const identifierField = options?.identifierField || 'ID';

    // ++ LOGGING: Inputs ++
    console.log(`[SingleLayerViz DEBUG] create() called. Input data features: ${data.features?.length}, RendererField from options: ${options?.rendererField}`);
    console.log(`[SingleLayerViz DEBUG] Options:`, { rendererField: options?.rendererField, identifierField: identifierField, hasMapView: !!mapView, analysisContextKeys: analysisContext ? Object.keys(analysisContext) : 'null' });
    console.log(`[SingleLayerViz DEBUG] Population Lookup: Map size = ${populationLookup ? populationLookup.size : 0}`);
    if (populationLookup && populationLookup.size > 0) {
      const sampleKey = populationLookup.keys().next().value;
      if (sampleKey) {
        console.log(`[SingleLayerViz DEBUG] Population Lookup Sample: Key='${sampleKey}', Value=${populationLookup.get(sampleKey)}`);
      }
    }
    // ++ END LOGGING ++

    if (!data.features || data.features.length === 0) {
      console.warn('[SingleLayerViz] No features provided in data.');
      return { layer: null, extent: null };
    }
    
    // <<< STEP 1: Process input features (LocalGeospatialFeature[]) into ArcGIS Graphics >>>
    console.log('[SingleLayerViz CREATE STEP 1] Calling this.processFeatures to convert input...');
    let arcGisGraphics: Graphic[] = [];
    try {
        arcGisGraphics = await this.processFeatures(data.features);
        console.log(`[SingleLayerViz CREATE STEP 1] processFeatures returned ${arcGisGraphics.length} ArcGIS Graphics.`);
        // +++ LOG: Inspect processed graphics +++
        if (arcGisGraphics.length > 0) {
          console.log(`[SingleLayerViz LOG 1a] First processed graphic attributes:`, JSON.stringify(arcGisGraphics[0].attributes));
          const firstValue = arcGisGraphics[0].attributes?.thematic_value;
          console.log(`[SingleLayerViz LOG 1b] First processed graphic thematic_value: ${firstValue} (Type: ${typeof firstValue})`);
        }
        // +++ END LOG +++
    } catch (processError) {
        console.error('[SingleLayerViz CREATE STEP 1] Error calling processFeatures:', processError);
        return { layer: null, extent: null };
    }
    if (arcGisGraphics.length === 0) {
        console.warn('[SingleLayerViz CREATE STEP 1] processFeatures returned 0 graphics.');
        return { layer: null, extent: null };
    }
    // <<< END STEP 1 >>>

    // Determine renderer field using options first, then potentially layer config from data
    // (Note: findBestRendererField fallback is likely not robust)
    const rendererField = options?.rendererField || this.findBestRendererField(arcGisGraphics);
    // +++ LOG: Renderer Field +++
    console.log(`[SingleLayerViz LOG 2] Determined rendererField value: ${rendererField}`);
    // +++ END LOG +++
    if (!rendererField) {
      console.error("SingleLayerVisualization: Cannot determine renderer field.");
      // Optionally, try to find a default numeric field from the *processed* graphics
      const sampleAttrs = arcGisGraphics[0]?.attributes;
      let fallbackField = null;
      if (sampleAttrs) {
          fallbackField = Object.keys(sampleAttrs).find(key => typeof sampleAttrs[key] === 'number');
      }
      if (!fallbackField) {
          console.error("Could not find any fallback numeric renderer field.");
          return { layer: null, extent: null }; // Return null if no field can be determined
      }
      console.warn(`Using fallback renderer field: ${fallbackField}`);
      // Cannot reassign const, so we might need to rethink this part or pass explicitly.
      // For now, we will likely fail if options.rendererField is missing and findBestRendererField returns null.
       return { layer: null, extent: null };
    }

    // --- Now use arcGisGraphics for subsequent steps --- 

    // --- 1. Initial Filtering (using arcGisGraphics) ---
    const values = arcGisGraphics
      .map(g => g.attributes[rendererField]) // <<< USE attributes
      .filter(v => typeof v === 'number' && !isNaN(v)) as number[];

    console.log(`[SingleLayerViz CHECK 1] Found ${values.length} valid numeric values for field '${rendererField}'.`);
    if (values.length === 0) {
        console.warn("SingleLayerVisualization: No valid numeric data found for renderer field:", rendererField);
        return { layer: null, extent: null };
    }

    const percentileValue = this.calculatePercentile(values, 75);

    let filteredGraphics = arcGisGraphics.filter(g => { // <<< Filter arcGisGraphics
      const attrValue = g.attributes[rendererField]; // <<< USE attributes
      return typeof attrValue === 'number' &&
             attrValue >= percentileValue &&
             g.geometry;
    });

    console.log(`[SingleLayerViz DEBUG] Initial filter: ${arcGisGraphics.length} -> ${filteredGraphics.length} features (>= 75th percentile: ${percentileValue})`);

    // Apply limit if specified in options
    if (options?.limit && filteredGraphics.length > options.limit) {
        console.log(`[SingleLayerViz DEBUG] Applying limit of ${options.limit} to ${filteredGraphics.length} features`);
        // Sort by renderer field value in descending order
        filteredGraphics.sort((a, b) => {
            const aValue = a.attributes[rendererField];
            const bValue = b.attributes[rendererField];
            return bValue - aValue;
        });
        // Take only the top N features
        filteredGraphics = filteredGraphics.slice(0, options.limit);
        console.log(`[SingleLayerViz DEBUG] After limit: ${filteredGraphics.length} features`);
    }

    // --- 2. DBSCAN Clustering ---
    // Define populationLookup variable in the scope of the function
    let activePopulationLookup = populationLookup; // Use provided lookup first

    // <<< ADD Population Fetch Logic >>>
    // Fetch population data only if needed and not provided
    const requiresPopulationFilter = true; // Set this based on whether the subsequent filter logic is active
    if (requiresPopulationFilter && (!activePopulationLookup || activePopulationLookup.size === 0) && filteredGraphics.length > 0) {
      console.log("[SingleLayerViz DEBUG] Population lookup missing or empty. Fetching required population data...");
      try {
        const populationLayerUrl = "https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Vetements_layers/FeatureServer/8";
        const populationLayer = new FeatureLayer({ url: populationLayerUrl });
        
        // Extract IDs from the graphics that passed the initial filter
        const idsToFetch = [...new Set(filteredGraphics.map(g => g.attributes[identifierField]).filter(id => id != null).map(String))];
        
        if (idsToFetch.length > 0) {
          // Build the WHERE clause (handle potential large number of IDs by chunking if needed)
          // Simple version for now:
          const whereClause = `ID IN (${idsToFetch.map(id => `'${id.replace(/'/g, "''")}'`).join(',')})`; // Ensure IDs are properly quoted and escaped
          
          const populationQuery = populationLayer.createQuery();
          populationQuery.where = whereClause;
          populationQuery.outFields = ["ID", "TOTPOP_CY"];
          populationQuery.returnGeometry = false;
          populationQuery.num = 4000; // Use max record count from service info
          
          console.log(`[SingleLayerViz DEBUG] Querying population layer: ${idsToFetch.length} IDs`);
          const populationResults = await populationLayer.queryFeatures(populationQuery);
          
          // Create the lookup map
          const fetchedPopulationMap = new Map<string, number>();
          populationResults.features.forEach(feature => {
            const id = feature.attributes.ID;
            const pop = feature.attributes.TOTPOP_CY;
            if (id != null && typeof pop === 'number' && !isNaN(pop)) {
              fetchedPopulationMap.set(String(id), pop);
            }
          });
          
          activePopulationLookup = fetchedPopulationMap; // Use the fetched map
          console.log(`[SingleLayerViz DEBUG] Successfully fetched and created population lookup: ${activePopulationLookup.size} entries.`);
        } else {
           console.warn("[SingleLayerViz DEBUG] No valid IDs found in filtered graphics to fetch population for.");
        }
      } catch (fetchError) {
        console.error("[SingleLayerViz DEBUG] Error fetching population data:", fetchError);
        // Decide how to proceed: skip filtering, throw error, or continue without population?
        // For now, log warning and potentially skip population-dependent filtering.
        activePopulationLookup = new Map(); // Ensure it's an empty map
      }
    }
    // <<< END Population Fetch Logic >>>

    // Now use activePopulationLookup for filtering
    if (filteredGraphics.length > 0 && activePopulationLookup) { // Check activePopulationLookup
        console.log('[SingleLayerViz DEBUG] Starting DBSCAN clustering...');

        // --- Prepare points for DBSCAN --- 
        const pointsForDbscan: { point: number[]; graphicIndex: number }[] = [];
        const webMercatorSR = new SpatialReference({ wkid: 3857 });
        let requiresProjection = false;

        // Check spatial reference of the first geometry to decide on projection
        if (filteredGraphics[0]?.geometry?.spatialReference?.isGeographic) {
            console.log('[SingleLayerViz DEBUG] Geometries are geographic, will project to Web Mercator for DBSCAN.');
            requiresProjection = true;
            // Ensure projection module is loaded
            if (!projection.isLoaded()) {
                await projection.load();
            }
        }

        console.log('[SingleLayerViz DEBUG] Calculating label points for DBSCAN...');
        for (let i = 0; i < filteredGraphics.length; i++) {
            const graphic = filteredGraphics[i];
            let geometry = graphic.geometry;

            if (!geometry) {
                console.warn(`[SingleLayerViz DEBUG] Filtered graphic index ${i} missing geometry. Skipping.`);
                continue;
            }

            try {
                let targetGeometry: __esri.Geometry | null = geometry; // Specify type
                // Project geometry if necessary
                if (requiresProjection && geometry.spatialReference?.wkid !== 3857) {
                   const projectedResult = projection.project(geometry as any, webMercatorSR);
                   // Handle potential array result from projection
                   if (Array.isArray(projectedResult)) {
                      targetGeometry = projectedResult.length > 0 ? projectedResult[0] : null;
                   } else {
                      targetGeometry = projectedResult;
                   }
                   if (!targetGeometry) { // Check again after handling array
                       console.warn(`[SingleLayerViz DEBUG] Projection failed for graphic index ${i}. Skipping.`);
                       continue;
                   }
                }

                // Calculate label point (safer than centroid)
                // Ensure targetGeometry is not null before proceeding
                if (!targetGeometry) {
                    console.warn(`[SingleLayerViz DEBUG] Target geometry became null for index ${i} after potential projection. Skipping.`);
                    continue;
                }

                // Use labelPointOperator for calculation
                const labelPoint = labelPointOperator.execute(targetGeometry as __esri.Polygon);

                if (labelPoint) {
                    pointsForDbscan.push({ point: [labelPoint.x, labelPoint.y], graphicIndex: i });
                } else {
                    console.warn(`[SingleLayerViz DEBUG] Could not calculate label point for graphic index ${i}. Skipping.`);
                }
            } catch (pointError) {
                console.warn(`[SingleLayerViz DEBUG] Error calculating label point for graphic index ${i}:`, pointError, `Skipping.`);
            }
        }
        console.log(`[SingleLayerViz DEBUG] Prepared ${pointsForDbscan.length} points for DBSCAN.`);
        // --- End Point Preparation ---

        if (pointsForDbscan.length > 0) {
            // Run DBSCAN
            let eps = 5000; // Default eps (in meters if projected)
            if (mapView && mapView.extent) eps = mapView.extent.width * 0.01;
            // Adjust eps if projection happened and map extent is large/small
            if (requiresProjection) {
               // Example adjustment: clamp eps to a reasonable range like 1km to 50km
               eps = Math.max(1000, Math.min(50000, eps));
            }
            const minPoints = 5; // Minimum number of features to form a cluster
            console.log(`[SingleLayerViz DEBUG] Running DBSCAN with: eps=${eps.toFixed(2)}, minPoints=${minPoints} on ${pointsForDbscan.length} points (Projected: ${requiresProjection}).`);
            const dbscan = new DBSCAN();
            const dataset = pointsForDbscan.map(d => d.point);
            const clusters = dbscan.run(dataset, eps, minPoints);
            console.log(`[SingleLayerViz DEBUG] DBSCAN found ${clusters.length} clusters and ${dbscan.noise.length} noise points.`);

            // Process Clusters and Filter
            const clusteredGraphicsMap: { [clusterId: number]: Graphic[] } = {};
            clusters.forEach((clusterIndices, clusterId) => {
                 clusteredGraphicsMap[clusterId] = clusterIndices.map(centroidIndex => 
                    filteredGraphics[pointsForDbscan[centroidIndex].graphicIndex] // Get graphic using the stored index
                 );
            });

            const finalGraphicsFromClusters: Graphic[] = [];
            const minClusterSize = 5;
            const minClusterPopulation = 10000;

            for (const clusterId in clusteredGraphicsMap) {
                const cluster = clusteredGraphicsMap[clusterId];
                let clusterPopulation = 0;
                 cluster.forEach(graphic => {
                    const id = graphic.attributes[identifierField]; 
                    // <<< Use activePopulationLookup here >>>
                    if (id && activePopulationLookup && activePopulationLookup.has(String(id))) {
                        clusterPopulation += activePopulationLookup.get(String(id)) || 0;
                    }
                 });
                
                if (cluster.length >= minClusterSize && clusterPopulation >= minClusterPopulation) {
                    finalGraphicsFromClusters.push(...cluster);
                }
            }
            console.log(`[SingleLayerViz DEBUG] Clustering filter result: ${filteredGraphics.length} -> ${finalGraphicsFromClusters.length} features`);
            filteredGraphics = finalGraphicsFromClusters; // Update filteredGraphics

        } else {
            console.warn("[SingleLayerViz DEBUG] No valid points prepared for DBSCAN. Skipping clustering.");
            filteredGraphics = []; 
        }
    } else if (filteredGraphics.length > 0 && !populationLookup) {
        console.warn("[SingleLayerViz DEBUG] Population lookup not provided or required. Skipping clustering filter.");
    }
    // <<< END RE-ENABLE >>>

    // --- 3. Create Layer with Final Filtered Graphics ---
    // Use 'filteredGraphics' if filtering is applied, otherwise 'arcGisGraphics'
    const finalGraphics = filteredGraphics; // Assuming filtering is active, adjust if needed
    console.log(`[SingleLayerViz CHECK 2] Final graphics count for layer creation: ${finalGraphics.length}.`);
    if (finalGraphics.length === 0) {
        console.warn("[SingleLayerViz DEBUG] No features remaining after all filtering. Returning empty layer.");
        return { layer: null, extent: null };
    }

    const finalValues = finalGraphics
      .map(g => g.attributes[rendererField]) // <<< USE attributes
      .filter(v => typeof v === 'number' && !isNaN(v)) as number[];

    if (finalValues.length === 0) {
        console.warn("SingleLayerVisualization: No valid numeric data found for renderer field in final graphics:", rendererField);
        return { layer: null, extent: null };
    }

    console.log('[SingleLayerViz CREATE] Calling this.createFieldsFromSample...');
    // Pass an actual ArcGIS Graphic to createFieldsFromSample
    const sourceFields = this.createFieldsFromSample(finalGraphics[0]);
    // +++ LOG: Layer Fields +++
    console.log(`[SingleLayerViz LOG 3a] Fields definition for FeatureLayer:`, JSON.stringify(sourceFields.map(f => ({ name: f.name, type: f.type }))));
    // +++ END LOG +++

    console.log(`[SingleLayerViz DEBUG] Creating FeatureLayer instance.`);
    try {
      console.log('[SingleLayerViz CREATE] Instantiating FeatureLayer...');
      // --- Temporarily create layer without renderer ---
      const tempLayer = new FeatureLayer({
        source: finalGraphics, // <<< PASS final graphics
        objectIdField: "OBJECTID",
        fields: sourceFields,
        title: data.layerName || 'Filtered Layer',
        // renderer: this.renderer, // Remove initial renderer assignment
        geometryType: 'polygon',
        spatialReference: new SpatialReference({ wkid: 4326 }),
        popupEnabled: true,
        // Popup config logic remains, might need adjustment if default relies on renderer
        popupTemplate: options?.popupConfig
          ? createPopupTemplateFromConfig(options.popupConfig)
          : undefined // Handle default popup later if needed
      });
      this.layer = tempLayer; // Assign to class property
      // +++ LOG: Layer Source Count +++
      console.log(`[SingleLayerViz LOG 3b] FeatureLayer source count after creation: ${this.layer.source?.length}`);
      // +++ END LOG +++

      // --- ADD RENDERER CREATION HERE ---
      console.log('[SingleLayerViz CREATE STEP 4] Calling this.createRenderer...');
      // Now 'this.layer' is guaranteed to be a FeatureLayer instance
      // Pass the correct field name to createRenderer
      this.renderer = await this.createRenderer(this.layer, rendererField);
      // +++ LOG: Renderer Result +++
      console.log(`[SingleLayerViz LOG 4] Renderer creation result:`, this.renderer ? `Type: ${this.renderer.type}` : 'null');
      if (this.renderer && this.renderer.type === 'class-breaks') {
          console.log(`[SingleLayerViz LOG 4b] Class breaks count: ${(this.renderer as ClassBreaksRenderer).classBreakInfos?.length}`);
          // Log first break info color for verification
          const firstBreakInfo = (this.renderer as ClassBreaksRenderer).classBreakInfos?.[0];
          if (firstBreakInfo?.symbol?.color) {
             console.log(`[SingleLayerViz LOG 4c] First class break color: ${JSON.stringify(firstBreakInfo.symbol.color.toRgba())}`);
          }
      }
      // +++ END LOG +++

      // --- Assign the created renderer to the layer ---
      this.layer.renderer = this.renderer;

      // CRITICAL FIX: Store a reference to this visualization on the layer
      // This allows MapApp to find the visualization and get legend info
      this.layer.set('visualization', this);

      // --- Apply standardized popup template ---
      if (options?.popupConfig) {
        this.applyPopupTemplate(this.layer, options.popupConfig);
      } else {
        // Use standardized popup with single-layer fields
        const popupFields = this.getPopupFields('single-layer');
        this.applyStandardizedPopup(
          this.layer,
          popupFields.barChartFields,
          popupFields.listFields,
          'single-layer'
        );
      }
      // --- END RENDERER CREATION ---

      console.log('[SingleLayerViz CREATE] FeatureLayer instantiated and configured:', {
        layerId: this.layer.id,
        title: this.layer.title,
        sourceCount: this.layer.source?.length, // Source is now Graphic[]
        rendererType: this.layer.renderer?.type
      });
    } catch (layerError) {
       console.error('[SingleLayerViz CREATE] Error instantiating FeatureLayer:', layerError);
       return { layer: null, extent: null };
    }

    console.log('[SingleLayerViz CREATE] Calculating extent...');
    let calculatedExtent: __esri.Extent | null = null;
    try {
      // Extent calculation already uses filteredGraphics (ArcGIS Graphics)
      const geometriesToUnion = finalGraphics.map(g => g.geometry).filter(g => g != null) as any[];
      if (geometriesToUnion.length > 0) {
          calculatedExtent = (await geometryEngineAsync.union(geometriesToUnion))?.extent || null;
      } else {
          calculatedExtent = null;
      }
      this.extent = calculatedExtent;
      console.log('[SingleLayerViz CREATE] Extent calculated:', this.extent ? 'Valid Extent' : 'Null Extent');
    } catch (extentError) {
      console.error('[SingleLayerViz CREATE] Error calculating extent:', extentError);
      this.extent = null;
    }

    // +++ LOG: Final Renderer Check +++
    console.log(`[SingleLayerViz LOG 5] Final assigned renderer type: ${this.layer?.renderer?.type}`);
    if (this.layer?.renderer?.type === 'class-breaks') {
        console.log(`[SingleLayerViz LOG 5b] Final Class breaks: ${JSON.stringify((this.layer.renderer as ClassBreaksRenderer).classBreakInfos?.map(info => ({ label: info.label, color: info.symbol?.color?.toHex()})))}`);
    }
    // +++ END LOG +++

    console.log('[SingleLayerViz CREATE] Returning result:', {
        hasLayer: !!this.layer,
        layerId: this.layer?.id,
        hasExtent: !!this.extent
    });

    return {
        layer: this.layer,
        extent: this.extent,
        renderer: this.renderer,
        legendInfo: this.getLegendInfo()
    };
  }

  // Helper to find the best field if not provided
  private findBestRendererField(graphics: Graphic[]): string | null {
    // Implementation of findBestRendererField method
    // This is a placeholder and should be implemented based on your specific requirements
    // <<< ADD LOGGING >>>
    console.log('[SingleLayerViz DEBUG] findBestRendererField called (Placeholder - returns null)');
    return null; // Placeholder return, actual implementation needed
  }

  private calculatePercentile(values: number[], percentile: number): number {
    // <<< REMOVE LOGGING >>>
    // console.log('[SingleLayerViz DEBUG] calculatePercentile called (Placeholder - returns 0)');
    
    // --- Correct Percentile Calculation --- 
    if (!values || values.length === 0) {
      console.warn('[calculatePercentile] Input array is empty.');
      return 0; // Or potentially NaN or throw error
    }
    
    // Ensure percentile is between 0 and 100
    const validPercentile = Math.max(0, Math.min(100, percentile));
    
    // Sort the array in ascending order
    const sortedValues = [...values].sort((a, b) => a - b);
    
    // Calculate the index (rank)
    // Using the NIST method (R-7): (N-1) * p/100 + 1, then linear interpolation
    const n = sortedValues.length;
    if (n === 1) {
        return sortedValues[0]; // Only one value
    }
    
    const index = (validPercentile / 100) * (n - 1); // 0-based index
    const lowerIndex = Math.floor(index);
    const upperIndex = Math.ceil(index);
    const weight = index - lowerIndex;

    // Handle boundary cases for index
    if (upperIndex >= n) {
        return sortedValues[n - 1]; // Return max value if percentile is 100 or index calculation goes slightly over
    }
    if (lowerIndex < 0) {
        return sortedValues[0]; // Should not happen with validPercentile, but safety check
    }

    // Linear interpolation between the two closest ranks
    if (lowerIndex === upperIndex) {
        return sortedValues[lowerIndex];
    } else {
        return sortedValues[lowerIndex] * (1 - weight) + sortedValues[upperIndex] * weight;
    }
    // --- End Correct Percentile Calculation ---
    
    // return 0; // Old placeholder return
  }

  // Updated createRenderer to accept the FeatureLayer instance and field
  protected async createRenderer(layer: FeatureLayer, field: string): Promise<SimpleRenderer | ClassBreaksRenderer> {
    // +++ LOG: Entering createRenderer +++
    console.log(`[SingleLayerViz.createRenderer LOG A] ENTERING for field: '${field}'`);
    // +++ END LOG +++

    console.log(`[SingleLayerVisualization.createRenderer] Calling external createQuartileRenderer for field: ${field}`);
    // +++ LOG: Config passed to createQuartileRenderer +++
    const configForQuartile = {
        layer: layer,
        field: field,
        // Explicitly pass the RED-to-GREEN color stops
        colorStops: [
          [239, 59, 44],    // red
          [255, 127, 0],    // orange
          [158, 215, 152],  // light green
          [49, 163, 84]     // green
        ] as ColorStop[],
        opacity: this.options.opacity || 0.8, // Pass opacity from options
    };
    console.log(`[SingleLayerViz.createRenderer LOG B] Config being passed to createQuartileRenderer:`, { field: configForQuartile.field, colorStops: configForQuartile.colorStops, opacity: configForQuartile.opacity, layerId: configForQuartile.layer?.id });
    // +++ END LOG +++

    try {
      const rendererResult = await createQuartileRenderer(configForQuartile);
      // +++ LOG: Result from createQuartileRenderer +++
      console.log(`[SingleLayerViz.createRenderer LOG C] Result from createQuartileRenderer:`, rendererResult ? `Type: ${rendererResult.renderer?.type}` : 'null');
      if (rendererResult?.renderer?.type === 'class-breaks') {
         console.log(`[SingleLayerViz.createRenderer LOG D] Breaks received: ${JSON.stringify((rendererResult.renderer as ClassBreaksRenderer).classBreakInfos?.map(info => ({ label: info.label, color: info.symbol?.color?.toHex()})))}`);
      }
      // +++ END LOG +++


      if (rendererResult && rendererResult.renderer) {
        console.log('[SingleLayerVisualization.createRenderer] Successfully created renderer using external function.');
        // Ensure the returned renderer is either ClassBreaksRenderer or SimpleRenderer
        if ((rendererResult.renderer as any) instanceof ClassBreaksRenderer || (rendererResult.renderer as any) instanceof SimpleRenderer) {
            // +++ LOG: Returning valid renderer +++
            console.log(`[SingleLayerViz.createRenderer LOG E] Returning valid renderer of type: ${rendererResult.renderer.type}`);
            // +++ END LOG +++
            return rendererResult.renderer;
        } else {
            console.warn('[SingleLayerVisualization.createRenderer] External function returned unexpected renderer type. Falling back to simple.');
            // Fallback if type is wrong (shouldn't happen with ClassBreaksRenderer)
            return new SimpleRenderer({
                symbol: new SimpleFillSymbol({
                    color: [150, 150, 150, 0.6],
                    outline: { color: [0, 0, 0, 0], width: 0 }
                })
            });
        }
      } else {
        console.warn('[SingleLayerVisualization.createRenderer] createQuartileRenderer returned null or no renderer. Falling back to simple.');
        return new SimpleRenderer({
            symbol: new SimpleFillSymbol({
                color: [150, 150, 150, 0.6],
                outline: { color: [0, 0, 0, 0], width: 0 }
            })
        });
      }
    } catch (error) {
      console.error('[SingleLayerVisualization.createRenderer] Error calling createQuartileRenderer:', error);
      // Fallback to a simple error renderer
      return new SimpleRenderer({
        symbol: new SimpleFillSymbol({
            color: [255, 0, 0, 0.5], // Red error color
            outline: { color: [0, 0, 0, 0], width: 0 }
        })
      });
    }
  }

  // Override the base class method to maintain compatibility
  getRenderer(): __esri.Renderer | null {
    return this.renderer;
  }

  getLegendInfo(): StandardizedLegendData {
    // Use standardized field mapping for legend title
    const rendererField = this.data?.rendererField || 'value';
    const friendlyFieldName = FieldMappingHelper.getFriendlyFieldName(rendererField);
    const title = this.data?.layerName || `${friendlyFieldName} Distribution`;
    
    // Use base class method for consistent legend generation, but ensure proper structure
    const baseLegend = this.convertRendererToLegendData(
      title,
      'class-breaks',
      `Distribution of ${friendlyFieldName} across features`
    );
    
    // Ensure all legend items have the required properties for MapLegend compatibility
    const itemsWithRequiredProps = baseLegend.items?.map(item => ({
      label: item.label,
      color: item.color,
      outlineColor: item.outlineColor || '#666666',
        shape: 'square' as const,
      size: 16
    }));

    return {
      ...baseLegend,
      items: itemsWithRequiredProps
    };
  }

  /**
   * Process microservice response into visualization data
   * @param response The response from the microservice
   * @returns Processed data ready for visualization
   * @throws Error if response is invalid or malformed
   */
  protected processMicroserviceResponse(response: any): SingleLayerData {
    // Check if response is a microservice error
    if (isMicroserviceError(response)) {
      throw new Error(`Microservice error: ${response.error} (${response.error_type})`);
    }

    // Validate response structure
    if (!isValidMicroserviceResponse(response)) {
      throw new Error('Invalid microservice response format');
    }

    // Convert response to visualization data
    const data = convertToVisualizationData(response);

    // Assume response.inputRecords is an array of objects with all fields, including ID, in the same order as predictions
    const inputRecords = (response as any).inputRecords || (response as any).records || (response as any).data || [];

    // Create features array from predictions and SHAP values
    const features = data.predictions.map((prediction, index) => {
      const record = inputRecords[index] || {};
      return {
        attributes: {
          ID: record.ID, // <-- Add ID from the microservice data
          OBJECTID: index + 1,
          thematic_value: prediction,
          // Add SHAP values as additional attributes
          ...Object.fromEntries(
            data.featureNames.map((name, i) => [
              `shap_${name}`,
              data.shapValues[index]?.[i] || 0
            ])
          ),
          ...record // Optionally include all other fields from the record
        }
      };
    });

    return {
      features,
      layerName: `Prediction Results (${data.modelType})`,
      rendererField: 'thematic_value',
      layerConfig: {
        fields: [
          { name: 'OBJECTID', type: 'oid' as FieldType },
          { name: 'thematic_value', type: 'double' as FieldType },
          ...data.featureNames.map(name => ({
            name: `shap_${name}`,
            type: 'double' as FieldType
          })),
          { name: 'ID', type: 'string' as FieldType },
        ]
      }
    };
  }

  /**
   * Create visualization from microservice response
   * @param response The response from the microservice
   * @param options Visualization options
   */
  async createFromMicroservice(
    response: any,
    options?: SingleLayerOptions & { popupConfig?: PopupConfiguration }
  ): Promise<VisualizationResult> {
    try {
      // Process microservice response
      const data = this.processMicroserviceResponse(response);
      
      // Create visualization using processed data
      return this.create(data, options);
    } catch (error) {
      console.error('[SingleLayerViz] Error processing microservice response:', error);
      return { layer: null, extent: null };
    }
  }
} 

// Provide default export for compatibility with dynamic imports that expect default.
export default SingleLayerVisualization; 