/**
 * Real Estate Data Processing Pipeline
 * 
 * Handles data loading, cleaning, and preparation for ML training
 * with specific support for Centris MLS data and property enrichment.
 */

import { RealEstatePropertyFeatures } from '../../types/microservice-types';

export interface DataProcessingConfig {
  centris_data_path?: string;
  property_data_path?: string;
  demographic_enrichment: boolean;
  spatial_clustering: boolean;
  outlier_detection: boolean;
  missing_value_strategy: 'drop' | 'mean' | 'median' | 'interpolate';
  validation_rules: {
    min_price: number;
    max_price: number;
    min_area: number;
    max_area: number;
    required_fields: string[];
  };
}

export interface DataQualityReport {
  total_records: number;
  valid_records: number;
  invalid_records: number;
  missing_value_stats: Record<string, number>;
  outlier_stats: Record<string, number>;
  data_quality_score: number; // 0-100
  recommendations: string[];
}

export class RealEstateDataProcessor {
  private config: DataProcessingConfig;

  constructor(config: DataProcessingConfig) {
    this.config = config;
  }

  /**
   * Load and process Centris MLS data
   */
  public async loadCentrisData(filePath: string): Promise<any[]> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      const fullPath = path.resolve(filePath);
      const rawData = fs.readFileSync(fullPath, 'utf-8');
      const centrisData = JSON.parse(rawData);

