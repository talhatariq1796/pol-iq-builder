import { CompositeVisualization } from './composite-visualization';
import { CorrelationVisualization } from './correlation-visualization';
import { HotspotVisualization } from './hotspot-visualization';
import { BivariateVisualization } from './bivariate-visualization';
import { MultivariateVisualization } from './multivariate-visualization';
import { ProportionalSymbolVisualization } from './proportional-symbol-visualization';
import { HexbinVisualization } from './hexbin-visualization';
import { SpiderVisualization } from './spider-visualization';
import { Symbol3DVisualization } from './symbol3d-visualization';
import { SingleLayerVisualization } from './single-layer-visualization';
import { PointLayerVisualization } from './point-layer-visualization';
import { FlowVisualization } from './flow-visualization';
import { TimeSeriesVisualization } from './time-series-visualization';
import { DensityVisualization } from './density-visualization';
import { ChoroplethVisualization } from './choropleth-visualization';
import { ClusterVisualization } from './cluster-visualization';
import { ProximityVisualization } from './proximity-visualization';
import { AggregationVisualization } from './aggregation-visualization';
import { OverlayVisualization } from './overlay-visualization';
import { BufferVisualization } from './buffer-visualization';
import { NetworkVisualization } from './network-visualization';
import { TrendsVisualization } from './trends-visualization';
import { TrendsCorrelationVisualization } from './trends-correlation-visualization';
import { CrossGeographyCorrelationVisualization } from './cross-geography-correlation-visualization';
import { JointHighVisualization } from './joint-visualization';
import { DifferenceVisualization } from './difference-visualization';
import { VisualizationType } from './types';
import { VisualizationOptions, BaseVisualization } from './base-visualization';
import { SingleLayerOptions } from './single-layer-visualization';

// Export all visualization classes
export { CompositeVisualization } from './composite-visualization';
export { CorrelationVisualization } from './correlation-visualization';
export { HotspotVisualization } from './hotspot-visualization';
export { BivariateVisualization } from './bivariate-visualization';
export { MultivariateVisualization } from './multivariate-visualization';
export { ProportionalSymbolVisualization } from './proportional-symbol-visualization';
export { HexbinVisualization } from './hexbin-visualization';
export { SpiderVisualization } from './spider-visualization';
export { Symbol3DVisualization } from './symbol3d-visualization';
export { SingleLayerVisualization } from './single-layer-visualization';
export { PointLayerVisualization } from './point-layer-visualization';
export { FlowVisualization } from './flow-visualization';
export { TimeSeriesVisualization } from './time-series-visualization';
export { DensityVisualization } from './density-visualization';
export { ChoroplethVisualization } from './choropleth-visualization';
export { ClusterVisualization } from './cluster-visualization';
export { ProximityVisualization } from './proximity-visualization';
export { AggregationVisualization } from './aggregation-visualization';
export { OverlayVisualization } from './overlay-visualization';
export { BufferVisualization } from './buffer-visualization';
export { NetworkVisualization } from './network-visualization';
export { TrendsVisualization } from './trends-visualization';
export { TrendsCorrelationVisualization } from './trends-correlation-visualization';
export { CrossGeographyCorrelationVisualization } from './cross-geography-correlation-visualization';
export { JointHighVisualization } from './joint-visualization';
export { DifferenceVisualization } from './difference-visualization';

// Export base types and interfaces
export type { VisualizationOptions, BaseVisualization } from './base-visualization';
export type { SingleLayerOptions } from './single-layer-visualization';
export type { VisualizationType, VisualVariable, VisualizationStrategy } from './types';
export type { BivariateData } from './bivariate-visualization';
export type { MultivariateData } from './multivariate-visualization';
export type { ProportionalSymbolData, HexbinData } from './types';
export type { SpiderMapData } from './types';
export type { Symbol3DData } from './symbol3d-visualization';
export type { JointHighData } from './joint-visualization';
export type { CrossGeographyVisualizationOptions } from './cross-geography-correlation-visualization';

/**
 * Maps visualization modes to their corresponding visualization types and options
 * @param visualizationMode - The mode of visualization to create
 * @returns An object containing the visualization type and any additional options
 */
