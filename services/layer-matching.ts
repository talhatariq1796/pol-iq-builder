/* eslint-disable prefer-const */
import { layers } from '../config/layers';
import type { LayerMatch } from '../types/layer-matching';
import { GoogleTrendsService } from '../utils/services/google-trends-service';

export async function findRelevantLayers(
  question: string,
  aiConfidenceThreshold = 0.7
): Promise<LayerMatch[]> {
  try {
    // Check if this is a visualization query
    const isVisualizationQuery = isVisualizationIntent(question);
    
    if (isVisualizationQuery) {
      return findVisualizationLayers(question);
    }

    const url = `${window.location.origin}/api/layer-matching`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        body: JSON.stringify({ question })
      });

      const responseText = await response.text();

      if (!response.ok) {
        return rulesBasedFieldMatching([]);
      }

      const data = JSON.parse(responseText);

      if (data.error) {
        return rulesBasedFieldMatching([]);
      }

      // Filter matches by confidence threshold if using AI matches
      if (data.matchMethod === 'ai') {
        return data.layerMatches.filter((m: LayerMatch) => (m.confidence ?? 0) >= aiConfidenceThreshold);
      }

      return data.layerMatches;
    } catch (fetchError) {
      return rulesBasedFieldMatching([]);
    }
  } catch (error) {
    // Fallback to client-side rules-based matching
    return rulesBasedFieldMatching([]);
  }
}

function isVisualizationIntent(question: string): boolean {
  const visualizationTerms = [
    'show',
    'display',
    'visualize',
    'map',
    'plot',
    'distribution',
    'pattern',
    'concentration',
    'highest',
    'lowest'
  ];

  const questionLower = question.toLowerCase();
  return visualizationTerms.some(term => questionLower.includes(term));
}

function findEntityMentions(questionLower: string): string[] {
  return Object.entries(layers).reduce((mentions: string[], [layerId, layer]) => {
    if (layer.status !== 'active') return mentions;
    
    // Check layer name and any metadata tags
    const searchTerms = [
      layer.name.toLowerCase(),
      ...(layer.metadata?.tags || []).map(tag => tag.toLowerCase())
    ];

    // Split the question into words and check for matches
    const questionWords = questionLower.split(/\s+/);
    const found = searchTerms.some(term => {
      // Check for exact matches first
      if (questionLower.includes(term)) return true;
      
      // For partial matches, require more context
      const termWords = term.split(/\s+/);
      return termWords.some(word => {
        // Skip very short words
        if (word.length < 4) return false;
        
        // For single words, require exact match or word boundary match
        return questionWords.some(qWord => {
          // Exact match
          if (qWord === word) return true;
          
          // Word boundary match (e.g., "stores" matches "store")
          if (qWord.startsWith(word + 's') || qWord.startsWith(word + 'es')) return true;
          
          // For compound terms (e.g., "energy drink"), check if all parts are present
          if (term.includes(' ') && questionLower.includes(word)) return true;
          
          return false;
        });
      });
    });

    if (found) {
      mentions.push(layerId);
    }
    return mentions;
  }, []);
}

