/* eslint-disable no-useless-escape */
import { GeospatialFeature } from '../clustering/types';

export interface LayerState {
  layer: __esri.FeatureLayer | null;
  visible: boolean;
  loading: boolean;
  group?: string;
  error?: string;
  url?: string;
  queryResults?: {
    features: GeospatialFeature[];
    fields: any[];
  };
  filters: QueryFilter[];
}

export interface LayerGroup {
  id: string;
  title: string;
  layers: LayerConfig[];
}

export interface LayerField {
  name: string;
  type: string;
}

export interface BaseLayerConfig {
  id: string;
  title: string;
  description: string;
  url: string;
}

export interface IndexLayerConfig extends BaseLayerConfig {
  fields: { index: string };
}

export interface PointLayerConfig extends BaseLayerConfig {
  isPoint: boolean;
  color: number[];
  fields: { type: 'point'; fields: string[] };
}

export type LayerConfig = IndexLayerConfig | PointLayerConfig;

export interface QueryResult {
  [layerId: string]: __esri.FeatureSet;
}

export interface LayerStatistics {
  count: number;
  [key: string]: number;
}

export interface Statistics {
  [layerId: string]: LayerStatistics;
}

export interface AnalysisResult {
  features: QueryResult;
  statistics: Statistics;
}

export interface DemographicStats {
  population: number;
  medianIncome: number;
  ageGroups: { [key: string]: number };
}

export interface MarketAnalysis {
  demographics: DemographicStats;
  spendingPower: number;
  penetrationRate: number;
}

export interface CompetitionAnalysis {
  competitors: number;
  averageDistance: number;
  marketGap: boolean;
}

export type IntentType = 'COMPETITION' | 'MARKET' | 'DEMOGRAPHIC' | 'LOCATION' | 'STANDARD' | 'UNKNOWN';

export interface QueryFilter {
  field: string;
  operator: string;
  value: string | number | boolean;
  enabled: boolean;
}

export interface QueryTimeRange {
  start?: Date;
  end?: Date;
}

export interface QueryParameters {
  radius?: number;      // in meters
  location?: string;    // location description
  metric?: string;      // specific metric to analyze
  filters?: QueryFilter[];
  timeRange?: QueryTimeRange;
}

export interface QueryContext {
  previousIntent?: IntentType;
  selectedArea?: __esri.Geometry;
  activeFilters?: Record<string, any>;
}

export interface QueryIntent {
  type: IntentType;
  confidence: number;
  parameters: QueryParameters;
  context?: QueryContext;
}

export interface AIResponseData {
  text: string;
  features?: __esri.Graphic[];
  statistics?: Record<string, number>;
  location?: __esri.Point;
  radius?: number;
  area?: __esri.Polygon;
}

export interface AIResponse {
  data: AIResponseData;
  type: IntentType;
}

export interface SiteSelectionCriteria {
  minIncome: number;
  maxCompetition: number;
  minPopulation: number;
  radius: number;
}

export interface LocationResolutionResult {
  geometry: __esri.Point | __esri.Polygon;
  type: 'point' | 'polygon';
  address?: string;
}

export interface AITabProps {
  view: __esri.MapView | null;
  layerStates: { [key: string]: LayerState };
}