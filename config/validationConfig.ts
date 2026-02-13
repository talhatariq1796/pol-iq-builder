// src/config/validationConfig.ts

import { AnalysisIntent } from './aiConfig';
import { ValidationRule, ValidationSeverity } from './coreConfig';

export type DataType = 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object' | 'geometry';
export type ValidationScope = 'input' | 'processing' | 'output' | 'system';

export interface ValidationConstraint {
  type: DataType;
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: string;
  enum?: Array<string | number | boolean>;
  custom?: (value: unknown) => boolean;
  message: string;
}

export interface FieldValidation {
  field: string;
  constraints: ValidationConstraint[];
  severity: ValidationSeverity;
  dependsOn?: string[];
}

export interface ValidationSchema {
  scope: ValidationScope;
  fields: FieldValidation[];
  customValidators?: Array<(data: unknown) => ValidationError[]>;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  severity: ValidationSeverity;
  value?: unknown;
}

export interface ValidationConfig {
  version: string;
  
  schemas: {
    analysis: Record<AnalysisIntent, ValidationSchema>;
    layer: ValidationSchema;
    spatial: ValidationSchema;
    system: ValidationSchema;
  };
  
  options: {
    failFast: boolean;
    maxErrors: number;
    cacheResults: boolean;
    cacheDuration: number;
  };
  
  customTypes: Record<string, {
    validator: (value: unknown) => boolean;
    message: string;
  }>;
}

// Default configuration
export const defaultValidationConfig: ValidationConfig = {
  version: '1.0.0',
  
  schemas: {
    analysis: {
      CONCENTRATION: {
        scope: 'input',
        fields: [
          {
            field: 'area',
            constraints: [
              {
                type: 'geometry',
                required: true,
                message: 'Valid geometry area is required'
              }
            ],
            severity: 'error'
          },
          {
            field: 'radius',
            constraints: [
              {
                type: 'number',
                min: 0,
                max: 100000,
                message: 'Radius must be between 0 and 100000 meters'
              }
            ],
            severity: 'error'
          }
        ]
      },
      COMPARISON: {
        scope: 'input',
        fields: [
          {
            field: 'areas',
            constraints: [
              {
                type: 'array',
                required: true,
                message: 'At least two areas are required for comparison'
              }
            ],
            severity: 'error'
          }
        ]
      },
      TRENDS: {
        scope: 'input',
        fields: [
          {
            field: 'timeRange',
            constraints: [
              {
                type: 'object',
                required: true,
                message: 'Time range is required for trend analysis'
              }
            ],
            severity: 'error'
          }
        ]
      },
      PROXIMITY: {
        scope: 'input',
        fields: [
          {
            field: 'point',
            constraints: [
              {
                type: 'geometry',
                required: true,
                message: 'Valid point geometry is required'
              }
            ],
            severity: 'error'
          }
        ]
      }
    },
    
    layer: {
      scope: 'system',
      fields: [
        {
          field: 'id',
          constraints: [
            {
              type: 'string',
              required: true,
              pattern: '^[a-zA-Z0-9_-]+$',
              message: 'Layer ID must contain only alphanumeric characters, underscores, and hyphens'
            }
          ],
          severity: 'error'
        },
        {
          field: 'url',
          constraints: [
            {
              type: 'string',
              required: true,
              pattern: '^https?://.+',
              message: 'Layer URL must be a valid HTTP(S) URL'
            }
          ],
          severity: 'error'
        }
      ]
    },
    
    spatial: {
      scope: 'processing',
      fields: [
        {
          field: 'geometry',
          constraints: [
            {
              type: 'geometry',
              required: true,
              message: 'Valid geometry is required'
            }
          ],
          severity: 'error'
        }
      ]
    },
    
    system: {
      scope: 'system',
      fields: [
        {
          field: 'version',
          constraints: [
            {
              type: 'string',
              required: true,
              pattern: '^\\d+\\.\\d+\\.\\d+$',
              message: 'Version must follow semantic versioning'
            }
          ],
          severity: 'error'
        }
      ]
    }
  },
  
  options: {
    failFast: true,
    maxErrors: 10,
    cacheResults: true,
    cacheDuration: 300000 // 5 minutes
  },
  
  customTypes: {
    geometry: {
      validator: (value: any) => {
        // Implementation of geometry validation
        return true;
      },
      message: 'Invalid geometry format'
    }
  }
};

// Utility functions
export function validate(
  data: any,
  schema: ValidationSchema,
  options?: Partial<ValidationConfig['options']>
): ValidationResult {
  // Implementation of validation logic
  return {
    valid: true,
    errors: [],
    warnings: []
  };
}

export function validateField(
  value: any,
  field: FieldValidation
): ValidationError[] {
  // Implementation of field validation
  return [];
}

export function createCustomValidator(
  validator: (value: any) => boolean,
  message: string
): (value: any) => ValidationError[] {
  // Implementation of custom validator creation
  return () => [];
}