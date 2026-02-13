import { FIELD_ALIASES } from '../field-aliases';
import { layers } from '../../config/layers';
import type { LayerConfig } from '../../types/layers';

/**
 * A definitive mapping from field codes to their desired human-readable display name.
 * Auto-generated from actual endpoint data fields.
 * Generated: 2025-09-02T12:05:31.884Z
 * Total fields: 268 from 52 endpoints
 */
const FIELD_CODE_TO_DISPLAY_NAME: Record<string, string> = {
    // === SYSTEM ===
    "CreationDate": "Creation Date",
    "Creator": "Creator",
    "DESCRIPTION": "Area Description",
    "EditDate": "Edit Date",
    "Editor": "Editor",
    "ID": "Area ID",
    "OBJECTID": "Object ID",
    "Shape__Area": "Geographic Area",
    "Shape__Length": "Geographic Perimeter",
    "thematic_value": "Thematic Value",

    // === MP CODES ===
    "MP10002A_B": "MP10002 Count",
    "MP10002A_B_P": "MP10002 Percentage",
    "MP10020A_B": "MP10020 Count",
    "MP10020A_B_P": "MP10020 Percentage",
    "MP10028A_B": "MP10028 Count",
    "MP10028A_B_P": "MP10028 Percentage",
    "MP10104A_B": "MP10104 Count",
    "MP10104A_B_P": "MP10104 Percentage",
    "MP10110A_B": "MP10110 Count",
    "MP10110A_B_P": "MP10110 Percentage",
    "MP10116A_B": "MP10116 Count",
    "MP10116A_B_P": "MP10116 Percentage",
    "MP10120A_B": "MP10120 Count",
    "MP10120A_B_P": "MP10120 Percentage",
    "MP10128A_B": "MP10128 Count",
    "MP10128A_B_P": "MP10128 Percentage",
    "MP10138A_B": "MP10138 Count",
    "MP10138A_B_P": "MP10138 Percentage",
    "MP12097A_B": "MP12097 Count",
    "MP12097A_B_P": "MP12097 Percentage",
    "MP12205A_B": "MP12205 Count",
    "MP12205A_B_I": "MP12205 Count",
    "MP12205A_B_P": "MP12205 Percentage",
    "MP12206A_B": "MP12206 Count",
    "MP12206A_B_I": "MP12206 Count",
    "MP12206A_B_P": "MP12206 Percentage",
    "MP12207A_B": "MP12207 Count",
    "MP12207A_B_I": "MP12207 Count",
    "MP12207A_B_P": "MP12207 Percentage",
    "MP13019A_B": "MP13019 Count",
    "MP13019A_B_I": "MP13019 Count",
    "MP13019A_B_P": "MP13019 Percentage",
    "MP13023A_B": "MP13023 Count",
    "MP13023A_B_I": "MP13023 Count",
    "MP13023A_B_P": "MP13023 Percentage",
    "MP13026A_B": "MP13026 Count",
    "MP13026A_B_I": "MP13026 Count",
    "MP13026A_B_P": "MP13026 Percentage",
    "MP13029A_B": "MP13029 Count",
    "MP13029A_B_I": "MP13029 Count",
    "MP13029A_B_P": "MP13029 Percentage",
    "MP14029A_B": "MP14029 Count",
    "MP14029A_B_I": "MP14029 Count",
    "MP14029A_B_P": "MP14029 Percentage",
    "MP28591A_B": "MP28591 Count",
    "MP28591A_B_I": "MP28591 Count",
    "MP28591A_B_P": "MP28591 Percentage",
    "MP28646A_B": "MP28646 Count",
    "MP28646A_B_I": "MP28646 Count",
    "MP28646A_B_P": "MP28646 Percentage",

    // === X CODES ===
    "X14058_X": "X14058 Spending",
    "X14058_X_A": "X14058 Average Spending",
    "X14060_X": "X14060 Spending",
    "X14060_X_A": "X14060 Average Spending",
    "X14068_X": "X14068 Spending",
    "X14068_X_A": "X14068 Average Spending",

    // === GENERATION ===
    "GENALPHACY": "Generation Alpha Population",
    "GENALPHACY_P": "Generation Alpha Percentage",
    "GENALPHAFY": "GENALPHAFY",
    "GENALPHAFY_P": "GENALPHAFY P",
    "GENZ_CY": "Generation Z Population",
    "GENZ_CY_P": "Generation Z Percentage",
    "GENZ_FY": "GENZ FY",
    "GENZ_FY_P": "GENZ FY P",

    // === LOCATION ===
    "LATITUDE": "Latitude",
    "LONGITUDE": "Longitude",
    "address": "Address",
    "country": "Country",
    "locality": "Locality",
    "name": "Name",
    "postcode": "Postal Code",
    "region": "Region",

    // === ANALYSIS SCORES ===
    "algorithm_agreement_score": "Algorithm Agreement Score",
    "algorithm_comparison_score": "Algorithm Comparison Score",
    "algorithm_performance_score": "Algorithm Performance Score",
    "algorithm_reliability_score": "Algorithm Reliability Score",
    "algorithm_suitability_score": "Algorithm Suitability Score",
    "alternative_algorithm_score": "Alternative Algorithm Score",
    "analysis_score": "Analysis Score",
    "anomaly_insight_score": "Anomaly Insight Score",
    "anomaly_insights_score": "Anomaly Insights Score",
    "anomaly_performance_score": "Anomaly Performance Score",
    "anomaly_reliability_score": "Anomaly Reliability Score",
    "anomaly_score": "Anomaly Score",
    "anomaly_significance_score": "Anomaly Significance Score",
    "behavioral_score": "Behavioral Score",
    "best_algorithm_confidence_score": "Best Algorithm Confidence Score",
    "brand_difference_score": "Brand Difference Score",
    "cluster_score": "Cluster Score",
    "comparison_score": "Comparison Score",
    "competitive_score": "Competitive Score",
    "component_significance_score": "Component Significance Score",
    "consensus_analysis_score": "Consensus Analysis Score",
    "consensus_confidence_score": "Consensus Confidence Score",
    "consensus_performance_score": "Consensus Performance Score",
    "consensus_score": "Consensus Score",
    "correlation_score": "Correlation Score",
    "customer_profile_score": "Customer Profile Score",
    "data_complexity_score": "Data Complexity Score",
    "demographic_insights_score": "Demographic Insights Score",
    "demographic_score": "Demographic Score",
    "dimensionality_insights_score": "Dimensionality Insights Score",
    "dimensionality_performance_score": "Dimensionality Performance Score",
    "dimensionality_reduction_benefit_score": "Dimensionality Reduction Benefit Score",
    "dimensionality_score": "Dimensionality Score",
    "ensemble_analysis_score": "Ensemble Analysis Score",
    "ensemble_confidence_score": "Ensemble Confidence Score",
    "ensemble_opportunity_score": "Ensemble Opportunity Score",
    "ensemble_performance_score": "Ensemble Performance Score",
    "ensemble_reliability_score": "Ensemble Reliability Score",
    "ensemble_strength_score": "Ensemble Strength Score",
    "feature_compression_score": "Feature Compression Score",
    "feature_importance_clarity_score": "Feature Importance Clarity Score",
    "feature_relationship_strength_score": "Feature Relationship Strength Score",
    "importance_score": "Importance Score",
    "interaction_score": "Interaction Score",
    "interpretability_benefit_score": "Interpretability Benefit Score",
    "investigation_priority_score": "Investigation Priority Score",
    "lifestyle_score": "Lifestyle Score",
    "market_anomaly_value_score": "Market Anomaly Value Score",
    "market_context_score": "Market Context Score",
    "model_agreement_score": "Model Agreement Score",
    "model_component_strength_score": "Model Component Strength Score",
    "model_diversity_benefit_score": "Model Diversity Benefit Score",
    "model_performance_prediction_score": "Model Performance Prediction Score",
    "model_selection_performance_score": "Model Selection Performance Score",
    "model_selection_score": "Model Selection Score",
    "multi_model_value_score": "Multi Model Value Score",
    "opportunity_detection_score": "Opportunity Detection Score",
    "outlier_score": "Outlier Score",
    "outlier_strength_score": "Outlier Strength Score",
    "performance_score": "Performance Score",
    "prediction_consensus_score": "Prediction Consensus Score",
    "prediction_precision_score": "Prediction Precision Score",
    "prediction_reliability_score": "Prediction Reliability Score",
    "prediction_score": "Prediction Score",
    "r2_score": "R2 Score",
    "recommendation_confidence_score": "Recommendation Confidence Score",
    "scenario_score": "Scenario Score",
    "segment_score": "Segment Score",
    "selection_reliability_score": "Selection Reliability Score",
    "sensitivity_score": "Sensitivity Score",
    "strategic_score": "Strategic Score",
    "strategic_value_score": "Strategic Value Score",
    "trend_score": "Trend Score",
    "uncertainty_quantification_score": "Uncertainty Quantification Score",
    "voting_consensus_strength_score": "Voting Consensus Strength Score",

    // === OTHER ===
    "ADDR": "ADDR",
    "AFFILIATE": "AFFILIATE",
    "BRAND": "BRAND",
    "CITY": "CITY",
    "CONAME": "CONAME",
    "DESC_": "DESC ",
    "DIVINDX_CY": "DIVINDX CY",
    "DIVINDX_FY": "DIVINDX FY",
    "EMPNUM": "EMPNUM",
    "ESRI_PID": "ESRI PID",
    "HQNAME": "HQNAME",
    "INDUSTRY_DESC": "INDUSTRY DESC",
    "LOC_CONF": "LOC CONF",
    "MAX_SQFT": "MAX SQFT",
    "MEDAGE_CY": "MEDAGE CY",
    "MEDAGE_FY": "MEDAGE FY",
    "MEDHINC_CY": "MEDHINC CY",
    "MEDHINC_FY": "MEDHINC FY",
    "MIN_SQFT": "MIN SQFT",
    "NAICS": "NAICS",
    "NAICS_ALL": "NAICS ALL",
    "PLACETYPE": "PLACETYPE",
    "SALESVOL": "SALESVOL",
    "SIC": "SIC",
    "SIC_ALL": "SIC ALL",
    "SOURCE": "SOURCE",
    "SQFOOTAGE": "SQFOOTAGE",
    "STATE": "STATE",
    "STATE_NAME": "STATE NAME",
    "TOTPOP_CY": "TOTPOP CY",
    "TOTPOP_FY": "TOTPOP FY",
    "ZIP": "ZIP",
    "ZIP4": "ZIP4",
    "_originalId": " OriginalId",
    "_zipExtractionFailed": " ZipExtractionFailed",
    "algorithm_agreement": "Algorithm Agreement",
    "algorithm_category": "Algorithm Category",
    "algorithm_predictions": "Algorithm Predictions",
    "alternative_algorithms": "Alternative Algorithms",
    "anomaly_category": "Anomaly Category",
    "anomaly_explanation": "Anomaly Explanation",
    "anomaly_type": "Anomaly Type",
    "area_sq_km": "Area Sq Km",
    "best_algorithm": "Best Algorithm",
    "brand_loyalty_indicator": "Brand Loyalty Indicator",
    "center_point": "Center Point",
    "clear_feature_hierarchy": "Clear Feature Hierarchy",
    "cluster_id": "Cluster Id",
    "competitive_position": "Competitive Position",
    "component_contributions": "Component Contributions",
    "component_weights": "Component Weights",
    "consensus_prediction": "Consensus Prediction",
    "consensus_quality": "Consensus Quality",
    "data_complexity_category": "Data Complexity Category",
    "data_reliability": "Data Reliability",
    "demographic_alignment": "Demographic Alignment",
    "ensemble_included": "Ensemble Included",
    "ensemble_prediction": "Ensemble Prediction",
    "esri_pid": "Esri Pid",
    "exceptional_confidence": "Exceptional Confidence",
    "feature_importance": "Feature Importance",
    "feature_loadings": "Feature Loadings",
    "feature_name": "Feature Name",
    "fsq_category": "Fsq Category",
    "fsq_category_all": "Fsq Category All",
    "geometry": "Geometry",
    "high_compression_efficiency": "High Compression Efficiency",
    "high_confidence_recommendation": "High Confidence Recommendation",
    "high_model_agreement": "High Model Agreement",
    "high_opportunity_anomaly": "High Opportunity Anomaly",
    "high_performance_expected": "High Performance Expected",
    "high_performance_prediction": "High Performance Prediction",
    "importance_value": "Importance Value",
    "interpretable_choice": "Interpretable Choice",
    "investigation_recommended": "Investigation Recommended",
    "is_anomaly": "Is Anomaly",
    "lifestyle_alignment": "Lifestyle Alignment",
    "low_uncertainty": "Low Uncertainty",
    "mae": "Mae",
    "market_opportunity": "Market Opportunity",
    "market_scale": "Market Scale",
    "model_contributions": "Model Contributions",
    "model_name": "Model Name",
    "model_predictions": "Model Predictions",
    "opportunity_rating": "Opportunity Rating",
    "optimal_algorithm_match": "Optimal Algorithm Match",
    "performance_metrics": "Performance Metrics",
    "persona_type": "Persona Type",
    "pointCount": "PointCount",
    "positive_market_signal": "Positive Market Signal",
    "prediction_confidence": "Prediction Confidence",
    "prediction_interval": "Prediction Interval",
    "primary_component_interpretation": "Primary Component Interpretation",
    "profile_category": "Profile Category",
    "purchase_propensity": "Purchase Propensity",
    "rank": "Rank",
    "recommendation_confidence": "Recommendation Confidence",
    "recommended_algorithm": "Recommended Algorithm",
    "reliable_consensus": "Reliable Consensus",
    "rmse": "Rmse",
    "selection_reasoning": "Selection Reasoning",
    "significant_dimensionality_reduction": "Significant Dimensionality Reduction",
    "source": "Source",
    "strong_feature_relationships": "Strong Feature Relationships",
    "strong_outlier": "Strong Outlier",
    "strong_voting_consensus": "Strong Voting Consensus",
    "target_confidence": "Target Confidence",
    "training_records": "Training Records",
    "uncertainty_measures": "Uncertainty Measures",
    "variance_explained": "Variance Explained",
    "voting_results": "Voting Results",

    // === CALCULATED/DERIVED FIELDS ===
    "total_population": "Total Population",
    "median_income": "Median Income",
    "market_gap": "Market Gap Opportunity",
    "diversity_index": "Diversity Index",
    "nike_market_share": "Nike Market Share",
    "population": "Population"
};

