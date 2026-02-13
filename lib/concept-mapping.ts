import { ConceptMap } from './analytics/types';
import { queryClassifier } from './query-classifier';
import { FIELD_ALIASES as ALIAS_MAP } from '../utils/field-aliases';
import { baseLayerConfigs } from '../config/layers';

// ============================================================================
// GROUPED VARIABLE DETECTION SYSTEM
// ============================================================================
// 
// This system allows easy configuration of grouped variables for different projects.
// When users ask about generic terms like "athletic shoes" or "all major brands",
// the system automatically expands these to include all relevant field codes.
//
// HOW TO ADD NEW GROUPED VARIABLES FOR A NEW PROJECT:
// 1. Add patterns to GROUPED_VARIABLE_PATTERNS
// 2. Add field mappings to GROUPED_VARIABLE_FIELDS
// 3. Optionally add to GROUPED_VARIABLE_LAYERS for layer associations
// 4. Test with sample queries
//
// EXAMPLE: For a real estate project, you might add:
// - Pattern: /\b(luxury\s+properties?|high.end\s+homes?)\b/i
// - Fields: ['LUXURY_CONDO_SALES', 'MANSION_PURCHASES', 'PREMIUM_REAL_ESTATE']
// - Layer: 'luxuryRealEstate'

/**
 * Grouped Variable Configuration
 * 
 * This configuration defines patterns that detect when users refer to groups
 * of related variables, and automatically expands them to include all relevant
 * field codes from the dataset.
 */

// Step 1: Define regex patterns for grouped variable detection
const GROUPED_VARIABLE_PATTERNS = {
  // Athletic shoe brands - matches queries about "all major brands", "athletic brands", etc.
  allMajorBrands: /\b(all\s+major\s+(athletic\s+)?brands?|all\s+(major\s+)?athletic\s+brands?|major\s+athletic\s+brands?)\b/i,
  
  // Athletic shoes in general - matches "athletic shoe purchases", "footwear market", etc.
  athleticShoes: /\b(athletic\s+shoe\s+purchases?|athletic\s+footwear\s+(market|purchases?)|athletic\s+shoe\s+market)\b/i,
  
  // Premium/luxury brands - matches "premium brands", "luxury athletic brands", expansion, etc.
  premiumBrands: /\b(premium\s+(athletic\s+)?brand\s+(purchases?|expansion|market|potential)|premium\s+athletic\s+(shoe|footwear)\s+(purchases?|expansion|market)|markets?\s+with\s+potential\s+for\s+premium\s+(athletic\s+)?brand\s+expansion)\b/i,
  
  // Age demographics - matches "younger regions", "age demographics", etc.
  ageDemographics: /\b(younger\s+(regions?|areas?)|older\s+(regions?|areas?)|age\s+demographics?|generational)\b/i,

  // Budget/affordable brands - example of how to add new groupings
  budgetBrands: /\b(budget\s+(athletic\s+)?brands?|affordable\s+(athletic\s+)?brands?|low.cost\s+brands?)\b/i,

  // Running-specific brands and categories
  runningGear: /\b(running\s+(shoes?|gear|brands?)|jogging\s+(shoes?|gear)|marathon\s+shoes?)\b/i,

  // Basketball-specific brands and categories  
  basketballGear: /\b(basketball\s+(shoes?|gear|brands?)|court\s+shoes?|hoop\s+shoes?)\b/i,
} as const;

