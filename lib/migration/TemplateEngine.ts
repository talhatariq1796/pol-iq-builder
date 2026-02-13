import { ProjectTemplate, BrandDefinition, DomainVocabulary, EndpointMapping, ValidationResult, ValidationError, ValidationWarning } from './types';
import { BaseValidator } from './BaseValidator';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Template Engine for Configuration Generation
 * 
 * Generates consistent configuration files from project templates,
 * eliminating manual synchronization across multiple files.
 */
export class TemplateEngine {
  private templates: Map<string, ProjectTemplate> = new Map();
  private generators: Map<string, ConfigurationGenerator> = new Map();

  constructor() {
    this.initializeGenerators();
  }

  /**
   * Register a project template
   */
  registerTemplate(template: ProjectTemplate): void {
    this.templates.set(template.name, template);
  }

  /**
   * Get all registered templates
   */
  getTemplates(): ProjectTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get a specific template by name
   */
  getTemplate(name: string): ProjectTemplate | null {
    return this.templates.get(name) || null;
  }

  /**
   * Generate all configuration files for a project template
   */
  async generateAllConfigurations(templateName: string, outputDir: string = './generated-config'): Promise<GenerationResult> {
    const template = this.getTemplate(templateName);
    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }

    const results: ConfigurationResult[] = [];
    const errors: ValidationError[] = [];

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Generate each configuration file
    for (const [generatorName, generator] of this.generators) {
      try {
        console.log(`🔄 Generating ${generatorName} configuration...`);
        
        const content = generator.generate(template);
        const outputPath = path.join(outputDir, generator.getOutputFileName());
        
        await fs.writeFile(outputPath, content, 'utf-8');
        
        results.push({
          generator: generatorName,
          outputPath: outputPath,
          success: true,
          contentLength: content.length
        });
        
        console.log(`✅ Generated ${generatorName}: ${outputPath}`);
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push({
          code: 'GENERATION_FAILED',
          message: `Failed to generate ${generatorName}: ${errorMsg}`,
          severity: 'high'
        });
        
        results.push({
          generator: generatorName,
          outputPath: '',
          success: false,
          error: errorMsg
        });
        
        console.log(`❌ Failed ${generatorName}: ${errorMsg}`);
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;

    return {
      template: templateName,
      outputDirectory: outputDir,
      results: results,
      success: errors.length === 0,
      summary: {
        total: totalCount,
        successful: successCount,
        failed: totalCount - successCount,
        errors: errors
      }
    };
  }

  /**
   * Generate a specific configuration file
   */
  async generateConfiguration(templateName: string, generatorName: string, outputPath?: string): Promise<string> {
    const template = this.getTemplate(templateName);
    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }

    const generator = this.generators.get(generatorName);
    if (!generator) {
      throw new Error(`Generator '${generatorName}' not found`);
    }

    const content = generator.generate(template);
    
    if (outputPath) {
      await fs.writeFile(outputPath, content, 'utf-8');
    }
    
    return content;
  }

  /**
   * Initialize configuration generators
   */
  private initializeGenerators(): void {
    this.generators.set('BrandResolver', new BrandResolverGenerator());
    this.generators.set('FieldAliases', new FieldAliasesGenerator());
    this.generators.set('ChatConstants', new ChatConstantsGenerator());
    this.generators.set('EndpointDescriptions', new EndpointDescriptionsGenerator());
    this.generators.set('ConfigurationManager', new ConfigurationManagerGenerator());
    this.generators.set('DomainConfiguration', new DomainConfigurationGenerator());
    this.generators.set('MicroservicePackage', new MicroservicePackageGenerator());
  }
}

/**
 * Base class for all configuration generators
 */
export abstract class ConfigurationGenerator {
  abstract name: string;
  abstract description: string;
  abstract targetFile: string;

  abstract generate(template: ProjectTemplate): string;
  
  getOutputFileName(): string {
    return path.basename(this.targetFile);
  }

  protected generateHeader(description: string): string {
    return `// Auto-generated configuration from template: ${description}
// Generated on: ${new Date().toISOString()}
// DO NOT EDIT MANUALLY - Update template and regenerate
//
// To regenerate: npm run generate-config --template=[template-name]
`;
  }

  protected formatBrandArray(brands: BrandDefinition[]): string {
    return brands.map(brand => `
  {
    fieldName: '${brand.fieldName}',
    brandName: '${brand.name}',
    role: '${brand.role}',
    aliases: [${brand.aliases.map(a => `'${a}'`).join(', ')}]
  }`).join(',');
  }

