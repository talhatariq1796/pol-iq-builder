/**
 * FieldMappingTemplate - Template system for EnhancedQueryAnalyzer configuration
 * 
 * This interface defines the structure for field mapping templates used by
 * the EnhancedQueryAnalyzer to generate project-specific configurations.
 * 
 * The template system allows for automated migration and configuration
 * generation without hardcoding project-specific field mappings.
 */

export interface FieldMapping {
  keywords: string[];
  fields: string[];
  description: string;
  category?: 'brand' | 'demographic' | 'economic' | 'geographic' | 'lifestyle' | 'core';
  priority?: 'high' | 'medium' | 'low';
}

export interface BrandDefinition {
  name: string;
  fieldName: string;
  role: 'target' | 'competitor';
  aliases: string[];
  description: string;
}

export interface ProjectContext {
  name: string;
  industry: string;
  targetBrand: string;
  primaryAnalysisTypes: string[];
  region?: string;
}

export interface FieldMappingTemplate {
  projectContext: ProjectContext;
  
  // Core field mappings that are always included
  coreFields: Record<string, FieldMapping>;
  
  // Project-specific field mappings
  projectFields: Record<string, FieldMapping>;
  
  // Brand configuration
  brandDefinitions: BrandDefinition[];
  
  // Endpoint configuration overrides
  endpointWeights?: Record<string, number>;
  
  // Validation rules for field existence
  requiredFields: string[];
  
  // Template metadata
  version: string;
  created: string;
  description: string;
}

export interface FieldMappingConfig {
  // Generated field mappings for the EnhancedQueryAnalyzer
  fieldMappings: Record<string, FieldMapping>;
  
  // Endpoint configurations
  endpointConfigs: Record<string, EndpointConfig>;
  
  // Template metadata
  templateInfo: {
    templateName: string;
    projectName: string;
    generatedAt: string;
    version: string;
  };
}

export interface EndpointConfig {
  primaryKeywords: string[];
  contextKeywords: string[];
  avoidTerms: string[];
  weight: number;
  requiredFields?: string[];
  preferredFields?: string[];
}

/**
 * Default template for Red Bull energy drinks project
 */
export const RED_BULL_TEMPLATE: FieldMappingTemplate = {
  projectContext: {
    name: 'red-bull-energy-drinks',
    industry: 'Energy Drinks',
    targetBrand: 'Red Bull',
    primaryAnalysisTypes: ['brand-difference', 'competitive-analysis', 'strategic-analysis'],
    region: 'United States'
  },
  
  coreFields: {
    // Core demographics - always included
    population: {
      keywords: ['population', 'people'],
      fields: ['TOTPOP_CY'],
      description: 'Total population',
      category: 'demographic',
      priority: 'high'
    },
    income: {
      keywords: ['income', 'earnings', 'wealth'],
      fields: ['MEDHINC_CY'],
      description: 'Median household income',
      category: 'economic',
      priority: 'high'
    },
    age: {
      keywords: ['age', 'young', 'old', 'elderly'],
      fields: ['AGE_MEDIAN'],
      description: 'Age demographics',
      category: 'demographic',
      priority: 'medium'
    }
  },
  
  projectFields: {
    redBull: {
      keywords: ['red bull', 'redbull', 'energy drink'],
      fields: ['MP12207A_B_P'],
      description: 'Red Bull brand usage',
      category: 'brand',
      priority: 'high'
    },
    monster: {
      keywords: ['monster', 'monster energy'],
      fields: ['MP12206A_B_P'],
      description: 'Monster Energy brand usage',
      category: 'brand',
      priority: 'high'
    },
    fiveHour: {
      keywords: ['5-hour energy', 'five hour energy', '5 hour energy'],
      fields: ['MP12205A_B_P'],
      description: '5-Hour Energy brand usage',
      category: 'brand',
      priority: 'medium'
    }
  },
  
  brandDefinitions: [
    {
      name: 'Red Bull',
      fieldName: 'MP12207A_B_P',
      role: 'target',
      aliases: ['red bull', 'redbull'],
      description: 'Target brand - Red Bull energy drinks'
    },
    {
      name: 'Monster Energy',
      fieldName: 'MP12206A_B_P',
      role: 'competitor',
      aliases: ['monster', 'monster energy'],
      description: 'Primary competitor - Monster Energy drinks'
    },
    {
      name: '5-Hour Energy',
      fieldName: 'MP12205A_B_P',
      role: 'competitor',
      aliases: ['5-hour energy', 'five hour energy'],
      description: 'Competitor - 5-Hour Energy shots'
    }
  ],
  
  endpointWeights: {
    '/brand-difference': 1.5,
    '/competitive-analysis': 1.4,
    '/strategic-analysis': 1.3
  },
  
  requiredFields: [
    'MP12207A_B_P',  // Red Bull
    'MP12206A_B_P',  // Monster
    'TOTPOP_CY',     // Population
    'MEDHINC_CY'     // Income
  ],
  
  version: '1.0.0',
  created: '2025-08-28',
  description: 'Field mapping template for Red Bull energy drinks market analysis'
};