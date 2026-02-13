/**
 * Query Testing Configuration
 * 
 * This file contains all test queries used during deployment validation.
 * You can easily modify, add, or remove queries to test different scenarios.
 */

import { VisualizationType } from '../reference/dynamic-layers';

export interface TestQueryConfig {
  id: string;
  query: string;
  description: string;
  expectedClassification?: VisualizationType;
  minimumConfidence: number;
  priority: 'critical' | 'important' | 'optional';
  enabled: boolean;
}

/**
 * Critical Queries - These MUST pass for deployment to proceed
 * Modify these to test your core use cases
 */
export const CRITICAL_TEST_QUERIES: TestQueryConfig[] = [
  {
    id: 'basic-show-all',
    query: 'Show me all areas',
    description: 'Basic choropleth visualization - tests fundamental mapping capability',
    expectedClassification: VisualizationType.CHOROPLETH,
    minimumConfidence: 0.3,
    priority: 'critical',
    enabled: true
  },
  {
    id: 'correlation-analysis',
    query: 'Show correlation between income and population',
    description: 'Correlation visualization - tests relationship analysis',
    expectedClassification: VisualizationType.CORRELATION,
    minimumConfidence: 0.4,
    priority: 'critical',
    enabled: true
  },
  {
    id: 'region-mapping',
    query: 'Map population by region',
    description: 'Regional mapping - tests geographic visualization',
    expectedClassification: VisualizationType.CHOROPLETH,
    minimumConfidence: 0.3,
    priority: 'critical',
    enabled: true
  },
  {
    id: 'basic-comparison',
    query: 'Compare income across areas',
    description: 'Comparison analysis - tests comparative visualization',
    expectedClassification: VisualizationType.COMPARISON,
    minimumConfidence: 0.3,
    priority: 'critical',
    enabled: true
  }
];

/**
 * Important Queries - Should pass but won't block deployment
 * Add your specific use case queries here
 */
export const IMPORTANT_TEST_QUERIES: TestQueryConfig[] = [
  {
    id: 'clustering-analysis',
    query: 'Group similar areas together',
    description: 'Clustering analysis - tests grouping functionality',
    expectedClassification: VisualizationType.CLUSTER,
    minimumConfidence: 0.4,
    priority: 'important',
    enabled: true
  },
  {
    id: 'hotspot-analysis',
    query: 'Find hotspots of high crime',
    description: 'Hotspot detection - tests spatial analysis',
    expectedClassification: VisualizationType.HEATMAP,
    minimumConfidence: 0.3,
    priority: 'important',
    enabled: true
  },
  {
    id: 'trend-analysis',
    query: 'Show population trends over time',
    description: 'Temporal analysis - tests time-based visualization',
    expectedClassification: VisualizationType.TRENDS,
    minimumConfidence: 0.4,
    priority: 'important',
    enabled: true
  },
  {
    id: 'bivariate-analysis',
    query: 'Show relationship between two variables',
    description: 'Bivariate mapping - tests dual-variable analysis',
    expectedClassification: VisualizationType.CORRELATION,
    minimumConfidence: 0.3,
    priority: 'important',
    enabled: true
  }
];

/**
 * Optional Queries - Nice to have but not required
 * Add experimental or edge case queries here
 */
export const OPTIONAL_TEST_QUERIES: TestQueryConfig[] = [
  {
    id: 'joint-high-analysis',
    query: 'Find areas where both income and education are high',
    description: 'Joint high analysis - tests multi-criteria analysis',
    expectedClassification: VisualizationType.JOINT_HIGH,
    minimumConfidence: 0.5,
    priority: 'optional',
    enabled: true
  },
  {
    id: 'multivariate-analysis',
    query: 'Analyze multiple variables together',
    description: 'Multivariate analysis - tests complex multi-dimensional analysis',
    expectedClassification: VisualizationType.CORRELATION,
    minimumConfidence: 0.4,
    priority: 'optional',
    enabled: true
  },
  {
    id: 'buffer-analysis',
    query: 'Show areas within 5 miles of schools',
    description: 'Buffer analysis - tests spatial proximity',
    expectedClassification: VisualizationType.CHOROPLETH,
    minimumConfidence: 0.4,
    priority: 'optional',
    enabled: true
  }
];