  protected formatStringArray(items: string[]): string {
    return items.map(item => `'${item}'`).join(', ');
  }
}

/**
 * BrandNameResolver.ts Generator
 */
export class BrandResolverGenerator extends ConfigurationGenerator {
  name = 'BrandResolver';
  description = 'Generates BrandNameResolver.ts configuration';
  targetFile = 'lib/analysis/utils/BrandNameResolver.ts';

  generate(template: ProjectTemplate): string {
    const targetBrand = template.brands.find(b => b.role === 'target');
    const competitorBrands = template.brands.filter(b => b.role === 'competitor');
    const marketCategory = template.brands.find(b => b.role === 'market_category');

    return `${this.generateHeader('BrandNameResolver')}

// Target Brand Configuration
export const TARGET_BRAND = {
  fieldName: '${targetBrand?.fieldName || ''}',
  brandName: '${targetBrand?.name || ''}',
  aliases: [${this.formatStringArray(targetBrand?.aliases || [])}]
};

// Competitor Brands Configuration
export const COMPETITOR_BRANDS = [${this.formatBrandArray(competitorBrands)}
];

// Market Category Configuration
export const MARKET_CATEGORY = {
  fieldName: '${marketCategory?.fieldName || ''}',
  brandName: '${marketCategory?.name || 'All Brands'}',
  aliases: [${this.formatStringArray(marketCategory?.aliases || [])}]
};

// Project Industry
export const PROJECT_INDUSTRY = '${template.industry}';

// Domain Context
export const PROJECT_DOMAIN = '${template.domain}';

// Utility Functions
export function getTargetBrandField(): string {
  return TARGET_BRAND.fieldName;
}

export function getCompetitorBrandFields(): string[] {
  return COMPETITOR_BRANDS.map(brand => brand.fieldName);
}

export function getAllBrandFields(): string[] {
  return [
    TARGET_BRAND.fieldName,
    ...getCompetitorBrandFields(),
    MARKET_CATEGORY.fieldName
  ].filter(field => field.length > 0);
}

export function getBrandByField(fieldName: string): BrandDefinition | null {
  if (TARGET_BRAND.fieldName === fieldName) {
    return { ...TARGET_BRAND, role: 'target' } as BrandDefinition;
  }
  
  const competitor = COMPETITOR_BRANDS.find(b => b.fieldName === fieldName);
  if (competitor) {
    return competitor;
  }
  
  if (MARKET_CATEGORY.fieldName === fieldName) {
    return { ...MARKET_CATEGORY, role: 'market_category' } as BrandDefinition;
  }
  
  return null;
}

interface BrandDefinition {
  fieldName: string;
  brandName: string;
  role: 'target' | 'competitor' | 'market_category';
  aliases: string[];
}
`;
  }
}

/**
 * Field Aliases Generator
 */
export class FieldAliasesGenerator extends ConfigurationGenerator {
  name = 'FieldAliases';
  description = 'Generates field-aliases.ts configuration';
  targetFile = 'utils/field-aliases.ts';

  generate(template: ProjectTemplate): string {
    const brandAliases: string[] = [];
    const industryTerms = template.vocabularyTerms.primary.concat(template.vocabularyTerms.secondary);
    
    // Collect all brand names and aliases
    template.brands.forEach(brand => {
      brandAliases.push(brand.name.toLowerCase());
      brandAliases.push(...brand.aliases);
    });

    return `${this.generateHeader('Field Aliases')}

export const FIELD_ALIASES = {
  // Brand Aliases
  ${template.brands.map(brand => `'${brand.fieldName}': [${this.formatStringArray([brand.name.toLowerCase(), ...brand.aliases])}]`).join(',\n  ')},
  
  // Industry Terms
  'industry': [${this.formatStringArray(industryTerms)}],
  
  // Domain-Specific Terms
  'domain': [${this.formatStringArray(template.vocabularyTerms.context)}],
  
  // Geographic Terms
  'geographic': ['zip code', 'postal code', 'area', 'location', 'region', 'territory'],
  
  // Analysis Terms
  'analysis': ['analysis', 'insights', 'data', 'metrics', 'performance', 'trends'],
  
  // Competitive Terms
  'competitive': ['competitor', 'competition', 'market share', 'positioning', 'advantage'],
  
  // Customer Terms
  'customer': ['customer', 'consumer', 'audience', 'demographic', 'segment', 'profile']
};

// Synonym mappings for query understanding
export const SYNONYMS = {
  ${Object.entries(template.vocabularyTerms.synonyms || {}).map(([key, values]) => 
    `'${key}': [${this.formatStringArray(values)}]`
  ).join(',\n  ')}
};

// Get all aliases for a field
export function getFieldAliases(fieldName: string): string[] {
  return FIELD_ALIASES[fieldName as keyof typeof FIELD_ALIASES] || [];
}

// Find field by alias
export function findFieldByAlias(alias: string): string | null {
  const lowerAlias = alias.toLowerCase();
  
  for (const [fieldName, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.includes(lowerAlias)) {
      return fieldName;
    }
  }
  
  return null;
}
`;
  }
}

