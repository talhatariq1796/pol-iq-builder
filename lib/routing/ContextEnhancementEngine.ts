/**
 * Context Enhancement Engine
 * 
 * Dataset-aware context boosting that dynamically analyzes available data
 * without hardcoded field assumptions
 */

import { 
  DatasetContext, 
  ContextuallyEnhancedCandidate, 
  ContextEnhancement,
  DataQualityAssessment,
  FieldRequirements 
} from './types/ContextTypes';
import { EndpointCandidate, EnhancedQuery } from './types/DomainTypes';

export class ContextEnhancementEngine {
  private fieldAnalysisCache: Map<string, any> = new Map();
  private routingPatternCache: Map<string, any> = new Map();

  /**
   * Enhance candidates with dataset context
   */
  async enhanceWithDatasetContext(
    enhancedQuery: EnhancedQuery,
    candidates: EndpointCandidate[],
    datasetContext: DatasetContext
  ): Promise<ContextuallyEnhancedCandidate[]> {
    const enhancedCandidates: ContextuallyEnhancedCandidate[] = [];
    
    for (const candidate of candidates) {
      const enhanced = await this.enhanceCandidate(
        candidate, 
        enhancedQuery, 
        datasetContext
      );
      enhancedCandidates.push(enhanced);
    }
    
    return enhancedCandidates.sort((a, b) => b.final_confidence - a.final_confidence);
  }

  /**
   * Dynamically discover dataset structure and field categories
   */
  async discoverDatasetStructure(
    dataFields: string[], 
    sampleData?: any[]
  ): Promise<DatasetContext['available_fields']> {
    const categorizedFields: { [category: string]: string[] } = {};
    
    // Analyze field names to categorize them
    for (const field of dataFields) {
      const categories = this.analyzeFieldName(field);
      
      for (const category of categories) {
        if (!categorizedFields[category]) {
          categorizedFields[category] = [];
        }
        categorizedFields[category].push(field);
      }
    }
    
    // If sample data is available, analyze data types and patterns
    if (sampleData && sampleData.length > 0) {
      for (const field of dataFields) {
        const dataTypeCategories = this.analyzeFieldData(field, sampleData);
        
        for (const category of dataTypeCategories) {
          if (!categorizedFields[category]) {
            categorizedFields[category] = [];
          }
          if (!categorizedFields[category].includes(field)) {
            categorizedFields[category].push(field);
          }
        }
      }
    }
    
    return {
      all_fields: dataFields,
      categorized_fields: categorizedFields
    };
  }

  /**
   * Analyze field characteristics from actual data
   */
  async analyzeFieldCharacteristics(
    fields: string[],
    sampleData: any[]
  ): Promise<DatasetContext['field_characteristics']> {
    const characteristics: DatasetContext['field_characteristics'] = {};
    
    for (const field of fields) {
      characteristics[field] = await this.analyzeField(field, sampleData);
    }
    
    return characteristics;
  }

  /**
   * Enhance a single candidate with context
   */
  private async enhanceCandidate(
    candidate: EndpointCandidate,
    enhancedQuery: EnhancedQuery,
    datasetContext: DatasetContext
  ): Promise<ContextuallyEnhancedCandidate> {
    let contextualScore = candidate.confidence;
    const enhancements: ContextEnhancement[] = [];
    const reasoning: string[] = [...candidate.reasoning];
    
    // Field availability enhancement
    const fieldEnhancement = this.calculateFieldAvailabilityBoost(
      candidate.endpoint,
      datasetContext
    );
    if (fieldEnhancement) {
      contextualScore *= fieldEnhancement.impact;
      enhancements.push(fieldEnhancement);
      reasoning.push(fieldEnhancement.reasoning);
    }
    
    // Historical pattern enhancement
    const historicalEnhancement = this.findHistoricalPatternBoost(
      enhancedQuery.original_query,
      candidate.endpoint,
      datasetContext?.routing_history ?? {}
    );
    if (historicalEnhancement) {
      contextualScore *= (1 + historicalEnhancement.impact);
      enhancements.push(historicalEnhancement);
      reasoning.push(historicalEnhancement.reasoning);
    }
    
    // Data quality enhancement
    const dataQualityEnhancement = this.calculateDataQualityBoost(
      candidate.endpoint,
      datasetContext?.field_characteristics ?? {}
    );
    if (dataQualityEnhancement) {
      contextualScore *= dataQualityEnhancement.impact;
      enhancements.push(dataQualityEnhancement);
      reasoning.push(dataQualityEnhancement.reasoning);
    }
    
    // Calculate field requirements dynamically
    const fieldRequirements = this.inferFieldRequirements(
      candidate.endpoint,
      this.getCategorizedFieldsFromContext(datasetContext)
    );
    
    // Calculate historical performance
    const historicalPerformance = this.calculateHistoricalPerformance(
      candidate.endpoint,
      datasetContext?.routing_history ?? {}
    );
    
    const finalConfidence = Math.min(1.0, Math.max(0.0, contextualScore));
    
    return {
      endpoint: candidate.endpoint,
      base_score: candidate.confidence,
      contextual_score: contextualScore,
      final_confidence: finalConfidence,
      enhancements,
      field_requirements: fieldRequirements,
      historical_performance: historicalPerformance,
      reasoning
    };
  }

