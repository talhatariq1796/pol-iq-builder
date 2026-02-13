import { LegendItem } from '@/components/MapLegend';

export type LegendType = 'class-breaks' | 'unique-value' | 'simple' | 'multivariate' | 'cluster' | 'EMPTY' | 'standard' | 'ternary-plot' | 'dual-variable';

export interface DualVariableComponent {
  title: string;
  type: 'size' | 'color';
  items: LegendItem[];
}

export interface StandardizedLegendData {
  title: string;
  type: LegendType;
  description?: string;
  items?: LegendItem[];
  /** Whether the legend should be displayed (defaults to true if undefined) */
  visible?: boolean;
  /** Ternary plot data for 3-variable visualizations */
  ternaryData?: Array<{
    values: [number, number, number];
    label?: string;
    color?: string;
    featureId?: string;
  }>;
  /** Labels for the three axes of ternary plot */
  labels?: [string, string, string];
  /** Components for dual-variable legends (size + color) */
  components?: DualVariableComponent[];
}

// Helper function to convert ArcGIS color to rgba string
export const colorToRgba = (color: any): string => {
  if (!color) return 'rgba(128, 128, 128, 1)';
  
  if (typeof color.r === 'number') {
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a !== undefined ? color.a : 1})`;
  }
  
  if (Array.isArray(color)) {
    return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3] !== undefined ? color[3] : 1})`;
  }
  
  return 'rgba(128, 128, 128, 1)';
};

// Helper function to determine symbol shape
export const getSymbolShape = (symbol: any): 'circle' | 'square' => {
  if (!symbol) return 'square';
  
  if ('style' in symbol) {
    return symbol.style === 'circle' ? 'circle' : 'square';
  }
  
  return 'square';
};

// Helper function to get symbol size
export const getSymbolSize = (symbol: any): number | undefined => {
  if (!symbol) return undefined;
  
  if ('size' in symbol) {
    return symbol.size;
  }
  
  return undefined;
}; 