/**
 * Geographic K-means Clustering Algorithm
 * 
 * Clusters zip codes based on analysis scores (80%) and geographic proximity (20%)
 * with hard distance constraints to ensure territories are geographically coherent.
 */

import { ClusteringFeature, ClusterConfig, ClusterResult, ClusteringResult, ClusteringError, CLUSTERING_ERROR_CODES, ClusteringMethod } from '../types';
import { calculateDistance, calculateCentroid, generateClusterBoundary } from '../utils/geographic-utils';
import { validateCluster } from '../utils/cluster-validation';
import { generateClusterName } from '../utils/cluster-naming';

export class GeographicKMeans {
  private config: ClusterConfig;
  private features: ClusteringFeature[];
  private normalizedFeatures: ClusteringFeature[];
  private detectedMethod: string = 'analysis-geographic';
  
  constructor(config: ClusterConfig) {
    this.config = config;
    this.features = [];
    this.normalizedFeatures = [];
  }

  /**
   * Detect clustering method from feature characteristics
   */
  private detectMethodFromFeatures(features: ClusteringFeature[]): string {
    if (features.length === 0) return 'analysis-geographic';
    
    const sample = features[0];
    
    // Check for specific feature combinations to determine method
    if (sample.strategicScore !== undefined) return 'strategic-scores';
    if (sample.nikeShare !== undefined && sample.adidasShare !== undefined) return 'competitive-scores';
    if (sample.demographicOpportunity !== undefined && !sample.strategicScore) return 'demographic-scores';
    
    // Default to combined analysis + geographic
    return 'analysis-geographic';
  }