  /**
   * Analyze field name to determine likely categories
   */
  private analyzeFieldName(fieldName: string): string[] {
    const categories: string[] = [];
    const lowerField = fieldName.toLowerCase();
    
    // Pattern-based categorization
    const patterns = {
      demographic: [
        /population|pop|demo/i,
        /age|young|old|senior/i,
        /income|wealth|earnings/i,
        /race|ethnic|white|black|asian|hispanic/i,
        /gender|male|female/i,
        /education|college|school/i
      ],
      geographic: [
        /geo|location|coordinates|lat|lng|longitude|latitude/i,
        /zip|postal|area|region/i,
        /city|state|county|country/i,
        /address|street/i
      ],
      economic: [
        /income|salary|wage|earnings/i,
        /wealth|rich|poor|affluent/i,
        /spending|budget|cost|price/i,
        /employment|job|career/i
      ],
      brand: [
        /brand|company|business/i,
        /product|service/i,
        /market.*share|share/i
      ],
      behavioral: [
        /behavior|activity|lifestyle/i,
        /purchase|buy|shop/i,
        /preference|like|dislike/i,
        /frequency|often|rarely/i
      ],
      temporal: [
        /date|time|when|created|updated/i,
        /year|month|day/i,
        /recent|latest|current/i
      ],
      identifier: [
        /^id$|identifier|key/i,
        /^uid$|^pk$|primary/i,
        /unique|distinct/i
      ],
      descriptive: [
        /name|title|description|label/i,
        /text|comment|note/i
      ],
      analytical: [
        /score|rating|index|metric/i,
        /analysis|insight/i,
        /shap|prediction|model/i
      ]
    };
    
    for (const [category, patternList] of Object.entries(patterns)) {
      if (patternList.some(pattern => pattern.test(lowerField))) {
        categories.push(category);
      }
    }
    
    // Default category if no patterns match
    if (categories.length === 0) {
      categories.push('general');
    }
    
    return categories;
  }

  /**
   * Analyze field data to determine additional categories
   */
  private analyzeFieldData(fieldName: string, sampleData: any[]): string[] {
    const categories: string[] = [];
    
    // Sample some values to analyze data type and patterns
    const values = sampleData
      .map(row => row[fieldName])
      .filter(val => val != null && val !== '')
      .slice(0, 100); // Sample first 100 non-null values
    
    if (values.length === 0) {
      categories.push('sparse_data');
      return categories;
    }
    
    // Analyze data types
    const dataTypes = new Set(values.map(val => typeof val));
    
    if (dataTypes.has('number')) {
      categories.push('numeric');
      
      // Check if it's binary (0/1 or boolean-like)
      const uniqueNums = new Set(values.filter(v => typeof v === 'number'));
      if (uniqueNums.size <= 2) {
        categories.push('binary');
      } else if (uniqueNums.size <= 10) {
        categories.push('categorical_numeric');
      } else {
        categories.push('continuous');
      }
    }
    
    if (dataTypes.has('string')) {
      categories.push('textual');
      
      // Check if it's categorical
      const uniqueStrings = new Set(values.filter(v => typeof v === 'string'));
      if (uniqueStrings.size <= Math.min(20, values.length * 0.5)) {
        categories.push('categorical');
      } else {
        categories.push('free_text');
      }
    }
    
    if (dataTypes.has('boolean')) {
      categories.push('boolean', 'binary');
    }
    
    // Check data completeness
    const completeness = values.length / sampleData.length;
    if (completeness < 0.5) {
      categories.push('sparse_data');
    } else if (completeness > 0.95) {
      categories.push('complete_data');
    }
    
    return categories;
  }

