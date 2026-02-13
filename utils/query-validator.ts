import { LayerConfig } from '../types/layers';
import { layers } from '@/config/layers';

/**
 * Result interface for query validation
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
  correctedQuery?: string;
  details?: {
    referencedFields: string[];
    usedOperators: string[];
    conditions: number;
  };
  requiredFields?: string[];
  visualizationIntent?: {
    mode: 'distribution' | 'highlight' | 'correlation';
    topN?: number;
    breaks?: number;
  };
}

/**
 * Legacy exported function for backward compatibility
 */
export function validateArcGISQuery(whereClause: string): { 
  isValid: boolean; 
  error?: string; 
  correctedQuery?: string; 
} {
  const validator = new QueryValidator(layers);
  return validator.validateWhereClause(whereClause);
}

/**
 * Main QueryValidator class for validating ArcGIS SQL queries
 */
export class QueryValidator {
  private readonly VALID_OPERATORS = [
    '=', '<>', '>', '<', '>=', '<=',
    'LIKE', 'IN', 'IS NULL', 'IS NOT NULL',
    'BETWEEN', 'AND', 'OR', 'NOT'
  ];

  private readonly FORBIDDEN_KEYWORDS = [
    'DROP', 'DELETE', 'INSERT', 'UPDATE', 'CREATE', 'ALTER', 'TRUNCATE',
    'GRANT', 'REVOKE', 'MERGE', '--', ';', 'UNION', 'SELECT', 'FROM', 'WHERE'
  ];

  private readonly VALID_FUNCTIONS = [
    'UPPER', 'LOWER', 'TRIM', 'ROUND', 'EXTRACT',
    'CHAR_LENGTH', 'SUBSTRING', 'POSITION',
    'ABS', 'CEILING', 'FLOOR', 'POWER'
  ];

  private layers: Record<string, LayerConfig>;

  constructor(layers: Record<string, LayerConfig>) {
    this.layers = layers;
  }

