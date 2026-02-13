/**
 * Filter Validation Service
 * 
 * Validates field filter configurations and provides error handling
 * for the advanced filtering system.
 */

import { 
  FieldFilterConfig, 
  NumericFilter, 
  CategoricalFilter, 
  TextFilter, 
  NullFilter,
  FieldDefinition 
} from '../types';

// ============================================================================
// VALIDATION ERROR TYPES
// ============================================================================

export interface ValidationError {
  field: string;
  filterType: 'numeric' | 'categorical' | 'text' | 'null';
  errorType: 'range' | 'required' | 'format' | 'length' | 'invalid';
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  fieldCount: number;
  activeFilterCount: number;
}

// ============================================================================
// VALIDATION RULES
// ============================================================================

/**
 * Validation rules for numeric filters
 */
function validateNumericFilter(
  fieldName: string, 
  filter: NumericFilter, 
  fieldDef?: FieldDefinition
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!filter.enabled) return errors;

  // Check if min/max values are provided
  if (filter.min === undefined && filter.max === undefined && !filter.range) {
    errors.push({
      field: fieldName,
      filterType: 'numeric',
      errorType: 'required',
      message: 'At least one of min, max, or range must be specified',
      severity: 'error',
    });
  }

  // Validate min/max relationship
  if (filter.min !== undefined && filter.max !== undefined && filter.min >= filter.max) {
    errors.push({
      field: fieldName,
      filterType: 'numeric',
      errorType: 'range',
      message: 'Minimum value must be less than maximum value',
      severity: 'error',
    });
  }

  // Validate against field definition range
  if (fieldDef?.range) {
    if (filter.min !== undefined && filter.min < fieldDef.range.min) {
      errors.push({
        field: fieldName,
        filterType: 'numeric',
        errorType: 'range',
        message: `Minimum value ${filter.min} is below field minimum ${fieldDef.range.min}`,
        severity: 'warning',
      });
    }

    if (filter.max !== undefined && filter.max > fieldDef.range.max) {
      errors.push({
        field: fieldName,
        filterType: 'numeric',
        errorType: 'range',
        message: `Maximum value ${filter.max} exceeds field maximum ${fieldDef.range.max}`,
        severity: 'warning',
      });
    }
  }

  // Validate range array
  if (filter.range) {
    if (filter.range.length !== 2) {
      errors.push({
        field: fieldName,
        filterType: 'numeric',
        errorType: 'format',
        message: 'Range must contain exactly two values',
        severity: 'error',
      });
    } else if (filter.range[0] >= filter.range[1]) {
      errors.push({
        field: fieldName,
        filterType: 'numeric',
        errorType: 'range',
        message: 'Range start must be less than range end',
        severity: 'error',
      });
    }
  }

  return errors;
}

/**
 * Validation rules for categorical filters
 */
function validateCategoricalFilter(
  fieldName: string, 
  filter: CategoricalFilter, 
  fieldDef?: FieldDefinition
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!filter.enabled) return errors;

  // Check if any categories are selected
  const hasSelection = (filter.mode === 'include' && filter.included.length > 0) ||
                      (filter.mode === 'exclude' && filter.excluded.length > 0);

  if (!hasSelection) {
    errors.push({
      field: fieldName,
      filterType: 'categorical',
      errorType: 'required',
      message: 'At least one category must be selected',
      severity: 'warning',
    });
  }

  // Validate categories against field definition
  if (fieldDef?.categories) {
    const validCategories = new Set(fieldDef.categories);
    
    // Check included categories
    const invalidIncluded = filter.included.filter(cat => !validCategories.has(cat));
    if (invalidIncluded.length > 0) {
      errors.push({
        field: fieldName,
        filterType: 'categorical',
        errorType: 'invalid',
        message: `Invalid categories: ${invalidIncluded.join(', ')}`,
        severity: 'error',
      });
    }

    // Check excluded categories
    const invalidExcluded = filter.excluded.filter(cat => !validCategories.has(cat));
    if (invalidExcluded.length > 0) {
      errors.push({
        field: fieldName,
        filterType: 'categorical',
        errorType: 'invalid',
        message: `Invalid excluded categories: ${invalidExcluded.join(', ')}`,
        severity: 'error',
      });
    }
  }

  // Check for reasonable selection limits
  if (filter.included.length > 50) {
    errors.push({
      field: fieldName,
      filterType: 'categorical',
      errorType: 'length',
      message: 'Large number of included categories may impact performance',
      severity: 'info',
    });
  }

  return errors;
}

