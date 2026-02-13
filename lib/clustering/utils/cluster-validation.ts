/**
 * Cluster Validation Utilities
 * 
 * Validates clusters against size, population, and geographic radius requirements
 * to ensure territories are viable for campaign planning.
 */

import { ClusterResult, ClusterConfig, ClusterValidationResult, ClusteringError, CLUSTERING_ERROR_CODES } from '../types';
import { calculateDistance } from './geographic-utils';

/**
 * Validate a single cluster against configuration requirements
 */
export function validateCluster(
  cluster: ClusterResult, 
  config: ClusterConfig
): ClusterValidationResult {
  const issues: string[] = [];
  
  // Size validation
  const hasMinZipCodes = cluster.zipCodes.length >= config.minZipCodes;
  if (!hasMinZipCodes) {
    issues.push(`Only ${cluster.zipCodes.length} zip codes (minimum: ${config.minZipCodes})`);
  }
  
  // Population validation
  const hasMinPopulation = cluster.totalPopulation >= config.minPopulation;
  if (!hasMinPopulation) {
    issues.push(`Population ${cluster.totalPopulation.toLocaleString()} (minimum: ${config.minPopulation.toLocaleString()})`);
  }
  
  // Geographic radius validation
  const withinMaxRadius = cluster.radiusMiles <= config.maxRadiusMiles;
  if (!withinMaxRadius) {
    issues.push(`Radius ${cluster.radiusMiles.toFixed(1)} miles (maximum: ${config.maxRadiusMiles} miles)`);
  }
  
  // Overall validity
  const isValid = hasMinZipCodes && hasMinPopulation && withinMaxRadius;
  
  return {
    isValid,
    issues,
    hasMinZipCodes,
    zipCodeCount: cluster.zipCodes.length,
    hasMinPopulation,
    totalPopulation: cluster.totalPopulation,
    withinMaxRadius,
    actualRadiusMiles: cluster.radiusMiles,
    maxRadiusMiles: config.maxRadiusMiles
  };
}

/**
 * Validate all clusters and provide summary statistics
 */
