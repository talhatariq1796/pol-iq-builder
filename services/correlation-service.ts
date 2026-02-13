import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Graphic from '@arcgis/core/Graphic';

export interface CorrelationResult {
  pearson: number;
  strength: string;
  scatterData: Array<{ x: number; y: number }>;
  spatialStats: {
    hotSpots: number;
    coldSpots: number;
    outliers: number;
  };
}

export class CorrelationService {
  static async calculateCorrelation(
    layer: FeatureLayer,
    primaryField: string,
    comparisonField: string
  ): Promise<CorrelationResult> {
    // Get features from layer
    const features = await layer.queryFeatures();
    
    // Calculate basic correlation
    const validPairs = features.features
      .map(f => ({
        x: f.attributes[primaryField],
        y: f.attributes[comparisonField]
      }))
      .filter(pair => 
        typeof pair.x === 'number' && 
        typeof pair.y === 'number' && 
        !isNaN(pair.x) && 
        !isNaN(pair.y)
      );

    if (validPairs.length < 2) {
      throw new Error('Insufficient valid data for correlation analysis');
    }

    // Calculate Pearson's r
    const xValues = validPairs.map(p => p.x);
    const yValues = validPairs.map(p => p.y);
    
    const meanX = xValues.reduce((a, b) => a + b, 0) / xValues.length;
    const meanY = yValues.reduce((a, b) => a + b, 0) / yValues.length;
    
    const covariance = xValues.reduce((sum, x, i) => 
      sum + (x - meanX) * (yValues[i] - meanY), 0) / xValues.length;
    
    const stdDevX = Math.sqrt(xValues.reduce((sum, x) => 
      sum + Math.pow(x - meanX, 2), 0) / xValues.length);
    const stdDevY = Math.sqrt(yValues.reduce((sum, y) => 
      sum + Math.pow(y - meanY, 2), 0) / yValues.length);
    
    const pearson = covariance / (stdDevX * stdDevY);
    
    // Determine correlation strength
    const absPearson = Math.abs(pearson);
    let strength = '';
    if (absPearson >= 0.7) {
      strength = 'Strong ' + (pearson > 0 ? 'positive' : 'negative');
    } else if (absPearson >= 0.5) {
      strength = 'Moderate ' + (pearson > 0 ? 'positive' : 'negative');
    } else if (absPearson >= 0.3) {
      strength = 'Weak ' + (pearson > 0 ? 'positive' : 'negative');
    } else {
      strength = 'Very weak or no correlation';
    }

    // Calculate spatial statistics
    const spatialStats = await this.calculateSpatialStatistics(
      features.features,
      primaryField,
      comparisonField,
      pearson
    );

    return {
      pearson,
      strength,
      scatterData: validPairs.map(pair => ({
        x: pair.x,
        y: pair.y
      })),
      spatialStats
    };
  }

  private static async calculateSpatialStatistics(
    features: Graphic[],
    primaryField: string,
    comparisonField: string,
    globalCorrelation: number
  ): Promise<{ hotSpots: number; coldSpots: number; outliers: number }> {
    // Calculate local correlation scores
    const localScores = features.map(feature => {
      const primaryVal = feature.attributes[primaryField];
      const comparisonVal = feature.attributes[comparisonField];

      if (typeof primaryVal !== 'number' || typeof comparisonVal !== 'number' ||
          isNaN(primaryVal) || isNaN(comparisonVal)) {
        return null;
      }

      // Calculate z-scores
      const primaryValues = features
        .map(f => f.attributes[primaryField])
        .filter(v => typeof v === 'number' && !isNaN(v));
      const comparisonValues = features
        .map(f => f.attributes[comparisonField])
        .filter(v => typeof v === 'number' && !isNaN(v));

      const meanPrimary = primaryValues.reduce((a, b) => a + b, 0) / primaryValues.length;
      const meanComparison = comparisonValues.reduce((a, b) => a + b, 0) / comparisonValues.length;

      const stdDevPrimary = Math.sqrt(
        primaryValues.reduce((sum, val) => sum + Math.pow(val - meanPrimary, 2), 0) / primaryValues.length
      );
      const stdDevComparison = Math.sqrt(
        comparisonValues.reduce((sum, val) => sum + Math.pow(val - meanComparison, 2), 0) / comparisonValues.length
      );

      const zPrimary = (primaryVal - meanPrimary) / stdDevPrimary;
      const zComparison = (comparisonVal - meanComparison) / stdDevComparison;

      return {
        feature,
        score: zPrimary * zComparison
      };
    }).filter(score => score !== null) as Array<{ feature: Graphic; score: number }>;

    // Sort scores
    localScores.sort((a, b) => b.score - a.score);

    // Identify hot spots (top 10%)
    const hotSpotCount = Math.ceil(localScores.length * 0.1);
    const hotSpots = localScores.slice(0, hotSpotCount);

    // Identify cold spots (bottom 10%)
    const coldSpotCount = Math.ceil(localScores.length * 0.1);
    const coldSpots = localScores.slice(-coldSpotCount);

    // Identify outliers (deviating significantly from global correlation)
    const outlierThreshold = 2; // 2 standard deviations
    const outliers = localScores.filter(score => 
      Math.abs(score.score - globalCorrelation) > outlierThreshold
    );

    return {
      hotSpots: hotSpots.length,
      coldSpots: coldSpots.length,
      outliers: outliers.length
    };
  }

  static async updateLayerRenderer(
    layer: FeatureLayer,
    visualizationType: 'combined' | 'primary' | 'comparison' | 'local',
    primaryField: string,
    comparisonField: string
  ): Promise<void> {
    // This method would update the layer's renderer based on the selected visualization type
    // Implementation would depend on your specific rendering requirements
  }
} 