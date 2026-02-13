// utils/layer-validation.ts

export interface LayerValidationResult {
  valid: boolean;
  reason?: string;
}

export const validateLayerOperation = (
  agentType: string,
  layerId: string,
  operation: 'query' | 'update' | 'delete'
): LayerValidationResult => {
  // Basic validation rules
  if (!layerId) {
    return {
      valid: false,
      reason: 'Layer ID is required'
    };
  }

  if (!agentType) {
    return {
      valid: false,
      reason: 'Agent type is required'
    };
  }

  // Add more sophisticated validation rules as needed
  // For now, we'll allow all valid layer IDs and agent types
  return {
    valid: true
  };
};