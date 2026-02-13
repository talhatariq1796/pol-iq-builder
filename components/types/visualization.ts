export type BlendMode = 
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion';

export interface VisualizationOptions {
  opacity?: number;
  blendMode?: BlendMode;
  opacityTransition?: {
    duration?: number;
    easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  };
}

export interface FilterDefinition {
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'starts-with' | 'ends-with';
  value: string | number | boolean;
}

export interface FilterGroup {
  operator: 'AND' | 'OR';
  filters: FilterDefinition[];
}

export interface FilterOptions {
  filter: FilterGroup;
  highlightColor?: string;
  highlightOpacity?: number;
} 