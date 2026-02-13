/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Feature Extraction for Analysis-Driven Clustering
 * 
 * Extracts relevant features from different analysis endpoints to create
 * meaningful clustering inputs for campaign territory planning.
 */

import { ClusteringFeature, ClusteringError, CLUSTERING_ERROR_CODES } from '../types';

export interface AnalysisData {
  type: string;
  features: Array<{
    properties: Record<string, any>;
    geometry: {
      centroid?: [number, number]; // [longitude, latitude]
      coordinates?: any;
    };
  }>;
}

/**
 * Auto-detect clustering method based on analysis endpoint and type
 */
function detectClusteringMethod(analysisType: string, endpoint?: string): 'strategic-scores' | 'competitive-scores' | 'demographic-scores' | 'analysis-geographic' {
  // Check endpoint first (most reliable indicator)
  if (endpoint) {
    if (endpoint.includes('strategic')) return 'strategic-scores';
    if (endpoint.includes('competitive')) return 'competitive-scores';
    if (endpoint.includes('demographic')) return 'demographic-scores';
  }
  
  // Fall back to analysis type
  if (analysisType) {
    if (analysisType.includes('strategic')) return 'strategic-scores';
    if (analysisType.includes('competitive')) return 'competitive-scores';
    if (analysisType.includes('demographic')) return 'demographic-scores';
  }
  
  // Default to combined analysis + geographic for best results
  return 'analysis-geographic';
}

/**
 * Auto-detect clustering method from analysis endpoint and extract features
 */