// Step 2: Define which field codes belong to each grouped variable
const GROUPED_VARIABLE_FIELDS = {
  // All major athletic brands - includes the top brands in our dataset
  allMajorBrands: [
    'MP30034A_B_P', // Nike
    'MP30029A_B_P', // Adidas
    'MP30032A_B_P', // Jordan
    'MP30031A_B_P', // Converse
    'MP30035A_B_P', // Puma
    'MP30033A_B_P', // New Balance
  ],

  // Athletic shoes - includes all shoe-related purchase fields
  athleticShoes: [
    'MP30034A_B_P', // Nike
    'MP30029A_B_P', // Adidas
    'MP30032A_B_P', // Jordan
    'MP30031A_B_P', // Converse
    'MP30035A_B_P', // Puma
    'MP30033A_B_P', // New Balance
    'MP30030A_B_P', // Asics
    'MP30037A_B_P', // Skechers
    'MP30036A_B_P', // Reebok
  ],

  // Premium brands - typically Nike and Jordan
  premiumBrands: [
    'MP30034A_B_P', // Nike
    'MP30032A_B_P', // Jordan
  ],

  // Age demographics - key age-related fields
  ageDemographics: [
    'GENZ_CY_P',     // Gen Z percentage
    'MILLENN_CY_P',  // Millennial percentage
    'MEDAGE_CY',     // Median age
  ],

  // Budget brands - example grouping for affordable options
  budgetBrands: [
    'MP30037A_B_P', // Skechers
    'MP30036A_B_P', // Reebok
  ],

  // Running-specific fields
  runningGear: [
    'MP30021A_B_P', // Running shoes
    'MP30034A_B_P', // Nike (major running brand)
    'MP30030A_B_P', // Asics (running specialist)
    'MP30033A_B_P', // New Balance (running brand)
  ],

  // Basketball-specific fields
  basketballGear: [
    'MP30018A_B_P', // Basketball shoes
    'MP30032A_B_P', // Jordan (basketball brand)
    'MP30034A_B_P', // Nike (major basketball brand)
  ],
} as const;

// Step 3: Define which layers are associated with each grouped variable
const GROUPED_VARIABLE_LAYERS = {
  allMajorBrands: ['athleticShoePurchases'],
  athleticShoes: ['athleticShoePurchases'],
  premiumBrands: ['athleticShoePurchases'],
  ageDemographics: ['demographics'],
  budgetBrands: ['athleticShoePurchases'],
  runningGear: ['athleticShoePurchases', 'sportsParticipation'],
  basketballGear: ['athleticShoePurchases', 'sportsParticipation'],
} as const;

// Step 4: Define confidence scores for each grouped variable type
const GROUPED_VARIABLE_SCORES = {
  allMajorBrands: 90,
  athleticShoes: 85,
  premiumBrands: 95,
  ageDemographics: 80,
  budgetBrands: 75,
  runningGear: 85,
  basketballGear: 85,
} as const;

/**
 * Process grouped variable detection
 * 
 * This function checks the query against all defined patterns and automatically
 * adds the appropriate field codes and layers when grouped variables are detected.
 * 
 * @param lowerQuery - The query string in lowercase
 * @param matchedFields - Set to add detected field codes to
 * @param matchedLayers - Set to add detected layers to  
 * @param fieldScores - Object to add field confidence scores to
 * @param layerScores - Object to add layer confidence scores to
 */
function processGroupedVariables(
  lowerQuery: string,
  matchedFields: Set<string>,
  matchedLayers: Set<string>,
  fieldScores: Record<string, number>,
  layerScores: Record<string, number>
): void {
  // Iterate through all defined grouped variable patterns
  for (const [groupName, pattern] of Object.entries(GROUPED_VARIABLE_PATTERNS)) {
    if (pattern.test(lowerQuery)) {
      // Get the field codes for this grouped variable
      const fields = GROUPED_VARIABLE_FIELDS[groupName as keyof typeof GROUPED_VARIABLE_FIELDS];
      const layers = GROUPED_VARIABLE_LAYERS[groupName as keyof typeof GROUPED_VARIABLE_LAYERS];
      const score = GROUPED_VARIABLE_SCORES[groupName as keyof typeof GROUPED_VARIABLE_SCORES];

      // Add all field codes for this group
      if (fields) {
        fields.forEach(fieldCode => {
          matchedFields.add(fieldCode);
          fieldScores[fieldCode] = score;
        });
      }

      // Add all layers for this group
      if (layers) {
        layers.forEach(layer => {
          matchedLayers.add(layer);
          layerScores[layer] = (layerScores[layer] || 0) + score;
        });
      }

      // Log for debugging and monitoring
     // console.log(`[ConceptMapping] Grouped variable detected: ${groupName} -> ${fields?.length || 0} fields, ${layers?.length || 0} layers`);
    }
  }
}

