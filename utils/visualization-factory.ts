/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prefer-const */
/* eslint-disable no-case-declarations */
// OBSOLETE: TrendsCorrelationVisualization import removed
import { VisualizationType, VisualizationConfig } from '@/types/visualization';
import {
  VisualizationResult
} from './visualizations/base-visualization';
import { createPopupTemplateFromConfig } from './popup-utils';
import { PopupConfiguration } from '@/types/popup-config';
// import PopupTemplate from "@arcgis/core/PopupTemplate";
import { Renderer } from '@arcgis/core/renderers';
import { VisualizationIntegration } from './visualization-integration';
import { AdvancedVisualizations } from './visualizations/advanced-visualizations';
import { AnalysisResult, EnhancedAnalysisResult } from '@/types/analysis';
import { RankingVisualization } from './visualizations/ranking-visualization';
import { createGeometry } from '@/utils/geometry';
import { FIELD_ALIASES } from './field-aliases';
import { CorrelationData } from './visualizations/correlation-visualization';
import { FieldMappingHelper } from './visualizations/field-mapping-helper';
import PopupTemplate from '@arcgis/core/PopupTemplate';

// Add FieldType type at the top of the file
type FieldType = "string" | "oid" | "small-integer" | "integer" | "single" | "double" | "long" | "date" | "big-integer" | "date-only" | "time-only" | "timestamp-offset" | "geometry" | "blob" | "raster" | "guid" | "global-id" | "xml";




export interface LocalLayerResult {
  layer: {
    id: string;
    name: string;
    type: string;
    rendererField?: string;
    visualizationMode?: string;
    fields?: Array<{
      name: string;
      type: string;
      label?: string;
    }>;
  };
  features: any[];
}

interface LayerFeatures {
  layerId: string;
  features: any[];
}

interface QueryContext {
  query: string;
  layers: any[];
}

export interface VisualizationOptions {
  limit?: number;
  primaryField?: string;
  comparisonField?: string;
  query?: string;
  title?: string;
  geometryType?: string;
  spatialReference?: { wkid: number };
  visualizationMode?: string;
  joinField?: string;
  popupConfig?: PopupConfiguration;
  shapData?: any; // SHAP analysis data for advanced visualizations
  rendererField?: string;
}

export interface LayerConfig {
  name: string;
  fields: { name: string; type: FieldType; }[];
  geometryType?: string;
  hasZ?: boolean;
  hasM?: boolean;
  rendererField?: string;
}



export function determineVisualizationType(
  query: string,
  relevantLayers: LayerFeatures[]): VisualizationType {
  // Check for correlation queries (removed brand-specific limitation)
  const isCorrelationQuery = query.toLowerCase().includes('correlation') ||
    query.toLowerCase().includes('relationship') ||
    query.toLowerCase().includes('compare') ||
    /\b(vs|versus|against|between)\b/.test(query.toLowerCase());

  if (isCorrelationQuery) {
    // Only check for cross-geography if it's a correlation query
    const isCrossGeoQuery = (
      query.toLowerCase().includes('cross-geo') ||
      query.toLowerCase().includes('cross geo') ||
      query.toLowerCase().includes('across regions') ||
      query.toLowerCase().includes('across areas') ||
      query.toLowerCase().includes('between regions') ||
      query.toLowerCase().includes('between areas')
    ) && (
      query.toLowerCase().includes('province') ||
      query.toLowerCase().includes('city') ||
      query.toLowerCase().includes('region') ||
      query.toLowerCase().includes('district') ||
      query.toLowerCase().includes('municipal') ||
      query.toLowerCase().includes('census')
    );

    if (isCrossGeoQuery) {
      return 'correlation';
    }
    return 'correlation';
  }

  // Check for distribution queries
  const isDistributionQuery = query.toLowerCase().includes('distribution') ||
    query.toLowerCase().includes('spread') ||
    query.toLowerCase().includes('range') ||
    query.toLowerCase().includes('variation');

  if (isDistributionQuery) {
    return 'distribution';
  }

  // Check for highlight queries
  if (query.toLowerCase().includes('highlight') ||
      query.toLowerCase().includes('show') ||
      query.toLowerCase().includes('display')) {
    return 'default';
  }

  // Default to default for demographic data
  const hasDemographicData = relevantLayers.some(layer => 
    layer.layerId.startsWith('virtual')
  );

  if (hasDemographicData) {
    return 'default';
  }

  return 'default';
}

export interface VisualizationFactoryOptions {
  analysisResult: AnalysisResult;
  enhancedAnalysis: EnhancedAnalysisResult;
  features: { features: any[] };
  useAdvancedVisualization?: boolean;
  advancedOptions?: {
    field?: string;
    targetField?: string;
  };
}

export class VisualizationFactory {
  private visualizationIntegration: VisualizationIntegration;
  private useAdvancedVisualization: boolean;
  private advancedOptions: VisualizationFactoryOptions['advancedOptions'];
  constructor(options: VisualizationFactoryOptions) {
    this.visualizationIntegration = new VisualizationIntegration({
      analysisResult: options.analysisResult,
      enhancedAnalysis: options.enhancedAnalysis,
      features: options.features
    });
    this.useAdvancedVisualization = options.useAdvancedVisualization || false;
    this.advancedOptions = options.advancedOptions;
  }

  private getNumericValue(value: any): number {
    if (typeof value === 'number' && !isNaN(value)) {
      return value;
    }

    if (typeof value === 'string') {
      // Remove any commas and percentage signs
      const cleanValue = value.replace(/,|%/g, '');
      const parsed = parseFloat(cleanValue);
      if (!isNaN(parsed)) {
        // If it was a percentage, divide by 100
        return value.includes('%') ? parsed / 100 : parsed;
      }
    }

    // Log unhandled value types for debugging
   /* console.log('[VisualizationFactory DEBUG] Unable to parse numeric value:', {
      value,
      type: typeof value,
      isNull: value === null,
      isUndefined: value === undefined
    });*/

    return 0; // Default to 0 if parsing fails
  }

