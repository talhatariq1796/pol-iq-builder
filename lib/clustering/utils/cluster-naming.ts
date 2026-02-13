/**
 * Cluster Naming Utilities
 * 
 * Generates descriptive, meaningful names for campaign territories based on
 * their characteristics, location, and analysis scores.
 */

import { ClusteringFeature, ClusteringMethod } from '../types';

/**
 * Generate a descriptive name for a cluster
 */
export function generateClusterName(
  features: ClusteringFeature[],
  method: ClusteringMethod,
  clusterId: number
): string {
  if (features.length === 0) {
    return `Territory ${clusterId}`;
  }

  // Extract characteristics
  const characteristics = analyzeClusterCharacteristics(features, method);
  
  // Generate base name based on analysis method
  let baseName = generateBaseNameByMethod(characteristics, method);
  
  // Add geographic context if available
  const geographicContext = extractGeographicContext(features);
  if (geographicContext) {
    baseName = `${geographicContext} ${baseName}`;
  }
  
  // Ensure uniqueness with cluster ID if needed
  return baseName || `Territory ${clusterId}`;
}

/**
 * Analyze cluster characteristics for naming
 */
function analyzeClusterCharacteristics(
  features: ClusteringFeature[],
  method: ClusteringMethod
) {
  const scores = features.map(f => f.primaryScore);
  const populations = features.map(f => f.population);
  const incomes = features.map(f => f.medianIncome || 0).filter(i => i > 0);
  const ages = features.map(f => f.medianAge || 0).filter(a => a > 0);
  
  const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  const totalPopulation = populations.reduce((sum, p) => sum + p, 0);
  const avgIncome = incomes.length > 0 ? incomes.reduce((sum, i) => sum + i, 0) / incomes.length : 0;
  const avgAge = ages.length > 0 ? ages.reduce((sum, a) => sum + a, 0) / ages.length : 0;
  
  // Method-specific characteristics
  let methodSpecific = {};
  
  switch (method) {
    case 'strategic-scores':
      methodSpecific = {
        strategicScores: features.map(f => f.strategicScore || f.primaryScore),
        demographicOpportunity: features.map(f => f.demographicOpportunity || 0),
        competitiveAdvantage: features.map(f => f.competitiveAdvantage || 0)
      };
      break;
      
    case 'competitive-scores':
      methodSpecific = {
        nikeShares: features.map(f => f.nikeShare || 0),
        adidasShares: features.map(f => f.adidasShare || 0),
        marketGaps: features.map(f => f.marketGap || 0)
      };
      break;
      
    case 'demographic-scores':
      // Already captured in general characteristics
      break;
  }
  
  return {
    avgScore,
    totalPopulation,
    avgIncome,
    avgAge,
    zipCodeCount: features.length,
    ...methodSpecific
  };
}

/**
 * Generate base name based on analysis method
 */
function generateBaseNameByMethod(characteristics: any, method: ClusteringMethod): string {
  switch (method) {
    case 'strategic-scores':
      return generateStrategicName(characteristics);
      
    case 'competitive-scores':
      return generateCompetitiveName(characteristics);
      
    case 'demographic-scores':
      return generateDemographicName(characteristics);
      
    case 'analysis-geographic':
    default:
      return generateAnalysisGeographicName(characteristics);
  }
}

/**
 * Generate name for strategic analysis clusters
 */
function generateStrategicName(characteristics: any): string {
  const { avgScore, totalPopulation, avgIncome } = characteristics;
  
  let qualifier = '';
  let type = 'Territory';
  
  // Score-based qualifier
  if (avgScore >= 8) {
    qualifier = 'High-Value';
  } else if (avgScore >= 6) {
    qualifier = 'Strategic';
  } else if (avgScore >= 4) {
    qualifier = 'Emerging';
  } else {
    qualifier = 'Opportunity';
  }
  
  // Population-based type
  if (totalPopulation >= 500000) {
    type = 'Metro Territory';
  } else if (totalPopulation >= 100000) {
    type = 'Urban Territory';
  } else if (totalPopulation >= 25000) {
    type = 'Suburban Territory';
  } else {
    type = 'Local Territory';
  }
  
  // Income modifier
  if (avgIncome >= 75000) {
    return `${qualifier} Premium ${type}`;
  } else if (avgIncome >= 50000) {
    return `${qualifier} ${type}`;
  } else {
    return `${qualifier} Value ${type}`;
  }
}

/**
 * Generate name for competitive analysis clusters
 */
function generateCompetitiveName(characteristics: any): string {
  const { avgScore, nikeShares = [], adidasShares = [], marketGaps = [] } = characteristics;
  
  const avgNikeShare = nikeShares.length > 0 ? nikeShares.reduce((sum: number, s: number) => sum + s, 0) / nikeShares.length : 0;
  const avgAdidasShare = adidasShares.length > 0 ? adidasShares.reduce((sum: number, s: number) => sum + s, 0) / adidasShares.length : 0;
  const avgMarketGap = marketGaps.length > 0 ? marketGaps.reduce((sum: number, g: number) => sum + g, 0) / marketGaps.length : 0;
  
  let competitive = '';
  let opportunity = '';
  
  // Competitive landscape
  if (avgNikeShare > avgAdidasShare * 1.5) {
    competitive = 'Nike-Dominant';
  } else if (avgAdidasShare > avgNikeShare * 1.5) {
    competitive = 'Adidas-Strong';
  } else if (Math.abs(avgNikeShare - avgAdidasShare) < 5) {
    competitive = 'Balanced';
  } else {
    competitive = 'Competitive';
  }
  
  // Opportunity level
  if (avgMarketGap >= 50) {
    opportunity = 'High-Opportunity';
  } else if (avgMarketGap >= 30) {
    opportunity = 'Growth';
  } else if (avgMarketGap >= 15) {
    opportunity = 'Established';
  } else {
    opportunity = 'Mature';
  }
  
  return `${competitive} ${opportunity} Territory`;
}

