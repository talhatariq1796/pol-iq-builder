import { BaseValidator } from './BaseValidator';
import { ValidationResult, ValidationError, ValidationWarning } from './types';

/**
 * Configuration Synchronization Validator
 * 
 * Validates that key configuration values are synchronized across all files:
 * - Brand names and field mappings
 * - Domain vocabulary and routing terms  
 * - Endpoint configurations and descriptions
 * - Geographic and industry settings
 */
export class ConfigurationSyncValidator extends BaseValidator {
  readonly name = 'configuration-sync';
  readonly description = 'Validates configuration synchronization across all system files';

  private readonly configFiles = {
    brandResolver: 'lib/analysis/utils/BrandNameResolver.ts',
    fieldAliases: 'utils/field-aliases.ts', 
    chatConstants: 'components/chat/chat-constants.ts',
    endpointDescriptions: 'lib/embedding/EndpointDescriptions.ts',
    domainConfiguration: 'lib/routing/DomainConfigurationLoader.ts',
    configurationManager: 'lib/analysis/ConfigurationManager.ts'
  };

  async validate(): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const recommendations: string[] = [];

    try {
      // 1. Validate all configuration files exist
      await this.validateConfigFilesExist(errors);
      
      // 2. Extract configuration values from each file
      const configs = await this.extractConfigurations();
      
      // 3. Validate brand configuration consistency
      await this.validateBrandConsistency(configs, errors, warnings);
      
      // 4. Validate domain vocabulary synchronization
      await this.validateDomainVocabulary(configs, errors, warnings);
      
      // 5. Validate endpoint configuration alignment
      await this.validateEndpointAlignment(configs, errors, warnings);
      
      // 6. Check for industry/domain consistency
      await this.validateIndustryConsistency(configs, errors, warnings);

      // 7. Generate recommendations
      this.generateRecommendations(configs, recommendations);

      return this.createResult(errors, warnings, recommendations);
      
    } catch (error) {
      errors.push(this.createError(
        'VALIDATION_FAILED',
        `Configuration synchronization validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'critical'
      ));
      return this.createResult(errors);
    }
  }

  private async validateConfigFilesExist(errors: ValidationError[]): Promise<void> {
    for (const [name, filePath] of Object.entries(this.configFiles)) {
      const exists = await this.validateFileExists(filePath);
      if (!exists) {
        errors.push(this.createError(
          'MISSING_CONFIG_FILE',
          `Configuration file missing: ${filePath}`,
          'high',
          filePath,
          undefined,
          `Create the missing configuration file or verify the correct path`
        ));
      }
    }
  }

  private async extractConfigurations(): Promise<ConfigurationCollection> {
    const configs: ConfigurationCollection = {
      brandResolver: await this.extractBrandResolverConfig(),
      fieldAliases: await this.extractFieldAliasesConfig(),
      chatConstants: await this.extractChatConstantsConfig(),
      endpointDescriptions: await this.extractEndpointDescriptionsConfig(),
      domainConfiguration: await this.extractDomainConfig(),
      configurationManager: await this.extractConfigurationManagerConfig()
    };

    return configs;
  }

  private async extractBrandResolverConfig(): Promise<BrandResolverConfig> {
    const content = await this.readFile(this.configFiles.brandResolver);
    if (!content) return {};

    const config: BrandResolverConfig = {};
    
    // Extract TARGET_BRAND
    const targetBrandMatch = content.match(/TARGET_BRAND\s*=\s*{\s*fieldName:\s*['"]([\w_]+)['"]\s*,\s*brandName:\s*['"]([\w\s]+)['"]/);
    if (targetBrandMatch) {
      config.targetBrand = {
        fieldName: targetBrandMatch[1],
        brandName: targetBrandMatch[2]
      };
    }

    // Extract COMPETITOR_BRANDS
    const competitorBrandsMatch = content.match(/COMPETITOR_BRANDS\s*=\s*\[([\s\S]*?)\]/);
    if (competitorBrandsMatch) {
      const brandsStr = competitorBrandsMatch[1];
      const brandPattern = /{\s*fieldName:\s*['"]([\w_]+)['"]\s*,\s*brandName:\s*['"]([\w\s]+)['"][\s\S]*?}/g;
      
      config.competitorBrands = [];
      let match;
      while ((match = brandPattern.exec(brandsStr)) !== null) {
        config.competitorBrands.push({
          fieldName: match[1],
          brandName: match[2]
        });
      }
    }

    // Extract PROJECT_INDUSTRY
    const industryMatch = content.match(/PROJECT_INDUSTRY\s*=\s*['"]([\w\s]+)['"]/);
    if (industryMatch) {
      config.projectIndustry = industryMatch[1];
    }

    return config;
  }

  private async extractFieldAliasesConfig(): Promise<FieldAliasesConfig> {
    const content = await this.readFile(this.configFiles.fieldAliases);
    if (!content) return {};

    // Extract brand aliases and industry terms
    const brands: string[] = [];
    const industryTerms: string[] = [];

    // Look for brand name patterns in aliases
    const aliasPattern = /['"]([\w\s-]+)['"]\s*:\s*\[(.*?)\]/g;
    let match;
    
    while ((match = aliasPattern.exec(content)) !== null) {
      const key = match[1].toLowerCase();
      const valuesStr = match[2];
      const values = valuesStr.match(/['"]([\w\s-]+)['"]/g)?.map(v => v.replace(/['"]/g, '')) || [];
      
      if (key.includes('brand') || key.includes('energy') || key.includes('red bull') || key.includes('monster')) {
        brands.push(...values);
      }
      if (key.includes('industry') || key.includes('beverage') || key.includes('drink')) {
        industryTerms.push(...values);
      }
    }

    return { brands: [...new Set(brands)], industryTerms: [...new Set(industryTerms)] };
  }

  private async extractChatConstantsConfig(): Promise<ChatConstantsConfig> {
    const content = await this.readFile(this.configFiles.chatConstants);
    if (!content) return {};

    const config: ChatConstantsConfig = { predefinedQueries: [] };

    // Extract ANALYSIS_CATEGORIES queries
    const categoriesMatch = content.match(/ANALYSIS_CATEGORIES\s*=\s*\[([\s\S]*?)\]/);
    if (categoriesMatch) {
      const categoriesStr = categoriesMatch[1];
      const queryPattern = /query:\s*['"]([\s\S]*?)['"]/g;
      
      let match;
      while ((match = queryPattern.exec(categoriesStr)) !== null) {
        if (!config.predefinedQueries) {
          config.predefinedQueries = [];
        }
        config.predefinedQueries.push(match[1]);
      }
    }

    // Extract brand references from queries
    const brandPattern = /\b(red bull|monster|energy drink|5-hour)\b/gi;
    const brandReferences: string[] = [];
    
    let brandMatch;
    while ((brandMatch = brandPattern.exec(content)) !== null) {
      if (!brandReferences.includes(brandMatch[1].toLowerCase())) {
        brandReferences.push(brandMatch[1].toLowerCase());
      }
    }
    
    config.brandReferences = brandReferences;

    return config;
  }

  private async extractEndpointDescriptionsConfig(): Promise<EndpointDescriptionsConfig> {
    const content = await this.readFile(this.configFiles.endpointDescriptions);
    if (!content) return {};

    const config: EndpointDescriptionsConfig = { endpoints: {} };

    // Extract endpoint descriptions with brand and industry references
    const endpointPattern = /['"]([\w-]+)['"]\s*:\s*{[\s\S]*?description:\s*['"]([\s\S]*?)['"]/g;
    let match;
    
    while ((match = endpointPattern.exec(content)) !== null) {
      const endpoint = match[1];
      const description = match[2];
      
      if (!config.endpoints) {
        config.endpoints = {};
      }
      
      config.endpoints[endpoint] = {
        description,
        brandReferences: this.extractBrandReferences(description),
        industryTerms: this.extractIndustryTerms(description)
      };
    }

    return config;
  }

  private async extractDomainConfig(): Promise<DomainConfig> {
    const content = await this.readFile(this.configFiles.domainConfiguration);
    if (!content) return {};

    const config: DomainConfig = {};

    // Extract domain terms
    const domainTermsMatch = content.match(/domain_terms\s*:\s*{[\s\S]*?primary:\s*\[(.*?)\]/);
    if (domainTermsMatch) {
      const primaryTermsStr = domainTermsMatch[1];
      config.primaryTerms = primaryTermsStr.match(/['"]([\w\s-]+)['"]/g)?.map(t => t.replace(/['"]/g, '')) || [];
    }

    return config;
  }

  private async extractConfigurationManagerConfig(): Promise<ConfigManagerConfig> {
    const content = await this.readFile(this.configFiles.configurationManager);
    if (!content) return {};

    // Extract target variables and field names
    const fieldNames: string[] = [];
    const fieldPattern = /targetVariable\s*:\s*['"]([\w_]+)['"]/g;
    
    let match;
    while ((match = fieldPattern.exec(content)) !== null) {
      if (!fieldNames.includes(match[1])) {
        fieldNames.push(match[1]);
      }
    }

    return { fieldNames };
  }

  private async validateBrandConsistency(
    configs: ConfigurationCollection,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    const brandResolver = configs.brandResolver;
    const fieldAliases = configs.fieldAliases;
    const chatConstants = configs.chatConstants;

    if (!brandResolver.targetBrand) {
      errors.push(this.createError(
        'MISSING_TARGET_BRAND',
        'No target brand configured in BrandNameResolver.ts',
        'critical',
        this.configFiles.brandResolver,
        undefined,
        'Define TARGET_BRAND constant in BrandNameResolver.ts'
      ));
      return;
    }

    const targetBrandName = brandResolver.targetBrand.brandName.toLowerCase();
    
    // Check if target brand is referenced in field aliases
    if (fieldAliases.brands && !fieldAliases.brands.some(b => b.toLowerCase().includes(targetBrandName))) {
      warnings.push(this.createWarning(
        'MISSING_BRAND_ALIAS',
        `Target brand '${brandResolver.targetBrand.brandName}' not found in field aliases`,
        'Brand recognition in queries may be limited',
        'Add brand name and variations to field-aliases.ts'
      ));
    }

    // Check if target brand appears in predefined queries
    if (chatConstants.predefinedQueries && 
        !chatConstants.predefinedQueries.some(q => q.toLowerCase().includes(targetBrandName))) {
      warnings.push(this.createWarning(
        'MISSING_BRAND_QUERIES',
        `Target brand '${brandResolver.targetBrand.brandName}' not referenced in predefined queries`,
        'Users may not see relevant query examples',
        'Update ANALYSIS_CATEGORIES in chat-constants.ts to include brand-specific examples'
      ));
    }

    // Validate competitor brands consistency
    if (brandResolver.competitorBrands) {
      brandResolver.competitorBrands.forEach(competitor => {
        if (fieldAliases.brands && 
            !fieldAliases.brands.some(b => b.toLowerCase().includes(competitor.brandName.toLowerCase()))) {
          warnings.push(this.createWarning(
            'MISSING_COMPETITOR_ALIAS',
            `Competitor brand '${competitor.brandName}' not found in field aliases`,
            'Competitor analysis may be limited'
          ));
        }
      });
    }
  }

  private async validateDomainVocabulary(
    configs: ConfigurationCollection,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    const brandResolver = configs.brandResolver;
    const domainConfig = configs.domainConfiguration;
    const fieldAliases = configs.fieldAliases;

    if (!brandResolver.projectIndustry) {
      warnings.push(this.createWarning(
        'MISSING_PROJECT_INDUSTRY',
        'No project industry defined in BrandNameResolver.ts',
        'Domain-specific routing may be suboptimal'
      ));
      return;
    }

    const industry = brandResolver.projectIndustry.toLowerCase();

    // Check if industry terms align with domain configuration
    if (domainConfig.primaryTerms && 
        !domainConfig.primaryTerms.some(term => industry.includes(term.toLowerCase()) || term.toLowerCase().includes(industry))) {
      warnings.push(this.createWarning(
        'INDUSTRY_DOMAIN_MISMATCH',
        `Project industry '${brandResolver.projectIndustry}' not well represented in domain configuration primary terms`,
        'Query routing may not be optimized for the project domain',
        'Update domain_terms.primary in DomainConfigurationLoader.ts to include industry-specific terms'
      ));
    }

    // Check if field aliases include industry terms
    if (fieldAliases.industryTerms && fieldAliases.industryTerms.length === 0) {
      warnings.push(this.createWarning(
        'MISSING_INDUSTRY_ALIASES',
        'No industry-specific terms found in field aliases',
        'Field recognition for industry-specific queries may be limited'
      ));
    }
  }

  private async validateEndpointAlignment(
    configs: ConfigurationCollection,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    const brandResolver = configs.brandResolver;
    const endpointDescriptions = configs.endpointDescriptions;

    if (!brandResolver.targetBrand || !endpointDescriptions.endpoints) return;

    const targetBrandName = brandResolver.targetBrand.brandName.toLowerCase();
    let brandMentionCount = 0;

    Object.entries(endpointDescriptions.endpoints).forEach(([endpoint, config]) => {
      if (config.brandReferences.some(brand => brand.toLowerCase().includes(targetBrandName))) {
        brandMentionCount++;
      }
    });

    const totalEndpoints = Object.keys(endpointDescriptions.endpoints).length;
    const brandMentionRatio = brandMentionCount / totalEndpoints;

    if (brandMentionRatio < 0.3) { // Less than 30% of endpoints mention the target brand
      warnings.push(this.createWarning(
        'LOW_BRAND_COVERAGE',
        `Only ${brandMentionCount}/${totalEndpoints} endpoint descriptions mention the target brand`,
        'Query routing may not be optimized for brand-specific queries',
        'Update endpoint descriptions in EndpointDescriptions.ts to include more brand-specific examples'
      ));
    }
  }

  private async validateIndustryConsistency(
    configs: ConfigurationCollection,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    const brandResolver = configs.brandResolver;
    const configManager = configs.configurationManager;

    if (!brandResolver.targetBrand) return;

    const targetField = brandResolver.targetBrand.fieldName;
    
    // Check if target field is configured in ConfigurationManager
    if (configManager.fieldNames && !configManager.fieldNames.includes(targetField)) {
      errors.push(this.createError(
        'MISSING_TARGET_FIELD_CONFIG',
        `Target field '${targetField}' not found in ConfigurationManager configurations`,
        'high',
        this.configFiles.configurationManager,
        undefined,
        `Add configuration for field '${targetField}' in ConfigurationManager.ts`
      ));
    }
  }

  private extractBrandReferences(text: string): string[] {
    const brandPattern = /\b(red bull|monster|energy drink|5-hour|rockstar|bang|celsius|prime|gatorade|powerade)\b/gi;
    const brands: string[] = [];
    let match;
    
    while ((match = brandPattern.exec(text)) !== null) {
      if (!brands.includes(match[1].toLowerCase())) {
        brands.push(match[1].toLowerCase());
      }
    }
    
    return brands;
  }

  private extractIndustryTerms(text: string): string[] {
    const industryPattern = /\b(beverage|drink|energy|caffeine|functional|nutrition|sports|fitness|performance|wellness)\b/gi;
    const terms: string[] = [];
    let match;
    
    while ((match = industryPattern.exec(text)) !== null) {
      if (!terms.includes(match[1].toLowerCase())) {
        terms.push(match[1].toLowerCase());
      }
    }
    
    return terms;
  }

  private generateRecommendations(configs: ConfigurationCollection, recommendations: string[]): void {
    recommendations.push(
      'Implement configuration templates to automatically synchronize settings across all files'
    );
    
    recommendations.push(
      'Add automated tests to validate configuration consistency during build process'
    );
    
    if (configs.brandResolver.targetBrand && configs.brandResolver.competitorBrands) {
      recommendations.push(
        `Consider adding more competitor brands beyond the current ${configs.brandResolver.competitorBrands.length} configured`
      );
    }

    recommendations.push(
      'Create a configuration migration script to automatically update all files when changing projects'
    );
  }
}

// Configuration type definitions
interface ConfigurationCollection {
  brandResolver: BrandResolverConfig;
  fieldAliases: FieldAliasesConfig;
  chatConstants: ChatConstantsConfig;
  endpointDescriptions: EndpointDescriptionsConfig;
  domainConfiguration: DomainConfig;
  configurationManager: ConfigManagerConfig;
}

interface BrandResolverConfig {
  targetBrand?: { fieldName: string; brandName: string };
  competitorBrands?: { fieldName: string; brandName: string }[];
  projectIndustry?: string;
}

interface FieldAliasesConfig {
  brands?: string[];
  industryTerms?: string[];
}

interface ChatConstantsConfig {
  predefinedQueries?: string[];
  brandReferences?: string[];
}

interface EndpointDescriptionsConfig {
  endpoints?: Record<string, {
    description: string;
    brandReferences: string[];
    industryTerms: string[];
  }>;
}

interface DomainConfig {
  primaryTerms?: string[];
}

interface ConfigManagerConfig {
  fieldNames?: string[];
}