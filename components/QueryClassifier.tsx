import Point from "@arcgis/core/geometry/Point";
import Polygon from "@arcgis/core/geometry/Polygon";
import Circle from "@arcgis/core/geometry/Circle";
import { buffer } from "@arcgis/core/geometry/geometryEngine";
import * as locator from "@arcgis/core/rest/locator";

export type IntentType = 'COMPETITION' | 'MARKET' | 'STANDARD' | 'LOCATION';

export interface QueryIntent {
  type: IntentType;
  confidence: number;
  parameters: {
    location?: string;
    radius?: number;
    filters?: Array<{
      field: string;
      value: string | number;
      operator: 'equals' | 'gt' | 'lt' | 'contains';
    }>;
    timeRange?: {
      start?: Date;
      end?: Date;
    };
  };
}

interface ClassificationContext {
  previousIntent?: IntentType;
  selectedArea?: __esri.Geometry;
  activeFilters?: Record<string, any>;
}

export class QueryClassifier {
  private readonly geocodeUrl = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer";
  private readonly competitionKeywords = [
    'competitor', 'competition', 'similar', 'nearby', 'other', 'existing'
  ];
  private readonly marketKeywords = [
    'market', 'potential', 'opportunity', 'demographic', 'population', 'income'
  ];
  private readonly locationPrefixes = [
    'near', 'around', 'in', 'at', 'close to', 'within'
  ];
  private readonly radiusKeywords = [
    'mile', 'km', 'kilometer', 'meters', 'radius'
  ];

  constructor() {
    // No need for geocoder initialization anymore
  }

  public classifyQuery(query: string, context?: ClassificationContext): QueryIntent {
    const normalizedQuery = query.toLowerCase();
    const intent: QueryIntent = {
      type: 'STANDARD',
      confidence: 0.5,
      parameters: {}
    };

    // Extract location and radius if present
    const locationInfo = this.extractLocationInfo(normalizedQuery);
    if (locationInfo) {
      intent.parameters = { ...intent.parameters, ...locationInfo };
    }

    // Determine intent type based on keywords and context
    if (this.competitionKeywords.some(keyword => normalizedQuery.includes(keyword))) {
      intent.type = 'COMPETITION';
      intent.confidence = 0.8;
    } else if (this.marketKeywords.some(keyword => normalizedQuery.includes(keyword))) {
      intent.type = 'MARKET';
      intent.confidence = 0.8;
    }

    // Consider context for intent refinement
    if (context) {
      this.refineIntentWithContext(intent, context);
    }

    return intent;
  }

  private extractLocationInfo(query: string): { location?: string; radius?: number } | null {
    const words = query.split(' ');
    let location: string | undefined;
    let radius: number | undefined;

    // Look for location patterns
    for (const prefix of this.locationPrefixes) {
      const index = query.indexOf(prefix + ' ');
      if (index !== -1) {
        // Extract location phrase after prefix
        const remaining = query.substring(index + prefix.length).trim();
        const endIndex = remaining.indexOf(' within ');
        location = endIndex !== -1 ? 
          remaining.substring(0, endIndex).trim() : 
          remaining;
        break;
      }
    }

    // Look for radius patterns
    const radiusMatch = query.match(/within (\d+)\s*(mile|km|kilometer|meters?)/i);
    if (radiusMatch) {
      const [_, value, unit] = radiusMatch;
      const numValue = parseInt(value);
      
      // Convert to meters
      switch(unit.toLowerCase()) {
        case 'mile':
          radius = numValue * 1609.34;
          break;
        case 'km':
        case 'kilometer':
          radius = numValue * 1000;
          break;
        default:
          radius = numValue;
      }
    }

    return location || radius ? { location, radius } : null;
  }

  private refineIntentWithContext(intent: QueryIntent, context: ClassificationContext): void {
    // Increase confidence if intent matches previous
    if (context.previousIntent === intent.type) {
      intent.confidence = Math.min(intent.confidence + 0.1, 1.0);
    }

    // If we have a selected area but no location specified, use the selected area
    if (context.selectedArea && !intent.parameters.location) {
      if (context.selectedArea.type === "polygon") {
        intent.parameters.location = "selected area";
      } else if (context.selectedArea.type === "point") {
        const point = context.selectedArea as Point;
        if (point.latitude !== null && point.latitude !== undefined && 
            point.longitude !== null && point.longitude !== undefined) {
          intent.parameters.location = `${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}`;
        }
      }
    }

    // Incorporate active filters if present
    if (context.activeFilters) {
      intent.parameters.filters = Object.entries(context.activeFilters).map(([field, value]) => ({
        field,
        value,
        operator: 'equals'
      }));
    }
  }

  public async resolveLocation(locationDesc: string): Promise<{
    geometry: Point | Polygon;
    type: 'point' | 'polygon';
    address?: string;
  }> {
    try {
      // Use the REST-based locator instead
      const geocodeResult = await locator.addressToLocations(this.geocodeUrl, {
        address: { singleLine: locationDesc },
        outFields: ["*"],
        maxLocations: 1
      });

      if (geocodeResult.length > 0) {
        const bestMatch = geocodeResult[0];
        
        // If it's a point location
        if (bestMatch.location) {
          return {
            geometry: bestMatch.location as Point,
            type: 'point',
            address: bestMatch.address || undefined
          };
        }
        
        // If it's an area (like a city or neighborhood)
        if (bestMatch.extent && bestMatch.location) {
          const polygon = new Polygon({
            rings: [
              [
                [bestMatch.extent.xmin, bestMatch.extent.ymin],
                [bestMatch.extent.xmin, bestMatch.extent.ymax],
                [bestMatch.extent.xmax, bestMatch.extent.ymax],
                [bestMatch.extent.xmax, bestMatch.extent.ymin],
                [bestMatch.extent.xmin, bestMatch.extent.ymin]
              ]
            ],
            spatialReference: (bestMatch.location as Point).spatialReference
          });

          return {
            geometry: polygon,
            type: 'polygon',
            address: bestMatch.address || undefined
          };
        }
      }

      throw new Error('Location not found');
    } catch (error) {
      console.error('Error resolving location:', error);
      throw new Error('Failed to resolve location');
    }
  }

  public async createSearchArea(
    location: Point | Polygon,
    radius?: number
  ): Promise<Polygon> {
    if (location.type === "polygon") {
      return location as Polygon;
    }

    // Create a circular buffer around the point
    const circle = new Circle({
      center: location as Point,
      radius: radius || 5000, // Default 5km radius
      radiusUnit: "meters"
    });

    // Convert to polygon for analysis
    return buffer(circle, 0) as Polygon;
  }
}