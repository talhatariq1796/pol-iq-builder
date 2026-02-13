import type { Extent } from '@arcgis/core/geometry';

export interface LocalChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  validIdentifiers?: string[];
  featureType?: 'point' | 'polygon' | 'line';
  sourceLayerIdForClickable?: string;
  sourceIdentifierFieldForClickable?: string;
  type: 'ai' | 'error' | 'info';
  timestamp: number;
  layerExtent: Extent | null;
} 