/**
 * Direct Brand Mapping
 * 
 * This maps specific brand names mentioned in queries to their corresponding
 * field codes in the dataset. Easy to extend for new brands or datasets.
 */
const BRAND_FIELD_MAP = {
  'nike': 'MP30034A_B_P',
  'adidas': 'MP30029A_B_P', 
  'jordan': 'MP30032A_B_P',
  'converse': 'MP30031A_B_P',
  'puma': 'MP30035A_B_P',
  'reebok': 'MP30036A_B_P',
  'new balance': 'MP30033A_B_P',
  'asics': 'MP30030A_B_P',
  'skechers': 'MP30037A_B_P'
} as const;

/**
 * Process direct brand mentions
 * 
 * Detects when specific brand names are mentioned and adds their field codes.
 * 
 * @param lowerQuery - The query string in lowercase
 * @param matchedFields - Set to add detected field codes to
 * @param matchedLayers - Set to add detected layers to
 * @param fieldScores - Object to add field confidence scores to
 */
function processDirectBrands(
  lowerQuery: string,
  matchedFields: Set<string>,
  matchedLayers: Set<string>,
  fieldScores: Record<string, number>
): void {
  Object.entries(BRAND_FIELD_MAP).forEach(([brand, fieldCode]) => {
    if (lowerQuery.includes(brand)) {
      matchedFields.add(fieldCode);
      fieldScores[fieldCode] = 100; // High score for direct brand matches
      matchedLayers.add('athleticShoePurchases'); // Ensure athletic shoe layer is included
     // console.log(`[ConceptMapping] Direct brand match: ${brand} -> ${fieldCode}`);
    }
  });
}

// ============================================================================
// SYSTEMATIC FIELD MAPPING GENERATION
// ============================================================================
// Instead of hardcoded mappings, automatically extract ALL fields from the 
// layer configuration and build comprehensive keyword mappings

// Build comprehensive field keywords from layer configuration
function buildFieldKeywordsFromLayers(): Record<string, string[]> {
  const fieldKeywords: Record<string, string[]> = {};
  
  // Extract all fields from all layers
  baseLayerConfigs.forEach(layer => {
    if (layer.fields) {
      layer.fields.forEach(field => {
        const fieldName = field.name;
        const fieldAlias = field.alias || field.label || fieldName;
        
        // Skip system fields
        if (['OBJECTID', 'Shape__Area', 'Shape__Length', 'CreationDate', 'EditDate', 'Creator', 'Editor'].includes(fieldName)) {
          return;
        }
        
        if (!fieldKeywords[fieldName]) {
          fieldKeywords[fieldName] = [];
        }
        
        // Add the field name itself (lowercase)
        fieldKeywords[fieldName].push(fieldName.toLowerCase());
        
        // Add the alias (lowercase)
        if (fieldAlias && fieldAlias !== fieldName) {
          fieldKeywords[fieldName].push(fieldAlias.toLowerCase());
        }
        
        // Extract meaningful keywords from the alias
        const aliasKeywords = extractKeywordsFromAlias(fieldAlias);
        fieldKeywords[fieldName].push(...aliasKeywords);
      });
    }
  });
  
  // Also include mappings from ALIAS_MAP
  Object.entries(ALIAS_MAP).forEach(([alias, fieldCode]) => {
    if (!fieldKeywords[fieldCode]) {
      fieldKeywords[fieldCode] = [];
    }
    fieldKeywords[fieldCode].push(alias.toLowerCase());
    
    // Extract keywords from the alias
    const aliasKeywords = extractKeywordsFromAlias(alias);
    fieldKeywords[fieldCode].push(...aliasKeywords);
  });

  // Deduplicate and clean up keywords for each field
  Object.keys(fieldKeywords).forEach(fieldCode => {
    fieldKeywords[fieldCode] = Array.from(new Set(fieldKeywords[fieldCode]));
  });
  
  return fieldKeywords;
}