  public async createVisualization(
    layerResults: any[],
    options: VisualizationOptions
  ): Promise<VisualizationResult> {
    console.log('🎯🎯🎯 [VisualizationFactory] createVisualization called with:', {
      layerCount: layerResults?.length,
      query: options?.query,
      visualizationMode: options?.visualizationMode,
      analysisType: (this.visualizationIntegration?.analysisResult as any)?.type,
      hasAnalysisResult: !!this.visualizationIntegration?.analysisResult
    });
    
    // Note: Enhanced styling will be applied after layer is created to preserve popup functionality
    const { visualizationMode } = options;
    
   /* console.log(`[VisualizationFactory DEBUG] Creating visualization with mode: ${visualizationMode}`, {
      layerCount: layerResults.length,
      options,
      firstLayer: layerResults[0] ? {
        layerId: layerResults[0].layerId,
        layerName: layerResults[0].layerName,
        layerType: layerResults[0].layerType,
        featureCount: layerResults[0].features?.length,
        hasLayer: !!layerResults[0].layer,
        hasFeatures: !!layerResults[0].features,
        firstFeature: layerResults[0].features?.[0] ? {
          hasGeometry: !!layerResults[0].features[0].geometry,
          properties: Object.keys(layerResults[0].features[0].properties || {})
        } : null
      } : null
    });*/
    
    if (!layerResults || layerResults.length === 0) {
      throw new Error("No layer data provided for visualization.");
    }
    
    // Transform layerResults to the expected LocalLayerResult format
    const localLayerResults: LocalLayerResult[] = layerResults.map(lr => ({
      layer: {
        id: lr.layerId,
        name: lr.layerName,
        type: lr.layerType || 'polygon', // default to polygon
        fields: lr.fields || []
      },
      features: lr.features
    }));

    try {
      const vizType = visualizationMode || this.determineVisualizationType(localLayerResults, options);
      let result: VisualizationResult | null = null;

      switch (vizType) {
      case 'correlation':
          result = await this.createCorrelationVisualization(localLayerResults, options);
          break;
        
        case 'joint-high': {
          const { JointHighVisualization } = await import('./visualizations/joint-high-visualization');
          const jointViz = new JointHighVisualization();
          
          // Get the primary layer and its configuration
          const primaryLayer = localLayerResults[0];
          if (!primaryLayer || !primaryLayer.layer) {
            console.error('[VisualizationFactory DEBUG] Missing primary layer or layer configuration');
            return { layer: null, extent: null };
          }

          const layerConfig = primaryLayer.layer;
        //  console.log('[VisualizationFactory DEBUG] Using layer config:', layerConfig);

          // === NEW: Build GeoJSON-like features with explicit `properties` ===
          const featuresForViz = primaryLayer.features.map((feature: any) => {
            if (!feature) return null;

            // Convert geometry (if necessary) to an ArcGIS-compatible structure
            const arcGeom = createGeometry(
              feature.properties?._originalEsriGeometry || feature.geometry
            );

            // Fall back to original geometry if conversion failed
            const finalGeom = arcGeom || feature.geometry;

            return {
              type: 'Feature',
              geometry: finalGeom,
              properties: {
                ...(feature.properties || {}),
                ...(feature.attributes || {}),
                // Ensure we have a stable OBJECTID for renderer
                OBJECTID:
                  feature.properties?.OBJECTID ||
                  feature.attributes?.OBJECTID ||
                  feature.properties?.ID ||
                  feature.attributes?.ID ||
                  undefined
              }
            };
          }).filter((f: any) => f !== null);

         /* console.log('[VisualizationFactory DEBUG] Prepared features for Joint-High:', {
            originalCount: primaryLayer.features.length,
            preparedCount: featuresForViz.length,
            sampleFeature: featuresForViz[0]
          });*/

          // Collect numeric fields across first N features to avoid missing sparsely populated columns
          const numericFieldSet = new Set<string>();
          const SAMPLE_COUNT = Math.min(50, featuresForViz.length);
          for (let i = 0; i < SAMPLE_COUNT; i++) {
            const props = featuresForViz[i]?.properties;
            if (!props) continue;
            for (const [key, val] of Object.entries(props)) {
              if (val === null || val === undefined) continue;
              if (typeof val === 'number' && !isNaN(val)) {
                numericFieldSet.add(key);
              } else if (typeof val === 'string') {
                const num = parseFloat(val);
                if (!isNaN(num)) numericFieldSet.add(key);
              }
            }
          }
          const numericFields = Array.from(numericFieldSet);

         //  console.log('[VizFactory DEBUG] featuresForViz sample:', featuresForViz.slice(0, 5).map((f: { properties: any } | null) => f?.properties));

          // === FIELD SELECTION FOR JOINT-HIGH (data-driven) ===
          const placeholderFields = ['thematic_value', 'joint_score', 'combined_score'];

          // Helper to normalise keys (remove underscores/spaces and lower-case)
          const normalise = (s: string) => s.replace(/[\s_\-]+/g, '').toLowerCase();

          // Helper to convert CamelCase to snake_case then lower-case

          const { enhancedAnalysis } = this.visualizationIntegration;
          const relevantFields = enhancedAnalysis?.relevantFields || [];
        //  console.log('[VisualizationFactory DEBUG] Relevant fields for correlation:', relevantFields);
          const primaryField = relevantFields[0] || options.primaryField || layerConfig.rendererField || 'thematic_value';
          const comparisonField = relevantFields[1] || relevantFields[0] || 'thematic_value';

          // Build ordered unique list (target first, then relevant fields)
          const orderedCandidates = Array.from(new Set([primaryField, comparisonField].filter(Boolean))) as string[];

          // Build a map of normalised numeric field keys that actually exist in the data → original key
          const numericFieldLookup: Record<string, string> = {};
          numericFields.forEach((key) => {
            const norm = normalise(key);
            if (!(norm in numericFieldLookup)) numericFieldLookup[norm] = key;
          });

          // ----- ENSURE BRAND FIELDS PRESENT ---------------------------------
          // Some brand columns are sparse and may not appear in first SAMPLE_COUNT rows.
          // Force-add the two orderedCandidates (canonical + snake_case) to numericFieldLookup
          const ensureCandidateFields = (candidates: string[]) => {
            candidates.forEach(cand => {
              if (!cand) return;
              const variants = [cand, cand.toLowerCase().replace(/a_b$/, '_a_b')];
              variants.forEach(variant => {
                const norm = normalise(variant);
                if (!(norm in numericFieldLookup)) {
                  numericFieldLookup[norm] = variant;
                  if (!numericFields.includes(variant)) numericFields.push(variant);
                }
              });
            });
          };

          ensureCandidateFields(orderedCandidates);

          // Given a candidate (canonical) name, attempt to find matching actual property key in data
          const resolveCandidate = (candidate?: string): string | undefined => {
            if (!candidate) return undefined;
            if (placeholderFields.includes(candidate)) return undefined;

            // Build list: canonical + any alias keys that map to the same canonical
            const equivalents: string[] = [candidate];
            Object.entries(FIELD_ALIASES).forEach(([aliasKey, canonicalVal]) => {
              if (canonicalVal === candidate && !equivalents.includes(aliasKey)) {
                equivalents.push(aliasKey);
              }
            });

            // Try each equivalent against the lookup
            for (const key of equivalents) {
              const norm = normalise(key);
              const match = numericFieldLookup[norm];
              if (match) return match;
            }
            return undefined;
          };

          const primaryFieldResolved = orderedCandidates.map(resolveCandidate).find(Boolean);
          const comparisonFieldResolved = orderedCandidates
            .map(resolveCandidate)
            .find((f) => f && f !== primaryFieldResolved);

          // Enhanced debugging to understand the mismatch
         /* console.log('[VisualizationFactory DEBUG] Field resolution details:', {
            orderedCandidates,
            numericFieldsSample: numericFields.slice(0, 20),
            numericFieldLookup: Object.fromEntries(Object.entries(numericFieldLookup).slice(0, 10)),
            candidateResolutions: orderedCandidates.map(c => ({
              candidate: c,
              resolved: resolveCandidate(c),
              equivalents: [c, ...Object.entries(FIELD_ALIASES).filter(([_, v]) => v === c).map(([k]) => k)],
              normalised: c ? normalise(c) : null
            })),
            primaryField: primaryFieldResolved,
            comparisonField: comparisonFieldResolved
          });*/

          if (!primaryFieldResolved || !comparisonFieldResolved) {
            // Check if this is actually a ranking query that was misclassified as joint-high
          /*  console.log('[VisualizationFactory] Checking if this is a misclassified ranking query:', {
              primaryField: !!primaryFieldResolved,
              comparisonField: !!comparisonFieldResolved,
              query: options.query,
              isTopNQuery: isTopNQuery(options.query || '')
            });*/
            
            if (primaryFieldResolved && !comparisonFieldResolved && isTopNQuery(options.query || '')) {
            //  console.log('[VisualizationFactory] Detected ranking query misclassified as joint-high, redirecting to ranking visualization');
              // Redirect to ranking visualization
              const { limit } = this.extractTopNLimit(options.query || '');
              const updatedOptions = {
                ...options,
                limit
              };
              return await this.createRankingVisualization(localLayerResults, updatedOptions);
            }
            
            // Check if this is a data join failure (analysis results missing from geographic features)
            const hasAnalysisFields = numericFields.some(field => {
              const norm = normalise(field);
              return !['objectid', 'fid', 'creationdate', 'editdate', 'dguid', 'pruid', 'landarea', 'count'].some(pattern => norm.includes(pattern));
            });
            
            if (!hasAnalysisFields) {
              console.error('[VisualizationFactory] Analysis fields missing from joined data. This suggests the microservice results failed to join with geographic features.');
              throw new Error(`Unable to create visualization: The requested fields (${orderedCandidates.join(', ')}) are not available in the analysis results. This may indicate a data processing issue.`);
            }
            
            console.error('[VisualizationFactory] Unable to map analysis fields to available data:', {
              requestedFields: orderedCandidates,
              availableNumericFields: numericFields.slice(0, 10),
              primaryFieldResolved: !!primaryFieldResolved,
              comparisonFieldResolved: !!comparisonFieldResolved
            });
            throw new Error(`Unable to create visualization: Could not find the requested analysis fields (${orderedCandidates.join(', ')}) in the processed data.`);
          }

         // console.log('[VisualizationFactory DEBUG] Joint-High metrics selected', { primaryField: primaryFieldResolved, comparisonField: comparisonFieldResolved });

          result = await jointViz.create(
            {
              features: featuresForViz,
              layerName: layerConfig.name,
              metrics: [primaryFieldResolved, comparisonFieldResolved],
              rendererField: 'combined_score'
            } as any,
            {
              ...options,
              title: `Joint High Analysis: ${primaryFieldResolved} & ${comparisonFieldResolved}`
            }
          );
        break;
        }
        
        case 'trends-correlation':
          result = await this.createTrendsCorrelationVisualization(localLayerResults, options);
          break;
        
        case 'trends':
          result = await this.createTrendsVisualization(localLayerResults, options);
          break;

              case 'multivariate':
        result = await this.createMultivariateVisualization(localLayerResults, options);
        break;
      case 'bivariate':
        // For now, fall back to correlation until bivariate is fully implemented
        result = await this.createDefaultCorrelationVisualization(localLayerResults, options);
        break;
      case 'hotspot':
        // For now, fall back to single layer until hotspot is fully implemented
        result = await this.createSingleLayerVisualization(localLayerResults, options);
        break;

        case 'factor-importance': {
          result = await this.createFactorImportanceVisualization(localLayerResults, options);
          break;
        }

        case 'ranking': {
          const { limit } = this.extractTopNLimit(options.query || '');
          const updatedOptions = {
            ...options,
            limit
          };
          result = await this.createRankingVisualization(localLayerResults, updatedOptions);
        break;
        }

        case 'difference': {
          console.log('🔥 [VisualizationFactory DEBUG] ENTERED DIFFERENCE CASE');
          
          // CRITICAL FIX: For brand-difference, ensure we use fresh processed data, not cached layer data
          const analysisResult = this.visualizationIntegration?.analysisResult as any;
          console.log('🔥 [VisualizationFactory DEBUG] analysisResult:', {
            type: analysisResult?.type,
            hasRenderer: !!analysisResult?.renderer,
            hasLegend: !!analysisResult?.legend,
            hasBrandAnalysis: !!analysisResult?.brandAnalysis
          });
          
          // If this is a brand_difference analysis, force fresh data processing
          if (analysisResult?.type === 'brand_difference') {
            console.log('🎯 [VisualizationFactory] BRAND DIFFERENCE: Using fresh analysis data instead of cached layers');
            
            // Check if processor already provided renderer and legend
            if (analysisResult?.renderer && analysisResult?.legend) {
              console.log('[VisualizationFactory] Using pre-built renderer from BrandDifferenceProcessor');
              result = {
                layer: null, // Will be set by the renderer
                extent: null,
                renderer: analysisResult.renderer
              } as any;
              break;
            }
            
            console.log('🎯 [VisualizationFactory] Creating fresh brand difference visualization from analysis data');
            
            // Use analysis records instead of cached layer features
            if (analysisResult?.records && analysisResult.records.length > 0) {
              // Convert analysis records to features format expected by DifferenceVisualization
              const freshFeatures = analysisResult.records.map((record: any, index: number) => ({
                properties: {
                  ...record.properties,
                  area_id: record.area_id,
                  area_name: record.area_name,
                  value: record.value,
                  brand_difference_score: record.brand_difference_score || record.value
                },
                geometry: record.geometry || { type: 'Point', coordinates: record.coordinates || [0, 0] }
              }));
              
              // Get brand fields from the analysis
              const brandFields = analysisResult.brandAnalysis?.relevantFields || [];
              if (brandFields.length >= 2) {
                console.log('🎯 [VisualizationFactory] Using brand fields from analysis:', brandFields);
                
                const { DifferenceVisualization } = await import('./visualizations/difference-visualization');
                const differenceViz = new DifferenceVisualization();
                
                // Create a mock layer result with fresh data
                const freshLayerResult = {
                  layer: { name: 'Brand Difference Analysis', id: 'brand-difference-fresh' },
                  features: freshFeatures
                };
                
                result = await differenceViz.create({
                  features: freshFeatures,
                  layerName: 'Brand Difference Analysis',
                  layerConfig: { 
                    name: 'Brand Difference Analysis',
                    fields: [
                      { name: 'brand_difference_score', type: 'double' },
                      { name: brandFields[0], type: 'double' },
                      { name: brandFields[1], type: 'double' }
                    ]
                  },
                  rendererField: 'brand_difference_score',
                  primaryField: brandFields[0],
                  secondaryField: brandFields[1],
                  primaryLabel: this.getBrandNameFromField(brandFields[0]),
                  secondaryLabel: this.getBrandNameFromField(brandFields[1]),
                  differenceField: 'brand_difference_score',
                  unitType: 'percentage'
                });
                
                console.log('🎯 [VisualizationFactory] Fresh brand difference visualization created');
                break;
              }
            }
            
            console.log('⚠️ [VisualizationFactory] Could not create fresh brand difference visualization, falling back to normal flow');
          }
          
          const { DifferenceVisualization } = await import('./visualizations/difference-visualization');
          const differenceViz = new DifferenceVisualization();
          
          // Get the relevant fields for the difference analysis
          const { enhancedAnalysis } = this.visualizationIntegration;
          // For brand difference, check multiple places for relevant fields
          let relevantFields = [];
          
          // First check if this is a brand_difference analysis result
          // Use the same analysisResult variable instead of redeclaring
          if (analysisResult?.type === 'brand_difference') {
            relevantFields = analysisResult.brandAnalysis?.relevantFields || [];
            console.log('[VisualizationFactory] Found brand_difference analysis with fields:', relevantFields);
          }
          
          // Fallback to other sources
          if (!relevantFields || relevantFields.length === 0) {
            const enhancedAnalysisAny = enhancedAnalysis as any;
            relevantFields = enhancedAnalysisAny?.brandAnalysis?.relevantFields || 
                           enhancedAnalysisAny?.relevantFields || 
                           [];
          }
          
          console.log('[VisualizationFactory] Difference visualization debug:', {
            relevantFields,
            brandAnalysis: (enhancedAnalysis as any)?.brandAnalysis,
            enhancedAnalysisType: (enhancedAnalysis as any)?.type,
            analysisResultType: (this.visualizationIntegration?.analysisResult as any)?.type,
            hasAnalysisResult: !!this.visualizationIntegration?.analysisResult,
            optionsPrimaryField: options.primaryField,
            fallbackWouldBeUsed: !relevantFields[0] && !options.primaryField
          });
          
          // CRITICAL FIX: Don't default to Nike/Adidas - require fields from analysis
          if (!relevantFields || relevantFields.length < 2) {
            console.error('[VisualizationFactory] Difference visualization requires 2 fields from analysis, got:', relevantFields);
            throw new Error(`Difference visualization requires 2 brand fields from analysis. Got: ${relevantFields?.length || 0} fields. Please specify brands in your query.`);
          }
          
          const primaryField = relevantFields[0] || options.primaryField;
          const secondaryField = relevantFields[1];
          
          if (!primaryField || !secondaryField) {
            throw new Error('Could not determine brand fields for difference visualization. Please specify two brands in your query.');
          }
          
          console.log('[VisualizationFactory] Using fields for difference:', {
            relevantFields,
            primaryField,
            secondaryField,
            optionsPrimaryField: options.primaryField,
            enhancedAnalysisFields: enhancedAnalysis?.relevantFields
          });
          
          // Prepare features with proper structure for DifferenceVisualization
          const primaryLayer = localLayerResults[0];
          
          // Debug: Check what fields are actually available in the data
          if (primaryLayer.features && primaryLayer.features.length > 0) {
            const sampleFeature = primaryLayer.features[0];
            const availableFields = Object.keys(sampleFeature.properties || sampleFeature.attributes || {});
            console.log('[VisualizationFactory] Available fields in features:', {
              availableFields: availableFields.filter(f => f.includes('MP30')),
              primaryFieldExists: availableFields.includes(primaryField),
              secondaryFieldExists: availableFields.includes(secondaryField),
              sampleData: availableFields.reduce((acc, field) => {
                if (field.includes('MP30')) {
                  acc[field] = (sampleFeature.properties || sampleFeature.attributes || {})[field];
                }
                return acc;
              }, {} as any)
            });
          }
          
          // Debug the first few features to see what data we have
          /*  console.log('[VisualizationFactory DEBUG] Sample features:', {
            featureCount: primaryLayer.features?.length,
            firstFeature: primaryLayer.features?.[0] ? {
              properties: Object.keys(primaryLayer.features[0].properties || {}),
              attributes: Object.keys(primaryLayer.features[0].attributes || {}),
              geometry: !!primaryLayer.features[0].geometry,
              sampleProps: primaryLayer.features[0].properties,
              sampleAttrs: primaryLayer.features[0].attributes
            } : null
          });*/
          
          const featuresForViz = primaryLayer.features
            .map((feature: any, index: number) => {
              if (!feature) return null;
              
              const props = feature.properties || feature.attributes || {};
              // Try multiple field name formats since field names might have different cases or prefixes
              const primaryValue = this.getNumericValue(props[primaryField]) || 
                                 this.getNumericValue(props[`value_${primaryField}`]) ||
                                 this.getNumericValue(props[primaryField.toLowerCase()]) ||
                                 this.getNumericValue(props[primaryField.toUpperCase()]) || 0;
              const secondaryValue = this.getNumericValue(props[secondaryField]) || 
                                   this.getNumericValue(props[`value_${secondaryField}`]) ||
                                   this.getNumericValue(props[secondaryField.toLowerCase()]) ||
                                   this.getNumericValue(props[secondaryField.toUpperCase()]) || 0;
              const differenceValue = primaryValue - secondaryValue;
              
              // Debug first few features
              if (index < 3) {
              /*  console.log(`[VisualizationFactory DEBUG] Feature ${index}:`, {
                  primaryField,
                  secondaryField,
                  primaryValue,
                  secondaryValue,
                  differenceValue,
                  availableFields: Object.keys(props),
                  primaryRawValue: props[primaryField],
                  secondaryRawValue: props[secondaryField]
                });*/
              }
              
              return {
                attributes: {
                  OBJECTID: props.OBJECTID || props.ID || index + 1,
                  primary_value: primaryValue,
                  secondary_value: secondaryValue,
                  difference_value: differenceValue,
                  ...props
                },
                geometry: feature.geometry
              };
            })
            .filter((f: any): f is NonNullable<typeof f> => f !== null);
          
        /*  console.log('[VisualizationFactory DEBUG] Processed features for difference:', {
            totalFeatures: featuresForViz.length,
            featuresWithGeometry: featuresForViz.filter(f => f.geometry).length,
            featuresWithoutGeometry: featuresForViz.filter(f => !f.geometry).length,
            sampleFeature: featuresForViz[0] ? {
              hasGeometry: !!featuresForViz[0].geometry,
              geometryType: featuresForViz[0].geometry?.type,
              attributes: featuresForViz[0].attributes,
              primaryValue: featuresForViz[0].attributes?.primary_value,
              secondaryValue: featuresForViz[0].attributes?.secondary_value,
              differenceValue: featuresForViz[0].attributes?.difference_value
            } : null
          });*/
          
          if (featuresForViz.length === 0) {
            console.error('[VisualizationFactory ERROR] No features available for difference visualization');
            return { layer: null, extent: null };
          }
          
          if (featuresForViz.filter(f => f.geometry).length === 0) {
            console.error('[VisualizationFactory ERROR] No features with geometry available for difference visualization');
            return { layer: null, extent: null };
          }
          
          // Extract brand names from field codes
          const getBrandFromField = (field: string): string => {
            const brandMap: Record<string, string> = {
              'MP30034A_B': 'Nike',
              'MP30034A_B_P': 'Nike',
              'MP30029A_B': 'Adidas',
              'MP30029A_B_P': 'Adidas',
              'MP30030A_B': 'Asics',
              'MP30030A_B_P': 'Asics',
              'MP30031A_B': 'Converse',
              'MP30031A_B_P': 'Converse',
              'MP30032A_B': 'Jordan',
              'MP30032A_B_P': 'Jordan',
              'MP30033A_B': 'New Balance',
              'MP30033A_B_P': 'New Balance',
              'MP30035A_B': 'Puma',
              'MP30035A_B_P': 'Puma',
              'MP30036A_B': 'Reebok',
              'MP30036A_B_P': 'Reebok',
              'MP30037A_B': 'Skechers',
              'MP30037A_B_P': 'Skechers'
            };
            
            // Check both uppercase and original field format
            const upperField = field.toUpperCase();
            return brandMap[upperField] || brandMap[field] || 'Primary';
          };

          const primaryBrand = getBrandFromField(primaryField);
          const secondaryBrand = getBrandFromField(secondaryField);

          result = await differenceViz.create({
            features: featuresForViz,
            layerName: primaryLayer.layer.name,
            rendererField: 'difference_value',
            primaryField: primaryField,
            secondaryField: secondaryField,
            primaryLabel: primaryBrand,
            secondaryLabel: secondaryBrand,
            differenceField: 'difference_value',
            unitType: 'percentage',
            layerConfig: {
              name: primaryLayer.layer.name,
              fields: [
                { name: 'OBJECTID', type: 'oid' },
                { name: 'primary_value', type: 'double' },
                { name: 'secondary_value', type: 'double' },
                { name: 'difference_value', type: 'double' }
              ]
            }
          }, options);
          break;
        }

        case 'choropleth':
        case 'single-layer':
      default:
          result = await this.createSingleLayerVisualization(localLayerResults, options);
        break;
    }

      // Default popup handling
     /*  console.log('[VizFactory] Popup handling check:', {
        hasResult: !!result,
        hasLayer: !!result?.layer,
        hasPopupTemplate: !!result?.layer?.popupTemplate,
        hasPopupConfig: !!options.popupConfig,
        vizType: vizType
      });*/
      
      if (result && result.layer && !result.layer.popupTemplate && options.popupConfig) {
        const popupTemplate = createPopupTemplateFromConfig(options.popupConfig);
        if (popupTemplate) {
          result.layer.popupTemplate = popupTemplate;
         // console.log('[VizFactory] Applied popup from options.popupConfig');
        }
      } else if (result && result.layer && !result.layer.popupTemplate && vizType !== 'multivariate') {
        // Create a simple popup template that will work with CustomPopupManager
        // The CustomPopupManager will handle the actual custom styling and zoom buttons
        const firstLayer = layerResults[0];
        if (firstLayer && firstLayer.features && firstLayer.features.length > 0) {
          // Create a very simple popup template - CustomPopupManager will enhance it
          result.layer.popupTemplate = new PopupTemplate({
            title: "{DESCRIPTION}",
            content: [
              {
                type: "fields",
                fieldInfos: [
                  { fieldName: "RANK", label: "Rank" },
                  { fieldName: "mp30034a_b", label: "Nike" },
                  { fieldName: "mp30029a_b", label: "Adidas" }
                ]
              }
            ],
            outFields: ["*"]
          });
        }
      } else if (vizType === 'multivariate' && result?.layer?.popupTemplate) {
        //console.log('[VizFactory] Multivariate visualization has custom popup, preserving it');
    }

    if (!result) {
        throw new Error(`Unsupported visualization type: ${vizType}`);
      }

    // Legend info should always be generated by the individual visualization classes
    // Remove fallback legend generation since all visualizations now use standardized methods
    /*console.log('[VizFactory] Legend handling check:', {
      hasLayer: !!result.layer,
      hasExistingLegendInfo: !!result.legendInfo,
      vizType: vizType
    });*/
    
    if (!result.legendInfo) {
      console.warn(`[VizFactory] No legend info provided by ${vizType} visualization. This should be fixed in the visualization class.`);
    }

    // Note: Enhanced styling will be applied by the calling code after layer is created

    return result;

    } catch (error) {
      console.error('[VisualizationFactory DEBUG] Error creating visualization:', error);
      throw error;
    }
  }


