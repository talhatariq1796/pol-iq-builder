/**
 * Analysis-Driven Clustering Types
 * 
 * Defines interfaces for clustering zip codes into campaign territories
 * based on analysis results (strategic, competitive, demographic) and geographic proximity.
 */

// Clustering method is now auto-detected based on the analysis endpoint
// This eliminates the need for manual method selection and reduces user confusion

export type ClusteringMethod = 
  | 'region-growing'
  | 'strategic-scores'
  | 'competitive-analysis'
  | 'demographic-analysis'
  | 'competitive-scores'
  | 'analysis-geographic'
  | 'demographic-scores';

export interface ClusterConfig {
  enabled: boolean;                    // Default: false - maintains current behavior
  numClusters: number;                // Default: 5, Range: 1-20 - Maximum territories to create
  minZipCodes: number;                // Default: 10, Range: 5-50
  minPopulation: number;              // Default: 50000, Range: 10K-1M
  maxRadiusMiles: number;             // Default: 50, Range: 20-100
  minScorePercentile: number;         // Default: 70, Range: 50-90 - Only include top X percentile
  // method field removed - now auto-detected from analysis endpoint
}

export interface ClusteringFeature {
  // Core identifiers
  zipCode: string;
  
  // Geographic properties  
  latitude: number;
  longitude: number;
  
  // Analysis-specific features (normalized 0-1 for clustering)
  primaryScore: number;               // Main analysis score (strategic, competitive, etc.)
  secondaryScore?: number;            // Supporting metric
  
  // Common demographic features
  population: number;
  medianIncome?: number;
  medianAge?: number;
  
  // Endpoint-specific features
  strategicScore?: number;
  competitiveAdvantage?: number;
  demographicOpportunity?: number;
  nikeShare?: number;
  adidasShare?: number;
  marketGap?: number;
}

export interface ClusterResult {
  clusterId: number;
  name: string;                       // Auto-generated: "High Strategic Value Territory"
  
  // Member zip codes
  zipCodes: string[];
  
  // Geographic properties
  centroid: [number, number];         // [longitude, latitude] center point
  boundary: GeoJSON.Polygon;          // Territory boundary polygon
  radiusMiles: number;                // Actual radius of cluster
  
  // Aggregated metrics
  totalPopulation: number;
  averageScore: number;               // Average of primary analysis score
  scoreRange: [number, number];       // [min, max] scores in cluster
  
  // Validation status
  isValid: boolean;                   // Meets size/population/radius requirements
  validationIssues: string[];         // List of validation failures if any
  
  // Campaign planning data (future enhancement)
  keyInsights: string;                // "High income, young professionals, Nike preference"
  recommendedBudget?: number;
  primaryChannels?: string[];
}

export interface ClusteringResult {
  success: boolean;
  clusters: ClusterResult[];
  
  // Summary statistics
  totalZipCodes: number;
  clusteredZipCodes: number;          // Zip codes in valid clusters
  unclustered: string[];              // Zip codes that didn't fit any valid cluster
  
  // Validation summary
  validClusters: number;
  invalidClusters: number;
  
  // Processing metadata
  algorithm: string;                  // "region-growing"
  processingTimeMs: number;
  parameters: ClusterConfig;
}

export interface DistanceMatrix {
  [zipCode1: string]: {
    [zipCode2: string]: number;       // Distance in miles
  };
}

export interface ClusterValidationResult {
  isValid: boolean;
  issues: string[];
  
  // Size validation
  hasMinZipCodes: boolean;
  zipCodeCount: number;
  
  // Population validation  
  hasMinPopulation: boolean;
  totalPopulation: number;
  
  // Geographic validation
  withinMaxRadius: boolean;
  actualRadiusMiles: number;
  maxRadiusMiles: number;
}

// Default configuration - maintains current behavior when disabled
export const DEFAULT_CLUSTER_CONFIG: ClusterConfig = {
  enabled: false,                     // OFF by default
  numClusters: 5,                     // Manageable number for campaigns
  minZipCodes: 10,                    // Meaningful territory size
  minPopulation: 50000,               // Viable campaign audience
  maxRadiusMiles: 50,                 // Typical DMA coverage
  minScorePercentile: 70              // Only top 30% of ZIP codes
  // method removed - auto-detected from analysis endpoint
};

// Preset configurations for common use cases
export const CAMPAIGN_PRESETS: Record<string, Partial<ClusterConfig>> = {
  'brand-campaign': {
    numClusters: 5,
    minPopulation: 100000,
    maxRadiusMiles: 75
    // Large-scale brand campaigns need fewer, larger territories
  },
  
  'regional-advertising': {
    numClusters: 8,
    minPopulation: 25000,
    maxRadiusMiles: 35
    // Regional focus with moderate territory sizes
  },
  
  'local-testing': {
    numClusters: 12,
    minPopulation: 10000,
    maxRadiusMiles: 25
    // Small-scale testing with tight geographic control
  },
  
  'competitive-analysis': {
    numClusters: 6,
    minPopulation: 50000,
    maxRadiusMiles: 50
    // Competitive analysis needs balanced territory coverage
  }
};

// Error types for clustering operations
export class ClusteringError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ClusteringError';
  }
}

export const CLUSTERING_ERROR_CODES = {
  INSUFFICIENT_DATA: 'insufficient_data',
  INVALID_PARAMETERS: 'invalid_parameters',
  NO_VALID_CLUSTERS: 'no_valid_clusters',
  GEOGRAPHIC_CONSTRAINT_FAILED: 'geographic_constraint_failed',
  FEATURE_EXTRACTION_FAILED: 'feature_extraction_failed'
} as const;