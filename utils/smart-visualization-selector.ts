import type { LayerConfig } from '@/types/layers';
import type { Visualization, GeospatialFeature } from '@/types/geospatial-ai-types';

interface DataCharacteristics {
  dataType: 'numeric' | 'categorical' | 'temporal' | 'spatial';
  distribution: 'normal' | 'skewed' | 'uniform' | 'unknown';
  spatialPattern: 'clustered' | 'dispersed' | 'random';
  featureCount: number;
  valueRange?: [number, number];
}

interface VisualizationScore {
  type: string;
  score: number;
  reasoning: string;
}

interface LayerResultWithConfig {
  features: GeospatialFeature[];
  layer: LayerConfig;
}

export class SmartVisualizationSelector {
  private dataCache: Map<string, DataCharacteristics>;

  constructor() {
    this.dataCache = new Map();
  }

  async selectVisualization(
    layerResults: LayerResultWithConfig[],
    query: string
  ): Promise<Visualization[]> {
    const visualizations: Visualization[] = [];

    for (const result of layerResults) {
      // Analyze data characteristics
      const characteristics = await this.analyzeData(result.features, result.layer);
      
      // Score different visualization types
      const scores = this.scoreVisualizationTypes(characteristics, query);
      
      // Select best visualization
      const bestViz = this.createVisualization(
        result,
        characteristics,
        scores[0]?.type || 'default'
      );
      
      if (bestViz) {
        visualizations.push(bestViz);
      }
    }

    return visualizations;
  }

  private async analyzeData(
    features: GeospatialFeature[],
    layer: LayerConfig
  ): Promise<DataCharacteristics> {
    const cacheKey = `${layer.id}-${features.length}`;
    if (this.dataCache.has(cacheKey)) {
      return this.dataCache.get(cacheKey)!;
    }

    const characteristics: DataCharacteristics = {
      dataType: this.determineDataType(features, layer),
      distribution: this.analyzeDistribution(features),
      spatialPattern: this.analyzeSpatialPattern(features),
      featureCount: features.length,
      valueRange: this.calculateValueRange(features, layer)
    };

    this.dataCache.set(cacheKey, characteristics);
    return characteristics;
  }

  private determineDataType(
    features: GeospatialFeature[],
    layer: LayerConfig
  ): DataCharacteristics['dataType'] {
    if (layer.rendererField) {
      const field = layer.fields.find((f: any) => f.name === layer.rendererField);
      if (field?.type && ['small-integer', 'integer', 'single', 'double', 'long', 'big-integer'].includes(field.type)) return 'numeric';
      if (field?.type === 'string') return 'categorical';
      if (field?.type === 'date') return 'temporal';
    }
    return 'spatial';
  }

  private analyzeDistribution(
    features: GeospatialFeature[]
  ): DataCharacteristics['distribution'] {
    // Implement statistical analysis for value distribution
    // For now, return a placeholder
    return 'unknown';
  }

  private analyzeSpatialPattern(
    features: GeospatialFeature[]
  ): DataCharacteristics['spatialPattern'] {
    // Implement spatial statistics (e.g., Moran's I)
    // For now, return a placeholder
    return 'random';
  }

  private calculateValueRange(
    features: GeospatialFeature[],
    layer: LayerConfig
  ): [number, number] | undefined {
    if (!layer.rendererField) return undefined;

    const values = features
      .map(f => f.properties[layer.rendererField!])
      .filter((v): v is number => typeof v === 'number');

    if (values.length === 0) return undefined;

    return [Math.min(...values), Math.max(...values)];
  }

  private scoreVisualizationTypes(
    characteristics: DataCharacteristics,
    query: string
  ): VisualizationScore[] {
    const scores: VisualizationScore[] = [];

    // Score choropleth
    if (characteristics.dataType === 'numeric' && characteristics.featureCount > 10) {
      scores.push({
        type: 'choropleth',
        score: 0.8,
        reasoning: 'Numeric data with sufficient features for area-based visualization'
      });
    }

    // Score heatmap
    if (characteristics.dataType === 'numeric' && characteristics.spatialPattern === 'clustered') {
      scores.push({
        type: 'heatmap',
        score: 0.9,
        reasoning: 'Clustered numeric data suitable for density visualization'
      });
    }

    // Score point clustering
    if (characteristics.featureCount > 1000) {
      scores.push({
        type: 'cluster',
        score: 0.7,
        reasoning: 'Large number of features benefit from clustering'
      });
    }

    return scores.sort((a, b) => b.score - a.score);
  }

  private createVisualization(
    result: LayerResultWithConfig,
    characteristics: DataCharacteristics,
    vizType: string
  ): Visualization | null {
    try {
      const type = this.mapVizTypeToVisualization(vizType);
      return {
        type,
        data: result.features,
        options: {
          title: result.layer.name,
          description: `${characteristics.featureCount} features visualized as ${type}`,
          style: {
            colors: this.selectColorScheme(characteristics),
            height: '400px'
          }
        }
      };
    } catch (error) {
      console.error('Error creating visualization:', error);
      return null;
    }
  }

  private mapVizTypeToVisualization(vizType: string): Visualization['type'] {
    switch (vizType) {
      case 'choropleth':
      case 'heatmap':
      case 'cluster':
        return 'map';
      default:
        return 'chart';
    }
  }

  private selectColorScheme(characteristics: DataCharacteristics): string[] {
    // Sequential for numeric data
    if (characteristics.dataType === 'numeric') {
      return ['#fee5d9', '#fcae91', '#fb6a4a', '#de2d26', '#a50f15'];
    }
    
    // Qualitative for categorical data
    return ['#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854'];
  }
} 