  private prepareCorrelationData(layerResults: any[], options: VisualizationOptions) {
    const combinedFeatures = layerResults.flatMap(result => result.features || []);
    const primaryLayerResult = layerResults[0];
    if (!primaryLayerResult || combinedFeatures.length === 0) {
      return null;
    }
    const layerConfig = primaryLayerResult.layer || primaryLayerResult;

          // For correlation, use the actual field names from the analysis result
      const { enhancedAnalysis } = this.visualizationIntegration;
      const relevantFields = enhancedAnalysis?.relevantFields || [];
      //console.log('[VisualizationFactory DEBUG] Relevant fields for correlation:', relevantFields);
      // Build GeoJSON-like features with explicit `properties` from ALL layers
     /* console.log('[VisualizationFactory DEBUG] Processing features from multiple layers:', {
        layerCount: layerResults.length,
        combinedFeatureCount: combinedFeatures.length,
        primaryLayerFeatureCount: primaryLayerResult.features?.length || 0
      });*/

      const featuresForViz = combinedFeatures.map((feature: any) => {
        if (!feature) return null;

    return {
          type: 'Feature',
          geometry: feature.geometry,
          properties: {
            ...(feature.properties || {}),
            ...(feature.attributes || {}),
            OBJECTID:
              feature.properties?.OBJECTID ||
              feature.attributes?.OBJECTID ||
              feature.properties?.ID ||
              feature.attributes?.ID ||
              undefined
          }
        };
      }).filter((f: any) => f !== null);

      //  console.log('[VizFactory DEBUG] featuresForViz sample:', featuresForViz.slice(0, 5).map((f: { properties: any } | null) => f?.properties));

      // Collect numeric fields across first N features to avoid missing sparsely populated columns
      const numericFieldSet = new Set<string>();
      const SAMPLE_COUNT = featuresForViz.length;
      for (let i = 0; i < SAMPLE_COUNT; i++) {
        const props = featuresForViz[i]?.properties;
        if (!props) continue;
        for (const [key, val] of Object.entries(props)) {
          if (val === null || val === undefined) continue;
          if (typeof val === 'number' && !isNaN(val)) {
            numericFieldSet.add(key);
          } else if (typeof val === 'string') {
            const num = parseFloat(val);
            if (!isNaN(num)) numericFieldSet.add(key);
          }
        }
      }
      const numericFields = Array.from(numericFieldSet);
      //console.log('[VizFactory DEBUG] Sampled numeric fields:', numericFields);

      // === FIELD SELECTION FOR CORRELATION (data-driven) ===
      const placeholderFields = ['thematic_value', 'joint_score', 'combined_score'];

      // Helper to normalise keys (remove underscores/spaces and lower-case)
      const normalise = (s: string) => s.replace(/[\s_\-]+/g, '').toLowerCase();

      const primaryFieldCandidate = relevantFields[0] || options.primaryField || layerConfig.rendererField || 'thematic_value';
      const comparisonFieldCandidate = relevantFields[1] || relevantFields[0] || 'thematic_value';

      // Build ordered unique list (target first, then relevant fields)
      const orderedCandidates = Array.from(new Set([primaryFieldCandidate, comparisonFieldCandidate].filter(Boolean))) as string[];

      // Build a map of normalised numeric field keys that actually exist in the data → original key
      const numericFieldLookup: Record<string, string> = {};
      numericFields.forEach((key) => {
        const norm = normalise(key);
        if (!(norm in numericFieldLookup)) numericFieldLookup[norm] = key;
      });

      // ----- ENSURE BRAND FIELDS PRESENT ---------------------------------
      // Some brand columns are sparse and may not appear in first SAMPLE_COUNT rows.
      // Force-add the two orderedCandidates (canonical + snake_case) to numericFieldLookup
      const ensureCandidateFields = (candidates: string[]) => {
        candidates.forEach(cand => {
          if (!cand) return;
          const variants = [cand, cand.toLowerCase().replace(/a_b$/, '_a_b')];
          variants.forEach(variant => {
            const norm = normalise(variant);
            if (!(norm in numericFieldLookup)) {
              numericFieldLookup[norm] = variant;
              if (!numericFields.includes(variant)) numericFields.push(variant);
            }
          });
        });
      };

      ensureCandidateFields(orderedCandidates);

      //console.log('[VizFactory DEBUG] numericFieldLookup after ensuring candidates:', numericFieldLookup);

      // Given a candidate (canonical) name, attempt to find matching actual property key in data
      const resolveCandidate = (candidate?: string): string | undefined => {
        if (!candidate) return undefined;
        if (placeholderFields.includes(candidate)) return undefined;

        // Build list: canonical + any alias keys that map to the same canonical
        const equivalents: string[] = [candidate];
        Object.entries(FIELD_ALIASES).forEach(([aliasKey, canonicalVal]) => {
          if (canonicalVal === candidate && !equivalents.includes(aliasKey)) {
            equivalents.push(aliasKey);
          }
        });

        // Try each equivalent against the lookup
        for (const key of equivalents) {
          const norm = normalise(key);
          const match = numericFieldLookup[norm];
          if (match) return match;
        }
        return undefined;
      };

      // CRITICAL FIX: For multi-layer correlations, resolve fields more intelligently
      const resolvedFields = orderedCandidates.map(resolveCandidate).filter(Boolean);
      const primaryField = resolvedFields[0];
      let comparisonField = resolvedFields.find(f => f !== primaryField);

      // If we can't find the comparison field in the combined data, 
      // check if it exists in the original relevantFields but just wasn't found in the data
      if (!comparisonField && relevantFields.length >= 2) {
        const secondCandidate = relevantFields[1];
        // Try direct field name matching even if it wasn't in numericFieldLookup
        const directMatch = featuresForViz.some(f => f?.properties?.[secondCandidate] !== undefined);
        if (directMatch) {
          comparisonField = secondCandidate;
          //console.log('[VizFactory] Found comparison field via direct matching:', secondCandidate);
        }
      }

      /*console.log('[VizFactory DEBUG] Field resolution details:', {
        orderedCandidates,
        resolvedFields: orderedCandidates.map(c => ({ candidate: c, resolved: resolveCandidate(c) })),
        primaryField,
        comparisonField,
        numericFieldsAvailable: numericFields.length,
        relevantFields
      });*/

    //console.log('[VizFactory DEBUG] Resolved Fields:', { primaryField, comparisonField });

    // CRITICAL FIX: Handle missing fields more gracefully
    if (!primaryField) {
      console.warn('[VisualizationFactory] No primary field found, using fallback');
      // Use first available numeric field as fallback
      const fallbackPrimary = numericFields.find(f => !placeholderFields.includes(f)) || 'OBJECTID';
      const finalPrimaryField = fallbackPrimary;
      const finalComparisonField = comparisonField || numericFields.find(f => f !== finalPrimaryField && !placeholderFields.includes(f)) || 'OBJECTID';
      
      /*console.log('[VisualizationFactory] Using fallback fields:', {
        primary: finalPrimaryField,
        comparison: finalComparisonField,
        availableFields: numericFields
      });*/

      return {
        features: combinedFeatures.map((feature, index) => ({
          geometry: feature.geometry,
          attributes: {
            OBJECTID: index + 1,
            primary_value: this.getNumericValue(feature.properties?.[finalPrimaryField] || feature.attributes?.[finalPrimaryField] || 0),
            comparison_value: this.getNumericValue(feature.properties?.[finalComparisonField] || feature.attributes?.[finalComparisonField] || 0),
            correlation_strength: 0,
            ...feature.properties,
            ...feature.attributes
          }
        })),
        layerName: layerConfig.name || 'Correlation Layer',
        rendererField: 'correlation_strength',
        primaryField: finalPrimaryField,
        comparisonField: finalComparisonField,
        primaryLayerId: layerConfig.id || 'unknown',
        comparisonLayerId: layerConfig.id || 'unknown',
        layerConfig: {
          name: layerConfig.name || 'Correlation Layer',
          fields: [
            { name: 'OBJECTID', type: 'oid' as FieldType },
            { name: 'primary_value', type: 'double' as FieldType },
            { name: 'comparison_value', type: 'double' as FieldType },
            { name: 'correlation_strength', type: 'double' as FieldType }
          ]
        }
      };
    }

    // Use the resolved fields (normal case)
    // CRITICAL FIX: Don't fall back to primaryField for comparison - find a different field
    let finalComparisonField = comparisonField;
    if (!finalComparisonField) {
      // Find a different numeric field that's not the primary field
      finalComparisonField = numericFields.find(f => f !== primaryField && !placeholderFields.includes(f));
      if (!finalComparisonField) {
        console.warn('[VisualizationFactory] No suitable comparison field found, using primary field as fallback');
        finalComparisonField = primaryField;
      }
    }

    /*console.log('[VisualizationFactory] Using resolved fields:', {
      primary: primaryField,
      comparison: finalComparisonField,
      availableNumericFields: numericFields.slice(0, 10) // Show first 10 for debugging
    });*/

    // Create correlation visualization with proper CorrelationData structure
    return {
      features: featuresForViz.map((feature: any, index: number) => ({
        geometry: feature.geometry,
        attributes: {
          OBJECTID: index + 1,
          primary_value: this.getNumericValue(feature.properties?.[primaryField] || 0),
          comparison_value: this.getNumericValue(feature.properties?.[finalComparisonField] || 0),
          correlation_strength: 0, // Will be calculated by the visualization
          ...feature.properties
        }
      })),
      layerName: layerConfig.name || 'Correlation Layer',
      rendererField: 'correlation_strength',
      primaryField,
      comparisonField: finalComparisonField,
      primaryLayerId: layerConfig.id || 'unknown',
      comparisonLayerId: layerConfig.id || 'unknown',
      layerConfig: {
        name: layerConfig.name || 'Correlation Layer',
        fields: [
          { name: 'OBJECTID', type: 'oid' as FieldType },
          { name: 'primary_value', type: 'double' as FieldType },
          { name: 'comparison_value', type: 'double' as FieldType },
          { name: 'correlation_strength', type: 'double' as FieldType }
        ]
      }
    } as any;
  }