/**
 * Chat Constants Generator
 */
export class ChatConstantsGenerator extends ConfigurationGenerator {
  name = 'ChatConstants';
  description = 'Generates chat-constants.ts with predefined queries';
  targetFile = 'components/chat/chat-constants.ts';

  generate(template: ProjectTemplate): string {
    const targetBrand = template.brands.find(b => b.role === 'target')?.name || 'Target Brand';
    const competitor1 = template.brands.find(b => b.role === 'competitor')?.name || 'Competitor';
    const industry = template.industry;

    return `${this.generateHeader('Chat Constants')}

export const ANALYSIS_CATEGORIES = [
  {
    id: 'strategic-analysis',
    title: 'Strategic Market Analysis',
    icon: '🎯',
    query: \`Show me the top strategic markets for ${targetBrand} ${industry.toLowerCase()} expansion\`,
    description: 'Identify optimal markets for business expansion'
  },
  {
    id: 'competitive-analysis',
    title: 'Competitive Landscape',
    icon: '🏁',
    query: \`Compare ${targetBrand} vs ${competitor1} competitive positioning\`,
    description: 'Analyze competitive positioning and market dynamics'
  },
  {
    id: 'demographic-analysis',
    title: 'Target Demographics',
    icon: '👥',
    query: \`What are the key demographics for ${targetBrand} consumers?\`,
    description: 'Understand customer demographics and characteristics'
  },
  {
    id: 'expansion-opportunity',
    title: 'Growth Opportunities',
    icon: '📈',
    query: \`Where are the best expansion opportunities for ${targetBrand}?\`,
    description: 'Discover untapped markets and growth potential'
  },
  {
    id: 'market-penetration',
    title: 'Market Penetration',
    icon: '💹',
    query: \`Analyze ${targetBrand} market penetration across different regions\`,
    description: 'Assess current market share and penetration rates'
  },
  {
    id: 'customer-profile',
    title: 'Customer Profiling',
    icon: '🎭',
    query: \`Create detailed customer profiles for ${targetBrand} users\`,
    description: 'Build comprehensive customer personas and segments'
  },
  {
    id: 'scenario-analysis',
    title: 'Scenario Planning',
    icon: '🔮',
    query: \`What if ${targetBrand} changes its pricing strategy - which markets would be most resilient?\`,
    description: 'Analyze different business scenarios and outcomes'
  },
  {
    id: 'sensitivity-analysis',
    title: 'Market Sensitivity',
    icon: '⚖️',
    query: \`How do ${industry.toLowerCase()} rankings change if we adjust demographic weights by 20%?\`,
    description: 'Test sensitivity to parameter changes'
  }
];

// Quick action suggestions
export const QUICK_ACTIONS = [
  \`Compare ${targetBrand} performance across different income segments\`,
  \`Show me areas with high ${industry.toLowerCase()} consumption but low competition\`,
  \`Analyze seasonal trends in ${targetBrand} usage\`,
  \`Identify markets similar to top-performing ${targetBrand} areas\`,
  \`What demographic factors predict ${targetBrand} success?\`
];

// Industry-specific terminology for query enhancement
export const INDUSTRY_TERMS = {
  primary: [${this.formatStringArray(template.vocabularyTerms.primary)}],
  secondary: [${this.formatStringArray(template.vocabularyTerms.secondary)}],
  context: [${this.formatStringArray(template.vocabularyTerms.context)}]
};

// Brand-specific terms
export const BRAND_TERMS = {
  target: '${targetBrand.toLowerCase()}',
  competitors: [${this.formatStringArray(template.brands.filter(b => b.role === 'competitor').map(b => b.name.toLowerCase()))}],
  industry: '${industry.toLowerCase()}'
};

export default ANALYSIS_CATEGORIES;
`;
  }
}

