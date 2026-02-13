import { BaseVisualization } from './base-visualization';

export type VisualizationType = 
  | 'composite'
  | 'correlation'
  | 'hotspot'
  | 'bivariate'
  | 'multivariate'
  | 'proportional-symbol'
  | 'choropleth'
  | 'heatmap'
  | 'hexbin'
  | 'spider'
  | '3d-symbol'
  | 'single-layer'
  | 'point-layer'
  | 'flow'
  | 'time-series'
  | 'density'
  | 'cluster'
  | 'proximity'
  | 'aggregation'
  | 'overlay'
  | 'buffer'
  | 'network'
  | 'trends'
  | 'joint-high'
  | 'cross-geography-correlation';

export type VisualVariable = 
  | 'color'
  | 'size'
  | 'shape'
  | 'opacity'
  | 'rotation'
  | 'height';

export interface VisualizationStrategy {
  type: VisualizationType;
  variables: {
    field: string;
    label: string;
    visual: VisualVariable;
    breaks?: number[];
  }[];
}

export interface ProportionalSymbolData {
  features: __esri.Graphic[];
  sizeField: string;
  colorField?: string;
  sizeLabel: string;
  colorLabel?: string;
  sizeBreaks?: number[];
  colorBreaks?: number[];
  minSize?: number;
  maxSize?: number;
}

export interface HexbinData {
  features: __esri.Graphic[];
  field: string;
  cellSize: number;
  aggregationType: 'count' | 'sum' | 'mean';
}

export interface SpiderMapData {
  points: __esri.Graphic[];
  connections: {
    from: string;
    to: string;
    weight?: number;
  }[];
  idField: string;
}

export interface Symbol3DData {
  features: __esri.Graphic[];
  heightField: string;
  colorField?: string;
  heightLabel: string;
  colorLabel?: string;
  minHeight?: number;
  maxHeight?: number;
} 