// Extract meaningful keywords from field aliases
function extractKeywordsFromAlias(alias: string): string[] {
  const stopwords = new Set([
  'the', 'of', 'and', 'or', 'for', 'to', 'in', 'at', 'on', 'by', 'last', 'mo',
    'year', 'current', 'total', 'bought', 'spent', 'participated', 'shopped',
    'athletic', 'shoes', 'shoe', 'store', 'sport', 'sports', 'percent', 'percentage',
    '2024', 'esri', '(%)', 'scale', 'super', 'fan'
    // NOTE: Removed nike, adidas, jordan, converse from stopwords - these are CRITICAL brand keywords!
  ]);
  
  return alias
      .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Replace non-word chars with spaces
    .split(/\s+/)
    .filter(token => 
      token.length > 2 && 
      !stopwords.has(token) && 
      !/^\d+$/.test(token) // Remove pure numbers
    );
}

// Build the comprehensive field keywords mapping
const FIELD_KEYWORDS = buildFieldKeywordsFromLayers();

// CRITICAL FIX: Add enhanced demographic and age field mappings
const ENHANCED_FIELD_MAPPINGS = {
  // Age and generational demographics
  'GENZ_CY': ['age', 'young', 'youth', 'gen z', 'generation z', 'demographics', 'generational'],
  'GENZ_CY_P': ['age', 'young', 'youth', 'gen z', 'generation z', 'demographics', 'generational'],
  'MILLENN_CY': ['age', 'millennial', 'millennials', 'demographics', 'generational'],
  'MILLENN_CY_P': ['age', 'millennial', 'millennials', 'demographics', 'generational'],
  'GENALPHACY': ['age', 'young', 'youth', 'gen alpha', 'generation alpha', 'demographics', 'generational'],
  'GENALPHACY_P': ['age', 'young', 'youth', 'gen alpha', 'generation alpha', 'demographics', 'generational'],
  
  // Income and wealth demographics
  'MEDDI_CY': ['income', 'earnings', 'wealth', 'affluent', 'rich', 'poor', 'disposable income', 'median income', 'demographics'],
  'WLTHINDXCY': ['wealth', 'wealthy', 'affluent', 'rich', 'income', 'demographics'],
  
  // Population and diversity
  'TOTPOP_CY': ['population', 'people', 'residents', 'demographics'],
  'DIVINDX_CY': ['diversity', 'diverse', 'multicultural', 'ethnic', 'demographics'],
  
  // Racial/ethnic demographics
  'WHITE_CY': ['white', 'caucasian', 'demographics', 'ethnicity', 'race'],
  'WHITE_CY_P': ['white', 'caucasian', 'demographics', 'ethnicity', 'race'],
  'BLACK_CY': ['black', 'african american', 'demographics', 'ethnicity', 'race'],
  'BLACK_CY_P': ['black', 'african american', 'demographics', 'ethnicity', 'race'],
  'ASIAN_CY': ['asian', 'demographics', 'ethnicity', 'race'],
  'ASIAN_CY_P': ['asian', 'demographics', 'ethnicity', 'race'],
  // Hispanic demographics - all subcategories
  'HISPWHT_CY': ['hispanic', 'latino', 'latina', 'demographics', 'ethnicity', 'race'],
  'HISPWHT_CY_P': ['hispanic', 'latino', 'latina', 'demographics', 'ethnicity', 'race'],
  'HISPBLK_CY': ['hispanic', 'latino', 'latina', 'black', 'demographics', 'ethnicity', 'race'],
  'HISPBLK_CY_P': ['hispanic', 'latino', 'latina', 'black', 'demographics', 'ethnicity', 'race'],
  'HISPAI_CY': ['hispanic', 'latino', 'latina', 'american indian', 'demographics', 'ethnicity', 'race'],
  'HISPAI_CY_P': ['hispanic', 'latino', 'latina', 'american indian', 'demographics', 'ethnicity', 'race'],
  'HISPPI_CY': ['hispanic', 'latino', 'latina', 'pacific islander', 'demographics', 'ethnicity', 'race'],
  'HISPPI_CY_P': ['hispanic', 'latino', 'latina', 'pacific islander', 'demographics', 'ethnicity', 'race'],
  'HISPOTH_CY': ['hispanic', 'latino', 'latina', 'other race', 'demographics', 'ethnicity', 'race'],
  'HISPOTH_CY_P': ['hispanic', 'latino', 'latina', 'other race', 'demographics', 'ethnicity', 'race'],
  
  // Sports participation - CRITICAL for sports queries
  'MP33020A_B': ['running', 'jogging', 'run', 'jog', 'participation', 'sports', 'exercise', 'fitness'],
  'MP33020A_B_P': ['running', 'jogging', 'run', 'jog', 'participation', 'sports', 'exercise', 'fitness'],
  'MP33032A_B': ['yoga', 'participation', 'sports', 'exercise', 'fitness'],
  'MP33032A_B_P': ['yoga', 'participation', 'sports', 'exercise', 'fitness'],
  'MP33031A_B': ['weight lifting', 'weightlifting', 'weights', 'gym', 'participation', 'sports', 'exercise', 'fitness'],
  'MP33031A_B_P': ['weight lifting', 'weightlifting', 'weights', 'gym', 'participation', 'sports', 'exercise', 'fitness'],
  
  // Sports fandom
  'MP33106A_B': ['basketball', 'nba', 'sports', 'fan'],
  'MP33106A_B_P': ['basketball', 'nba', 'sports', 'fan'],
  'MP33107A_B': ['football', 'nfl', 'sports', 'fan'],
  'MP33107A_B_P': ['football', 'nfl', 'sports', 'fan'],
  
  // Retail shopping
  'MP31035A_B': ['dicks', "dick's", 'sporting goods', 'retail', 'shopping'],
  'MP31035A_B_P': ['dicks', "dick's", 'sporting goods', 'retail', 'shopping'],
  'MP31042A_B': ['foot locker', 'footlocker', 'retail', 'shopping'],
  'MP31042A_B_P': ['foot locker', 'footlocker', 'retail', 'shopping'],
  
  // Spending patterns
  'MP07109A_B': ['sports clothing', 'clothing', 'apparel', 'spending', 'spent', 'budget'],
  'MP07109A_B_P': ['sports clothing', 'clothing', 'apparel', 'spending', 'spent', 'budget'],
  'MP07111A_B': ['athletic wear', 'workout wear', 'athletic clothing', 'fitness wear', 'spending', 'spent', 'budget'],
  'MP07111A_B_P': ['athletic wear', 'workout wear', 'athletic clothing', 'fitness wear', 'spending', 'spent', 'budget'],
  'PSIV7UMKVALM': ['shoes', 'spending', 'spent', 'budget', 'investment', 'money'],
  'X9051_X': ['sports equipment', 'equipment', 'gear', 'spending', 'spent'],
  'X9051_X_A': ['sports equipment', 'equipment', 'gear', 'spending', 'spent'],
  
  // Athletic shoe types
  'MP30016A_B': ['athletic shoes', 'athletic shoe', 'sneakers', 'sneaker', 'overall', 'general'],
  'MP30016A_B_P': ['athletic shoes', 'athletic shoe', 'sneakers', 'sneaker', 'overall', 'general'],
  'MP30018A_B': ['basketball shoes', 'basketball shoe', 'basketball'],
  'MP30018A_B_P': ['basketball shoes', 'basketball shoe', 'basketball'],
  'MP30019A_B': ['cross training', 'cross-training', 'training shoes'],
  'MP30019A_B_P': ['cross training', 'cross-training', 'training shoes'],
  'MP30021A_B': ['running shoes', 'running shoe', 'jogging shoes', 'running', 'jogging'],
  'MP30021A_B_P': ['running shoes', 'running shoe', 'jogging shoes', 'running', 'jogging'],
};

