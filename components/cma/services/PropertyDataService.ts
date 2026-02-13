"use client";

import type { CMAProperty, CMAFilters, CMAStats, AreaSelection } from '../types';
import { InvestmentMetricsCalculator } from '@/lib/analysis/InvestmentMetricsCalculator';
import { PropertyTypeClassifier } from '@/lib/analysis/PropertyTypeClassifier';

export class PropertyDataService {
  private static instance: PropertyDataService;
  private properties: CMAProperty[] = [];
  private isLoaded = false;
  private cacheTimestamp: number | null = null;
  private readonly cacheTTL = 5 * 60 * 1000; // 5 minutes in milliseconds

  private constructor() {}

  static getInstance(): PropertyDataService {
    if (!PropertyDataService.instance) {
      PropertyDataService.instance = new PropertyDataService();
    }
    return PropertyDataService.instance;
  }

  /**
   * Validates cache by sampling multiple properties instead of just the first one.
   * Returns true if cache is valid, false if it should be invalidated.
   */
  private validateCacheSample(): boolean {
    if (!this.isLoaded || this.properties.length === 0) {
      return false;
    }

    // Check TTL-based expiration
    if (this.cacheTimestamp !== null) {
      const age = Date.now() - this.cacheTimestamp;
      if (age > this.cacheTTL) {
        console.log(`[PropertyDataService] Cache expired (age: ${Math.round(age / 1000)}s, TTL: ${this.cacheTTL / 1000}s)`);
        return false;
      }
    }

    // Sample first 5-10 properties (or all if fewer than 10)
    const sampleSize = Math.min(10, this.properties.length);
    const sample = this.properties.slice(0, sampleSize);

    // Count properties with missing required fields
    const invalidCount = sample.filter(prop => !prop.st || !prop.status).length;
    const invalidPercentage = (invalidCount / sampleSize) * 100;

    // Log validation results
    console.log(`[PropertyDataService] Cache validation: ${invalidCount}/${sampleSize} properties missing required fields (${invalidPercentage.toFixed(1)}%)`);

    // Invalidate only if >50% of sample is invalid
    if (invalidPercentage > 50) {
      console.log('[PropertyDataService] Cache invalidated - >50% of sample has missing status fields');
      return false;
    }

    return true;
  }

  async loadProperties(): Promise<CMAProperty[]> {
    // Validate cache using multi-property sampling
    if (!this.validateCacheSample()) {
      this.isLoaded = false;
      this.properties = [];
      this.cacheTimestamp = null;
    } else {
      console.log(`[PropertyDataService] Returning cached ${this.properties.length} properties`);
      return this.properties;
    }

    try {
      // Load blob URL mappings
      const blobUrlsResponse = await fetch('/data/blob-urls.json');
      if (!blobUrlsResponse.ok) {
        throw new Error('Failed to load blob URLs');
      }
      const blobUrls = await blobUrlsResponse.json();

      // Load all property types from blob storage (houses, condos, and revenue)
      const propertyUrls = [
        { url: blobUrls.property_single_family_active, type: 'house_active' },
        { url: blobUrls.property_single_family_sold, type: 'house_sold' },
        { url: blobUrls.property_condos_active, type: 'condo_active' },
        { url: blobUrls.property_condos_sold, type: 'condo_sold' },
        { url: blobUrls.property_revenue_active, type: 'revenue_active' },
        { url: blobUrls.property_revenue_sold, type: 'revenue_sold' },
      ];

      const allFeatures: any[] = [];
      
      // Fetch all property types in parallel
      await Promise.all(
        propertyUrls.map(async ({ url, type }) => {
          try {
            const response = await fetch(url);
            if (response.ok) {
              const geojsonData = await response.json();
              const features = geojsonData.features || [];
              
              // Tag each feature with its source type for filtering
              const taggedFeatures = features.map((f: any) => ({
                ...f,
                _sourceType: type // house_active, condo_active, revenue_active, etc.
              }));
              
              console.log(`[PropertyDataService] Loaded ${features.length} properties from ${type}`);
              allFeatures.push(...taggedFeatures);
            } else {
              console.warn(`[PropertyDataService] Failed to load ${type}:`, response.status);
            }
          } catch (error) {
            console.warn(`[PropertyDataService] Error loading ${type}:`, error);
          }
        })
      );

      if (allFeatures.length > 0) {
        this.properties = this.transformGeoJSONProperties(allFeatures);
        this.isLoaded = true;
        this.cacheTimestamp = Date.now();
        console.log(`[PropertyDataService] Successfully loaded ${this.properties.length} total properties from blob storage`);
        return this.properties;
      }
    } catch (error) {
      console.warn('[PropertyDataService] Could not load real data from blob storage, generating mock data:', error);
    }

    // Fallback to mock data
    this.properties = this.generateMockProperties();
    this.isLoaded = true;
    this.cacheTimestamp = Date.now();
    console.log(`[PropertyDataService] Generated ${this.properties.length} mock properties`);
    return this.properties;
  }

