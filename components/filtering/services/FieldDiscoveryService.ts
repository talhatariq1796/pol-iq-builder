/**
 * Field Discovery Service
 * 
 * Manages endpoint field schemas, field discovery, and common field detection
 * for the advanced filtering system.
 */

import { 
  FieldDefinition, 
  EndpointFieldSchema, 
  FilterTabType 
} from '../types';

// ============================================================================
// FIELD DEFINITIONS BY CATEGORY
// ============================================================================

/**
 * Common demographic fields across endpoints
 */
const DEMOGRAPHIC_FIELDS: FieldDefinition[] = [
  {
    name: 'MEDAGE_CY',
    displayName: 'Median Age',
    description: 'Median age of population in the area',
    type: 'numeric',
    category: 'demographic',
    range: { min: 0, max: 100, step: 1 },
    nullable: false,
    common: true,
    indexed: true,
  },
  {
    name: 'TOTPOP_CY',
    displayName: 'Total Population',
    description: 'Total population count',
    type: 'numeric',
    category: 'demographic',
    range: { min: 0, max: 1000000, step: 1 },
    nullable: false,
    common: true,
    indexed: true,
  },
  {
    name: 'MEDHINC_CY',
    displayName: 'Median Household Income',
    description: 'Median household income in dollars',
    type: 'numeric',
    category: 'demographic',
    range: { min: 0, max: 500000, step: 1000 },
    nullable: false,
    common: true,
    indexed: true,
  },
  {
    name: 'DIVINDX_CY',
    displayName: 'Diversity Index',
    description: 'Diversity index score',
    type: 'numeric',
    category: 'demographic',
    range: { min: 0, max: 100, step: 0.1 },
    nullable: false,
    common: true,
    indexed: true,
  },
  {
    name: 'GENZ_CY',
    displayName: 'Gen Z Population',
    description: 'Gen Z population count',
    type: 'numeric',
    category: 'demographic',
    range: { min: 0, max: 100000, step: 1 },
    nullable: false,
    common: false,
    indexed: true,
  },
  {
    name: 'GENZ_CY_P',
    displayName: 'Gen Z Percentage',
    description: 'Gen Z population as percentage',
    type: 'numeric',
    category: 'demographic',
    range: { min: 0, max: 100, step: 0.1 },
    nullable: false,
    common: false,
    indexed: true,
  },
];

/**
 * Common geographic fields across endpoints
 */
const GEOGRAPHIC_FIELDS: FieldDefinition[] = [
  {
    name: 'ZIP',
    displayName: 'ZIP Code',
    description: 'ZIP code identifier',
    type: 'text',
    category: 'geographic',
    nullable: false,
    common: true,
    indexed: true,
  },
  {
    name: 'STATE',
    displayName: 'State Code',
    description: 'State abbreviation',
    type: 'categorical',
    category: 'geographic',
    categories: ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'],
    maxCategories: 50,
    nullable: false,
    common: true,
    indexed: true,
  },
  {
    name: 'STATE_NAME',
    displayName: 'State Name',
    description: 'Full state name',
    type: 'categorical',
    category: 'geographic',
    nullable: false,
    common: true,
    indexed: true,
  },
  {
    name: 'CITY',
    displayName: 'City',
    description: 'City name',
    type: 'text',
    category: 'geographic',
    nullable: false,
    common: true,
    indexed: true,
  },
  {
    name: 'CONAME',
    displayName: 'County Name',
    description: 'County or region name',
    type: 'text',
    category: 'geographic',
    nullable: false,
    common: true,
    indexed: true,
  },
  {
    name: 'LATITUDE',
    displayName: 'Latitude',
    description: 'Geographic latitude coordinate',
    type: 'numeric',
    category: 'geographic',
    range: { min: -90, max: 90, step: 0.000001 },
    nullable: false,
    common: true,
    indexed: true,
  },
  {
    name: 'LONGITUDE',
    displayName: 'Longitude',
    description: 'Geographic longitude coordinate',
    type: 'numeric',
    category: 'geographic',
    range: { min: -180, max: 180, step: 0.000001 },
    nullable: false,
    common: true,
    indexed: true,
  },
];

