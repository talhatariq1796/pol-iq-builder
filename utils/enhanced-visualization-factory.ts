import { DynamicVisualizationFactory } from './dynamic-visualization-factory';
import { VisualizationLearningSystem } from './visualization-learning-system';
import type {
  VisualizationType,
  VisualizationFeedback,
  DataCharacteristics,
  UserInteractionMetrics
} from '../types/visualization-learning';
import type { LayerResult } from '../types/geospatial-ai-types';

export interface VisualizationScore {
  score: number;
  confidence: number;
  reasoning: string;
}

export class EnhancedVisualizationFactory extends DynamicVisualizationFactory {
  private _learningSystem: VisualizationLearningSystem;
  private interactionTrackers: Map<string, UserInteractionMetrics>;

  constructor() {
    super();
    this._learningSystem = new VisualizationLearningSystem();
    this.interactionTrackers = new Map();
  }

  public get learningSystem(): VisualizationLearningSystem {
    return this._learningSystem;
  }

  public initializeInteractionTracking(userId: string): void {
    this.interactionTrackers.set(userId, {
      timeSpent: 0,
      interactionCount: 0,
      exportCount: 0,
      modificationCount: 0
    });
  }

  public trackInteraction(userId: string, type: 'interaction' | 'export' | 'modification'): void {
    const tracker = this.interactionTrackers.get(userId);
    if (tracker) {
      switch (type) {
        case 'interaction':
          tracker.interactionCount++;
          break;
        case 'export':
          tracker.exportCount++;
          break;
        case 'modification':
          tracker.modificationCount++;
          break;
      }
    }
  }

  public updateTimeSpent(userId: string, duration: number): void {
    const tracker = this.interactionTrackers.get(userId);
    if (tracker) {
      tracker.timeSpent += duration;
    }
  }

  private convertDataCharacteristicsToLayerResult(data: DataCharacteristics): LayerResult {
    return {
      layer: {
        id: 'temp-layer',
        name: 'Temporary Layer',
        type: 'feature',
        rendererField: data.dataType
      },
      features: [],
      weight: 1
    };
  }

  /**
   * Creates a visualization based on user preferences and learned patterns
   * This may include optimization for mobile or other contexts
   */
  public async createVisualization(
    layers: LayerResult[],
    options?: { userId?: string; dataCharacteristics?: DataCharacteristics }
  ): Promise<{ layer: any; extent: any }> {
    if (!options?.userId || !options?.dataCharacteristics) {
      return await super.createTopNVisualization(layers, {});
    }

    // Get learned preferences
    const preferences = this._learningSystem.getVisualizationPreferences(
      options.userId,
      options.dataCharacteristics
    );
    
    // Get base visualization from parent class
    const baseVisualization = await super.createTopNVisualization(layers, {});
    if (!baseVisualization.layer) {
      return baseVisualization;
    }

    const baseType = baseVisualization.layer.type as VisualizationType;
    const learnedScore = preferences.get(baseType) ?? 0.5;
    
    // If we have a strong learned preference for a different visualization type,
    // try to create that type instead
    let finalVisualization = baseVisualization;
    if (learnedScore < 0.3) {
      // Find the visualization type with highest learned preference
      let bestType = baseType;
      let bestScore = learnedScore;
      
      preferences.forEach((score, type) => {
        if (score > bestScore) {
          bestScore = score;
          bestType = type;
        }
      });

      if (bestType !== baseType) {
        try {
          finalVisualization = await super.createTopNVisualization(layers, { type: bestType });
        } catch (error) {
          console.warn('Failed to create preferred visualization type, falling back to base type');
          finalVisualization = baseVisualization;
        }
      }
    }

    return finalVisualization;
  }

  public async suggestVisualization(
    userId: string,
    dataCharacteristics: DataCharacteristics
  ): Promise<VisualizationType> {
    const layerResult = this.convertDataCharacteristicsToLayerResult(dataCharacteristics);
    const visualization = await this.createVisualization([layerResult], { 
      userId, 
      dataCharacteristics 
    });
    
    return (visualization.layer?.type ?? 'single-layer') as VisualizationType;
  }

  private calculateImplicitScore(metrics: UserInteractionMetrics): number {
    const timeWeight = 0.4;
    const interactionWeight = 0.3;
    const exportWeight = 0.2;
    const modificationWeight = 0.1;

    // Normalize metrics to 0-1 range
    const normalizedTime = Math.min(metrics.timeSpent / 300, 1); // Cap at 5 minutes
    const normalizedInteractions = Math.min(metrics.interactionCount / 20, 1); // Cap at 20 interactions
    const normalizedExports = Math.min(metrics.exportCount / 5, 1); // Cap at 5 exports
    const normalizedMods = Math.min(metrics.modificationCount / 10, 1); // Cap at 10 modifications

    return timeWeight * normalizedTime +
           interactionWeight * normalizedInteractions +
           exportWeight * normalizedExports +
           modificationWeight * normalizedMods;
  }

  public recordFeedback(
    userId: string,
    visualizationType: VisualizationType,
    dataCharacteristics: DataCharacteristics,
    explicitRating?: number
  ): void {
    const interactionMetrics = this.interactionTrackers.get(userId);
    if (!interactionMetrics) return;

    const feedback: VisualizationFeedback = {
      userId,
      visualizationType,
      interactionMetrics,
      explicitRating,
      source: explicitRating !== undefined ? 'explicit' : 'implicit',
      timestamp: new Date(),
      score: explicitRating ?? this.calculateImplicitScore(interactionMetrics),
      dataCharacteristics
    };

    this._learningSystem.recordFeedback(feedback);
    
    // Reset interaction tracking
    this.initializeInteractionTracking(userId);
  }
} 