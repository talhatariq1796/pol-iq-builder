/**
 * GeoJSON Endpoint Generator for Real Estate ML Predictions
 * 
 * Generates point-based GeoJSON endpoints with ML predictions for visualization
 * and integration with the existing real estate analysis platform.
 */

import { RealEstatePropertyFeatures, MultiTargetPredictionResponse } from '../../types/microservice-types';

export interface GeoJSONEndpointConfig {
  output_directory: string;
  endpoint_base_url: string;
  include_confidence_scores: boolean;
  include_feature_importance: boolean;
  include_shap_values: boolean;
  point_clustering: boolean;
  cluster_threshold: number; // meters
  prediction_thresholds: {
    time_on_market: { low: number; high: number };
    price_delta: { low: number; high: number };
    rental_yield: { low: number; high: number };
    investment_score: { low: number; high: number };
  };
}

export interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  properties: {
    // Property identifiers
    property_id?: string;
    centris_no?: number;
    
    // Basic property info
    bedrooms: number;
    bathrooms: number;
    area_sqft: number;
    price_current: number;
    property_type: string;
    building_age?: number;
    fsa_code: string;
    
    // ML Predictions
    time_on_market_prediction: number;
    time_on_market_confidence: number;
    time_on_market_category: 'fast' | 'normal' | 'slow';
    
    price_delta_prediction: number;
    price_delta_confidence: number;
    price_delta_category: 'decline' | 'stable' | 'growth';
    
    rental_yield_prediction: number;
    rental_yield_confidence: number;
    rental_yield_category: 'low' | 'moderate' | 'high';
    
    investment_score_prediction: number;
    investment_score_confidence: number;
    investment_score_category: 'poor' | 'fair' | 'good' | 'excellent';
    
    // Feature importance (optional)
    top_features?: Array<{
      feature_name: string;
      importance_score: number;
      impact_direction: 'positive' | 'negative';
    }>;
    
    // SHAP values (optional)
    shap_explanations?: {
      time_on_market: Record<string, number>;
      price_delta: Record<string, number>;
      rental_yield: Record<string, number>;
      investment_score: Record<string, number>;
    };
    
    // Spatial context
    neighborhood_stats?: {
      avg_price: number;
      median_price: number;
      property_count: number;
      avg_time_on_market: number;
    };
    
    // Metadata
    prediction_timestamp: string;
    model_version: string;
    data_freshness_score: number; // 0-100
  };
}

export interface GeoJSONEndpoint {
  type: 'FeatureCollection';
  metadata: {
    target_variable: string;
    total_features: number;
    prediction_timestamp: string;
    model_version: string;
    data_quality_score: number;
    endpoint_url: string;
    bounding_box: {
      min_lat: number;
      max_lat: number;
      min_lng: number;
      max_lng: number;
    };
    prediction_summary: {
      mean: number;
      median: number;
      std: number;
      min: number;
      max: number;
      distribution: Record<string, number>;
    };
  };
  features: GeoJSONFeature[];
}

export class GeoJSONEndpointGenerator {
  private config: GeoJSONEndpointConfig;

  constructor(config: GeoJSONEndpointConfig) {
    this.config = config;
  }

  /**
   * Generate GeoJSON endpoints for all target variables
   */
  public async generateAllEndpoints(
    properties: RealEstatePropertyFeatures[],
    predictions: MultiTargetPredictionResponse
  ): Promise<{ [target: string]: GeoJSONEndpoint }> {
    
    const endpoints: { [target: string]: GeoJSONEndpoint } = {};
    const targets = ['time_on_market', 'price_delta', 'rental_yield', 'investment_score'] as const;

    for (const target of targets) {
      console.log(`Generating GeoJSON endpoint for ${target}...`);
      
      const endpoint = await this.generateSingleEndpoint(
        properties,
        predictions,
        target
      );
      
      endpoints[target] = endpoint;
      
      // Save to file
      await this.saveEndpointToFile(endpoint, target);
    }

    // Generate combined endpoint with all predictions
    console.log('Generating combined multi-target endpoint...');
    const combinedEndpoint = await this.generateCombinedEndpoint(properties, predictions);
    endpoints['combined'] = combinedEndpoint;
    await this.saveEndpointToFile(combinedEndpoint, 'combined');

    return endpoints;
  }

