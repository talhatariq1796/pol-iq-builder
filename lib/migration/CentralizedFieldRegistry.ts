import { FieldDefinition, ValidationResult, ValidationError, ValidationWarning } from './types';
import { BaseValidator } from './BaseValidator';
import * as path from 'path';

/**
 * Centralized Field Registry System
 * 
 * Provides a single source of truth for field definitions and automatically
 * generates configuration for all dependent files. This eliminates the 
 * distributed field management issue where fields are defined in multiple locations.
 */
export class CentralizedFieldRegistry {
  private static instance: CentralizedFieldRegistry;
  private fields: Map<string, FieldDefinition> = new Map();
  private endpoints: Map<string, EndpointFieldMapping> = new Map();

  private constructor() {
    this.initializeDefaultFields();
  }

  static getInstance(): CentralizedFieldRegistry {
    if (!CentralizedFieldRegistry.instance) {
      CentralizedFieldRegistry.instance = new CentralizedFieldRegistry();
    }
    return CentralizedFieldRegistry.instance;
  }

  /**
   * Register a field definition with the registry
   */
  registerField(definition: FieldDefinition): void {
    this.fields.set(definition.fieldName, definition);
    
    // Update endpoint mapping
    if (!this.endpoints.has(definition.endpoint)) {
      this.endpoints.set(definition.endpoint, {
        endpoint: definition.endpoint,
        fields: [],
        scoreField: null,
        requiredFields: [],
        optionalFields: []
      });
    }

    const endpointMapping = this.endpoints.get(definition.endpoint)!;
    
    // Remove existing field if it exists
    endpointMapping.fields = endpointMapping.fields.filter(f => f.fieldName !== definition.fieldName);
    endpointMapping.fields.push(definition);

    // Categorize field
    if (definition.dataType === 'score') {
      endpointMapping.scoreField = definition;
    }
    
    if (definition.required) {
      endpointMapping.requiredFields = endpointMapping.requiredFields.filter(f => f.fieldName !== definition.fieldName);
      endpointMapping.requiredFields.push(definition);
    } else {
      endpointMapping.optionalFields = endpointMapping.optionalFields.filter(f => f.fieldName !== definition.fieldName);
      endpointMapping.optionalFields.push(definition);
    }
  }

  /**
   * Get all registered fields
   */
  getAllFields(): FieldDefinition[] {
    return Array.from(this.fields.values());
  }

  /**
   * Get fields for a specific endpoint
   */
  getEndpointFields(endpoint: string): FieldDefinition[] {
    const mapping = this.endpoints.get(endpoint);
    return mapping ? mapping.fields : [];
  }

  /**
   * Get the score field for an endpoint
   */
  getEndpointScoreField(endpoint: string): FieldDefinition | null {
    const mapping = this.endpoints.get(endpoint);
    return mapping?.scoreField || null;
  }