  /**
   * Validates query and extracts required fields
   */
  public validateWhereClause(whereClause: string): ValidationResult {
    try {
      // Basic validation
      if (!this.validateBasicSyntax(whereClause)) {
        return {
          isValid: false,
          error: 'Empty query or invalid basic syntax'
        };
      }

      // SQL injection prevention
      if (this.hasDangerousKeywords(whereClause)) {
        return {
          isValid: false,
          error: 'Query contains forbidden keywords or syntax'
        };
      }

      // Extract fields and operators
      const referencedFields = this.extractFields(whereClause);
      const usedOperators = this.extractOperators(whereClause);
      const conditions = this.countConditions(whereClause);

      // Attempt corrections
      const correctedQuery = this.correctQuery(whereClause);

      return {
        isValid: true,
        correctedQuery: correctedQuery !== whereClause ? correctedQuery : undefined,
        details: {
          referencedFields,
          usedOperators,
          conditions
        },
        requiredFields: referencedFields
      };

    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Invalid query syntax'
      };
    }
  }

  /**
   * Analyzes query for visualization intent
   */
  private analyzeVisualizationIntent(query: string): ValidationResult['visualizationIntent'] {
    const queryLower = query.toLowerCase();
    
    // Check for correlation keywords first
    const correlationKeywords = [
      'correlation',
      'relationship',
      'compare',
      'versus',
      'vs',
      'between',
      'relate',
      'connection',
      'correlate'
    ];
    
    const isCorrelationQuery = correlationKeywords.some(keyword => queryLower.includes(keyword));
    
    if (isCorrelationQuery) {
      return {
        mode: 'correlation'
      };
    }

    // Check for highlight mode indicators
    const topNMatch = queryLower.match(/\b(top|highest|most|best)\s+(\d+)\b/);
    const highlightTerms = [
      'highest concentration',
      'most concentrated',
      'hotspot',
      'peak',
      'maximum'
    ];
    
    const isHighlightMode = topNMatch || 
      highlightTerms.some(term => queryLower.includes(term));

    if (isHighlightMode) {
      return {
        mode: 'highlight',
        topN: topNMatch ? parseInt(topNMatch[2]) : 10
      };
    }

    // Check for explicit distribution mode indicators
    const distributionPatterns = [
      /(?:show|display|visualize|map)\s+(?:the\s+)?distribution\s+of\s+(\w+)/i,
      /(?:show|display|visualize|map)\s+(?:the\s+)?pattern\s+of\s+(\w+)/i,
      /(?:show|display|visualize|map)\s+(?:how|where)\s+(\w+)\s+(?:is|are)\s+distributed/i,
      /distribution\s+of\s+(\w+)/i,
      /pattern\s+of\s+(\w+)/i
    ];

    const isDistributionMode = distributionPatterns.some(pattern => pattern.test(queryLower));

    if (isDistributionMode) {
      return {
        mode: 'distribution',
        breaks: 5
      };
    }

    // Return undefined if no specific visualization intent is detected
    return undefined;
  }

  /**
   * Full validation with layer context and required fields
   */
  public validate(query: string, layerId: string, requiredFields?: string[]): ValidationResult {
    // If no layer configs, fall back to basic validation
    if (!this.layers) {
      return {
        ...this.validateWhereClause(query),
        visualizationIntent: this.analyzeVisualizationIntent(query)
      };
    }

    try {
      // Get layer config
      const layer = this.layers[layerId];
      if (!layer) {
        return {
          isValid: false,
          error: `Layer ${layerId} not found`
        };
      }

      // Basic validation first
      const basicValidation = this.validateWhereClause(query);
      if (!basicValidation.isValid) {
        return basicValidation;
      }

      // Check required fields are present
      const fieldsToCheck = requiredFields || [];
      if (fieldsToCheck.length > 0) {
        const missingFields = fieldsToCheck.filter(
          field => !basicValidation.details?.referencedFields.includes(field)
        );
        if (missingFields.length > 0) {
          return {
            isValid: false,
            error: `Missing required fields: ${missingFields.join(', ')}`,
            details: basicValidation.details
          };
        }
      }

      // Add visualization intent analysis
      return {
        ...basicValidation,
        requiredFields: basicValidation.details?.referencedFields,
        visualizationIntent: this.analyzeVisualizationIntent(query)
      };

    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Invalid query syntax'
      };
    }
  }

  /**
   * Validates basic syntax requirements
   */
  private validateBasicSyntax(query: string): boolean {
    if (!query?.trim()) {
      return false;
    }

    // Check for balanced parentheses
    const parenCount = (query.match(/\(/g) || []).length;
    const closingParenCount = (query.match(/\)/g) || []).length;
    if (parenCount !== closingParenCount) {
      return false;
    }

    // Check for balanced quotes
    return this.hasBalancedQuotes(query);
  }

  /**
   * Checks for balanced quotes in the query
   */
  private hasBalancedQuotes(query: string): boolean {
    let singleQuotes = 0;
    let doubleQuotes = 0;
    let isEscaped = false;

    for (let i = 0; i < query.length; i++) {
      if (query[i] === '\\') {
        isEscaped = !isEscaped;
        continue;
      }

      if (!isEscaped) {
        if (query[i] === "'") singleQuotes++;
        if (query[i] === '"') doubleQuotes++;
      }

      isEscaped = false;
    }

    return singleQuotes % 2 === 0 && doubleQuotes % 2 === 0;
  }

  /**
   * Validates operators in the query
   */
  private validateOperators(query: string): ValidationResult {
    const operators = this.extractOperators(query);
    const invalidOperators = operators.filter(op => 
      !this.VALID_OPERATORS.includes(op.toUpperCase())
    );

    if (invalidOperators.length > 0) {
      return {
        isValid: false,
        error: `Invalid operators: ${invalidOperators.join(', ')}`
      };
    }

    return { isValid: true };
  }

  /**
   * Validates fields against layer configuration
   */
  private validateFields(fields: string[], layer: LayerConfig): ValidationResult {
    const invalidFields = fields.filter(field => !this.isValidField(field, layer));

    if (invalidFields.length > 0) {
      return {
        isValid: false,
        error: `Invalid fields: ${invalidFields.join(', ')}`
      };
    }

    return { isValid: true };
  }

  /**
   * Validates functions used in the query
   */
  private validateFunctions(query: string): ValidationResult {
    const functions = this.extractFunctions(query);
    const invalidFunctions = functions.filter(fn => 
      !this.VALID_FUNCTIONS.includes(fn.toUpperCase())
    );

    if (invalidFunctions.length > 0) {
      return {
        isValid: false,
        error: `Invalid functions: ${invalidFunctions.join(', ')}`
      };
    }

    return { isValid: true };
  }

  /**
   * Validates field values match field types
   */
  private validateFieldValues(
    query: string, 
    fields: string[], 
    layer: LayerConfig
  ): ValidationResult {
    // Extract value patterns based on field types
    for (const field of fields) {
      const fieldConfig = layer.fields.find(f => f.name === field);
      if (!fieldConfig) continue;

      const valuePattern = this.getValuePatternForType(fieldConfig.type);
      const fieldPattern = new RegExp(
        `"?${field}"?\\s*(?:=|<>|>|<|>=|<=|LIKE|IN)\\s*(${valuePattern})`,
        'i'
      );

      const match = query.match(fieldPattern);
      if (match && !this.isValidValueForType(match[1], fieldConfig.type)) {
        return {
          isValid: false,
          error: `Invalid value for field ${field} of type ${fieldConfig.type}`
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Gets regex pattern for field type
   */
  private getValuePatternForType(type: string): string {
    switch (type.toLowerCase()) {
      case 'string':
      case 'text':
        return "'[^']*'";
      case 'number':
      case 'integer':
      case 'double':
      case 'float':
        return "-?\\d+(?:\\.\\d+)?";
      case 'date':
      case 'datetime':
        return "timestamp '\\d{4}-\\d{2}-\\d{2}(?: \\d{2}:\\d{2}:\\d{2})?'";
      case 'boolean':
        return "(?:true|false|1|0)";
      default:
        return ".*";
    }
  }

  /**
   * Checks if value matches type
   */
  private isValidValueForType(value: string, type: string): boolean {
    const pattern = new RegExp(`^${this.getValuePatternForType(type)}$`, 'i');
    return pattern.test(value);
  }

  /**
   * Extracts field names from query
   */
  private extractFields(query: string): string[] {
    const patterns = [
      /["`]?(\w+)["`]?\s*(?:[=<>]|LIKE|IN|IS)/gi,
      /(?:AND|OR)\s+["`]?(\w+)["`]?/gi,
      /\bBETWEEN\s+["`]?(\w+)["`]?/gi
    ];

    const fields = new Set<string>();
    patterns.forEach(pattern => {
      const matches = Array.from(query.matchAll(pattern));
      matches.forEach(match => {
        if (match[1]) fields.add(match[1].replace(/["`]/g, ''));
      });
    });

    return Array.from(fields);
  }

  /**
   * Extracts operators from query
   */
  private extractOperators(query: string): string[] {
    const operatorPattern = /(?:<>|>=|<=|=|>|<|LIKE|NOT LIKE|IN|NOT IN|IS NULL|IS NOT NULL|BETWEEN|AND|OR|NOT)\b/gi;
    return Array.from(query.matchAll(operatorPattern)).map(m => m[0].toUpperCase());
  }

  /**
   * Extracts function names from query
   */
  private extractFunctions(query: string): string[] {
    const functionPattern = /(\w+)\s*\(/g;
    return Array.from(query.matchAll(functionPattern)).map(m => m[1].toUpperCase());
  }

  /**
   * Checks for dangerous SQL keywords
   */
  private hasDangerousKeywords(query: string): boolean {
    const normalizedQuery = query.toUpperCase();
    return this.FORBIDDEN_KEYWORDS.some(keyword => {
      const pattern = new RegExp(`\\b${keyword}\\b`, 'i');
      return pattern.test(normalizedQuery);
    });
  }

  /**
   * Validates field exists in layer
   */
  private isValidField(field: string, layer: LayerConfig): boolean {
    const cleanField = field.replace(/["`]/g, '');
    return layer.fields.some(f => f.name === cleanField);
  }

  /**
   * Counts conditions in query
   */
  private countConditions(query: string): number {
    return (query.toUpperCase().match(/\b(AND|OR)\b/g) || []).length + 1;
  }

  /**
   * Corrects common query issues
   */
  private correctQuery(query: string): string {
    let corrected = query;

    // Ensure field names use double quotes
    corrected = corrected.replace(/\b(\w+)\b(?=\s*[=<>])/g, '"$1"');

    // Ensure string literals use single quotes
    corrected = corrected.replace(/"([^"]+)"\s*(?=[=<>])/g, "'$1'");

    // Normalize NULL checks
    corrected = corrected.replace(/(["`]\w+["`])\s+IS\s+NULL\b/gi, '$1 IS NULL');
    corrected = corrected.replace(/(["`]\w+["`])\s+IS\s+NOT\s+NULL\b/gi, '$1 IS NOT NULL');

    // Normalize BETWEEN syntax
    corrected = corrected.replace(/\bBETWEEN\s+(\d+)\s+AND\s+(\d+)/gi, 'BETWEEN $1 AND $2');

    // Normalize text operators
    corrected = corrected.replace(/\bLIKE\s+([^'\s]+)/gi, "LIKE '$1'");

    return corrected;
  }
}

export default QueryValidator;