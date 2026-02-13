// lib/data-adapters/poc-data-adapter.ts
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

export class PocDataAdapter {
  static fromEsriVisualization(data: any): UniversalData {
    const features = data.features.map((feature: any, index: number) => ({
      id: feature.attributes.OBJECTID?.toString() || `feature-${index}`,
      properties: feature.attributes,
      geometry: feature.geometry ? {
        type: feature.geometry.type,
        coordinates: feature.geometry.coordinates || 
          (feature.geometry.rings ? feature.geometry.rings[0] : [])
      } : null
    }));

    const fields = Object.keys(data.features[0]?.attributes || {}).map(key => ({
      name: key,
      type: this.inferFieldType(data.features[0].attributes[key]),
      displayName: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }));

    return {
      features,
      fields,
      metadata: {
        title: data.layerName || 'Query Results',
        visualizationType: 'choropleth',
        rendererField: data.rendererField
      }
    };
  }

  static toKeplerFormat(data: UniversalData): any {
    // Kepler.gl expects fields and rows format
    const fields = [...data.fields];
    
    // Add lat/lng fields if we have geometry
    const hasGeometry = data.features.some(f => f.geometry);
    if (hasGeometry) {
      fields.push(
        { name: 'lat', type: 'number' as const, displayName: 'Latitude' },
        { name: 'lng', type: 'number' as const, displayName: 'Longitude' }
      );
    }

    const rows = data.features.map(feature => {
      // Start with property values in field order
      const row = data.fields.map(field => feature.properties[field.name]);
      
      // Add lat/lng if geometry exists
      if (hasGeometry && feature.geometry) {
        if (feature.geometry.type === 'Point') {
          const coords = feature.geometry.coordinates as [number, number];
          row.push(coords[1], coords[0]); // lat, lng
        } else {
          row.push(null, null);
        }
      }
      
      return row;
    });

    const keplerData = {
      fields: fields.map(field => ({
        name: field.name,
        type: field.type === 'number' ? 'real' : 
              field.type === 'boolean' ? 'boolean' : 
              field.type === 'date' ? 'timestamp' : 'string',
        format: field.type === 'date' ? 'YYYY-MM-DD' : ''
      })),
      rows
    };

    console.log('Generated Kepler data:', {
      fieldCount: keplerData.fields.length,
      rowCount: keplerData.rows.length,
      fields: keplerData.fields,
      sampleRows: keplerData.rows.slice(0, 2)
    });
    
    return keplerData;
  }

  private static inferFieldType(value: any): 'string' | 'number' | 'boolean' | 'date' {
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (value instanceof Date) return 'date';
    return 'string';
  }

  private static geometryToWkt(geometry: GeoJSON.Geometry): string {
    // Simple WKT conversion for POC
    if (geometry.type === 'Point') {
      const coords = geometry.coordinates as [number, number];
      return `POINT(${coords[0]} ${coords[1]})`;
    }
    if (geometry.type === 'Polygon') {
      const coords = geometry.coordinates as number[][][];
      const ring = coords[0].map(coord => `${coord[0]} ${coord[1]}`).join(',');
      return `POLYGON((${ring}))`;
    }
    return '';
  }
} 