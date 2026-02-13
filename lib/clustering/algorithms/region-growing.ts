/**
 * Region Growing Algorithm for Contiguous Territory Formation
 * 
 * Creates geographically contiguous territories by growing regions from high-scoring
 * seed ZIP codes to adjacent areas that meet score thresholds.
 */

import { 
  ClusteringFeature, 
  ClusterConfig, 
  ClusterResult, 
  ClusteringResult, 
  ClusteringError, 
  CLUSTERING_ERROR_CODES,
  ClusteringMethod
} from '../types';
import { calculateDistance, calculateCentroid, generateClusterBoundary } from '../utils/geographic-utils';
import { validateCluster } from '../utils/cluster-validation';
import { generateClusterName } from '../utils/cluster-naming';

export class RegionGrowingAlgorithm {
  private config: ClusterConfig;
  private features: ClusteringFeature[];
  private adjacencyMap: Map<string, Set<string>> = new Map();
  private assignedZipCodes: Set<string> = new Set();
  private scoreThreshold: number = 0;
  private detectedMethod: string = 'analysis-geographic';
  
  constructor(config: ClusterConfig) {
    // Ensure minScorePercentile exists with default value
    this.config = {
      ...config,
      minScorePercentile: config.minScorePercentile ?? 70
    };
    this.features = [];
  }