/**
 * Common business fields across endpoints
 */
const BUSINESS_FIELDS: FieldDefinition[] = [
  {
    name: 'NAICS',
    displayName: 'NAICS Code',
    description: 'North American Industry Classification System code',
    type: 'categorical',
    category: 'business',
    nullable: true,
    common: false,
    indexed: true,
  },
  {
    name: 'NAICS_ALL',
    displayName: 'NAICS Description',
    description: 'Industry classification description',
    type: 'text',
    category: 'business',
    nullable: true,
    common: false,
    indexed: true,
  },
  {
    name: 'SIC',
    displayName: 'SIC Code',
    description: 'Standard Industrial Classification code',
    type: 'categorical',
    category: 'business',
    nullable: true,
    common: false,
    indexed: true,
  },
  {
    name: 'SIC_ALL',
    displayName: 'SIC Description',
    description: 'Standard industrial classification description',
    type: 'text',
    category: 'business',
    nullable: true,
    common: false,
    indexed: true,
  },
  {
    name: 'INDUSTRY_DESC',
    displayName: 'Industry Description',
    description: 'Business industry description',
    type: 'text',
    category: 'business',
    nullable: true,
    common: false,
    indexed: true,
  },
  {
    name: 'BRAND',
    displayName: 'Brand ID',
    description: 'Brand identifier',
    type: 'categorical',
    category: 'business',
    nullable: true,
    common: false,
    indexed: true,
  },
  {
    name: 'EMPNUM',
    displayName: 'Employee Count',
    description: 'Number of employees',
    type: 'numeric',
    category: 'business',
    range: { min: 0, max: 100000, step: 1 },
    nullable: true,
    common: false,
    indexed: true,
  },
  {
    name: 'SALESVOL',
    displayName: 'Sales Volume',
    description: 'Annual sales volume in dollars',
    type: 'numeric',
    category: 'business',
    range: { min: 0, max: 1000000000, step: 1000 },
    nullable: true,
    common: false,
    indexed: true,
  },
];

/**
 * System/calculated fields across endpoints
 */
const CALCULATED_FIELDS: FieldDefinition[] = [
  {
    name: 'thematic_value',
    displayName: 'Thematic Value',
    description: 'Calculated thematic score for analysis',
    type: 'numeric',
    category: 'calculated',
    range: { min: 0, max: 100, step: 0.1 },
    nullable: false,
    common: true,
    indexed: true,
  },
  {
    name: 'MP28591A_B',
    displayName: 'Analysis Metric A',
    description: 'Calculated analysis metric A',
    type: 'numeric',
    category: 'calculated',
    range: { min: 0, max: 1000, step: 1 },
    nullable: false,
    common: true,
    indexed: true,
  },
  {
    name: 'MP28591A_B_I',
    displayName: 'Analysis Index',
    description: 'Calculated analysis index value',
    type: 'numeric',
    category: 'calculated',
    range: { min: 0, max: 100, step: 1 },
    nullable: false,
    common: true,
    indexed: true,
  },
  {
    name: 'Shape__Area',
    displayName: 'Geographic Area',
    description: 'Geographic area in square meters',
    type: 'numeric',
    category: 'calculated',
    range: { min: 0, max: 1000000000, step: 1 },
    nullable: false,
    common: true,
    indexed: true,
  },
  {
    name: 'Shape__Length',
    displayName: 'Geographic Perimeter',
    description: 'Geographic perimeter in meters',
    type: 'numeric',
    category: 'calculated',
    range: { min: 0, max: 10000000, step: 0.01 },
    nullable: false,
    common: true,
    indexed: true,
  },
];

