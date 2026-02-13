import { MultiLayerAnalysis } from './multi-layer-analyzer';
import { FeatureCollection } from 'geojson';

describe('MultiLayerAnalysis.combineLayerData', () => {
  it('merges features and sets required fields for multi-metric queries', () => {
    // Mock layer data
    const layer1: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { ID: 1, thematic_value: 10, CONVERSION_RATE: 0.5 },
          geometry: { type: 'Point', coordinates: [0, 0] }
        },
        {
          type: 'Feature',
          properties: { ID: 2, thematic_value: 15, CONVERSION_RATE: 0.7 },
          geometry: { type: 'Point', coordinates: [1, 1] }
        }
      ]
    };
    const layer2: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { ID: 1, thematic_value: 20, DIVERSITY: 0.8 },
          geometry: { type: 'Point', coordinates: [0, 0] }
        },
        {
          type: 'Feature',
          properties: { ID: 2, thematic_value: 25, DIVERSITY: 0.9 },
          geometry: { type: 'Point', coordinates: [1, 1] }
        }
      ]
    };

    // Mock configs
    const layerConfigsObject = {
      '66': { microserviceField: 'CONVERSION_RATE' },
      '25': { microserviceField: 'DIVERSITY' }
    };

    // Mock analysisResult
    const analysisResult: any = {
      relevantFields: ['CONVERSION_RATE_66', 'DIVERSITY_25'],
      relevantLayers: ['66', '25']
    };

    // Call the function
    const result = MultiLayerAnalysis.combineLayerData(
      [layer1, layer2],
      ['66', '25'],
      analysisResult,
      layerConfigsObject
    );

    // There should be two features, with both required fields set
    expect(result.features).toHaveLength(2);
    result.features.forEach((feature, idx) => {
      const props = feature.properties;
      expect(props).toBeDefined();
      if (!props) return;
      expect(props.CONVERSION_RATE_66).toBeDefined();
      expect(props.DIVERSITY_25).toBeDefined();
      // Check correct values for each feature
      if (props.ID === 1) {
        expect(props.CONVERSION_RATE_66).toBe(0.5);
        expect(props.DIVERSITY_25).toBe(0.8);
      } else if (props.ID === 2) {
        expect(props.CONVERSION_RATE_66).toBe(0.7);
        expect(props.DIVERSITY_25).toBe(0.9);
      }
    });
  });

  it('sets required fields to null if no join match', () => {
    const layer1: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { ID: 1, thematic_value: 10, CONVERSION_RATE: 0.5 },
          geometry: { type: 'Point', coordinates: [0, 0] }
        }
      ]
    };
    const layer2: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { ID: 2, thematic_value: 25, DIVERSITY: 0.9 },
          geometry: { type: 'Point', coordinates: [1, 1] }
        }
      ]
    };
    const layerConfigsObject = {
      '66': { microserviceField: 'CONVERSION_RATE' },
      '25': { microserviceField: 'DIVERSITY' }
    };
    const analysisResult: any = {
      relevantFields: ['CONVERSION_RATE_66', 'DIVERSITY_25'],
      relevantLayers: ['66', '25']
    };
    const result = MultiLayerAnalysis.combineLayerData(
      [layer1, layer2],
      ['66', '25'],
      analysisResult,
      layerConfigsObject
    );
    expect(result.features).toHaveLength(1);
    const props = result.features[0].properties;
    expect(props).toBeDefined();
    if (!props) return;
    expect(props.CONVERSION_RATE_66).toBe(0.5);
    expect(props.DIVERSITY_25).toBeNull();
  });

  it('sets extra required fields to null if not present in any layer', () => {
    const layer1: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { ID: 1, thematic_value: 10 },
          geometry: { type: 'Point', coordinates: [0, 0] }
        }
      ]
    };
    const layer2: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { ID: 1, thematic_value: 20 },
          geometry: { type: 'Point', coordinates: [0, 0] }
        }
      ]
    };
    const layerConfigsObject = {
      '66': { microserviceField: 'CONVERSION_RATE' },
      '25': { microserviceField: 'DIVERSITY' }
    };
    const analysisResult: any = {
      relevantFields: ['CONVERSION_RATE_66', 'DIVERSITY_25', 'EXTRA_FIELD_99'],
      relevantLayers: ['66', '25']
    };
    const result = MultiLayerAnalysis.combineLayerData(
      [layer1, layer2],
      ['66', '25'],
      analysisResult,
      layerConfigsObject
    );
    expect(result.features).toHaveLength(1);
    const props = result.features[0].properties;
    expect(props).toBeDefined();
    if (!props) return;
    expect(props.CONVERSION_RATE_66).toBeNull();
    expect(props.DIVERSITY_25).toBeNull();
    expect(props.EXTRA_FIELD_99).toBeNull();
  });

  it('merges three layers and sets all required fields', () => {
    const layer1: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { ID: 1, thematic_value: 10, CONVERSION_RATE: 0.5 },
          geometry: { type: 'Point', coordinates: [0, 0] }
        }
      ]
    };
    const layer2: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { ID: 1, thematic_value: 20, DIVERSITY: 0.8 },
          geometry: { type: 'Point', coordinates: [0, 0] }
        }
      ]
    };
    const layer3: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { ID: 1, thematic_value: 30, RATE: 0.2 },
          geometry: { type: 'Point', coordinates: [0, 0] }
        }
      ]
    };
    const layerConfigsObject = {
      '66': { microserviceField: 'CONVERSION_RATE' },
      '25': { microserviceField: 'DIVERSITY' },
      '30': { microserviceField: 'RATE' }
    };
    const analysisResult: any = {
      relevantFields: ['CONVERSION_RATE_66', 'DIVERSITY_25', 'RATE_30'],
      relevantLayers: ['66', '25', '30']
    };
    const result = MultiLayerAnalysis.combineLayerData(
      [layer1, layer2, layer3],
      ['66', '25', '30'],
      analysisResult,
      layerConfigsObject
    );
    expect(result.features).toHaveLength(1);
    const props = result.features[0].properties;
    expect(props).toBeDefined();
    if (!props) return;
    expect(props.CONVERSION_RATE_66).toBe(0.5);
    expect(props.DIVERSITY_25).toBe(0.8);
    expect(props.RATE_30).toBe(0.2);
  });

  it('handles mismatched field types gracefully', () => {
    const layer1: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { ID: 1, thematic_value: 'not-a-number', CONVERSION_RATE: null },
          geometry: { type: 'Point', coordinates: [0, 0] }
        }
      ]
    };
    const layer2: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { ID: 1, thematic_value: 20, DIVERSITY: 'high' },
          geometry: { type: 'Point', coordinates: [0, 0] }
        }
      ]
    };
    const layerConfigsObject = {
      '66': { microserviceField: 'CONVERSION_RATE' },
      '25': { microserviceField: 'DIVERSITY' }
    };
    const analysisResult: any = {
      relevantFields: ['CONVERSION_RATE_66', 'DIVERSITY_25'],
      relevantLayers: ['66', '25']
    };
    const result = MultiLayerAnalysis.combineLayerData(
      [layer1, layer2],
      ['66', '25'],
      analysisResult,
      layerConfigsObject
    );
    expect(result.features).toHaveLength(1);
    const props = result.features[0].properties;
    expect(props).toBeDefined();
    if (!props) return;
    expect(props.CONVERSION_RATE_66).toBeNull(); // null is preserved
    expect(props.DIVERSITY_25).toBe('high'); // string is preserved
  });
}); 