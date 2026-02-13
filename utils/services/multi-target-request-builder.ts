import { AnalysisResult, AnalysisServiceRequest } from '@/lib/analytics/types';
import { MultiTargetPredictionResponse, RealEstatePropertyFeatures, MultiTargetTrainingConfig } from '@/types/microservice-types';
import { AnalysisOptions, ProcessedAnalysisData, TargetVariableType } from '@/lib/analysis/types';
import { FIELD_ALIASES } from '@/utils/field-aliases';
import { preferPercentage } from '@/utils/field-utils';
import { buildMicroserviceRequest } from '@/lib/build-microservice-request';

/**
 * Enhanced request builder for multi-target real estate analysis
 * Extends existing buildMicroserviceRequest functionality with real estate-specific mappings
 */

// ============================================================================
// REAL ESTATE FIELD MAPPINGS
// ============================================================================

/**
 * Real estate field mappings for property data standardization
 */
export const REAL_ESTATE_FIELD_MAPPINGS: Record<string, string> = {
  // Property basics
  'asking_price': 'asking_price',
  'sold_price': 'sold_price', 
  'list_price': 'asking_price',
  'sale_price': 'sold_price',
  'current_price': 'asking_price',
  'final_price': 'sold_price',
  'price': 'asking_price',
  
  // Dates
  'date_listed': 'date_listed',
  'date_sold': 'date_sold',
  'list_date': 'date_listed',
  'sale_date': 'date_sold',
  'listing_date': 'date_listed',
  'sold_date': 'date_sold',
  
  // Time metrics
  'time_on_market': 'time_on_market',
  'days_on_market': 'time_on_market',
  'dom': 'time_on_market',
  'market_time': 'time_on_market',
  
  // Property features
  'bedrooms': 'bedrooms',
  'bathrooms': 'bathrooms',
  'bed_count': 'bedrooms',
  'bath_count': 'bathrooms',
  'beds': 'bedrooms',
  'baths': 'bathrooms',
  
  // Size metrics
  'area_sqft': 'area_sqft',
  'square_feet': 'area_sqft',
  'sqft': 'area_sqft',
  'floor_area': 'area_sqft',
  'living_area': 'area_sqft',
  
  // Property type
  'property_type': 'property_type',
  'dwelling_type': 'property_type',
  'home_type': 'property_type',
  'building_type': 'property_type',
  
  // Location
  'fsa_code': 'fsa_code',
  'postal_code': 'fsa_code',
  'forward_sortation_area': 'fsa_code',
  'latitude': 'latitude',
  'longitude': 'longitude',
  'lat': 'latitude',
  'lng': 'longitude',
  'lon': 'longitude',
  
  // Building details
  'building_age': 'building_age',
  'year_built': 'building_age',
  'construction_year': 'building_age',
  'age': 'building_age',
  
  // Financial metrics
  'price_per_sqft': 'price_per_sqft',
  'price_delta': 'price_delta',
  'price_difference': 'price_delta',
  'price_change': 'price_delta',
  
  // Rental metrics
  'rental_yield': 'rental_yield',
  'rent_yield': 'rental_yield',
  'annual_yield': 'rental_yield',
  'avg_rent_price': 'avg_rent_price',
  'rental_price': 'avg_rent_price',
  'monthly_rent': 'avg_rent_price',
  
  // Investment metrics
  'investment_score': 'investment_score',
  'roi_score': 'investment_score',
  'investment_potential': 'investment_score',
  
  // Market metrics
  'market_velocity': 'market_velocity',
  'turnover_rate': 'market_velocity',
  'activity_rate': 'market_velocity',
  'appreciation_rate': 'appreciation_rate',
  'growth_rate': 'appreciation_rate',
  'value_appreciation': 'appreciation_rate',
  'inventory_levels': 'inventory_levels',
  'available_inventory': 'inventory_levels',
  'stock_levels': 'inventory_levels',
  
  // Demographics (FSA level)
  'median_income': 'median_income',
  'household_income': 'median_income',
  'avg_income': 'median_income',
  'population_density': 'population_density',
  'density': 'population_density',
  'education_level': 'education_level',
  'education_index': 'education_level',
  'walkability_score': 'walkability_score',
  'transit_score': 'transit_score'
};

/**
 * Target variable calculation definitions for real estate analysis
 */
