// lib/geographic-recognition-service.ts
// ArcGIS-based Geographic Recognition Service

export interface GeographicEntity {
  text: string;
  type: 'locality' | 'postal' | 'region' | 'country' | 'poi' | 'address';
  coordinates?: [number, number];
  bbox?: [number, number, number, number];
  confidence: number;
  details?: {
    fullName?: string;
    adminLevel?: string;
    countryCode?: string;
    postalCode?: string;
  };
}

export interface GeographicRecognitionResult {
  entities: GeographicEntity[];
  primaryLocation?: GeographicEntity;
  spatialFilter?: {
    geometry: any;
    type: 'point' | 'bbox' | 'polygon';
  };
}

export class ArcGISGeographicRecognitionService {
  private apiKey: string;
  private geocodeUrl: string;
  private cache: Map<string, GeographicRecognitionResult>;

  constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_ARCGIS_API_KEY || '';
    this.geocodeUrl = 'https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates';
    this.cache = new Map();
    
    if (!this.apiKey) {
      console.warn('ArcGIS API key not found. Geographic recognition will be limited.');
    }
  }

  /**
   * Extract geographic entities from a query string
   */
  async extractGeographicEntities(query: string): Promise<GeographicRecognitionResult> {
    // Check cache first
    const cacheKey = query.toLowerCase().trim();
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const result: GeographicRecognitionResult = {
      entities: [],
      primaryLocation: undefined,
      spatialFilter: undefined
    };

    try {
      // Step 1: Extract potential geographic terms using regex patterns
      const potentialLocations = this.extractPotentialLocations(query);
      
      // Step 2: Validate and geocode each potential location
      for (const location of potentialLocations) {
        const geocodeResult = await this.geocodeLocation(location);
        if (geocodeResult) {
          result.entities.push(geocodeResult);
        }
      }

      // Step 3: Determine primary location and spatial filter
      if (result.entities.length > 0) {
        result.primaryLocation = this.selectPrimaryLocation(result.entities);
        result.spatialFilter = this.createSpatialFilter(result.primaryLocation);
      }

      // Cache the result
      this.cache.set(cacheKey, result);
      
      return result;
    } catch (error) {
      console.error('Error extracting geographic entities:', error);
      return result;
    }
  }

  /**
   * Extract potential location terms from query using enhanced patterns
   */
  private extractPotentialLocations(query: string): string[] {
    const locations: string[] = [];
    
    // Enhanced geographic patterns
    const patterns = [
      // Regional descriptors
      /\b(eastern|western|northern|southern|central|east|west|north|south|northeast|northwest|southeast|southwest)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/gi,
      
      // "in [Location]" patterns
      /\bin\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/gi,
      
      // "near [Location]" patterns  
      /\bnear\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/gi,
      
      // "around [Location]" patterns
      /\baround\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/gi,
      
      // "[Location] area" patterns
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+area\b/gi,
      
      // Postal code patterns
      /\b(\d{5}(-\d{4})?)\b/g, // US ZIP codes
      /\b([A-Z]\d[A-Z]\s*\d[A-Z]\d)\b/gi, // Canadian postal codes
      
      // State abbreviations
      /\b([A-Z]{2})\b/g,
      
      // Direct location names (capitalized words)
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(query)) !== null) {
        const location = match[1] || match[0];
        if (location && location.length > 2 && !this.isCommonWord(location)) {
          locations.push(location.trim());
        }
      }
    });

    // Remove duplicates and sort by length (longer terms first)
    return [...new Set(locations)].sort((a, b) => b.length - a.length);
  }

  /**
   * Check if a term is a common word (not a location)
   */
  private isCommonWord(term: string): boolean {
    const commonWords = [
      'the', 'and', 'or', 'but', 'with', 'for', 'from', 'to', 'at', 'by',
      'show', 'find', 'get', 'have', 'make', 'take', 'give', 'come', 'go',
      'sales', 'data', 'analysis', 'report', 'chart', 'map', 'layer',
      'nike', 'adidas', 'brand', 'store', 'retail', 'market', 'business'
    ];
    
    return commonWords.includes(term.toLowerCase());
  }

  /**
   * Geocode a location using ArcGIS World Geocoding Service
   */
  private async geocodeLocation(location: string): Promise<GeographicEntity | null> {
    try {
      const params = new URLSearchParams({
        f: 'json',
        singleLine: location,
        outFields: 'Match_addr,Addr_type,Country,Region,City,Postal,Type,PlaceName',
        maxLocations: '1',
        outSR: '4326',
        token: this.apiKey
      });

      const response = await fetch(`${this.geocodeUrl}?${params}`);
      const data = await response.json();

      if (data.candidates && data.candidates.length > 0) {
        const candidate = data.candidates[0];
        
        // Only accept high-confidence matches
        if (candidate.score < 70) {
          return null;
        }

        const entity: GeographicEntity = {
          text: location,
          type: this.mapAddressTypeToEntityType(candidate.attributes.Addr_type),
          coordinates: [candidate.location.x, candidate.location.y],
          confidence: candidate.score / 100,
          details: {
            fullName: candidate.attributes.Match_addr,
            adminLevel: candidate.attributes.Addr_type,
            countryCode: candidate.attributes.Country,
            postalCode: candidate.attributes.Postal
          }
        };

        // Add bounding box if available
        if (candidate.extent) {
          entity.bbox = [
            candidate.extent.xmin,
            candidate.extent.ymin,
            candidate.extent.xmax,
            candidate.extent.ymax
          ];
        }

        return entity;
      }

      return null;
    } catch (error) {
      console.error(`Error geocoding location "${location}":`, error);
      return null;
    }
  }

  /**
   * Map ArcGIS address types to our entity types
   */
  private mapAddressTypeToEntityType(addrType: string): GeographicEntity['type'] {
    const typeMap: Record<string, GeographicEntity['type']> = {
      'Locality': 'locality',
      'Postal': 'postal',
      'Region': 'region',
      'Country': 'country',
      'POI': 'poi',
      'PointAddress': 'address',
      'StreetAddress': 'address'
    };

    return typeMap[addrType] || 'locality';
  }

  /**
   * Select the most relevant location from extracted entities
   */
  private selectPrimaryLocation(entities: GeographicEntity[]): GeographicEntity {
    // Priority: Region > Locality > Postal > POI > Address
    const priorityOrder: GeographicEntity['type'][] = ['region', 'locality', 'postal', 'poi', 'address'];
    
    for (const type of priorityOrder) {
      const entity = entities.find(e => e.type === type);
      if (entity) {
        return entity;
      }
    }

    // Fallback to highest confidence
    return entities.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );
  }

  /**
   * Create spatial filter from primary location
   */
  private createSpatialFilter(location: GeographicEntity): any {
    if (!location.coordinates) {
      return undefined;
    }

    // Use bounding box if available, otherwise create buffer around point
    if (location.bbox) {
      return {
        geometry: {
          xmin: location.bbox[0],
          ymin: location.bbox[1],
          xmax: location.bbox[2],
          ymax: location.bbox[3],
          spatialReference: { wkid: 4326 }
        },
        type: 'bbox'
      };
    } else {
      // Create buffer based on location type
      const bufferDistance = this.getBufferDistance(location.type);
      const [x, y] = location.coordinates;
      
      return {
        geometry: {
          x: x,
          y: y,
          spatialReference: { wkid: 4326 }
        },
        type: 'point',
        buffer: bufferDistance
      };
    }
  }

  /**
   * Get appropriate buffer distance based on location type
   */
  private getBufferDistance(type: GeographicEntity['type']): number {
    const bufferMap: Record<GeographicEntity['type'], number> = {
      'country': 100000,    // 100km
      'region': 50000,      // 50km
      'locality': 10000,    // 10km
      'postal': 5000,       // 5km
      'poi': 1000,          // 1km
      'address': 500        // 500m
    };

    return bufferMap[type] || 10000;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Export singleton instance
export const geographicRecognitionService = new ArcGISGeographicRecognitionService(); 