/**
 * Endpoint Descriptions Generator
 */
export class EndpointDescriptionsGenerator extends ConfigurationGenerator {
  name = 'EndpointDescriptions';
  description = 'Generates EndpointDescriptions.ts for semantic routing';
  targetFile = 'lib/embedding/EndpointDescriptions.ts';

  generate(template: ProjectTemplate): string {
    const targetBrand = template.brands.find(b => b.role === 'target')?.name || 'Target Brand';
    const industry = template.industry;

    return `${this.generateHeader('Endpoint Descriptions')}

// Endpoint descriptions for semantic routing optimization
export const ENDPOINT_DESCRIPTIONS = {
  '/strategic-analysis': {
    description: \`Strategic market analysis for ${industry.toLowerCase()} businesses focusing on ${targetBrand} market opportunities, competitive positioning, and growth strategies. Analyzes market dynamics, competitive landscape, and strategic positioning for business expansion decisions.\`,
    keywords: [${this.formatStringArray(['strategic', 'market', 'analysis', 'competitive', 'positioning', 'growth', 'expansion', targetBrand.toLowerCase(), ...template.vocabularyTerms.primary])}],
    sampleQueries: [
      \`Strategic analysis for ${targetBrand}\`,
      \`Market positioning opportunities\`,
      \`${targetBrand} competitive strategy\`,
      \`${industry} market dynamics\`
    ],
    concepts: [${this.formatStringArray(['business strategy', 'market analysis', 'competitive intelligence', 'strategic planning'])}]
  },

  '/competitive-analysis': {
    description: \`Competitive analysis for ${industry.toLowerCase()} market including ${targetBrand} positioning against competitors, market share analysis, competitive advantages, and positioning strategies. Compare brand performance and identify competitive gaps.\`,
    keywords: [${this.formatStringArray(['competitive', 'competition', 'competitors', 'market share', 'positioning', 'advantage', targetBrand.toLowerCase(), ...template.brands.filter(b => b.role === 'competitor').map(b => b.name.toLowerCase())])}],
    sampleQueries: [
      \`${targetBrand} vs competitors\`,
      \`Competitive landscape analysis\`,
      \`Market share comparison\`,
      \`Competitive positioning\`
    ],
    concepts: [${this.formatStringArray(['competitive intelligence', 'market positioning', 'brand comparison', 'competitive advantage'])}]
  },

  '/demographic-analysis': {
    description: \`Demographic analysis for ${targetBrand} ${industry.toLowerCase()} consumers including age, income, lifestyle, and geographic distribution patterns. Understand customer demographics and population characteristics that drive ${industry.toLowerCase()} consumption.\`,
    keywords: [${this.formatStringArray(['demographic', 'demographics', 'population', 'age', 'income', 'lifestyle', 'consumers', targetBrand.toLowerCase()])}],
    sampleQueries: [
      \`${targetBrand} customer demographics\`,
      \`Population characteristics\`,
      \`Demographic trends\`,
      \`Consumer profiles\`
    ],
    concepts: [${this.formatStringArray(['demographic analysis', 'population studies', 'consumer demographics', 'market segmentation'])}]
  },

  '/expansion-opportunity': {
    description: \`Expansion opportunity analysis for ${targetBrand} identifying untapped markets, growth potential, and optimal locations for ${industry.toLowerCase()} business expansion. Find new market opportunities and growth areas.\`,
    keywords: [${this.formatStringArray(['expansion', 'opportunity', 'growth', 'untapped', 'markets', 'new markets', targetBrand.toLowerCase()])}],
    sampleQueries: [
      \`${targetBrand} expansion opportunities\`,
      \`Growth potential analysis\`,
      \`New market identification\`,
      \`Untapped markets\`
    ],
    concepts: [${this.formatStringArray(['business expansion', 'market opportunity', 'growth analysis', 'market development'])}]
  },

  '/market-penetration': {
    description: \`Market penetration analysis for ${targetBrand} ${industry.toLowerCase()} products showing current market share, penetration rates, and market coverage across different geographic areas and customer segments.\`,
    keywords: [${this.formatStringArray(['market penetration', 'market share', 'penetration rate', 'coverage', 'saturation', targetBrand.toLowerCase()])}],
    sampleQueries: [
      \`${targetBrand} market penetration\`,
      \`Market share analysis\`,
      \`Penetration rates\`,
      \`Market coverage\`
    ],
    concepts: [${this.formatStringArray(['market penetration', 'market share analysis', 'brand penetration', 'market coverage'])}]
  },

  '/customer-profile': {
    description: \`Customer profile analysis for ${targetBrand} ${industry.toLowerCase()} consumers creating detailed customer personas, behavioral patterns, preferences, and purchasing habits for targeted marketing and product development.\`,
    keywords: [${this.formatStringArray(['customer', 'profile', 'persona', 'behavior', 'preferences', 'purchasing', targetBrand.toLowerCase()])}],
    sampleQueries: [
      \`${targetBrand} customer profiles\`,
      \`Customer personas\`,
      \`Consumer behavior patterns\`,
      \`Customer characteristics\`
    ],
    concepts: [${this.formatStringArray(['customer profiling', 'consumer behavior', 'customer personas', 'behavioral analysis'])}]
  }
};

// Get endpoint description
export function getEndpointDescription(endpoint: string) {
  return ENDPOINT_DESCRIPTIONS[endpoint as keyof typeof ENDPOINT_DESCRIPTIONS];
}

// Get all keywords for semantic matching
export function getAllKeywords(): string[] {
  const allKeywords: string[] = [];
  Object.values(ENDPOINT_DESCRIPTIONS).forEach(desc => {
    allKeywords.push(...desc.keywords);
  });
  return [...new Set(allKeywords)];
}

export default ENDPOINT_DESCRIPTIONS;
`;
  }
}