  public getVisualizationConfig(): VisualizationConfig {
    if (this.visualizationIntegration) {
      return (this.visualizationIntegration as any).getVisualizationConfig();
    }
    // Return a default config if visualizationIntegration is not available
    return {
      type: 'choropleth' as VisualizationType,
      title: 'Brand Difference Analysis',
      description: 'Comparison visualization',
      legendConfig: { position: 'bottom-right' } as any,
      popupConfig: { enabled: true } as any
    };
  }

  public updateAnalysisResult(analysisResult: any, enhancedAnalysis?: any): void {
    console.log('🔥 [VisualizationFactory] Updating with fresh analysis result:', {
      type: analysisResult?.type,
      hasRenderer: !!analysisResult?.renderer,
      hasLegend: !!analysisResult?.legend
    });
    
    if (this.visualizationIntegration) {
      (this.visualizationIntegration as any).updateAnalysisResult(analysisResult, enhancedAnalysis);
    }
  }

  private determineVisualizationType(
    layerResults: LocalLayerResult[],
    options: VisualizationOptions
  ): 'correlation' | 'point-layer' | 'single-layer' | 'trends' | 'trends-correlation' | 'joint-high' | 'multivariate' | 'ranking' | 'choropleth' | 'factor-importance' | 'feature-interaction' | 'difference' | 'bivariate' | 'hotspot' {
    
    console.log('🔥 [VisualizationFactory] DEBUG: Determining visualization type');
    console.log('🔥 [VisualizationFactory] Query:', options.query);
    console.log('🔥 [VisualizationFactory] Options visualizationMode:', options.visualizationMode);
    
    const analysisResult = this.visualizationIntegration?.analysisResult as any;
    console.log('🔥 [VisualizationFactory] Analysis result type:', analysisResult?.type);
    
    if (analysisResult?.type === 'brand_difference') {
      console.log('🎯 [VisualizationFactory] FOUND brand_difference analysis - should use difference visualization');
      return 'difference';
    }
    /*console.log('Determining visualization type:', {
      query: options.query,
      layerCount: layerResults.length,
      layerNames: layerResults.map(l => l.layer.name)
    });*/

    // First check if visualization mode is explicitly set
    if (options.visualizationMode) {
      //console.log('Using explicit visualization mode:', options.visualizationMode);
      return options.visualizationMode as any;
    }

    const query = options.query?.toLowerCase() || '';

    // Check for predictive/factor analysis queries first
    const isPredictiveQuery = /(?:predict|factor|influence|correlat|relationship|driver|cause|impact).*(?:high|low|conversion|rate|outcome)/i.test(query) ||
                             /(?:what|which).*(?:predict|factor|influence|correlat|drive|cause|impact)/i.test(query) ||
                             /(?:biggest|main|key|important|significant).*(?:factor|predictor|driver|influence)/i.test(query) ||
                             /factors.*that.*predict/i.test(query);

    if (isPredictiveQuery) {
      //console.log('Detected predictive/factor analysis query');
      return 'factor-importance';
    }

    // Check for feature interaction queries - how variables work together
    const isInteractionQuery = /(?:interaction|combination|together|combined|synerg|amplif).*(?:effect|impact|influence)/i.test(query) ||
                             /how.*(?:work|combine|interact).*together/i.test(query) ||
                             /(?:combined|joint|simultaneous).*(?:effect|impact|influence)/i.test(query) ||
                             /(?:when|where).*(?:both|multiple|several).*(?:high|low|present)/i.test(query) ||
                             /relationship.*between.*and/i.test(query) ||
                             /(?:amplify|enhance|counteract|cancel).*effect/i.test(query);

    if (isInteractionQuery) {
      //console.log('Detected feature interaction query');
      return 'feature-interaction';
    }

    // Check for topN queries first
    if (isTopNQuery(query)) {
      //console.log('Detected topN query');
      return 'ranking';
    }
    
    // Check for JOINT HIGH queries - areas that are high in multiple variables
    const jointHighKeywords = [
      'highest rates of',
      'high levels of.*and.*',
      'areas.*highest.*and',
      'regions.*highest.*and',
      'high.*both',
      'areas with high.*and.*',
      'regions with high.*and.*',
      'highest.*both',
      'areas that have high.*and.*',
      'regions that have high.*and.*'
    ];
    
    const hasJointHighPattern = jointHighKeywords.some(pattern => 
      new RegExp(pattern, 'i').test(query)
    );
    
    // Additional check for "and" with superlative terms and multiple layer results
    const hasSuperlativeAndMultipleVariables = (
      (query.includes('highest') || query.includes('top') || query.includes('most')) &&
      query.includes(' and ') &&
      layerResults.length >= 2
    );
    
    if (hasJointHighPattern || hasSuperlativeAndMultipleVariables) {
      /*console.log('Detected joint-high query - areas high in multiple variables:', {
        hasJointHighPattern,
        hasSuperlativeAndMultipleVariables,
        layerCount: layerResults.length
      });*/
      return 'joint-high';
    }
    
    // Check for trends keywords
    const trendsKeywords = [
      'trend',
      'trending',
      'popularity',
      'interest over time',
      'search volume',
      'google trends',
      'search interest',
      'search trends',
      'trend analysis',
      'trending topics',
      'trending searches',
      'search popularity',
      'search volume trends',
      'interest trends'
    ];
    
    const hasTrendsKeyword = trendsKeywords.some(keyword => query.includes(keyword));

    // Enhanced correlation keyword detection
    const correlationKeywords = [
      'compare',
      'relationship',
      'correlation',
      'versus',
      ' vs ',
      'between',
      'relate',
      'connection'
    ];
    
    const hasCorrelationKeyword = correlationKeywords.some(keyword => query.includes(keyword));
    
    // Check for trends-correlation queries (trends data combined with demographics)
    const isTrendsCorrelationQuery = hasTrendsKeyword && 
                                     layerResults.length >= 2 && 
                                     (hasCorrelationKeyword || query.includes('vs') || query.includes('versus') || query.includes('compare'));
    
    if (isTrendsCorrelationQuery) {
      //console.log('Detected trends-correlation query - combining trends with demographic data');
      return 'trends-correlation';
    }
    
    if (hasTrendsKeyword) {
      //console.log('Detected trends query with keyword match');
      return 'trends';
    }
    
    // Check for difference/competitive analysis queries
    const differenceKeywords = [
      ' vs ',
      ' versus ',
      'against',
      'nike vs adidas',
      'adidas vs nike',
      'compare.*vs',
      'difference between'
    ];
    
    const hasDifferenceKeyword = differenceKeywords.some(keyword => 
      new RegExp(keyword, 'i').test(query)
    );
    
    // Check for brand mentions in competitive context
    const brandMentions = ['nike', 'adidas', 'jordan', 'puma', 'reebok', 'converse'];
    const mentionedBrands = brandMentions.filter(brand => query.includes(brand));
    
    if (hasDifferenceKeyword && mentionedBrands.length >= 2) {
      //  console.log('Detected difference/competitive analysis query');
      return 'difference';
    }

    // Check for multiple numeric fields being referenced BEFORE general correlation keyword check
    // This ensures that 3+ variable queries use multivariate analysis even if they contain correlation keywords
    const numericFieldCount = layerResults.filter(lr => 
      lr.layer.rendererField && 
      lr.features[0]?.attributes?.[lr.layer.rendererField] !== undefined
    ).length;

    // For 3+ layers, use multivariate analysis instead of correlation
    // Correlation is only meaningful for exactly 2 variables
    if (numericFieldCount >= 3) {
      //console.log('3+ numeric fields detected, using multivariate for multi-variable analysis');
      return 'multivariate';
    }

    if (numericFieldCount === 2 && hasCorrelationKeyword) {
      //console.log('2 numeric fields with correlation keyword detected, using correlation');
      return 'correlation';
    }
    
    // General correlation keyword check for cases without clear numeric field count
    if (hasCorrelationKeyword) {
      //console.log('Detected correlation query with keyword match (fallback)');
        return 'correlation';
    }
    
    // Check for point-specific keywords
    if (query.includes('point') || query.includes('location') || query.includes('place')) {
      return 'point-layer';
    }
    
    // Default to single layer
    return 'single-layer';
  }