  private transformGeoJSONProperties(features: any[]): CMAProperty[] {
    console.log(`[PropertyDataService] Transforming ${features.length} GeoJSON features`);
    const transformed = features.map(feature => {
      const props = feature.properties;
      const coords = feature.geometry?.coordinates || [];
      
      // Extract propertyCategory and sourcePropertyType from source type
      const sourceType = feature._sourceType || '';
      let propertyCategory: 'residential' | 'revenue' = 'residential';
      let sourcePropertyType: string | undefined;

      if (sourceType.includes('revenue')) {
        propertyCategory = 'revenue';
        sourcePropertyType = 'multiplex'; // Revenue properties default to multiplex
      } else if (sourceType.includes('house')) {
        propertyCategory = 'residential';
        sourcePropertyType = 'house';
      } else if (sourceType.includes('condo')) {
        propertyCategory = 'residential';
        sourcePropertyType = 'condo';
      }

      // Classify property type (revenue vs residential)
      const classification = PropertyTypeClassifier.classify({
        potential_gross_revenue: props.potential_gross_revenue,
        common_expenses: props.common_expenses,
        gross_income_multiplier: props.gross_income_multiplier,
        price_vs_assessment: props.price_vs_assessment,
        property_type: props.property_type,
        pt: props.pt,
      });
      
      // Debug first 3 properties
      const idx = features.indexOf(feature);
      if (idx < 3) {
        console.log(`[PropertyDataService] Transform property ${idx}:`, {
          address: props.address,
          pt: props.pt,
          potential_gross_revenue: props.potential_gross_revenue,
          isRevenueProperty: classification.isRevenueProperty,
          confidence: classification.confidence,
          // DEBUG STATUS FIELDS
          raw_props_st: props.st,
          raw_props_status: props.status,
          calculated_st: props.status || props.st || 'AC',
          calculated_status: (props.status || props.st || 'AC') === 'SO' ? 'sold' : 'active'
        });
      }

      // Calculate investment metrics for revenue properties
      const investmentMetrics = InvestmentMetricsCalculator.calculate({
        price: props.price || props.askedsold_price || 0,
        potential_gross_revenue: props.potential_gross_revenue,
        common_expenses: props.common_expenses,
        gross_income_multiplier: props.gross_income_multiplier,
        price_vs_assessment: props.price_vs_assessment,
      });

      return {
        ...props,
        // Ensure required fields are present
        centris_no: props.id || props.centris_no || Math.floor(Math.random() * 10000000),
        address: props.address || 'Unknown Address',
        price: props.price || props.askedsold_price || 0,
        askedsold_price: props.askedsold_price || props.price || 0,
        st: props.status || props.st || 'AC', // Abbreviated status code
        status: (props.status || props.st || 'AC') === 'SO' ? 'sold' : 'active', // Map to full status
        pt: props.property_type || props.pt || 'CT', // Default to condo/townhouse
        mls_number: props.mls_number || props.id || props.centris_no,

        // Add coordinates from GeoJSON
        longitude: coords[0],
        latitude: coords[1],

        // Map GeoJSON property names to expected format
        bedrooms_number: props.bedrooms || props.bedrooms_number,
        bathrooms_number: props.bathrooms || props.bathrooms_number,
        municipalityborough: props.municipality || props.municipalityborough,
        postal_code: props.fsa || props.postal_code,

        // Add computed fields
        square_footage: this.extractSquareFootage(props.living_area_imperial),
        time_on_market: this.calculateDaysOnMarket(props),
        year_built: this.extractYearBuilt(props),

        // Add investment metrics (will be null for non-revenue properties)
        // Spread first, then override with classification flags
        ...investmentMetrics,

        // Add property classification (overrides investmentMetrics.isRevenueProperty)
        isRevenueProperty: classification.isRevenueProperty,
        propertyCategory: propertyCategory, // Use source-based category (house/condo/revenue)
        sourcePropertyType: sourcePropertyType, // Specific type from data source (house/condo/multiplex)
      };
    })
    .filter(property => {
      // Exclude rental properties (price = 0.0)
      // These will be added as a separate property type later
      const price = property.price || property.askedsold_price || 0;
      const isRental = price === 0;

      if (isRental) {
        console.log(`[PropertyDataService] Filtering out rental property (price=0): ${property.address}`);
      }

      return !isRental;
    });

    // Summary statistics
    const revenueCount = transformed.filter(p => p.isRevenueProperty).length;
    const residentialCount = transformed.length - revenueCount;
    console.log(`[PropertyDataService] Transformed: ${revenueCount} revenue, ${residentialCount} residential (rentals filtered out)`);

    return transformed;
  }