  /**
   * Main clustering method
   */
  public async cluster(features: ClusteringFeature[]): Promise<ClusteringResult> {
    const startTime = Date.now();
    
    try {
      // Validate inputs
      this.validateInputs(features);
      
      // Store and normalize features
      this.features = features;
      this.detectedMethod = this.detectMethodFromFeatures(features);
      this.normalizedFeatures = this.normalizeFeatures(features);
      
      // Run k-means with geographic constraints
      const clusters = await this.runKMeansWithConstraints();
      
      // Validate and filter clusters
      const validatedClusters = await this.validateClusters(clusters);
      
      // Generate final result
      const result: ClusteringResult = {
        success: validatedClusters.length > 0,
        clusters: validatedClusters,
        totalZipCodes: features.length,
        clusteredZipCodes: validatedClusters.reduce((sum, c) => sum + c.zipCodes.length, 0),
        unclustered: this.getUnclusteredZipCodes(features, validatedClusters),
        validClusters: validatedClusters.filter(c => c.isValid).length,
        invalidClusters: validatedClusters.filter(c => !c.isValid).length,
        algorithm: 'geographic-kmeans',
        processingTimeMs: Date.now() - startTime,
        parameters: this.config
      };
      
      return result;
      
    } catch (error) {
      throw new ClusteringError(
        `Clustering failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        CLUSTERING_ERROR_CODES.FEATURE_EXTRACTION_FAILED,
        { originalError: error, config: this.config }
      );
    }
  }

  /**
   * Validate input features
   */
  private validateInputs(features: ClusteringFeature[]): void {
    if (features.length === 0) {
      throw new ClusteringError(
        'No features provided for clustering',
        CLUSTERING_ERROR_CODES.INSUFFICIENT_DATA
      );
    }

    if (features.length < this.config.numClusters) {
      throw new ClusteringError(
        `Insufficient data: ${features.length} zip codes cannot create ${this.config.numClusters} clusters`,
        CLUSTERING_ERROR_CODES.INSUFFICIENT_DATA
      );
    }

    // Validate required fields
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
        { invalidFeatures: invalidFeatures.slice(0, 5) } // Show first 5 for debugging
      );
    }
  }

  /**
   * Normalize features for consistent clustering
   */
  private normalizeFeatures(features: ClusteringFeature[]): ClusteringFeature[] {
    // Calculate min/max for normalization
    const primaryScores = features.map(f => f.primaryScore);
    const secondaryScores = features.map(f => f.secondaryScore || 0);
    const populations = features.map(f => f.population);
    const latitudes = features.map(f => f.latitude);
    const longitudes = features.map(f => f.longitude);
    
    const primaryRange: [number, number] = [Math.min(...primaryScores), Math.max(...primaryScores)];
    const secondaryRange: [number, number] = [Math.min(...secondaryScores), Math.max(...secondaryScores)];
    const populationRange: [number, number] = [Math.min(...populations), Math.max(...populations)];
    const latitudeRange: [number, number] = [Math.min(...latitudes), Math.max(...latitudes)];
    const longitudeRange: [number, number] = [Math.min(...longitudes), Math.max(...longitudes)];
    
    console.log(`[GeographicKMeans] 📍 Coordinate ranges:`, {
      latRange: latitudeRange,
      lonRange: longitudeRange,
      scoreRange: primaryRange
    });
    
    return features.map(feature => ({
      ...feature,
      primaryScore: this.normalizeValue(feature.primaryScore, primaryRange),
      secondaryScore: feature.secondaryScore ? this.normalizeValue(feature.secondaryScore, secondaryRange) : 0,
      population: this.normalizeValue(feature.population, populationRange),
      latitude: this.normalizeValue(feature.latitude, latitudeRange),
      longitude: this.normalizeValue(feature.longitude, longitudeRange)
    }));
  }

  /**
   * Normalize value to 0-1 range
   */
  private normalizeValue(value: number, range: [number, number]): number {
    const [min, max] = range;
    if (max === min) return 0.5; // Avoid division by zero
    return (value - min) / (max - min);
  }

  /**
   * Run K-means with geographic constraints
   */
  private async runKMeansWithConstraints(): Promise<ClusterResult[]> {
    const maxIterations = 100;
    const convergenceThreshold = 0.001;
    
    // Initialize centroids using k-means++ for better starting positions
    let centroids = this.initializeCentroidsKMeansPlusPlus();
    
    let iterations = 0;
    let converged = false;
    
    while (!converged && iterations < maxIterations) {
      // Assign features to closest centroids with distance constraints
      const assignments = this.assignFeaturesWithConstraints(centroids);
      
      // Calculate new centroids
      const newCentroids = this.calculateNewCentroids(assignments);
      
      // Check for convergence
      converged = this.checkConvergence(centroids, newCentroids, convergenceThreshold);
      
      centroids = newCentroids;
      iterations++;
    }
    
    // Create final cluster assignments
    const finalAssignments = this.assignFeaturesWithConstraints(centroids);
    
    // Build cluster results
    return this.buildClusterResults(finalAssignments, centroids);
  }

  /**
   * Initialize centroids using k-means++ algorithm
   */
  private initializeCentroidsKMeansPlusPlus(): number[][] {
    const centroids: number[][] = [];
    const features = this.normalizedFeatures;
    
    // Choose first centroid randomly
    const firstIndex = Math.floor(Math.random() * features.length);
    centroids.push(this.featureToVector(features[firstIndex]));
    
    // Choose remaining centroids based on distance from existing ones
    for (let i = 1; i < this.config.numClusters; i++) {
      const distances = features.map(feature => {
        const vector = this.featureToVector(feature);
        return Math.min(...centroids.map(centroid => this.calculateVectorDistance(vector, centroid)));
      });
      
      // Choose next centroid with probability proportional to squared distance
      const totalDistance = distances.reduce((sum, d) => sum + d * d, 0);
      let random = Math.random() * totalDistance;
      
      for (let j = 0; j < features.length; j++) {
        random -= distances[j] * distances[j];
        if (random <= 0) {
          centroids.push(this.featureToVector(features[j]));
          break;
        }
      }
    }
    
    return centroids;
  }

  /**
   * Convert feature to vector for clustering
   */
  private featureToVector(feature: ClusteringFeature): number[] {
    const analysisWeight = 0.8;
    const geographicWeight = 0.2;
    
    switch (this.detectedMethod) {
      case 'strategic-scores':
        return [
          feature.primaryScore,
          feature.secondaryScore || 0,
          feature.population * 0.1 // Small population influence
        ];
        
      case 'competitive-scores':
        return [
          feature.primaryScore,
          feature.nikeShare || 0,
          feature.adidasShare || 0,
          feature.marketGap || 0
        ];
        
      case 'demographic-scores':
        return [
          feature.primaryScore,
          feature.medianIncome || 0,
          feature.medianAge || 0,
          feature.population * 0.1
        ];
        
      case 'analysis-geographic':
      default:
        return [
          feature.primaryScore * analysisWeight,
          (feature.secondaryScore || 0) * analysisWeight,
          feature.latitude * geographicWeight,
          feature.longitude * geographicWeight,
          feature.population * 0.1
        ];
    }
  }

  /**
   * Assign features to centroids with geographic constraints
   */
  private assignFeaturesWithConstraints(centroids: number[][]): number[][] {
    const assignments: number[][] = centroids.map(() => []);
    
    this.normalizedFeatures.forEach((feature, featureIndex) => {
      const featureVector = this.featureToVector(feature);
      let bestCluster = -1;
      let bestDistance = Infinity;
      
      // Find closest centroid
      centroids.forEach((centroid, clusterIndex) => {
        const distance = this.calculateVectorDistance(featureVector, centroid);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestCluster = clusterIndex;
        }
      });
      
      // Check geographic constraint before assigning
      if (bestCluster >= 0 && this.satisfiesGeographicConstraint(featureIndex, assignments[bestCluster])) {
        assignments[bestCluster].push(featureIndex);
      } else {
        // Try to find alternative cluster that satisfies constraint
        let assignedToAlternative = false;
        for (let i = 0; i < centroids.length; i++) {
          if (i !== bestCluster && this.satisfiesGeographicConstraint(featureIndex, assignments[i])) {
            assignments[i].push(featureIndex);
            assignedToAlternative = true;
            break;
          }
        }
        
        // If no cluster satisfies constraint, assign to best cluster anyway
        // (will be filtered out in validation if it violates radius constraint)
        if (!assignedToAlternative && bestCluster >= 0) {
          assignments[bestCluster].push(featureIndex);
        }
      }
    });
    
    return assignments;
  }

  /**
   * Check if adding a feature to a cluster satisfies geographic constraints
   * NOTE: Uses original (non-normalized) coordinates for actual distance calculations
   */
  private satisfiesGeographicConstraint(featureIndex: number, clusterAssignment: number[]): boolean {
    if (clusterAssignment.length === 0) return true; // Empty cluster is always valid
    
    const newFeature = this.features[featureIndex]; // Use original features with real coordinates
    
    // Check distance to all other features in cluster
    for (const assignedIndex of clusterAssignment) {
      const assignedFeature = this.features[assignedIndex]; // Use original features with real coordinates
      const distance = calculateDistance(
        newFeature.latitude, newFeature.longitude,
        assignedFeature.latitude, assignedFeature.longitude
      );
      
      if (distance > this.config.maxRadiusMiles * 2) { // Diameter constraint
        return false;
      }
    }
    
    return true;
  }

  /**
   * Calculate new centroids from assignments
   */
  private calculateNewCentroids(assignments: number[][]): number[][] {
    return assignments.map(assignment => {
      if (assignment.length === 0) {
        // Keep previous centroid if no assignments
        return this.featureToVector(this.normalizedFeatures[Math.floor(Math.random() * this.normalizedFeatures.length)]);
      }
      
      const vectors = assignment.map(index => this.featureToVector(this.normalizedFeatures[index]));
      const vectorLength = vectors[0].length;
      const newCentroid = new Array(vectorLength).fill(0);
      
      // Calculate mean
      vectors.forEach(vector => {
        vector.forEach((value, i) => {
          newCentroid[i] += value;
        });
      });
      
      return newCentroid.map(sum => sum / vectors.length);
    });
  }

  /**
   * Check for convergence
   */
  private checkConvergence(oldCentroids: number[][], newCentroids: number[][], threshold: number): boolean {
    for (let i = 0; i < oldCentroids.length; i++) {
      const distance = this.calculateVectorDistance(oldCentroids[i], newCentroids[i]);
      if (distance > threshold) {
        return false;
      }
    }
    return true;
  }

  /**
   * Calculate distance between two vectors
   */
  private calculateVectorDistance(vector1: number[], vector2: number[]): number {
    let sum = 0;
    for (let i = 0; i < vector1.length; i++) {
      const diff = vector1[i] - vector2[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  /**
   * Build final cluster results
   */
  private async buildClusterResults(assignments: number[][], centroids: number[][]): Promise<ClusterResult[]> {
    const results: ClusterResult[] = [];
    
    for (let i = 0; i < assignments.length; i++) {
      const assignment = assignments[i];
      if (assignment.length === 0) continue;
      
      const clusterFeatures = assignment.map(index => this.features[index]); // Original features for geographic calculations
      const zipCodes = clusterFeatures.map(f => f.zipCode);
      
      // Calculate geographic properties using original (non-normalized) coordinates
      const centroid = calculateCentroid(clusterFeatures);
      const boundary = generateClusterBoundary(clusterFeatures);
      const radiusMiles = this.calculateClusterRadius(clusterFeatures);
      
      // Calculate aggregated metrics
      const totalPopulation = clusterFeatures.reduce((sum, f) => sum + f.population, 0);
      const averageScore = clusterFeatures.reduce((sum, f) => sum + f.primaryScore, 0) / clusterFeatures.length;
      const scores = clusterFeatures.map(f => f.primaryScore);
      const scoreRange: [number, number] = [Math.min(...scores), Math.max(...scores)];
      
      // Generate cluster name
      const name = generateClusterName(clusterFeatures, this.detectedMethod as ClusteringMethod, i + 1);
      
      const cluster: ClusterResult = {
        clusterId: i,
        name,
        zipCodes,
        centroid,
        boundary,
        radiusMiles,
        totalPopulation,
        averageScore,
        scoreRange,
        isValid: false, // Will be set in validation
        validationIssues: [],
        keyInsights: this.generateKeyInsights(clusterFeatures)
      };
      
      results.push(cluster);
    }
    
    return results;
  }

  /**
   * Calculate cluster radius (max distance from centroid)
   * NOTE: Uses original (non-normalized) coordinates for actual distance calculations
   */
  private calculateClusterRadius(features: ClusteringFeature[]): number {
    if (features.length === 0) return 0;
    
    // Use original features for geographic calculations
    const originalFeatures = features.map(f => this.features.find(orig => orig.zipCode === f.zipCode)!);
    const centroid = calculateCentroid(originalFeatures);
    let maxDistance = 0;
    
    originalFeatures.forEach(feature => {
      const distance = calculateDistance(
        centroid[1], centroid[0], // centroid is [lng, lat], need [lat, lng]
        feature.latitude, feature.longitude
      );
      maxDistance = Math.max(maxDistance, distance);
    });
    
    return maxDistance;
  }

  /**
   * Generate key insights for cluster
   */
  private generateKeyInsights(features: ClusteringFeature[]): string {
    const avgIncome = features.reduce((sum, f) => sum + (f.medianIncome || 0), 0) / features.length;
    const avgAge = features.reduce((sum, f) => sum + (f.medianAge || 0), 0) / features.length;
    const totalPopulation = features.reduce((sum, f) => sum + f.population, 0);
    
    const insights = [];
    if (avgIncome > 50000) insights.push("High income");
    if (avgAge < 35) insights.push("Young demographics");
    if (totalPopulation > 100000) insights.push("Large population");
    
    return insights.length > 0 ? insights.join(', ') : "Mixed demographics";
  }

  /**
   * Validate clusters and mark valid/invalid
   */
  private async validateClusters(clusters: ClusterResult[]): Promise<ClusterResult[]> {
    const validatedClusters = [];
    
    for (const cluster of clusters) {
      const validation = validateCluster(cluster, this.config);
      cluster.isValid = validation.isValid;
      cluster.validationIssues = validation.issues;
      
      // Only include clusters that meet minimum requirements
      if (validation.hasMinZipCodes && validation.hasMinPopulation) {
        validatedClusters.push(cluster);
      }
    }
    
    return validatedClusters;
  }

  /**
   * Get zip codes that weren't assigned to any valid cluster
   */
  private getUnclusteredZipCodes(allFeatures: ClusteringFeature[], validClusters: ClusterResult[]): string[] {
    const clusteredZipCodes = new Set(validClusters.flatMap(c => c.zipCodes));
    return allFeatures.filter(f => !clusteredZipCodes.has(f.zipCode)).map(f => f.zipCode);
  }
}