function findVisualizationLayers(question: string): LayerMatch[] {
  const questionLower = question.toLowerCase();
  const matches: LayerMatch[] = [];
  
  // Extract entity mentions from the question
  const entityMentions = findEntityMentions(questionLower);
  
  // Check for Google Trends related queries and add trend layers if relevant
  const trendMatches = findTrendingTopicLayers(question);
  if (trendMatches.length > 0) {
    matches.push(...trendMatches);
  }
  
  if (entityMentions.length === 0 && matches.length === 0) {
    return [];
  }

  // Check for correlation/relationship queries first
  const correlationKeywords = [
    'correlation',
    'relationship',
    'compare',
    'versus',
    ' vs ',
    'between',
    'relate',
    'connection',
    'correlate'
  ];
  
  const isCorrelationQuery = correlationKeywords.some(keyword => questionLower.includes(keyword));

  if (isCorrelationQuery && entityMentions.length >= 2) {
    // Add both layers with correlation visualization mode
    entityMentions.forEach((layerId: string) => {
      const layer = layers[layerId];
      if (!layer) return;

      matches.push({
        layerId,
        relevance: 95,
        matchMethod: 'rules',
        confidence: 0.95,
        reasoning: `Correlation analysis for ${layer.name}`,
        field: layer.rendererField,
        visualizationMode: 'correlation'
      });
    });
    
    return matches.sort((a, b) => b.relevance - a.relevance);
  }

  // Check for explicit distribution/pattern queries
  const distributionPatterns = [
    /(?:show|display|visualize|map)\s+(?:the\s+)?distribution\s+of\s+(\w+)/i,
    /(?:show|display|visualize|map)\s+(?:the\s+)?pattern\s+of\s+(\w+)/i,
    /(?:show|display|visualize|map)\s+(?:how|where)\s+(\w+)\s+(?:is|are)\s+distributed/i,
    /distribution\s+of\s+(\w+)/i,
    /pattern\s+of\s+(\w+)/i
  ];

  const isDistributionQuery = distributionPatterns.some(pattern => pattern.test(questionLower));

  // For all other queries, don't set a visualization mode - let the visualization factory decide
  entityMentions.forEach(layerId => {
    const layer = layers[layerId];
    if (!layer) return;

    matches.push({
      layerId,
      relevance: 85,
      matchMethod: 'rules',
      confidence: 0.85,
      reasons: [`Layer match for ${layer.name}`],
      field: layer.rendererField,
      // Only set visualization mode to 'distribution' if explicitly requested
      ...(isDistributionQuery && {
        visualizationMode: 'distribution',
        relevance: 90,
        confidence: 0.9,
        reasons: [`Distribution visualization for ${layer.name}`]
      })
    });
  });

  return matches.sort((a, b) => b.relevance - a.relevance);
}

export const findLayersWithAI = async (
  question: string, 
  requiredFields?: string[],
  aiConfidenceThreshold = 0.7  // Added parameter with default value
): Promise<LayerMatch[]> => {
  // First try AI matching with field requirements
  try {
    const response = await fetch('/api/claude/layer-matching', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requiredFields,
        layers: Object.entries(layers).map(([id, layer]) => ({
          id: layer.id,
          name: layer.name,
          fields: layer.fields,
          rendererField: layer.rendererField
        }))
      })
    });

    if (!response.ok) {
      return rulesBasedFieldMatching(requiredFields || []);
    }

    const data = await response.json();
    return data.matches
      .filter((m: any) => m.confidence >= aiConfidenceThreshold)
      .map((match: any) => ({
        layerId: match.layerId,
        relevance: match.relevance || 0,
        confidence: match.confidence || 0,
        matchMethod: 'ai',
        reasons: [`Contains required fields: ${(requiredFields || []).join(', ')}`],
        field: layers[match.layerId]?.rendererField
      }));
  } catch (error) {
    return rulesBasedFieldMatching(requiredFields || []);
  }
};

export async function findLayersWithFields(requiredFields: string[], question: string = '', aiConfidenceThreshold = 0.7): Promise<LayerMatch[]> {
  try {
    const requestBody = {
      question,
      requiredFields,
      layers: Object.entries(layers).map(([id, layer]) => ({
        id: layer.id,
        name: layer.name,
        fields: layer.fields,
        rendererField: layer.rendererField
      }))
    };

    const response = await fetch('/api/claude/layer-matching', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      return rulesBasedFieldMatching(requiredFields);
    }

    const data = await response.json();
    return (data.matches || [])  // Ensure matches exists
      .filter((m: any) => m.confidence >= aiConfidenceThreshold)
      .map((match: any) => ({
        layerId: match.layerId,
        relevance: match.relevance || 0,
        confidence: match.confidence || 0,
        matchMethod: 'ai',
        reasons: [`Contains required fields: ${(requiredFields || []).join(', ')}`],
        field: layers[match.layerId]?.rendererField
      }));
  } catch (error) {
    return rulesBasedFieldMatching(requiredFields);
  }
}

