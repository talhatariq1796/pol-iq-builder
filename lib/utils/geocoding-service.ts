import type { RealEstateProperty } from '../../components/map/RealEstatePointLayerManager';

interface GeocodeResult {
  latitude: number;
  longitude: number;
  accuracy: 'exact' | 'approximate' | 'postal_code' | 'municipality';
  source: 'address' | 'postal_code' | 'municipality';
}

interface GeocodeCache {
  [key: string]: GeocodeResult;
}

// Simple in-memory cache for geocoding results
const geocodeCache: GeocodeCache = {};

/**
 * Enhanced geocoding service for real estate properties
 * Supports multiple fallback strategies for coordinate resolution
 */
export class GeocodingService {
  private static instance: GeocodingService;
  private cache: GeocodeCache = geocodeCache;
  private batchSize = 10;
  private delay = 100; // ms between requests to avoid rate limiting

  static getInstance(): GeocodingService {
    if (!GeocodingService.instance) {
      GeocodingService.instance = new GeocodingService();
    }
    return GeocodingService.instance;
  }

  /**
   * Geocode a single property using multiple fallback strategies
   */
  async geocodeProperty(property: RealEstateProperty): Promise<GeocodeResult | null> {
    // Check cache first
    const cacheKey = this.generateCacheKey(property);
    if (this.cache[cacheKey]) {
      return this.cache[cacheKey];
    }

    // Strategy 1: Use existing coordinates if available
    if (property.latitude && property.longitude) {
      const result: GeocodeResult = {
        latitude: property.latitude,
        longitude: property.longitude,
        accuracy: 'exact',
        source: 'address'
      };
      this.cache[cacheKey] = result;
      return result;
    }

    // Strategy 2: Geocode by full address
    if (property.address) {
      const addressResult = await this.geocodeByAddress(property.address, property.municipalityborough);
      if (addressResult) {
        this.cache[cacheKey] = addressResult;
        return addressResult;
      }
    }

    // Strategy 3: Approximate by postal code
    if (property.postal_code) {
      const postalResult = await this.geocodeByPostalCode(property.postal_code);
      if (postalResult) {
        this.cache[cacheKey] = postalResult;
        return postalResult;
      }
    }

    // Strategy 4: Approximate by municipality
    if (property.municipalityborough) {
      const municipalityResult = await this.geocodeByMunicipality(property.municipalityborough);
      if (municipalityResult) {
        this.cache[cacheKey] = municipalityResult;
        return municipalityResult;
      }
    }

    return null;
  }

