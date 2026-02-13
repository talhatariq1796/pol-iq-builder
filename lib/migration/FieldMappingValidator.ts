import { BaseValidator } from './BaseValidator';
import { ValidationResult, ValidationError, ValidationWarning } from './types';
import * as path from 'path';

/**
 * Field Mapping Consistency Validator
 * 
 * Validates that scoring fields are consistently defined across all required files:
 * - utils/chat/client-summarizer.ts (for AI analysis)
 * - lib/analysis/ConfigurationManager.ts (for scoring configuration)
 * - Individual processors (for visualization)
 * - app/api/claude/generate-response/route.ts (for Claude processing)
 */
export class FieldMappingValidator extends BaseValidator {
  readonly name = 'field-mapping';
  readonly description = 'Validates field mapping consistency across all configuration files';

  private readonly criticalFiles = {
    clientSummarizer: 'utils/chat/client-summarizer.ts',
    configurationManager: 'lib/analysis/ConfigurationManager.ts',
    claudeRoute: 'app/api/claude/generate-response/route.ts',
    brandResolver: 'lib/analysis/utils/BrandNameResolver.ts'
  };

  private readonly expectedEndpoints = [
    'strategic-analysis', 'competitive-analysis', 'demographic-analysis',
    'expansion-opportunity', 'market-penetration', 'customer-profile',
    'lifestyle-analysis', 'purchasing-power', 'geographic-trends',
    'real-estate-market', 'healthcare-access', 'retail-potential',
    'education-analysis', 'income-distribution', 'economic-indicators',
    'market-dynamics', 'risk-assessment', 'brand-difference',
    'comparative-analysis', 'segment-profiling', 'scenario-analysis',
    'sensitivity-analysis', 'consensus-analysis', 'model-performance'
  ];

  async validate(): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const recommendations: string[] = [];