export const getVisualizationFromMode = (
  visualizationMode: 'distribution' | 'highlight' | 'point' | 'correlation' | 'hotspot' | 'bivariate' | 'multivariate' | 'proportional-symbol' | 'hexbin' | 'spider' | '3d-symbol' | 'flow' | 'time-series' | 'density' | 'choropleth' | 'cluster' | 'proximity' | 'aggregation' | 'overlay' | 'buffer' | 'network' | 'composite' | 'trends' | 'joint-high' | 'cross-geography-correlation'
): { type: VisualizationType; options?: SingleLayerOptions } => {
  switch (visualizationMode) {
    case 'point':
      return { type: 'point-layer' };
    case 'highlight':
      return { 
        type: 'single-layer',
        options: { mode: 'highlight' }
      };
    case 'distribution':
      return { 
        type: 'single-layer',
        options: { mode: 'distribution' }
      };
    case 'correlation':
      return { type: 'correlation' };
    case 'hotspot':
      return { type: 'hotspot' };
    case 'bivariate':
      return { type: 'bivariate' };
    case 'multivariate':
      return { type: 'multivariate' };
    case 'proportional-symbol':
      return { type: 'proportional-symbol' };
    case 'hexbin':
      return { type: 'hexbin' };
    case 'spider':
      return { type: 'spider' };
    case '3d-symbol':
      return { type: '3d-symbol' };
    case 'flow':
      return { type: 'flow' };
    case 'time-series':
      return { type: 'time-series' };
    case 'density':
      return { type: 'density' };
    case 'choropleth':
      return { type: 'choropleth' };
    case 'cluster':
      return { type: 'cluster' };
    case 'proximity':
      return { type: 'proximity' };
    case 'aggregation':
      return { type: 'aggregation' };
    case 'overlay':
      return { type: 'overlay' };
    case 'buffer':
      return { type: 'buffer' };
    case 'network':
      return { type: 'network' };
    case 'trends':
      return { type: 'trends' };
    case 'cross-geography-correlation':
      return { type: 'cross-geography-correlation' };
    case 'joint-high':
      return { type: 'joint-high' };
    case 'composite':
      return { type: 'composite' };
    default:
      return { 
        type: 'single-layer',
        options: { mode: 'distribution' }
      };
  }
};

/**
 * Creates a new visualization instance based on the specified type
 * @param type - The type of visualization to create
 * @returns A new instance of the specified visualization type
 */
export const createVisualization = (type: VisualizationType): BaseVisualization<any> => {
  switch (type) {
    case 'correlation':
      return new CorrelationVisualization();
    case 'hotspot':
      return new HotspotVisualization();
    case 'bivariate':
      return new BivariateVisualization();
    case 'multivariate':
      return new MultivariateVisualization();
    case 'proportional-symbol':
      return new ProportionalSymbolVisualization();
    case 'hexbin':
      return new HexbinVisualization();
    case 'spider':
      return new SpiderVisualization();
    case '3d-symbol':
      return new Symbol3DVisualization();
    case 'single-layer':
      return new SingleLayerVisualization();
    case 'point-layer':
      return new PointLayerVisualization();
    case 'flow':
      return new FlowVisualization();
    case 'time-series':
      return new TimeSeriesVisualization();
    case 'density':
      return new DensityVisualization();
    case 'choropleth':
      return new ChoroplethVisualization();
    case 'cluster':
      return new ClusterVisualization();
    case 'proximity':
      return new ProximityVisualization();
    case 'aggregation':
      return new AggregationVisualization();
    case 'overlay':
      return new OverlayVisualization();
    case 'buffer':
      return new BufferVisualization();
    case 'network':
      return new NetworkVisualization();
    case 'trends':
      return new TrendsVisualization();
    case 'joint-high':
      return new JointHighVisualization();
    case 'cross-geography-correlation':
      return new CrossGeographyCorrelationVisualization();
    case 'composite':
      return new CompositeVisualization();
    default:
      throw new Error(`Unsupported visualization type: ${type}`);
  }
};
