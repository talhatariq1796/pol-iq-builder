/**
 * Data Enrichment Service (Legacy Real Estate Code)
 *
 * Handles loading demographic data and enriching real estate properties
 * with demographic context for multi-scale analysis.
 *
 * Note: This service was migrated from Quebec Real Estate CMA platform.
 * For political analysis, use PoliticalDataService instead.
 *
 * Part of the simplified no-ArcGIS strategy implementation.
 */

import { 
  FSADemographics, 
  EnrichedPropertyPoint, 
  PropertyAddress,
  enrichRealEstateData,
  aggregatePropertiesByFSA,
  createMLTrainingDataset,
  generateFSAReport,
  MLTrainingRecord,
  FSAAggregation
} from '../utils/fsa-extraction';

export interface DataEnrichmentConfig {
  fsaDataSource: 'static' | 'database' | 'api';
  fsaDataPath?: string;
  databaseConnectionString?: string;
  apiEndpoint?: string;
  cacheEnabled?: boolean;
  cacheTTL?: number; // minutes
}

export interface EnrichmentResult {
  enrichedProperties: EnrichedPropertyPoint[];
  fsaAggregations: FSAAggregation[];
  mlTrainingData: MLTrainingRecord[];
  coverageReport: ReturnType<typeof generateFSAReport>;
  processingStats: {
    totalProcessed: number;
    successfulEnrichments: number;
    failedExtractions: number;
    processingTimeMs: number;
  };
}

export class DataEnrichmentService {
  private fsaCache: Map<string, FSADemographics> = new Map();
  private cacheTimestamp: number = 0;
  private config: DataEnrichmentConfig;

  constructor(config: DataEnrichmentConfig = { fsaDataSource: 'static' }) {
    this.config = {
      cacheEnabled: true,
      cacheTTL: 60, // 1 hour default
      ...config
    };
  }