    try {
      // 1. Validate all critical files exist
      await this.validateCriticalFilesExist(errors);
      
      // 2. Extract field definitions from each file
      const fieldMappings = await this.extractFieldMappings();
      
      // 3. Validate field consistency
      await this.validateFieldConsistency(fieldMappings, errors, warnings);
      
      // 4. Validate endpoint coverage
      await this.validateEndpointCoverage(fieldMappings, errors, warnings);
      
      // 5. Check for missing or orphaned fields
      await this.validateFieldCompleteness(fieldMappings, errors, warnings);

      // 6. Generate recommendations
      this.generateRecommendations(fieldMappings, recommendations);

      return this.createResult(errors, warnings, recommendations);
      
    } catch (error) {
      errors.push(this.createError(
        'VALIDATION_FAILED',
        `Field mapping validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'critical'
      ));
      return this.createResult(errors);
    }
  }

  private async validateCriticalFilesExist(errors: ValidationError[]): Promise<void> {
    for (const [name, filePath] of Object.entries(this.criticalFiles)) {
      const exists = await this.validateFileExists(filePath);
      if (!exists) {
        errors.push(this.createError(
          'MISSING_CRITICAL_FILE',
          `Critical configuration file missing: ${filePath}`,
          'critical',
          filePath,
          undefined,
          `Create the missing file or check if it has been moved to a different location`
        ));
      }
    }
  }

  private async extractFieldMappings(): Promise<FieldMappingCollection> {
    const mappings: FieldMappingCollection = {
      clientSummarizer: {},
      configurationManager: {},
      claudeRoute: {},
      brandResolver: {}
    };

    // Extract from client-summarizer.ts
    const clientSummarizerContent = await this.readFile(this.criticalFiles.clientSummarizer);
    if (clientSummarizerContent) {
      mappings.clientSummarizer = this.extractClientSummarizerFields(clientSummarizerContent);
    }

    // Extract from ConfigurationManager.ts  
    const configManagerContent = await this.readFile(this.criticalFiles.configurationManager);
    if (configManagerContent) {
      mappings.configurationManager = this.extractConfigurationManagerFields(configManagerContent);
    }

    // Extract from Claude route
    const claudeRouteContent = await this.readFile(this.criticalFiles.claudeRoute);
    if (claudeRouteContent) {
      mappings.claudeRoute = this.extractClaudeRouteFields(claudeRouteContent);
    }

    // Extract from BrandNameResolver
    const brandResolverContent = await this.readFile(this.criticalFiles.brandResolver);
    if (brandResolverContent) {
      mappings.brandResolver = this.extractBrandResolverFields(brandResolverContent);
    }

    return mappings;
  }

  private extractClientSummarizerFields(content: string): Record<string, string[]> {
    const endpointFields: Record<string, string[]> = {};
    
    // Look for endpoint field arrays like: 'competitive-analysis': ['competitive_score', 'other_field']
    const endpointPattern = /['"]([\w-]+)['"]\s*:\s*\[([\s\S]*?)\]/g;
    let match;
    
    while ((match = endpointPattern.exec(content)) !== null) {
      const endpoint = match[1];
      const fieldsStr = match[2];
      
      // Extract field names from the array
      const fieldPattern = /['"]([\w_]+)['"]/g;
      const fields: string[] = [];
      let fieldMatch;
      
      while ((fieldMatch = fieldPattern.exec(fieldsStr)) !== null) {
        fields.push(fieldMatch[1]);
      }
      
      if (fields.length > 0) {
        endpointFields[endpoint] = fields;
      }
    }
    
    return endpointFields;
  }

  private extractConfigurationManagerFields(content: string): Record<string, string[]> {
    const endpointFields: Record<string, string[]> = {};
    
    // Look for scoreFieldName and targetVariable definitions
    const configPattern = /['"]([\w-]+)['"]\s*:\s*\{[\s\S]*?scoreFieldName\s*:\s*['"]([\w_]+)['"]/g;
    let match;
    
    while ((match = configPattern.exec(content)) !== null) {
      const endpoint = match[1];
      const scoreField = match[2];
      endpointFields[endpoint] = [scoreField];
    }
    
    return endpointFields;
  }

  private extractClaudeRouteFields(content: string): Record<string, string[]> {
    // Extract fields referenced in Claude processing
    const fields = this.extractFieldNames(content);
    return { 'claude-processing': fields };
  }

  private extractBrandResolverFields(content: string): Record<string, string[]> {
    const fields = this.extractFieldNames(content);
    return { 'brand-resolver': fields };
  }

  private async validateFieldConsistency(
    mappings: FieldMappingCollection, 
    errors: ValidationError[], 
    warnings: ValidationWarning[]
  ): Promise<void> {
    // Compare client-summarizer fields with configuration manager
    for (const endpoint of this.expectedEndpoints) {
      const clientFields = mappings.clientSummarizer[endpoint] || [];
      const configFields = mappings.configurationManager[endpoint] || [];
      
      if (clientFields.length === 0 && configFields.length === 0) {
        continue; // Skip endpoints not configured in either location
      }
      
      if (clientFields.length === 0) {
        errors.push(this.createError(
          'MISSING_CLIENT_FIELDS',
          `Endpoint '${endpoint}' has configuration in ConfigurationManager but no fields in client-summarizer.ts`,
          'high',
          this.criticalFiles.clientSummarizer,
          undefined,
          `Add field mapping for '${endpoint}' to client-summarizer.ts: '${endpoint}': ${JSON.stringify(configFields)}`
        ));
      }
      
      if (configFields.length === 0) {
        warnings.push(this.createWarning(
          'MISSING_CONFIG_FIELDS',
          `Endpoint '${endpoint}' has fields in client-summarizer.ts but no configuration in ConfigurationManager`,
          'Endpoint may not function properly for scoring operations'
        ));
      }
      
      // Check for field mismatches
      if (clientFields.length > 0 && configFields.length > 0) {
        const missingInClient = configFields.filter(f => !clientFields.includes(f));
        const missingInConfig = clientFields.filter(f => !configFields.includes(f));
        
        if (missingInClient.length > 0) {
          errors.push(this.createError(
            'FIELD_MISMATCH_CLIENT',
            `Fields missing from client-summarizer.ts for '${endpoint}': ${missingInClient.join(', ')}`,
            'high',
            this.criticalFiles.clientSummarizer
          ));
        }
        
        if (missingInConfig.length > 0) {
          warnings.push(this.createWarning(
            'FIELD_MISMATCH_CONFIG', 
            `Fields in client-summarizer.ts not configured in ConfigurationManager for '${endpoint}': ${missingInConfig.join(', ')}`,
            'May cause inconsistent field processing'
          ));
        }
      }
    }
  }

  private async validateEndpointCoverage(
    mappings: FieldMappingCollection,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    const clientEndpoints = Object.keys(mappings.clientSummarizer);
    const configEndpoints = Object.keys(mappings.configurationManager);
    
    const missingFromClient = this.expectedEndpoints.filter(e => !clientEndpoints.includes(e));
    const missingFromConfig = this.expectedEndpoints.filter(e => !configEndpoints.includes(e));
    
    if (missingFromClient.length > 0) {
      warnings.push(this.createWarning(
        'INCOMPLETE_CLIENT_COVERAGE',
        `Endpoints missing from client-summarizer.ts: ${missingFromClient.join(', ')}`,
        'These endpoints may not generate proper AI analysis',
        'Add field mappings for missing endpoints or remove them from the expected endpoint list'
      ));
    }
    
    if (missingFromConfig.length > 0) {
      warnings.push(this.createWarning(
        'INCOMPLETE_CONFIG_COVERAGE',
        `Endpoints missing from ConfigurationManager.ts: ${missingFromConfig.join(', ')}`,
        'These endpoints may not have proper scoring configuration'
      ));
    }
  }

  private async validateFieldCompleteness(
    mappings: FieldMappingCollection,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    // Check if brand resolver fields are present in other configurations
    const brandFields = mappings.brandResolver['brand-resolver'] || [];
    const allClientFields = Object.values(mappings.clientSummarizer).flat();
    
    brandFields.forEach(field => {
      if (!allClientFields.includes(field)) {
        warnings.push(this.createWarning(
          'ORPHANED_BRAND_FIELD',
          `Brand field '${field}' not found in any endpoint configuration`,
          'Brand analysis may not work correctly',
          `Add '${field}' to appropriate endpoint configurations in client-summarizer.ts`
        ));
      }
    });
  }

  private generateRecommendations(mappings: FieldMappingCollection, recommendations: string[]): void {
    const totalEndpoints = this.expectedEndpoints.length;
    const configuredEndpoints = Object.keys(mappings.clientSummarizer).length;
    
    if (configuredEndpoints < totalEndpoints) {
      recommendations.push(
        `Consider implementing field mappings for the remaining ${totalEndpoints - configuredEndpoints} endpoints to enable full system functionality`
      );
    }
    
    recommendations.push(
      'Implement a centralized field registry to prevent future synchronization issues between configuration files'
    );
    
    recommendations.push(
      'Add automated tests that validate field consistency as part of the build process'
    );
  }
}

interface FieldMappingCollection {
  clientSummarizer: Record<string, string[]>;
  configurationManager: Record<string, string[]>;
  claudeRoute: Record<string, string[]>;
  brandResolver: Record<string, string[]>;
}