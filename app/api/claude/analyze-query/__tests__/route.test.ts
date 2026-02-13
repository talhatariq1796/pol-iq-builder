import { POST } from '../route';
import { mapQueryToVisualizations, QueryIntent } from '@/utils/visualizations/query-mapper';
import { VisualizationType } from '@/config/dynamic-layers';

// Mock the fetch function
global.fetch = jest.fn();

describe('Query Analysis API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should analyze a correlation query correctly', async () => {
    // Mock Claude API response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve({
        content: [{
          text: JSON.stringify({
            intent: 'Analyze the relationship between income and education levels',
            relevantLayers: ['demographics', 'income'],
            relevantFields: ['income', 'education_level'],
            queryType: 'correlation',
            visualizationType: 'correlation',
            confidence: 0.9
          })
        }]
      })
    });

    const request = new Request('http://localhost:3000/api/claude/analyze-query', {
      method: 'POST',
      body: JSON.stringify({
        query: 'How does income level correlate with education?'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.intent).toBe('Analyze the relationship between income and education levels');
    expect(data.queryType).toBe('correlation');
    expect(data.visualizationType).toBe(VisualizationType.CORRELATION);
    expect(data.confidence).toBeGreaterThan(0.7);
    expect(data.alternativeVisualizations).toHaveLength(3); // Should include bivariate, multivariate, and cross-geography
  });

  it('should analyze a distribution query correctly', async () => {
    // Mock Claude API response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve({
        content: [{
          text: JSON.stringify({
            intent: 'Show the distribution of high-income areas',
            relevantLayers: ['income'],
            relevantFields: ['income'],
            queryType: 'distribution',
            visualizationType: 'choropleth',
            confidence: 0.9
          })
        }]
      })
    });

    const request = new Request('http://localhost:3000/api/claude/analyze-query', {
      method: 'POST',
      body: JSON.stringify({
        query: 'Show me the distribution of high-income areas'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.intent).toBe('Show the distribution of high-income areas');
    expect(data.queryType).toBe('distribution');
    expect(data.visualizationType).toBe(VisualizationType.CHOROPLETH);
    expect(data.confidence).toBeGreaterThan(0.7);
    expect(data.alternativeVisualizations).toHaveLength(4); // Should include heatmap, hexbin, density, and cluster
  });

  it('should handle errors gracefully', async () => {
    // Mock Claude API error
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

    const request = new Request('http://localhost:3000/api/claude/analyze-query', {
      method: 'POST',
      body: JSON.stringify({
        query: 'Invalid query'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to analyze query');
  });
});

describe('Query to Visualization Mapping', () => {
  it('should map correlation queries correctly', () => {
    const queryIntent: QueryIntent = {
      type: 'correlation',
      fields: ['income', 'education', 'employment'],
      geometryType: 'polygon'
    };

    const suggestions = mapQueryToVisualizations(queryIntent);
    expect(suggestions).toHaveLength(4); // correlation, bivariate, multivariate, cross-geography
    expect(suggestions[0].type).toBe(VisualizationType.CORRELATION);
    expect(suggestions[0].confidence).toBeGreaterThan(0.7);
  });

  it('should map distribution queries correctly', () => {
    const queryIntent: QueryIntent = {
      type: 'distribution',
      fields: ['income'],
      geometryType: 'polygon'
    };

    const suggestions = mapQueryToVisualizations(queryIntent);
    expect(suggestions).toHaveLength(5); // choropleth, heatmap, hexbin, density, cluster
    expect(suggestions[0].type).toBe(VisualizationType.CHOROPLETH);
    expect(suggestions[0].confidence).toBeGreaterThan(0.7);
  });

  it('should handle temporal queries with time range', () => {
    const queryIntent: QueryIntent = {
      type: 'temporal',
      fields: ['income', 'date'],
      geometryType: 'polygon',
      timeRange: {
        start: '2020-01-01',
        end: '2023-12-31'
      }
    };

    const suggestions = mapQueryToVisualizations(queryIntent);
    expect(suggestions).toHaveLength(2); // trends, time-series
    expect(suggestions[0].type).toBe(VisualizationType.TRENDS);
    expect(suggestions[0].confidence).toBeGreaterThan(0.8); // Higher confidence due to time range
  });

  it('should handle composite queries with multiple fields', () => {
    const queryIntent: QueryIntent = {
      type: 'composite',
      fields: ['income', 'education', 'employment', 'population'],
      geometryType: 'polygon',
      filters: {
        income: { min: 50000 },
        education: { min: 'bachelor' }
      }
    };

    const suggestions = mapQueryToVisualizations(queryIntent);
    expect(suggestions).toHaveLength(3); // composite, overlay, aggregation
    expect(suggestions[0].type).toBe(VisualizationType.COMPOSITE);
    expect(suggestions[0].confidence).toBeGreaterThan(0.8); // Higher confidence due to filters
  });
}); 