export const TARGET_VARIABLE_CALCULATIONS: Record<TargetVariableType, {
  formula: string;
  requiredFields: string[];
  description: string;
  unit: string;
}> = {
  time_on_market: {
    formula: 'date_sold - date_listed',
    requiredFields: ['date_listed', 'date_sold'],
    description: 'Number of days a property was listed before selling',
    unit: 'days'
  },
  avg_sold_price: {
    formula: 'AVG(sold_price) GROUP BY fsa_code',
    requiredFields: ['sold_price', 'fsa_code'],
    description: 'Average sold price by Forward Sortation Area',
    unit: 'CAD'
  },
  avg_rent_price: {
    formula: 'AVG(monthly_rent) GROUP BY fsa_code',
    requiredFields: ['monthly_rent', 'fsa_code'],
    description: 'Average monthly rental price by FSA',
    unit: 'CAD/month'
  },
  price_delta: {
    formula: '((sold_price - asking_price) / asking_price) * 100',
    requiredFields: ['asking_price', 'sold_price'],
    description: 'Percentage difference between asking and sold price',
    unit: 'percentage'
  },
  market_velocity: {
    formula: 'COUNT(sold_properties) / COUNT(listed_properties)',
    requiredFields: ['date_listed', 'date_sold'],
    description: 'Rate of property sales relative to listings',
    unit: 'ratio'
  },
  appreciation_rate: {
    formula: '((current_value - previous_value) / previous_value) * 100',
    requiredFields: ['current_value', 'previous_value', 'time_period'],
    description: 'Annual property value appreciation rate',
    unit: 'percentage/year'
  },
  inventory_levels: {
    formula: 'COUNT(active_listings) GROUP BY fsa_code',
    requiredFields: ['listing_status', 'fsa_code'],
    description: 'Number of active property listings by area',
    unit: 'count'
  },
  custom: {
    formula: 'user_defined',
    requiredFields: [],
    description: 'Custom target variable defined by user',
    unit: 'varies'
  }
};

// ============================================================================
// ENHANCED REQUEST BUILDER FUNCTIONS
// ============================================================================

/**
 * Convert CamelCase / PascalCase → snake_case (same helper used in the UI)
 */
const toSnake = (str: string): string =>
  str
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();

/**
 * Map real estate field names to standardized format
 */
export function mapRealEstateField(fieldName: string): string {
  const lowercaseField = fieldName.toLowerCase();
  
  // Check real estate specific mappings first
  if (REAL_ESTATE_FIELD_MAPPINGS[lowercaseField]) {
    return REAL_ESTATE_FIELD_MAPPINGS[lowercaseField];
  }
  
  // Fall back to existing field aliases
  if (FIELD_ALIASES[lowercaseField]) {
    return FIELD_ALIASES[lowercaseField];
  }
  
  // Check if it looks like a dataset code (e.g. MP30034A_B, TOTPOP_CY)
  const looksLikeDatasetCode = (s: string): boolean => /^[A-Z0-9_]{4,}$/.test(s);
  if (looksLikeDatasetCode(fieldName.toUpperCase())) {
    return fieldName.toUpperCase();
  }
  
  // Convert to snake_case as fallback
  return toSnake(fieldName);
}

/**
 * Build demographic filters for FSA-level analysis
 */
export function buildDemographicFilters(options: AnalysisOptions): Array<{ field: string; condition: string }> {
  const filters: Array<{ field: string; condition: string }> = [];
  
  // Add any existing demographic filters
  if (options.fieldFilters?.demographic) {
    const demographic = options.fieldFilters.demographic as Record<string, { enabled?: boolean; values?: any[] }>;
    Object.entries(demographic).forEach(([field, config]) => {
      if (config.enabled && config.values && config.values.length > 0) {
        const mappedField = mapRealEstateField(field);
        const condition = Array.isArray(config.values) 
          ? `IN (${config.values.map((v: any) => `'${v}'`).join(', ')})`
          : `= '${config.values}'`;
        filters.push({ field: mappedField, condition });
      }
    });
  }
  
  // Add FSA code filters if spatial filtering is applied
  if (options.spatialFilterIds && options.spatialFilterIds.length > 0) {
    filters.push({
      field: 'fsa_code',
      condition: `IN (${options.spatialFilterIds.map(id => `'${id}'`).join(', ')})`
    });
  }
  
  return filters;
}

/**
 * Build multi-target microservice request with real estate specific enhancements
 */
