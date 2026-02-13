/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Clustering Service
 * 
 * Integrates clustering functionality with the existing AnalysisEngine pipeline.
 * Provides analysis-driven territory clustering for campaign planning.
 */

import { 
  ClusterConfig, 
  ClusteringResult, 
  ClusteringError, 
  CLUSTERING_ERROR_CODES,
  DEFAULT_CLUSTER_CONFIG 
} from './types';
import { RegionGrowingAlgorithm } from './algorithms/region-growing';
import { extractClusteringFeatures, AnalysisData } from './utils/feature-extraction';
// import { validateClusters } from './utils/cluster-validation';
import { ProcessedAnalysisData, AnalysisResult } from '../analysis/types';
import { resolveAreaName, getZip, resolveRegionName } from '../shared/AreaName';

/**
 * Main clustering service that connects to AnalysisEngine
 */
export class ClusteringService {
  private static instance: ClusteringService | null = null;
  private currentConfig: ClusterConfig = DEFAULT_CLUSTER_CONFIG;
  
  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): ClusteringService {
    if (!ClusteringService.instance) {
      ClusteringService.instance = new ClusteringService();
    }
    return ClusteringService.instance;
  }

  /**
   * Set clustering configuration
   */
  public setConfig(config: Partial<ClusterConfig>): void {
    console.log('🎯 [ClusteringService] Setting config:', config);
    console.log('🎯 [ClusteringService] Before merge:', this.currentConfig);
    this.currentConfig = { ...this.currentConfig, ...config };
    console.log('🎯 [ClusteringService] After merge:', this.currentConfig);
    console.log('🎯 [ClusteringService] Is enabled after config:', this.isEnabled());
  }

  /**
   * Get current configuration
   */
  public getConfig(): ClusterConfig {
    return { ...this.currentConfig };
  }

  /**
   * Check if clustering is enabled
   */
  public isEnabled(): boolean {
    return this.currentConfig.enabled;
  }

  /**
   * Apply clustering to analysis results
   */
  public async applyClusteringToAnalysis(
    analysisResult: AnalysisResult,
    config?: Partial<ClusterConfig>
  ): Promise<AnalysisResult> {
    
    // Use passed config if provided, otherwise use current config
    const clusterConfig = config ? { ...this.currentConfig, ...config } : this.currentConfig;
  console.log('[ClusteringService] 🔍 Using config:', clusterConfig);
    
    // Skip clustering if disabled
    if (!clusterConfig.enabled) {
      console.log('[ClusteringService] ⏭️ Clustering is DISABLED, returning original analysis result');
      return analysisResult;
    }

    try {
      console.log('[ClusteringService] 🎯 Applying clustering to analysis result');
      console.log('[ClusteringService] 📊 Config:', clusterConfig);
      console.log('[ClusteringService] 📊 Features count:', analysisResult.data.records?.length);
      
      // Convert AnalysisResult to clustering format
      const analysisData = this.convertAnalysisToClusteringData(analysisResult.data);
      
      // Extract features for clustering (method auto-detected from endpoint)
      const endpoint = analysisResult.endpoint;
      const features = extractClusteringFeatures(analysisData, endpoint);
      
      if (features.length === 0) {
        console.warn('[ClusteringService] No valid features for clustering, returning original result');
        return analysisResult;
      }
      
      // Execute clustering
      const clusteringResult = await this.executeClusteringAlgorithm(features, clusterConfig);
      
      if (!clusteringResult.success || clusteringResult.clusters.length === 0) {
        console.warn('[ClusteringService] Clustering failed or produced no valid clusters');
        return analysisResult;
      }
      
      // Enhance analysis result with clustering data
      const enhancedResult = this.enhanceAnalysisWithClusters(analysisResult, clusteringResult);
      
      console.log('[ClusteringService] Successfully applied clustering:', {
        originalZipCodes: analysisResult.data.records?.length || 0,
        clustersCreated: clusteringResult.clusters.length,
        clusteredZipCodes: clusteringResult.clusteredZipCodes,
        unclusteredZipCodes: clusteringResult.unclustered.length
      });
      
      return enhancedResult;
      
    } catch (error) {
      console.error('[ClusteringService] Error applying clustering:', error);
      
      // Return original result on error to prevent breaking the analysis
      return analysisResult;
    }
  }

  /**
   * Preview clustering without modifying analysis result
   */
  public async previewClustering(
    analysisData: ProcessedAnalysisData,
    config?: Partial<ClusterConfig>,
    endpoint?: string
  ): Promise<ClusteringResult> {
    
    const clusterConfig = config ? { ...this.currentConfig, ...config } : this.currentConfig;
    
    if (!clusterConfig.enabled) {
      throw new ClusteringError(
        'Clustering is disabled',
        CLUSTERING_ERROR_CODES.INVALID_PARAMETERS
      );
    }

    try {
      // Convert to clustering format
      const clusteringData = this.convertAnalysisToClusteringData(analysisData);
      
      // Extract features (method auto-detected from endpoint)
      const features = extractClusteringFeatures(clusteringData, endpoint);
      
      if (features.length === 0) {
        throw new ClusteringError(
          'No valid features found for clustering',
          CLUSTERING_ERROR_CODES.INSUFFICIENT_DATA
        );
      }
      
      // Execute clustering
      return await this.executeClusteringAlgorithm(features, clusterConfig);
      
    } catch (error) {
      if (error instanceof ClusteringError) {
        throw error;
      }
      
      throw new ClusteringError(
        `Clustering preview failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        CLUSTERING_ERROR_CODES.FEATURE_EXTRACTION_FAILED,
        { originalError: error }
      );
    }
  }

  /**
   * Get dataset information for configuration validation
   */
  public getDatasetInfo(analysisData: ProcessedAnalysisData): {
    totalZipCodes: number;
    totalPopulation: number;
    geographicSpread: { minDistance: number; maxDistance: number };
  } {
    const records = analysisData.records || [];
    
    if (records.length === 0) {
      return {
        totalZipCodes: 0,
        totalPopulation: 0,
        geographicSpread: { minDistance: 0, maxDistance: 0 }
      };
    }

    // Calculate total population
    const totalPopulation = records.reduce((sum, record) => {
      const population = this.extractPopulation(record.properties || {});
      return sum + population;
    }, 0);

    // Calculate geographic spread (simplified - would need actual lat/lng for real calculation)
    const geographicSpread = {
      minDistance: 0, // Would calculate minimum distance between zip codes
      maxDistance: 100 // Would calculate maximum distance between zip codes
    };

    return {
      totalZipCodes: records.length,
      totalPopulation,
      geographicSpread
    };
  }

  /**
   * Convert ProcessedAnalysisData to clustering AnalysisData format
   */
  /**
   * Ensure ZIP code has leading zero if it's 4 digits
   */
  private normalizeZipCode(zipCode: string): string {
    // Extract just the numeric part if there's additional text
    const match = zipCode.match(/\d{4,5}/);
    if (!match) return zipCode;
    
    const numericZip = match[0];
    // If it's 4 digits, add leading zero
    if (numericZip.length === 4) {
      return `0${numericZip}`;
    }
    return numericZip;
  }

  private convertAnalysisToClusteringData(data: ProcessedAnalysisData): AnalysisData {
    console.log(`[ClusteringService] 📍 Converting ${data.records?.length || 0} records for clustering`);
    
    const features = (data.records || []).map((record, index) => {
      // Prefer shared resolver for robust ZIP/FSA extraction, with fallbacks
      let resolvedZip = getZip({ ...(record.properties as any), area_name: record.area_name });
      if (!resolvedZip && record.area_name) {
        const match = record.area_name.match(/^\d{4,5}/);
        resolvedZip = match ? match[0] : record.area_name;
      }
      if (!resolvedZip) {
        resolvedZip = record.area_name || `unknown_${index}`;
      }

      // Normalize and ensure string
      const zipCode = this.normalizeZipCode(String(resolvedZip));
      const centroid = this.extractCentroid(record);
      
      // Debug first few records
      if (index < 5) {
        const dbgGeom = (record as any)?.geometry as any;
        console.log(`[ClusteringService] 📍 Record ${index + 1} (${zipCode}):`, {
          area_name: record.area_name,
          zipCode,
          extractedCentroid: centroid,
          hasGeometry: !!dbgGeom,
          geometryType: dbgGeom?.type,
          originalCoordinates: dbgGeom?.coordinates
        });
      }
      
  // Narrow geometry from unknown with a local cast for safe optional access
  const recGeom = (record as any)?.geometry as any;
  return {
        properties: {
          // Include all original properties
          ...record.properties,
          
          // Add standardized fields for clustering
          geo_id: zipCode,
          zip_code: zipCode,
          
          // Add analysis-specific scores
          strategic_value_score: record.value || record.properties?.strategic_value_score || 0,
          demographic_opportunity_score: record.properties?.demographic_opportunity_score || record.value || 0,
          competitive_advantage_score: record.properties?.competitive_advantage_score || record.value || 0,
          
          // Nike/Adidas market shares for competitive analysis
          nike_market_share: record.properties?.nike_market_share || record.properties?.mp30034a_b_p || record.properties?.value_mp30034a_b_p || 0,
          adidas_market_share: record.properties?.adidas_market_share || record.properties?.mp30029a_b_p || record.properties?.value_mp30029a_b_p || 0,
          
          // Demographics
          total_population: record.properties?.total_population || record.properties?.totpop_cy || record.properties?.value_totpop_cy || 1000,
          median_income: record.properties?.median_income || record.properties?.avghinc_cy || record.properties?.value_avghinc_cy || 50000,
          median_age: record.properties?.median_age || record.properties?.medage_cy || record.properties?.value_medage_cy || 35
        },
        geometry: {
          // Try to extract coordinates from various possible locations
          centroid: centroid,
          coordinates: Array.isArray(recGeom?.coordinates) ? recGeom.coordinates : recGeom?.centroid
        }
      };
    });

    console.log(`[ClusteringService] 📍 Converted features summary:`, {
      totalFeatures: features.length,
      sampleCentroids: features.slice(0, 3).map(f => f.geometry.centroid),
      uniqueCentroids: new Set(features.map(f => JSON.stringify(f.geometry.centroid))).size
    });

    return {
      type: data.type || 'analysis',
      features
    };
  }

  /**
   * Extract centroid coordinates from record for clustering analysis
   * For visualization clustering, we don't need precise coordinates - just reasonable approximations
   */
  private extractCentroid(record: any): [number, number] | undefined {
    // Try to extract from various possible coordinate fields
    // Priority: explicit lat/lng fields > geometry data > area-based approximation
    
    // Check direct coordinate properties
    if (record.properties?.latitude && record.properties?.longitude) {
      return [Number(record.properties.longitude), Number(record.properties.latitude)];
    }
    
    if (record.properties?.lat && record.properties?.lng) {
      return [Number(record.properties.lng), Number(record.properties.lat)];
    }
    
    // Try geometry fields - need to handle different geometry types properly
    if (record.geometry?.centroid && Array.isArray(record.geometry.centroid)) {
      return [record.geometry.centroid[0], record.geometry.centroid[1]];
    }
    
    // Handle different geometry types properly
    if (record.geometry?.coordinates && Array.isArray(record.geometry.coordinates)) {
      const coords = record.geometry.coordinates;
      const geomType = record.geometry.type?.toLowerCase();
      
      if (geomType === 'point') {
        // Point: coordinates = [lng, lat]
        return [coords[0], coords[1]];
      } else if (geomType === 'polygon' && coords[0] && Array.isArray(coords[0])) {
        // Polygon: coordinates = [[[lng, lat], [lng, lat], ...]]
        // Calculate centroid from the outer ring (coords[0])
        return this.calculatePolygonCentroid(coords[0]);
      } else if (geomType === 'multipolygon' && coords[0] && coords[0][0] && Array.isArray(coords[0][0])) {
        // MultiPolygon: coordinates = [[[[lng, lat], [lng, lat], ...]], ...]
        // Use the first polygon's outer ring
        return this.calculatePolygonCentroid(coords[0][0]);
      }
    }
    
    // FALLBACK: Use area-based coordinate approximation for clustering purposes only
    // This doesn't affect the actual visualization geometry - just used for similarity grouping
    const areaName = record.area_name || record.area_id || '';
    const approximateCoords = this.getApproximateCoordinatesForArea(areaName);
    
    if (approximateCoords) {
      console.log(`[ClusteringService] 📍 Using area-based approximation for ${areaName}`);
      return approximateCoords;
    }
    
    // Last resort: use default US center (this won't group well but won't break clustering)
    console.warn(`[ClusteringService] ⚠️ Using default coordinates for ${areaName} - clustering may be less effective`);
    return [-98.5795, 39.8283]; // [lng, lat]
  }

  /**
   * Get approximate coordinates for area names and ZIP codes (for clustering purposes only)
   * This enables clustering when precise coordinates aren't available in cached analysis data
   */
  private getApproximateCoordinatesForArea(areaName: string): [number, number] | null {
    const area = areaName.toLowerCase();
    
    // Extract ZIP code if present (5-digit number)
    const zipMatch = areaName.match(/\b(\d{5})\b/);
    const zipCode = zipMatch ? zipMatch[1] : null;
    
    // NYC ZIP code ranges with approximate coordinates
    if (zipCode) {
      const zip = parseInt(zipCode);
      
      // Manhattan (100xx)
      if (zip >= 10001 && zip <= 10282) return [-73.97, 40.76];
      
      // Brooklyn (112xx)  
      if (zip >= 11201 && zip <= 11256) return [-73.95, 40.65];
      
      // Queens (113xx-116xx)
      if (zip >= 11301 && zip <= 11697) return [-73.80, 40.72];
      
      // Staten Island (103xx)
      if (zip >= 10301 && zip <= 10314) return [-74.15, 40.58];
      
      // Bronx (104xx)
      if (zip >= 10451 && zip <= 10475) return [-73.86, 40.85];
      
      // Long Island (117xx-119xx)
      if (zip >= 11701 && zip <= 11980) return [-73.00, 40.70];
      
      // Westchester County (105xx-108xx)
      if (zip >= 10501 && zip <= 10803) return [-73.76, 41.03];
      
      // New Jersey (070xx-089xx)
      if (zip >= 7001 && zip <= 8999) return [-74.40, 40.70];
      
      // Connecticut (068xx)
      if (zip >= 6801 && zip <= 6901) return [-73.20, 41.60];
      
      // Pennsylvania (170xx-196xx)
      if (zip >= 17001 && zip <= 19640) return [-75.50, 40.00];
    }
    
    // City/area name matching (fallback)
    if (area.includes('brooklyn')) return [-73.95, 40.65];
    if (area.includes('manhattan') || area.includes('new york')) return [-73.97, 40.78];
    if (area.includes('queens')) return [-73.80, 40.72];
    if (area.includes('bronx')) return [-73.86, 40.85];
    if (area.includes('staten island')) return [-74.15, 40.58];
    if (area.includes('long island')) return [-73.00, 40.70];
    if (area.includes('yonkers')) return [-73.87, 40.93];
    if (area.includes('jersey city') || area.includes('hoboken')) return [-74.04, 40.73];
    if (area.includes('newark')) return [-74.17, 40.74];
    if (area.includes('philadelphia')) return [-75.16, 39.95];
    if (area.includes('lancaster')) return [-76.31, 40.04];
    if (area.includes('ithaca')) return [-76.50, 42.44];
    
    // Major cities outside region
    if (area.includes('chicago')) return [-87.63, 41.88];
    if (area.includes('los angeles')) return [-118.24, 34.05];
    if (area.includes('houston')) return [-95.37, 29.76];
    if (area.includes('phoenix')) return [-112.07, 33.45];
    if (area.includes('dallas')) return [-96.80, 32.78];
    if (area.includes('san antonio')) return [-98.49, 29.42];
    if (area.includes('san diego')) return [-117.16, 32.72];
    if (area.includes('san jose')) return [-121.89, 37.34];
    if (area.includes('austin')) return [-97.74, 30.27];
    
    return null;
  }

  /**
   * Calculate centroid of a polygon from its coordinate ring
   * Uses the mathematical centroid formula for polygons
   */
  private calculatePolygonCentroid(ring: number[][]): [number, number] {
    if (!ring || ring.length === 0) {
      return [-98.5795, 39.8283]; // Default center of US
    }
    
    // Simple centroid calculation - average of all points
    let sumLng = 0;
    let sumLat = 0;
    let validPoints = 0;
    
    for (const point of ring) {
      if (Array.isArray(point) && point.length >= 2) {
        const lng = Number(point[0]);
        const lat = Number(point[1]);
        if (!isNaN(lng) && !isNaN(lat)) {
          sumLng += lng;
          sumLat += lat;
          validPoints++;
        }
      }
    }
    
    if (validPoints === 0) {
      return [-98.5795, 39.8283]; // Default center of US
    }
    
    return [sumLng / validPoints, sumLat / validPoints];
  }

  /**
   * Extract population from properties with fallbacks
   */
  private extractPopulation(properties: Record<string, any>): number {
    const populationFields = [
      'total_population',
      'population',
      'totpop_cy',
      'value_totpop_cy',
      'TOTPOP_CY'
    ];
    
    for (const field of populationFields) {
      const value = Number(properties[field]);
      if (!isNaN(value) && value > 0) {
        return value;
      }
    }
    
    return 1000; // Default population
  }

  /**
   * Execute the clustering algorithm
   */
  private async executeClusteringAlgorithm(
    features: any[],
    config: ClusterConfig
  ): Promise<ClusteringResult> {
    
    const algorithm = new RegionGrowingAlgorithm(config);
    
    try {
      const result = await algorithm.cluster(features);
      return result;
      
    } catch (error) {
      if (error instanceof ClusteringError) {
        throw error;
      }
      
      throw new ClusteringError(
        `Clustering algorithm failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        CLUSTERING_ERROR_CODES.FEATURE_EXTRACTION_FAILED,
        { originalError: error, config }
      );
    }
  }

  /**
   * Enhance analysis result with clustering data
   */
  private enhanceAnalysisWithClusters(
    originalResult: AnalysisResult,
    clusteringResult: ClusteringResult
  ): AnalysisResult {
    
    // Add clustering metadata to the analysis result
    const enhancedMetadata = {
      ...originalResult.metadata,
      clustering: {
        enabled: true,
        algorithm: clusteringResult.algorithm,
        totalClusters: clusteringResult.clusters.length,
        validClusters: clusteringResult.validClusters,
        clusteredZipCodes: clusteringResult.clusteredZipCodes,
        unclustered: clusteringResult.unclustered.length,
        processingTime: clusteringResult.processingTimeMs,
        parameters: clusteringResult.parameters
      }
    };

    // Keep individual ZIP code records but add cluster assignments for coloring
    const clusteredZipRecords: any[] = [];
    
    // Create a map of ZIP codes to cluster assignments
    const zipToClusterMap = new Map();
    clusteringResult.clusters.forEach(cluster => {
      cluster.zipCodes.forEach(zipCode => {
        zipToClusterMap.set(zipCode, {
          clusterId: cluster.clusterId,
          clusterName: cluster.name,
          clusterCentroid: cluster.centroid
        });
      });
    });
    
    console.log(`[ClusteringService] 🎯 Creating clustered ZIP records - preserving original ZIP geometries`);
    console.log(`[ClusteringService] 🎯 Cluster assignments:`, {
      totalClusters: clusteringResult.clusters.length,
      clusterSizes: clusteringResult.clusters.map(c => ({ id: c.clusterId, name: c.name, zipCount: c.zipCodes.length })),
      totalMappedZips: zipToClusterMap.size
    });
    
    // Transform each original ZIP code record to include cluster assignment
    (originalResult.data.records || []).forEach(record => {
      // Extract ZIP code more reliably - prefer zip_code over geo_id (geo_id often lacks leading zeros)
      let zipCode = record.properties?.zip_code || record.properties?.geo_id;
      
      // If no direct ZIP code field, extract from area_name (e.g., "11234 (Brooklyn)" -> "11234")
      if (!zipCode && record.area_name) {
        const match = record.area_name.match(/^\d{4,5}/);
        zipCode = match ? match[0] : record.area_name;
      }
      
      // Fallback to area_name if still no match
      if (!zipCode) {
        zipCode = record.area_name;
      }
      
      // ALWAYS normalize the ZIP code to ensure leading zeros
  zipCode = this.normalizeZipCode(String(zipCode));
      
      // Debug log to verify this code is running
      if (record.area_name?.includes('070') || record.area_name?.includes('080')) {
        console.log(`[ClusteringService] 🔍 NORMALIZED ZIP: ${zipCode} from area_name: ${record.area_name}`);
      }
      
      const clusterAssignment = zipToClusterMap.get(zipCode);
      
      if (clusterAssignment) {
        // Keep the original ZIP code record but add cluster information
        const clusteredRecord = {
          ...record, // Preserve original ZIP code geometry and properties
          // CRITICAL: Add cluster_id as direct property for ArcGIS renderer
          cluster_id: clusterAssignment.clusterId,
          cluster_name: clusterAssignment.clusterName,
          properties: {
            ...record.properties,
            // Also keep in properties for backward compatibility
            cluster_id: clusterAssignment.clusterId,
            cluster_name: clusterAssignment.clusterName,
            cluster_centroid: clusterAssignment.clusterCentroid,
            is_clustered: true,
            // Keep original analysis value for the ZIP code
            original_value: record.value
          },
          // CRITICAL: Explicitly preserve geometry from original record
          geometry: record.geometry
        };
        
        // Debug logging for first few records only
        if (clusteredZipRecords.length < 3) {
          const geom: any = (clusteredRecord as any)?.geometry;
          console.log(`[ClusteringService] 📍 ZIP ${zipCode} clustered record:`, {
            hasGeometry: !!clusteredRecord.geometry,
            geometryType: geom?.type,
            clusterId: clusterAssignment.clusterId
          });
        }
        
        clusteredZipRecords.push(clusteredRecord);
      } else {
        // Debug ZIP code matching issues
        const debugInfo = {
          extractedZipCode: zipCode,
          area_name: record.area_name,
          geo_id: record.properties?.geo_id,
          zip_code: record.properties?.zip_code,
          availableMapKeys: Array.from(zipToClusterMap.keys()).slice(0, 5) // Show first 5 keys for debugging
        };
        console.warn(`[ClusteringService] ZIP code ${zipCode} not assigned to any cluster:`, debugInfo);
      }
    });

    console.log(`[ClusteringService] ✅ Created ${clusteredZipRecords.length} clustered ZIP records from ${originalResult.data.records?.length || 0} original ZIP codes`);
    console.log(`[ClusteringService] ✅ Sample clustered ZIP record:`, {
      area_id: clusteredZipRecords[0]?.area_id,
      area_name: clusteredZipRecords[0]?.area_name,
      cluster_id: clusteredZipRecords[0]?.cluster_id,
      hasGeometry: !!clusteredZipRecords[0]?.geometry,
      geometryType: clusteredZipRecords[0]?.geometry?.type
    });

    const clusteringSummary = this.generateClusteringSummary(clusteringResult);
    console.log(`[ClusteringService] 📝 Generated clustering summary:`, clusteringSummary);
    
    // Enhanced data with clustered ZIP records
    const enhancedData: any = {
      ...originalResult.data,
      records: clusteredZipRecords, // Use individual ZIP codes with cluster assignments
      totalRecords: clusteredZipRecords.length, // Shows clustered ZIP count
      clusters: clusteringResult.clusters, // Keep original for reference
      namedClusters: undefined, // Will be set after cluster analysis
      clusteringSummary,
      // Add metadata indicating this is clustered ZIP data
      isClustered: true,
      clusteringApproach: 'clustered_zip_codes',
      // Hint visualization pipeline to zoom after rendering clustered records
      shouldZoom: true,
      originalRecordCount: originalResult.data.records?.length || 0,
      // CRITICAL: Remove any existing renderer/legend to force ClusterRenderer usage
      renderer: undefined,
      legend: undefined
    };
    
    // Update the summary to include clustering information and make it territory-focused
    const originalSummary = originalResult.data.summary || '';
    
    // Generate endpoint-specific cluster analysis
    console.log('🎯 [CLUSTER ANALYSIS] About to generate endpoint-specific cluster analysis');
    console.log('🎯 [CLUSTER ANALYSIS] Parameters:', {
      endpoint: originalResult.endpoint,
      clustersCount: clusteringResult.clusters.length,
      clusteredZipCount: clusteredZipRecords.length,
      originalSummaryLength: originalSummary.length
    });
    
    const clusterAnalysisResult = this.generateEndpointSpecificClusterAnalysis(
      clusteringResult, 
      clusteredZipRecords, 
      originalResult.endpoint,
      originalSummary
    );
    
    console.log('🎯 [CLUSTER ANALYSIS] Generated cluster analysis:', {
      length: clusterAnalysisResult.analysis.length,
      namedClustersCount: clusterAnalysisResult.namedClusters.length,
      preview: clusterAnalysisResult.analysis.substring(0, 200) + '...'
    });
    
    // Update enhancedData with named clusters
    enhancedData.namedClusters = clusterAnalysisResult.namedClusters;
    
    const enhancedSummary = `${clusterAnalysisResult.analysis}\n\n**Territory Clustering Applied:** ${clusteringSummary}`;
    enhancedData.summary = enhancedSummary;
    
    console.log(`[ClusteringService] 📝 Enhanced summary with clustering:`, enhancedSummary);

    // CRITICAL: Clear visualization to force regeneration with cluster renderer
    // The original visualization contains direct renderer that bypasses cluster rendering
    console.log('[ClusteringService] 🎯 Clearing visualization to force cluster renderer usage');

    return {
      ...originalResult,
      data: enhancedData,
      visualization: originalResult.visualization, // Will be replaced by VisualizationRenderer when it detects clustered data
      metadata: {
        ...enhancedMetadata,
        executionTime: enhancedMetadata.executionTime || 0,
        dataPointCount: enhancedMetadata.dataPointCount || clusteredZipRecords.length,
        timestamp: enhancedMetadata.timestamp || new Date().toISOString()
      }
    };
  }

  /**
   * Create cluster territory boundary from ZIP code records
   */
  private createClusterTerritoryBoundary(zipRecords: any[]): GeoJSON.Polygon | null {
    if (zipRecords.length === 0) return null;
    
    // Extract all coordinates from ZIP code geometries that have been joined with boundaries
    const allCoordinates: [number, number][] = [];
    
    zipRecords.forEach(record => {
      if (record.geometry?.type === 'Polygon' && record.geometry.coordinates?.[0]) {
        // Extract coordinates from polygon rings
        record.geometry.coordinates[0].forEach((coord: [number, number]) => {
          allCoordinates.push(coord);
        });
      } else if (record.geometry?.type === 'Point' && record.geometry.coordinates) {
        // Use point coordinates directly
        allCoordinates.push([record.geometry.coordinates[0], record.geometry.coordinates[1]]);
      }
    });
    
    if (allCoordinates.length === 0) {
      console.warn(`[ClusteringService] No valid coordinates found for cluster territory`);
      return null;
    }
    
    // Calculate bounding box for the territory
    const lons = allCoordinates.map(coord => coord[0]);
    const lats = allCoordinates.map(coord => coord[1]);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    
    // Add padding to create a proper territory boundary
    const lonRange = maxLon - minLon;
    const latRange = maxLat - minLat;
    const padding = Math.max(0.01, lonRange * 0.1, latRange * 0.1);
    
    // Create territory boundary polygon
    return {
      type: 'Polygon',
      coordinates: [[
        [minLon - padding, minLat - padding],  // Bottom-left
        [minLon - padding, maxLat + padding],  // Top-left
        [maxLon + padding, maxLat + padding],  // Top-right
        [maxLon + padding, minLat - padding],  // Bottom-right
        [minLon - padding, minLat - padding]   // Close polygon
      ]]
    };
  }

  /**
   * Generate clustering summary for display
   */
  private generateClusteringSummary(result: ClusteringResult): string {
    if (!result.success || result.clusters.length === 0) {
      return 'Clustering could not be applied to this analysis.';
    }

    const validClusters = result.clusters.filter(c => c.isValid);
    const totalPopulation = validClusters.reduce((sum, c) => sum + c.totalPopulation, 0);
    const avgPopulation = validClusters.length > 0 ? totalPopulation / validClusters.length : 0;
    const avgZipCodes = validClusters.length > 0 ? 
      validClusters.reduce((sum, c) => sum + c.zipCodes.length, 0) / validClusters.length : 0;

    let summary = `The analysis has been organized into ${validClusters.length} distinct market territories for campaign deployment. `;
    summary += `Each territory averages ${Math.round(avgZipCodes)} ZIP codes and serves ${Math.round(avgPopulation).toLocaleString()} people. `;
    summary += `These ${validClusters.length} territories represent strategic groupings of the original ${result.totalZipCodes} ZIP codes, optimized for efficient market penetration and resource allocation. `;
    
    if (result.unclustered.length > 0) {
      summary += `Note: ${result.unclustered.length} ZIP codes could not be grouped due to geographic or demographic constraints.`;
    }

    return summary;
  }

  /**
   * Generate endpoint-specific cluster analysis with proper naming and hierarchical structure
   */
  private generateEndpointSpecificClusterAnalysis(
    clusteringResult: ClusteringResult,
    clusteredZipRecords: any[],
    endpoint: string,
    originalSummary: string
  ): { analysis: string; namedClusters: any[] } {
    console.log('🎯 [CLUSTER ANALYSIS METHOD] Starting cluster analysis generation');
    console.log('🎯 [CLUSTER ANALYSIS METHOD] Input validation:', {
      success: clusteringResult.success,
      clustersLength: clusteringResult.clusters.length,
      zipRecordsLength: clusteredZipRecords.length,
      endpoint: endpoint
    });
    
    if (!clusteringResult.success || clusteringResult.clusters.length === 0) {
      console.log('🎯 [CLUSTER ANALYSIS METHOD] Falling back to original summary - clustering failed or no clusters');
      return { analysis: originalSummary, namedClusters: [] }; // Fall back to original if clustering failed
    }

    // Extract endpoint-specific configuration
    const endpointConfig = this.getEndpointAnalysisConfig(endpoint);
    
    // Create named clusters with their top ZIP codes
    console.log('🎯 [CLUSTER ANALYSIS] Processing clusters for analysis:', {
      totalClusters: clusteringResult.clusters.length,
      clusterIds: clusteringResult.clusters.map(c => ({ id: c.clusterId, name: c.name, zipCount: c.zipCodes.length }))
    });
    
    const namedClusters = clusteringResult.clusters.map(cluster => {
      const namedCluster = this.createNamedCluster(cluster, clusteredZipRecords, endpointConfig);
      console.log(`🎯 [CLUSTER ANALYSIS] Created named cluster:`, {
        originalClusterId: cluster.clusterId,
        originalName: cluster.name,
        finalClusterName: namedCluster?.name,
        zipCount: namedCluster?.zipCount,
        avgScore: namedCluster?.avgScore,
        topZipsCount: namedCluster?.topZips?.length || 0
      });
      return namedCluster;
    });

    // Filter out any null clusters and sort by strategic importance
  const validNamedClusters = namedClusters.filter(cluster => cluster !== null);
    // Keep clusters in original ID order to match map legend - do NOT sort by score
    validNamedClusters.sort((a, b) => a.originalClusterId - b.originalClusterId);
    
    console.log(`🎯 [CLUSTER ANALYSIS] Final clusters for text generation:`, {
      totalClusters: validNamedClusters.length,
      clusterSummary: validNamedClusters.map(c => ({ 
        name: c.name, 
        zipCount: c.zipCount, 
        avgScore: c.avgScore.toFixed(1) 
      }))
    });
    
    // Generate endpoint-specific cluster analysis
    let analysis = this.generateClusterIntroduction(validNamedClusters, endpointConfig);
    
    // Add detailed cluster analysis
  validNamedClusters.forEach((cluster) => {
      // Use cluster ID + 1 to match legend numbering (cluster ID 0 = ①, cluster ID 1 = ②, etc.)
      const displayNumber = cluster.originalClusterId + 1;
      analysis += this.generateClusterDetails(cluster, displayNumber, endpointConfig, validNamedClusters.length);
    });

    // Add strategic recommendations
    analysis += this.generateClusterRecommendations(validNamedClusters, endpointConfig);

    console.log('🎯 [CLUSTER ANALYSIS METHOD] Successfully generated cluster analysis:', {
      analysisLength: analysis.length,
      namedClustersCount: validNamedClusters.length,
      preview: analysis.substring(0, 300) + '...'
    });

    return { analysis, namedClusters: validNamedClusters };
  }

  /**
   * Get endpoint-specific analysis configuration
   */
  private getEndpointAnalysisConfig(endpoint: string): any {
    const configs = {
      '/strategic-analysis': {
        name: 'Strategic Market Analysis',
        scoreField: 'strategic_value_score',
        scoreName: 'Strategic Value',
        focus: 'market expansion opportunities',
        metrics: ['market potential', 'demographic alignment', 'competitive positioning'],
        recommendations: 'strategic market entry'
      },
      '/competitive-analysis': {
        name: 'Competitive Market Analysis', 
        scoreField: 'competitive_advantage_score',
        scoreName: 'Competitive Advantage',
        focus: 'competitive market positioning',
        metrics: ['market share gaps', 'competitive density', 'brand positioning'],
        recommendations: 'competitive strategy deployment'
      },
      '/demographic-analysis': {
        name: 'Demographic Opportunity Analysis',
        scoreField: 'demographic_opportunity_score', 
        scoreName: 'Demographic Opportunity',
        focus: 'demographic market fit',
        metrics: ['population density', 'income levels', 'age demographics'],
        recommendations: 'demographic targeting'
      },
      '/correlation-analysis': {
        name: 'Market Correlation Analysis',
        scoreField: 'correlation_score',
        scoreName: 'Market Correlation',
        focus: 'market relationship patterns',
        metrics: ['variable correlations', 'market dependencies', 'trend alignment'],
        recommendations: 'data-driven market selection'
      }
    };

    return configs[endpoint as keyof typeof configs] || {
      name: 'Market Analysis',
      scoreField: 'value',
      scoreName: 'Market Score', 
      focus: 'market opportunities',
      metrics: ['market potential', 'growth opportunities'],
      recommendations: 'market development'
    };
  }

  /**
   * Create a named cluster with its characteristics
   */
  private createNamedCluster(cluster: any, clusteredZipRecords: any[], config: any): any {
    // Find ZIP codes belonging to this cluster
    const clusterZips = clusteredZipRecords.filter(record => 
      record.cluster_id === cluster.clusterId
    );
    
    console.log(`🎯 [CLUSTER ANALYSIS] Creating cluster ${cluster.clusterId} (original: ${cluster.name}):`, {
      expectedZipCount: cluster.zipCodes?.length,
      foundZipCount: clusterZips.length,
      sampleZips: clusterZips.slice(0, 5).map(z => ({ area: z.area_name, clusterId: z.cluster_id, score: z.value }))
    });

    if (clusterZips.length === 0) {
      console.log(`🎯 [CLUSTER ANALYSIS] ❌ No ZIP codes found for cluster ${cluster.clusterId}`);
      return null;
    }

    // Find highest population ZIP for naming (using population or score as fallback)
    const leadZip = clusterZips.reduce((max, zip) => {
      const maxPop = max.properties?.total_population || max.properties?.totpop_cy || 0;
      const zipPop = zip.properties?.total_population || zip.properties?.totpop_cy || 0;
      return zipPop > maxPop ? zip : max;
    });

    // Extract cluster name using shared resolver (city-focused label)
  const clusterName = resolveAreaName(leadZip, { mode: 'cityOnly', neutralFallback: `Region ${cluster.clusterId + 1}` });
    if (clusterZips.length > 1) {
      console.log(`🎯 [CLUSTER ANALYSIS] Multi-ZIP cluster ${cluster.clusterId}: Using geographic name "${clusterName}" based on largest ZIP ${leadZip.area_name} (pop: ${leadZip.properties?.total_population || leadZip.properties?.totpop_cy || 0}) for ${clusterZips.length} ZIP codes`);
    }
    
    console.log(`🎯 [CLUSTER ANALYSIS] Generated cluster name: "${clusterName}" for cluster ${cluster.clusterId}`);
    
    // Calculate cluster statistics with better error handling
    const scores = clusterZips.map(zip => {
      const score = zip.value || zip.properties?.[config.scoreField] || zip.properties?.strategic_value_score || 0;
      return isNaN(score) ? 0 : score;
    }).filter(score => score > 0); // Remove zeros and invalid scores
    
    const avgScore = scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
    const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
    const minScore = scores.length > 0 ? Math.min(...scores) : 0;

    // Get top 5 ZIP codes in this cluster for detailed description
  const topZips = clusterZips
      .filter(zip => {
        const score = zip.value || zip.properties?.[config.scoreField] || zip.properties?.strategic_value_score || 0;
        return !isNaN(score) && score > 0;
      })
      .sort((a, b) => {
        const scoreA = a.value || a.properties?.[config.scoreField] || a.properties?.strategic_value_score || 0;
        const scoreB = b.value || b.properties?.[config.scoreField] || b.properties?.strategic_value_score || 0;
        return scoreB - scoreA;
      })
      .slice(0, 5)
      .map(zip => {
    const normalizedZipCode = getZip(zip);
        const score = zip.value || zip.properties?.[config.scoreField] || zip.properties?.strategic_value_score || 0;

    // Prefer a robust, human-friendly label via shared resolver
    const name = resolveAreaName(zip, { mode: 'zipCity' });

        return {
          code: normalizedZipCode || '—',
          name,
          score: isNaN(score) ? 0 : score
        };
      });
    
    console.log(`🎯 [CLUSTER ANALYSIS] Top ZIP codes for cluster "${clusterName}":`, topZips);
    
    // Calculate population-weighted market shares for the cluster
    const totalPopulation = clusterZips.reduce((sum, zip) => 
      sum + (zip.properties?.total_population || zip.properties?.totpop_cy || 0), 0
    );
    
    const clusterMarketShares = this.calculateClusterMarketShares(clusterZips, totalPopulation);
    
    return {
      id: cluster.clusterId,
      originalClusterId: cluster.clusterId, // Preserve original cluster ID for numbering
      name: clusterName,
      zipCount: clusterZips.length,
      avgScore,
      maxScore,
      minScore,
      topZips, // Include top 5 ZIP codes for description
      totalPopulation,
      // Add cluster-level market analysis
      marketShares: clusterMarketShares
    };
  }

  /**
   * Resolve a clear area label for a ZIP record.
   * Preference order: properties.DESCRIPTION -> area_name -> "ZIP <code> (City)" -> "ZIP <code>" -> "Location".
   */
  private resolveAreaLabel(record: any, normalizedZipCode?: string): string {
    try {
      const props = record?.properties || {};
      // 1) Full DESCRIPTION like "11234 (Brooklyn)" — return as-is
      const desc = (typeof props.DESCRIPTION === 'string' && props.DESCRIPTION.trim())
        ? props.DESCRIPTION.trim()
        : (typeof record?.area_name === 'string' && record.area_name.trim())
          ? record.area_name.trim()
          : '';
      if (desc) return desc;

      // 2) Build from ZIP + city-like fields
      const zip = normalizedZipCode || props.geo_id || props.zip_code || '';
      const nameFields = ['NAME', 'CITY', 'MUNICIPALITY', 'REGION', 'CSDNAME', 'FEDNAME'];
      let city = '';
      for (const f of nameFields) {
        if (props[f]) { city = String(props[f]).trim(); break; }
      }
      if (zip && city) return `${zip} (${city})`;
      if (zip) return `ZIP ${zip}`;

      // 3) Fall back to area_id or neutral label
      return record?.area_id || 'Location';
  } catch {
      return 'Location';
    }
  }

  /**
   * Calculate population-weighted market shares for a cluster
   */
  private calculateClusterMarketShares(clusterZips: any[], totalPopulation: number): any {
    if (totalPopulation === 0) {
      return {
        nike: 0,
        adidas: 0,
        jordan: 0,
        marketGap: 100
      };
    }

    // Calculate population-weighted market shares
    let weightedNikeShare = 0;
    let weightedAdidasShare = 0;
    let weightedJordanShare = 0;

    clusterZips.forEach(zip => {
      const population = zip.properties?.total_population || zip.properties?.totpop_cy || 0;
      const weight = population / totalPopulation;
      
      const nikeShare = zip.properties?.mp30034a_b_p || zip.properties?.nike_market_share || 0;
      const adidasShare = zip.properties?.mp30029a_b_p || zip.properties?.adidas_market_share || 0;
      const jordanShare = zip.properties?.mp30032a_b_p || zip.properties?.jordan_market_share || 0;
      
      weightedNikeShare += nikeShare * weight;
      weightedAdidasShare += adidasShare * weight;
      weightedJordanShare += jordanShare * weight;
    });

    const marketGap = Math.max(0, 100 - weightedNikeShare - weightedAdidasShare - weightedJordanShare);

    console.log(`🎯 [CLUSTER MARKET ANALYSIS] Calculated cluster market shares:`, {
      nike: weightedNikeShare.toFixed(2),
      adidas: weightedAdidasShare.toFixed(2),
      jordan: weightedJordanShare.toFixed(2),
      marketGap: marketGap.toFixed(2),
      totalPopulation
    });

    return {
      nike: weightedNikeShare,
      adidas: weightedAdidasShare,
      jordan: weightedJordanShare,
      marketGap: marketGap
    };
  }

  // Removed: cluster name now uses shared resolveAreaName

  /**
   * Generate cluster analysis introduction
   */
  private generateClusterIntroduction(clusters: any[], config: any): string {
    const totalZips = clusters.reduce((sum, cluster) => sum + cluster.zipCount, 0);
    const avgScore = clusters.reduce((sum, cluster) => sum + cluster.avgScore, 0) / clusters.length;
    
    return `**${config.name} - Territory Clustering Results**

This ${config.focus} analysis has identified ${clusters.length} distinct market territories comprising ${totalZips.toLocaleString()} ZIP codes. The territories are strategically grouped based on ${config.scoreName.toLowerCase()} scores, with an average ${config.scoreName.toLowerCase()} of ${avgScore.toFixed(1)}. Each territory represents a cohesive market area optimized for ${config.recommendations}.

**Territory Analysis:**

`;
  }

  /**
   * Generate detailed analysis for each cluster
   */
  private generateClusterDetails(cluster: any, rank: number, config: any, totalClusters: number): string {
    const scoreSpread = cluster.maxScore - cluster.minScore;
    const consistencyText = scoreSpread < 10 ? "highly consistent scores" : 
                           scoreSpread < 20 ? "moderately consistent scores" : 
                           "varied performance across areas";

    // Include top ZIP codes as requested
    let zipDetails = '';
    if (cluster.topZips && cluster.topZips.length > 0) {
      zipDetails = `\nTop ZIP codes: ${cluster.topZips.map((zip: any) => {
        // Extract area name from formats like "11234 (Brooklyn)" or "Brooklyn"
        let areaName = zip.name || 'Location';
        if (areaName.includes('(') && areaName.includes(')')) {
          // Extract the part in parentheses: "11234 (Brooklyn)" -> "Brooklyn"
          const match = areaName.match(/\((.*?)\)/);
          areaName = match ? match[1] : areaName;
        }
        
        // Ensure score is valid and formatted properly
        const score = zip.score || 0;
        const formattedScore = isNaN(score) ? '0.0' : score.toFixed(1);
        
        return `${zip.code} (${areaName}: ${formattedScore})`;
      }).join(', ')}`;
    }

    // Add cluster-level market analysis if available
    let marketDetails = '';
    if (cluster.marketShares) {
      const nike = isNaN(cluster.marketShares.nike) ? 0 : cluster.marketShares.nike;
      const adidas = isNaN(cluster.marketShares.adidas) ? 0 : cluster.marketShares.adidas;
      const jordan = isNaN(cluster.marketShares.jordan) ? 0 : cluster.marketShares.jordan;
      const marketGap = isNaN(cluster.marketShares.marketGap) ? 0 : cluster.marketShares.marketGap;
      
      marketDetails = `\nMarket Analysis: Nike ${nike.toFixed(1)}%, Adidas ${adidas.toFixed(1)}%, Jordan ${jordan.toFixed(1)}% | Market Gap: ${marketGap.toFixed(1)}%`;
    }

    // Generate key drivers for this territory's high performance
    let keyDrivers = '\nKey Drivers: ';
    const drivers = [];
    
    // Market gap driver
    if (cluster.marketShares?.marketGap > 70) {
      drivers.push('Significant untapped market opportunity');
    } else if (cluster.marketShares?.marketGap > 50) {
      drivers.push('Strong growth potential');
    }
    
    // Population driver
    if (cluster.totalPopulation > 5000000) {
      drivers.push('Large metropolitan population base');
    } else if (cluster.totalPopulation > 1000000) {
      drivers.push('Substantial population density');
    }
    
    // Score consistency driver
    if (scoreSpread < 10) {
      drivers.push('Consistent high performance across territory');
    } else if (cluster.maxScore > 70) {
      drivers.push('Premium market segments');
    }
    
    // Geographic advantage
    if (cluster.zipCount > 100) {
      drivers.push('Extensive geographic coverage');
    } else if (cluster.zipCount < 20) {
      drivers.push('Concentrated market for efficient operations');
    }
    
    keyDrivers += drivers.join(', ') || 'Strategic market positioning';

    // Add color indicator for visualization legend matching
    // Use the actual cluster ID (not rank) to match the renderer's color assignment
  const colorIndicator = this.getColorIndicatorForCluster(cluster.originalClusterId);
    console.log(`🎯 [COLOR DEBUG] Cluster ID ${cluster.originalClusterId}, Rank ${rank}: ${colorIndicator} for ${cluster.name} (${totalClusters} total clusters)`);
    
    // Ensure all numeric values are valid
    const avgScore = isNaN(cluster.avgScore) ? 0 : cluster.avgScore;
    const minScore = isNaN(cluster.minScore) ? 0 : cluster.minScore;
    const maxScore = isNaN(cluster.maxScore) ? 0 : cluster.maxScore;
    const population = isNaN(cluster.totalPopulation) ? 0 : cluster.totalPopulation;
    
    return `**${rank}. ${cluster.name}** [${colorIndicator}] - ${cluster.zipCount} ZIP codes, Avg ${config.scoreName}: ${avgScore.toFixed(1)}
Population: ${population.toLocaleString()} | Score Range: ${minScore.toFixed(1)}-${maxScore.toFixed(1)}
Territory Profile: Comprehensive market area with ${consistencyText} across the region${zipDetails}${marketDetails}${keyDrivers}

`;
  }

  /**
   * Generate strategic recommendations based on clusters
   */
  private generateClusterRecommendations(clusters: any[], config: any): string {
    const topCluster = clusters[0];
    
    // Generate specific, actionable recommendations based on cluster characteristics
    let recommendations = `**Strategic Recommendations:**\n\n`;
    
    // Priority territory recommendation
    recommendations += `**1. Priority Territory Deployment:**\n`;
    recommendations += `Focus immediate expansion efforts on **${topCluster.name}** (${config.scoreName}: ${topCluster.avgScore.toFixed(1)}):\n`;
    recommendations += `- Population reach: ${topCluster.totalPopulation.toLocaleString()} across ${topCluster.zipCount} ZIP codes\n`;
    if (topCluster.marketShares) {
      recommendations += `- Current Nike share: ${topCluster.marketShares.nike.toFixed(1)}% with ${topCluster.marketShares.marketGap.toFixed(1)}% untapped market\n`;
    }
    recommendations += `- Deploy flagship stores in top ZIP codes: ${topCluster.topZips?.slice(0, 3).map((z: any) => z.code).join(', ') || 'See territory details'}\n\n`;
    
    // Territory-specific strategies
    recommendations += `**2. Territory-Specific Market Entry Strategies:**\n`;
  clusters.slice(0, 3).forEach((cluster) => {
      recommendations += `- **${cluster.name}**: `;
      if (cluster.marketShares?.marketGap > 70) {
        recommendations += `High market gap (${cluster.marketShares.marketGap.toFixed(1)}%) - aggressive store expansion and digital marketing campaigns\n`;
      } else if (cluster.marketShares?.marketGap > 50) {
        recommendations += `Moderate market gap (${cluster.marketShares.marketGap.toFixed(1)}%) - targeted pop-up stores and partnership opportunities\n`;
      } else {
        recommendations += `Lower market gap (${cluster.marketShares?.marketGap.toFixed(1)}%) - focus on market share capture from competitors\n`;
      }
    });
    
    recommendations += `\n**3. Resource Allocation Framework:**\n`;
    recommendations += `- Allocate 40% of expansion budget to top territory (${topCluster.name})\n`;
    recommendations += `- Distribute 35% across secondary territories based on market gap opportunities\n`;
    recommendations += `- Reserve 25% for digital infrastructure and omnichannel capabilities\n`;
    
    recommendations += `\n**4. Implementation Timeline:**\n`;
    recommendations += `- Q1: Establish presence in top 5 ZIP codes of priority territory\n`;
    recommendations += `- Q2: Launch targeted campaigns in secondary territories\n`;
    recommendations += `- Q3: Evaluate performance metrics and adjust territory strategies\n`;
    recommendations += `- Q4: Scale successful initiatives across all ${clusters.length} territories\n`;
    
    return recommendations;
  }

  /**
   * Get a simple, clear indicator for a cluster that users can easily match to the map legend
   * Uses numbered circles for foolproof identification
   */
  private getColorIndicatorForCluster(clusterId: number): string {
    // Use simple numbered indicators for clear identification
    // This approach is foolproof - users can easily match numbers between analysis and legend
    const numberEmojis = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
    
    if (clusterId < numberEmojis.length) {
      return numberEmojis[clusterId];
    } else {
      // For clusters beyond 10, use parentheses format
      return `(${clusterId + 1})`;
    }
  }
}