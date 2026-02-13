import Point from '@arcgis/core/geometry/Point';
import Polygon from '@arcgis/core/geometry/Polygon';
import SpatialReference from '@arcgis/core/geometry/SpatialReference';
import * as projection from '@arcgis/core/geometry/projection';
import Geometry from "@arcgis/core/geometry/Geometry";
import type { GeometryObject } from '@/types/geospatial-ai-types';

// Initialize projection engine
if (projection.isLoaded && !projection.isLoaded()) {
projection.load();
}

// Define spatial references
const webMercator = new SpatialReference({ wkid: 102100 });
const wgs84 = new SpatialReference({ wkid: 4326 });

// Max values for web mercator coordinates
const MAX_MERCATOR_X = 20037508.3427892;
const MAX_MERCATOR_Y = 20048966.1040891;

// Type definitions for geometry objects
interface PointGeometry extends GeometryObject {
  type: 'Point' | 'point';
  coordinates: [number, number];
}

interface PolygonGeometry extends GeometryObject {
  type: 'Polygon' | 'polygon';
  coordinates: number[][][];
}

// Add these constants and function at the top
let projectionEngineInitialized = false;

async function initializeProjectionEngine(): Promise<void> {
  if (projectionEngineInitialized) return;
  
  try {
    await projection.load();
    projectionEngineInitialized = true;
    console.log("[Geometry] Projection engine initialized");
  } catch (error) {
    console.error("[Geometry] Failed to initialize projection engine:", error);
  }
}

/**
 * Helper function to trace coordinates for debugging
 * @param coordinates - The coordinates to trace
 * @param label - A label for the log
 * @param spatialReference - Optional spatial reference
 */
export const traceCoordinates = (
  coordinates: any,
  label: string,
  spatialReference?: any
): void => {
  if (!coordinates) {
    // console.log(`[traceCoordinates] ${label}: Empty coordinates`);
    return;
  }

  // Log structure type to help debug
  // console.log(`[traceCoordinates] ${label} type: ${typeof coordinates}, isArray: ${Array.isArray(coordinates)}`);

  if (Array.isArray(coordinates)) {
    if (coordinates.length === 0) {
      // console.log(`[traceCoordinates] ${label}: Empty array`);
      return;
    }

    // Point coordinates [x, y]
    if (coordinates.length === 2 && typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
      // console.log(`[traceCoordinates] ${label}: Point [${coordinates[0]}, ${coordinates[1]}] SR: ${JSON.stringify(spatialReference)}`);
      return;
    }

    // Polygon with rings
    if (Array.isArray(coordinates[0])) {
      // console.log(`[traceCoordinates] ${label}: ${coordinates.length} polygon rings/linestrings SR: ${JSON.stringify(spatialReference)}`);
      
      // Sample first ring/linestring
      if (coordinates[0].length > 0) {
        // console.log(`[traceCoordinates] First item sample:`, 
        //   Array.isArray(coordinates[0][0]) ? 
        //     `Ring with ${coordinates[0].length} points` : 
        //     `Coordinates: ${JSON.stringify(coordinates[0])}`
        // );
        
        // Additional detail for diagnostic purposes
        if (Array.isArray(coordinates[0][0])) {
          // console.log(`[traceCoordinates] First point sample: ${JSON.stringify(coordinates[0][0])}`);
        }
      }
      return;
    }
  }
  
  // console.log(`[traceCoordinates] ${label}: Unusual coordinates structure, keys:`, 
  //   typeof coordinates === 'object' ? Object.keys(coordinates) : typeof coordinates);
}

/**
 * Normalize ring coordinates to ensure they're within valid Web Mercator bounds
 * @param rings - The polygon rings to normalize
 * @param wkid - The spatial reference WKID (to determine bounds)
 * @returns - Normalized rings
 */
