export interface Correlation {
  field: string;
  coefficient: number;
}

export type CorrelationResult = {
  joinedFeatures: any[];
  primaryField: string;
  comparisonField: string;
};

export interface CorrelationAnalysis {
  coefficient: number;
  strength: 'strong' | 'moderate' | 'weak';
  direction: 'positive' | 'negative';
  description: string;
}

export interface CorrelationLayerProps {
  title?: string;
  opacity?: number;
  visible?: boolean;
  correlationField: string;
  primaryField: string;
}