// ============================================================================
// ENDPOINT-SPECIFIC SCHEMAS
// ============================================================================

/**
 * Static field schemas for top endpoints
 */
const ENDPOINT_SCHEMAS: Record<string, EndpointFieldSchema> = {
  'strategic-analysis': {
    endpoint: 'strategic-analysis',
    fields: [
      ...DEMOGRAPHIC_FIELDS,
      ...GEOGRAPHIC_FIELDS.filter(f => ['ZIP', 'STATE', 'STATE_NAME', 'CITY', 'CONAME'].includes(f.name)),
      ...CALCULATED_FIELDS,
      // Strategic analysis specific fields
      {
        name: 'STRATEGIC_SCORE',
        displayName: 'Strategic Score',
        description: 'Strategic analysis score',
        type: 'numeric',
        category: 'calculated',
        range: { min: 0, max: 100, step: 0.1 },
        nullable: false,
        common: false,
        indexed: true,
      },
    ],
    fieldCategories: {
      demographic: ['MEDAGE_CY', 'TOTPOP_CY', 'MEDHINC_CY', 'DIVINDX_CY', 'GENZ_CY', 'GENZ_CY_P'],
      geographic: ['ZIP', 'STATE', 'STATE_NAME', 'CITY', 'CONAME'],
      business: [],
      calculated: ['thematic_value', 'MP28591A_B', 'MP28591A_B_I', 'Shape__Area', 'Shape__Length', 'STRATEGIC_SCORE'],
      other: [],
    },
    commonFields: ['MEDAGE_CY', 'TOTPOP_CY', 'MEDHINC_CY', 'ZIP', 'STATE', 'thematic_value'],
  },
  
  'demographic-insights': {
    endpoint: 'demographic-insights',
    fields: [
      ...DEMOGRAPHIC_FIELDS,
      ...GEOGRAPHIC_FIELDS,
      ...CALCULATED_FIELDS.filter(f => ['thematic_value', 'MP28591A_B', 'MP28591A_B_I'].includes(f.name)),
    ],
    fieldCategories: {
      demographic: ['MEDAGE_CY', 'TOTPOP_CY', 'MEDHINC_CY', 'DIVINDX_CY', 'GENZ_CY', 'GENZ_CY_P'],
      geographic: ['ZIP', 'STATE', 'STATE_NAME', 'CITY', 'CONAME', 'LATITUDE', 'LONGITUDE'],
      business: [],
      calculated: ['thematic_value', 'MP28591A_B', 'MP28591A_B_I'],
      other: [],
    },
    commonFields: ['MEDAGE_CY', 'TOTPOP_CY', 'MEDHINC_CY', 'DIVINDX_CY', 'ZIP', 'STATE', 'thematic_value'],
  },

  'brand-difference': {
    endpoint: 'brand-difference',
    fields: [
      ...DEMOGRAPHIC_FIELDS.filter(f => ['MEDAGE_CY', 'TOTPOP_CY', 'MEDHINC_CY'].includes(f.name)),
      ...GEOGRAPHIC_FIELDS,
      ...BUSINESS_FIELDS,
      ...CALCULATED_FIELDS,
    ],
    fieldCategories: {
      demographic: ['MEDAGE_CY', 'TOTPOP_CY', 'MEDHINC_CY'],
      geographic: ['ZIP', 'STATE', 'STATE_NAME', 'CITY', 'CONAME', 'LATITUDE', 'LONGITUDE'],
      business: ['NAICS', 'NAICS_ALL', 'SIC', 'SIC_ALL', 'INDUSTRY_DESC', 'BRAND', 'EMPNUM', 'SALESVOL'],
      calculated: ['thematic_value', 'MP28591A_B', 'MP28591A_B_I', 'Shape__Area', 'Shape__Length'],
      other: [],
    },
    commonFields: ['MEDAGE_CY', 'TOTPOP_CY', 'MEDHINC_CY', 'ZIP', 'STATE', 'BRAND', 'thematic_value'],
  },

  'competitive-analysis': {
    endpoint: 'competitive-analysis',
    fields: [
      ...DEMOGRAPHIC_FIELDS.filter(f => ['MEDAGE_CY', 'TOTPOP_CY', 'MEDHINC_CY'].includes(f.name)),
      ...GEOGRAPHIC_FIELDS.filter(f => ['ZIP', 'STATE', 'STATE_NAME', 'CITY'].includes(f.name)),
      ...BUSINESS_FIELDS,
      ...CALCULATED_FIELDS,
      // Competitive analysis specific fields
      {
        name: 'COMPETITIVE_SCORE',
        displayName: 'Competitive Score',
        description: 'Competitive analysis score',
        type: 'numeric',
        category: 'calculated',
        range: { min: 0, max: 100, step: 0.1 },
        nullable: false,
        common: false,
        indexed: true,
      },
    ],
    fieldCategories: {
      demographic: ['MEDAGE_CY', 'TOTPOP_CY', 'MEDHINC_CY'],
      geographic: ['ZIP', 'STATE', 'STATE_NAME', 'CITY'],
      business: ['NAICS', 'NAICS_ALL', 'SIC', 'SIC_ALL', 'INDUSTRY_DESC', 'BRAND', 'EMPNUM', 'SALESVOL'],
      calculated: ['thematic_value', 'MP28591A_B', 'MP28591A_B_I', 'Shape__Area', 'Shape__Length', 'COMPETITIVE_SCORE'],
      other: [],
    },
    commonFields: ['MEDAGE_CY', 'TOTPOP_CY', 'MEDHINC_CY', 'ZIP', 'STATE', 'BRAND', 'thematic_value'],
  },

  'comparative-analysis': {
    endpoint: 'comparative-analysis',
    fields: [
      ...DEMOGRAPHIC_FIELDS,
      ...GEOGRAPHIC_FIELDS.filter(f => ['ZIP', 'STATE', 'STATE_NAME', 'CITY', 'CONAME'].includes(f.name)),
      ...BUSINESS_FIELDS.filter(f => ['NAICS', 'NAICS_ALL', 'BRAND'].includes(f.name)),
      ...CALCULATED_FIELDS,
    ],
    fieldCategories: {
      demographic: ['MEDAGE_CY', 'TOTPOP_CY', 'MEDHINC_CY', 'DIVINDX_CY', 'GENZ_CY', 'GENZ_CY_P'],
      geographic: ['ZIP', 'STATE', 'STATE_NAME', 'CITY', 'CONAME'],
      business: ['NAICS', 'NAICS_ALL', 'BRAND'],
      calculated: ['thematic_value', 'MP28591A_B', 'MP28591A_B_I', 'Shape__Area', 'Shape__Length'],
      other: [],
    },
    commonFields: ['MEDAGE_CY', 'TOTPOP_CY', 'MEDHINC_CY', 'ZIP', 'STATE', 'thematic_value'],
  },
};

