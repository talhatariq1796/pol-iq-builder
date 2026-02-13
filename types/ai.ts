// src/types/ai.ts

export interface ModelConfig {
  defaultModel: string;
  modelConstraints: {
    maxTokens: number;
    minConfidence: number;
  };
  models: {
    "gpt-4": { enabled: boolean; priority?: number };
    "gpt-3.5-turbo": { enabled: boolean; priority?: number };
    "claude-2": { enabled: boolean; priority?: number };
    "claude-instant": { enabled: boolean; priority?: number };
  };
}
  
export interface PromptTemplate {
  template: string;
  requiredVariables: string[];
  examples?: string[];
  constraints?: string[];
}
  
export interface InferenceResult {
  raw: string;
  tokens: number;
  completionTokens: number;
  processingTime: number;
}
  
export interface InferenceParams {
  model: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  layerStates?: any;
  view?: any;
}

export enum TaskType {
  Visualization = 'visualization',
  Analysis = 'analysis',
  Prediction = 'prediction',
  General = 'general'
}

export enum ModelType {
  GPT35 = 'gpt-3.5-turbo',
  GPT4 = 'gpt-4',
  Claude2 = 'claude-2',
  ClaudeInstant = 'claude-instant'
}

// Additional interfaces from the previous suggestion
export interface AIResults {
  insights?: string[];
  trends?: Record<string, any>;
  recommendations?: string[];
  confidence?: number;
}

export interface ViewState {
  extent: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
  };
  spatialReference: {
    wkid: number;
  };
}

export interface ProcessedLayerState {
  layer: {
    id: string;
    title: string;
    url?: string;
    geometryType: string;
    fields: {
      name: string;
      type: string;
      alias?: string;
    }[];
  };
  queryResults: {
    features: any[];
    fields: any[];
  };
}

export interface ProcessQueryParams {
  query: string;
  layerStates: Record<string, ProcessedLayerState>;
  view?: ViewState;
  strategy?: {
    parallel: boolean;
    processor: 'TRADITIONAL' | 'AI' | 'HYBRID';
    agents: string[];
    cacheable: boolean;
    priority?: 'speed' | 'accuracy';
  };
}

export interface ProcessingResult {
  traditionalResults?: {
    features?: any[];
    metrics?: Record<string, any>;
    statistics?: Record<string, any>;
    patterns?: string[];
  };
  aiResults?: AIResults;
  metadata: {
    confidence: number;
    processingType: 'TRADITIONAL' | 'AI' | 'HYBRID';
    error: boolean;
    message?: string;
  };
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
  type: 'COMPETITION' | 'MARKET' | 'STANDARD';
  data: AIResponseData;
  relevantLayers: string[];
  analysis?: {
    insights: string[];
    recommendations: string[];
  };
  confidence: number;
  timestamp: number;
}