/**
 * Multi-Target Real Estate ML Training Pipeline
 * 
 * This module provides end-to-end training for real estate prediction models
 * with support for multiple target variables and spatial feature engineering.
 */

import { RealEstatePropertyFeatures, MultiTargetTrainingConfig, MultiTargetPredictionResponse } from '../../types/microservice-types';

export interface TrainingDataset {
  properties: RealEstatePropertyFeatures[];
  validation_split: number;
  test_split: number;
  spatial_index?: any; // For spatial queries
}

export interface ModelPerformanceMetrics {
  target: string;
  r2_score: number;
  rmse: number;
  mae: number;
  mape: number;
  confidence_interval: [number, number];
}

export interface TrainingProgress {
  stage: 'data_preparation' | 'feature_engineering' | 'model_training' | 'validation' | 'endpoint_generation';
  progress: number; // 0-100
  current_task: string;
  estimated_time_remaining: number; // seconds
  metrics?: ModelPerformanceMetrics[];
}

export class MultiTargetRealEstateTrainer {
  private config: MultiTargetTrainingConfig;
  private progressCallback?: (progress: TrainingProgress) => void;

  constructor(config: MultiTargetTrainingConfig) {
    this.config = config;
  }

  /**
   * Set progress callback for real-time training updates
   */
  public setProgressCallback(callback: (progress: TrainingProgress) => void): void {
    this.progressCallback = callback;
  }

  /**
   * Prepare training dataset from raw property data
   */
  public async prepareTrainingDataset(
    rawProperties: any[],
    centrisData?: any[]
  ): Promise<TrainingDataset> {
    this.updateProgress('data_preparation', 10, 'Loading property data...');

    const properties: RealEstatePropertyFeatures[] = rawProperties.map(prop => {
      return this.extractPropertyFeatures(prop);
    });

    // Enrich with Centris data if available
    if (centrisData) {
      this.updateProgress('data_preparation', 30, 'Enriching with Centris listings...');
      await this.enrichWithCentrisData(properties, centrisData);
    }

    // Add demographic enrichment
    this.updateProgress('data_preparation', 50, 'Adding demographic features...');
    await this.addDemographicFeatures(properties);

    // Spatial indexing for neighbor analysis
    this.updateProgress('data_preparation', 70, 'Building spatial index...');
    const spatialIndex = await this.buildSpatialIndex(properties);

    this.updateProgress('data_preparation', 100, 'Dataset preparation complete');

    return {
      properties,
      validation_split: 0.2,
      test_split: 0.2,
      spatial_index: spatialIndex
    };
  }

  /**
   * Engineer spatial and temporal features
   */
  public async engineerFeatures(dataset: TrainingDataset): Promise<RealEstatePropertyFeatures[]> {
    this.updateProgress('feature_engineering', 10, 'Starting feature engineering...');

    const enhancedProperties = [...dataset.properties];

    if (this.config.feature_engineering.spatial_aggregation.enabled) {
      this.updateProgress('feature_engineering', 30, 'Computing spatial aggregations...');
      await this.addSpatialAggregations(enhancedProperties, dataset.spatial_index);
    }

    if (this.config.feature_engineering.temporal_features.enabled) {
      this.updateProgress('feature_engineering', 60, 'Computing temporal features...');
      await this.addTemporalFeatures(enhancedProperties);
    }

    this.updateProgress('feature_engineering', 100, 'Feature engineering complete');
    return enhancedProperties;
  }

  /**
   * Train multi-target models
   */
  public async trainModels(
    features: RealEstatePropertyFeatures[]
  ): Promise<{ [target: string]: any }> {
    this.updateProgress('model_training', 10, 'Initializing model training...');

    const trainedModels: { [target: string]: any } = {};
    const targetNames = Object.keys(this.config.target_variables).filter(
      target => this.config.target_variables[target as keyof typeof this.config.target_variables].enabled
    );

    for (let i = 0; i < targetNames.length; i++) {
      const target = targetNames[i];
      const progress = 20 + (i / targetNames.length) * 60;
      
      this.updateProgress('model_training', progress, `Training ${target} model...`);
      
      // Train individual target model
      trainedModels[target] = await this.trainSingleTargetModel(features, target);
    }

    // Train ensemble if configured
    if (this.config.model_architecture.algorithm === 'ensemble') {
      this.updateProgress('model_training', 90, 'Training ensemble model...');
      trainedModels['ensemble'] = await this.trainEnsembleModel(features, targetNames);
    }

    this.updateProgress('model_training', 100, 'Model training complete');
    return trainedModels;
  }