  /**
   * Main clustering method
   */
  public async cluster(features: ClusteringFeature[]): Promise<ClusteringResult> {
    const startTime = Date.now();
    console.log(`[RegionGrowing] 🚀 Starting region-growing clustering with ${features.length} features`);
    console.log(`[RegionGrowing] 📊 Config:`, this.config);
    
    try {
      // Validate inputs
      this.validateInputs(features);
      
      // Store features and detect method
      this.features = features;
      this.detectedMethod = this.detectMethodFromFeatures(features);
      
      // Calculate score threshold based on percentile
      this.scoreThreshold = this.calculateScoreThreshold(features);
      console.log(`[RegionGrowing] 📊 Score threshold (${this.config.minScorePercentile}th percentile): ${this.scoreThreshold.toFixed(3)}`);
      
      // Filter features above threshold
      const eligibleFeatures = features.filter(f => f.primaryScore >= this.scoreThreshold);
      console.log(`[RegionGrowing] 🎯 ${eligibleFeatures.length} of ${features.length} ZIP codes meet score threshold`);
      
      if (eligibleFeatures.length === 0) {
        throw new ClusteringError(
          'No ZIP codes meet the minimum score threshold',
          CLUSTERING_ERROR_CODES.INSUFFICIENT_DATA
        );
      }
      
      // Build adjacency map for contiguity checking
      await this.buildAdjacencyMap(features);
      
      // Find seed points and grow regions
      const clusters = await this.growRegions(eligibleFeatures);
      
      // Validate clusters
      const validatedClusters = await this.validateClusters(clusters);
      
      // Generate result
      const result: ClusteringResult = {
        success: validatedClusters.length > 0,
        clusters: validatedClusters,
        totalZipCodes: features.length,
        clusteredZipCodes: validatedClusters.reduce((sum, c) => sum + c.zipCodes.length, 0),
        unclustered: this.getUnclusteredZipCodes(features, validatedClusters),
        validClusters: validatedClusters.filter(c => c.isValid).length,
        invalidClusters: validatedClusters.filter(c => !c.isValid).length,
        algorithm: 'region-growing',
        processingTimeMs: Date.now() - startTime,
        parameters: this.config
      };
      
      console.log(`[RegionGrowing] ✅ Created ${result.validClusters} territories from ${eligibleFeatures.length} eligible ZIP codes`);
      
      return result;
      
    } catch (error) {
      throw new ClusteringError(
        `Region growing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        CLUSTERING_ERROR_CODES.FEATURE_EXTRACTION_FAILED,
        { originalError: error, config: this.config }
      );
    }
  }

  /**
   * Calculate score threshold based on percentile
   */
  private calculateScoreThreshold(features: ClusteringFeature[]): number {
    const scores = features.map(f => f.primaryScore).sort((a, b) => a - b);
    const percentileIndex = Math.floor(scores.length * (this.config.minScorePercentile / 100));
    return scores[percentileIndex] || 0;
  }

  /**
   * Build adjacency map for ZIP codes
   * For now, we'll use distance-based adjacency (< 10 miles)
   * In production, this would use actual ZIP code boundary data
   */
  private async buildAdjacencyMap(features: ClusteringFeature[]): Promise<void> {
    console.log(`[RegionGrowing] 🗺️  Building adjacency map for ${features.length} ZIP codes`);
    
    // Initialize map
    features.forEach(f => {
      this.adjacencyMap.set(f.zipCode, new Set());
    });
    
    // Build adjacency based on distance
    // ZIP codes within 5 miles are considered adjacent
    const adjacencyThreshold = 5; // miles
    
    for (let i = 0; i < features.length; i++) {
      for (let j = i + 1; j < features.length; j++) {
        const distance = calculateDistance(
          features[i].latitude, features[i].longitude,
          features[j].latitude, features[j].longitude
        );
        
        if (distance <= adjacencyThreshold) {
          this.adjacencyMap.get(features[i].zipCode)?.add(features[j].zipCode);
          this.adjacencyMap.get(features[j].zipCode)?.add(features[i].zipCode);
        }
      }
    }
    
    // Log adjacency statistics
    const avgNeighbors = Array.from(this.adjacencyMap.values())
      .reduce((sum, neighbors) => sum + neighbors.size, 0) / features.length;
    console.log(`[RegionGrowing] 📍 Average neighbors per ZIP: ${avgNeighbors.toFixed(1)}`);
  }

  /**
   * Grow regions from seed points
   */
  private async growRegions(eligibleFeatures: ClusteringFeature[]): Promise<ClusterResult[]> {
    let clusters: ClusterResult[] = [];
    let currentMinZipCodes = this.config.minZipCodes;
    
    // Sort features by score (descending) to use as seeds
    const seedCandidates = [...eligibleFeatures]
      .sort((a, b) => b.primaryScore - a.primaryScore);
    
    console.log(`[RegionGrowing] 🌱 Starting region growth from ${seedCandidates.length} seed candidates`);
    console.log(`[RegionGrowing] 🎯 Target: ${this.config.numClusters} clusters, min size: ${currentMinZipCodes} ZIP codes`);
    
    // Try with original minimum size first
    clusters = await this.attemptClusterCreation(seedCandidates, eligibleFeatures, currentMinZipCodes);
    
    // If we didn't get enough clusters, try with progressively smaller minimum sizes
    if (clusters.length < this.config.numClusters && currentMinZipCodes > 3) {
      console.log(`[RegionGrowing] 🔄 Only created ${clusters.length}/${this.config.numClusters} clusters. Trying with smaller minimum sizes...`);
      
      // Reset and try again with more flexible sizing
      this.assignedZipCodes.clear();
      
      // Try progressively smaller minimum cluster sizes
      const sizesToTry = [Math.max(3, Math.floor(currentMinZipCodes * 0.7)), Math.max(3, Math.floor(currentMinZipCodes * 0.5)), 3];
      
      for (const minSize of sizesToTry) {
        if (clusters.length >= this.config.numClusters) break;
        
        console.log(`[RegionGrowing] 🔄 Retrying with minimum size: ${minSize} ZIP codes`);
        this.assignedZipCodes.clear();
        clusters = await this.attemptClusterCreation(seedCandidates, eligibleFeatures, minSize);
        
        if (clusters.length >= this.config.numClusters) {
          console.log(`[RegionGrowing] ✅ Successfully created ${clusters.length} clusters with minimum size ${minSize}`);
          break;
        }
      }
    }
    
    console.log(`[RegionGrowing] 📊 Final result: ${clusters.length} clusters created (target was ${this.config.numClusters})`);
    
    // Ensure cluster IDs are consecutive starting from 0 for consistent color mapping
    clusters.forEach((cluster, index) => {
      const oldId = cluster.clusterId;
      cluster.clusterId = index;
      if (oldId !== index) {
        console.log(`[RegionGrowing] 🔄 Renumbered cluster ${oldId} → ${index} (${cluster.name})`);
      }
    });
    
    return clusters;
  }

  private async attemptClusterCreation(
    seedCandidates: ClusteringFeature[], 
    eligibleFeatures: ClusteringFeature[], 
    minZipCodes: number
  ): Promise<ClusterResult[]> {
    const clusters: ClusterResult[] = [];
    let seedAttempts = 0;
    let regionsRejected = 0;
    
    for (const seed of seedCandidates) {
      seedAttempts++;
      
      // Skip if already assigned to a cluster
      if (this.assignedZipCodes.has(seed.zipCode)) {
        continue;
      }
      
      // Check if we've reached max clusters
      if (clusters.length >= this.config.numClusters) {
        console.log(`[RegionGrowing] ✅ Reached target of ${this.config.numClusters} clusters, stopping`);
        break;
      }
      
      console.log(`[RegionGrowing] 🌱 Attempting seed ${seedAttempts}: ${seed.zipCode} (score: ${seed.primaryScore.toFixed(2)})`);
      
      // Grow region from this seed
      const clusterId = clusters.length; // This ensures consecutive cluster IDs: 0, 1, 2, 3, 4...
      const region = await this.growSingleRegion(seed, eligibleFeatures, clusterId);
      
      console.log(`[RegionGrowing] 📏 Grown region size: ${region.zipCodes.length} ZIP codes (min required: ${minZipCodes})`);
      
      // Only keep regions that meet minimum size
      if (region.zipCodes.length >= minZipCodes) {
        clusters.push(region);
        console.log(`[RegionGrowing] 🎯 Created territory ${region.name} with ${region.zipCodes.length} ZIP codes (cluster ${clusters.length}/${this.config.numClusters})`);
      } else {
        regionsRejected++;
        console.log(`[RegionGrowing] ❌ Region too small (${region.zipCodes.length} < ${minZipCodes}), rejecting`);
        
        // Release the assigned ZIP codes so they can be reassigned later
        region.zipCodes.forEach(zipCode => {
          this.assignedZipCodes.delete(zipCode);
        });
      }
    }
    
    console.log(`[RegionGrowing] 📊 Attempt stats: ${clusters.length} clusters created, ${regionsRejected} regions rejected, ${seedAttempts} seeds attempted`);
    
    return clusters;
  }

  /**
   * Grow a single region from a seed point
   */
  private async growSingleRegion(
    seed: ClusteringFeature, 
    eligibleFeatures: ClusteringFeature[],
    clusterId: number
  ): Promise<ClusterResult> {
    const regionZipCodes = new Set<string>([seed.zipCode]);
    const regionFeatures: ClusteringFeature[] = [seed];
    this.assignedZipCodes.add(seed.zipCode);
    
    // Create queue of candidates to check
    const candidateQueue = new Set<string>(this.adjacencyMap.get(seed.zipCode) || []);
    const processedCandidates = new Set<string>();
    
    // Grow region by checking adjacent ZIP codes
    while (candidateQueue.size > 0) {
      const candidates = Array.from(candidateQueue);
      candidateQueue.clear();
      
      for (const candidateZip of candidates) {
        // Skip if already processed or assigned
        if (processedCandidates.has(candidateZip)) continue;
        if (this.assignedZipCodes.has(candidateZip)) continue;
        processedCandidates.add(candidateZip);
        
        // Find candidate feature
        const candidate = eligibleFeatures.find(f => f.zipCode === candidateZip);
        if (!candidate) continue;
        
        // Check if candidate meets criteria
        if (!this.canAddToRegion(candidate, regionFeatures)) continue;
        
        // Add to region
        regionZipCodes.add(candidateZip);
        regionFeatures.push(candidate);
        this.assignedZipCodes.add(candidateZip);
        
        // Add candidate's neighbors to queue
        const neighbors = this.adjacencyMap.get(candidateZip) || new Set();
        neighbors.forEach(neighbor => {
          if (!processedCandidates.has(neighbor) && !this.assignedZipCodes.has(neighbor)) {
            candidateQueue.add(neighbor);
          }
        });
      }
    }
    
    // Build cluster result
    return this.buildClusterResult(
      regionFeatures, 
      clusterId
    );
  }

  /**
   * Check if a ZIP code can be added to the region
   */
  private canAddToRegion(candidate: ClusteringFeature, regionFeatures: ClusteringFeature[]): boolean {
    // Check score threshold
    if (candidate.primaryScore < this.scoreThreshold) return false;
    
    // Check if adding would exceed radius constraint
    const allFeatures = [...regionFeatures, candidate];
    const centroid = calculateCentroid(allFeatures);
    
    for (const feature of allFeatures) {
      const distance = calculateDistance(
        centroid[1], centroid[0], // centroid is [lng, lat]
        feature.latitude, feature.longitude
      );
      if (distance > this.config.maxRadiusMiles) return false;
    }
    
    // Check adjacency to at least one existing member
    const isAdjacent = regionFeatures.some(rf => 
      this.adjacencyMap.get(rf.zipCode)?.has(candidate.zipCode) || false
    );
    
    return isAdjacent;
  }

  /**
   * Build cluster result from features
   */
  private buildClusterResult(features: ClusteringFeature[], clusterId: number): ClusterResult {
    const zipCodes = features.map(f => f.zipCode);
    const centroid = calculateCentroid(features);
    const boundary = generateClusterBoundary(features);
    
    // Calculate radius
    let maxDistance = 0;
    features.forEach(feature => {
      const distance = calculateDistance(
        centroid[1], centroid[0],
        feature.latitude, feature.longitude
      );
      maxDistance = Math.max(maxDistance, distance);
    });
    
    // Calculate metrics
    const totalPopulation = features.reduce((sum, f) => sum + f.population, 0);
    const scores = features.map(f => f.primaryScore);
    const averageScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const scoreRange: [number, number] = [Math.min(...scores), Math.max(...scores)];
    
    // Generate name
    const name = generateClusterName(features, this.detectedMethod as ClusteringMethod, clusterId + 1);
    
    return {
      clusterId,
      name,
      zipCodes,
      centroid,
      boundary,
      radiusMiles: maxDistance,
      totalPopulation,
      averageScore,
      scoreRange,
      isValid: false, // Set during validation
      validationIssues: [],
      keyInsights: this.generateKeyInsights(features)
    };
  }

  /**
   * Validate inputs
   */
  private validateInputs(features: ClusteringFeature[]): void {
    if (features.length === 0) {
      throw new ClusteringError(
        'No features provided for clustering',
        CLUSTERING_ERROR_CODES.INSUFFICIENT_DATA
      );
    }

    const invalidFeatures = features.filter(f => 
      typeof f.latitude !== 'number' || 
      typeof f.longitude !== 'number' ||
      typeof f.primaryScore !== 'number' ||
      !f.zipCode
    );

    if (invalidFeatures.length > 0) {
      throw new ClusteringError(
        `Invalid features: ${invalidFeatures.length} features missing required fields`,
        CLUSTERING_ERROR_CODES.INVALID_PARAMETERS,
        { invalidFeatures: invalidFeatures.slice(0, 5) }
      );
    }
  }

  /**
   * Detect clustering method from features
   */
  private detectMethodFromFeatures(features: ClusteringFeature[]): string {
    if (features.length === 0) return 'analysis-geographic';
    
    const sample = features[0];
    
    if (sample.strategicScore !== undefined) return 'strategic-scores';
    if (sample.nikeShare !== undefined && sample.adidasShare !== undefined) return 'competitive-scores';
    if (sample.demographicOpportunity !== undefined && !sample.strategicScore) return 'demographic-scores';
    
    return 'analysis-geographic';
  }

  /**
   * Generate key insights
   */
  private generateKeyInsights(features: ClusteringFeature[]): string {
    const avgIncome = features.reduce((sum, f) => sum + (f.medianIncome || 0), 0) / features.length;
    const avgAge = features.reduce((sum, f) => sum + (f.medianAge || 0), 0) / features.length;
    const totalPopulation = features.reduce((sum, f) => sum + f.population, 0);
    
    const insights = [];
    if (avgIncome > 75000) insights.push("High income");
    else if (avgIncome > 50000) insights.push("Middle income");
    
    if (avgAge < 35) insights.push("Young demographics");
    else if (avgAge > 50) insights.push("Mature demographics");
    
    if (totalPopulation > 500000) insights.push("Large market");
    else if (totalPopulation > 100000) insights.push("Medium market");
    
    return insights.length > 0 ? insights.join(', ') : "Mixed demographics";
  }

  /**
   * Validate clusters
   */
  private async validateClusters(clusters: ClusterResult[]): Promise<ClusterResult[]> {
    const validatedClusters = [];
    
    console.log(`[RegionGrowing] 🔍 Validating ${clusters.length} clusters against requirements:`);
    console.log(`[RegionGrowing] 🔍 Requirements: minZipCodes=${this.config.minZipCodes}, minPopulation=${this.config.minPopulation.toLocaleString()}, maxRadius=${this.config.maxRadiusMiles}mi`);
    
    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i];
      const validation = validateCluster(cluster, this.config);
      cluster.isValid = validation.isValid;
      cluster.validationIssues = validation.issues;
      
      console.log(`[RegionGrowing] 🔍 Cluster ${i+1} (${cluster.name}):`, {
        zipCodes: cluster.zipCodes.length,
        population: cluster.totalPopulation?.toLocaleString() || 'unknown',
        radius: cluster.radiusMiles?.toFixed(1) + 'mi' || 'unknown',
        hasMinZipCodes: validation.hasMinZipCodes,
        hasMinPopulation: validation.hasMinPopulation,
        withinMaxRadius: validation.withinMaxRadius,
        isValid: validation.isValid,
        issues: validation.issues
      });
      
      // Always include clusters that meet basic requirements
      if (validation.hasMinZipCodes && validation.hasMinPopulation) {
        validatedClusters.push(cluster);
        console.log(`[RegionGrowing] ✅ Cluster ${i+1} ACCEPTED`);
      } else {
        console.log(`[RegionGrowing] ❌ Cluster ${i+1} REJECTED: ${validation.issues.join(', ')}`);
      }
    }
    
    console.log(`[RegionGrowing] 📊 Validation summary: ${validatedClusters.length}/${clusters.length} clusters accepted`);
    
    return validatedClusters;
  }

  /**
   * Get unclustered ZIP codes
   */
  private getUnclusteredZipCodes(allFeatures: ClusteringFeature[], validClusters: ClusterResult[]): string[] {
    const clusteredZipCodes = new Set(validClusters.flatMap(c => c.zipCodes));
    return allFeatures
      .filter(f => !clusteredZipCodes.has(f.zipCode))
      .map(f => f.zipCode);
  }
}