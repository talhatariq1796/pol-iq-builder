import { LocalGeospatialFeature } from '@/types/index';

export function getRelevantFields(attributes: Record<string, any>, query: string): string[] {
  if (!attributes || !query) {
    return [];
  }

  const availableFields = Object.keys(attributes);
  const queryLower = query.toLowerCase();

  // For exercise/fitness related queries
  if (queryLower.includes('exercise') || queryLower.includes('fitness') || 
      queryLower.includes('jog') || queryLower.includes('run') || 
      queryLower.includes('workout') || queryLower.includes('active') ||
      queryLower.includes('sport') || queryLower.includes('athletic')) {
    const exerciseFields = availableFields.filter(f => {
      const fieldLower = f.toLowerCase();
      return (
        fieldLower.includes('exercise') ||
        fieldLower.includes('fitness') ||
        fieldLower.includes('jog') ||
        fieldLower.includes('run') ||
        fieldLower.includes('workout') ||
        fieldLower.includes('active') ||
        fieldLower.includes('sport') ||
        fieldLower.includes('athletic') ||
        fieldLower.includes('participated')
      );
    });
    
    if (exerciseFields.length > 0) {
      console.log('[getRelevantFields] Found exercise fields:', exerciseFields);
      return exerciseFields;
    }
  }

  // For strategic analysis queries - PRIORITY OVER COMPETITIVE AND BRAND QUERIES
  if (queryLower.includes('strategic') || queryLower.includes('expansion') || 
      queryLower.includes('invest') || queryLower.includes('opportunity') ||
      queryLower.includes('value') || queryLower.includes('potential') ||
      (queryLower.includes('market') && queryLower.includes('analysis')) ||
      (queryLower.includes('nike') && (queryLower.includes('expand') || queryLower.includes('invest'))) ||
      (queryLower.includes('expansion') && queryLower.includes('nike'))) {
    const strategicFields = availableFields.filter(f => {
      const fieldLower = f.toLowerCase();
      return (
        fieldLower.includes('strategic_value_score') ||
        fieldLower.includes('strategic_score') ||
        fieldLower.includes('value_score') ||
        fieldLower.includes('strategic')
      );
    });
    
    if (strategicFields.length > 0) {
      console.log('[getRelevantFields] Found strategic fields:', strategicFields);
      return strategicFields;
    }
  }

  // For competitive analysis queries - PRIORITY OVER BRAND QUERIES
  if (queryLower.includes('competitive') || queryLower.includes('compete') || 
      queryLower.includes('competitor') || queryLower.includes('position') ||
      queryLower.includes('advantage') || queryLower.includes('compare') ||
      (queryLower.includes('market') && queryLower.includes('position')) ||
      (queryLower.includes('nike') && queryLower.includes('against'))) {
    const competitiveFields = availableFields.filter(f => {
      const fieldLower = f.toLowerCase();
      return (
        fieldLower.includes('competitive_advantage_score') ||
        fieldLower.includes('competitive_score') ||
        fieldLower.includes('advantage_score') ||
        fieldLower.includes('competitive')
      );
    });
    
    if (competitiveFields.length > 0) {
      console.log('[getRelevantFields] Found competitive fields:', competitiveFields);
      return competitiveFields;
    }
  }

  // For brand-related queries
  if (queryLower.includes('nike') || queryLower.includes('adidas') || queryLower.includes('brand') || 
      queryLower.includes('lululemon') || queryLower.includes('alo') || queryLower.includes('jordan') ||
      queryLower.includes('shoes') || queryLower.includes('sales') || queryLower.includes('purchase')) {
    const brandFields = availableFields.filter(f => {
      const fieldLower = f.toLowerCase();
      return (
        // Check for brand-specific fields
        fieldLower.includes('nike') || 
        fieldLower.includes('adidas') || 
        fieldLower.includes('alo') ||
        fieldLower.includes('jordan') ||
        fieldLower.includes('lululemon') ||
        // Check for purchase-related fields
        (fieldLower.includes('bought') && 
         (fieldLower.includes('shoes') || 
          fieldLower.includes('athletic') || 
          fieldLower.includes('sports'))) ||
        // Check for sales-related fields
        (fieldLower.includes('sales') || fieldLower.includes('purchase'))
      );
    });
    
    if (brandFields.length > 0) {
      console.log('[getRelevantFields] Found brand fields:', brandFields);
      return brandFields;
    }
  }
  
  // For sports fan related queries
  if (queryLower.includes('fan') || queryLower.includes('sports') ||
      queryLower.includes('nba') || queryLower.includes('nfl') ||
      queryLower.includes('mlb') || queryLower.includes('nhl') ||
      queryLower.includes('soccer') || queryLower.includes('exercise') ||
      queryLower.includes('attend') || queryLower.includes('game') ||
      queryLower.includes('event')) {
    // Return all fields that look like fan, sports, or league-related
    const fanFields = availableFields.filter(f => {
      const fieldLower = f.toLowerCase();
      // Prioritize superfan fields for attendance queries
      if (queryLower.includes('attend') || queryLower.includes('game') || queryLower.includes('event')) {
        return fieldLower.includes('superfan');
      }
      return (
        fieldLower.includes('fan') ||
        fieldLower.includes('sports') ||
        fieldLower.includes('nba') ||
        fieldLower.includes('nfl') ||
        fieldLower.includes('mlb') ||
        fieldLower.includes('nhl') ||
        fieldLower.includes('soccer') ||
        fieldLower.includes('exercise')
      );
    });
    if (fanFields.length > 0) {
      console.log('[getRelevantFields] Found sports fan fields:', fanFields);
      return fanFields;
    }
  }
  
  // For demographic/cultural queries
  if (queryLower.includes('cultural') || queryLower.includes('diversity') || 
      queryLower.includes('demographic') || queryLower.includes('population') ||
      queryLower.includes('ethnic') || queryLower.includes('race') ||
      (queryLower.includes('target') && queryLower.includes('customer')) ||
      (queryLower.includes('customer') && queryLower.includes('profile')) ||
      (queryLower.includes('demographic') && queryLower.includes('fit')) ||
      queryLower.includes('target audience') || queryLower.includes('customer base')) {
    const demographicFields = availableFields.filter(f => {
      const fieldLower = f.toLowerCase();
      return (
        fieldLower.includes('population') ||
        fieldLower.includes('diversity') ||
        fieldLower.includes('household') ||
        fieldLower.includes('demographic') ||
        fieldLower.includes('ethnic') ||
        fieldLower.includes('race') ||
        fieldLower.includes('cultural')
      );
    });
    
    if (demographicFields.length > 0) {
      console.log('[getRelevantFields] Found demographic fields:', demographicFields);
      return demographicFields;
    }
  }
  
  // Default case: return all available fields
  console.log('[getRelevantFields] No specific fields found, returning all available fields');
  return availableFields;
} 