  private async createSingleLayerVisualization(
    layerResults: LocalLayerResult[],
    options: VisualizationOptions
  ): Promise<{ layer: __esri.FeatureLayer | null; extent: __esri.Extent | null }> {
    try {
      const { SingleLayerVisualization } = await import('./visualizations/single-layer-visualization');
      const singleViz = new SingleLayerVisualization();
      
      // Get the primary layer and its configuration
      const primaryLayer = layerResults[0];
      if (!primaryLayer || !primaryLayer.layer) {
        //console.error('[VisualizationFactory DEBUG] Missing primary layer or layer configuration');
        return { layer: null, extent: null };
      }

      const layerConfig = primaryLayer.layer;
      const layerName = layerConfig.name || 'Analysis Layer';

      // Always use thematic_value as the default renderer field
      const rendererField = layerConfig.rendererField || 'thematic_value';
      if (!rendererField) {
        //  console.warn('[VisualizationFactory DEBUG] No renderer field specified');
        return { layer: null, extent: null };
      }
      
      const result = await singleViz.create(
        {
          features: primaryLayer.features || [],
          layerName: layerName,
          rendererField: rendererField,
          layerConfig: {
            fields: (layerConfig.fields || []).map(field => ({
              ...field,
              type: field.type as FieldType
            }))
          }
        },
        options
      );
      return result;
    } catch (error) {
      console.error('Error creating single layer visualization:', error);
      return { layer: null, extent: null };
    }
  }

  private async createTrendsVisualization(
    layerResults: LocalLayerResult[],
    options: VisualizationOptions
  ): Promise<{ layer: __esri.FeatureLayer | null; extent: __esri.Extent | null }> {
    try {
      const { TrendsVisualization } = await import('./visualizations/trends-visualization');
      const trendsViz = new TrendsVisualization();
      
      // Extract keyword from query using more sophisticated parsing
      let keyword = 'default';
      if (options.query) {
        // Look for phrases like "trends for X" or "trending X"
        const trendMatch = options.query.match(/(?:trends?|trending)\s+(?:for\s+)?([a-zA-Z0-9\s]+)/i);
        if (trendMatch) {
          keyword = trendMatch[1].trim();
        } else {
          // Fallback to last word if no specific pattern found
          keyword = options.query.split(' ').pop() || 'default';
        }
      }
      
      const result = await trendsViz.create(
        {
          features: [], // Will be populated by the visualization
          layerName: `Trends: ${keyword}`,
          keyword: keyword,
          timeframe: 'today 12-m',
          geo: 'US'
        },
        options
      );
      
      return result;
    } catch (error) {
      console.error('Error creating trends visualization:', error);
      return { layer: null, extent: null };
    }
  }

  private async createCorrelationVisualization(
    layerResults: LocalLayerResult[],
    options: VisualizationOptions
  ): Promise<{ layer: __esri.FeatureLayer | null; extent: __esri.Extent | null }> {
    try {
      // Use the default correlation visualization for all correlation queries
      const result = await this.createDefaultCorrelationVisualization(layerResults, options);
      return result;
    } catch (error) {
      console.error('[VisualizationFactory] Error creating correlation visualization:', error);
      return { layer: null, extent: null };
    }
  }