      console.log(`Loaded ${centrisData.length} Centris listings`);
      return this.processCentrisListings(centrisData);
    } catch (error) {
      console.error('Failed to load Centris data:', error);
      throw error;
    }
  }

  /**
   * Load property data from various sources
   */
  public async loadPropertyData(sources: string[]): Promise<RealEstatePropertyFeatures[]> {
    const allProperties: RealEstatePropertyFeatures[] = [];

    for (const source of sources) {
      try {
        const properties = await this.loadDataFromSource(source);
        allProperties.push(...properties);
      } catch (error) {
        console.error(`Failed to load data from ${source}:`, error);
      }
    }

    return this.deduplicateProperties(allProperties);
  }

  /**
   * Clean and validate property data
   */
  public async cleanData(
    properties: RealEstatePropertyFeatures[]
  ): Promise<{ cleanedData: RealEstatePropertyFeatures[]; qualityReport: DataQualityReport }> {
    
    const qualityReport = this.generateDataQualityReport(properties);
    let cleanedData = [...properties];

    // Step 1: Handle missing values
    cleanedData = await this.handleMissingValues(cleanedData);

    // Step 2: Remove/fix outliers
    if (this.config.outlier_detection) {
      cleanedData = await this.handleOutliers(cleanedData);
    }

    // Step 3: Validate against business rules
    cleanedData = this.validateBusinessRules(cleanedData);

    // Step 4: Standardize formats
    cleanedData = this.standardizeFormats(cleanedData);

    const finalQualityReport = this.generateDataQualityReport(cleanedData);

    return { 
      cleanedData, 
      qualityReport: {
        ...qualityReport,
        valid_records: cleanedData.length,
        data_quality_score: this.calculateQualityScore(cleanedData)
      }
    };
  }

  /**
   * Enrich properties with demographic and spatial data
   */
  public async enrichProperties(
    properties: RealEstatePropertyFeatures[]
  ): Promise<RealEstatePropertyFeatures[]> {
    if (!this.config.demographic_enrichment) {
      return properties;
    }

    const enrichedProperties = [];

    for (const property of properties) {
      const enriched = { ...property };

      // Add demographic data
      if (property.fsa_code) {
        const demographics = await this.fetchDemographicsForFSA(property.fsa_code);
        Object.assign(enriched, demographics);
      }

      // Add spatial features
      const spatialFeatures = await this.computeSpatialFeatures(property, properties);
      Object.assign(enriched, spatialFeatures);

      enrichedProperties.push(enriched);
    }

    return enrichedProperties;
  }

  /**
   * Create training targets from property data
   */
  public async generateTrainingTargets(
    properties: RealEstatePropertyFeatures[]
  ): Promise<RealEstatePropertyFeatures[]> {
    
    return properties.map(property => {
      const enhanced = { ...property };

      // Generate time_on_market if not available
      if (!enhanced.time_on_market) {
        enhanced.time_on_market = this.estimateTimeOnMarket(property);
      }

      // Calculate price_delta if price history available
      if (!enhanced.price_delta && property.price_history) {
        enhanced.price_delta = this.calculatePriceDelta(property);
      }

      // Estimate rental_yield
      if (!enhanced.rental_yield) {
        enhanced.rental_yield = this.estimateRentalYield(property);
      }

      // Calculate investment_score
      if (!enhanced.investment_score) {
        enhanced.investment_score = this.calculateInvestmentScore(property);
      }

      return enhanced;
    });
  }

  // Private helper methods

  private processCentrisListings(rawData: any[]): any[] {
    return rawData.map(listing => ({
      centris_no: listing.centris_no,
      lat: parseFloat(listing.lat),
      lng: parseFloat(listing.lng),
      price: parseFloat(listing.price?.replace(/[,$]/g, '') || '0'),
      bedrooms: parseInt(listing.bedrooms) || 0,
      bathrooms: parseFloat(listing.bathrooms) || 0,
      living_area: parseFloat(listing.living_area) || 0,
      lot_area: parseFloat(listing.lot_area) || 0,
      year_built: parseInt(listing.year_built) || null,
      property_type: listing.property_type || 'unknown',
      city: listing.city,
      region: listing.region,
      postal_code: listing.postal_code,
      listing_date: listing.listing_date,
      days_on_market: parseInt(listing.days_on_market) || null,
      // Extract additional Centris-specific fields
      building_style: listing.building_style,
      heating_system: listing.heating_system,
      parking_spots: parseInt(listing.parking_spots) || 0,
      basement_type: listing.basement_type,
      roof_type: listing.roof_type
    }));
  }

  private async loadDataFromSource(source: string): Promise<RealEstatePropertyFeatures[]> {
    // Implementation depends on source type (JSON, CSV, API, etc.)
    if (source.endsWith('.json')) {
      return this.loadJSONData(source);
    } else if (source.endsWith('.csv')) {
      return this.loadCSVData(source);
    } else {
      throw new Error(`Unsupported data source format: ${source}`);
    }
  }

  private async loadJSONData(filePath: string): Promise<RealEstatePropertyFeatures[]> {
    const fs = await import('fs');
    const rawData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    return rawData.map((item: any) => this.convertToPropertyFeatures(item));
  }

  private async loadCSVData(filePath: string): Promise<RealEstatePropertyFeatures[]> {
    // Mock CSV loading - would use a proper CSV parser
    const fs = await import('fs');
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const headers = lines[0].split(',');
    
    return lines.slice(1).map(line => {
      const values = line.split(',');
      const item: any = {};
      headers.forEach((header, index) => {
        item[header.trim()] = values[index]?.trim();
      });
      return this.convertToPropertyFeatures(item);
    });
  }

  private convertToPropertyFeatures(item: any): RealEstatePropertyFeatures {
    return {
      latitude: parseFloat(item.lat || item.latitude || '0'),
      longitude: parseFloat(item.lng || item.longitude || '0'),
      fsa_code: item.fsa || this.extractFSAFromPostal(item.postal_code) || '',
      bedrooms: parseInt(item.bedrooms || '0'),
      bathrooms: parseFloat(item.bathrooms || '0'),
      area_sqft: parseFloat(item.area || item.living_area || '0'),
      price_current: parseFloat(item.price?.toString().replace(/[,$]/g, '') || '0'),
      property_type: item.property_type || 'unknown',
      building_age: item.year_built ? new Date().getFullYear() - parseInt(item.year_built) : undefined
    };
  }

  private deduplicateProperties(properties: RealEstatePropertyFeatures[]): RealEstatePropertyFeatures[] {
    const seen = new Set<string>();
    const unique: RealEstatePropertyFeatures[] = [];

    for (const property of properties) {
      const key = `${property.latitude}_${property.longitude}_${property.price_current}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(property);
      }
    }

    return unique;
  }

  private generateDataQualityReport(properties: RealEstatePropertyFeatures[]): DataQualityReport {
    const totalRecords = properties.length;
    const missingValueStats: Record<string, number> = {};
    const outlierStats: Record<string, number> = {};

    // Analyze missing values
    const fields = ['latitude', 'longitude', 'bedrooms', 'bathrooms', 'area_sqft', 'price_current'];
    for (const field of fields) {
      const missing = properties.filter(p => 
        (p as any)[field] === undefined || (p as any)[field] === null || (p as any)[field] === 0
      ).length;
      missingValueStats[field] = (missing / totalRecords) * 100;
    }

    // Analyze outliers (simple z-score approach)
    for (const field of ['price_current', 'area_sqft']) {
      const values = properties.map(p => (p as any)[field]).filter(v => v > 0);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const std = Math.sqrt(values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length);
      
      const outliers = values.filter(v => Math.abs(v - mean) > 3 * std).length;
      outlierStats[field] = (outliers / totalRecords) * 100;
    }

    const validRecords = this.countValidRecords(properties);
    const qualityScore = (validRecords / totalRecords) * 100;

    return {
      total_records: totalRecords,
      valid_records: validRecords,
      invalid_records: totalRecords - validRecords,
      missing_value_stats: missingValueStats,
      outlier_stats: outlierStats,
      data_quality_score: qualityScore,
      recommendations: this.generateRecommendations(missingValueStats, outlierStats, qualityScore)
    };
  }

  private countValidRecords(properties: RealEstatePropertyFeatures[]): number {
    return properties.filter(property => 
      property.latitude > 0 &&
      property.longitude !== 0 &&
      property.price_current > this.config.validation_rules.min_price &&
      property.price_current < this.config.validation_rules.max_price &&
      property.area_sqft > this.config.validation_rules.min_area
    ).length;
  }

  private generateRecommendations(
    missingStats: Record<string, number>,
    outlierStats: Record<string, number>,
    qualityScore: number
  ): string[] {
    const recommendations: string[] = [];

    if (qualityScore < 70) {
      recommendations.push('Data quality is below acceptable threshold. Consider data source validation.');
    }

    Object.entries(missingStats).forEach(([field, percentage]) => {
      if (percentage > 20) {
        recommendations.push(`High missing values in ${field} (${percentage.toFixed(1)}%). Consider imputation strategies.`);
      }
    });

    Object.entries(outlierStats).forEach(([field, percentage]) => {
      if (percentage > 10) {
        recommendations.push(`High outlier rate in ${field} (${percentage.toFixed(1)}%). Review data collection process.`);
      }
    });

    return recommendations;
  }

  private async handleMissingValues(properties: RealEstatePropertyFeatures[]): Promise<RealEstatePropertyFeatures[]> {
    const strategy = this.config.missing_value_strategy;
    
    if (strategy === 'drop') {
      return properties.filter(p => this.isCompleteRecord(p));
    }

    return properties.map(property => {
      const filled = { ...property };
      
      if (strategy === 'mean' || strategy === 'median') {
        this.fillNumericalMissingValues(filled, properties, strategy);
      }
      
      return filled;
    });
  }

  private isCompleteRecord(property: RealEstatePropertyFeatures): boolean {
    const required = this.config.validation_rules.required_fields;
    return required.every(field => (property as any)[field] !== undefined && (property as any)[field] !== null);
  }

  private fillNumericalMissingValues(
    property: RealEstatePropertyFeatures,
    allProperties: RealEstatePropertyFeatures[],
    strategy: 'mean' | 'median'
  ): void {
    const numericalFields = ['bedrooms', 'bathrooms', 'area_sqft', 'building_age'];
    
    for (const field of numericalFields) {
      if ((property as any)[field] === undefined || (property as any)[field] === null || (property as any)[field] === 0) {
        const values = allProperties.map(p => (p as any)[field]).filter(v => v !== undefined && v !== null && v > 0);
        
        if (values.length > 0) {
          if (strategy === 'mean') {
            (property as any)[field] = values.reduce((a, b) => a + b, 0) / values.length;
          } else {
            values.sort((a, b) => a - b);
            (property as any)[field] = values[Math.floor(values.length / 2)];
          }
        }
      }
    }
  }

  private async handleOutliers(properties: RealEstatePropertyFeatures[]): Promise<RealEstatePropertyFeatures[]> {
    return properties.filter(property => {
      // Remove extreme outliers based on business rules
      return property.price_current >= this.config.validation_rules.min_price &&
             property.price_current <= this.config.validation_rules.max_price &&
             property.area_sqft >= this.config.validation_rules.min_area &&
             property.area_sqft <= this.config.validation_rules.max_area;
    });
  }

  private validateBusinessRules(properties: RealEstatePropertyFeatures[]): RealEstatePropertyFeatures[] {
    return properties.filter(property => {
      // Basic validation rules
      if (property.latitude === 0 || property.longitude === 0) return false;
      if (property.bedrooms < 0 || property.bedrooms > 20) return false;
      if (property.bathrooms < 0 || property.bathrooms > 20) return false;
      if (property.area_sqft <= 0 || property.area_sqft > 50000) return false;
      
      return true;
    });
  }

  private standardizeFormats(properties: RealEstatePropertyFeatures[]): RealEstatePropertyFeatures[] {
    return properties.map(property => ({
      ...property,
      fsa_code: property.fsa_code.toUpperCase(),
      property_type: property.property_type.toLowerCase(),
      latitude: Math.round(property.latitude * 1000000) / 1000000, // 6 decimal places
      longitude: Math.round(property.longitude * 1000000) / 1000000
    }));
  }

  private async fetchDemographicsForFSA(fsaCode: string): Promise<any> {
    // Mock demographic data - would integrate with real census/demographic APIs
    return {
      median_income: 55000 + Math.random() * 40000,
      population_density: 500 + Math.random() * 3000,
      education_level: 0.5 + Math.random() * 0.4,
      avg_age: 35 + Math.random() * 15,
      unemployment_rate: 0.03 + Math.random() * 0.07
    };
  }

  private async computeSpatialFeatures(
    property: RealEstatePropertyFeatures,
    allProperties: RealEstatePropertyFeatures[]
  ): Promise<any> {
    const neighbors = this.findNearbyProperties(property, allProperties, 1.0); // 1km radius
    
    if (neighbors.length === 0) return {};

    const prices = neighbors.map(n => n.price_current).filter(p => p > 0);
    const areas = neighbors.map(n => n.area_sqft).filter(a => a > 0);

    return {
      neighbor_count: neighbors.length,
      avg_neighbor_price: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
      median_neighbor_price: prices.length > 0 ? this.median(prices) : 0,
      avg_neighbor_area: areas.length > 0 ? areas.reduce((a, b) => a + b, 0) / areas.length : 0,
      price_per_sqft_neighborhood: prices.length > 0 && areas.length > 0 ? 
        (prices.reduce((a, b) => a + b, 0) / prices.length) / (areas.reduce((a, b) => a + b, 0) / areas.length) : 0
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

  // Target variable generation methods

  private estimateTimeOnMarket(property: RealEstatePropertyFeatures): number {
    // Estimate based on property characteristics
    let baseTime = 30; // Base 30 days
    
    // Adjust based on price range
    if (property.price_current > 500000) baseTime += 15;
    if (property.price_current > 1000000) baseTime += 30;
    
    // Adjust based on property type
    if (property.property_type === 'condo') baseTime -= 5;
    if (property.property_type === 'luxury') baseTime += 20;
    
    // Add some randomness
    return Math.max(1, baseTime + (Math.random() - 0.5) * 20);
  }

  private calculatePriceDelta(property: RealEstatePropertyFeatures): number {
    if (!property.price_history || property.price_history.length < 2) {
      return 0; // No price change data
    }
    
    const initialPrice = property.price_history[0];
    const currentPrice = property.price_current;
    
    return ((currentPrice - initialPrice) / initialPrice) * 100;
  }

  private estimateRentalYield(property: RealEstatePropertyFeatures): number {
    // Estimate based on property characteristics and market data
    let baseYield = 4.5; // Base 4.5% yield
    
    // Adjust based on property type
    if (property.property_type === 'condo') baseYield += 0.5;
    if (property.property_type === 'single_family') baseYield -= 0.3;
    
    // Adjust based on price range (higher prices = lower yields typically)
    if (property.price_current > 500000) baseYield -= 1.0;
    if (property.price_current > 1000000) baseYield -= 1.5;
    
    // Add randomness
    return Math.max(0.5, baseYield + (Math.random() - 0.5) * 2);
  }

  private calculateInvestmentScore(property: RealEstatePropertyFeatures): number {
    let score = 50; // Base score
    
    // Price per sqft factor
    const pricePerSqft = property.price_current / property.area_sqft;
    if (pricePerSqft < 200) score += 20;
    else if (pricePerSqft > 500) score -= 15;
    
    // Location factor (simplified)
    if (property.fsa_code.startsWith('M')) score += 10; // Toronto area premium
    if (property.fsa_code.startsWith('V')) score += 15; // Vancouver area premium
    
    // Property characteristics
    if (property.bedrooms >= 3) score += 5;
    if (property.bathrooms >= 2) score += 5;
    if (property.building_age && property.building_age < 10) score += 10;
    
    // Add randomness
    score += (Math.random() - 0.5) * 20;
    
    return Math.max(0, Math.min(100, score));
  }

  private extractFSAFromPostal(postalCode?: string): string {
    if (!postalCode) return '';
    return postalCode.replace(/\s/g, '').substring(0, 3).toUpperCase();
  }

  private calculateQualityScore(properties: RealEstatePropertyFeatures[]): number {
    const validCount = this.countValidRecords(properties);
    return (validCount / properties.length) * 100;
  }
}

export default RealEstateDataProcessor;