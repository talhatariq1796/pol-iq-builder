/**
 * DonorClusterAnalyzer - Geographic clustering of donors for efficient outreach
 *
 * This class analyzes the geographic distribution of donors (especially lapsed donors)
 * and creates clusters for efficient field operations like door-to-door canvassing,
 * phone banking, or targeted mail campaigns.
 *
 * Key Features:
 * - Groups nearby ZIP codes with high donor density
 * - Calculates canvassing efficiency metrics
 * - Provides outreach recommendations based on density and value
 * - Integrates demographic data for targeting refinement
 *
 * @module lib/donor/DonorClusterAnalyzer
 */

import type { LapsedDonor } from './LapsedDonorAnalyzer';

/**
 * Geographic cluster of donors
 */
export interface DonorCluster {
  clusterId: string;
  centroid: { lat: number; lng: number };
  zipCodes: string[];

  // Cluster stats
  donorCount: number;
  totalHistoricalAmount: number;
  avgHistoricalGift: number;
  totalEstimatedRecovery: number;

  // Recovery metrics
  avgRecoveryScore: number;
  highPriorityCount: number;
  mediumPriorityCount: number;
  lowPriorityCount: number;

  // Efficiency metrics
  donorDensity: number;             // Donors per sq mile
  canvassingEfficiency: number;     // Estimated contacts per hour
  estimatedContactRate: number;     // % of doors that will answer

  // Demographics (from ZIP data)
  avgMedianIncome?: number;
  totalPopulation?: number;
  dominantTapestry?: string;

  // Recommended action
  priorityScore: number;            // 0-100
  recommendedApproach: string;
  estimatedHoursNeeded: number;
}

/**
 * Options for cluster analysis
 */
export interface ClusterOptions {
  maxDistance?: number;              // Max distance in miles for clustering
  minDonorsPerCluster?: number;      // Minimum donors to form a cluster
  maxClustersToReturn?: number;      // Top N clusters to return
  prioritizeHighValue?: boolean;     // Weight by donor value vs count
}

/**
 * ZIP code coordinates for geographic clustering
 *
 * Note: This system uses ZIP code-based clustering rather than individual address geocoding.
 * ZIP centroids provide sufficient granularity for donor clustering and canvassing route
 * planning. The coordinates below are centroids of Ingham County ZIP code areas used for
 * distance calculations and cluster formation.
 */
interface ZIPCoordinates {
  zipCode: string;
  lat: number;
  lng: number;
  city: string;
}

/**
 * ZIP code demographic data for clustering context
 */
interface ZIPDemographics {
  zipCode: string;
  population: number;
  medianIncome: number;
  areaSqMiles?: number;
  tapestrySegment?: string;
}

export class DonorClusterAnalyzer {
  /**
   * ZIP code centroids for Ingham County, MI
   *
   * These coordinates represent the geographic center of each ZIP code area
   * and are used for distance-based clustering. ZIP-level granularity is
   * appropriate for donor clustering as it balances precision with privacy
   * and matches the resolution of FEC donor data.
   */
  private readonly INGHAM_ZIP_COORDS: Map<string, ZIPCoordinates> = new Map([
    ['48823', { zipCode: '48823', lat: 42.7370, lng: -84.4839, city: 'East Lansing' }],
    ['48824', { zipCode: '48824', lat: 42.7011, lng: -84.5554, city: 'East Lansing' }],
    ['48825', { zipCode: '48825', lat: 42.7144, lng: -84.4844, city: 'East Lansing' }],
    ['48840', { zipCode: '48840', lat: 42.7466, lng: -84.4011, city: 'Haslett' }],
    ['48842', { zipCode: '48842', lat: 42.6667, lng: -84.3833, city: 'Haslett' }],
    ['48864', { zipCode: '48864', lat: 42.7222, lng: -84.3972, city: 'Okemos' }],
    ['48906', { zipCode: '48906', lat: 42.7325, lng: -84.5467, city: 'Lansing' }],
    ['48910', { zipCode: '48910', lat: 42.7142, lng: -84.5608, city: 'Lansing' }],
    ['48911', { zipCode: '48911', lat: 42.7686, lng: -84.5867, city: 'Lansing' }],
    ['48912', { zipCode: '48912', lat: 42.7495, lng: -84.5342, city: 'Lansing' }],
    ['48915', { zipCode: '48915', lat: 42.7589, lng: -84.6142, city: 'Lansing' }],
    ['48917', { zipCode: '48917', lat: 42.6939, lng: -84.6197, city: 'Lansing' }],
    ['48933', { zipCode: '48933', lat: 42.6656, lng: -84.5539, city: 'Lansing' }],
  ]);