/**
 * Custom Industry-Specific Queries
 * Add your specific domain queries here
 */
export const CUSTOM_TEST_QUERIES: TestQueryConfig[] = [
  // Example: Real estate queries
  {
    id: 'property-value-mapping',
    query: 'Map property values by neighborhood',
    description: 'Real estate analysis - property value visualization',
    expectedClassification: VisualizationType.CHOROPLETH,
    minimumConfidence: 0.3,
    priority: 'important',
    enabled: false // Disabled by default, enable for real estate projects
  },
  
  // Example: Healthcare queries
  {
    id: 'health-outcomes-correlation',
    query: 'Show correlation between health outcomes and income',
    description: 'Healthcare analysis - health-economic relationship',
    expectedClassification: VisualizationType.CORRELATION,
    minimumConfidence: 0.4,
    priority: 'important',
    enabled: false // Disabled by default, enable for healthcare projects
  },
  
  // Example: Urban planning queries
  {
    id: 'transit-accessibility',
    query: 'Show areas with high transit accessibility',
    description: 'Urban planning - transit accessibility mapping',
    expectedClassification: VisualizationType.CHOROPLETH,
    minimumConfidence: 0.3,
    priority: 'important',
    enabled: false // Disabled by default, enable for urban planning projects
  }
];

/**
 * Configuration Settings
 */
export const QUERY_TEST_CONFIG = {
  // Global settings
  defaultMinimumConfidence: 0.3,
  allowFallbackClassification: true,
  enableCompatibleTypeMatching: true,
  
  // Test execution settings
  timeoutPerQuery: 5000, // 5 seconds
  maxConcurrentTests: 10,
  retryFailedTests: true,
  maxRetries: 2,
  
  // Reporting settings
  includeDetailedErrors: true,
  includePerformanceMetrics: true,
  generateRecommendations: true,
  
  // Failure handling
  criticalTestFailureThreshold: 0, // 0 = all critical tests must pass
  importantTestFailureThreshold: 2, // Allow up to 2 important test failures
  optionalTestFailureThreshold: -1, // -1 = ignore optional test failures
};

/**
 * Helper function to get all enabled queries by priority
 */
export function getEnabledQueriesByPriority(): {
  critical: TestQueryConfig[];
  important: TestQueryConfig[];
  optional: TestQueryConfig[];
  custom: TestQueryConfig[];
} {
  return {
    critical: CRITICAL_TEST_QUERIES.filter(q => q.enabled),
    important: IMPORTANT_TEST_QUERIES.filter(q => q.enabled),
    optional: OPTIONAL_TEST_QUERIES.filter(q => q.enabled),
    custom: CUSTOM_TEST_QUERIES.filter(q => q.enabled)
  };
}

/**
 * Helper function to get all queries as a flat array
 */
export function getAllEnabledQueries(): TestQueryConfig[] {
  return [
    ...CRITICAL_TEST_QUERIES.filter(q => q.enabled),
    ...IMPORTANT_TEST_QUERIES.filter(q => q.enabled),
    ...OPTIONAL_TEST_QUERIES.filter(q => q.enabled),
    ...CUSTOM_TEST_QUERIES.filter(q => q.enabled)
  ];
}

/**
 * Helper function to enable/disable queries by category
 */
export function toggleQueryCategory(category: 'critical' | 'important' | 'optional' | 'custom', enabled: boolean): void {
  const categories = {
    critical: CRITICAL_TEST_QUERIES,
    important: IMPORTANT_TEST_QUERIES,
    optional: OPTIONAL_TEST_QUERIES,
    custom: CUSTOM_TEST_QUERIES
  };
  
  categories[category].forEach(query => {
    query.enabled = enabled;
  });
} 