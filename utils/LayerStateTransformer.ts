// src/utils/LayerStateTransformer.ts

import { LayerState } from '../types/layers';
import { ProcessedLayerState, QueryResults, AILayerState } from '../types/ai-layers';
import Graphic from "@arcgis/core/Graphic";
import Field from "@arcgis/core/layers/support/Field";

interface TransformationMetrics {
  inputLayers: number;
  processedLayers: number;
  featuresProcessed: number;
  fieldsProcessed: number;
  transformationTime: number;
}

export class LayerStateTransformer {
  private metrics: TransformationMetrics;

  constructor() {
    this.metrics = {
      inputLayers: 0,
      processedLayers: 0,
      featuresProcessed: 0,
      fieldsProcessed: 0,
      transformationTime: 0
    };
  }

  public async transformLayerStates(
    states: Record<string, AILayerState>
  ): Promise<Record<string, ProcessedLayerState>> {
    console.log('[LayerStateTransformer] Starting transformation:', {
      totalStates: Object.keys(states).length,
      stateTypes: Object.keys(states).map(key => ({
        id: key,
        hasLayer: !!states[key].layer,
        hasQueryResults: !!states[key].queryResults,
        featureCount: states[key].queryResults?.features?.length || 0
      }))
    });

    const startTime = performance.now();
    this.resetMetrics();
    this.metrics.inputLayers = Object.keys(states).length;

    const processedStates: Record<string, ProcessedLayerState> = {};
    
    for (const [id, state] of Object.entries(states)) {
      try {
        if (!state.layer) {
          console.warn(`[LayerStateTransformer] Layer missing for ${id}`);
          continue;
        }

        const processedState = await this.createProcessedState(id, state);
        processedStates[id] = processedState;
        this.updateMetrics(processedState);
        
        console.log(`[LayerStateTransformer] Processed layer ${id}:`, {
          title: processedState.layer.title,
          featureCount: processedState.queryResults?.features?.length || 0,
          fieldCount: processedState.queryResults?.fields?.length || 0
        });
      } catch (error) {
        console.error(`[LayerStateTransformer] Error processing layer ${id}:`, error);
      }
    }

    this.metrics.transformationTime = performance.now() - startTime;
    this.metrics.processedLayers = Object.keys(processedStates).length;

    console.log('[LayerStateTransformer] Transformation complete:', {
      inputLayers: this.metrics.inputLayers,
      processedLayers: this.metrics.processedLayers,
      featuresProcessed: this.metrics.featuresProcessed,
      fieldsProcessed: this.metrics.fieldsProcessed,
      transformationTime: this.metrics.transformationTime.toFixed(2) + 'ms',
      processedLayerIds: Object.keys(processedStates)
    });

    return processedStates;
  }

  private async createProcessedState(id: string, state: AILayerState): Promise<ProcessedLayerState> {
    const layer = state.layer;
    let features: Graphic[] = [];
    
    if (layer && 'queryFeatures' in layer) {
      try {
        const query = layer.createQuery();
        const results = await layer.queryFeatures(query);
        features = results.features;
      } catch (error) {
        console.error(`Error querying features for layer ${id}:`, error);
      }
    }

    const processedLayer = {
      id: layer?.id || id,
      title: layer?.title || 'Untitled Layer',
      url: (layer as __esri.FeatureLayer)?.url || '',
      geometryType: layer?.type || 'unknown',
      fields: (layer as __esri.FeatureLayer)?.fields?.map(field => ({
        name: field.name,
        type: field.type,
        alias: field.alias || field.name
      })) || []
    };

    const fields = (layer as __esri.FeatureLayer)?.fields || [];
    const queryResults: QueryResults = {
      features,
      fields,
      hasQueryResults: features.length > 0,
      featureCount: features.length
    };

    return {
      layer: processedLayer,
      queryResults
    };
  }

  private updateMetrics(state: ProcessedLayerState): void {
    const features = state.queryResults?.features || [];
    const fields = state.queryResults?.fields || [];
    
    this.metrics.featuresProcessed += features.length;
    this.metrics.fieldsProcessed += fields.length;
  }

  private resetMetrics(): void {
    this.metrics = {
      inputLayers: 0,
      processedLayers: 0,
      featuresProcessed: 0,
      fieldsProcessed: 0,
      transformationTime: 0
    };
  }

  public getMetrics(): TransformationMetrics {
    return { ...this.metrics };
  }
}