/**
 * Configuration Manager Generator
 */
export class ConfigurationManagerGenerator extends ConfigurationGenerator {
  name = 'ConfigurationManager';
  description = 'Generates ConfigurationManager.ts scoring configurations';
  targetFile = 'lib/analysis/ConfigurationManager.ts';

  generate(template: ProjectTemplate): string {
    const targetBrand = template.brands.find(b => b.role === 'target');
    
    return `${this.generateHeader('Configuration Manager')}

// Endpoint scoring configurations
export const ENDPOINT_CONFIGURATIONS = {
  'strategic-analysis': {
    targetVariable: 'strategic_score',
    scoreFieldName: 'strategic_score',
    description: 'Strategic market analysis scoring',
    brandContext: '${targetBrand?.name || 'Target Brand'}',
    industry: '${template.industry}'
  },
  'competitive-analysis': {
    targetVariable: 'competitive_score', 
    scoreFieldName: 'competitive_score',
    description: 'Competitive positioning analysis scoring',
    brandContext: '${targetBrand?.name || 'Target Brand'}',
    industry: '${template.industry}'
  },
  'demographic-analysis': {
    targetVariable: 'demographic_score',
    scoreFieldName: 'demographic_score', 
    description: 'Demographic characteristics analysis scoring',
    brandContext: '${targetBrand?.name || 'Target Brand'}',
    industry: '${template.industry}'
  },
  'expansion-opportunity': {
    targetVariable: 'expansion_score',
    scoreFieldName: 'expansion_score',
    description: 'Market expansion opportunity scoring',
    brandContext: '${targetBrand?.name || 'Target Brand'}',
    industry: '${template.industry}'
  },
  'market-penetration': {
    targetVariable: 'penetration_score',
    scoreFieldName: 'penetration_score',
    description: 'Market penetration analysis scoring',
    brandContext: '${targetBrand?.name || 'Target Brand'}',
    industry: '${template.industry}'
  },
  'customer-profile': {
    targetVariable: 'customer_score',
    scoreFieldName: 'customer_score',
    description: 'Customer profile analysis scoring',
    brandContext: '${targetBrand?.name || 'Target Brand'}',
    industry: '${template.industry}'
  }
};

// Brand field configurations
export const BRAND_FIELD_CONFIGURATIONS = {
  ${template.brands.map(brand => `'${brand.fieldName}': {
    brandName: '${brand.name}',
    role: '${brand.role}',
    dataType: '${brand.role === 'target' ? 'primary' : 'competitor'}',
    industry: '${template.industry}'
  }`).join(',\n  ')}
};

// Get configuration for endpoint
export function getEndpointConfiguration(endpoint: string) {
  return ENDPOINT_CONFIGURATIONS[endpoint as keyof typeof ENDPOINT_CONFIGURATIONS];
}

// Get brand configuration for field
export function getBrandConfiguration(fieldName: string) {
  return BRAND_FIELD_CONFIGURATIONS[fieldName as keyof typeof BRAND_FIELD_CONFIGURATIONS];
}

export default ENDPOINT_CONFIGURATIONS;
`;
  }
}