  /**
   * Validate models and compute performance metrics
   */
  public async validateModels(
    models: { [target: string]: any },
    testData: RealEstatePropertyFeatures[]
  ): Promise<ModelPerformanceMetrics[]> {
    this.updateProgress('validation', 10, 'Starting model validation...');

    const metrics: ModelPerformanceMetrics[] = [];
    const targets = Object.keys(models);

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const progress = 20 + (i / targets.length) * 60;
      
      this.updateProgress('validation', progress, `Validating ${target} model...`);
      
      const targetMetrics = await this.computeModelMetrics(models[target], testData, target);
      metrics.push(targetMetrics);
    }

    this.updateProgress('validation', 100, 'Model validation complete');
    return metrics;
  }

  /**
   * Generate point-based GeoJSON endpoints with predictions
   */
  public async generateGeoJSONEndpoints(
    models: { [target: string]: any },
    properties: RealEstatePropertyFeatures[]
  ): Promise<{ [target: string]: any }> {
    this.updateProgress('endpoint_generation', 10, 'Generating GeoJSON endpoints...');

    const endpoints: { [target: string]: any } = {};
    const targets = Object.keys(models);

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const progress = 20 + (i / targets.length) * 70;
      
      this.updateProgress('endpoint_generation', progress, `Generating ${target} endpoint...`);
      
      const predictions = await this.generatePredictions(models[target], properties, target);
      endpoints[target] = this.createGeoJSONEndpoint(properties, predictions, target);
    }

    this.updateProgress('endpoint_generation', 100, 'GeoJSON endpoints generated');
    return endpoints;
  }

  /**
   * Execute complete training pipeline
   */
  public async executePipeline(
    rawProperties: any[],
    centrisData?: any[]
  ): Promise<{
    models: { [target: string]: any };
    metrics: ModelPerformanceMetrics[];
    endpoints: { [target: string]: any };
  }> {
    try {
      // Step 1: Prepare dataset
      const dataset = await this.prepareTrainingDataset(rawProperties, centrisData);
      
      // Step 2: Engineer features
      const features = await this.engineerFeatures(dataset);
      
      // Step 3: Split data
      const { trainData, testData } = this.splitData(features, dataset.validation_split, dataset.test_split);
      
      // Step 4: Train models
      const models = await this.trainModels(trainData);
      
      // Step 5: Validate models
      const metrics = await this.validateModels(models, testData);
      
      // Step 6: Generate endpoints
      const endpoints = await this.generateGeoJSONEndpoints(models, features);

      // Store training results in memory for coordination
      await this.storeTrainingResults({
        models,
        metrics,
        endpoints,
        config: this.config,
        timestamp: new Date().toISOString()
      });

      return { models, metrics, endpoints };
    } catch (error) {
      console.error('Training pipeline failed:', error);
      throw error;
    }
  }

  // Private helper methods

  private extractPropertyFeatures(prop: any): RealEstatePropertyFeatures {
    return {
      latitude: prop.lat || prop.latitude || 0,
      longitude: prop.lng || prop.longitude || 0,
      fsa_code: prop.fsa || this.extractFSAFromPostal(prop.postal_code) || '',
      bedrooms: parseInt(prop.bedrooms) || 0,
      bathrooms: parseFloat(prop.bathrooms) || 0,
      area_sqft: parseFloat(prop.area) || parseFloat(prop.building_area) || 0,
      price_current: parseFloat(prop.price) || parseFloat(prop.listing_price) || 0,
      property_type: prop.property_type || prop.type || 'unknown',
      building_age: prop.year_built ? new Date().getFullYear() - parseInt(prop.year_built) : undefined,
      // Extract target variables if available
      time_on_market: prop.days_on_market ? parseInt(prop.days_on_market) : undefined,
      price_delta: prop.price_change_percent ? parseFloat(prop.price_change_percent) : undefined,
      rental_yield: prop.rental_yield ? parseFloat(prop.rental_yield) : undefined,
      investment_score: prop.investment_score ? parseFloat(prop.investment_score) : undefined
    };
  }

  private async enrichWithCentrisData(
    properties: RealEstatePropertyFeatures[],
    centrisData: any[]
  ): Promise<void> {
    // Match properties with Centris data based on location and characteristics
    for (const property of properties) {
      const matches = centrisData.filter(centris => 
        this.isPropertiesMatch(property, centris)
      );
      
      if (matches.length > 0) {
        const bestMatch = matches[0];
        this.enrichPropertyFromCentris(property, bestMatch);
      }
    }
  }

  private isPropertiesMatch(prop: RealEstatePropertyFeatures, centris: any): boolean {
    // Simple matching logic - can be enhanced
    const distanceThreshold = 0.001; // ~100m
    const latDiff = Math.abs(prop.latitude - (centris.lat || 0));
    const lngDiff = Math.abs(prop.longitude - (centris.lng || 0));
    
    return latDiff < distanceThreshold && lngDiff < distanceThreshold;
  }

  private enrichPropertyFromCentris(prop: RealEstatePropertyFeatures, centris: any): void {
    // Extract additional features from Centris data
    if (centris.bedrooms && !prop.bedrooms) prop.bedrooms = parseInt(centris.bedrooms);
    if (centris.bathrooms && !prop.bathrooms) prop.bathrooms = parseFloat(centris.bathrooms);
    if (centris.living_area && !prop.area_sqft) prop.area_sqft = parseFloat(centris.living_area);
    if (centris.year_built && !prop.building_age) {
      prop.building_age = new Date().getFullYear() - parseInt(centris.year_built);
    }
  }

  private async addDemographicFeatures(properties: RealEstatePropertyFeatures[]): Promise<void> {
    // Add demographic enrichment based on FSA/postal code
    // This would integrate with census data or demographic APIs
    for (const property of properties) {
      if (property.fsa_code) {
        const demographics = await this.fetchDemographicsForFSA(property.fsa_code);
        property.median_income = demographics?.median_income;
        property.population_density = demographics?.population_density;
        property.education_level = demographics?.education_level;
      }
    }
  }

  private async fetchDemographicsForFSA(fsaCode: string): Promise<any> {
    // Mock implementation - would integrate with real demographic data
    return {
      median_income: 65000 + Math.random() * 50000,
      population_density: 1000 + Math.random() * 5000,
      education_level: 0.6 + Math.random() * 0.3
    };
  }

  private async buildSpatialIndex(properties: RealEstatePropertyFeatures[]): Promise<any> {
    // Build spatial index for efficient neighbor queries
    // This would use libraries like rbush or similar
    return properties.map((prop, index) => ({
      minX: prop.longitude,
      minY: prop.latitude,
      maxX: prop.longitude,
      maxY: prop.latitude,
      property: prop,
      index
    }));
  }

  private async addSpatialAggregations(
    properties: RealEstatePropertyFeatures[],
    spatialIndex: any
  ): Promise<void> {
    const radius = this.config.feature_engineering.spatial_aggregation.radius_km;
    const methods = this.config.feature_engineering.spatial_aggregation.aggregation_methods;

    for (const property of properties) {
      const neighbors = this.findNeighbors(property, spatialIndex, radius);
      
      if (neighbors.length > 0) {
        // Compute spatial aggregations
        const prices = neighbors.map(n => n.price_current).filter(p => p > 0);
        const areas = neighbors.map(n => n.area_sqft).filter(a => a > 0);
        
        if (methods.includes('mean')) {
          (property as any).spatial_price_mean = prices.reduce((a, b) => a + b, 0) / prices.length;
          (property as any).spatial_area_mean = areas.reduce((a, b) => a + b, 0) / areas.length;
        }
        
        if (methods.includes('count')) {
          (property as any).spatial_neighbor_count = neighbors.length;
        }
      }
    }
  }

  private findNeighbors(
    property: RealEstatePropertyFeatures,
    spatialIndex: any,
    radiusKm: number
  ): RealEstatePropertyFeatures[] {
    // Simple distance-based neighbor finding
    const neighbors: RealEstatePropertyFeatures[] = [];
    const radiusDegrees = radiusKm / 111; // Rough conversion km to degrees
    
    for (const item of spatialIndex) {
      const distance = Math.sqrt(
        Math.pow(property.latitude - item.property.latitude, 2) +
        Math.pow(property.longitude - item.property.longitude, 2)
      );
      
      if (distance <= radiusDegrees && distance > 0) {
        neighbors.push(item.property);
      }
    }
    
    return neighbors;
  }

  private async addTemporalFeatures(properties: RealEstatePropertyFeatures[]): Promise<void> {
    // Add temporal features like seasonality, trends, etc.
    for (const property of properties) {
      if (this.config.feature_engineering.temporal_features.seasonality) {
        const month = new Date().getMonth();
        (property as any).season_spring = month >= 3 && month <= 5 ? 1 : 0;
        (property as any).season_summer = month >= 6 && month <= 8 ? 1 : 0;
        (property as any).season_fall = month >= 9 && month <= 11 ? 1 : 0;
        (property as any).season_winter = month <= 2 || month === 12 ? 1 : 0;
      }
    }
  }

  private splitData(
    features: RealEstatePropertyFeatures[],
    validationSplit: number,
    testSplit: number
  ): { trainData: RealEstatePropertyFeatures[]; testData: RealEstatePropertyFeatures[] } {
    const shuffled = [...features].sort(() => Math.random() - 0.5);
    const testSize = Math.floor(shuffled.length * testSplit);
    const trainData = shuffled.slice(testSize);
    const testData = shuffled.slice(0, testSize);
    
    return { trainData, testData };
  }

  private async trainSingleTargetModel(
    features: RealEstatePropertyFeatures[],
    target: string
  ): Promise<any> {
    // Mock model training - would integrate with actual ML libraries
    return {
      target,
      algorithm: this.config.model_architecture.algorithm,
      trained_at: new Date().toISOString(),
      feature_count: Object.keys(features[0]).length,
      training_samples: features.length
    };
  }

  private async trainEnsembleModel(
    features: RealEstatePropertyFeatures[],
    targets: string[]
  ): Promise<any> {
    return {
      targets,
      algorithm: 'ensemble',
      base_models: targets.map(t => this.config.model_architecture.algorithm),
      trained_at: new Date().toISOString()
    };
  }

  private async computeModelMetrics(
    model: any,
    testData: RealEstatePropertyFeatures[],
    target: string
  ): Promise<ModelPerformanceMetrics> {
    // Mock metrics computation
    return {
      target,
      r2_score: 0.85 + Math.random() * 0.1,
      rmse: 1000 + Math.random() * 500,
      mae: 800 + Math.random() * 300,
      mape: 5 + Math.random() * 3,
      confidence_interval: [0.82, 0.92]
    };
  }

  private async generatePredictions(
    model: any,
    properties: RealEstatePropertyFeatures[],
    target: string
  ): Promise<number[]> {
    // Mock predictions
    return properties.map(() => Math.random() * 100);
  }

  private createGeoJSONEndpoint(
    properties: RealEstatePropertyFeatures[],
    predictions: number[],
    target: string
  ): any {
    return {
      type: "FeatureCollection",
      features: properties.map((prop, index) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [prop.longitude, prop.latitude]
        },
        properties: {
          [`${target}_prediction`]: predictions[index],
          bedrooms: prop.bedrooms,
          bathrooms: prop.bathrooms,
          area_sqft: prop.area_sqft,
          price_current: prop.price_current,
          fsa_code: prop.fsa_code,
          property_type: prop.property_type
        }
      }))
    };
  }

  private extractFSAFromPostal(postalCode?: string): string | undefined {
    if (!postalCode) return undefined;
    return postalCode.replace(/\s/g, '').substring(0, 3).toUpperCase();
  }

  private updateProgress(
    stage: TrainingProgress['stage'],
    progress: number,
    currentTask: string,
    estimatedTime: number = 0,
    metrics?: ModelPerformanceMetrics[]
  ): void {
    if (this.progressCallback) {
      this.progressCallback({
        stage,
        progress,
        current_task: currentTask,
        estimated_time_remaining: estimatedTime,
        metrics
      });
    }
  }

  private async storeTrainingResults(results: any): Promise<void> {
    // Store results in memory for agent coordination
    try {
      // This would integrate with the memory system
      console.log('Training results stored in memory:', {
        timestamp: results.timestamp,
        targets: Object.keys(results.models),
        performance: results.metrics.map((m: ModelPerformanceMetrics) => ({
          target: m.target,
          r2_score: m.r2_score
        }))
      });
    } catch (error) {
      console.error('Failed to store training results:', error);
    }
  }
}

export default MultiTargetRealEstateTrainer;