export function extractClusteringFeatures(
  analysisData: AnalysisData,
  endpoint?: string
): ClusteringFeature[] {
  // Auto-detect clustering method from endpoint or analysis type
  const method = detectClusteringMethod(analysisData.type, endpoint);
  try {
    if (!analysisData.features || analysisData.features.length === 0) {
      throw new ClusteringError(
        'No features found in analysis data',
        CLUSTERING_ERROR_CODES.INSUFFICIENT_DATA
      );
    }

    const features = analysisData.features.map(feature => {
      const props = feature.properties;
      
      // Extract geographic coordinates
      const { latitude, longitude } = extractCoordinates(feature);
      
      // Base feature with common properties
      const baseFeature: Partial<ClusteringFeature> = {
        zipCode: props.geo_id || props.zip_code || props.zipcode || `zip_${Math.random()}`,
        latitude,
        longitude,
        population: extractPopulation(props),
        medianIncome: extractMedianIncome(props),
        medianAge: extractMedianAge(props)
      };

      // Extract method-specific features
      switch (method) {
        case 'strategic-scores':
          return extractStrategicFeatures(props, baseFeature);
          
        case 'competitive-scores':
          return extractCompetitiveFeatures(props, baseFeature);
          
        case 'demographic-scores':
          return extractDemographicFeatures(props, baseFeature);
          
        case 'analysis-geographic':
        default:
          return extractAnalysisGeographicFeatures(props, baseFeature, analysisData.type);
      }
    });

    // Filter out invalid features
    const validFeatures = features.filter(f => 
      f.zipCode && 
      typeof f.latitude === 'number' && 
      typeof f.longitude === 'number' &&
      typeof f.primaryScore === 'number' &&
      !isNaN(f.latitude) && 
      !isNaN(f.longitude) &&
      !isNaN(f.primaryScore)
    );

    if (validFeatures.length === 0) {
      throw new ClusteringError(
        'No valid clustering features could be extracted',
        CLUSTERING_ERROR_CODES.FEATURE_EXTRACTION_FAILED,
        { originalFeatureCount: features.length }
      );
    }

    return validFeatures;

  } catch (error) {
    if (error instanceof ClusteringError) {
      throw error;
    }
    
    throw new ClusteringError(
      `Feature extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      CLUSTERING_ERROR_CODES.FEATURE_EXTRACTION_FAILED,
      { originalError: error, analysisType: analysisData.type }
    );
  }
}

/**
 * Extract coordinates from feature geometry
 */
function extractCoordinates(feature: any): { latitude: number; longitude: number } {
  const geometry = feature.geometry;
  
  // Try centroid first
  if (geometry?.centroid && Array.isArray(geometry.centroid) && geometry.centroid.length >= 2) {
    return {
      longitude: geometry.centroid[0],
      latitude: geometry.centroid[1]
    };
  }
  
  // Try properties for lat/lng
  const props = feature.properties;
  if (props?.latitude && props?.longitude) {
    return {
      latitude: Number(props.latitude),
      longitude: Number(props.longitude)
    };
  }
  
  if (props?.lat && props?.lng) {
    return {
      latitude: Number(props.lat),
      longitude: Number(props.lng)
    };
  }
  
  // Try geometry coordinates (for point geometries)
  if (geometry?.coordinates && Array.isArray(geometry.coordinates) && geometry.coordinates.length >= 2) {
    return {
      longitude: geometry.coordinates[0],
      latitude: geometry.coordinates[1]
    };
  }
  
  throw new ClusteringError(
    'No valid coordinates found in feature',
    CLUSTERING_ERROR_CODES.FEATURE_EXTRACTION_FAILED,
    { feature: feature }
  );
}

/**
 * Extract population with fallback options
 */
function extractPopulation(props: Record<string, any>): number {
  const populationFields = [
    'total_population',
    'population',
    'totpop_cy',
    'value_totpop_cy',
    'TOTPOP_CY'
  ];
  
  for (const field of populationFields) {
    const value = Number(props[field]);
    if (!isNaN(value) && value > 0) {
      return value;
    }
  }
  
  return 1000; // Default population for clustering purposes
}

/**
 * Extract median income with fallback options
 */
function extractMedianIncome(props: Record<string, any>): number {
  const incomeFields = [
    'median_income',
    'avghinc_cy',
    'value_avghinc_cy',
    'AVGHINC_CY',
    'income'
  ];
  
  for (const field of incomeFields) {
    const value = Number(props[field]);
    if (!isNaN(value) && value > 0) {
      return value;
    }
  }
  
  return 50000; // Default income for clustering purposes
}

/**
 * Extract median age with fallback options
 */
function extractMedianAge(props: Record<string, any>): number {
  const ageFields = [
    'median_age',
    'medage_cy',
    'value_medage_cy',
    'MEDAGE_CY',
    'age'
  ];
  
  for (const field of ageFields) {
    const value = Number(props[field]);
    if (!isNaN(value) && value > 0 && value < 120) {
      return value;
    }
  }
  
  return 35; // Default age for clustering purposes
}

/**
 * Extract features for strategic analysis clustering
 */
function extractStrategicFeatures(
  props: Record<string, any>, 
  baseFeature: Partial<ClusteringFeature>
): ClusteringFeature {
  const strategicScore = extractScore(props, [
    'strategic_score',
    'strategic_value_score',
    'score',
    'value'
  ]);
  
  const demographicOpportunity = extractScore(props, [
    'demographic_opportunity_score',
    'demographic_score',
    'opportunity_score'
  ]);
  
  const competitiveAdvantage = extractScore(props, [
    'competitive_advantage_score',
    'competitive_score',
    'advantage_score'
  ]);

  return {
    ...baseFeature,
    primaryScore: strategicScore,
    secondaryScore: demographicOpportunity,
    strategicScore,
    demographicOpportunity,
    competitiveAdvantage
  } as ClusteringFeature;
}

/**
 * Extract features for competitive analysis clustering
 */
function extractCompetitiveFeatures(
  props: Record<string, any>, 
  baseFeature: Partial<ClusteringFeature>
): ClusteringFeature {
  const nikeShare = extractScore(props, [
    'nike_market_share',
    'nike_share',
    'mp30034a_b_p',
    'value_mp30034a_b_p'
  ]);
  
  const adidasShare = extractScore(props, [
    'adidas_market_share',
    'adidas_share',
    'mp30029a_b_p',
    'value_mp30029a_b_p'
  ]);
  
  const marketGap = extractScore(props, [
    'market_gap',
    'untapped_market',
    'opportunity_gap'
  ]);
  
  // Primary score is competitive intensity (combination of brand shares)
  const competitiveIntensity = nikeShare + adidasShare;

  return {
    ...baseFeature,
    primaryScore: competitiveIntensity,
    secondaryScore: Math.abs(nikeShare - adidasShare), // Brand difference
    nikeShare,
    adidasShare,
    marketGap
  } as ClusteringFeature;
}

/**
 * Extract features for demographic analysis clustering
 */
function extractDemographicFeatures(
  props: Record<string, any>, 
  baseFeature: Partial<ClusteringFeature>
): ClusteringFeature {
  const demographicScore = extractScore(props, [
    'demographic_opportunity_score',
    'demographic_score',
    'customer_score',
    'score'
  ]);
  
  const populationDensity = baseFeature.population! / 10; // Normalize population for clustering

  return {
    ...baseFeature,
    primaryScore: demographicScore,
    secondaryScore: populationDensity,
    demographicOpportunity: demographicScore
  } as ClusteringFeature;
}

/**
 * Extract features for analysis + geographic clustering (default)
 */
function extractAnalysisGeographicFeatures(
  props: Record<string, any>, 
  baseFeature: Partial<ClusteringFeature>,
  analysisType: string
): ClusteringFeature {
  // Try to extract the most relevant score based on analysis type
  let primaryScore: number;
  let secondaryScore: number | undefined;
  
  if (analysisType?.includes('strategic')) {
    primaryScore = extractScore(props, ['strategic_score', 'strategic_value_score']);
    secondaryScore = extractScore(props, ['demographic_opportunity_score']);
  } else if (analysisType?.includes('competitive')) {
    const nikeShare = extractScore(props, ['nike_market_share', 'mp30034a_b_p', 'value_mp30034a_b_p']);
    const adidasShare = extractScore(props, ['adidas_market_share', 'mp30029a_b_p', 'value_mp30029a_b_p']);
    primaryScore = nikeShare + adidasShare; // Competitive intensity
    secondaryScore = Math.abs(nikeShare - adidasShare); // Brand difference
  } else if (analysisType?.includes('demographic')) {
    primaryScore = extractScore(props, ['demographic_opportunity_score', 'demographic_score']);
    secondaryScore = baseFeature.population! / 1000; // Population factor
  } else {
    // Generic analysis - try to find any score
    primaryScore = extractScore(props, [
      'score', 'value', 'strategic_value_score', 'demographic_opportunity_score', 
      'competitive_advantage_score', 'nike_market_share'
    ]);
    secondaryScore = extractScore(props, ['secondary_score', 'demographic_score']);
  }

  return {
    ...baseFeature,
    primaryScore,
    secondaryScore
  } as ClusteringFeature;
}

/**
 * Extract score with fallback options
 */
function extractScore(props: Record<string, any>, fieldNames: string[]): number {
  for (const field of fieldNames) {
    const value = Number(props[field]);
    if (!isNaN(value)) {
      return Math.max(0, value); // Ensure non-negative
    }
  }
  
  return 0; // Default score
}

/**
 * Validate extracted features for clustering
 */
export function validateClusteringFeatures(features: ClusteringFeature[]): {
  isValid: boolean;
  issues: string[];
  validFeatures: ClusteringFeature[];
} {
  const issues: string[] = [];
  const validFeatures: ClusteringFeature[] = [];
  
  if (features.length === 0) {
    issues.push('No features provided');
    return { isValid: false, issues, validFeatures };
  }
  
  features.forEach((feature, index) => {
    const featureIssues: string[] = [];
    
    // Check required fields
    if (!feature.zipCode) featureIssues.push('Missing zip code');
    if (typeof feature.latitude !== 'number' || isNaN(feature.latitude)) featureIssues.push('Invalid latitude');
    if (typeof feature.longitude !== 'number' || isNaN(feature.longitude)) featureIssues.push('Invalid longitude');
    if (typeof feature.primaryScore !== 'number' || isNaN(feature.primaryScore)) featureIssues.push('Invalid primary score');
    
    // Check reasonable value ranges
    if (feature.latitude < -90 || feature.latitude > 90) featureIssues.push('Latitude out of range');
    if (feature.longitude < -180 || feature.longitude > 180) featureIssues.push('Longitude out of range');
    if (feature.population < 0) featureIssues.push('Negative population');
    
    if (featureIssues.length === 0) {
      validFeatures.push(feature);
    } else {
      issues.push(`Feature ${index}: ${featureIssues.join(', ')}`);
    }
  });
  
  const isValid = validFeatures.length > 0 && issues.length < features.length * 0.5; // Allow up to 50% invalid features
  
  return { isValid, issues, validFeatures };
}