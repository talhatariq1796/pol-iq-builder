/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ChatRequest as RawChatRequest } from '@/services/chat-service';
import { summarizeFeatureData } from './client-summarizer';

export interface SafeClaudePayload {
  messages: any[];
  metadata: Record<string, any>;
  persona: string;
  // Prefer compact summary
  summary?: ReturnType<typeof summarizeFeatureData>;
  // Keep a tiny shadow of feature layers without geometry
  featureShadows?: Array<{
    layerId: string;
    layerName: string;
    featureCount: number;
    field?: string;
  }>;
}

export function buildClaudePayload(req: RawChatRequest): SafeClaudePayload {
  const summary = summarizeFeatureData(req.featureData);

  const featureShadows = (req.featureData || []).map((layer: any) => ({
    layerId: layer.layerId,
    layerName: layer.layerName,
    featureCount: Array.isArray(layer.features) ? layer.features.length : 0,
    field: layer.field
  }));

  const metadata = {
    ...req.metadata,
    payloadStrategy: 'client-summary-v1',
    // Guard rails flags for server
    isContextualChat: true,
    enableOptimization: true,
    forceOptimization: true,
  };

  return {
    messages: req.messages,
    metadata,
    persona: req.persona,
    summary,
    featureShadows
  };
}