/**
 * Domain Configuration Generator
 */
export class DomainConfigurationGenerator extends ConfigurationGenerator {
  name = 'DomainConfiguration';
  description = 'Generates DomainConfigurationLoader.ts for routing';
  targetFile = 'lib/routing/DomainConfigurationLoader.ts';

  generate(template: ProjectTemplate): string {
    return `${this.generateHeader('Domain Configuration')}

// Domain-specific routing configuration
export const DOMAIN_CONFIGURATION = {
  domain_terms: {
    primary: [${this.formatStringArray(template.vocabularyTerms.primary)}],
    secondary: [${this.formatStringArray(template.vocabularyTerms.secondary)}],
    context: [${this.formatStringArray(template.vocabularyTerms.context)}]
  },
  
  synonyms: {
    ${Object.entries(template.vocabularyTerms.synonyms || {}).map(([key, values]) => 
      `'${key}': [${this.formatStringArray(values)}]`
    ).join(',\n    ')}
  },
  
  industry_context: {
    name: '${template.industry}',
    domain: '${template.domain}',
    brands: [${this.formatStringArray(template.brands.map(b => b.name.toLowerCase()))}]
  },
  
  endpoint_boost_terms: {
    ${template.endpointMappings.map(mapping => `'${mapping.endpoint}': {
      boost_terms: [${this.formatStringArray(mapping.boostTerms)}],
      penalty_terms: [${this.formatStringArray(mapping.penaltyTerms)}],
      confidence_threshold: ${mapping.confidenceThreshold}
    }`).join(',\n    ')}
  }
};

// Load domain configuration
export function loadDomainConfiguration() {
  return DOMAIN_CONFIGURATION;
}

// Get boost terms for endpoint
export function getBoostTerms(endpoint: string): string[] {
  const config = DOMAIN_CONFIGURATION.endpoint_boost_terms[endpoint as keyof typeof DOMAIN_CONFIGURATION.endpoint_boost_terms];
  return config?.boost_terms || [];
}

// Get penalty terms for endpoint
export function getPenaltyTerms(endpoint: string): string[] {
  const config = DOMAIN_CONFIGURATION.endpoint_boost_terms[endpoint as keyof typeof DOMAIN_CONFIGURATION.endpoint_boost_terms];
  return config?.penalty_terms || [];
}

export default DOMAIN_CONFIGURATION;
`;
  }
}

/**
 * Microservice Package Generator
 */
export class MicroservicePackageGenerator extends ConfigurationGenerator {
  name = 'MicroservicePackage';
  description = 'Generates microservice configuration package';
  targetFile = 'microservice-config.json';

  generate(template: ProjectTemplate): string {
    const targetBrand = template.brands.find(b => b.role === 'target');
    
    const config = {
      name: template.name,
      serviceName: `${template.name.replace(/_/g, '-')}-microservice`,
      targetVariable: targetBrand?.fieldName || '',
      brandName: targetBrand?.name || '',
      industry: template.industry,
      domain: template.domain,
      brandFields: template.brands.reduce((acc, brand) => {
        acc[brand.fieldName] = {
          name: brand.name,
          role: brand.role,
          aliases: brand.aliases
        };
        return acc;
      }, {} as Record<string, any>),
      renderConfig: {
        name: `${template.name.replace(/_/g, '-')}-microservice`,
        type: 'web_service',
        env: 'node',
        buildCommand: 'npm install',
        startCommand: 'node app.js',
        envVars: [
          {
            key: 'NODE_ENV',
            value: 'production'
          },
          {
            key: 'TARGET_VARIABLE',
            value: targetBrand?.fieldName || ''
          },
          {
            key: 'PROJECT_NAME', 
            value: template.name
          }
        ]
      }
    };

    return JSON.stringify(config, null, 2);
  }
}

// Supporting interfaces
export interface GenerationResult {
  template: string;
  outputDirectory: string;
  results: ConfigurationResult[];
  success: boolean;
  summary: {
    total: number;
    successful: number;
    failed: number;
    errors: ValidationError[];
  };
}

