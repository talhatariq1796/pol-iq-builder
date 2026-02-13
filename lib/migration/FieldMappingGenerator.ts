/**
 * FieldMappingGenerator - Generates EnhancedQueryAnalyzer configurations from templates
 * 
 * This component integrates the overhauled EnhancedQueryAnalyzer with the migration
 * automation system, providing automated configuration generation from project templates.
 */

import { FieldMappingTemplate, FieldMappingConfig, FieldMapping, EndpointConfig, BrandDefinition } from './templates/FieldMappingTemplate';

export class FieldMappingGenerator {
  /**
   * Generate a complete EnhancedQueryAnalyzer configuration from a template
   */
  public generateConfig(template: FieldMappingTemplate): FieldMappingConfig {
    const fieldMappings = this.mergeFieldMappings(template);
    const endpointConfigs = this.generateEndpointConfigs(template);
    
    return {
      fieldMappings,
      endpointConfigs,
      templateInfo: {
        templateName: template.projectContext.name,
        projectName: template.projectContext.name,
        generatedAt: new Date().toISOString(),
        version: template.version
      }
    };
  }

  /**
   * Merge core fields with project-specific fields
   */
  private mergeFieldMappings(template: FieldMappingTemplate): Record<string, FieldMapping> {
    const merged = { ...template.coreFields };
    
    // Add project-specific fields
    Object.entries(template.projectFields).forEach(([key, mapping]) => {
      merged[key] = mapping;
    });
    
    // Generate brand field mappings from brand definitions
    template.brandDefinitions.forEach(brand => {
      const brandKey = this.sanitizeBrandName(brand.name);
      merged[brandKey] = {
        keywords: brand.aliases,
        fields: [brand.fieldName],
        description: brand.description,
        category: 'brand',
        priority: brand.role === 'target' ? 'high' : 'medium'
      };
    });
    
    return merged;
  }

  /**
   * Generate endpoint configurations based on template
   */
  private generateEndpointConfigs(template: FieldMappingTemplate): Record<string, EndpointConfig> {
    // Start with default endpoint configurations
    const configs: Record<string, EndpointConfig> = {
      '/strategic-analysis': {
        primaryKeywords: ['strategic', 'strategy', 'expansion', 'growth', 'opportunity'],
        contextKeywords: ['market opportunity', 'strategic value', 'best markets'],
        avoidTerms: [],
        weight: template.endpointWeights?.['/strategic-analysis'] || 1.0
      },
      '/demographic-insights': {
        primaryKeywords: ['demographic', 'demographics', 'population', 'age', 'income'],
        contextKeywords: ['customer demographics', 'demographic opportunity'],
        avoidTerms: ['customer personas'],
        weight: template.endpointWeights?.['/demographic-insights'] || 1.2
      },
      '/comparative-analysis': {
        primaryKeywords: ['compare', 'comparison', 'between', 'cities', 'regions'],
        contextKeywords: ['compare performance', 'city comparison'],
        avoidTerms: ['correlation'],
        weight: template.endpointWeights?.['/comparative-analysis'] || 0.95
      },
      '/correlation-analysis': {
        primaryKeywords: ['correlation', 'correlate', 'relationship', 'factors predict'],
        contextKeywords: ['demographic factors', 'economic factors'],
        avoidTerms: [],
        weight: template.endpointWeights?.['/correlation-analysis'] || 1.0
      }
    };

    // Add industry-specific endpoint configurations
    if (template.projectContext.industry === 'Energy Drinks') {
      configs['/brand-difference'] = {
        primaryKeywords: ['brand difference', 'vs', 'versus', 'market share', 'brand positioning'],
        contextKeywords: this.generateBrandContextKeywords(template.brandDefinitions),
        avoidTerms: [],
        weight: template.endpointWeights?.['/brand-difference'] || 1.4
      };
      
      configs['/competitive-analysis'] = {
        primaryKeywords: ['competitive', 'competition', 'competitive advantage', 'positioning'],
        contextKeywords: ['competitive analysis', 'market competitiveness'],
        avoidTerms: ['brand difference'],
        weight: template.endpointWeights?.['/competitive-analysis'] || 1.3
      };
    }

    // Add default analysis endpoint
    configs['/analyze'] = {
      primaryKeywords: ['analyze', 'analysis', 'overview', 'insights'],
      contextKeywords: [`comprehensive ${template.projectContext.industry.toLowerCase()} analysis`],
      avoidTerms: [],
      weight: 1.3
    };

    return configs;
  }