// Helper function for rules-based field matching
function rulesBasedFieldMatching(requiredFields: string[]): LayerMatch[] {
  const matches: LayerMatch[] = [];

  Object.entries(layers).forEach(([layerId, layer]) => {
    if (layer.status !== 'active') return;

    // Check if layer has all required fields
    const hasAllFields = requiredFields.every(field => 
      layer.fields.some(f => f.name.toLowerCase() === field.toLowerCase())
    );

    // Check for brand-specific matches
    const isBrandLayer = layer.metadata?.tags?.some(tag => 
      tag.toLowerCase().includes('brand') || 
      tag.toLowerCase().includes('nike') ||
      tag.toLowerCase().includes('adidas') ||
      tag.toLowerCase().includes('jordan') ||
      tag.toLowerCase().includes('converse') ||
      tag.toLowerCase().includes('shoes')
    );

    if (hasAllFields || isBrandLayer) {
      const reasons: string[] = [];
    if (hasAllFields) {
        reasons.push(`Layer contains all required fields: ${requiredFields.join(', ')}`);
      }
      if (isBrandLayer) {
        reasons.push(`Brand-specific layer match: ${layer.name}`);
      }

      matches.push({
        layerId,
        relevance: isBrandLayer ? 90 : 100,
        matchMethod: 'rules',
        confidence: isBrandLayer ? 0.85 : 0.9,
        reasoning: reasons.join('; '),
        field: layer.rendererField
      });
    }
  });

  return matches.sort((a, b) => b.relevance - a.relevance);
}

// New function to find trending topics from the user's query
function findTrendingTopicLayers(question: string): LayerMatch[] {
  const questionLower = question.toLowerCase();
  
  // Check if this is a trends-related question
  const trendsKeywords = [
    'trends', 'trending', 'searches', 'interest', 'popular', 'searched for',
    'looking up', 'google trends', 'search volume', 'search data'
  ];
  
  const politicalKeywords = [
    'political', 'politics', 'election', 'vote', 'candidate', 'party',
    'liberal', 'conservative', 'mark carney', 'pierre poilievre'
  ];
  
  const economicKeywords = [
    'economy', 'economic', 'tax', 'taxes', 'tariff', 'tariffs', 
    'trade', 'budget', 'economic policy', 'inflation'
  ];
  
  const regionKeywords = [
    'ontario', 'british columbia', 'bc', 'region', 'province', 'location'
  ];
  
  // Check if any of the keyword categories are present
  const hasTrendsKeywords = trendsKeywords.some(keyword => questionLower.includes(keyword));
  const hasPoliticalKeywords = politicalKeywords.some(keyword => questionLower.includes(keyword));
  const hasEconomicKeywords = economicKeywords.some(keyword => questionLower.includes(keyword));
  const hasRegionKeywords = regionKeywords.some(keyword => questionLower.includes(keyword));
  
  // If the question doesn't relate to any of these categories, return empty array
  if (!hasTrendsKeywords && !hasPoliticalKeywords && !hasEconomicKeywords) {
    return [];
  }
  
  // Determine region preference from the question
  let regionPreference: 'ON' | 'BC' | 'ALL' = 'ALL';
  if (questionLower.includes('ontario')) {
    regionPreference = 'ON';
  } else if (questionLower.includes('british columbia') || questionLower.includes('bc')) {
    regionPreference = 'BC';
  }
  
  // Get matching trend topics based on the query
  const relevantTopics = GoogleTrendsService.getTrendingTopicsForQuery(question, {
    region: regionPreference
  });
  
  // If no exact matches, get popular trends in the region
  const topicsToUse = relevantTopics.length > 0 
    ? relevantTopics 
    : GoogleTrendsService.getPopularSearchTerms(regionPreference, 3);
  
  // Convert to layer matches
  return topicsToUse.map(topic => {
    const layer = layers[topic.layerId];
    if (!layer) return null;
    
    return {
      layerId: topic.layerId,
      relevance: Math.min(90, 50 + topic.volume / 2), // Convert volume to relevance score
      confidence: Math.min(0.9, 0.6 + topic.volume / 200), // Convert volume to confidence
      reasons: [`Google Trends data for "${topic.term}" in ${topic.region === 'ON' ? 'Ontario' : 'British Columbia'}`],
      matchMethod: 'trends',
      field: layer.rendererField
    };
  }).filter(Boolean) as LayerMatch[];
}