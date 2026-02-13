export interface UniversalData {
  features: Array<{
    id: string;
    properties: Record<string, any>;
    geometry?: GeoJSON.Geometry;
  }>;
  fields: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'date';
    displayName?: string;
  }>;
  metadata: {
    title: string;
    visualizationType: string;
    rendererField?: string;
  };
}

export class EsriToKeplerAdapter {
  static fromVisualizationResult(visualizationResult: any): UniversalData {
    if (!visualizationResult?.layer?.source) {
      throw new Error('Invalid visualization result - no layer source');
    }

    // Convert ESRI layer source to features array
    const sourceFeatures = Array.isArray(visualizationResult.layer.source) 
      ? visualizationResult.layer.source 
      : Array.from(visualizationResult.layer.source || []);

    const features = sourceFeatures.map((feature: any, index: number) => {
      const id = feature.attributes?.OBJECTID?.toString() || 
                 feature.attributes?.FSA_ID?.toString() || 
                 `feature-${index}`;

      return {
        id,
        properties: feature.attributes || {},
        geometry: this.convertEsriGeometry(feature.geometry)
      };
    });

    // Extract field information from first feature
    const sampleFeature = sourceFeatures[0];
    const fields = sampleFeature?.attributes ? 
      Object.keys(sampleFeature.attributes).map(key => ({
        name: key,
        type: this.inferFieldType(sampleFeature.attributes[key]),
        displayName: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      })) : [];

    // Determine visualization type from renderer
    const visualizationType = this.getVisualizationType(visualizationResult.layer.renderer);
    
    return {
      features,
      fields,
      metadata: {
        title: visualizationResult.layer.title || 'Query Results',
        visualizationType,
        rendererField: visualizationResult.layer.renderer?.field
      }
    };
  }

  static toKeplerFormat(data: UniversalData): any {
    // Create fields array for Kepler.gl
    const fields = data.fields.map(field => ({
      name: field.name,
      type: field.type === 'number' ? 'real' : field.type,
      format: ''
    }));

    // Add geometry field for GeoJSON
    fields.push({ name: 'geometry', type: 'geojson', format: '' });

    // Create rows array
    const rows = data.features.map(feature => {
      const row = data.fields.map(field => feature.properties[field.name]);
      
      // Add geometry as GeoJSON
      if (feature.geometry) {
        row.push(JSON.stringify(feature.geometry));
      } else {
        row.push(null);
      }
      
      return row;
    });

    return { fields, rows };
  }

  static createKeplerConfig(data: UniversalData): any {
    const visualizationType = data.metadata.visualizationType;
    const rendererField = data.metadata.rendererField;

    // Base layer configuration with columns
    const columns: any = {
      geojson: { value: 'geometry', fieldIdx: data.fields.length }
    };

    // Add color field if renderer field exists
    if (rendererField && data.fields.some(f => f.name === rendererField)) {
      const fieldIndex = data.fields.findIndex(f => f.name === rendererField);
      columns.colorField = {
        value: rendererField,
        fieldIdx: fieldIndex
      };
    }

    const layerConfig = {
      id: `layer-${Date.now()}`,
      type: this.getKeplerLayerType(visualizationType),
      config: {
        dataId: 'visualization-data',
        label: data.metadata.title,
        color: [255, 0, 0],
        columns,
        isVisible: true,
        visConfig: this.getVisualConfig(visualizationType, rendererField)
      }
    };

    return {
      version: 'v1',
      config: {
        visState: {
          filters: [],
          layers: [layerConfig],
          interactionConfig: {
            tooltip: {
              fieldsToShow: {
                'visualization-data': data.fields.slice(0, 5).map(f => f.name)
              }
            }
          }
        },
        mapState: {
          bearing: 0,
          dragRotate: false,
          latitude: 45.0,
          longitude: -100.0,
          pitch: 0,
          zoom: 4
        }
      }
    };
  }

  private static convertEsriGeometry(esriGeometry: any): GeoJSON.Geometry | null {
    if (!esriGeometry) return null;

    try {
      // Handle different ESRI geometry types
      if (esriGeometry.rings) {
        // Polygon geometry
        return {
          type: 'Polygon',
          coordinates: esriGeometry.rings
        };
      } else if (esriGeometry.paths) {
        // Polyline geometry
        return {
          type: 'LineString',
          coordinates: esriGeometry.paths[0]
        };
      } else if (esriGeometry.x !== undefined && esriGeometry.y !== undefined) {
        // Point geometry
        return {
          type: 'Point',
          coordinates: [esriGeometry.x, esriGeometry.y]
        };
      } else if (esriGeometry.type === 'polygon' && esriGeometry.coordinates) {
        // Already in GeoJSON format
        return esriGeometry;
      } else if (esriGeometry.type === 'point' && esriGeometry.coordinates) {
        // Already in GeoJSON format
        return esriGeometry;
      }
    } catch (error) {
      console.warn('Failed to convert ESRI geometry:', error);
    }

    return null;
  }

  private static inferFieldType(value: any): 'string' | 'number' | 'boolean' | 'date' {
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (value instanceof Date) return 'date';
    return 'string';
  }

  private static getVisualizationType(renderer: any): string {
    if (!renderer) return 'simple';
    
    if (renderer.type === 'class-breaks') return 'choropleth';
    if (renderer.type === 'heatmap') return 'heatmap';
    if (renderer.type === 'unique-value') return 'categorical';
    
    return 'simple';
  }

  private static getKeplerLayerType(visualizationType: string): string {
    const typeMap: Record<string, string> = {
      'choropleth': 'geojson',
      'heatmap': 'heatmap',
      'categorical': 'geojson',
      'point': 'point',
      'simple': 'geojson'
    };
    
    return typeMap[visualizationType] || 'geojson';
  }

  private static getVisualConfig(visualizationType: string, rendererField?: string): any {
    const baseConfig = {
      opacity: 0.8,
      strokeOpacity: 0.8,
      thickness: 0.5,
      strokeColor: [255, 255, 255]
    };

    if (visualizationType === 'choropleth') {
      return {
        ...baseConfig,
        colorRange: {
          name: 'Global Warming',
          type: 'sequential',
          category: 'Uber',
          colors: ['#5A1846', '#900C3F', '#C70039', '#E3611C', '#F1920E', '#FFC300']
        },
        strokeColorRange: {
          name: 'Global Warming',
          type: 'sequential',
          category: 'Uber',
          colors: ['#5A1846', '#900C3F', '#C70039', '#E3611C', '#F1920E', '#FFC300']
        }
      };
    }

    if (visualizationType === 'heatmap') {
      return {
        opacity: 0.8,
        colorRange: {
          name: 'Global Warming',
          type: 'sequential',
          category: 'Uber',
          colors: ['#5A1846', '#900C3F', '#C70039', '#E3611C', '#F1920E', '#FFC300']
        },
        radius: 20
      };
    }

    return baseConfig;
  }
} 