/**
 * Validation rules for text filters
 */
function validateTextFilter(
  fieldName: string, 
  filter: TextFilter, 
  fieldDef?: FieldDefinition
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!filter.enabled) return errors;

  // Check if query is provided
  if (!filter.query || filter.query.trim().length === 0) {
    errors.push({
      field: fieldName,
      filterType: 'text',
      errorType: 'required',
      message: 'Search query is required',
      severity: 'error',
    });
  }

  // Check query length
  if (filter.query && filter.query.length < 2) {
    errors.push({
      field: fieldName,
      filterType: 'text',
      errorType: 'length',
      message: 'Search query should be at least 2 characters long',
      severity: 'warning',
    });
  }

  // Check for very long queries that might impact performance
  if (filter.query && filter.query.length > 100) {
    errors.push({
      field: fieldName,
      filterType: 'text',
      errorType: 'length',
      message: 'Very long queries may impact search performance',
      severity: 'info',
    });
  }

  // Check for potentially problematic patterns
  if (filter.query && filter.mode === 'contains' && filter.query.includes('*')) {
    errors.push({
      field: fieldName,
      filterType: 'text',
      errorType: 'format',
      message: 'Wildcard characters are not supported in contains mode',
      severity: 'warning',
    });
  }

  return errors;
}

/**
 * Validation rules for null filters
 */
function validateNullFilter(
  fieldName: string, 
  filter: NullFilter, 
  fieldDef?: FieldDefinition
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!filter.enabled) return errors;

  // Check if field supports null values
  if (fieldDef && !fieldDef.nullable && filter.mode !== 'exclude') {
    errors.push({
      field: fieldName,
      filterType: 'null',
      errorType: 'invalid',
      message: 'This field does not support null values',
      severity: 'warning',
    });
  }

  return errors;
}

// ============================================================================
// FILTER VALIDATION SERVICE CLASS
// ============================================================================