// Merge enhanced mappings with existing field keywords
Object.entries(ENHANCED_FIELD_MAPPINGS).forEach(([fieldCode, keywords]) => {
  if (!FIELD_KEYWORDS[fieldCode]) {
    FIELD_KEYWORDS[fieldCode] = [];
  }
  FIELD_KEYWORDS[fieldCode].push(...keywords);
  FIELD_KEYWORDS[fieldCode] = Array.from(new Set(FIELD_KEYWORDS[fieldCode])); // Deduplicate
});

// Similarly, automatically build layer keywords from configuration
const LAYER_KEYWORDS: Record<string, string[]> = {};

baseLayerConfigs.forEach(layer => {
  if (!LAYER_KEYWORDS[layer.id]) {
    LAYER_KEYWORDS[layer.id] = [];
  }
  
  // Add layer ID as keyword
  LAYER_KEYWORDS[layer.id].push(layer.id.toLowerCase());
  
  // Add layer name
  if (layer.name) {
    LAYER_KEYWORDS[layer.id].push(layer.name.toLowerCase());
  }
  
  // Extract keywords from name
  if (layer.name) {
    const nameKeywords = extractKeywordsFromAlias(layer.name);
    LAYER_KEYWORDS[layer.id].push(...nameKeywords);
  }
  
  // Add description keywords if available
  if (layer.description) {
    const descKeywords = extractKeywordsFromAlias(layer.description);
    LAYER_KEYWORDS[layer.id].push(...descKeywords);
  }
  
  // Deduplicate
  LAYER_KEYWORDS[layer.id] = Array.from(new Set(LAYER_KEYWORDS[layer.id]));
});