  private transformProperties(rawData: any[]): CMAProperty[] {
    return rawData.map(item => ({
      ...item,
      // Ensure required fields are present
      centris_no: item.centris_no || Math.floor(Math.random() * 10000000),
      address: item.address || 'Unknown Address',
      price: item.price || item.askedsold_price || 0,
      askedsold_price: item.askedsold_price || 0,
      st: item.st || 'AC', // Default to active
      pt: item.pt || 'CT', // Default to condo/townhouse
      mls_number: item.mls_number || item.centris_no,
      
      // Add computed fields
      square_footage: this.extractSquareFootage(item.living_area_imperial),
      time_on_market: this.calculateDaysOnMarket(item),
      year_built: this.extractYearBuilt(item)
    }));
  }

  private extractSquareFootage(livingAreaImperial?: string): number | undefined {
    if (!livingAreaImperial) return undefined;
    
    const match = livingAreaImperial.match(/[\d,]+/);
    if (match) {
      const numStr = match[0].replace(/,/g, '');
      const num = parseInt(numStr, 10);
      return isNaN(num) ? undefined : num;
    }
    
    return undefined;
  }

  private calculateDaysOnMarket(item: any): number | undefined {
    // Calculate from actual dates if available
    if (item.date_bc && item.date_pp_acpt_expiration) {
      try {
        const listingDate = new Date(item.date_bc);
        const soldDate = new Date(item.date_pp_acpt_expiration);
        const diffTime = soldDate.getTime() - listingDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // Sanity check: DOM should be positive and reasonable (< 2 years)
        if (diffDays > 0 && diffDays < 730) {
          return diffDays;
        }
      } catch (error) {
        console.warn('[PropertyDataService] Failed to parse dates for DOM calculation:', error);
      }
    }
    
    // If dates are missing or invalid, return undefined (not a mock value)
    return undefined;
  }

  private extractYearBuilt(item: any): number | undefined {
    // Extract year from building description or generate reasonable estimate
    if (item.building_size) {
      const yearMatch = item.building_size.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) {
        return parseInt(yearMatch[0], 10);
      }
    }
    