/**
 * Generate name for demographic analysis clusters
 */
function generateDemographicName(characteristics: any): string {
  const { avgScore, totalPopulation, avgIncome, avgAge } = characteristics;
  
  let demographic = '';
  let market = '';
  
  // Age-based demographic
  if (avgAge > 0) {
    if (avgAge < 30) {
      demographic = 'Young';
    } else if (avgAge < 45) {
      demographic = 'Family';
    } else if (avgAge < 60) {
      demographic = 'Established';
    } else {
      demographic = 'Mature';
    }
  } else {
    demographic = 'Mixed';
  }
  
  // Income-based market
  if (avgIncome >= 75000) {
    market = 'Affluent';
  } else if (avgIncome >= 50000) {
    market = 'Middle';
  } else if (avgIncome > 0) {
    market = 'Value';
  } else {
    market = 'Diverse';
  }
  
  // Population size modifier
  if (totalPopulation >= 200000) {
    return `${demographic} ${market} Metro`;
  } else if (totalPopulation >= 50000) {
    return `${demographic} ${market} Market`;
  } else {
    return `${demographic} ${market} Community`;
  }
}

/**
 * Generate name for analysis + geographic clusters
 */
function generateAnalysisGeographicName(characteristics: any): string {
  const { avgScore, totalPopulation, zipCodeCount } = characteristics;
  
  let performance = '';
  let scale = '';
  
  // Performance level
  if (avgScore >= 7) {
    performance = 'High-Performing';
  } else if (avgScore >= 5) {
    performance = 'Strong';
  } else if (avgScore >= 3) {
    performance = 'Moderate';
  } else {
    performance = 'Developing';
  }
  
  // Scale level
  if (zipCodeCount >= 20) {
    scale = 'Regional Territory';
  } else if (zipCodeCount >= 10) {
    scale = 'Area Territory';
  } else {
    scale = 'Local Territory';
  }
  
  return `${performance} ${scale}`;
}

/**
 * Extract geographic context from features (if available)
 */
function extractGeographicContext(features: ClusteringFeature[]): string | null {
  // This would ideally use reverse geocoding or state/city data
  // For now, return null and rely on base names
  
  // Future enhancement: extract common state, city, or region from zip codes
  // Example implementation would check if most zip codes are in same state/metro area
  
  return null;
}

/**
 * Generate alternative names for clusters to avoid duplicates
 */
export function generateAlternativeNames(
  baseName: string,
  existingNames: string[],
  clusterId: number
): string {
  if (!existingNames.includes(baseName)) {
    return baseName;
  }
  
  // Try with directional modifiers
  const directions = ['North', 'South', 'East', 'West', 'Central'];
  for (const direction of directions) {
    const altName = `${direction} ${baseName}`;
    if (!existingNames.includes(altName)) {
      return altName;
    }
  }
  
  // Try with numeric modifiers
  for (let i = 1; i <= 10; i++) {
    const altName = `${baseName} ${i}`;
    if (!existingNames.includes(altName)) {
      return altName;
    }
  }
  
  // Fall back to cluster ID
  return `${baseName} (${clusterId})`;
}

/**
 * Validate and clean cluster name
 */
export function validateClusterName(name: string): string {
  // Remove any special characters that might cause issues
  let cleanName = name.replace(/[^\w\s-]/g, '');
  
  // Limit length
  if (cleanName.length > 50) {
    cleanName = cleanName.substring(0, 47) + '...';
  }
  
  // Ensure it's not empty
  if (!cleanName.trim()) {
    cleanName = 'Unnamed Territory';
  }
  
  return cleanName.trim();
}

/**
 * Generate cluster insights based on characteristics
 */
export function generateClusterInsights(
  features: ClusteringFeature[],
  method: ClusteringMethod
): string {
  if (features.length === 0) {
    return 'No data available';
  }
  
  const characteristics = analyzeClusterCharacteristics(features, method);
  const insights: string[] = [];
  
  // Population insight
  if (characteristics.totalPopulation >= 100000) {
    insights.push('Large population base');
  } else if (characteristics.totalPopulation <= 25000) {
    insights.push('Focused local market');
  }
  
  // Income insight
  if (characteristics.avgIncome >= 75000) {
    insights.push('High income demographics');
  } else if (characteristics.avgIncome <= 35000 && characteristics.avgIncome > 0) {
    insights.push('Price-sensitive market');
  }
  
  // Age insight
  if (characteristics.avgAge > 0) {
    if (characteristics.avgAge < 35) {
      insights.push('Young demographics');
    } else if (characteristics.avgAge > 55) {
      insights.push('Mature market');
    }
  }
  
  // Method-specific insights
  switch (method) {
    case 'strategic-scores':
      if (characteristics.avgScore >= 7) {
        insights.push('High strategic value');
      }
      break;
      
    case 'competitive-scores':
      const nikeShare = (characteristics as any).nikeShares?.[0] || 0;
      const adidasShare = (characteristics as any).adidasShares?.[0] || 0;
      if (nikeShare > adidasShare * 1.5) {
        insights.push('Nike preference');
      } else if (adidasShare > nikeShare * 1.5) {
        insights.push('Adidas strength');
      }
      break;
  }
  
  return insights.length > 0 ? insights.join(', ') : 'Mixed demographics';
}