  /**
   * Batch geocode multiple properties with rate limiting
   */
  async geocodeProperties(properties: RealEstateProperty[]): Promise<RealEstateProperty[]> {
    const results: RealEstateProperty[] = [];
    
    // Process in batches to avoid overwhelming geocoding services
    for (let i = 0; i < properties.length; i += this.batchSize) {
      const batch = properties.slice(i, i + this.batchSize);
      
      const batchPromises = batch.map(async (property) => {
        const geocodeResult = await this.geocodeProperty(property);
        
        if (geocodeResult) {
          return {
            ...property,
            latitude: geocodeResult.latitude,
            longitude: geocodeResult.longitude,
            geocode_accuracy: geocodeResult.accuracy,
            geocode_source: geocodeResult.source
          };
        }
        
        return property; // Return original if geocoding failed
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Add delay between batches
      if (i + this.batchSize < properties.length) {
        await this.sleep(this.delay * this.batchSize);
      }
    }
    
    return results;
  }

  /**
   * Geocode by full address (would typically use a real geocoding service)
   */
  private async geocodeByAddress(address: string, municipality?: string): Promise<GeocodeResult | null> {
    try {
      // For demo purposes, we'll use approximate coordinates based on municipality
      // In a real implementation, you would call a geocoding API like:
      // - Google Geocoding API
      // - ArcGIS Geocoding Service
      // - OpenStreetMap Nominatim
      // - MapBox Geocoding API
      
      const fullAddress = municipality ? `${address}, ${municipality}` : address;
      
      // Simulate geocoding with known Quebec/Montreal area coordinates
      if (this.isInMontreal(fullAddress)) {
        return {
          latitude: 45.5088 + (Math.random() - 0.5) * 0.1, // Montreal area
          longitude: -73.5878 + (Math.random() - 0.5) * 0.1,
          accuracy: 'approximate',
          source: 'address'
        };
      }
      
      if (this.isInQuebecCity(fullAddress)) {
        return {
          latitude: 46.8139 + (Math.random() - 0.5) * 0.05, // Quebec City area
          longitude: -71.2080 + (Math.random() - 0.5) * 0.05,
          accuracy: 'approximate',
          source: 'address'
        };
      }
      
      if (this.isInLaval(fullAddress)) {
        return {
          latitude: 45.6066 + (Math.random() - 0.5) * 0.05, // Laval area
          longitude: -73.7124 + (Math.random() - 0.5) * 0.05,
          accuracy: 'approximate',
          source: 'address'
        };
      }
      
      return null;
    } catch (error) {
      console.warn('Error geocoding by address:', error);
      return null;
    }
  }

  /**
   * Geocode by postal code using known FSA patterns
   */
  private async geocodeByPostalCode(postalCode: string): Promise<GeocodeResult | null> {
    try {
      const fsa = postalCode.substring(0, 3).toUpperCase();
      
      // Montreal area FSAs
      const montrealFSAs = ['H1A', 'H1B', 'H1C', 'H1E', 'H1G', 'H1H', 'H1J', 'H1K', 'H1L', 'H1M', 'H1N', 'H1P', 'H1R', 'H1S', 'H1T', 'H1V', 'H1W', 'H1X', 'H1Y', 'H1Z', 'H2A', 'H2B', 'H2C', 'H2E', 'H2G', 'H2H', 'H2J', 'H2K', 'H2L', 'H2M', 'H2N', 'H2P', 'H2R', 'H2S', 'H2T', 'H2V', 'H2W', 'H2X', 'H2Y', 'H2Z', 'H3A', 'H3B', 'H3C', 'H3E', 'H3G', 'H3H', 'H3J', 'H3K', 'H3L', 'H3M', 'H3N', 'H3P', 'H3R', 'H3S', 'H3T', 'H3V', 'H3W', 'H3X', 'H3Y', 'H3Z', 'H4A', 'H4B', 'H4C', 'H4E', 'H4G', 'H4H', 'H4J', 'H4K', 'H4L', 'H4M', 'H4N', 'H4P', 'H4R', 'H4S', 'H4T', 'H4V', 'H4W', 'H4X', 'H4Y', 'H4Z'];
      
      // Quebec City area FSAs
      const quebecFSAs = ['G1A', 'G1B', 'G1C', 'G1E', 'G1G', 'G1H', 'G1J', 'G1K', 'G1L', 'G1M', 'G1N', 'G1P', 'G1R', 'G1S', 'G1T', 'G1V', 'G1W', 'G1X', 'G1Y', 'G2A', 'G2B', 'G2C', 'G2E', 'G2G', 'G2H', 'G2J', 'G2K', 'G2L', 'G2M', 'G2N'];
      
      // Laval area FSAs
      const lavalFSAs = ['H7A', 'H7B', 'H7C', 'H7E', 'H7G', 'H7H', 'H7J', 'H7K', 'H7L', 'H7M', 'H7N', 'H7P', 'H7R', 'H7S', 'H7T', 'H7V', 'H7W', 'H7X', 'H7Y'];
      
      if (montrealFSAs.includes(fsa)) {
        return {
          latitude: 45.5088 + (Math.random() - 0.5) * 0.15,
          longitude: -73.5878 + (Math.random() - 0.5) * 0.15,
          accuracy: 'postal_code',
          source: 'postal_code'
        };
      }
      
      if (quebecFSAs.includes(fsa)) {
        return {
          latitude: 46.8139 + (Math.random() - 0.5) * 0.1,
          longitude: -71.2080 + (Math.random() - 0.5) * 0.1,
          accuracy: 'postal_code',
          source: 'postal_code'
        };
      }
      
      if (lavalFSAs.includes(fsa)) {
        return {
          latitude: 45.6066 + (Math.random() - 0.5) * 0.08,
          longitude: -73.7124 + (Math.random() - 0.5) * 0.08,
          accuracy: 'postal_code',
          source: 'postal_code'
        };
      }
      
      return null;
    } catch (error) {
      console.warn('Error geocoding by postal code:', error);
      return null;
    }
  }

  /**
   * Geocode by municipality name
   */
  private async geocodeByMunicipality(municipality: string): Promise<GeocodeResult | null> {
    try {
      const municipalityLower = municipality.toLowerCase();
      
      const municipalityCoords: Record<string, [number, number]> = {
        'montreal': [45.5088, -73.5878],
        'montreal-nord': [45.5949, -73.6203],
        'montreal-ouest': [45.4541, -73.6498],
        'montreal-est': [45.6423, -73.4998],
        'quebec': [46.8139, -71.2080],
        'quebec city': [46.8139, -71.2080],
        'laval': [45.6066, -73.7124],
        'longueuil': [45.5312, -73.5185],
        'gatineau': [45.4765, -75.7013],
        'sherbrooke': [45.4042, -71.8929],
        'trois-rivieres': [46.3432, -72.5428],
        'saguenay': [48.4284, -71.0684],
        'levis': [46.8037, -71.1772],
        'terrebonne': [45.7057, -73.6475],
        'boucherville': [45.5907, -73.4357],
        'dollard-des-ormeaux': [45.4943, -73.8203],
        'pointe-claire': [45.4471, -73.8167],
        'kirkland': [45.4498, -73.8654],
        'beaconsfield': [45.4328, -73.8654],
        'westmount': [45.4898, -73.5949],
        'outremont': [45.5236, -73.6103],
        'mont-royal': [45.5132, -73.6498],
        'cote-saint-luc': [45.4654, -73.6654]
      };
      
      for (const [name, coords] of Object.entries(municipalityCoords)) {
        if (municipalityLower.includes(name) || name.includes(municipalityLower)) {
          return {
            latitude: coords[0] + (Math.random() - 0.5) * 0.02,
            longitude: coords[1] + (Math.random() - 0.5) * 0.02,
            accuracy: 'municipality',
            source: 'municipality'
          };
        }
      }
      
      return null;
    } catch (error) {
      console.warn('Error geocoding by municipality:', error);
      return null;
    }
  }

  /**
   * Helper methods for identifying locations
   */
  private isInMontreal(address: string): boolean {
    const montrealKeywords = ['montreal', 'montréal', 'mtl', 'verdun', 'westmount', 'outremont', 'cote-saint-luc', 'mont-royal'];
    const addressLower = address.toLowerCase();
    return montrealKeywords.some(keyword => addressLower.includes(keyword));
  }

  private isInQuebecCity(address: string): boolean {
    const quebecKeywords = ['quebec', 'québec', 'charlesbourg', 'beauport', 'sainte-foy'];
    const addressLower = address.toLowerCase();
    return quebecKeywords.some(keyword => addressLower.includes(keyword));
  }

  private isInLaval(address: string): boolean {
    const lavalKeywords = ['laval', 'chomedey', 'vimont', 'pont-viau'];
    const addressLower = address.toLowerCase();
    return lavalKeywords.some(keyword => addressLower.includes(keyword));
  }

  /**
   * Generate cache key for a property
   */
  private generateCacheKey(property: RealEstateProperty): string {
    const parts = [
      property.address || '',
      property.municipalityborough || '',
      property.postal_code || ''
    ].filter(Boolean);
    
    return parts.join('|').toLowerCase();
  }

  /**
   * Sleep utility for rate limiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get geocoding statistics
   */
  getStats(): { cacheSize: number; hitRate: number } {
    return {
      cacheSize: Object.keys(this.cache).length,
      hitRate: 0 // Would track this in a real implementation
    };
  }

  /**
   * Clear geocoding cache
   */
  clearCache(): void {
    Object.keys(this.cache).forEach(key => delete this.cache[key]);
  }
}

// Export singleton instance
export const geocodingService = GeocodingService.getInstance();

// Export types
export type { GeocodeResult, GeocodeCache };