export interface ConfigurationResult {
  generator: string;
  outputPath: string;
  success: boolean;
  contentLength?: number;
  error?: string;
}

/**
 * Template Engine Validator
 */
export class TemplateEngineValidator extends BaseValidator {
  readonly name = 'template-engine';
  readonly description = 'Validates template engine functionality and template integrity';

  private engine = new TemplateEngine();

  async validate(templateName?: string): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const recommendations: string[] = [];

    try {
      // Validate template engine setup
      this.validateEngineSetup(errors, warnings);
      
      // Validate specific template if provided
      if (templateName) {
        await this.validateTemplate(templateName, errors, warnings);
      }
      
      // Validate all registered templates
      await this.validateAllTemplates(errors, warnings);
      
      // Generate recommendations
      this.generateTemplateRecommendations(recommendations);

      return this.createResult(errors, warnings, recommendations);
      
    } catch (error) {
      errors.push(this.createError(
        'TEMPLATE_VALIDATION_FAILED',
        `Template engine validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'critical'
      ));
      return this.createResult(errors);
    }
  }

  private validateEngineSetup(errors: ValidationError[], warnings: ValidationWarning[]): void {
    const templates = this.engine.getTemplates();
    
    if (templates.length === 0) {
      warnings.push(this.createWarning(
        'NO_TEMPLATES_REGISTERED',
        'No templates registered in template engine',
        'Configuration generation will not be available'
      ));
    }
  }

  private async validateTemplate(templateName: string, errors: ValidationError[], warnings: ValidationWarning[]): Promise<void> {
    const template = this.engine.getTemplate(templateName);
    
    if (!template) {
      errors.push(this.createError(
        'TEMPLATE_NOT_FOUND',
        `Template '${templateName}' not found`,
        'high'
      ));
      return;
    }

    // Validate template structure
    this.validateTemplateStructure(template, errors, warnings);
    
    // Test generation
    await this.validateTemplateGeneration(template, errors, warnings);
  }

  private validateTemplateStructure(template: ProjectTemplate, errors: ValidationError[], warnings: ValidationWarning[]): void {
    if (!template.name) {
      errors.push(this.createError('MISSING_TEMPLATE_NAME', 'Template missing name', 'high'));
    }
    
    if (!template.industry) {
      errors.push(this.createError('MISSING_TEMPLATE_INDUSTRY', 'Template missing industry', 'medium'));
    }
    
    if (!template.brands || template.brands.length === 0) {
      errors.push(this.createError('MISSING_TEMPLATE_BRANDS', 'Template missing brand definitions', 'high'));
    }
    
    const targetBrands = template.brands?.filter(b => b.role === 'target') || [];
    if (targetBrands.length === 0) {
      errors.push(this.createError('MISSING_TARGET_BRAND', 'Template missing target brand', 'critical'));
    } else if (targetBrands.length > 1) {
      warnings.push(this.createWarning('MULTIPLE_TARGET_BRANDS', 'Template has multiple target brands', 'May cause configuration conflicts'));
    }
  }

  private async validateTemplateGeneration(template: ProjectTemplate, errors: ValidationError[], warnings: ValidationWarning[]): Promise<void> {
    try {
      // Test generation without writing files
      await this.engine.generateConfiguration(template.name, 'BrandResolver');
      await this.engine.generateConfiguration(template.name, 'FieldAliases');
      await this.engine.generateConfiguration(template.name, 'ChatConstants');
    } catch (error) {
      errors.push(this.createError(
        'GENERATION_TEST_FAILED',
        `Template generation test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'high'
      ));
    }
  }

  private async validateAllTemplates(errors: ValidationError[], warnings: ValidationWarning[]): Promise<void> {
    const templates = this.engine.getTemplates();
    
    templates.forEach(template => {
      this.validateTemplateStructure(template, errors, warnings);
    });
  }

  private generateTemplateRecommendations(recommendations: string[]): void {
    const templates = this.engine.getTemplates();
    
    recommendations.push(`Template engine has ${templates.length} registered templates`);
    
    if (templates.length > 0) {
      recommendations.push('Test template generation in a safe directory before deploying to production');
    }
    
    recommendations.push('Create template validation tests as part of the build process');
    recommendations.push('Backup existing configurations before applying template-generated configurations');
  }
}