  /**
   * Create geographic clusters from lapsed donors
   *
   * @param lapsedDonors - Array of lapsed donors
   * @param options - Clustering options
   * @returns Array of donor clusters sorted by priority score
   */
  createClusters(
    lapsedDonors: LapsedDonor[],
    options: ClusterOptions = {}
  ): DonorCluster[] {
    const {
      maxDistance = 5, // 5 miles default
      minDonorsPerCluster = 5,
      maxClustersToReturn = 10,
      prioritizeHighValue = true,
    } = options;

    // Group donors by ZIP code
    const donorsByZip = this.groupDonorsByZip(lapsedDonors);

    // Filter ZIPs that meet minimum donor threshold
    const qualifiedZips = Array.from(donorsByZip.entries())
      .filter(([_, donors]) => donors.length >= Math.floor(minDonorsPerCluster / 2))
      .map(([zipCode, donors]) => ({ zipCode, donors }));

    if (qualifiedZips.length === 0) {
      return [];
    }

    // Create clusters using simple geographic proximity
    const clusters = this.clusterByProximity(
      qualifiedZips,
      maxDistance,
      minDonorsPerCluster
    );

    // Calculate metrics for each cluster
    const enrichedClusters = clusters.map((cluster) =>
      this.enrichCluster(cluster, prioritizeHighValue)
    );

    // Sort by priority score descending
    enrichedClusters.sort((a, b) => b.priorityScore - a.priorityScore);

    // Return top N clusters
    return enrichedClusters.slice(0, maxClustersToReturn);
  }

  /**
   * Group donors by ZIP code
   */
  private groupDonorsByZip(
    lapsedDonors: LapsedDonor[]
  ): Map<string, LapsedDonor[]> {
    const grouped = new Map<string, LapsedDonor[]>();

    for (const donor of lapsedDonors) {
      if (!grouped.has(donor.zipCode)) {
        grouped.set(donor.zipCode, []);
      }
      grouped.get(donor.zipCode)!.push(donor);
    }

    return grouped;
  }

  /**
   * Cluster ZIPs by geographic proximity using simple distance-based algorithm
   */
  private clusterByProximity(
    zipData: Array<{ zipCode: string; donors: LapsedDonor[] }>,
    maxDistance: number,
    minDonorsPerCluster: number
  ): Array<{ zipCodes: string[]; donors: LapsedDonor[] }> {
    const clusters: Array<{ zipCodes: string[]; donors: LapsedDonor[] }> = [];
    const processed = new Set<string>();

    for (const { zipCode, donors } of zipData) {
      if (processed.has(zipCode)) continue;

      const coords = this.INGHAM_ZIP_COORDS.get(zipCode);
      if (!coords) continue; // Skip ZIPs without coordinates

      // Start new cluster
      const cluster = {
        zipCodes: [zipCode],
        donors: [...donors],
      };

      processed.add(zipCode);

      // Find nearby ZIPs to add to cluster
      for (const { zipCode: otherZip, donors: otherDonors } of zipData) {
        if (processed.has(otherZip)) continue;

        const otherCoords = this.INGHAM_ZIP_COORDS.get(otherZip);
        if (!otherCoords) continue;

        const distance = this.calculateDistance(
          coords.lat,
          coords.lng,
          otherCoords.lat,
          otherCoords.lng
        );

        if (distance <= maxDistance) {
          cluster.zipCodes.push(otherZip);
          cluster.donors.push(...otherDonors);
          processed.add(otherZip);
        }
      }

      // Only add cluster if it meets minimum donor threshold
      if (cluster.donors.length >= minDonorsPerCluster) {
        clusters.push(cluster);
      }
    }

    return clusters;
  }