export function buildMultiTargetMicroserviceRequest(
  analysisResult: AnalysisResult,
  query: string,
  targetVariables: TargetVariableType[],
  options: AnalysisOptions = {},
  conversationContext = ''
): MultiTargetMicroserviceRequest {
  
  // Start with the base request from existing function
  const baseRequest = buildMicroserviceRequest(
    analysisResult,
    query,
    targetVariables[0], // Use first target as primary
    conversationContext
  );
  
  // Map all target variables through real estate field mappings
  const mappedTargets = targetVariables.map(target => {
    const mapped = mapRealEstateField(target);
    return preferPercentage(mapped);
  });
  
  // Build enhanced field mappings
  const enhancedFields = [
    ...mappedTargets,
    ...(analysisResult.relevantFields || []).map(field => {
      const mapped = mapRealEstateField(field);
      return preferPercentage(mapped);
    })
  ];
  
  // Remove duplicates while maintaining order
  const seen = new Set<string>();
  const uniqueFields = enhancedFields.filter(field => {
    if (seen.has(field)) return false;
    seen.add(field);
    return true;
  });
  
  // Build demographic filters
  const demographicFilters = buildDemographicFilters(options);
  
  // Construct multi-target request
  const multiTargetRequest: MultiTargetMicroserviceRequest = {
    // Base fields from single-target request
    query: baseRequest.query,
    analysis_type: 'multi_target_prediction',
    minApplications: baseRequest.minApplications || 1,
    target_variable: mappedTargets[0], // Primary target as the main target_variable
    conversationContext: baseRequest.conversationContext,
    matched_fields: uniqueFields,
    relevant_layers: baseRequest.relevant_layers,
    relevantLayers: baseRequest.relevantLayers,
    demographic_filters: [...(baseRequest.demographic_filters || []), ...demographicFilters],
    
    // Multi-target specific fields
    target_variables: mappedTargets,
    primary_target: mappedTargets[0],
    
    // Real estate specific configuration
    feature_engineering: {
      spatial_aggregation: {
        enabled: true,
        radius_km: options.spatialFilterGeometry ? 5.0 : 10.0, // Smaller radius if spatial filter applied
        aggregation_methods: ['mean', 'median', 'count'],
        group_by_fsa: true
      },
      temporal_features: {
        enabled: true,
        seasonality: true,
        trend_analysis: true,
        lag_features: [1, 3, 6, 12], // months
        date_fields: ['date_listed', 'date_sold']
      },
      property_features: {
        enabled: true,
        price_per_sqft: true,
        bedroom_to_bathroom_ratio: true,
        age_categories: true,
        property_type_encoding: true
      }
    },
    
    // Model configuration for real estate
    model_config: {
      algorithm: 'xgboost', // Good for real estate tabular data
      shared_layers: true,
      task_specific_heads: true,
      hyperparameters: {
        n_estimators: 100,
        max_depth: 6,
        learning_rate: 0.1,
        reg_alpha: 0.1,
        reg_lambda: 1.0
      }
    },
    
    // Geographic configuration
    geographic_config: {
      fsa_enrichment: true,
      coordinate_precision: 6, // Sufficient for property-level analysis
      spatial_features: ['distance_to_downtown', 'transit_accessibility', 'walkability_score'],
      boundary_analysis: options.spatialFilterGeometry ? 'custom' : 'fsa'
    },
    
    // Response configuration
    response_config: {
      include_feature_importance: true,
      include_confidence_intervals: true,
      include_shap_explanations: true,
      geojson_output: true,
      aggregate_by_fsa: true
    }
  };
  
  return multiTargetRequest;
}

/**
 * Enhanced single-target request builder with real estate optimizations
 */
export function buildEnhancedMicroserviceRequest(
  analysisResult: AnalysisResult,
  query: string,
  selectedTargetVariable?: string,
  options: AnalysisOptions = {},
  conversationContext = ''
): EnhancedMicroserviceRequest {
  
  // Get base request
  const baseRequest = buildMicroserviceRequest(
    analysisResult,
    query,
    selectedTargetVariable,
    conversationContext
  );
  
  // Map target variable through real estate field mappings
  const mappedTarget = selectedTargetVariable 
    ? preferPercentage(mapRealEstateField(selectedTargetVariable))
    : baseRequest.target_variable;
  
  // Enhanced field mappings
  const enhancedFields = (analysisResult.relevantFields || []).map(field => {
    const mapped = mapRealEstateField(field);
    return preferPercentage(mapped);
  });
  
  // Ensure target is included
  const allFields = [mappedTarget, ...enhancedFields].filter(Boolean);
  const uniqueFields = [...new Set(allFields)];
  
  // Build demographic filters
  const demographicFilters = buildDemographicFilters(options);
  
  // Detect real estate specific analysis patterns
  const isRealEstateQuery = query.toLowerCase().includes('property') || 
                           query.toLowerCase().includes('real estate') ||
                           query.toLowerCase().includes('housing') ||
                           query.toLowerCase().includes('listing') ||
                           uniqueFields.some(field => 
                             field.includes('price') || 
                             field.includes('bedroom') || 
                             field.includes('sqft')
                           );
  
  const enhancedRequest: EnhancedMicroserviceRequest = {
    // Base request fields
    ...baseRequest,
    target_variable: mappedTarget,
    matched_fields: uniqueFields,
    demographic_filters: [...(baseRequest.demographic_filters || []), ...demographicFilters],
    
    // Real estate enhancements
    ...(isRealEstateQuery && {
      real_estate_config: {
        property_level_analysis: true,
        fsa_aggregation: true,
        price_normalization: true,
        temporal_analysis: true,
        market_segment_analysis: true
      },
      
      feature_engineering: {
        spatial_features: true,
        temporal_features: true,
        interaction_features: ['bedrooms_x_bathrooms', 'price_per_sqft_x_area'],
        categorical_encoding: 'target_encoding' // Good for high-cardinality categorical variables
      }
    })
  };
  
  return enhancedRequest;
}