// ============================================================================
// FIELD DISCOVERY SERVICE CLASS
// ============================================================================

export class FieldDiscoveryService {
  private static instance: FieldDiscoveryService;
  private endpointSchemas: Map<string, EndpointFieldSchema>;
  private commonFields: Set<string>;

  private constructor() {
    this.endpointSchemas = new Map(Object.entries(ENDPOINT_SCHEMAS));
    this.commonFields = this.calculateCommonFields();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): FieldDiscoveryService {
    if (!FieldDiscoveryService.instance) {
      FieldDiscoveryService.instance = new FieldDiscoveryService();
    }
    return FieldDiscoveryService.instance;
  }

  /**
   * Get field schema for a specific endpoint
   */
  public getEndpointSchema(endpoint: string): EndpointFieldSchema | null {
    return this.endpointSchemas.get(endpoint) || null;
  }

  /**
   * Get available fields for an endpoint
   */
  public getFieldsForEndpoint(endpoint: string): FieldDefinition[] {
    const schema = this.getEndpointSchema(endpoint);
    return schema?.fields || [];
  }

  /**
   * Get fields by category for an endpoint
   */
  public getFieldsByCategory(endpoint: string, category: string): FieldDefinition[] {
    const schema = this.getEndpointSchema(endpoint);
    if (!schema) return [];

    const categoryFields = schema.fieldCategories[category as keyof typeof schema.fieldCategories] || [];
    return schema.fields.filter(field => categoryFields.includes(field.name));
  }

