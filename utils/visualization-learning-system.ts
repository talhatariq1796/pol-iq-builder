import { v4 as uuidv4 } from 'uuid';
import {
  VisualizationType,
  VisualizationFeedback,
  UserProfile,
  LearningSignal,
  DataCharacteristics,
  UserInteractionMetrics,
  VisualizationPreference,
  FeedbackSource
} from '../types/visualization-learning';

export class VisualizationLearningSystem {
  private feedbackHistory: Map<string, VisualizationFeedback[]>;
  private userProfiles: Map<string, UserProfile>;
  private readonly LEARNING_RATE = 0.1;
  private readonly CONFIDENCE_THRESHOLD = 0.7;
  private readonly TIME_DECAY_FACTOR = 0.95;

  constructor() {
    this.feedbackHistory = new Map();
    this.userProfiles = new Map();
  }

  public recordFeedback(feedback: VisualizationFeedback): void {
    const { userId } = feedback;
    if (!this.feedbackHistory.has(userId)) {
      this.feedbackHistory.set(userId, []);
    }
    
    const userFeedback = this.feedbackHistory.get(userId);
    if (userFeedback) {
      userFeedback.push(feedback);
      const learningSignal = this.calculateLearningSignal(feedback);
      this.updateLearningModel(userId, feedback, learningSignal);
    }
  }

  private calculateImplicitScore(metrics: UserInteractionMetrics): number {
    const {
      timeSpent,
      interactionCount,
      exportCount,
      modificationCount
    } = metrics;

    // Normalize each metric to a 0-1 scale
    const normalizedTime = Math.min(timeSpent / 300, 1); // Cap at 5 minutes
    const normalizedInteractions = Math.min(interactionCount / 10, 1);
    const normalizedExports = Math.min(exportCount / 2, 1);
    const normalizedMods = Math.min(modificationCount / 5, 1);

    // Weighted combination of metrics
    return (
      normalizedTime * 0.3 +
      normalizedInteractions * 0.3 +
      normalizedExports * 0.2 +
      normalizedMods * 0.2
    );
  }

  private calculateLearningSignal(feedback: VisualizationFeedback): LearningSignal {
    const implicitScore = this.calculateImplicitScore(feedback.interactionMetrics);
    const explicitScore = feedback.explicitRating ?? 0;
    
    const combinedScore = feedback.source === 'explicit'
      ? explicitScore * 0.7 + implicitScore * 0.3
      : implicitScore;

    const confidence = this.calculateConfidence(feedback);

    return {
      score: combinedScore,
      confidence,
      timestamp: new Date().toISOString()
    };
  }

  private calculateConfidence(feedback: VisualizationFeedback): number {
    const { source, interactionMetrics } = feedback;
    const baseConfidence = source === 'explicit' ? 0.8 : 0.6;
    
    // Adjust confidence based on interaction level
    const interactionLevel = Math.min(
      (interactionMetrics.interactionCount +
        interactionMetrics.modificationCount * 2 +
        interactionMetrics.exportCount * 3) / 20,
      1
    );

    return baseConfidence * (0.7 + 0.3 * interactionLevel);
  }

  private updateLearningModel(
    userId: string,
    feedback: VisualizationFeedback,
    learningSignal: LearningSignal
  ): void {
    if (!this.userProfiles.has(userId)) {
      this.userProfiles.set(userId, {
        userId,
        visualizationPreferences: new Map(),
        devicePreferences: new Map(),
        rolePreferences: new Map()
      });
    }

    const userProfile = this.userProfiles.get(userId);
    if (userProfile) {
      this.updatePreference(
        userProfile.visualizationPreferences,
        feedback.visualizationType,
        learningSignal,
        feedback.dataCharacteristics
      );
    }
  }

  private updatePreference(
    preferences: Map<VisualizationType, VisualizationPreference>,
    visualizationType: VisualizationType,
    signal: LearningSignal,
    context: DataCharacteristics
  ): void {
    const currentPreference = preferences.get(visualizationType) ?? {
      score: 0.5,
      confidence: 0,
      supportingEvidence: []
    };

    const timeWeight = Math.pow(
      this.TIME_DECAY_FACTOR,
      (Date.now() - new Date(signal.timestamp).getTime()) / (1000 * 60 * 60 * 24)
    );

    const updatedScore =
      currentPreference.score +
      this.LEARNING_RATE *
        signal.confidence *
        timeWeight *
        (signal.score - currentPreference.score);

    const updatedConfidence = Math.min(
      currentPreference.confidence +
        signal.confidence * this.LEARNING_RATE * timeWeight,
      1
    );

    preferences.set(visualizationType, {
      type: visualizationType,
      score: updatedScore,
      confidence: updatedConfidence,
      lastUsed: new Date(),
      successRate: signal.score,
      supportingEvidence: [
        ...(currentPreference.supportingEvidence || []),
        {
          context,
          signal,
          timestamp: new Date().toISOString()
        }
      ].slice(-10) // Keep only last 10 pieces of evidence
    });
  }

  public getVisualizationPreferences(
    userId: string,
    context: DataCharacteristics
  ): Map<VisualizationType, number> {
    const userProfile = this.userProfiles.get(userId);
    if (!userProfile) {
      return new Map();
    }

    const preferences = new Map<VisualizationType, number>();
    userProfile.visualizationPreferences.forEach((preference, visType) => {
      if (preference.confidence >= this.CONFIDENCE_THRESHOLD) {
        preferences.set(visType, preference.score);
      }
    });

    return preferences;
  }

  public getUserList(): string[] {
    return Array.from(this.userProfiles.keys());
  }

  public getUserFeedback(userId: string): VisualizationFeedback[] | null {
    return this.feedbackHistory.get(userId) || null;
  }

  public getUserProfile(userId: string): UserProfile | null {
    return this.userProfiles.get(userId) || null;
  }

  public getSystemStats(): {
    totalUsers: number;
    totalFeedback: number;
    averageConfidence: number;
  } {
    const totalUsers = this.userProfiles.size;
    let totalFeedback = 0;
    let totalConfidence = 0;
    let confidenceCount = 0;

    this.userProfiles.forEach(profile => {
      profile.visualizationPreferences.forEach(pref => {
        totalConfidence += pref.confidence;
        confidenceCount++;
      });
    });

    this.feedbackHistory.forEach(feedback => {
      totalFeedback += feedback.length;
    });

    return {
      totalUsers,
      totalFeedback,
      averageConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0
    };
  }

  public clearFeedbackHistory(): void {
    this.feedbackHistory.clear();
    this.userProfiles.clear();
  }
} 