  /**
   * Validate that all registered fields exist in provided data
   */
  validateFieldsInData(endpointData: Record<string, any>): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!endpointData.results || !Array.isArray(endpointData.results) || endpointData.results.length === 0) {
      errors.push({
        code: 'FIELD_REGISTRY_NO_DATA',
        message: 'No data provided for field validation',
        severity: 'critical'
      });
      return { isValid: false, errors, warnings, recommendations: [], score: 0 };
    }

    const sampleRecord = endpointData.results[0];
    const dataFields = Object.keys(sampleRecord);
    
    // Check for missing required fields
    this.fields.forEach((fieldDef, fieldName) => {
      if (fieldDef.required && !dataFields.includes(fieldName)) {
        errors.push({
          code: 'FIELD_REGISTRY_MISSING_REQUIRED',
          message: `Required field '${fieldName}' not found in data`,
          severity: 'high',
          suggestion: `Add field '${fieldName}' to data or mark as optional`
        });
      } else if (!fieldDef.required && !dataFields.includes(fieldName)) {
        warnings.push({
          code: 'FIELD_REGISTRY_MISSING_OPTIONAL',
          message: `Optional field '${fieldName}' not found in data`,
          impact: 'Feature may not be available'
        });
      }
    });

    const isValid = errors.filter(e => e.severity === 'critical' || e.severity === 'high').length === 0;
    const score = Math.max(0, 1.0 - (errors.length * 0.2 + warnings.length * 0.05));

    return { isValid, errors, warnings, recommendations: [], score };
  }

  /**
   * Generate client-summarizer.ts configuration
   */
  generateClientSummarizerConfig(): string {
    const lines: string[] = [];
    lines.push('// Auto-generated field mappings from CentralizedFieldRegistry');
    lines.push('// DO NOT EDIT MANUALLY - Update registry and regenerate');
    lines.push('');
    lines.push('export const ENDPOINT_FIELD_MAPPINGS = {');
    
    Array.from(this.endpoints.keys()).sort().forEach(endpoint => {
      const fields = this.getEndpointFields(endpoint);
      const fieldNames = fields.map(f => `'${f.fieldName}'`);
      lines.push(`  '${endpoint}': [${fieldNames.join(', ')}],`);
    });
    
    lines.push('};');
    lines.push('');
    lines.push('// Field descriptions for reference');
    lines.push('export const FIELD_DESCRIPTIONS = {');
    
    this.fields.forEach((fieldDef, fieldName) => {
      lines.push(`  '${fieldName}': '${fieldDef.description}',`);
    });
    
    lines.push('};');
    
    return lines.join('\n');
  }

  /**
   * Generate ConfigurationManager.ts configuration
   */
  generateConfigurationManagerConfig(): string {
    const lines: string[] = [];
    lines.push('// Auto-generated configuration from CentralizedFieldRegistry');
    lines.push('// DO NOT EDIT MANUALLY - Update registry and regenerate');
    lines.push('');
    lines.push('export const ENDPOINT_CONFIGURATIONS = {');
    
    Array.from(this.endpoints.keys()).sort().forEach(endpoint => {
      const scoreField = this.getEndpointScoreField(endpoint);
      if (scoreField) {
        lines.push(`  '${endpoint}': {`);
        lines.push(`    targetVariable: '${scoreField.fieldName}',`);
        lines.push(`    scoreFieldName: '${scoreField.fieldName}',`);
        lines.push(`    description: '${scoreField.description}',`);
        lines.push(`    dataType: '${scoreField.dataType}'`);
        lines.push(`  },`);
      }
    });
    
    lines.push('};');
    
    return lines.join('\n');
  }

  /**
   * Generate field aliases configuration
   */
  generateFieldAliasesConfig(): string {
    const lines: string[] = [];
    lines.push('// Auto-generated field aliases from CentralizedFieldRegistry');
    lines.push('// DO NOT EDIT MANUALLY - Update registry and regenerate');
    lines.push('');
    lines.push('export const FIELD_ALIASES = {');
    
    this.fields.forEach((fieldDef, fieldName) => {
      if (fieldDef.aliases && fieldDef.aliases.length > 0) {
        const aliases = fieldDef.aliases.map(a => `'${a}'`).join(', ');
        lines.push(`  '${fieldName}': [${aliases}],`);
      }
    });
    
    lines.push('};');
    
    return lines.join('\n');
  }

  /**
   * Export registry to JSON for backup/import
   */
  exportRegistry(): RegistryExport {
    return {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      fields: Array.from(this.fields.values()),
      endpoints: Array.from(this.endpoints.keys())
    };
  }

  /**
   * Import registry from JSON
   */
  importRegistry(registryData: RegistryExport): void {
    this.fields.clear();
    this.endpoints.clear();
    
    registryData.fields.forEach(fieldDef => {
      this.registerField(fieldDef);
    });
  }

  /**
   * Initialize default fields for current system
   */
  private initializeDefaultFields(): void {
    // Strategic Analysis fields
    this.registerField({
      fieldName: 'strategic_score',
      endpoint: 'strategic-analysis',
      dataType: 'score',
      required: true,
      description: 'Strategic analysis score for market opportunities',
      aliases: ['strategic', 'strategy', 'market strategy']
    });

    // Competitive Analysis fields
    this.registerField({
      fieldName: 'competitive_score',
      endpoint: 'competitive-analysis', 
      dataType: 'score',
      required: true,
      description: 'Competitive analysis score for market positioning',
      aliases: ['competitive', 'competition', 'competitor analysis']
    });

    // Demographic Analysis fields
    this.registerField({
      fieldName: 'demographic_score',
      endpoint: 'demographic-analysis',
      dataType: 'score', 
      required: true,
      description: 'Demographic analysis score for population characteristics',
      aliases: ['demographic', 'demographics', 'population']
    });

    // Expansion Opportunity fields
    this.registerField({
      fieldName: 'expansion_score',
      endpoint: 'expansion-opportunity',
      dataType: 'score',
      required: true,
      description: 'Expansion opportunity score for growth potential',
      aliases: ['expansion', 'growth', 'opportunity']
    });

    // Market Penetration fields
    this.registerField({
      fieldName: 'penetration_score',
      endpoint: 'market-penetration',
      dataType: 'score',
      required: true,
      description: 'Market penetration score for market share analysis',
      aliases: ['penetration', 'market share', 'market penetration']
    });

    // Customer Profile fields
    this.registerField({
      fieldName: 'customer_score',
      endpoint: 'customer-profile',
      dataType: 'score',
      required: true,
      description: 'Customer profile score for target audience analysis',
      aliases: ['customer', 'profile', 'target customer']
    });

    // Add brand fields (these should be updated based on project)
    this.registerField({
      fieldName: 'MP12207A_B_P', // Red Bull example
      endpoint: 'brand-analysis',
      dataType: 'competitive',
      required: true,
      description: 'Red Bull energy drink consumption percentage',
      aliases: ['red bull', 'redbull', 'energy drink']
    });

    // Geographic fields (common across endpoints)
    this.registerField({
      fieldName: 'GEOID',
      endpoint: 'geographic-reference',
      dataType: 'geographic',
      required: true,
      description: 'Geographic identifier (ZIP code)',
      aliases: ['zip code', 'postal code', 'geographic id']
    });

    this.registerField({
      fieldName: 'DESCRIPTION',
      endpoint: 'geographic-reference', 
      dataType: 'geographic',
      required: true,
      description: 'Geographic area description',
      aliases: ['area name', 'location', 'description']
    });
  }

  /**
   * Update field definitions for a new project
   */
  updateForProject(projectConfig: ProjectFieldConfig): void {
    // Clear existing brand fields
    const existingFields = Array.from(this.fields.values());
    existingFields.forEach(field => {
      if (field.dataType === 'competitive') {
        this.fields.delete(field.fieldName);
      }
    });

    // Add new project brand fields
    projectConfig.targetBrand && this.registerField({
      fieldName: projectConfig.targetBrand.fieldName,
      endpoint: 'brand-analysis',
      dataType: 'competitive',
      required: true,
      description: `${projectConfig.targetBrand.brandName} consumption/usage data`,
      aliases: [projectConfig.targetBrand.brandName.toLowerCase(), ...projectConfig.targetBrand.aliases || []]
    });

    projectConfig.competitorBrands?.forEach(competitor => {
      this.registerField({
        fieldName: competitor.fieldName,
        endpoint: 'competitive-analysis',
        dataType: 'competitive',
        required: false,
        description: `${competitor.brandName} competitor data`,
        aliases: [competitor.brandName.toLowerCase(), ...competitor.aliases || []]
      });
    });

    // Update score fields based on actual data structure
    if (projectConfig.scoreFields) {
      projectConfig.scoreFields.forEach(scoreConfig => {
        this.registerField({
          fieldName: scoreConfig.fieldName,
          endpoint: scoreConfig.endpoint,
          dataType: 'score',
          required: true,
          description: scoreConfig.description,
          aliases: scoreConfig.aliases
        });
      });
    }
  }
}