    // Generate reasonable year based on property type and location
    const currentYear = new Date().getFullYear();
    return Math.floor(Math.random() * 60) + (currentYear - 60); // Random year in last 60 years
  }

  private generateMockProperties(): CMAProperty[] {
    const mockProperties: CMAProperty[] = [];
    const neighborhoods = [
      'Montreal', 'Pointe-Claire', 'Laval', 'Longueuil', 'Brossard',
      'Saint-Laurent', 'Dollard-Des Ormeaux', 'Pierrefonds-Roxboro', 'Westmount', 'Verdun'
    ];
    
    const propertyTypes = ['CT', 'SF', 'TH', 'CO', 'DP']; // Condo, Single Family, Townhouse, Coop, Duplex
    const statuses = ['SO', 'AC', 'EX', 'WD']; // Sold, Active, Expired, Withdrawn

    for (let i = 0; i < 150; i++) {
      const bedrooms = Math.floor(Math.random() * 5) + 1;
      const bathrooms = Math.floor(Math.random() * 3) + 1 + (Math.random() < 0.5 ? 0.5 : 0);
      const sqft = Math.floor(Math.random() * 3000) + 800;
      const pricePerSqft = Math.floor(Math.random() * 200) + 150;
      const price = sqft * pricePerSqft;
      const yearBuilt = Math.floor(Math.random() * 60) + 1964;
      
      const property: CMAProperty = {
        id: `cma-${10000000 + i}`,
        address: `${Math.floor(Math.random() * 9999) + 1} ${['Main', 'Oak', 'Pine', 'Elm', 'Maple'][Math.floor(Math.random() * 5)]} ${['St', 'Ave', 'Blvd', 'Dr', 'Ct'][Math.floor(Math.random() * 5)]}`,
        price: price,
        bedrooms: bedrooms,
        bathrooms: bathrooms,
        squareFootage: sqft,
        yearBuilt: yearBuilt,
        status: Math.random() < 0.6 ? 'sold' : 'active',
        cma_score: Math.random() * 40 + 60, // Random score between 60-100
        time_on_market: Math.floor(Math.random() * 120) + 15 // Random 15-135 days on market
      };

      mockProperties.push(property);
    }

    return mockProperties;
  }

  async getPropertiesByLocation(bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  }): Promise<CMAProperty[]> {
    const allProperties = await this.loadProperties();

    if (!bounds) {
      return allProperties;
    }

    // Filter properties by geographic bounds using longitude/latitude
    const filteredProperties = allProperties.filter(property => {
      const propAny = property as any;
      const lon = propAny.longitude;
      const lat = propAny.latitude;

      // Skip properties without coordinates
      if (lon === undefined || lat === undefined) {
        return false;
      }

      // Check if property is within bounds
      return lat >= bounds.south &&
             lat <= bounds.north &&
             lon >= bounds.west &&
             lon <= bounds.east;
    });

    console.log(`[PropertyDataService] Spatial filter: ${filteredProperties.length} of ${allProperties.length} properties within bounds`);

    return filteredProperties;
  }

  async searchProperties(query: string): Promise<CMAProperty[]> {
    const allProperties = await this.loadProperties();
    
    if (!query.trim()) {
      return allProperties;
    }

    const searchLower = query.toLowerCase();
    return allProperties.filter(property => 
      property.address.toLowerCase().includes(searchLower) ||
      property.id.toLowerCase().includes(searchLower)
    );
  }

  getPropertyTypes(): string[] {
    return ['house', 'condo', 'townhouse', 'apartment', 'duplex', 'commercial'];
  }

  getPriceRange(): { min: number; max: number } {
    if (this.properties.length === 0) {
      return { min: 100000, max: 2000000 };
    }

    const prices = this.properties
      .map(p => p.price || 0)
      .filter(p => p > 0);

    return {
      min: Math.min(...prices),
      max: Math.max(...prices)
    };
  }

  getNeighborhoods(): string[] {
    if (this.properties.length === 0) {
      return ['Montreal', 'Pointe-Claire', 'Laval', 'Longueuil', 'Brossard'];
    }

    const neighborhoods = [...new Set(
      this.properties
        .map(p => {
          // Extract neighborhood from address since municipalityborough doesn't exist on CMAProperty
          const addressParts = p.address.split(',');
          return addressParts.length > 1 ? addressParts[addressParts.length - 1].trim() : 'Unknown';
        })
        .filter(Boolean)
    )] as string[];

    return neighborhoods.sort();
  }
}