export class FilterValidationService {
  private static instance: FilterValidationService;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): FilterValidationService {
    if (!FilterValidationService.instance) {
      FilterValidationService.instance = new FilterValidationService();
    }
    return FilterValidationService.instance;
  }

  /**
   * Validate complete field filter configuration
   */
  public validateFieldFilters(
    fieldFilters: FieldFilterConfig,
    fieldDefinitions?: FieldDefinition[]
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    
    // Create field definition lookup
    const fieldDefMap = new Map<string, FieldDefinition>();
    if (fieldDefinitions) {
      fieldDefinitions.forEach(def => fieldDefMap.set(def.name, def));
    }

    // Validate numeric filters
    Object.entries(fieldFilters.numericFilters).forEach(([fieldName, filter]) => {
      const fieldDef = fieldDefMap.get(fieldName);
      const validationErrors = validateNumericFilter(fieldName, filter, fieldDef);
      
      validationErrors.forEach(error => {
        if (error.severity === 'error') {
          errors.push(error);
        } else {
          warnings.push(error);
        }
      });
    });

    // Validate categorical filters
    Object.entries(fieldFilters.categoricalFilters).forEach(([fieldName, filter]) => {
      const fieldDef = fieldDefMap.get(fieldName);
      const validationErrors = validateCategoricalFilter(fieldName, filter, fieldDef);
      
      validationErrors.forEach(error => {
        if (error.severity === 'error') {
          errors.push(error);
        } else {
          warnings.push(error);
        }
      });
    });

    // Validate text filters
    Object.entries(fieldFilters.textFilters).forEach(([fieldName, filter]) => {
      const fieldDef = fieldDefMap.get(fieldName);
      const validationErrors = validateTextFilter(fieldName, filter, fieldDef);
      
      validationErrors.forEach(error => {
        if (error.severity === 'error') {
          errors.push(error);
        } else {
          warnings.push(error);
        }
      });
    });

    // Validate null filters
    Object.entries(fieldFilters.nullFilters).forEach(([fieldName, filter]) => {
      const fieldDef = fieldDefMap.get(fieldName);
      const validationErrors = validateNullFilter(fieldName, filter, fieldDef);
      
      validationErrors.forEach(error => {
        if (error.severity === 'error') {
          errors.push(error);
        } else {
          warnings.push(error);
        }
      });
    });

    // Calculate statistics
    const fieldCount = new Set([
      ...Object.keys(fieldFilters.numericFilters),
      ...Object.keys(fieldFilters.categoricalFilters),
      ...Object.keys(fieldFilters.textFilters),
      ...Object.keys(fieldFilters.nullFilters),
    ]).size;

    const activeFilterCount = [
      ...Object.values(fieldFilters.numericFilters),
      ...Object.values(fieldFilters.categoricalFilters),
      ...Object.values(fieldFilters.textFilters),
      ...Object.values(fieldFilters.nullFilters),
    ].filter(filter => filter.enabled).length;

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      fieldCount,
      activeFilterCount,
    };
  }

  /**
   * Validate a single field filter
   */
  public validateSingleFilter(
    fieldName: string,
    filter: NumericFilter | CategoricalFilter | TextFilter | NullFilter,
    filterType: 'numeric' | 'categorical' | 'text' | 'null',
    fieldDefinition?: FieldDefinition
  ): ValidationError[] {
    switch (filterType) {
      case 'numeric':
        return validateNumericFilter(fieldName, filter as NumericFilter, fieldDefinition);
      case 'categorical':
        return validateCategoricalFilter(fieldName, filter as CategoricalFilter, fieldDefinition);
      case 'text':
        return validateTextFilter(fieldName, filter as TextFilter, fieldDefinition);
      case 'null':
        return validateNullFilter(fieldName, filter as NullFilter, fieldDefinition);
      default:
        return [];
    }
  }

  /**
   * Get validation summary for UI display
   */
  public getValidationSummary(validation: ValidationResult): string {
    if (validation.errors.length > 0) {
      return `${validation.errors.length} error${validation.errors.length !== 1 ? 's' : ''} found`;
    }
    
    if (validation.warnings.length > 0) {
      return `${validation.warnings.length} warning${validation.warnings.length !== 1 ? 's' : ''}`;
    }
    
    if (validation.activeFilterCount > 0) {
      return `${validation.activeFilterCount} filter${validation.activeFilterCount !== 1 ? 's' : ''} active`;
    }
    
    return 'No filters configured';
  }

  /**
   * Fix common filter configuration issues automatically
   */
  public autoFixFilters(fieldFilters: FieldFilterConfig): FieldFilterConfig {
    const fixed: FieldFilterConfig = {
      numericFilters: { ...fieldFilters.numericFilters },
      categoricalFilters: { ...fieldFilters.categoricalFilters },
      textFilters: { ...fieldFilters.textFilters },
      nullFilters: { ...fieldFilters.nullFilters },
    };

    // Fix numeric filters
    Object.entries(fixed.numericFilters).forEach(([fieldName, filter]) => {
      if (filter.enabled && filter.min !== undefined && filter.max !== undefined) {
        if (filter.min >= filter.max) {
          // Swap min and max if they're in wrong order
          const temp = filter.min;
          filter.min = filter.max;
          filter.max = temp;
        }
      }
    });

    // Fix text filters
    Object.entries(fixed.textFilters).forEach(([fieldName, filter]) => {
      if (filter.enabled && filter.query) {
        // Trim whitespace
        filter.query = filter.query.trim();
      }
    });

    return fixed;
  }
}

// Export singleton instance
export const filterValidationService = FilterValidationService.getInstance();