// Manual layer keyword enhancements for common queries
const ENHANCED_LAYER_KEYWORDS = {
  'totalPopulation': ['population', 'people', 'residents', 'demographic', 'demographics'],
  'applications': ['applications', 'application', 'frequency', 'rates'],
  'athleticShoePurchases': ['athletic', 'shoes', 'shoe', 'brand', 'brands', 'nike', 'adidas', 'jordan', 'converse', 'purchase', 'purchases'],
  'demographics': ['age', 'income', 'race', 'ethnicity', 'demographic', 'demographics', 'population'],
  'sportsParticipation': ['sports', 'participation', 'exercise', 'fitness', 'activities']
};

// Merge enhanced layer keywords
Object.entries(ENHANCED_LAYER_KEYWORDS).forEach(([layerId, keywords]) => {
  if (!LAYER_KEYWORDS[layerId]) {
    LAYER_KEYWORDS[layerId] = [];
  }
  LAYER_KEYWORDS[layerId].push(...keywords);
  LAYER_KEYWORDS[layerId] = Array.from(new Set(LAYER_KEYWORDS[layerId])); // Deduplicate
});

/**
 * Main concept mapping function
 * 
 * This is the primary entry point that processes a user query and returns
 * matched layers, fields, and confidence scores.
 * 
 * EASY EXTENSION CHECKLIST FOR NEW PROJECTS:
 * 1. Update GROUPED_VARIABLE_PATTERNS with your domain patterns
 * 2. Update GROUPED_VARIABLE_FIELDS with your field codes
 * 3. Update GROUPED_VARIABLE_LAYERS with your layer IDs
 * 4. Update BRAND_FIELD_MAP with your entity mappings
 * 5. Test with sample queries from your domain
 * 
 * See docs/grouped-variables-extension-guide.md for detailed instructions.
 */