  /**
   * Analyze individual field characteristics
   */
  private async analyzeField(fieldName: string, sampleData: any[]): Promise<any> {
    const values = sampleData
      .map(row => row[fieldName])
      .filter(val => val != null && val !== '');
    
    const totalRecords = sampleData.length;
    const coverage = values.length / totalRecords;
    
    let variance = 0;
    let uniqueness = 0;
    let dataType: 'numeric' | 'categorical' | 'text' | 'boolean' = 'text';
    
    if (values.length > 0) {
      const uniqueValues = new Set(values);
      uniqueness = uniqueValues.size / values.length;
      
      // Determine primary data type
      const numericValues = values.filter(v => typeof v === 'number' && !isNaN(v));
      if (numericValues.length / values.length > 0.8) {
        dataType = 'numeric';
        
        // Calculate variance for numeric data
        if (numericValues.length > 1) {
          const mean = numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length;
          variance = numericValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / numericValues.length;
        }
      } else if (uniqueValues.size <= 10) {
        dataType = 'categorical';
      } else if (uniqueValues.size === 2) {
        dataType = 'boolean';
      }
    }
    
    return {
      coverage,
      variance,
      uniqueness,
      relevance_score: 0.5, // Default, updated through usage
      data_type: dataType,
      sample_values: Array.from(new Set(values)).slice(0, 5)
    };
  }

  /**
   * Calculate field availability boost based on inferred requirements
   */
  private calculateFieldAvailabilityBoost(
    endpoint: string,
    datasetContext: DatasetContext
  ): ContextEnhancement | null {
    // Infer what types of fields this endpoint likely needs
    const requiredCategories = this.inferRequiredCategories(endpoint);
    
  // Be resilient to missing dataset context pieces (support flat array form)
  const categorizedFields = this.getCategorizedFieldsFromContext(datasetContext);
    const availableCategories: string[] = [];
    
    for (const category of requiredCategories) {
      const fieldsInCategory = categorizedFields[category] || [];
      if (fieldsInCategory.length > 0) {
        availableCategories.push(category);
      }
    }
    
    if (availableCategories.length === 0) {
      return {
        type: 'field_availability',
        impact: 0.7, // Penalty for missing required field types
        reasoning: `Missing required field categories for ${endpoint}`,
        confidence: 0.8
      };
    }
    
    const completeness = availableCategories.length / requiredCategories.length;
    const boost = 0.8 + (completeness * 0.4); // Range: 0.8-1.2
    
    return {
      type: 'field_availability',
      impact: boost,
      reasoning: `Field availability: ${availableCategories.length}/${requiredCategories.length} categories (${availableCategories.join(', ')})`,
      confidence: 0.9
    };
  }

  /**
   * Normalize datasetContext.available_fields which may be either an object with categorized_fields
   * or a flat string[] of field names. Returns a categorized_fields map for downstream use.
   */
  private getCategorizedFieldsFromContext(datasetContext: DatasetContext | any): { [category: string]: string[] } {
    // If already structured, return as-is
    const structured = datasetContext?.available_fields?.categorized_fields;
    if (structured && typeof structured === 'object') {
      return structured as { [category: string]: string[] };
    }
    // If available_fields is an array, categorize on the fly
    const flat: string[] | undefined = Array.isArray(datasetContext?.available_fields)
      ? (datasetContext.available_fields as string[])
      : (Array.isArray(datasetContext?.availableFields) ? datasetContext.availableFields : undefined);
    const categorized: { [category: string]: string[] } = {};
    if (flat && flat.length > 0) {
      for (const f of flat) {
        const cats = this.analyzeFieldName(f);
        for (const c of cats) {
          if (!categorized[c]) categorized[c] = [];
          categorized[c].push(f);
        }
      }
    }
    return categorized;
  }

  /**
   * Infer required field categories for an endpoint
   */
  private inferRequiredCategories(endpoint: string): string[] {
    const categoryMap: { [key: string]: string[] } = {
      'demographic': ['demographic', 'economic', 'geographic'],
      'competitive': ['brand', 'behavioral', 'economic'],
      'strategic': ['economic', 'geographic', 'demographic'],
      'customer': ['demographic', 'behavioral', 'economic'],
      'geographic': ['geographic', 'demographic'],
      'brand': ['brand', 'behavioral'],
      'predictive': ['numeric', 'analytical'],
      'spatial': ['geographic'],
      'correlation': ['numeric', 'analytical'],
      'trend': ['temporal', 'numeric']
    };
    
    // Find categories based on endpoint name patterns
    for (const [pattern, categories] of Object.entries(categoryMap)) {
      if (endpoint.toLowerCase().includes(pattern)) {
        return categories;
      }
    }
    
    return ['general']; // Fallback
  }