  /**
   * Main enrichment method - processes properties and returns complete analysis
   */
  async enrichRealEstateData(properties: PropertyAddress[]): Promise<EnrichmentResult> {
    const startTime = performance.now();

    try {
      // Load FSA demographic data
      const demographics = await this.loadFSADemographics();

      // Enrich properties with FSA and demographic data
      const enrichedProperties = enrichRealEstateData(properties, demographics);

      // Generate FSA-level aggregations for analysis
      const fsaAggregations = aggregatePropertiesByFSA(enrichedProperties);

      // Create ML training dataset
      const mlTrainingData = createMLTrainingDataset(fsaAggregations);

      // Generate coverage report
      const coverageReport = generateFSAReport(enrichedProperties);

      const endTime = performance.now();
      const processingTimeMs = endTime - startTime;

      // Calculate processing stats
      const successfulEnrichments = enrichedProperties.filter(p => p.fsa_code && p.fsa_demographics).length;
      const failedExtractions = enrichedProperties.filter(p => !p.fsa_code).length;

      return {
        enrichedProperties,
        fsaAggregations,
        mlTrainingData,
        coverageReport,
        processingStats: {
          totalProcessed: properties.length,
          successfulEnrichments,
          failedExtractions,
          processingTimeMs
        }
      };
    } catch (error) {
      console.error('Error in data enrichment:', error);
      throw new Error(`Data enrichment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Loads FSA demographic data from configured source
   */
  private async loadFSADemographics(): Promise<FSADemographics[]> {
    // Check cache first
    if (this.config.cacheEnabled && this.isCacheValid()) {
      return Array.from(this.fsaCache.values());
    }

    let demographics: FSADemographics[];

    switch (this.config.fsaDataSource) {
      case 'static':
        demographics = await this.loadFromStaticFile();
        break;
      case 'database':
        demographics = await this.loadFromDatabase();
        break;
      case 'api':
        demographics = await this.loadFromAPI();
        break;
      default:
        throw new Error(`Unsupported FSA data source: ${this.config.fsaDataSource}`);
    }

    // Update cache
    if (this.config.cacheEnabled) {
      this.updateCache(demographics);
    }

    return demographics;
  }

  /**
   * Load FSA demographics from static JSON file
   */
  private async loadFromStaticFile(): Promise<FSADemographics[]> {
    const filePath = this.config.fsaDataPath || '/data/fsa_demographics.json';
    
    try {
      // In a real implementation, this would use Node.js fs module or fetch for browser
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`Failed to load FSA data: ${response.statusText}`);
      }
      
      const data = await response.json();
      return this.validateFSAData(data);
    } catch (error) {
      console.error('Error loading FSA data from static file:', error);

      // Production mode requires real data
      if (process.env.NODE_ENV === 'production') {
        console.error('Database required in production mode');
        throw new Error('Database connection required in production');
      }

      // Fallback to sample data for development
      console.warn('Development mode: using sample data');
      return this.getSampleFSAData();
    }
  }

  /**
   * Load FSA demographics from database
   */
  private async loadFromDatabase(): Promise<FSADemographics[]> {
    // Placeholder for database integration
    // In a real implementation, this would connect to your database

    // Production mode requires real database implementation
    if (process.env.NODE_ENV === 'production') {
      console.error('Database required in production mode');
      throw new Error('Database connection required in production');
    }

    console.warn('Development mode: Database loading not implemented, using sample data');
    return this.getSampleFSAData();
  }

  /**
   * Load FSA demographics from API endpoint
   */
  private async loadFromAPI(): Promise<FSADemographics[]> {
    const endpoint = this.config.apiEndpoint || '/api/fsa-demographics';
    
    try {
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      return this.validateFSAData(data);
    } catch (error) {
      console.error('Error loading FSA data from API:', error);

      // Production mode requires real data
      if (process.env.NODE_ENV === 'production') {
        console.error('API connection required in production mode');
        throw new Error('API connection required in production');
      }

      console.warn('Development mode: using sample data');
      return this.getSampleFSAData();
    }
  }

  /**
   * Validates FSA demographic data structure
   */
  private validateFSAData(data: any[]): FSADemographics[] {
    if (!Array.isArray(data)) {
      throw new Error('FSA data must be an array');
    }

    return data.map((item, index) => {
      const required = ['fsa_code', 'population', 'median_income', 'avg_dwelling_value', 'total_dwellings'];
      
      for (const field of required) {
        if (!(field in item) || typeof item[field] !== 'number' && field !== 'fsa_code') {
          throw new Error(`Invalid FSA data at index ${index}: missing or invalid ${field}`);
        }
      }

      return {
        fsa_code: item.fsa_code.toUpperCase(),
        population: item.population,
        median_income: item.median_income,
        avg_dwelling_value: item.avg_dwelling_value,
        total_dwellings: item.total_dwellings,
        unemployment_rate: item.unemployment_rate || 0,
        avg_household_size: item.avg_household_size || 2.5,
        education_bachelor_plus_pct: item.education_bachelor_plus_pct
      };
    });
  }

  /**
   * @deprecated This service contains legacy real estate sample data and should not be used.
   * For political analysis, use PoliticalDataService instead.
   *
   * This method previously returned sample Ingham County ZIP demographics.
   * Sample data has been removed as part of P1-28 cleanup.
   */
  private getSampleFSAData(): FSADemographics[] {
    throw new Error(
      'DataEnrichmentService.getSampleFSAData: This legacy real estate service is deprecated. ' +
      'Sample data has been removed. For political analysis, use PoliticalDataService instead. ' +
      'If you need real FSA/ZIP demographic data, configure a valid data source (static file, database, or API).'
    );
  }

  /**
   * Cache management methods
   */
  private isCacheValid(): boolean {
    if (!this.config.cacheEnabled || this.fsaCache.size === 0) {
      return false;
    }

    const cacheAgeMinutes = (Date.now() - this.cacheTimestamp) / (1000 * 60);
    return cacheAgeMinutes < (this.config.cacheTTL || 60);
  }

  private updateCache(demographics: FSADemographics[]): void {
    this.fsaCache.clear();
    demographics.forEach(demo => {
      this.fsaCache.set(demo.fsa_code, demo);
    });
    this.cacheTimestamp = Date.now();
  }

  /**
   * Utility methods for specific analysis needs
   */

  /**
   * Get enriched properties for a specific FSA
   */
  async getPropertiesByFSA(properties: PropertyAddress[], fsaCode: string): Promise<EnrichedPropertyPoint[]> {
    const result = await this.enrichRealEstateData(properties);
    return result.enrichedProperties.filter(p => p.fsa_code === fsaCode.toUpperCase());
  }

  /**
   * Get FSA aggregation for a specific FSA
   */
  async getFSAAnalysis(properties: PropertyAddress[], fsaCode: string): Promise<FSAAggregation | null> {
    const result = await this.enrichRealEstateData(properties);
    return result.fsaAggregations.find(agg => agg.fsa_code === fsaCode.toUpperCase()) || null;
  }

  /**
   * Get ML training data filtered by criteria
   */
  async getFilteredMLData(
    properties: PropertyAddress[], 
    filters: {
      minPropertyCount?: number;
      maxUnemploymentRate?: number;
      minMedianIncome?: number;
    }
  ): Promise<MLTrainingRecord[]> {
    const result = await this.enrichRealEstateData(properties);
    
    return result.mlTrainingData.filter(record => {
      if (filters.minPropertyCount && record.property_count < filters.minPropertyCount) {
        return false;
      }
      if (filters.maxUnemploymentRate && record.unemployment_rate > filters.maxUnemploymentRate) {
        return false;
      }
      if (filters.minMedianIncome && record.median_income < filters.minMedianIncome) {
        return false;
      }
      return true;
    });
  }

  /**
   * Clear cache manually
   */
  clearCache(): void {
    this.fsaCache.clear();
    this.cacheTimestamp = 0;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; ageMinutes: number; isValid: boolean } {
    const ageMinutes = this.cacheTimestamp > 0 ? (Date.now() - this.cacheTimestamp) / (1000 * 60) : 0;
    return {
      size: this.fsaCache.size,
      ageMinutes,
      isValid: this.isCacheValid()
    };
  }
}