  private async createDefaultCorrelationVisualization(
    layerResults: LocalLayerResult[],
    options: VisualizationOptions
  ): Promise<{ layer: __esri.FeatureLayer | null; extent: __esri.Extent | null }> {
    try {
      const { CorrelationVisualization } = await import('./visualizations/correlation-visualization');
      const correlationViz = new CorrelationVisualization();

      // Check if we have a microservice response (indicated by analysis_type field)
      const firstResult = layerResults[0];
      /*console.log('[VisualizationFactory] Checking for microservice response:', {
        hasFirstResult: !!firstResult,
        hasFeatures: !!firstResult?.features,
        featuresLength: firstResult?.features?.length,
        firstFeature: firstResult?.features?.[0],
        firstFeatureKeys: firstResult?.features?.[0] ? Object.keys(firstResult.features[0]) : [],
        analysisType: firstResult?.features?.[0]?.analysis_type
      });*/
      
      if (firstResult && firstResult.features && firstResult.features.length > 0) {
        const firstFeature = firstResult.features[0];
        
        // Check if this looks like a microservice response
        if (firstFeature.analysis_type === 'bivariate_correlation' || 
            firstFeature.analysis_type === 'multi_brand_comparison' ||
            (firstFeature.success !== undefined && firstFeature.results)) {
          //console.log('[VisualizationFactory] Detected microservice response, using createFromMicroservice');
          
          // Use the microservice response directly
          const result = await correlationViz.createFromMicroservice(firstFeature, options);
          
         /* console.log('[VisualizationFactory] Microservice correlation visualization created:', {
            hasLayer: !!result.layer,
            hasExtent: !!result.extent,
            analysisType: firstFeature.analysis_type
          });*/

          return {
            layer: result.layer,
            extent: result.extent || null,
            legendInfo: (result as any).legendInfo || null
          } as any;
        }
      }

      // Original layer-based processing for non-microservice responses
      const { enhancedAnalysis } = this.visualizationIntegration;
      const relevantFields = enhancedAnalysis?.relevantFields || [];

     /* console.log('[VisualizationFactory] Creating default correlation visualization from layers:', {
        relevantFields,
        primaryField: options.primaryField,
        comparisonField: options.comparisonField,
        query: options.query
      });*/ 

      // Determine primary and comparison fields
      let primaryField = options.primaryField || relevantFields[0];
      let comparisonField = options.comparisonField || relevantFields[1];

      // If we don't have two fields, try to infer from the query and available data
      if (!primaryField || !comparisonField) {
        const features = layerResults[0]?.features || [];
        if (features.length > 0) {
          const sampleProperties = features[0].properties || {};
          const numericFields = Object.keys(sampleProperties).filter(key => {
            const value = sampleProperties[key];
            return typeof value === 'number' || (typeof value === 'string' && !isNaN(parseFloat(value)));
          });
          
          //console.log('[VisualizationFactory] Available numeric fields:', numericFields);
          
          if (!primaryField) {
            primaryField = numericFields.find(field => 
              field.includes('MP30034A_B') || // Nike (default)
              field.includes('MEDDI_CY') ||   // Income
              field.includes('TOTPOP_CY')     // Population
            ) || numericFields[0] || 'thematic_value';
          }
          
          if (!comparisonField) {
            comparisonField = numericFields.find(field => 
              field !== primaryField && (
                field.includes('MEDDI_CY') ||   // Income
                field.includes('TOTPOP_CY') ||  // Population
                field.includes('DIVINDX_CY') || // Diversity
                field.includes('MP30') ||       // Any brand field
                field.includes('GENZ_CY') ||    // Gen Z
                field.includes('MILLENN_CY')    // Millennial
              )
            ) || numericFields.find(field => field !== primaryField) || primaryField;
          }
        }
      }
      
      // Fallback to default fields if still not found
      primaryField = primaryField || 'MP30034A_B';
      comparisonField = comparisonField || 'MEDDI_CY';
      
      /*console.log('[VisualizationFactory] Using fields for correlation:', {
            primaryField,
        comparisonField
      });*/

      // Prepare correlation data
      const data = await this.prepareCorrelationData(layerResults, {
        ...options,
        primaryField,
        comparisonField,
        title: options.title || `${primaryField} vs ${comparisonField}`
      });

      if (!data) {
        console.error('[VisualizationFactory] Failed to prepare correlation data');
        return { layer: null, extent: null };
      }

      // Create correlation visualization using the resolved field names from prepareCorrelationData
      const result = await correlationViz.create({
        features: data.features.map((feature: any, index: number) => ({
            geometry: feature.geometry,
            attributes: {
              OBJECTID: index + 1,
            primary_value: this.getNumericValue(feature.attributes[data.primaryField]),
            comparison_value: this.getNumericValue(feature.attributes[data.comparisonField]),
              correlation_strength: 0, // Will be calculated by the visualization
            ...feature.attributes
            }
        })),
        layerName: data.layerName,
        rendererField: 'correlation_strength',
        primaryField: data.primaryField,
        comparisonField: data.comparisonField,
        primaryLayerId: layerResults[0]?.layer.id || 'unknown',
        comparisonLayerId: layerResults[0]?.layer.id || 'unknown',
        layerConfig: {
          name: data.layerName,
          fields: [
            { name: 'OBJECTID', type: 'oid' },
            { name: 'primary_value', type: 'double' },
            { name: 'comparison_value', type: 'double' },
            { name: 'correlation_strength', type: 'double' }
          ]
        }
      } as CorrelationData, options);

      /*console.log('[VisualizationFactory] Default correlation visualization created:', {
        hasLayer: !!result.layer,
        hasExtent: !!result.extent,
        primaryField: data.primaryField,
        comparisonField: data.comparisonField
      });*/

      return {
        layer: result.layer,
        extent: result.extent || null,
        legendInfo: (result as any).legendInfo || null
      } as any;
    } catch (error) {
      console.error('[VisualizationFactory] Error creating default correlation visualization:', error);
      return { layer: null, extent: null };
    }
  }

  private async createTrendsCorrelationVisualization(
    layerResults: LocalLayerResult[],
    options: VisualizationOptions
  ): Promise<{ layer: __esri.FeatureLayer | null; extent: __esri.Extent | null }> {
    try {
      console.log('=== Creating Trends Correlation Visualization ===');
      
      if (layerResults.length < 2) {
        console.error('Insufficient layers for trends correlation. Need at least 2 layers.');
        return { layer: null, extent: null };
      }

      const { TrendsCorrelationVisualization } = await import('./visualizations/trends-correlation-visualization');
      const trendsCorrelationViz = new TrendsCorrelationVisualization();
      
      const primaryLayer = layerResults[0];
      const comparisonLayer = layerResults[1];

      // Safely access layer properties with proper fallbacks
      const primaryLayerConfig = primaryLayer.layer;
      const comparisonLayerConfig = comparisonLayer.layer;

      // Special handling for Mark Carney data with safe property access
      const isPrimaryMarkCarney = primaryLayerConfig?.id?.includes('markcarney') || 
                                  primaryLayerConfig?.name?.toLowerCase().includes('mark carney') || false;

      const isComparisonMarkCarney = comparisonLayerConfig?.id?.includes('markcarney') || 
                                     comparisonLayerConfig?.name?.toLowerCase().includes('mark carney') || false;

      // Determine the type of each layer (trends or demographics) with safe property access
      const isPrimaryTrends = isPrimaryMarkCarney || 
                              primaryLayerConfig?.id?.includes('trends') || 
                              primaryLayerConfig?.name?.toLowerCase().includes('trend') || false;

      const isComparisonTrends = isComparisonMarkCarney || 
                                 comparisonLayerConfig?.id?.includes('trends') || 
                                 comparisonLayerConfig?.name?.toLowerCase().includes('trend') || false;

      // Force Mark Carney data to be considered as trends type
      const primaryType = isPrimaryTrends ? 'trends' : 'demographics';
      const comparisonType = isComparisonTrends ? 'trends' : 'demographics';

      // Find fields to use for correlation with safe property access
      const primaryField = primaryLayerConfig?.rendererField || 
                           Object.keys(primaryLayer.features[0]?.attributes || {}).find(key => 
                             typeof primaryLayer.features[0]?.attributes[key] === 'number'
                           ) || 'value';

      const comparisonField = comparisonLayerConfig?.rendererField || 
                              Object.keys(comparisonLayer.features[0]?.attributes || {}).find(key => 
                                typeof comparisonLayer.features[0]?.attributes[key] === 'number'
                              ) || 'value';

      /*console.log('Creating trends correlation with:', {
        primaryLayer: primaryLayerConfig?.name || 'Primary Layer',
        primaryType,
        primaryField,
        primaryFeatureCount: primaryLayer.features?.length || 0,
        comparisonLayer: comparisonLayerConfig?.name || 'Comparison Layer',
        comparisonType,
        comparisonField,
        comparisonFeatureCount: comparisonLayer.features?.length || 0,
        isPrimaryMarkCarney,
        isComparisonMarkCarney
      });*/

      const result = await trendsCorrelationViz.create({
          features: [], // Base visualization will handle this
        layerName: `Correlation: ${primaryLayerConfig?.name || 'Layer 1'} vs ${comparisonLayerConfig?.name || 'Layer 2'}`,
        primaryLayerFeatures: primaryLayer.features || [],
        primaryField,
        primaryType,
        comparisonLayerFeatures: comparisonLayer.features || [],
        comparisonField,
        comparisonType,
          joinField: options.joinField || 'CSDNAME' // Default join field for Census Subdivisions
      }, options);
      
      return result;
    } catch (error) {
      console.error('Error creating trends correlation visualization:', error);
      // Fall back to regular correlation visualization
      return this.createCorrelationVisualization(layerResults, options);
    }
  }