  /**
   * Calculate distance between two lat/lng points (Haversine formula)
   * Returns distance in miles
   */
  private calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Enrich cluster with calculated metrics
   */
  private enrichCluster(
    cluster: { zipCodes: string[]; donors: LapsedDonor[] },
    prioritizeHighValue: boolean
  ): DonorCluster {
    const { zipCodes, donors } = cluster;

    // Calculate centroid
    const centroid = this.calculateCentroid(zipCodes);

    // Calculate aggregate statistics
    const donorCount = donors.length;
    const totalHistoricalAmount = donors.reduce(
      (sum, d) => sum + d.totalHistoricalAmount,
      0
    );
    const avgHistoricalGift = totalHistoricalAmount / donorCount;
    const totalEstimatedRecovery = donors.reduce(
      (sum, d) => sum + d.estimatedRecoveryAmount,
      0
    );

    // Recovery metrics
    const avgRecoveryScore =
      donors.reduce((sum, d) => sum + d.recoveryScore, 0) / donorCount;
    const highPriorityCount = donors.filter((d) => d.priority === 'high').length;
    const mediumPriorityCount = donors.filter(
      (d) => d.priority === 'medium'
    ).length;
    const lowPriorityCount = donors.filter((d) => d.priority === 'low').length;

    // Estimate cluster area (simplified: circle with radius = max distance from centroid)
    const areaSqMiles = this.estimateClusterArea(zipCodes, centroid);

    // Efficiency metrics
    const donorDensity = areaSqMiles > 0 ? donorCount / areaSqMiles : 0;
    const canvassingEfficiency = this.estimateCanvassingEfficiency(donorDensity);
    const estimatedContactRate = this.estimateContactRate(avgRecoveryScore);

    // Calculate priority score
    const priorityScore = this.calculatePriorityScore(
      donorCount,
      avgRecoveryScore,
      totalEstimatedRecovery,
      donorDensity,
      prioritizeHighValue
    );

    // Recommend approach
    const recommendedApproach = this.recommendApproach(
      donorCount,
      donorDensity,
      avgHistoricalGift
    );

    // Estimate hours needed
    const estimatedHoursNeeded = this.estimateHoursNeeded(
      donorCount,
      canvassingEfficiency,
      recommendedApproach
    );

    // Generate cluster ID
    const clusterId = this.generateClusterId(zipCodes);

    return {
      clusterId,
      centroid,
      zipCodes,
      donorCount,
      totalHistoricalAmount,
      avgHistoricalGift,
      totalEstimatedRecovery,
      avgRecoveryScore,
      highPriorityCount,
      mediumPriorityCount,
      lowPriorityCount,
      donorDensity,
      canvassingEfficiency,
      estimatedContactRate,
      priorityScore,
      recommendedApproach,
      estimatedHoursNeeded,
    };
  }

  /**
   * Calculate geographic centroid of cluster
   */
  private calculateCentroid(zipCodes: string[]): { lat: number; lng: number } {
    const coords = zipCodes
      .map((zip) => this.INGHAM_ZIP_COORDS.get(zip))
      .filter((c): c is ZIPCoordinates => c !== undefined);

    if (coords.length === 0) {
      return { lat: 42.7, lng: -84.55 }; // Lansing default
    }

    const lat = coords.reduce((sum, c) => sum + c.lat, 0) / coords.length;
    const lng = coords.reduce((sum, c) => sum + c.lng, 0) / coords.length;

    return { lat, lng };
  }

  /**
   * Estimate cluster area based on max distance from centroid
   */
  private estimateClusterArea(
    zipCodes: string[],
    centroid: { lat: number; lng: number }
  ): number {
    let maxDistance = 0;

    for (const zipCode of zipCodes) {
      const coords = this.INGHAM_ZIP_COORDS.get(zipCode);
      if (!coords) continue;

      const distance = this.calculateDistance(
        centroid.lat,
        centroid.lng,
        coords.lat,
        coords.lng
      );

      maxDistance = Math.max(maxDistance, distance);
    }

    // Area of circle: π * r²
    return Math.PI * Math.pow(maxDistance, 2);
  }

  /**
   * Estimate canvassing efficiency (contacts per hour) based on donor density
   */
  private estimateCanvassingEfficiency(donorDensity: number): number {
    // High density (>10 donors/sq mi): 8-12 contacts/hour
    // Medium density (3-10 donors/sq mi): 5-8 contacts/hour
    // Low density (<3 donors/sq mi): 3-5 contacts/hour

    if (donorDensity >= 10) {
      return 10; // High efficiency
    } else if (donorDensity >= 3) {
      return 6; // Medium efficiency
    } else {
      return 4; // Low efficiency
    }
  }

  /**
   * Estimate contact rate based on recovery score
   * Higher recovery score donors may be more receptive
   */
  private estimateContactRate(avgRecoveryScore: number): number {
    // Base contact rate: 30% (typical door-to-door)
    // Adjust up to 50% for high recovery score donors
    const baseRate = 0.3;
    const bonus = (avgRecoveryScore / 100) * 0.2;
    return Math.min(0.5, baseRate + bonus);
  }

