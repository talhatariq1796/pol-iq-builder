/// <reference types="jest" />

import { MultivariateVisualization } from '../multivariate-visualization';
import { LayerField } from '../../../types/layers';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Graphic from '@arcgis/core/Graphic';
import Point from '@arcgis/core/geometry/Point';
import Polygon from '@arcgis/core/geometry/Polygon';
import Collection from '@arcgis/core/core/Collection';

// Create a custom field type for test that matches the expected format
interface MultivariateField {
  name: string;
  label: string;
  type: string;
  breaks?: number[];
  visualVariable?: 'color' | 'size' | 'shape' | 'opacity';
}

jest.mock('@arcgis/core/layers/FeatureLayer');
jest.mock('@arcgis/core/Graphic');
jest.mock('@arcgis/core/geometry/Polygon');
jest.mock('@arcgis/core/core/Collection');

const MockFeatureLayer = FeatureLayer as unknown as jest.Mock;
const MockPolygon = Polygon as unknown as jest.Mock;
const MockCollection = Collection as unknown as jest.Mock;

describe('MultivariateVisualization', () => {
  let visualization: MultivariateVisualization;
  let mockFeatures: __esri.Graphic[];
  let mockFields: MultivariateField[];
  let mockFieldBreaks: number[][];

  beforeEach(() => {
    visualization = new MultivariateVisualization();

    // Create mock polygon features
    mockFeatures = [
      new Graphic({
        geometry: new Polygon({
          rings: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]
        }),
        attributes: {
          income: 50000,
          age: 35,
          education: 16
        }
      }),
      new Graphic({
        geometry: new Polygon({
          rings: [[[1, 0], [1, 1], [2, 1], [2, 0], [1, 0]]]
        }),
        attributes: {
          income: 75000,
          age: 45,
          education: 18
        }
      }),
      new Graphic({
        geometry: new Polygon({
          rings: [[[2, 0], [2, 1], [3, 1], [3, 0], [2, 0]]]
        }),
        attributes: {
          income: 100000,
          age: 55,
          education: 20
        }
      })
    ];

    // Create mock fields
    mockFields = [
      {
        name: 'income',
        label: 'Income',
        type: 'double',
        visualVariable: 'color'
      },
      {
        name: 'age',
        label: 'Age',
        type: 'double',
        visualVariable: 'size'
      },
      {
        name: 'education',
        label: 'Years of Education',
        type: 'double',
        visualVariable: 'opacity'
      }
    ];

    // Create mock field breaks
    mockFieldBreaks = [
      [60000, 80000],  // Income breaks
      [40, 50],        // Age breaks
      [17, 19]         // Education breaks
    ];

    // Reset all mocks
    jest.clearAllMocks();
  });

  it('should create a feature layer with correct classifications', async () => {
    const mockCollection = new Collection();
    mockCollection.toArray = jest.fn().mockReturnValue(mockFeatures);
    MockFeatureLayer.mockImplementation(() => ({
      source: mockCollection,
      title: 'Test Multivariate Layer',
      renderer: {
        type: 'unique-value',
        field: 'classification',
        uniqueValueInfos: []
      }
    }));

    const result = await visualization.create({
      features: mockFeatures,
      title: 'Test Multivariate Layer',
      layerName: 'test-layer'
    } as any);

    expect(result.layer!).toBeInstanceOf(FeatureLayer);
    expect(result.layer!.title).toBe('Test Multivariate Layer');
    expect(result.layer!.source.length).toBe(3);

    // Check that classifications were added to features
    const features = (result.layer!.source as unknown as Collection<Graphic>).toArray();
    expect(features[0].attributes.classification).toBe('low-low-low');
    expect(features[1].attributes.classification).toBe('medium-medium-medium');
    expect(features[2].attributes.classification).toBe('high-high-high');
  });

  it('should calculate correct extent', async () => {
    const mockExtent = {
      xmin: -0.1,
      xmax: 3.1,
      ymin: -0.1,
      ymax: 1.1,
      clone: jest.fn().mockReturnThis(),
      union: jest.fn().mockReturnThis(),
      expand: jest.fn()
    };

    MockPolygon.mockImplementation(() => ({
      extent: mockExtent
    }));

    const result = await visualization.create({
      features: mockFeatures,
      title: 'Test Multivariate Layer',
      layerName: 'test-layer'
    } as any);

    expect(result.extent!).toBeDefined();
    expect(result.extent!.xmin).toBeLessThan(0);  // Account for padding
    expect(result.extent!.xmax).toBeGreaterThan(3);  // Account for padding
    expect(result.extent!.ymin).toBeLessThan(0);  // Account for padding
    expect(result.extent!.ymax).toBeGreaterThan(1);  // Account for padding
  });

  it('should handle missing values gracefully', async () => {
    const featuresWithMissingValues = [
      new Graphic({
        geometry: new Polygon({
          rings: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]
        }),
        attributes: {
          income: null,
          age: 35,
          education: 16
        }
      })
    ];

    const mockCollection = new Collection();
    mockCollection.toArray = jest.fn().mockReturnValue(featuresWithMissingValues);
    MockFeatureLayer.mockImplementation(() => ({
      source: mockCollection,
      title: 'Test Layer with Missing Values',
      renderer: {
        type: 'unique-value',
        field: 'classification',
        uniqueValueInfos: []
      }
    }));

    const result = await visualization.create({
      features: featuresWithMissingValues,
      title: 'Test Layer with Missing Values',
      layerName: 'test-layer'
    } as any);

    expect(result.layer!).toBeInstanceOf(FeatureLayer);
    expect(result.layer!.source.length).toBe(1);

    // Check that classification handles null values
    const features = (result.layer!.source as unknown as Collection<Graphic>).toArray();
    expect(features[0].attributes.classification).toBe('low-low-low');
  });

  it('should create appropriate renderer', async () => {
    const mockRenderer = {
      type: 'unique-value',
      field: 'classification',
      uniqueValueInfos: [
        { value: 'low-low-low', symbol: {} },
        { value: 'medium-medium-medium', symbol: {} },
        { value: 'high-high-high', symbol: {} }
      ]
    };

    MockFeatureLayer.mockImplementation(() => ({
      renderer: mockRenderer
    }));

    const result = await visualization.create({
      features: mockFeatures,
      title: 'Test Multivariate Layer',
      layerName: 'test-layer'
    } as any);

    const layer = result.layer!;
          expect(layer.renderer).toBeDefined();
      expect(layer.renderer!.type).toBe('unique-value');
      
            const renderer = layer.renderer as __esri.UniqueValueRenderer;
      expect(renderer.field).toBe('classification');
      expect(renderer.uniqueValueInfos?.length).toBeGreaterThan(0);
  });
}); 