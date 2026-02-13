// src/utils/logging.ts

import { AnalysisRequest, ProcessedLayerState } from '@/types/ai-layers';

export const logAnalysisRequest = (request: AnalysisRequest): void => {
  console.log('[Analysis Request]', {
    query: request.query,
    hasView: !!request.view,
    layerStateCount: Object.keys(request.layerStates || {}).length,
    viewExtent: request.view?.extent
  });
};

export const logLayerProcessing = (id: string, state: ProcessedLayerState): void => {
  console.log('[Layer Processing]', {
    id,
    layerTitle: state.layer?.title,
    featureCount: state.queryResults?.features?.length || 0,
    fieldCount: state.queryResults?.fields?.length || 0
  });
};