  private async createMultivariateVisualization(
    layerResults: LocalLayerResult[],
    options: VisualizationOptions
  ): Promise<VisualizationResult> {
    try {
      //console.log('=== Creating Multivariate Visualization ===');

      // Check if we have sufficient numeric fields for multivariate analysis
      const { enhancedAnalysis } = this.visualizationIntegration;
      const relevantFields = enhancedAnalysis?.relevantFields || [];
      
      /*console.log('[MultivariateViz] Initial field check:', {
        layerCount: layerResults.length,
        relevantFieldsCount: relevantFields.length,
        relevantFields
      });*/ 

      if (relevantFields.length < 3 && layerResults.length < 2) {
        console.error('Insufficient data for multivariate analysis. Need at least 3 numeric fields or 2+ layers.');
        return { layer: null, extent: null, renderer: undefined, legendInfo: undefined };
      }

      const { MultivariateVisualization } = await import('./visualizations/multivariate-visualization');
      const multivariateViz = new MultivariateVisualization();

      // Combine features from all layers
      const combinedFeatures = layerResults.flatMap(result => result.features || []);
      
      // Extract field names from layer results if not in enhanced analysis
      let correlationFields: string[] = [];
      
      if (relevantFields.length >= 3) {
        correlationFields = relevantFields.slice(0, 3);
      } else {
        // Extract from layer renderer fields
        const layerFields = layerResults.slice(0, 3)
          .map(lr => lr.layer.rendererField)
          .filter((field): field is string => Boolean(field));
        if (layerFields.length >= 3) {
          correlationFields = layerFields;
        } else {
          // Extract from actual feature data
          const sampleFeature = combinedFeatures[0];
          if (sampleFeature) {
            const allProps = { ...(sampleFeature.properties || {}), ...(sampleFeature.attributes || {}) };
            const numericFields = Object.keys(allProps).filter(key => {
              const value = allProps[key];
              return typeof value === 'number' || (typeof value === 'string' && !isNaN(parseFloat(value)));
            });
            correlationFields = numericFields.slice(0, 3);
          }
        }
        
        // Fallback to default fields
        if (correlationFields.length < 3) {
          correlationFields = ['thematic_value', 'value', 'count'].slice(0, 3);
        }
      }

      /*console.log('Creating multivariate visualization with:', {
        layerCount: layerResults.length,
        featureCount: combinedFeatures.length,
        correlationFields,
        query: options.query
      });*/

      // Convert features to graphics format expected by MultivariateVisualization
      const { default: Graphic } = await import('@arcgis/core/Graphic');
      const graphics = combinedFeatures.map((feature: any, index: number) => {
        // Skip if no geometry
        if (!feature.geometry) {
          //console.warn('[MultivariateViz] Skipping feature without geometry:', { index, featureKeys: Object.keys(feature) });
          return null;
        }

        const attributes = {
          OBJECTID: index + 1,
          ...(feature.properties || {}),
          ...(feature.attributes || {})
        };

        // Ensure correlationFields exist in attributes
        const hasAllFields = correlationFields.every(field => 
          attributes[field] !== undefined && attributes[field] !== null
        );

        if (!hasAllFields) {
          /*console.warn('[MultivariateViz] Skipping feature missing required fields:', { 
            index, 
            requiredFields: correlationFields,
            availableFields: Object.keys(attributes),
            missingFields: correlationFields.filter(field => attributes[field] === undefined || attributes[field] === null)
          });*/
          return null;
        }

        return new Graphic({
          geometry: feature.geometry,
          attributes
        });
      }).filter(g => g !== null) as __esri.Graphic[];

      /*console.log('[MultivariateViz] Processed graphics:', {
        totalInput: combinedFeatures.length,
        validGraphics: graphics.length,
        sampleFields: graphics[0]?.attributes ? Object.keys(graphics[0].attributes) : 'No graphics'
      });*/

      if (graphics.length === 0) {
        console.error('[MultivariateViz] No valid graphics after filtering. Falling back to joint-high.');
        const fallbackResult = await this.createJointHighVisualization(layerResults, options);
        return {
          layer: fallbackResult.layer,
          extent: fallbackResult.extent,
          renderer: undefined,
          legendInfo: undefined
        };
      }

      const result = await multivariateViz.create({
        features: graphics,
        correlationFields,
        title: options.title || `Multivariate Analysis: ${correlationFields.join(', ')}`,
        layerId: layerResults[0]?.layer.id || 'multivariate-analysis',
        layerName: options.title || 'Multivariate Analysis'
      }, options);

      return result;
    } catch (error) {
      console.error('Error creating multivariate visualization:', error);
      // Fall back to joint-high visualization for 3+ variables
      //console.log('Falling back to joint-high visualization');
      const fallbackResult = await this.createJointHighVisualization(layerResults, options);
      return {
        layer: fallbackResult.layer,
        extent: fallbackResult.extent,
        renderer: undefined,
        legendInfo: undefined
      };
    }
  }

  private async createJointHighVisualization(
    layerResults: LocalLayerResult[],
    options: VisualizationOptions
  ): Promise<VisualizationResult> {
    try {
      const { JointHighVisualization } = await import('./visualizations/joint-high-visualization');
      const jointViz = new JointHighVisualization();
      
      // Use first two layers for joint-high analysis
      const primaryLayer = layerResults[0];
      const comparisonLayer = layerResults[1] || layerResults[0];
      
      const { enhancedAnalysis } = this.visualizationIntegration;
      const relevantFields = enhancedAnalysis?.relevantFields || [];
      
      const primaryField = relevantFields[0] || primaryLayer.layer.rendererField || 'thematic_value';
      const comparisonField = relevantFields[1] || comparisonLayer.layer.rendererField || 'thematic_value';
      
      /*console.log('Creating joint-high visualization with:', {
        primaryField,
        comparisonField,
        primaryFeatureCount: primaryLayer.features?.length || 0,
        comparisonFeatureCount: comparisonLayer.features?.length || 0
      });*/

      const result = await jointViz.create({
        features: primaryLayer.features || [],
        layerName: options.title || `Joint High: ${primaryField} & ${comparisonField}`,
        metrics: [primaryField, comparisonField],
        rendererField: 'combined_score'
      } as any, options);

      return result;
    } catch (error) {
      console.error('Error creating joint-high visualization:', error);
      return { layer: null, extent: null, renderer: undefined, legendInfo: undefined };
    }
  }

  // Add helper method to extract the limit from topN queries
  private extractTopNLimit(query: string): { limit: number } {
    const numberPattern = /(?:top|highest|largest|greatest|most)\s+(\d+)/i;
    const match = query.match(numberPattern);
    if (match && match[1]) {
      return { limit: parseInt(match[1], 10) };
    }
    return { limit: 10 }; // Default to top 10 if no number specified
  }

  // Add the createRankingVisualization method
  private async createRankingVisualization(
    layerResults: LocalLayerResult[],
    options: VisualizationOptions & { limit: number }
  ): Promise<VisualizationResult> {
    try {
      const layerConfig = layerResults[0]?.layer || {};
      const rankingField = options.primaryField || layerConfig.rendererField || 'value';
      
      /*console.log('[VisualizationFactory] Creating ranking visualization:', {
        primaryField: options.primaryField,
        rendererField: layerConfig.rendererField,
        finalRankingField: rankingField,
        availableFields: layerResults[0]?.features?.[0] ? Object.keys(layerResults[0].features[0].properties || {}) : 'No features'
      });*/
      
      // Get features and ensure they have valid geometries
      const features = layerResults[0]?.features || [];
      const validFeatures = features.filter(feature => {
        // Check if feature has geometry
        if (!feature.geometry) {
          /*console.warn('Feature missing geometry:', {
            featureId: feature.properties?.FSA_ID || feature.properties?.ID
          });*/
          return false;
        }

        // Normalize geometry type to uppercase for consistent comparison
        const geometryType = feature.geometry.type.toUpperCase();
        
        // For Polygon features
        if (geometryType === 'POLYGON') {
          // Check for either rings (ArcGIS format) or coordinates (GeoJSON format)
          const hasValidStructure = (
            (Array.isArray(feature.geometry.rings) && feature.geometry.rings.length > 0) ||
            (Array.isArray(feature.geometry.coordinates) && feature.geometry.coordinates.length > 0)
          );
          
          if (!hasValidStructure) {
            /*console.warn('Polygon feature missing valid rings/coordinates:', {
              featureId: feature.properties?.FSA_ID || feature.properties?.ID,
              hasRings: Array.isArray(feature.geometry.rings),
              ringsLength: feature.geometry.rings?.length,
              hasCoordinates: Array.isArray(feature.geometry.coordinates),
              coordsLength: feature.geometry.coordinates?.length
            });*/
            return false;
          }
          
          // Ensure the coordinates are valid
          const coordinates = feature.geometry.coordinates || feature.geometry.rings;
          const hasValidCoordinates = coordinates.every((ring: number[][]) => 
            Array.isArray(ring) && ring.length >= 3 && // At least 3 points for a valid polygon
            ring.every((coord: number[]) => 
              Array.isArray(coord) && coord.length >= 2 && // Each coordinate should have at least [lon, lat]
              coord[0] >= -180 && coord[0] <= 180 && // Valid longitude
              coord[1] >= -90 && coord[1] <= 90 // Valid latitude
            )
          );
          
          if (!hasValidCoordinates) {
            /*console.warn('Polygon feature has invalid coordinates:', {
              featureId: feature.properties?.FSA_ID || feature.properties?.ID,
              sampleCoordinates: coordinates[0]?.slice(0, 3)
            });*/
            return false;
          }
          
          return true;
        }
        
        // For Point features
        if (geometryType === 'POINT') {
          const coordinates = feature.geometry.coordinates;
          if (!Array.isArray(coordinates) || coordinates.length < 2) {
            /*console.warn('Point feature missing valid coordinates:', {
              featureId: feature.properties?.FSA_ID || feature.properties?.ID
            });*/
            return false;
          }
          
          const [lon, lat] = coordinates;
          const hasValidCoordinates = (
            lon >= -180 && lon <= 180 && // Valid longitude
            lat >= -90 && lat <= 90 // Valid latitude
          );
          
          if (!hasValidCoordinates) {
            /*console.warn('Point feature has invalid coordinates:', {
              featureId: feature.properties?.FSA_ID || feature.properties?.ID,
              coordinates
            });*/
            return false;
          }
          
          return true;
        }
        
        /*console.warn('Unsupported geometry type:', {
          featureId: feature.properties?.FSA_ID || feature.properties?.ID,
          geometryType
        });*/
        return false;
      });

      if (validFeatures.length === 0) {
        throw new Error('No features with valid geometries found for visualization');
      }

      // Sort features by ranking field and convert to ArcGIS Graphics
      const topFeatures = validFeatures
        .sort((a, b) => (b.properties[rankingField] || 0) - (a.properties[rankingField] || 0))
        .slice(0, options.limit)
        .map(feature => {
          // Ensure proper geometry structure for ArcGIS
          const geometry = feature.geometry.type.toUpperCase() === 'POLYGON' 
            ? {
                type: 'polygon',
                rings: feature.geometry.rings || feature.geometry.coordinates,
                spatialReference: feature.geometry.spatialReference || { wkid: 4326 }
              }
            : {
                type: 'point',
                x: feature.geometry.coordinates[0],
                y: feature.geometry.coordinates[1],
                spatialReference: feature.geometry.spatialReference || { wkid: 4326 }
              };

          return {
            geometry,
            attributes: {
              ...feature.properties,
              OBJECTID: feature.properties.OBJECTID || feature.properties.FSA_ID || feature.properties.ID,
              // Map ID field to FSA_ID for consistent field naming
              FSA_ID: feature.properties.FSA_ID || feature.properties.ID
            }
          };
        });

      // Create visualization with proper data structure
      const rankingViz = new RankingVisualization();
      const result = await rankingViz.create({
        features: topFeatures,
        layerName: `Top ${options.limit} ${layerConfig.name || 'Areas'}`,
        rendererField: rankingField,
        layerConfig: {
          name: layerConfig.name || 'Ranking Layer',
          fields: [
            { name: 'OBJECTID', type: 'oid' as FieldType },
            { name: rankingField, type: 'double' as FieldType },
            { name: 'FSA_ID', type: 'string' as FieldType },
            { name: 'FREQUENCY', type: 'double' as FieldType }
          ]
        }
      }, {
        ...options,
        popupConfig: {
          titleExpression: "$feature.FSA_ID",
          content: [
            {
              type: "fields",
              fieldInfos: [
                { fieldName: rankingField, label: "Value", visible: true },
                { fieldName: "FREQUENCY", label: "Frequency", visible: true }
              ],
              displayType: "list"
            }
          ]
        }
      });
      
      return result;
      } catch (error) {
      console.error('Error creating ranking visualization:', error);
      return { layer: null, extent: null };
    }
  }