  /**
   * Calculate priority score for cluster (0-100)
   *
   * Factors:
   * - Donor count (20%)
   * - Average recovery score (30%)
   * - Total estimated recovery (30%)
   * - Donor density (20%)
   */
  private calculatePriorityScore(
    donorCount: number,
    avgRecoveryScore: number,
    totalEstimatedRecovery: number,
    donorDensity: number,
    prioritizeHighValue: boolean
  ): number {
    // Donor count score (0-100)
    // 50+ donors = 100, scale linearly down to 5 donors = 20
    const countScore = Math.min(100, 20 + (donorCount / 50) * 80);

    // Recovery score (already 0-100)
    const recoveryScore = avgRecoveryScore;

    // Value score (0-100)
    // $10,000+ = 100, scale down to $500 = 20
    const valueScore = Math.min(100, 20 + (totalEstimatedRecovery / 10000) * 80);

    // Density score (0-100)
    // 20+ donors/sq mi = 100, scale down to 1 donor/sq mi = 20
    const densityScore = Math.min(100, 20 + (donorDensity / 20) * 80);

    // Weighted average
    let weights = { count: 0.2, recovery: 0.3, value: 0.3, density: 0.2 };

    if (prioritizeHighValue) {
      weights = { count: 0.15, recovery: 0.25, value: 0.45, density: 0.15 };
    }

    const totalScore =
      countScore * weights.count +
      recoveryScore * weights.recovery +
      valueScore * weights.value +
      densityScore * weights.density;

    return Math.round(totalScore);
  }

  /**
   * Recommend outreach approach based on cluster characteristics
   */
  private recommendApproach(
    donorCount: number,
    donorDensity: number,
    avgGift: number
  ): string {
    // High density + many donors → Door-to-door canvass
    if (donorDensity >= 8 && donorCount >= 20) {
      return 'Door-to-door canvass with targeted script';
    }

    // High value + medium density → Phone + mail combo
    if (avgGift >= 200 && donorDensity >= 3) {
      return 'Phone banking + personalized mail';
    }

    // High value + low density → Mail + email
    if (avgGift >= 200) {
      return 'Personalized mail + email follow-up';
    }

    // Medium density → Door or phone
    if (donorDensity >= 5) {
      return 'Door-to-door or phone banking';
    }

    // Low density → Digital + mail
    return 'Digital outreach + mail campaign';
  }

  /**
   * Estimate hours needed to contact cluster
   */
  private estimateHoursNeeded(
    donorCount: number,
    efficiency: number,
    approach: string
  ): number {
    // Adjust efficiency based on approach
    let adjustedEfficiency = efficiency;

    if (approach.includes('Door-to-door')) {
      adjustedEfficiency *= 1.0; // No adjustment - base efficiency is for door
    } else if (approach.includes('Phone')) {
      adjustedEfficiency *= 1.5; // Phone is faster
    } else if (approach.includes('mail')) {
      adjustedEfficiency *= 3.0; // Mail prep is faster per contact
    } else {
      adjustedEfficiency *= 5.0; // Digital is fastest
    }

    const hours = donorCount / adjustedEfficiency;
    return Math.ceil(hours * 10) / 10; // Round to 1 decimal
  }

  /**
   * Generate cluster ID from ZIP codes
   */
  private generateClusterId(zipCodes: string[]): string {
    const sorted = [...zipCodes].sort();
    return `cluster_${sorted.join('_')}`;
  }

  /**
   * Format cluster for display
   */
  formatCluster(cluster: DonorCluster): string {
    const amount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(cluster.totalEstimatedRecovery);

    return [
      `Cluster: ${cluster.clusterId}`,
      `ZIPs: ${cluster.zipCodes.join(', ')}`,
      `Donors: ${cluster.donorCount} (${cluster.highPriorityCount} high, ${cluster.mediumPriorityCount} medium, ${cluster.lowPriorityCount} low priority)`,
      `Estimated Recovery: ${amount}`,
      `Avg Recovery Score: ${Math.round(cluster.avgRecoveryScore)}/100`,
      `Density: ${cluster.donorDensity.toFixed(1)} donors/sq mi`,
      `Efficiency: ${cluster.canvassingEfficiency} contacts/hour`,
      `Priority Score: ${cluster.priorityScore}/100`,
      `Recommended: ${cluster.recommendedApproach}`,
      `Estimated Time: ${cluster.estimatedHoursNeeded} hours`,
    ].join('\n');
  }
}