  /**
   * Find historical pattern boost
   */
  private findHistoricalPatternBoost(
    query: string,
    endpoint: string,
    routingHistory: DatasetContext['routing_history']
  ): ContextEnhancement | null {
    // Simple pattern matching - could be enhanced with fuzzy matching
    const querySignature = this.createQuerySignature(query);
    
    for (const [pattern, history] of Object.entries(routingHistory)) {
      if (this.patternsMatch(querySignature, pattern) && history.successful_endpoint === endpoint) {
        return {
          type: 'historical_pattern',
          impact: Math.min(0.3, history.frequency * 0.1),
          reasoning: `Similar queries routed to ${endpoint} ${history.frequency} times (${Math.round(history.success_rate * 100)}% success)`,
          confidence: history.confidence
        };
      }
    }
    
    return null;
  }

  /**
   * Calculate data quality boost
   */
  private calculateDataQualityBoost(
    endpoint: string,
    fieldCharacteristics: DatasetContext['field_characteristics']
  ): ContextEnhancement | null {
    const requiredCategories = this.inferRequiredCategories(endpoint);
    const fieldNames = Object.keys(fieldCharacteristics);
    
    // Find fields that match required categories
    const relevantFields = fieldNames.filter(fieldName => {
      const categories = this.analyzeFieldName(fieldName);
      return categories.some(cat => requiredCategories.includes(cat));
    });
    
    if (relevantFields.length === 0) {
      return null;
    }
    
    // Calculate average data quality for relevant fields
    const avgCoverage = relevantFields.reduce((sum, field) => 
      sum + fieldCharacteristics[field].coverage, 0
    ) / relevantFields.length;
    
    const qualityScore = avgCoverage; // Could include more factors
    const boost = 0.9 + (qualityScore * 0.2); // Range: 0.9-1.1
    
    return {
      type: 'data_quality',
      impact: boost,
      reasoning: `Data quality: ${Math.round(avgCoverage * 100)}% coverage for ${relevantFields.length} relevant fields`,
      confidence: 0.7
    };
  }

  /**
   * Infer field requirements for an endpoint
   */
  private inferFieldRequirements(
    endpoint: string,
    categorizedFields: { [category: string]: string[] }
  ): any {
    const requiredCategories = this.inferRequiredCategories(endpoint);
    
    const required: string[] = [];
    const optional: string[] = [];
    
    // Map categories to actual field names
    for (const category of requiredCategories) {
      const fieldsInCategory = categorizedFields[category] || [];
      required.push(...fieldsInCategory.slice(0, 2)); // Take first 2 fields per category
      optional.push(...fieldsInCategory.slice(2)); // Rest are optional
    }
    
    // Compute total available fields; if none in categorized map, derive from combined unique fields
    const categorizedLists = Object.values(categorizedFields);
    const totalAvailable = categorizedLists.length > 0
      ? categorizedLists.flat().length
      : required.length + optional.length; // fallback to prevent zero coverage
    const rawCoverage = (required.length + optional.length) / Math.max(1, totalAvailable);
    const coverageScore = Math.max(0.05, Math.min(1.0, rawCoverage));
    
    return {
      required: [...new Set(required)],
      optional: [...new Set(optional)],
      coverage_score: coverageScore
    };
  }

  /**
   * Calculate historical performance
   */
  private calculateHistoricalPerformance(
    endpoint: string,
    routingHistory: DatasetContext['routing_history']
  ): any {
    const relevantHistory = Object.values(routingHistory)
      .filter(history => history.successful_endpoint === endpoint);
    
    if (relevantHistory.length === 0) {
      return {
        success_rate: 0.5, // Default
        frequency: 0,
        avg_confidence: 0.5
      };
    }
    
    const totalFrequency = relevantHistory.reduce((sum, h) => sum + h.frequency, 0);
    const avgSuccessRate = relevantHistory.reduce((sum, h) => sum + h.success_rate, 0) / relevantHistory.length;
    const avgConfidence = relevantHistory.reduce((sum, h) => sum + h.confidence, 0) / relevantHistory.length;
    
    return {
      success_rate: avgSuccessRate,
      frequency: totalFrequency,
      avg_confidence: avgConfidence
    };
  }

  /**
   * Create query signature for pattern matching
   */
  private createQuerySignature(query: string): string {
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .sort()
      .join(' ');
  }

  /**
   * Check if query patterns match
   */
  private patternsMatch(signature1: string, signature2: string): boolean {
    const words1 = new Set(signature1.split(' '));
    const words2 = new Set(signature2.split(' '));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    const similarity = intersection.size / union.size;
    return similarity > 0.5; // 50% word overlap threshold
  }
}