/**
 * Centralized field mapping helper for consistent human-readable field names
 * across all visualizations (popups, legends, analysis)
 */
export class FieldMappingHelper {
  
  // Create reverse lookup once for performance
  private static reverseMapping: Record<string, string> | null = null;
  
  /**
   * Build a simple reverse mapping from field codes to the first-found alias.
   * NOTE: This is for general-purpose lookup and may not be the "clean" display name.
   * For display purposes, use getFriendlyFieldName.
   */
  private static buildReverseMapping(): Record<string, string> {
    if (this.reverseMapping) return this.reverseMapping;
    
    const fieldCodeToName: Record<string, string> = {};
    
    // Build a basic reverse mapping.
    // Since multiple aliases map to one code, this is not guaranteed to be the "display" name.
    Object.entries(FIELD_ALIASES).forEach(([humanName, fieldCode]) => {
      if (!fieldCodeToName[fieldCode]) {
        fieldCodeToName[fieldCode] = humanName;
      }
    });
    
    this.reverseMapping = fieldCodeToName;
    return fieldCodeToName;
  }
  
  /**
   * Get human-readable field name with consistent processing.
   * This is the primary method for getting UI-friendly names.
   * @param fieldName - Raw field name from endpoint data
   * @param layerId - Optional layer ID for additional context
   * @returns Human-readable field name
   */
  static getFriendlyFieldName(fieldName: string, layerId?: string): string {
    // First check the exact field name in our comprehensive mapping
    if (FIELD_CODE_TO_DISPLAY_NAME[fieldName]) {
      return FIELD_CODE_TO_DISPLAY_NAME[fieldName];
    }
    
    // Then try without any prefixes
    let actualFieldName = (fieldName.split('.').pop() || fieldName).replace(/^value_/, '');
    if (FIELD_CODE_TO_DISPLAY_NAME[actualFieldName]) {
      return FIELD_CODE_TO_DISPLAY_NAME[actualFieldName];
    }
    
    // Strip any 'value_' prefix or other artifacts and normalize
    const lookupKey = actualFieldName
      .toUpperCase()
      .replace(/[_\s]/g, ''); // Remove both underscores and spaces

    // Check our definitive display name map with normalized key
    if (FIELD_CODE_TO_DISPLAY_NAME[lookupKey]) {
      return FIELD_CODE_TO_DISPLAY_NAME[lookupKey];
    }

    // Handle special correlation format
    if (actualFieldName.includes('_vs_') && actualFieldName.includes('_correlation')) {
      const parts = actualFieldName.replace('_correlation', '').split('_vs_');
      if (parts.length === 2) {
        const field1Name = this.getFriendlyFieldName(parts[0]);
        const field2Name = this.getFriendlyFieldName(parts[1]);
        return `${field1Name} vs. ${field2Name} Correlation`;
      }
    }
    
    // Check layer configuration for an alias
    if (layerId) {
      const layer = this.getLayerConfigById(layerId);
      const field = layer?.fields?.find(f => f.name.toUpperCase() === actualFieldName.toUpperCase());
      if (field?.alias && field.alias.toLowerCase() !== 'internal') {
        return this.cleanFieldLabel(field.alias);
      }
    }

    // Try the general-purpose reverse mapping from FIELD_ALIASES
    const reverseMap = this.buildReverseMapping();
    if (reverseMap[actualFieldName]) {
        const cleaned = this.cleanFieldLabel(reverseMap[actualFieldName]);
        return cleaned || this.prettifyFieldName(actualFieldName);
    }
    if (reverseMap[actualFieldName.toUpperCase()]) {
        const cleaned = this.cleanFieldLabel(reverseMap[actualFieldName.toUpperCase()]);
        return cleaned || this.prettifyFieldName(actualFieldName);
    }

    // As a last resort, prettify the raw field name
    return this.prettifyFieldName(actualFieldName);
  }