export function validateClusters(
  clusters: ClusterResult[], 
  config: ClusterConfig
): {
  validClusters: ClusterResult[];
  invalidClusters: ClusterResult[];
  summary: {
    totalClusters: number;
    validCount: number;
    invalidCount: number;
    validationRate: number;
    commonIssues: string[];
  };
} {
  const validClusters: ClusterResult[] = [];
  const invalidClusters: ClusterResult[] = [];
  const allIssues: string[] = [];
  
  clusters.forEach(cluster => {
    const validation = validateCluster(cluster, config);
    cluster.isValid = validation.isValid;
    cluster.validationIssues = validation.issues;
    
    if (validation.isValid) {
      validClusters.push(cluster);
    } else {
      invalidClusters.push(cluster);
      allIssues.push(...validation.issues);
    }
  });
  
  // Find most common issues
  const issueCounts = allIssues.reduce((counts, issue) => {
    const key = issue.split('(')[0].trim(); // Group similar issues
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);
  
  const commonIssues = Object.entries(issueCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([issue]) => issue);
  
  const validationRate = clusters.length > 0 ? validClusters.length / clusters.length : 0;
  
  return {
    validClusters,
    invalidClusters,
    summary: {
      totalClusters: clusters.length,
      validCount: validClusters.length,
      invalidCount: invalidClusters.length,
      validationRate,
      commonIssues
    }
  };
}

/**
 * Check if cluster configuration is feasible given the dataset
 */
export function validateClusterConfig(
  config: ClusterConfig,
  totalZipCodes: number,
  totalPopulation: number,
  geographicSpread: { minDistance: number; maxDistance: number }
): {
  isValid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // Check if we have enough zip codes
  if (totalZipCodes < config.numClusters) {
    errors.push(`Cannot create ${config.numClusters} clusters from ${totalZipCodes} zip codes`);
  }
  
  // Check if we have enough zip codes per cluster
  const avgZipCodesPerCluster = totalZipCodes / config.numClusters;
  if (avgZipCodesPerCluster < config.minZipCodes) {
    errors.push(`Average ${avgZipCodesPerCluster.toFixed(1)} zip codes per cluster (minimum: ${config.minZipCodes})`);
  }
  
  // Check if we have enough population
  const avgPopulationPerCluster = totalPopulation / config.numClusters;
  if (avgPopulationPerCluster < config.minPopulation) {
    const shortfall = config.minPopulation - avgPopulationPerCluster;
    if (shortfall > config.minPopulation * 0.5) {
      errors.push(`Average ${avgPopulationPerCluster.toLocaleString()} population per cluster (minimum: ${config.minPopulation.toLocaleString()})`);
    } else {
      warnings.push(`Low average population per cluster: ${avgPopulationPerCluster.toLocaleString()}`);
    }
  }
  
  // Check geographic constraints
  if (geographicSpread.maxDistance > config.maxRadiusMiles * 2) {
    warnings.push(`Large geographic area may create scattered clusters (span: ${geographicSpread.maxDistance.toFixed(1)} miles)`);
  }
  
  if (geographicSpread.minDistance === 0) {
    warnings.push('Some zip codes are very close together (may create tiny clusters)');
  }
  
  // Check for conflicting parameters
  if (config.numClusters > 15 && config.minPopulation > 25000) {
    warnings.push('High cluster count with high population requirement may be difficult to satisfy');
  }
  
  if (config.maxRadiusMiles < 25 && config.minZipCodes > 15) {
    warnings.push('Small radius with high zip code requirement may be conflicting');
  }
  
  return {
    isValid: errors.length === 0,
    warnings,
    errors
  };
}

/**
 * Suggest configuration adjustments for better clustering results
 */
export function suggestConfigAdjustments(
  config: ClusterConfig,
  validationResult: { validCount: number; totalClusters: number; commonIssues: string[] }
): {
  suggestions: string[];
  adjustedConfig?: Partial<ClusterConfig>;
} {
  const suggestions: string[] = [];
  const adjustedConfig: Partial<ClusterConfig> = {};
  
  const validationRate = validationResult.validCount / validationResult.totalClusters;
  
  // If validation rate is too low, suggest adjustments
  if (validationRate < 0.5) {
    suggestions.push('Low cluster validation rate detected. Consider adjusting parameters:');
    
    // Analyze common issues and suggest fixes
    validationResult.commonIssues.forEach(issue => {
      if (issue.includes('zip codes')) {
        suggestions.push('• Reduce minimum zip codes per cluster');
        adjustedConfig.minZipCodes = Math.max(5, Math.floor(config.minZipCodes * 0.7));
      }
      
      if (issue.includes('Population')) {
        suggestions.push('• Reduce minimum population requirement');
        adjustedConfig.minPopulation = Math.max(10000, Math.floor(config.minPopulation * 0.7));
      }
      
      if (issue.includes('Radius')) {
        suggestions.push('• Increase maximum radius or reduce cluster count');
        adjustedConfig.maxRadiusMiles = Math.min(100, Math.floor(config.maxRadiusMiles * 1.3));
        adjustedConfig.numClusters = Math.max(1, Math.floor(config.numClusters * 0.8));
      }
    });
  } else if (validationRate > 0.9) {
    // If validation rate is very high, we might be able to be more strict
    suggestions.push('All clusters meet requirements. Consider more stringent criteria for higher quality territories:');
    suggestions.push('• Increase minimum population for larger territories');
    suggestions.push('• Reduce maximum radius for more compact territories');
  }
  
  return { suggestions, adjustedConfig };
}

/**
 * Calculate cluster quality metrics
 */
export function calculateClusterQuality(clusters: ClusterResult[]): {
  overall: number; // 0-1 score
  compactness: number; // How geographically compact clusters are
  balance: number; // How evenly sized clusters are
  coherence: number; // How internally consistent cluster scores are
  metrics: {
    avgRadius: number;
    radiusVariance: number;
    avgPopulation: number;
    populationVariance: number;
    avgScoreVariance: number;
  };
} {
  if (clusters.length === 0) {
    return {
      overall: 0,
      compactness: 0,
      balance: 0,
      coherence: 0,
      metrics: {
        avgRadius: 0,
        radiusVariance: 0,
        avgPopulation: 0,
        populationVariance: 0,
        avgScoreVariance: 0
      }
    };
  }
  
  // Calculate basic metrics
  const radii = clusters.map(c => c.radiusMiles);
  const populations = clusters.map(c => c.totalPopulation);
  const scoreVariances = clusters.map(c => {
    const [min, max] = c.scoreRange;
    return max - min;
  });
  
  const avgRadius = radii.reduce((sum, r) => sum + r, 0) / radii.length;
  const avgPopulation = populations.reduce((sum, p) => sum + p, 0) / populations.length;
  const avgScoreVariance = scoreVariances.reduce((sum, v) => sum + v, 0) / scoreVariances.length;
  
  // Calculate variances
  const radiusVariance = radii.reduce((sum, r) => sum + Math.pow(r - avgRadius, 2), 0) / radii.length;
  const populationVariance = populations.reduce((sum, p) => sum + Math.pow(p - avgPopulation, 2), 0) / populations.length;
  
  // Quality scores (0-1, higher is better)
  const compactness = Math.max(0, 1 - (avgRadius / 50)); // Prefer smaller radii
  const balance = Math.max(0, 1 - (Math.sqrt(populationVariance) / avgPopulation)); // Prefer balanced populations
  const coherence = Math.max(0, 1 - (avgScoreVariance / 100)); // Prefer consistent scores within clusters
  
  const overall = (compactness + balance + coherence) / 3;
  
  return {
    overall,
    compactness,
    balance,
    coherence,
    metrics: {
      avgRadius,
      radiusVariance,
      avgPopulation,
      populationVariance,
      avgScoreVariance
    }
  };
}

/**
 * Validate cluster separation (ensure clusters don't overlap too much)
 */
export function validateClusterSeparation(
  clusters: ClusterResult[],
  minSeparationMiles: number = 10
): {
  isValid: boolean;
  overlappingPairs: Array<{
    cluster1: number;
    cluster2: number;
    distance: number;
    overlap: number;
  }>;
} {
  const overlappingPairs: Array<{
    cluster1: number;
    cluster2: number;
    distance: number;
    overlap: number;
  }> = [];
  
  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      const cluster1 = clusters[i];
      const cluster2 = clusters[j];
      
      // Calculate distance between centroids
      const distance = calculateDistance(
        cluster1.centroid[1], cluster1.centroid[0], // [lng, lat] -> [lat, lng]
        cluster2.centroid[1], cluster2.centroid[0]
      );
      
      // Calculate potential overlap
      const combinedRadius = cluster1.radiusMiles + cluster2.radiusMiles;
      const overlap = Math.max(0, combinedRadius - distance);
      
      if (distance < minSeparationMiles || overlap > 0) {
        overlappingPairs.push({
          cluster1: i,
          cluster2: j,
          distance,
          overlap
        });
      }
    }
  }
  
  return {
    isValid: overlappingPairs.length === 0,
    overlappingPairs
  };
}