  /**
   * Generate GeoJSON endpoint for a single target variable
   */
  public async generateSingleEndpoint(
    properties: RealEstatePropertyFeatures[],
    predictions: MultiTargetPredictionResponse,
    target: keyof typeof predictions.predictions
  ): Promise<GeoJSONEndpoint> {
    
    const targetPredictions = predictions.predictions[target];
    const targetConfidence = predictions.confidence_scores[target];
    const targetExplanations = predictions.explanations[target];

    // Create features
    const features: GeoJSONFeature[] = properties.map((property, index) => {
      const prediction = targetPredictions[index];
      const confidence = targetConfidence[index];
      
      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [property.longitude, property.latitude]
        },
        properties: {
          // Basic property info
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          area_sqft: property.area_sqft,
          price_current: property.price_current,
          property_type: property.property_type,
          building_age: property.building_age,
          fsa_code: property.fsa_code,
          
          // Target-specific predictions
          [`${target}_prediction`]: prediction,
          [`${target}_confidence`]: confidence,
          [`${target}_category`]: this.categorizePrediction(target, prediction) as any,
          
          // Additional predictions for context
          time_on_market_prediction: targetPredictions[index],
          time_on_market_confidence: targetConfidence[index],
          time_on_market_category: this.categorizePrediction('time_on_market', targetPredictions[index]) as any,
          
          price_delta_prediction: predictions.predictions.price_delta[index],
          price_delta_confidence: predictions.confidence_scores.price_delta[index],
          price_delta_category: this.categorizePrediction('price_delta', predictions.predictions.price_delta[index]) as any,
          
          rental_yield_prediction: predictions.predictions.rental_yield[index],
          rental_yield_confidence: predictions.confidence_scores.rental_yield[index],
          rental_yield_category: this.categorizePrediction('rental_yield', predictions.predictions.rental_yield[index]) as any,
          
          investment_score_prediction: predictions.predictions.investment_score[index],
          investment_score_confidence: predictions.confidence_scores.investment_score[index],
          investment_score_category: this.categorizePrediction('investment_score', predictions.predictions.investment_score[index]) as any,
          
          // Feature importance
          top_features: this.config.include_feature_importance ? 
            this.extractTopFeatures(predictions.feature_importance, target) : undefined,
          
          // SHAP explanations
          shap_explanations: this.config.include_shap_values ? 
            this.extractShapValues(targetExplanations, index) as any : undefined,
          
          // Spatial context
          neighborhood_stats: this.computeNeighborhoodStats(property, properties),
          
          // Metadata
          prediction_timestamp: new Date().toISOString(),
          model_version: predictions.model_version,
          data_freshness_score: this.calculateDataFreshness(property)
        }
      };
    });

    // Apply clustering if enabled
    const finalFeatures = this.config.point_clustering ? 
      await this.clusterNearbyPoints(features) : features;

    // Calculate bounding box
    const boundingBox = this.calculateBoundingBox(finalFeatures);
    
    // Calculate prediction summary
    const predictionValues = finalFeatures.map(f => f.properties[`${target}_prediction`]);
    const predictionSummary = this.calculatePredictionSummary(predictionValues);

    return {
      type: 'FeatureCollection',
      metadata: {
        target_variable: target,
        total_features: finalFeatures.length,
        prediction_timestamp: new Date().toISOString(),
        model_version: predictions.model_version,
        data_quality_score: this.calculateDataQualityScore(properties),
        endpoint_url: `${this.config.endpoint_base_url}/${target}.geojson`,
        bounding_box: boundingBox,
        prediction_summary: predictionSummary
      },
      features: finalFeatures
    };
  }

  /**
   * Generate combined endpoint with all target predictions
   */
  public async generateCombinedEndpoint(
    properties: RealEstatePropertyFeatures[],
    predictions: MultiTargetPredictionResponse
  ): Promise<GeoJSONEndpoint> {
    
    const features: GeoJSONFeature[] = properties.map((property, index) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [property.longitude, property.latitude]
      },
      properties: {
        // Basic property info
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        area_sqft: property.area_sqft,
        price_current: property.price_current,
        property_type: property.property_type,
        building_age: property.building_age,
        fsa_code: property.fsa_code,
        
        // All predictions
        time_on_market_prediction: predictions.predictions.time_on_market[index],
        time_on_market_confidence: predictions.confidence_scores.time_on_market[index],
        time_on_market_category: this.categorizePrediction('time_on_market', predictions.predictions.time_on_market[index]) as any,
        
        price_delta_prediction: predictions.predictions.price_delta[index],
        price_delta_confidence: predictions.confidence_scores.price_delta[index],
        price_delta_category: this.categorizePrediction('price_delta', predictions.predictions.price_delta[index]) as any,
        
        rental_yield_prediction: predictions.predictions.rental_yield[index],
        rental_yield_confidence: predictions.confidence_scores.rental_yield[index],
        rental_yield_category: this.categorizePrediction('rental_yield', predictions.predictions.rental_yield[index]) as any,
        
        investment_score_prediction: predictions.predictions.investment_score[index],
        investment_score_confidence: predictions.confidence_scores.investment_score[index],
        investment_score_category: this.categorizePrediction('investment_score', predictions.predictions.investment_score[index]) as any,
        
        // Metadata
        prediction_timestamp: new Date().toISOString(),
        model_version: predictions.model_version,
        data_freshness_score: this.calculateDataFreshness(property)
      }
    }));

    const boundingBox = this.calculateBoundingBox(features);
    
    // Summary for investment score as primary metric
    const investmentScores = features.map(f => f.properties.investment_score_prediction);
    const predictionSummary = this.calculatePredictionSummary(investmentScores);

    return {
      type: 'FeatureCollection',
      metadata: {
        target_variable: 'combined',
        total_features: features.length,
        prediction_timestamp: new Date().toISOString(),
        model_version: predictions.model_version,
        data_quality_score: this.calculateDataQualityScore(properties),
        endpoint_url: `${this.config.endpoint_base_url}/combined.geojson`,
        bounding_box: boundingBox,
        prediction_summary: predictionSummary
      },
      features
    };
  }

  /**
   * Save GeoJSON endpoint to file
   */
  public async saveEndpointToFile(endpoint: GeoJSONEndpoint, target: string): Promise<string> {
    const fs = await import('fs');
    const path = await import('path');
    
    const outputPath = path.join(this.config.output_directory, `${target}.geojson`);
    
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Write GeoJSON file
    fs.writeFileSync(outputPath, JSON.stringify(endpoint, null, 2));
    
    console.log(`GeoJSON endpoint saved: ${outputPath}`);
    return outputPath;
  }

  // Private helper methods

  private categorizePrediction(
    target: string,
    value: number
  ): string {
    const thresholds = this.config.prediction_thresholds[target as keyof typeof this.config.prediction_thresholds];
    
    switch (target) {
      case 'time_on_market':
        if (value <= thresholds.low) return 'fast';
        if (value >= thresholds.high) return 'slow';
        return 'normal';
      
      case 'price_delta':
        if (value <= thresholds.low) return 'decline';
        if (value >= thresholds.high) return 'growth';
        return 'stable';
      
      case 'rental_yield':
        if (value <= thresholds.low) return 'low';
        if (value >= thresholds.high) return 'high';
        return 'moderate';
      
      case 'investment_score':
        if (value <= 25) return 'poor';
        if (value <= 50) return 'fair';
        if (value <= 75) return 'good';
        return 'excellent';
      
      default:
        return 'unknown';
    }
  }

  private extractTopFeatures(
    featureImportance: any,
    target: string
  ): Array<{ feature_name: string; importance_score: number; impact_direction: 'positive' | 'negative' }> {
    // Combine all feature importance types
    const allFeatures = [
      ...Object.entries(featureImportance.spatial_features || {}),
      ...Object.entries(featureImportance.property_features || {}),
      ...Object.entries(featureImportance.demographic_features || {})
    ];
    
    // Sort by importance and take top 5
    const sortedFeatures = allFeatures
      .map(([name, score]) => ({
        feature_name: name,
        importance_score: Math.abs(score as number),
        impact_direction: (score as number) >= 0 ? 'positive' as const : 'negative' as const
      }))
      .sort((a, b) => b.importance_score - a.importance_score)
      .slice(0, 5);
    
    return sortedFeatures;
  }

  private extractShapValues(explanation: any, index: number): Record<string, number> {
    if (!explanation.shap_values || !explanation.shap_values[index]) {
      return {};
    }
    
    const shapValues: Record<string, number> = {};
    const featureNames = explanation.feature_names;
    const values = explanation.shap_values[index];
    
    for (let i = 0; i < featureNames.length && i < values.length; i++) {
      shapValues[featureNames[i]] = values[i];
    }
    
    return shapValues;
  }

  private computeNeighborhoodStats(
    property: RealEstatePropertyFeatures,
    allProperties: RealEstatePropertyFeatures[]
  ): any {
    // Find nearby properties (1km radius)
    const neighbors = this.findNearbyProperties(property, allProperties, 1.0);
    
    if (neighbors.length === 0) {
      return {
        avg_price: property.price_current,
        median_price: property.price_current,
        property_count: 1,
        avg_time_on_market: property.time_on_market || 30
      };
    }
    
    const prices = neighbors.map(n => n.price_current).filter(p => p > 0);
    const timeOnMarket = neighbors.map(n => n.time_on_market).filter(t => t !== undefined) as number[];
    
    return {
      avg_price: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : property.price_current,
      median_price: prices.length > 0 ? this.median(prices) : property.price_current,
      property_count: neighbors.length,
      avg_time_on_market: timeOnMarket.length > 0 ? 
        timeOnMarket.reduce((a, b) => a + b, 0) / timeOnMarket.length : 30
    };
  }

  private findNearbyProperties(
    target: RealEstatePropertyFeatures,
    allProperties: RealEstatePropertyFeatures[],
    radiusKm: number
  ): RealEstatePropertyFeatures[] {
    const radiusDegrees = radiusKm / 111; // Rough conversion
    
    return allProperties.filter(property => {
      if (property === target) return false;
      
      const distance = Math.sqrt(
        Math.pow(target.latitude - property.latitude, 2) +
        Math.pow(target.longitude - property.longitude, 2)
      );
      
      return distance <= radiusDegrees;
    });
  }

  private median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  private calculateDataFreshness(property: RealEstatePropertyFeatures): number {
    // Simple freshness calculation based on available data
    let score = 100;
    
    if (!property.building_age) score -= 10;
    if (!property.time_on_market) score -= 15;
    if (!property.price_history) score -= 20;
    if (!property.median_income) score -= 10;
    
    return Math.max(0, score);
  }

  private async clusterNearbyPoints(features: GeoJSONFeature[]): Promise<GeoJSONFeature[]> {
    // Simple clustering implementation
    const clustered: GeoJSONFeature[] = [];
    const processed = new Set<number>();
    
    for (let i = 0; i < features.length; i++) {
      if (processed.has(i)) continue;
      
      const feature = features[i];
      const cluster = [feature];
      processed.add(i);
      
      // Find nearby points
      for (let j = i + 1; j < features.length; j++) {
        if (processed.has(j)) continue;
        
        const distance = this.calculateDistance(
          feature.geometry.coordinates,
          features[j].geometry.coordinates
        );
        
        if (distance < this.config.cluster_threshold) {
          cluster.push(features[j]);
          processed.add(j);
        }
      }
      
      // If cluster has multiple points, create averaged point
      if (cluster.length > 1) {
        const avgFeature = this.averageCluster(cluster);
        clustered.push(avgFeature);
      } else {
        clustered.push(feature);
      }
    }
    
    return clustered;
  }

  private calculateDistance(coord1: [number, number], coord2: [number, number]): number {
    // Haversine distance in meters
    const R = 6371000; // Earth's radius in meters
    const lat1 = coord1[1] * Math.PI / 180;
    const lat2 = coord2[1] * Math.PI / 180;
    const deltaLat = (coord2[1] - coord1[1]) * Math.PI / 180;
    const deltaLng = (coord2[0] - coord1[0]) * Math.PI / 180;
    
    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }

  private averageCluster(cluster: GeoJSONFeature[]): GeoJSONFeature {
    const avgLat = cluster.reduce((sum, f) => sum + f.geometry.coordinates[1], 0) / cluster.length;
    const avgLng = cluster.reduce((sum, f) => sum + f.geometry.coordinates[0], 0) / cluster.length;
    
    // Average numerical properties
    const avgProps = { ...cluster[0].properties };
    const numericalFields = [
      'time_on_market_prediction', 'price_delta_prediction',
      'rental_yield_prediction', 'investment_score_prediction',
      'time_on_market_confidence', 'price_delta_confidence',
      'rental_yield_confidence', 'investment_score_confidence'
    ];
    
    for (const field of numericalFields) {
      const values = cluster.map(f => (f.properties as any)[field]).filter(v => v !== undefined);
      if (values.length > 0) {
        (avgProps as any)[field] = values.reduce((a, b) => a + b, 0) / values.length;
      }
    }
    
    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [avgLng, avgLat]
      },
      properties: avgProps
    };
  }

  private calculateBoundingBox(features: GeoJSONFeature[]): any {
    const lats = features.map(f => f.geometry.coordinates[1]);
    const lngs = features.map(f => f.geometry.coordinates[0]);
    
    return {
      min_lat: Math.min(...lats),
      max_lat: Math.max(...lats),
      min_lng: Math.min(...lngs),
      max_lng: Math.max(...lngs)
    };
  }

  private calculatePredictionSummary(values: number[]): any {
    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const std = Math.sqrt(variance);
    
    // Create distribution buckets
    const min = Math.min(...values);
    const max = Math.max(...values);
    const bucketSize = (max - min) / 10;
    const distribution: Record<string, number> = {};
    
    for (let i = 0; i < 10; i++) {
      const bucketMin = min + i * bucketSize;
      const bucketMax = min + (i + 1) * bucketSize;
      const bucketLabel = `${bucketMin.toFixed(1)}-${bucketMax.toFixed(1)}`;
      distribution[bucketLabel] = values.filter(v => v >= bucketMin && v < bucketMax).length;
    }
    
    return {
      mean: Math.round(mean * 100) / 100,
      median: this.median(values),
      std: Math.round(std * 100) / 100,
      min: Math.min(...values),
      max: Math.max(...values),
      distribution
    };
  }

  private calculateDataQualityScore(properties: RealEstatePropertyFeatures[]): number {
    const totalFields = ['latitude', 'longitude', 'bedrooms', 'bathrooms', 'area_sqft', 'price_current'];
    let totalScore = 0;
    
    for (const property of properties) {
      let propertyScore = 0;
      for (const field of totalFields) {
        if ((property as any)[field] !== undefined && (property as any)[field] !== null && (property as any)[field] !== 0) {
          propertyScore++;
        }
      }
      totalScore += (propertyScore / totalFields.length) * 100;
    }
    
    return Math.round(totalScore / properties.length);
  }
}

export default GeoJSONEndpointGenerator;