export async function conceptMapping(query: string, context?: string): Promise<ConceptMap> {
  const lowerQuery = query.toLowerCase();
  const matchedLayers = new Set<string>();
  const matchedFields = new Set<string>();
  const keywords: string[] = [];
  const layerScores: { [key: string]: number } = {};
  const fieldScores: { [key: string]: number } = {};
  

  
  // Prioritize application-related matches first
  if (lowerQuery.includes('application')) {
    matchedLayers.add('applications');
    matchedFields.add('TOTPOP_CY');
    layerScores['applications'] = 10; // Give it a high score
    fieldScores['TOTPOP_CY'] = 10; // Give it a high score
  }
  
  // If context is provided, use it to enhance the query understanding
  if (context) {
    // Extract last mentioned layer/entity from context
    const lastLayerMatch = context.match(/layer ['"]([\w-]+)['"]/i) || context.match(/about ([\w\s]+)\./i);
    const lastEntity = lastLayerMatch ? lastLayerMatch[1] : undefined;
    
    // If query contains pronouns and we have a last entity, replace them
    if (lastEntity) {
      const pronounPattern = /\b(it|that|those|the previous|the last one|the above)\b/gi;
      if (pronounPattern.test(query)) {
        query = query.replace(pronounPattern, lastEntity);
      }
    }
    
    // If query is very short or vague, and context has a clear last entity, append it
    if (query.trim().length < 6 && lastEntity) {
      query = `${query} ${lastEntity}`.trim();
    }
    
    // If query is a follow-up like "now by city", prepend last entity
    if (/^now\b|^by\b|^compare\b|^show\b|^and\b|^also\b|^then\b/i.test(query) && lastEntity) {
      query = `${lastEntity} ${query}`.trim();
    }
  }
  
  // Extract keywords from query
  
  // Score-based matching for more intelligent layer selection
  Object.entries(LAYER_KEYWORDS).forEach(([layerId, layerKeywords]) => {
    let score = 0;
    layerKeywords.forEach(keyword => {
      const keywordRegex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (keywordRegex.test(lowerQuery)) {
        score += keyword.split(' ').length * 2;
        // Boost score for application-related keywords
        if (keyword.includes('application')) {
          score += 5;
        }
      }
    });
    
    if (score > 0) {
      layerScores[layerId] = (layerScores[layerId] || 0) + score;
      keywords.push(...layerKeywords.filter(k => new RegExp(`\\b${k}\\b`, 'i').test(lowerQuery)));
    }
  });
  
  // Select top scoring layers
  const maxLayersAllowed = 5; // Default max
  
  // Filter layers based on score to be more selective
  const layerSelectionDetails = Object.entries(layerScores)
    .sort(([, a], [, b]) => b - a);

  const finalLayers = layerSelectionDetails.map(([layerId]) => layerId).slice(0, maxLayersAllowed);
  
  finalLayers.forEach(layer => matchedLayers.add(layer));
  
  // ============================================================================
  // GROUPED VARIABLE PROCESSING
  // ============================================================================
  // Process direct brand mentions first (highest priority)
  processDirectBrands(lowerQuery, matchedFields, matchedLayers, fieldScores);
  
  // Process grouped variables (e.g., "all major brands", "athletic shoes")
  processGroupedVariables(lowerQuery, matchedFields, matchedLayers, fieldScores, layerScores);
  
  // Match fields based on keywords with scoring
  Object.entries(FIELD_KEYWORDS).forEach(([fieldName, fieldKeywords]) => {
    let score = 0;
    const matchedKeywords: string[] = [];
    fieldKeywords.forEach(keyword => {
      const keywordRegex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (keywordRegex.test(lowerQuery)) {
        score += keyword.split(' ').length * 2;
        matchedKeywords.push(keyword);
      }
    });
    
    if (score > 0) {
      fieldScores[fieldName] = score;
      keywords.push(...fieldKeywords.filter(k => new RegExp(`\\b${k}\\b`, 'i').test(lowerQuery)));
      
      // DEBUG: Log field matches for Jordan/Converse queries
      if (lowerQuery.includes('jordan') || lowerQuery.includes('converse')) {
      //  console.log(`[ConceptMapping] Field match: ${fieldName} (score: ${score}) matched keywords:`, matchedKeywords);
      }
    }
  });
  
  Object.keys(fieldScores).forEach(field => matchedFields.add(field));
  
  // Remove renderer-only fields that should never be used for analysis
  const RENDERER_ONLY_FIELDS = ['thematic_value'];
  RENDERER_ONLY_FIELDS.forEach(f => {
    matchedFields.delete(f);
    delete fieldScores[f];
  });
  
  // If no specific matches, use the query classifier as a fallback
  if (matchedLayers.size === 0) {
    //console.log('[ConceptMapping] No layers matched, using classifier fallback...');
    const classification = await queryClassifier.classifyQuery(query);
    if (classification.visualizationType) {
        // Attempt to map visualization type to a default layer
        const vizToLayerMap: Record<string, string[]> = {
            'choropleth': ['totalPopulation', 'applications'],
            'heatmap': ['applications'],
            'correlation': ['conversionRate', 'householdIncome'],
            'joint_high': ['conversionRate', 'householdIncome'],
        };
        const defaultLayers = vizToLayerMap[classification.visualizationType];
        if (defaultLayers) {
            defaultLayers.forEach(l => matchedLayers.add(l));
          //  console.log(`[ConceptMapping] Fallback to layers for ${classification.visualizationType}:`, defaultLayers);
        }
    }
  }

  // If query is about applications, don't add default layers
  if (!matchedLayers.has('applications')) {
    // Only apply defaults if not an application query
  if (matchedLayers.size === 0) {
    matchedLayers.add('totalPopulation');
    matchedLayers.add('applications');
  //  console.log('[ConceptMapping] Applying generic default layers.');
    }
  }
  
  // Calculate confidence based on scoring
  const confidence = Math.min(1, (matchedLayers.size + matchedFields.size) / 5);
  
  // More aggressive keyword matching
  const allKeywords = Array.from(new Set(keywords.flatMap(k => k.split(/\s+/))));

  allKeywords.forEach(keyword => {
    // Search in layer names and descriptions
    for (const [layerId, layerData] of Object.entries(LAYER_KEYWORDS)) {
      if (layerData.some((lk: string) => lk.includes(keyword))) {
        layerScores[layerId] = (layerScores[layerId] || 0) + 2;
      }
    }

    // Search in field names and aliases
    for (const [fieldName, fieldData] of Object.entries(FIELD_KEYWORDS)) {
      if (fieldData.some((fk: string) => fk.includes(keyword))) {
        fieldScores[fieldName] = (fieldScores[fieldName] || 0) + 2;
      }
    }
  });
  
  // Log final results for debugging
 // console.log(`[ConceptMapping] Query: "${query}" -> ${matchedFields.size} fields, ${matchedLayers.size} layers`);
  
  // DEBUG: Log specific details for Jordan/Converse queries
  if (lowerQuery.includes('jordan') || lowerQuery.includes('converse')) {
   // console.log(`[ConceptMapping] Jordan/Converse query final results:`);
   // console.log(`  Matched fields:`, Array.from(matchedFields));
   // console.log(`  Field scores:`, fieldScores);
   // console.log(`  Matched layers:`, Array.from(matchedLayers));
  }
  
  return {
    matchedLayers: Array.from(matchedLayers),
    matchedFields: Array.from(matchedFields),
    confidence,
    keywords: Array.from(new Set(keywords)),
    layerScores,
    fieldScores,
  };
}

const layerIdToConceptMapping: Record<string, string> = {
  'conversionRate': 'conversions',
  'householdIncome': 'demographics',
  'maintainersMedianAge': 'demographics',
};

const fieldNameToConceptMapping: Record<string, string> = {
  'CONVERSIONRATE': 'thematic_value',
  'thematic_value': 'household_average_income',
  'SUM_FUNDED': 'funded_amount',
  'condominium': 'condo_ownership_pct',
  'applications': 'frequency',
  'application': 'frequency',
  'numberOfApplications': 'frequency',
  'number_of_applications': 'frequency',
  'household_average_income': 'household_average_income',
};

export function mapToConcepts(
  matchedLayers: string[],
  matchedFields: string[]
): { layers: string[], fields: string[] } {
  const mappedLayers = matchedLayers.map(id => layerIdToConceptMapping[id] || id);
  const mappedFields = matchedFields.map(name => fieldNameToConceptMapping[name] || name);
  
  return {
    layers: Array.from(new Set(mappedLayers)),
    fields: Array.from(new Set(mappedFields)),
  };
} 

export { FIELD_KEYWORDS }; 