/**
 * Field Registry Validator
 * Validates the integrity and consistency of the centralized field registry
 */
export class FieldRegistryValidator extends BaseValidator {
  readonly name = 'field-registry';
  readonly description = 'Validates centralized field registry consistency and completeness';

  private registry = CentralizedFieldRegistry.getInstance();

  async validate(): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const recommendations: string[] = [];

    // Validate registry completeness
    this.validateRegistryCompleteness(errors, warnings);
    
    // Validate field definitions
    this.validateFieldDefinitions(errors, warnings);
    
    // Generate recommendations
    this.generateRegistryRecommendations(recommendations);

    return this.createResult(errors, warnings, recommendations);
  }

  private validateRegistryCompleteness(errors: ValidationError[], warnings: ValidationWarning[]): void {
    const fields = this.registry.getAllFields();
    
    if (fields.length === 0) {
      errors.push(this.createError(
        'EMPTY_REGISTRY',
        'Field registry contains no field definitions',
        'critical',
        undefined,
        undefined,
        'Initialize registry with field definitions or import from existing configuration'
      ));
      return;
    }

    // Check for required field types
    const scoreFields = fields.filter(f => f.dataType === 'score');
    const geographicFields = fields.filter(f => f.dataType === 'geographic');
    
    if (scoreFields.length === 0) {
      warnings.push(this.createWarning(
        'NO_SCORE_FIELDS',
        'No score fields registered in field registry',
        'Scoring functionality may not work properly'
      ));
    }

    if (geographicFields.length === 0) {
      warnings.push(this.createWarning(
        'NO_GEOGRAPHIC_FIELDS',
        'No geographic fields registered in field registry',
        'Geographic analysis may not work properly'
      ));
    }
  }

  private validateFieldDefinitions(errors: ValidationError[], warnings: ValidationWarning[]): void {
    const fields = this.registry.getAllFields();
    
    fields.forEach(field => {
      // Validate field name format
      if (!/^[A-Z0-9_]+$/i.test(field.fieldName)) {
        warnings.push(this.createWarning(
          'INVALID_FIELD_NAME_FORMAT',
          `Field name '${field.fieldName}' doesn't follow standard naming conventions`,
          'May cause issues with data processing'
        ));
      }

      // Validate required fields have descriptions
      if (field.required && !field.description) {
        warnings.push(this.createWarning(
          'MISSING_FIELD_DESCRIPTION',
          `Required field '${field.fieldName}' missing description`,
          'Field purpose may be unclear to developers'
        ));
      }

      // Validate endpoint exists
      if (!field.endpoint) {
        errors.push(this.createError(
          'MISSING_FIELD_ENDPOINT',
          `Field '${field.fieldName}' has no endpoint assignment`,
          'medium',
          undefined,
          undefined,
          'Assign field to an appropriate endpoint'
        ));
      }
    });
  }

  private generateRegistryRecommendations(recommendations: string[]): void {
    const fields = this.registry.getAllFields();
    const endpoints = new Set(fields.map(f => f.endpoint));
    
    recommendations.push(
      `Registry contains ${fields.length} fields across ${endpoints.size} endpoints`
    );
    
    recommendations.push(
      'Regularly backup the field registry configuration to prevent data loss'
    );
    
    recommendations.push(
      'Use registry-generated configurations to ensure consistency across all files'
    );
    
    if (fields.some(f => !f.aliases || f.aliases.length === 0)) {
      recommendations.push(
        'Consider adding aliases to fields to improve query recognition'
      );
    }
  }
}

// Supporting interfaces
interface EndpointFieldMapping {
  endpoint: string;
  fields: FieldDefinition[];
  scoreField: FieldDefinition | null;
  requiredFields: FieldDefinition[];
  optionalFields: FieldDefinition[];
}

interface RegistryExport {
  version: string;
  timestamp: string;
  fields: FieldDefinition[];
  endpoints: string[];
}

interface ProjectFieldConfig {
  targetBrand?: {
    fieldName: string;
    brandName: string;
    aliases?: string[];
  };
  competitorBrands?: {
    fieldName: string;
    brandName: string;
    aliases?: string[];
  }[];
  scoreFields?: {
    fieldName: string;
    endpoint: string;
    description: string;
    aliases?: string[];
  }[];
}