  /**
   * Clean field labels by removing common qualifiers and formatting
   * @param label - Raw field label
   * @returns Cleaned field label
   */
  static cleanFieldLabel(label: string): string {
    if (!label || typeof label !== 'string') {
      return label;
    }
    
    // Skip if it's "Internal" - return empty string to hide it
    if (label.toLowerCase().trim() === 'internal') {
      return '';
    }
    
    let cleaned = label;
    
    // Remove (esri), (Esri), (ESRI) and similar patterns first
    cleaned = cleaned.replace(/\s*\([Ee][Ss][Rr][Ii]\s*\d*\)/g, '');
    
    // Remove other common parenthetical qualifiers
    cleaned = cleaned.replace(/\s*\([^)]*\)/g, '');
    
    // Remove percentage symbols
    cleaned = cleaned.replace(/\s*%\s*/g, '');
    
    // Clean up extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
  }

  /**
   * Convert raw field names to human-readable format as a fallback.
   * @param fieldName - Raw field name
   * @returns Prettified field name
   */
  static prettifyFieldName(fieldName: string): string {
    // Avoid mangling known correlation formats
    if (fieldName.includes('_vs_') && fieldName.includes('_correlation')) {
        return fieldName;
    }
    
    return fieldName
      .replace(/_/g, ' ')
      .replace(/\sA\sB(\sP)?$/, '') // Remove " A B" or " A B P" suffix from codes
      .split(' ')
      .map(word => {
        // Don't change case if it looks like a field code
        return word.match(/^[A-Z]{2,}\d+/) ? word : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      })
      .join(' ');
  }

  /**
   * Get multiple friendly field names at once
   * @param fields - Array of field names or field objects
   * @param layerId - Optional layer ID
   * @returns Array of human-readable field names
   */
  static getFriendlyFieldNames(
    fields: (string | { name: string; layerId?: string })[],
    defaultLayerId?: string
  ): string[] {
    return fields.map(field => {
      if (typeof field === 'string') {
        return this.getFriendlyFieldName(field, defaultLayerId);
      }
      return this.getFriendlyFieldName(field.name, field.layerId || defaultLayerId);
    });
  }

  /**
   * Create field mapping for popup templates
   * @param fields - Fields to map
   * @param layerId - Optional layer ID
   * @returns Object mapping raw field names to friendly names
   */
  static createPopupFieldMapping(
    fields: string[],
    layerId?: string
  ): Record<string, string> {
    const mapping: Record<string, string> = {};
    fields.forEach(field => {
      mapping[field] = this.getFriendlyFieldName(field, layerId);
    });
    return mapping;
  }

  /**
   * Create legend title from field names
   * @param primaryField - Primary field name
   * @param comparisonField - Optional comparison field name
   * @param layerId - Optional layer ID
   * @returns Formatted legend title
   */
  static createLegendTitle(
    primaryField: string,
    comparisonField?: string,
    layerId?: string
  ): string {
    const primaryName = this.getFriendlyFieldName(primaryField, layerId);
    
    if (comparisonField) {
      const comparisonName = this.getFriendlyFieldName(comparisonField, layerId);
      return `${primaryName} vs ${comparisonName}`;
    }
    
    return primaryName;
  }

  /**
   * Helper to get layer config by ID
   */
  private static getLayerConfigById(layerId: string): LayerConfig | undefined {
    if (!Array.isArray(layers)) return undefined;
    return layers.find((l: LayerConfig) => l.id === layerId);
  }
}

/**
 * Convenience functions for backward compatibility
 */
export const getFriendlyFieldName = FieldMappingHelper.getFriendlyFieldName.bind(FieldMappingHelper);
export const cleanFieldLabel = FieldMappingHelper.cleanFieldLabel.bind(FieldMappingHelper);
export const prettifyFieldName = FieldMappingHelper.prettifyFieldName.bind(FieldMappingHelper);
export const createLegendTitle = FieldMappingHelper.createLegendTitle.bind(FieldMappingHelper);