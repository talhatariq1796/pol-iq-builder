/**
 * MultiLayerAnalysis class handles analysis operations across multiple data layers
 */
import { Feature, FeatureCollection } from "geojson";
import { EnhancedAnalysisResult } from "../components/geospatial/enhanced-analysis-types";

// Define layer interface based on the logs
interface LayerInfo {
  layerId: string;
  relevance: number;
  matchMethod: string;
  confidence: number;
  reasons: string[];
}

/**
 * MultiLayerAnalysis class provides utilities for handling queries that require data from multiple layers
 */
export class MultiLayerAnalysis {
  /**
   * Identifies if a query requires multi-layer analysis based on analysis result
   * @param analysisResult The initial analysis results from query processing
   * @returns boolean indicating if multi-layer analysis is required
   */
  static isMultiLayerQuery(analysisResult: any): boolean {
    // Check if layers property exists
    if (!analysisResult.layers || !Array.isArray(analysisResult.layers)) {
      console.log("[MultiLayerAnalysis] No layers property found in analysis result");
      return false;
    }
    
    // Check for multiple layers with significant relevance
    const significantLayers = analysisResult.layers
      .filter((layer: LayerInfo) => layer.relevance >= 20);
    
    // Handle keywords in the query that indicate conversion and other concepts
    const queryText = (analysisResult.originalQueryType || '').toLowerCase();
    const queryHasConversion = queryText.includes('conversion');
    
    // If we have 2+ layers with significant relevance, update relevant layers
    if (significantLayers.length >= 2) {
      console.log("[MultiLayerAnalysis] Multiple significant layers detected:", 
        significantLayers.map((l: LayerInfo) => `Layer ${l.layerId} (${l.relevance}%)`).join(", "));
      
      // Update the relevant layers in the analysis result to include all significant layers
      analysisResult.relevantLayers = significantLayers.map((layer: LayerInfo) => layer.layerId);
      console.log("[MultiLayerAnalysis] Updated relevantLayers:", analysisResult.relevantLayers);
      
      // Update relevant fields if needed
      if (!analysisResult.relevantFields || analysisResult.relevantFields.length < 2) {
        // Look for potential field names in the reasons
        const potentialFields: string[] = [];
        significantLayers.forEach((layer: LayerInfo) => {
          layer.reasons.forEach(reason => {
            const fieldMatch = reason.match(/Matched .+: (.+)/);
            if (fieldMatch && fieldMatch[1]) {
              potentialFields.push(fieldMatch[1].toUpperCase().replace(/\s+/g, ''));
            }
          });
        });
        
        // Add unique fields
        if (potentialFields.length > 0) {
          const uniqueFields = [...new Set([...(analysisResult.relevantFields || []), ...potentialFields])];
          analysisResult.relevantFields = uniqueFields;
          console.log("[MultiLayerAnalysis] Updated relevantFields:", analysisResult.relevantFields);
        }
      }
      
      return true;
    }
    
    // Check for multi-metric keywords in query
    const multiMetricKeywords = ["both", "and", "correlation", "relationship", "combined", "together", "versus", "vs"];
    const hasMultiMetricKeywords = multiMetricKeywords.some(keyword => 
      queryText.includes(keyword));
      
    if (hasMultiMetricKeywords) {
      console.log("[MultiLayerAnalysis] Multi-metric keywords detected in query");
      return true;
    }
    
    return false;
  }
  
  /**
   * Determines the multi-layer analysis pattern from the query intent
   * @param analysisResult The initial analysis results 
   * @returns The appropriate visualization approach for the multi-layer analysis
   */
  static determineVisualizationApproach(analysisResult: EnhancedAnalysisResult): string {
    const query = analysisResult.originalQueryType?.toLowerCase() || "";
    const intent = analysisResult.intent;
    
    // Check for specific patterns defined in the workflow
    if (query.includes("both") || query.includes("highest") || 
        (query.includes("high") && query.includes("and"))) {
      return "joint_high";
    }
    
    if (query.includes("relationship") || query.includes("correlation") || 
        query.includes("versus") || query.includes("vs")) {
      return "correlation";
    }
    
    if (query.includes("compared to") || query.includes("comparison")) {
      return "comparative";
    }
    
    if (query.includes("where") && (query.includes("high") || query.includes("low"))) {
      return "conditional";
    }
    
    // Default based on intent
    switch (intent) {
      case "ranking":
        return "ranked_multi_metric";
      case "comparison":
        return "comparative";
      case "distribution":
        return "bivariate";
      default:
        return "joint_high"; // Default approach
    }
  }
  