/**
 * Build training configuration for multi-target real estate models
 */
export function buildRealEstateTrainingConfig(
  targetVariables: TargetVariableType[],
  options: AnalysisOptions = {}
): MultiTargetTrainingConfig {
  
  // Default weights and loss functions for each target type
  const targetConfigs = targetVariables.reduce((acc, target) => {
    (acc as any)[target] = {
      enabled: true,
      weight: 1.0,
      loss_function: target === 'time_on_market' || target === 'inventory_levels' ? 'mae' : 'mse'
    };
    return acc;
  }, {} as MultiTargetTrainingConfig['target_variables']);
  
  // Adjust weights based on target priority
  if ((targetConfigs as any).avg_sold_price) (targetConfigs as any).avg_sold_price.weight = 1.5; // Higher weight for price predictions
  if ((targetConfigs as any).time_on_market) (targetConfigs as any).time_on_market.weight = 1.2;
  
  return {
    target_variables: targetConfigs,
    
    feature_engineering: {
      spatial_aggregation: {
        enabled: true,
        radius_km: 10.0,
        aggregation_methods: ['mean', 'median', 'std', 'count']
      },
      temporal_features: {
        enabled: true,
        seasonality: true,
        trend_analysis: true,
        lag_features: [1, 3, 6, 12] // Monthly lags
      }
    },
    
    model_architecture: {
      algorithm: 'xgboost', // Excellent for real estate tabular data
      shared_layers: true,
      task_specific_heads: true
    }
  };
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Multi-target microservice request interface
 */
export interface MultiTargetMicroserviceRequest extends AnalysisServiceRequest {
  target_variables: string[];
  primary_target: string;
  
  feature_engineering: {
    spatial_aggregation: {
      enabled: boolean;
      radius_km: number;
      aggregation_methods: string[];
      group_by_fsa: boolean;
    };
    temporal_features: {
      enabled: boolean;
      seasonality: boolean;
      trend_analysis: boolean;
      lag_features: number[];
      date_fields: string[];
    };
    property_features: {
      enabled: boolean;
      price_per_sqft: boolean;
      bedroom_to_bathroom_ratio: boolean;
      age_categories: boolean;
      property_type_encoding: boolean;
    };
  };
  
  model_config: {
    algorithm: string;
    shared_layers: boolean;
    task_specific_heads: boolean;
    hyperparameters: Record<string, any>;
  };
  
  geographic_config: {
    fsa_enrichment: boolean;
    coordinate_precision: number;
    spatial_features: string[];
    boundary_analysis: string;
  };
  
  response_config: {
    include_feature_importance: boolean;
    include_confidence_intervals: boolean;
    include_shap_explanations: boolean;
    geojson_output: boolean;
    aggregate_by_fsa: boolean;
  };
}

/**
 * Enhanced single-target microservice request interface
 */
export interface EnhancedMicroserviceRequest extends AnalysisServiceRequest {
  real_estate_config?: {
    property_level_analysis: boolean;
    fsa_aggregation: boolean;
    price_normalization: boolean;
    temporal_analysis: boolean;
    market_segment_analysis: boolean;
  };
  
  feature_engineering?: {
    spatial_features: boolean;
    temporal_features: boolean;
    interaction_features: string[];
    categorical_encoding: string;
  };
}

/**
 * Real estate analysis context for request building
 */
export interface RealEstateAnalysisContext {
  propertyType?: string;
  priceRange?: [number, number];
  fsaCodes?: string[];
  timeRange?: [Date, Date];
  analysisLevel: 'property' | 'fsa' | 'city' | 'region';
  includeRental?: boolean;
  includeInvestment?: boolean;
}

// Exports are handled by individual export declarations above