  private async createFactorImportanceVisualization(
    layerResults: LocalLayerResult[],
    options: VisualizationOptions
  ): Promise<VisualizationResult> {
    try {
      // console.log('[VisualizationFactory] Creating factor importance visualization');
      
      if (!layerResults || layerResults.length === 0) {
        throw new Error('[FactorImportance] No layer results provided');
      }

      const primaryLayer = layerResults[0];
      const primaryField = options.primaryField || this.findPrimaryField(primaryLayer);

      // Convert features to Graphics format expected by FactorImportanceVisualization
      const graphicsForViz = primaryLayer.features
        .map((feature, index) => {
          if (!feature || !feature.geometry) return null;

          // Create ArcGIS-compatible geometry
          const geometry = feature.geometry.type?.toUpperCase() === 'POLYGON' 
            ? {
                type: 'polygon',
                rings: feature.geometry.rings || feature.geometry.coordinates,
                spatialReference: feature.geometry.spatialReference || { wkid: 4326 }
              }
            : feature.geometry;

          return {
            geometry,
            attributes: {
              ...feature.properties,
              ...feature.attributes,
              OBJECTID: index + 1,
              primary_factor_value: feature.properties?.[primaryField] || feature.attributes?.[primaryField] || 0
            }
          };
        })
        .filter((g): g is any => g !== null);

      // Extract factor importance from enhanced analysis or generate placeholder data
      const { enhancedAnalysis } = this.visualizationIntegration;
      const factorData = {
        factors: this.extractFactorImportance(layerResults, enhancedAnalysis, primaryField),
        features: graphicsForViz,
        layerName: primaryLayer.layer.name || 'Factor Analysis',
        targetVariable: primaryField
      };

      // Create visualization
      const { FactorImportanceVisualization } = await import('./visualizations/factor-importance-visualization');
      const factorViz = new FactorImportanceVisualization();
      
      return await factorViz.create(factorData, {
        ...options,
        showTopN: 5,
        colorScheme: 'importance',
        title: options.title || `Factors Predicting ${primaryField}`
      });
    } catch (error) {
      console.error('Error creating factor importance visualization:', error);
      return { layer: null, extent: null };
    }
  }

  private extractFactorImportance(layerResults: LocalLayerResult[], enhancedAnalysis: any, primaryField: string) {
    // Extract factor importance from analysis results or create placeholder data
    const relevantFields = enhancedAnalysis?.relevantFields || [];
    
    if (relevantFields.length === 0) {
      // Generate placeholder factor data when analysis isn't available
      return [
        {
          name: 'demographic_density',
          importance: 0.73,
          correlation: 0.68,
          description: 'Population density impact on ' + primaryField,
          exampleAreas: ['High density area 1', 'High density area 2']
        },
        {
          name: 'economic_indicators',
          importance: 0.65,
          correlation: 0.61,
          description: 'Economic conditions influence on ' + primaryField,
          exampleAreas: ['Economic hub 1', 'Economic hub 2']
        },
        {
          name: 'infrastructure_access',
          importance: 0.58,
          correlation: 0.54,
          description: 'Infrastructure availability impact on ' + primaryField,
          exampleAreas: ['Well-connected area 1', 'Well-connected area 2']
        },
        {
          name: 'education_level',
          importance: 0.52,
          correlation: 0.48,
          description: 'Education level correlation with ' + primaryField,
          exampleAreas: ['Education cluster 1', 'Education cluster 2']
        },
        {
          name: 'age_distribution',
          importance: 0.45,
          correlation: 0.42,
          description: 'Age demographics impact on ' + primaryField,
          exampleAreas: ['Young demographics area', 'Mixed age area']
        }
      ];
    }

    return relevantFields.map((field: string, index: number) => ({
      name: field,
      importance: 0.8 - (index * 0.1), // Decreasing importance
      correlation: 0.7 - (index * 0.05), // Decreasing correlation
      description: `Factor ${index + 1} contributing to ${primaryField} prediction`,
      exampleAreas: ['Area1', 'Area2'] // Placeholder - could be enhanced with real data
    }));
  }

  private findPrimaryField(layerResult: LocalLayerResult): string {
    // Try to find the most suitable field for factor analysis
    const layer = layerResult.layer;
    const firstFeature = layerResult.features[0];
    
    if (layer.rendererField) {
      return layer.rendererField;
    }
    
    if (firstFeature?.properties) {
      // Look for numeric fields that could be target variables
      const numericFields = Object.keys(firstFeature.properties).filter(key => {
        const value = firstFeature.properties[key];
        return typeof value === 'number' || !isNaN(parseFloat(value));
      });
      
      // Prefer fields that might be target variables
      const targetKeywords = ['rate', 'score', 'index', 'value', 'count', 'total'];
      const targetField = numericFields.find(field => 
        targetKeywords.some(keyword => field.toLowerCase().includes(keyword))
      );
      
      return targetField || numericFields[0] || 'thematic_value';
    }
    
    return 'thematic_value';
  }

  /**
   * Extract brand name from field code for brand difference visualization
   */
  private getBrandNameFromField(field: string): string {
    const brandMap: Record<string, string> = {
      'MP30034A_B': 'Nike',
      'MP30034A_B_P': 'Nike',
      'MP30029A_B': 'Adidas',
      'MP30029A_B_P': 'Adidas',
      'MP30030A_B': 'Asics',
      'MP30030A_B_P': 'Asics',
      'MP30031A_B': 'Converse',
      'MP30031A_B_P': 'Converse',
      'MP30032A_B': 'Jordan',
      'MP30032A_B_P': 'Jordan',
      'MP30033A_B': 'New Balance',
      'MP30033A_B_P': 'New Balance',
      'MP30035A_B': 'Puma',
      'MP30035A_B_P': 'Puma',
      'MP30036A_B': 'Reebok',
      'MP30036A_B_P': 'Reebok',
      'MP30037A_B': 'Skechers',
      'MP30037A_B_P': 'Skechers'
    };
    
    // Check both uppercase and original field format
    const upperField = field.toUpperCase();
    return brandMap[upperField] || brandMap[field] || 'Brand';
  }

}

// Query type detection functions
export const isCorrelationQuery = (query: string): boolean => {
  const correlationKeywords = [
    'correlation',
    'relationship',
    'compare',
    'versus',
    'vs',
    'between',
    'against'
  ];
  
  return correlationKeywords.some(keyword => 
    query.toLowerCase().includes(keyword)
  );
};

export const is3DVisualizationQuery = (query: string): boolean => {
  const threeDKeywords = [
    '3d',
    'three dimensional',
    'height',
    'elevation',
    'terrain',
    'buildings',
    'skyline'
  ];
  
  return threeDKeywords.some(keyword => 
    query.toLowerCase().includes(keyword)
  );
};

export const isSimpleDisplayQuery = (query: string): boolean => {
  const displayKeywords = [
    '^show',
    '^display',
    '^visualize',
    '^map',
    '^where'
  ];
  
  return displayKeywords.some(keyword => 
    new RegExp(keyword, 'i').test(query)
  );
};

// Update the isTopNQuery function to handle more cases
export const isTopNQuery = (query: string): boolean => {
  const topNPatterns = [
    /top\s+\d+/i,
    /highest\s+\d+/i,
    /largest\s+\d+/i,
    /greatest\s+\d+/i,
    /show\s+\d+\s+.*(?:highest|largest|greatest|most)/i,
    /(?:highest|largest|greatest|most)\s+\d+/i,
    /(?:top|highest|largest|greatest|most)\s+(\d+)\s+(?:areas|regions|zones|locations)/i,
    /(?:top|highest|largest|greatest|most)\s+(\d+)\s+(?:by|in|of|for)/i,
    // Add patterns for queries without explicit numbers
    /^(?:which|what|show|find|list|display)\s+(?:areas?|regions?|zones?|locations?)\s+(?:have|has|with)\s+(?:the\s+)?(?:most|highest|largest|greatest)/i,
    /^(?:most|highest|largest|greatest)\s+(?:areas?|regions?|zones?|locations?)/i,
    /^(?:which|what|show|find|list|display)\s+(?:areas?|regions?|zones?|locations?)\s+(?:have|has)\s+(?:the\s+)?(?:most|highest|largest|greatest)/i,
    // Add patterns for application-specific queries
    /^(?:which|what|show|find|list|display)\s+(?:areas?|regions?|zones?|locations?)\s+(?:have|has|with)\s+(?:the\s+)?(?:most|highest|largest|greatest)\s+applications?/i,
    /^(?:most|highest|largest|greatest)\s+applications?/i,
    /^(?:areas?|regions?|zones?|locations?)\s+(?:with|having)\s+(?:the\s+)?(?:most|highest|largest|greatest)\s+applications?/i,
    // Add patterns for simple "most applications" queries
    /^(?:which|what|show|find|list|display)\s+(?:areas?|regions?|zones?|locations?)\s+(?:have|has|with)\s+(?:the\s+)?most\s+applications?/i,
    /^most\s+applications?/i,
    /^areas?\s+(?:with|having)\s+(?:the\s+)?most\s+applications?/i
  ];
  
  const isTopN = topNPatterns.some(pattern => pattern.test(query));
  //  console.log('TopN query detection:', { query, isTopN });
  return isTopN;
};

// Helper function to determine type from results

// Helper functions
export function createCorrelationData(
  features: any[],
  primaryField: string,
  comparisonField: string
): CorrelationData {
  const processedFeatures = features.map((feature, index) => ({
    attributes: {
      OBJECTID: index + 1,
      primary_value: feature.attributes?.[primaryField] || 0,
      comparison_value: feature.attributes?.[comparisonField] || 0,
      correlation_strength: 0
    },
    geometry: feature.geometry
  }));

  return {
    features: processedFeatures,
    layerName: 'Correlation Analysis',
    rendererField: 'correlation_strength',
    primaryField,
    comparisonField,
    primaryLayerId: '',
    comparisonLayerId: '',
    layerConfig: {
      name: 'Correlation Analysis',
      fields: [
        { name: 'OBJECTID', type: 'oid' },
        { name: 'primary_value', type: 'double' },
        { name: 'comparison_value', type: 'double' },
        { name: 'correlation_strength', type: 'double' }
      ]
    }
  };
} 