  /**
   * Integrates data from multiple layers based on common geography or identifiers
   * @param layerData Array of feature collections from different layers
   * @param layerIds IDs corresponding to each layer in layerData
   * @param analysisResult The analysis results
   * @param layerConfigsObject The map of layer configs for all layers
   * @returns Combined feature collection with merged attributes
   */
  static combineLayerData(
    layerData: FeatureCollection[], 
    layerIds: string[],
    analysisResult: EnhancedAnalysisResult,
    layerConfigsObject: Record<string, any>
  ): FeatureCollection {
    console.error("[MultiLayerAnalysis][DEBUG] combineLayerData called", { layerDataLength: layerData.length, layerIds });
    
    if (!layerData.length || !layerIds.length) {
      console.error("[MultiLayerAnalysis] No layer data provided");
      return {
        type: "FeatureCollection",
        features: []
      };
    }
    
    // --- On-the-fly unique field renaming for multi-layer analysis ---
    // Build a map of layerId -> unique field name
    const uniqueFieldNames: Record<string, string> = {};
    layerIds.forEach((layerId, idx) => {
      const config = layerConfigsObject[layerId];
      // Use config fields for unique field naming, but actual field detection is per-feature
      const baseField = config?.microserviceField || config?.rendererField || 'thematic_value';
      uniqueFieldNames[layerId] = `${baseField}_${layerId}`;
    });
    // console.log('[MultiLayerAnalysis] Unique field names per layer:', uniqueFieldNames);
    (MultiLayerAnalysis as any).lastUniqueFieldNames = uniqueFieldNames;

    // === NEW: Build a mapping from required field to (layerId, source property) ===
    // This assumes required fields are named like <property>_<layerId> (e.g., CONVERSION_RATE_66)
    const requiredFieldMap: Record<string, { layerId: string | null, sourceProp: string }> = {};
    const relevantFields = analysisResult.relevantFields || [];
    relevantFields.forEach(field => {
      // Try to extract layerId from field name (e.g., thematic_value_25, CONVERSION_RATE_66)
      const match = field.match(/(.+)_([0-9]+)$/);
      if (match) {
        const sourceProp = match[1];
        const layerId = match[2];
        requiredFieldMap[field] = { layerId, sourceProp };
      } else {
        // Fallback: use as-is, try to find in any layer
        requiredFieldMap[field] = { layerId: null, sourceProp: field };
      }
    });

    // Helper to detect the available metric field for a feature
    function getAvailableField(feature: Feature, config: any) {
      if (!feature.properties) return null;
      const props = feature.properties;
      // Try microserviceField
      if (config?.microserviceField && props && Object.prototype.hasOwnProperty.call(props, config.microserviceField)) {
        return config.microserviceField;
      }
      // Try rendererField
      if (config?.rendererField && props && Object.prototype.hasOwnProperty.call(props, config.rendererField)) {
        return config.rendererField;
      }
      // Try CONVERSION_RATE if CONVERSIONRATE is not found
      if (props && Object.prototype.hasOwnProperty.call(props, 'CONVERSIONRATE')) {
        return 'CONVERSIONRATE';
      }
      if (props && Object.prototype.hasOwnProperty.call(props, 'CONVERSION_RATE')) {
        return 'CONVERSION_RATE';
      }
      // Try thematic_value
      if (props && Object.prototype.hasOwnProperty.call(props, 'thematic_value')) {
        return 'thematic_value';
      }
      // Fallback: first numeric field
      return Object.keys(props).find(
        k => typeof props[k] === 'number'
      );
    }

    // --- Merge features and rename fields on the fly ---
    const renamedLayerData = layerData.map((fc, idx) => {
      const layerId = layerIds[idx];
      const config = layerConfigsObject[layerId];
      const newField = uniqueFieldNames[layerId];
      return {
        ...fc,
        features: fc.features.map(f => {
          if (!f.properties) return f;
          // Only set the unique field if the configured field exists
          let value = null;
          if (config?.microserviceField && Object.prototype.hasOwnProperty.call(f.properties, config.microserviceField)) {
            value = f.properties[config.microserviceField];
          } else if (config?.rendererField && Object.prototype.hasOwnProperty.call(f.properties, config.rendererField)) {
            value = f.properties[config.rendererField];
          } else {
            value = null;
          }
          f.properties[newField] = value;
          // Optionally delete the original field if you want
          // if (config?.microserviceField && config.microserviceField !== newField) delete f.properties[config.microserviceField];
          // if (config?.rendererField && config.rendererField !== newField) delete f.properties[config.rendererField];
          return f;
        })
      };
    });

    // Get the primary layer (usually the highest relevance)
    const primaryLayerIndex = 0; // Assuming first layer is primary
    const primaryLayer = renamedLayerData[primaryLayerIndex];
    const primaryLayerId = layerIds[primaryLayerIndex];
    
    // Initialize combined features from primary layer
    const combinedFeatures: Feature[] = primaryLayer.features.map(feature => ({
      ...feature,
      properties: {
        ...feature.properties,
        _primaryLayerId: primaryLayerId,
      }
    }));
    
    // Helper function to validate feature properties
    function validateFeatureProperties(feature: Feature): boolean {
      if (!feature.properties) return false;
      const props = feature.properties;
      
      // Check for required fields
      const hasRequiredFields = ['ID', 'OBJECTID', 'FID', 'NAME'].some(field => 
        props[field] !== undefined && props[field] !== null
      );
      
      // Validate geometry
      const hasValidGeometry = feature.geometry && 
        feature.geometry.type && 
        'coordinates' in feature.geometry;
        
      return hasRequiredFields && hasValidGeometry;
    }

    // Helper function to normalize identifier
    function normalizeIdentifier(id: any): string {
      if (typeof id === 'string') {
        return id.toLowerCase().trim();
      }
      return String(id).toLowerCase().trim();
    }

    // Helper function to find matching feature
    function findMatchingFeature(
      primaryFeature: Feature,
      secondaryFeatures: Feature[],
      joinKeys: string[] = ["ID"]
    ): { feature: Feature | undefined; matchedKey: string | null; confidence: number } {
      let bestMatch: Feature | undefined;
      let matchedKey: string | null = null;
      let highestConfidence = 0;

      for (const idField of joinKeys) {
        const primaryValue = primaryFeature.properties?.[idField];
        if (!primaryValue) continue;

        const normalizedPrimaryValue = normalizeIdentifier(primaryValue);

        for (const secondaryFeature of secondaryFeatures) {
          const secondaryValue = secondaryFeature.properties?.[idField];
          if (!secondaryValue) continue;

          const normalizedSecondaryValue = normalizeIdentifier(secondaryValue);
          let confidence = 0;

          // Exact match
          if (normalizedPrimaryValue === normalizedSecondaryValue) {
            confidence = 1.0;
          }
          // Case-insensitive match for NAME field
          else if (idField === "NAME" && 
                   typeof primaryValue === "string" && 
                   typeof secondaryValue === "string") {
            if (normalizedPrimaryValue === normalizedSecondaryValue) {
              confidence = 0.9;
            }
            // Partial match for names
            else if (normalizedPrimaryValue.includes(normalizedSecondaryValue) || 
                     normalizedSecondaryValue.includes(normalizedPrimaryValue)) {
              confidence = 0.7;
            }
          }

          if (confidence > highestConfidence) {
            highestConfidence = confidence;
            bestMatch = secondaryFeature;
            matchedKey = idField;
          }
        }
      }

      return { feature: bestMatch, matchedKey, confidence: highestConfidence };
    }

    // Update the feature matching section in combineLayerData
    for (let i = 1; i < renamedLayerData.length; i++) {
      const secondaryLayer = renamedLayerData[i];
      const layerId = layerIds[i];
      const config = layerConfigsObject[layerId];
      
      // Validate secondary layer features
      const validSecondaryFeatures = secondaryLayer.features.filter(validateFeatureProperties);
      
      if (validSecondaryFeatures.length === 0) {
        console.warn(`[MultiLayerAnalysis] No valid features found in secondary layer ${layerId}`);
        continue;
      }

      // Match and merge features
      combinedFeatures.forEach(combinedFeature => {
        if (!validateFeatureProperties(combinedFeature)) {
          console.warn(`[MultiLayerAnalysis] Invalid primary feature:`, combinedFeature);
          return;
        }

        const { feature: matchingFeature, matchedKey, confidence } = findMatchingFeature(
          combinedFeature,
          validSecondaryFeatures,
          ["ID"]
        );

        if (matchingFeature) {
          // Log match details for debugging
          console.log(`[MultiLayerAnalysis] Matched feature:`, {
            primaryId: combinedFeature.properties?.ID,
            secondaryId: matchingFeature.properties?.ID,
            matchedKey,
            confidence
          });

          // Merge properties with confidence score
          if (!combinedFeature.properties) {
            combinedFeature.properties = {};
          }
          
          // Add the matched field value
          const newField = uniqueFieldNames[layerId];
          if (newField && matchingFeature.properties) {
            combinedFeature.properties[newField] = matchingFeature.properties[newField];
          }
          
          // Add metadata about the match
          if (combinedFeature.properties) {
            combinedFeature.properties[`_match_${layerId}`] = {
              confidence,
              matchedKey,
              timestamp: new Date().toISOString()
            };
          }
        } else {
          // Log unmatched feature
          console.warn(`[MultiLayerAnalysis] No match found for primary feature:`, {
            id: combinedFeature.properties?.ID,
            layerId
          });
          
          // Set null value for the field
          const newField = uniqueFieldNames[layerId];
          if (newField && combinedFeature.properties) {
            combinedFeature.properties[newField] = null;
          }
        }
      });
    }

    // === NEW: For each combined feature, explicitly set all required fields ===
    combinedFeatures.forEach((f, idx) => {
      if (!f.properties) {
        f.properties = {};  // Initialize empty properties object if null
        console.warn(`[MultiLayerAnalysis] Feature at index ${idx} had null properties, initialized empty object`);
      }

      // At this point, f.properties is guaranteed to be an object
      const properties = f.properties;
      
      // Guarantee all relevant fields are present and set to null if missing or undefined
      console.log(`[MultiLayerAnalysis][DEBUG] relevantFields:`, relevantFields);
      console.log(`[MultiLayerAnalysis][DEBUG] feature properties before null check:`, properties);
      relevantFields.forEach(field => {
        if (properties[field] === undefined) {
          properties[field] = null;
          console.log(`[MultiLayerAnalysis][DEBUG] Set missing or undefined field '${field}' to null for feature at index ${idx}`);
        }
      });
    });

    // === DEBUG: Print a sample merged feature and required fields ===
    if (combinedFeatures.length > 0) {
      const sampleKeys = Object.keys(combinedFeatures[0].properties || {});
      console.log('[MultiLayerAnalysis] Sample merged feature keys:', sampleKeys);
      console.log('[MultiLayerAnalysis] Required fields:', relevantFields);
    }

    // === DEBUG: Warn if any combined feature is missing required fields ===
    combinedFeatures.forEach((f, idx) => {
      const missingFields = relevantFields.filter((field) => !(f.properties && f.properties[field] !== undefined && f.properties[field] !== null));
      if (missingFields.length > 0) {
        console.warn(`[MultiLayerAnalysis] Feature at index ${idx} is missing required fields: ${missingFields.join(', ')}`);
      }
    });
    
    // Log sample ID values from both sources before joining
    if (primaryLayer && primaryLayer.features && primaryLayer.features.length > 0) {
      const primaryIDs = primaryLayer.features
        .map(f => f.properties?.ID)
        .filter(id => id !== undefined && id !== null)
        .slice(0, 10);
      console.log('[MultiLayerAnalysis][DEBUG] Sample primary (microservice) IDs:', primaryIDs);
    }
    for (let i = 1; i < renamedLayerData.length; i++) {
      const secondaryLayer = renamedLayerData[i];
      if (secondaryLayer && secondaryLayer.features && secondaryLayer.features.length > 0) {
        const secondaryIDs = secondaryLayer.features
          .map(f => f.properties?.ID)
          .filter(id => id !== undefined && id !== null)
          .slice(0, 10);
        console.log(`[MultiLayerAnalysis][DEBUG] Sample secondary (ArcGIS) IDs for layer ${layerIds[i]}:`, secondaryIDs);
      }
    }
    
    return {
      type: "FeatureCollection",
      features: combinedFeatures
    };
  }
  