function normalizeCoordinates(rings: number[][][], wkid: number): number[][][] {
  const MAX_WEB_MERCATOR = 20037508.3427892; // Web Mercator bounds
  const MAX_WGS84 = 180; // WGS84 bounds (degrees)
  
  const maxValue = wkid === 102100 || wkid === 3857 ? MAX_WEB_MERCATOR : MAX_WGS84;
  
  // console.log(`[normalizeCoordinates] Normalizing coordinates for WKID ${wkid}, max value ${maxValue}`);
  
  return rings.map(ring => {
    // Filter out invalid coordinates
    const validCoords = ring.filter(coord => {
      if (!Array.isArray(coord) || coord.length < 2) return false;
      return !isNaN(coord[0]) && !isNaN(coord[1]);
    });
    
    // Skip rings with too few valid coordinates
    if (validCoords.length < 3) return [];
    
    // Normalize coordinates to bounds
    return validCoords.map(coord => {
      // Clamp values to reasonable range
      const x = Math.min(Math.max(coord[0], -maxValue), maxValue);
      const y = Math.min(Math.max(coord[1], -maxValue), maxValue);
      
      // If we had to clamp significantly, log it
      // if (Math.abs(x - coord[0]) > maxValue * 0.1 || Math.abs(y - coord[1]) > maxValue * 0.1) {
        // console.warn(`[normalizeCoordinates] Significant coordinate clamping: [${coord[0]}, ${coord[1]}] -> [${x}, ${y}]`);
      // }
      
      return [x, y];
    });
  }).filter(ring => ring.length >= 3); // Filter out empty or invalid rings
}

/**
 * Create an ESRI geometry from a GeoJSON-like geometry object
 * @param geometry - The geometry to create
 * @param targetSpatialReference - Optional target spatial reference
 * @returns - The ArcGIS geometry or null if it cannot be created
 */
