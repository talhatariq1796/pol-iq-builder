export interface KeplerDataPoint {
  id: string;
  latitude: number;
  longitude: number;
  [key: string]: any;
}

export interface KeplerDataset {
  info: {
    id: string;
    label: string;
  };
  data: {
    fields: Array<{
      name: string;
      type: string;
    }>;
    rows: any[][];
  };
}

export class KeplerDataAdapter {
  /**
   * Convert ArcGIS visualization result to Kepler.gl format
   */
  static convertVisualizationData(visualizationResult: any): KeplerDataset | null {
    if (!visualizationResult?.layer?.source) {
      console.log('No visualization data to convert');
      return null;
    }

    try {
      // Extract features from ArcGIS layer
      const features = Array.isArray(visualizationResult.layer.source) 
        ? visualizationResult.layer.source 
        : Array.from(visualizationResult.layer.source || []);

      if (features.length === 0) {
        console.log('No features found in visualization layer');
        return null;
      }

      // Get field information from the first feature
      const firstFeature = features[0];
      const attributes = firstFeature.attributes || {};
      const geometry = firstFeature.geometry;

      // Extract coordinate information
      let coordinates: [number, number] | null = null;
      
      if (geometry) {
        if (geometry.type === 'point') {
          coordinates = [geometry.longitude, geometry.latitude];
        } else if (geometry.type === 'polygon' && geometry.centroid) {
          coordinates = [geometry.centroid.longitude, geometry.centroid.latitude];
        } else if (geometry.rings && geometry.rings.length > 0) {
          // Calculate centroid for polygon
          const ring = geometry.rings[0];
          if (ring.length > 0) {
            const sumX = ring.reduce((sum: number, point: number[]) => sum + point[0], 0);
            const sumY = ring.reduce((sum: number, point: number[]) => sum + point[1], 0);
            coordinates = [sumX / ring.length, sumY / ring.length];
          }
        }
      }

      if (!coordinates) {
        console.log('Unable to extract coordinates from geometry');
        return null;
      }

      // Define fields for Kepler.gl
      const fields = [
        { name: 'id', type: 'string' },
        { name: 'longitude', type: 'real' },
        { name: 'latitude', type: 'real' }
      ];

      // Add attribute fields
      Object.keys(attributes).forEach(key => {
        const value = attributes[key];
        const type = typeof value === 'number' ? 'real' : 'string';
        fields.push({ name: key, type });
      });

      // Convert features to rows
      const rows = features.map((feature: any, index: number) => {
        const attrs = feature.attributes || {};
        const geom = feature.geometry;
        
        // Extract coordinates for this feature
        let featureCoords: [number, number] = [0, 0];
        
        if (geom) {
          if (geom.type === 'point') {
            featureCoords = [geom.longitude, geom.latitude];
          } else if (geom.type === 'polygon' && geom.centroid) {
            featureCoords = [geom.centroid.longitude, geom.centroid.latitude];
          } else if (geom.rings && geom.rings.length > 0) {
            const ring = geom.rings[0];
            if (ring.length > 0) {
              const sumX = ring.reduce((sum: number, point: number[]) => sum + point[0], 0);
              const sumY = ring.reduce((sum: number, point: number[]) => sum + point[1], 0);
              featureCoords = [sumX / ring.length, sumY / ring.length];
            }
          }
        }

        // Build row data
        const row = [
          feature.id || `feature_${index}`,
          featureCoords[0], // longitude
          featureCoords[1], // latitude
          ...Object.keys(attributes).map(key => attrs[key] || null)
        ];

        return row;
      });

      const dataset: KeplerDataset = {
        info: {
          id: 'arcgis-data',
          label: visualizationResult.layer.title || 'ArcGIS Data'
        },
        data: {
          fields,
          rows
        }
      };

      console.log('✅ Converted visualization data for Kepler.gl:', {
        features: features.length,
        fields: fields.length,
        rows: rows.length
      });

      return dataset;
    } catch (error) {
      console.error('❌ Error converting visualization data:', error);
      return null;
    }
  }

  /**
   * Convert GeoJSON-like features to Kepler.gl format
   */
  static convertGeoJSONFeatures(features: any[]): KeplerDataset | null {
    if (!features || features.length === 0) {
      return null;
    }

    try {
      const firstFeature = features[0];
      const properties = firstFeature.properties || {};
      
      // Define fields
      const fields = [
        { name: 'id', type: 'string' },
        { name: 'longitude', type: 'real' },
        { name: 'latitude', type: 'real' }
      ];

      // Add property fields
      Object.keys(properties).forEach(key => {
        const value = properties[key];
        const type = typeof value === 'number' ? 'real' : 'string';
        fields.push({ name: key, type });
      });

      // Convert features to rows
      const rows = features.map((feature: any, index: number) => {
        const props = feature.properties || {};
        const geom = feature.geometry;
        
        // Extract coordinates
        let coordinates: [number, number] = [0, 0];
        
        if (geom) {
          if (geom.type === 'Point') {
            coordinates = geom.coordinates;
          } else if (geom.type === 'Polygon' && geom.coordinates.length > 0) {
            // Calculate centroid
            const ring = geom.coordinates[0];
            const sumX = ring.reduce((sum: number, point: number[]) => sum + point[0], 0);
            const sumY = ring.reduce((sum: number, point: number[]) => sum + point[1], 0);
            coordinates = [sumX / ring.length, sumY / ring.length];
          }
        }

        const row = [
          feature.id || `feature_${index}`,
          coordinates[0], // longitude
          coordinates[1], // latitude
          ...Object.keys(properties).map(key => props[key] || null)
        ];

        return row;
      });

      return {
        info: {
          id: 'geojson-data',
          label: 'GeoJSON Data'
        },
        data: {
          fields,
          rows
        }
      };
    } catch (error) {
      console.error('❌ Error converting GeoJSON features:', error);
      return null;
    }
  }
} 