  /**
   * Normalizes values from different metrics to make them comparable
   * @param combinedData Feature collection with combined data
   * @param metrics Array of metric field names to normalize
   * @returns Updated feature collection with normalized values
   */
  static normalizeMetrics(
    combinedData: FeatureCollection, 
    metrics: string[]
  ): FeatureCollection {
    console.log("[MultiLayerAnalysis] Normalizing metrics:", metrics.join(", "));
    
    // For each metric, find min and max values
    const ranges: Record<string, { min: number, max: number }> = {};
    
    metrics.forEach(metric => {
      const values = combinedData.features
        .map(f => f.properties?.[metric])
        .filter(val => val !== null && val !== undefined)
        .map(val => parseFloat(val as string));
      
      if (values.length > 0) {  
        ranges[metric] = {
          min: Math.min(...values),
          max: Math.max(...values)
        };
      }
    });
    
    // Normalize values to 0-1 range
    combinedData.features.forEach(feature => {
      if (!feature.properties) return;
      const props = feature.properties;
      metrics.forEach(metric => {
        const value = props[metric];
        if (value === null || value === undefined) return;
        const range = ranges[metric];
        if (range && range.max !== range.min) {
          const normalizedValue = (parseFloat(value as string) - range.min) / (range.max - range.min);
          props[`${metric}_normalized`] = normalizedValue;
        } else {
          props[`${metric}_normalized`] = 1; // Single value case
        }
      });
      // If we have two normalized metrics, calculate a combined score
      if (metrics.length >= 2) {
        const normalizedValues = metrics
          .map(m => props[`${m}_normalized`])
          .filter(v => v !== undefined);
        if (normalizedValues.length >= 2) {
          // Calculate arithmetic mean as the combined score
          props["combined_score"] = 
            normalizedValues.reduce((sum, val) => sum + (val ?? 0), 0) / normalizedValues.length;
        }
      }
    });
    
    return combinedData;
  }
}