export const createGeometry = (geometry: any, targetSpatialReference: any = webMercator): Geometry | null => {
  if (!geometry) {
    // console.log("[createGeometry] Null or undefined geometry provided");
    return null;
  }

  // Add detailed logging of input geometry
  // console.log(`[createGeometry] Input geometry type: ${geometry.type || typeof geometry}`);
  // console.log(`[createGeometry] Input spatial reference:`, geometry.spatialReference || 'undefined');
  
  // Use our tracing helper to log input coordinates
  // if (geometry.x !== undefined && geometry.y !== undefined) {
  //   traceCoordinates([geometry.x, geometry.y], "Input Point geometry", geometry.spatialReference);
  // } else if (geometry.points) {
  //   traceCoordinates(geometry.points, "Input MultiPoint geometry", geometry.spatialReference);
  // } else if (geometry.paths) {
  //   traceCoordinates(geometry.paths, "Input Polyline geometry", geometry.spatialReference);
  // } else if (geometry.rings) {
  //   traceCoordinates(geometry.rings, "Input Polygon geometry", geometry.spatialReference);
  // } else if (geometry.coordinates) {
  //   traceCoordinates(geometry.coordinates, "Input GeoJSON geometry", geometry.spatialReference);
  // }

  try {
    // Point geometry
    if (geometry.type === "Point" || geometry.type === "point" || (geometry.x !== undefined && geometry.y !== undefined)) {
      // Handle extreme coordinates before creating the Point
      let x, y;
      
      if (geometry.type === "Point" && Array.isArray(geometry.coordinates)) {
        x = geometry.coordinates[0];
        y = geometry.coordinates[1];
      } else {
        x = geometry.x;
        y = geometry.y;
      }
      
      // Check for extreme values
      if (Math.abs(x) > 1e10 || Math.abs(y) > 1e10) {
        // console.warn(`[createGeometry] EXTREME COORDINATES DETECTED in Point: [${x}, ${y}]`);
      }

      // Create point geometry
      let point: Point;
      
      if (geometry.type === "Point" && Array.isArray(geometry.coordinates)) {
        point = new Point({
          x: geometry.coordinates[0],
          y: geometry.coordinates[1],
        spatialReference: wgs84
        });
        // console.log(`[createGeometry] Created Point from GeoJSON: [${point.x}, ${point.y}], SR: ${point.spatialReference.wkid}`);
      } else {
        // Use the spatial reference from the input geometry or default to WGS84
        const sr = geometry.spatialReference || wgs84;
        point = new Point({
          x: geometry.x,
          y: geometry.y,
          spatialReference: sr
        });
        // console.log(`[createGeometry] Created Point from ESRI format: [${point.x}, ${point.y}], SR: ${point.spatialReference.wkid}`);
      }

      // Project to target spatial reference if needed
      if (targetSpatialReference && point.spatialReference.wkid !== targetSpatialReference.wkid) {
        // console.log(`[createGeometry] Projecting Point from SR: ${point.spatialReference.wkid} to SR: ${targetSpatialReference.wkid}`);
        
        // Check if projection engine is ready
        if (!projection.isLoaded()) {
          // console.warn('[createGeometry] Projection engine not loaded - projection may fail');
          // Continue anyway - the projection will either work or fail in the try/catch
        }
        
        try {
          const projectedPoint = projection.project(point, targetSpatialReference) as Point;
          // console.log(`[createGeometry] Projected Point: [${projectedPoint.x}, ${projectedPoint.y}], SR: ${projectedPoint.spatialReference.wkid}`);
          
          // Check for extreme values after projection
          if (Math.abs(projectedPoint.x) > 1e10 || Math.abs(projectedPoint.y) > 1e10) {
            // console.error(`[createGeometry] EXTREME COORDINATES AFTER PROJECTION: [${projectedPoint.x}, ${projectedPoint.y}]`);
          }
          
          return projectedPoint;
        } catch (projectionError) {
          // console.error(`[createGeometry] Projection error for Point:`, projectionError);
          // Return unprojected point as fallback
          return point;
        }
      }
      
      return point;
    }
    
    // Polygon geometry
    if (geometry.type === "Polygon" || geometry.type === "polygon" || geometry.rings) {
      let rings;
      let sr = wgs84;
      
      // Log more details about the geometry structure
      // console.log(`[createGeometry] Polygon geometry details:`, {
      //   hasType: !!geometry.type,
      //   type: geometry.type,
      //   hasCoordinates: !!geometry.coordinates,
      //   coordsType: geometry.coordinates ? typeof geometry.coordinates : 'undefined',
      //   isArray: geometry.coordinates ? Array.isArray(geometry.coordinates) : false,
      //   hasRings: !!geometry.rings,
      //   ringsType: geometry.rings ? typeof geometry.rings : 'undefined'
      // });
      
      if ((geometry.type === "Polygon" || geometry.type === "polygon") && geometry.coordinates && Array.isArray(geometry.coordinates)) {
        rings = geometry.coordinates;
        // console.log(`[createGeometry] Creating Polygon from GeoJSON with ${rings.length} rings`);
      } else if (geometry.rings && Array.isArray(geometry.rings)) {
        rings = geometry.rings;
        sr = geometry.spatialReference || wgs84;
        // console.log(`[createGeometry] Creating Polygon from ESRI format with ${rings.length} rings, SR: ${sr.wkid}`);
      } else if (geometry.type === "polygon" && !geometry.coordinates && !geometry.rings) {
        // Special case: GeoJSON geometry with lowercase type but missing coordinates
        // Try to find coordinates elsewhere in the object
        // console.log(`[createGeometry] Trying to find rings in polygon with missing coordinates property`);
        
        // Look for coordinates in the geometry object
        const potentialCoords = Object.entries(geometry)
          .filter(([key, value]) => key !== 'type' && Array.isArray(value))
          .map(([key, value]) => ({ key, value }));
          
        // console.log(`[createGeometry] Found ${potentialCoords.length} potential coordinate arrays`);
        
        if (potentialCoords.length > 0) {
          // Use the first array found that looks like coordinates
          const coordCandidate = potentialCoords[0].value as any[];
          // console.log(`[createGeometry] Using ${potentialCoords[0].key} as potential rings`, coordCandidate);
          
          // Check if it's nested arrays (common for polygon rings)
          if (Array.isArray(coordCandidate[0])) {
            rings = coordCandidate as number[][][];
            // console.log(`[createGeometry] Using recovered rings with ${rings.length} elements`);
          }
        }
        
        if (!rings) {
          // console.error("[createGeometry] Could not recover valid rings from polygon geometry");
          return null;
        }
      } else {
        // console.error("[createGeometry] Invalid Polygon geometry - missing valid rings/coordinates");
        return null;
      }

      // Validate polygon rings
      if (!rings || !Array.isArray(rings) || rings.length === 0) {
        // console.error("[createGeometry] Invalid Polygon rings:", rings);
        return null;
      }

      // Trace rings for debugging
      // traceCoordinates(rings, "Polygon rings before creating geometry", sr);
      
      // Check for extreme values in rings
      let hasExtremeValues = false;
      rings.forEach((ring, ringIndex) => {
        if (Array.isArray(ring)) {
          ring.forEach((coord, coordIndex) => {
            if (Array.isArray(coord) && coord.length >= 2) {
              if (Math.abs(coord[0]) > 1e10 || Math.abs(coord[1]) > 1e10) {
                // console.warn(`[createGeometry] EXTREME COORDINATES in ring ${ringIndex}, coord ${coordIndex}: [${coord[0]}, ${coord[1]}]`);
                hasExtremeValues = true;
              }
            }
          });
        }
      });
      
      // Normalize rings if extreme values were found
      if (hasExtremeValues) {
        // console.log(`[createGeometry] Found extreme coordinates in input rings, normalizing before polygon creation`);
        const wkid = sr.wkid || 4326; // Default to WGS84 if no wkid
        rings = normalizeCoordinates(rings, wkid);
        
        if (rings.length === 0) {
          // console.error(`[createGeometry] Failed to normalize input rings, no valid rings left`);
          return null;
        }
        
        // console.log(`[createGeometry] Successfully normalized input rings to ${rings.length} valid rings`);
      }
      
      // Create polygon
      const polygon = new Polygon({
        rings: rings,
        spatialReference: sr
      });
      
      // console.log(`[createGeometry] Created Polygon with ${polygon.rings.length} rings, SR: ${polygon.spatialReference.wkid}`);
      
      // Project to target spatial reference if needed
      if (targetSpatialReference && polygon.spatialReference.wkid !== targetSpatialReference.wkid) {
        // console.log(`[createGeometry] Projecting Polygon from SR: ${polygon.spatialReference.wkid} to SR: ${targetSpatialReference.wkid}`);
        
        // Check if projection engine is ready
        if (!projection.isLoaded()) {
          // console.warn('[createGeometry] Projection engine not loaded - projection may fail');
          // Continue anyway - the projection will either work or fail in the try/catch
        }
        
        try {
          const projectedPolygon = projection.project(polygon, targetSpatialReference) as Polygon;
          // console.log(`[createGeometry] Projected Polygon has ${projectedPolygon.rings.length} rings, SR: ${projectedPolygon.spatialReference.wkid}`);
          
          // Check for extreme values after projection
          let hasExtremeValues = false;
          projectedPolygon.rings.forEach((ring, ringIndex) => {
            ring.forEach((coord, coordIndex) => {
              if (Array.isArray(coord) && coord.length >= 2) {
                if (Math.abs(coord[0]) > 1e10 || Math.abs(coord[1]) > 1e10) {
                  // console.error(`[createGeometry] EXTREME COORDINATES AFTER PROJECTION in ring ${ringIndex}, coord ${coordIndex}: [${coord[0]}, ${coord[1]}]`);
                  hasExtremeValues = true;
                }
              }
            });
          });
          
          if (hasExtremeValues) {
            console.error(`[createGeometry] Projection resulted in extreme coordinates. Original SR: ${polygon.spatialReference.wkid}, Target SR: ${targetSpatialReference.wkid}`);
            
            // Try to normalize the extreme coordinates
            // console.log(`[createGeometry] Attempting to normalize extreme coordinates`);
            const normalizedRings = normalizeCoordinates(projectedPolygon.rings, targetSpatialReference.wkid);
            
            // If we have valid rings after normalization, create a new polygon
            if (normalizedRings.length > 0) {
              // console.log(`[createGeometry] Creating new polygon with normalized coordinates`);
              const normalizedPolygon = new Polygon({
                rings: normalizedRings,
                spatialReference: targetSpatialReference
              });
              return normalizedPolygon;
            } else {
              // console.warn(`[createGeometry] Normalization failed, returning original polygon`);
            }
          }
          
          return projectedPolygon;
        } catch (projectionError) {
          // console.error(`[createGeometry] Projection error for Polygon:`, projectionError);
          
          // Try to create a polygon in the target SR directly by normalizing the input coordinates
          try {
            // console.log(`[createGeometry] Attempting direct conversion to target SR without projection`);
            const normalizedRings = normalizeCoordinates(polygon.rings, targetSpatialReference.wkid);
            
            if (normalizedRings.length > 0) {
              const directPolygon = new Polygon({
                rings: normalizedRings,
                spatialReference: targetSpatialReference
              });
              // console.log(`[createGeometry] Created polygon directly in target SR: ${targetSpatialReference.wkid}`);
              return directPolygon;
            }
          } catch (directError) {
            // console.error(`[createGeometry] Direct conversion failed:`, directError);
          }
          
          // Return unprojected polygon as fallback
          return polygon;
        }
      }
      
      return polygon;
    }
    
    // Unsupported geometry type
    // console.error(`[createGeometry] Unsupported geometry type: ${geometry.type || typeof geometry}`);
    return null;
  } catch (error) {
    console.error("[createGeometry] Error creating geometry:", error);
    return null;
  }
} 