  /**
   * Get common fields across all endpoints
   */
  public getCommonFields(): FieldDefinition[] {
    const allFields = Array.from(this.endpointSchemas.values())
      .flatMap(schema => schema.fields);
    
    return allFields.filter(field => this.commonFields.has(field.name))
      .filter((field, index, arr) => arr.findIndex(f => f.name === field.name) === index); // Deduplicate
  }

  /**
   * Search fields by name or description
   */
  public searchFields(endpoint: string, query: string): FieldDefinition[] {
    const fields = this.getFieldsForEndpoint(endpoint);
    const searchTerm = query.toLowerCase();

    return fields.filter(field => 
      field.name.toLowerCase().includes(searchTerm) ||
      field.displayName.toLowerCase().includes(searchTerm) ||
      field.description?.toLowerCase().includes(searchTerm)
    );
  }

  /**
   * Get field definition by name
   */
  public getFieldDefinition(endpoint: string, fieldName: string): FieldDefinition | null {
    const fields = this.getFieldsForEndpoint(endpoint);
    return fields.find(field => field.name === fieldName) || null;
  }

  /**
   * Get all supported endpoints
   */
  public getSupportedEndpoints(): string[] {
    return Array.from(this.endpointSchemas.keys());
  }

  /**
   * Check if endpoint has field discovery support
   */
  public supportsEndpoint(endpoint: string): boolean {
    return this.endpointSchemas.has(endpoint);
  }

  /**
   * Get field statistics for an endpoint
   */
  public getFieldStatistics(endpoint: string): {
    totalFields: number;
    fieldsByCategory: Record<string, number>;
    filterableFields: number;
    commonFields: number;
  } {
    const schema = this.getEndpointSchema(endpoint);
    if (!schema) {
      return {
        totalFields: 0,
        fieldsByCategory: {},
        filterableFields: 0,
        commonFields: 0,
      };
    }

    const fieldsByCategory = Object.entries(schema.fieldCategories)
      .reduce((acc, [category, fields]) => {
        acc[category] = fields.length;
        return acc;
      }, {} as Record<string, number>);

    return {
      totalFields: schema.fields.length,
      fieldsByCategory,
      filterableFields: schema.fields.filter(f => f.indexed).length,
      commonFields: schema.fields.filter(f => f.common).length,
    };
  }

  /**
   * Calculate fields that are common across multiple endpoints
   */
  private calculateCommonFields(): Set<string> {
    const fieldCounts = new Map<string, number>();
    const totalEndpoints = this.endpointSchemas.size;

    // Count field occurrences across endpoints
    for (const schema of this.endpointSchemas.values()) {
      for (const field of schema.fields) {
        fieldCounts.set(field.name, (fieldCounts.get(field.name) || 0) + 1);
      }
    }

    // Fields present in at least 60% of endpoints are considered common
    const commonThreshold = Math.ceil(totalEndpoints * 0.6);
    const commonFields = new Set<string>();

    for (const [fieldName, count] of fieldCounts) {
      if (count >= commonThreshold) {
        commonFields.add(fieldName);
      }
    }

    return commonFields;
  }
}

// Export singleton instance
export const fieldDiscoveryService = FieldDiscoveryService.getInstance();