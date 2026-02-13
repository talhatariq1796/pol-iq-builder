// Type definitions for the quartile renderer
import type { FeatureLayer, ClassBreaksRenderer } from "@arcgis/core/layers";

export type ColorStop = [number, number, number];

export interface RendererConfig {
  layer: __esri.FeatureLayer;
  field: string;
  colorStops?: ColorStop[];
  isCurrency?: boolean;
  isCompositeIndex?: boolean;
  opacity?: number;
  outlineWidth?: number;
  outlineColor?: number[];
  customBreaks?: number[];
  filterField?: string;        // Field to use for applying filtering
  filterThreshold?: number;    // Threshold value for filtering
}

export interface QuartileBreakInfo {
  minValue: number;
  maxValue: number;
  symbol: __esri.SimpleFillSymbol;
  label: string;
}

export interface CalculateQuantilesOptions {
  excludeZeros?: boolean;
  customBreaks?: number[];
  numberOfBreaks?: number;
}

export type RendererResult = {
  renderer: __esri.ClassBreaksRenderer;
  breaks: number[];
  statistics: {
    min: number;
    max: number;
    mean: number;
    median: number;
  };
} | null;