  /**
   * Generate brand context keywords from brand definitions
   */
  private generateBrandContextKeywords(brands: BrandDefinition[]): string[] {
    const keywords: string[] = [];
    
    // Generate "brand A and brand B" combinations
    for (let i = 0; i < brands.length; i++) {
      for (let j = i + 1; j < brands.length; j++) {
        const brandA = brands[i].name.toLowerCase();
        const brandB = brands[j].name.toLowerCase();
        keywords.push(`${brandA} and ${brandB}`);
        keywords.push(`${brandB} and ${brandA}`);
        keywords.push(`between ${brandA} and ${brandB}`);
      }
    }
    
    return keywords;
  }

  /**
   * Sanitize brand name for use as object key
   */
  private sanitizeBrandName(brandName: string): string {
    return brandName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace(/^(\d)/, '_$1'); // Prefix with underscore if starts with number
  }

  /**
   * Validate that all required fields exist in the generated configuration
   * 
   * CRITICAL: This validation does NOT check if fields exist in actual data layers.
   * Post-automation field validation against actual data sources is required.
   */
  public validateConfig(config: FieldMappingConfig, template: FieldMappingTemplate, availableFields?: string[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fieldExistenceErrors: string[] = [];
    
    // Check that all required fields have mappings
    template.requiredFields.forEach(fieldName => {
      const hasMapping = Object.values(config.fieldMappings).some(mapping => 
        mapping.fields.includes(fieldName)
      );
      
      if (!hasMapping) {
        errors.push(`Required field '${fieldName}' has no field mapping`);
      }
    });
    
    // CRITICAL: Validate field existence against actual data layers if provided
    if (availableFields) {
      const allMappedFields = new Set<string>();
      Object.values(config.fieldMappings).forEach(mapping => {
        mapping.fields.forEach(field => allMappedFields.add(field));
      });
      
      allMappedFields.forEach(mappedField => {
        if (!availableFields.includes(mappedField)) {
          fieldExistenceErrors.push(`Field '${mappedField}' in template does not exist in project data layers`);
        }
      });
    } else {
      warnings.push('⚠️  CRITICAL: Field existence validation skipped - availableFields not provided');
      warnings.push('🔧 ACTION REQUIRED: Validate all field mappings against actual project data layers post-automation');
    }
    
    // Check that brand definitions have corresponding field mappings
    template.brandDefinitions.forEach(brand => {
      const brandKey = this.sanitizeBrandName(brand.name);
      if (!config.fieldMappings[brandKey]) {
        warnings.push(`Brand '${brand.name}' has no field mapping generated`);
      }
    });
    
    // Check for primary analysis types coverage
    template.projectContext.primaryAnalysisTypes.forEach(analysisType => {
      if (!config.endpointConfigs[analysisType]) {
        warnings.push(`Primary analysis type '${analysisType}' has no endpoint configuration`);
      }
    });
    
    return {
      isValid: errors.length === 0 && fieldExistenceErrors.length === 0,
      errors: [...errors, ...fieldExistenceErrors],
      warnings,
      fieldMappingCount: Object.keys(config.fieldMappings).length,
      endpointConfigCount: Object.keys(config.endpointConfigs).length,
      fieldExistenceValidated: !!availableFields,
      availableFieldsCount: availableFields?.length || 0
    };
  }

  /**
   * Generate configuration and validate in one step
   */
  public generateAndValidateConfig(template: FieldMappingTemplate): {
    config: FieldMappingConfig;
    validation: ValidationResult;
  } {
    const config = this.generateConfig(template);
    const validation = this.validateConfig(config, template);
    
    return { config, validation };
  }
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fieldMappingCount: number;
  endpointConfigCount: number;
  fieldExistenceValidated: boolean;
  availableFieldsCount: number;
}

/**
 * Utility function to create a configured EnhancedQueryAnalyzer from a template
 */
export function createAnalyzerFromTemplate(template: FieldMappingTemplate) {
  const generator = new FieldMappingGenerator();
  const { config, validation } = generator.generateAndValidateConfig(template);
  
  if (!validation.isValid) {
    throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
  }
  
  // Import and create analyzer (dynamic import to avoid circular dependency)
  return import('../analysis/EnhancedQueryAnalyzer').then(({ EnhancedQueryAnalyzer }) => {
    return {
      analyzer: new EnhancedQueryAnalyzer(config),
      validation,
      config
    };
  });
}