// src/services/modelSelector.ts

export type ModelType = 'gpt-3.5-turbo' | 'gpt-4' | 'claude-2' | 'claude-instant';
export type TaskType = 'visualization' | 'analysis' | 'prediction' | 'general';

export interface ModelCapabilities {
  visualization: number;
  analysis: number;
  prediction: number;
  general: number;
}

export interface ModelConfig {
  models: {
    [key in ModelType]: {
      enabled: boolean;
      priority?: number;
    };
  };
  defaultModel: ModelType;
  modelConstraints?: {
    [key in ModelType]?: number;
  };
}

export interface ModelSelectionCriteria {
  taskType: TaskType;
  dataSize: number;
  requiredAgents: string[];
}

export class ModelSelector {
  private readonly MODEL_CAPACITIES: { [key in ModelType]: number } = {
    'gpt-3.5-turbo': 4096,
    'gpt-4': 8192,
    'claude-2': 100000,
    'claude-instant': 100000
  };

  private readonly MODEL_CAPABILITIES: { [key in ModelType]: ModelCapabilities } = {
    'gpt-3.5-turbo': {
      visualization: 0.7,
      analysis: 0.7,
      prediction: 0.6,
      general: 0.8
    },
    'gpt-4': {
      visualization: 0.9,
      analysis: 0.9,
      prediction: 0.9,
      general: 0.9
    },
    'claude-2': {
      visualization: 0.8,
      analysis: 0.9,
      prediction: 0.8,
      general: 0.85
    },
    'claude-instant': {
      visualization: 0.7,
      analysis: 0.7,
      prediction: 0.6,
      general: 0.75
    }
  };

  constructor(private config: ModelConfig) {
    // Validate config
    this.validateConfig();
  }

  private validateConfig(): void {
    if (!this.config.models) {
      throw new Error('Model configuration must include models object');
    }
    
    if (!this.config.defaultModel) {
      throw new Error('Model configuration must include a default model');
    }

    if (!this.MODEL_CAPABILITIES[this.config.defaultModel]) {
      throw new Error('Default model must be a valid model type');
    }
  }

  async selectModel(criteria: ModelSelectionCriteria): Promise<ModelType> {
    const enabledModels = Object.entries(this.config.models)
      .filter(([_, config]) => config.enabled)
      .map(([model]) => model as ModelType);

    if (enabledModels.length === 0) {
      return this.config.defaultModel;
    }

    // Calculate scores for each enabled model
    const modelScores = enabledModels.map(model => {
      const score = this.calculateModelScore(model, criteria);
      return { model, score };
    }).filter(({ score }) => score > 0); // Filter out unsuitable models

    // Sort by score (descending)
    modelScores.sort((a, b) => {
      // First compare scores
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      // If scores are equal, compare priorities if they exist
      const priorityA = this.config.models[a.model].priority || 0;
      const priorityB = this.config.models[b.model].priority || 0;
      return priorityB - priorityA;
    });

    // Return highest scoring model or default if none are suitable
    return modelScores.length > 0 ? modelScores[0].model : this.config.defaultModel;
  }

  private calculateModelScore(model: ModelType, criteria: ModelSelectionCriteria): number {
    // Check if model has required capacity
    if (!this.hasRequiredCapacity(model, criteria.dataSize)) {
      return 0;
    }

    // Get base capability score for task type
    const capabilities = this.MODEL_CAPABILITIES[model];
    let score = capabilities[criteria.taskType];

    // Adjust score based on data size and model capacity
    const capacityScore = this.calculateCapacityScore(model, criteria.dataSize);
    score *= capacityScore;

    // Adjust for agent compatibility
    const agentScore = this.calculateAgentCompatibilityScore(capabilities, criteria.requiredAgents);
    score *= agentScore;

    // Apply any custom constraints
    if (this.config.modelConstraints?.[model]) {
      score *= this.config.modelConstraints[model]!;
    }

    return score;
  }

  private calculateCapacityScore(model: ModelType, dataSize: number): number {
    const capacity = this.MODEL_CAPACITIES[model];
    
    // If data size is within 75% of capacity, give full score
    if (dataSize <= capacity * 0.75) {
      return 1.0;
    }
    
    // If data size exceeds capacity, give zero score
    if (dataSize > capacity) {
      return 0.0;
    }
    
    // Otherwise, give partial score based on how close to capacity
    return 1.0 - ((dataSize - capacity * 0.75) / (capacity * 0.25));
  }

  private calculateAgentCompatibilityScore(
    capabilities: ModelCapabilities,
    requiredAgents: string[]
  ): number {
    if (requiredAgents.length === 0) {
      return 1.0;
    }

    // Calculate average capability score for required agents
    const scores = requiredAgents.map(agent => {
      const agentType = agent.toLowerCase();
      return capabilities[agentType as keyof ModelCapabilities] || capabilities.general;
    });

    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  private hasRequiredCapacity(model: ModelType, dataSize: number): boolean {
    return dataSize <= this.MODEL_CAPACITIES[model];
  }

  // Public methods for runtime configuration

  public enableModel(model: ModelType): void {
    if (this.config.models[model]) {
      this.config.models[model].enabled = true;
    }
  }

  public disableModel(model: ModelType): void {
    if (this.config.models[model]) {
      this.config.models[model].enabled = false;
    }
  }

  public setModelPriority(model: ModelType, priority: number): void {
    if (this.config.models[model]) {
      this.config.models[model].priority = priority;
    }
  }

  public updateModelConstraints(constraints: Partial<Record<ModelType, number>>): void {
    this.config.modelConstraints = {
      ...this.config.modelConstraints,
      ...constraints
    };
  }

  public setDefaultModel(model: ModelType): void {
    if (this.MODEL_CAPABILITIES[model]) {
      this.config.defaultModel = model;
    } else {
      throw new Error('Invalid model type specified for default model');
    }
  }
}