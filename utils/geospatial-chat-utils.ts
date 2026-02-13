'use client';

import Point from "@arcgis/core/geometry/Point";
import * as projection from "@arcgis/core/geometry/projection";
import SpatialReference from "@arcgis/core/geometry/SpatialReference";
import { GeospatialFeature } from "@/lib/analytics/types";

const processAndProjectGeometryV2 = async (feature: any): Promise<GeospatialFeature | null> => {
    // First, let's normalize the feature data structure
    const normalizedFeature = {
      // Start with any top-level properties that aren't special keys
      properties: { 
        ...Object.entries(feature)
          .filter(([key]) => !['geometry', 'attributes', 'properties'].includes(key))
          .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),
        // Then add any existing attributes
        ...(feature.attributes || {}),
        // And any properties
        ...(feature.properties || {})
      },
      // Keep the geometry if it exists
      geometry: feature.geometry
    };

    // Check for ID first, then fall back to FSA/ZIP_CODE
    const id = normalizedFeature.properties['ID'] || normalizedFeature.properties['OBJECTID'];
    const fsa = normalizedFeature.properties['FSA'] || normalizedFeature.properties['ZIP_CODE'];
    
    // If we have an ID, make sure it's in both places for joining
    if (id) {
      normalizedFeature.properties['ID'] = id;
      normalizedFeature.properties['FSA'] = id; // Use ID as FSA for joining
    } else if (fsa) {
      // If we only have FSA, use it as both
      normalizedFeature.properties['ID'] = fsa;
      normalizedFeature.properties['FSA'] = fsa;
    } else {
      console.warn('[GeospatialUtilsV2] Skipping feature with no ID or FSA/ZIP_CODE:', feature);
      return null;
    }

    // Now check if we have either geometry or lat/lon in various possible locations
    const hasGeometry = !!normalizedFeature.geometry;
    const hasLatLon = (
      // Check in properties
      (typeof normalizedFeature.properties.latitude === 'number' && 
       typeof normalizedFeature.properties.longitude === 'number') ||
      (typeof normalizedFeature.properties.lat === 'number' && 
       typeof normalizedFeature.properties.lon === 'number') ||
      // Check in root
      (typeof feature.latitude === 'number' && 
       typeof feature.longitude === 'number') ||
      (typeof feature.lat === 'number' && 
       typeof feature.lon === 'number')
    );

    // If we have neither geometry nor lat/lon, try to get coordinates from the FSA/ZIP lookup service
    if (!hasGeometry && !hasLatLon) {
      // For now, return null - in future we can add FSA/ZIP lookup service
      console.warn('[GeospatialUtilsV2] Feature has no geometry or lat/lon. Will need FSA/ZIP lookup service:', normalizedFeature.properties.ID);
      return null;
    }
  
    try {
      let geometry = normalizedFeature.geometry;
      
      // If no geometry but lat/lon exist, create a Point geometry
      if (!geometry && hasLatLon) {
        const lat = normalizedFeature.properties.latitude || normalizedFeature.properties.lat || feature.latitude || feature.lat;
        const lon = normalizedFeature.properties.longitude || normalizedFeature.properties.lon || feature.longitude || feature.lon;
        geometry = new Point({
          latitude: lat,
          longitude: lon,
          spatialReference: new SpatialReference({ wkid: 4326 })
        });
      }
  
      if (!geometry) {
        console.warn('[GeospatialUtilsV2] Feature has no actionable geometry after checking all locations:', normalizedFeature.properties.ID);
        return null;
      }
      
      await projection.load();
      const outSpatialReference = new SpatialReference({ wkid: 4326 });
  
      // Project if necessary
      if (geometry.spatialReference && !geometry.spatialReference.equals(outSpatialReference)) {
        geometry = projection.project(geometry, outSpatialReference) as __esri.Geometry;
      }
  
      // Return a standardized feature object with all original attributes preserved
      return {
        type: 'Feature',
        geometry: geometry,
        properties: normalizedFeature.properties
      };
  
    } catch (error) {
      console.error('[GeospatialUtilsV2] Error processing feature geometry:', { feature, error });
      return null;
    }
  };
  

export const geospatialChatUtils = {
    processAndProjectGeometry: async (feature: any): Promise<any> => {
        if (!feature || !feature.geometry) {
            return feature;
        }

        try {
            await projection.load();
            const outSpatialReference = new SpatialReference({ wkid: 4326 });

            if (feature.geometry.spatialReference && !feature.geometry.spatialReference.equals(outSpatialReference)) {
                const projectedGeometry = projection.project(feature.geometry, outSpatialReference);
                return {
                    ...feature,
                    geometry: projectedGeometry
                };
            }
            return feature;

        } catch (error) {
            console.error("Error processing feature geometry:", error);
            return feature;
        }
    },
    processAndProjectGeometryV2,
}; 