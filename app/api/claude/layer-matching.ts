// pages/api/layer-matching.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { Anthropic } from '@anthropic-ai/sdk';
import { layers, concepts } from '../../../config/layers';
import type { LayerConfig } from '../../../types/layers';
import type { LayerMatch } from '../../../types/layer-matching';
import { QueryBuilder } from '../../../utils/query-builder';

interface CompositeFeature {
  geometry: any;
  attributes: {
    [key: string]: any;
    compositeIndex: number;
  };
}

export function createCompositeIndex(features: any[], layerMatches: LayerMatch[]): CompositeFeature[] {
  // Calculate normalization ranges dynamically from feature data
  const normalizeRanges = layerMatches.reduce((ranges, match) => {
    if (!match.field) return ranges;
    
    // Get all values for this field
    const values = features
      .map(f => f.attributes?.[match.field as string])
      .filter(v => v !== null && v !== undefined);
      
    if (values.length > 0) {
      ranges[match.field] = {
        min: Math.min(...values),
        max: Math.max(...values)
      };
    }
    return ranges;
  }, {} as { [key: string]: { min: number; max: number } });

  return features.map(feature => {
    let compositeScore = 0;
    let totalWeight = 0;

    layerMatches.forEach(match => {
      if (!match.field) return;
      const fieldValue = feature.attributes[match.field];
      if (fieldValue !== undefined && fieldValue !== null) {
        const range = normalizeRanges[match.field] || { min: 0, max: 100 };
        const normalizedValue = Math.min(100, Math.max(0,
          ((fieldValue - range.min) / (range.max - range.min)) * 100
        ));
        
        compositeScore += (normalizedValue * match.relevance);
        totalWeight += match.relevance;
      }
    });

    return {
      geometry: feature.geometry,
      attributes: {
        ...feature.attributes,
        compositeIndex: totalWeight > 0 ? Math.round(compositeScore / totalWeight) : 0
      }
    };
  });
}

export function createVisualizationLayer(features: CompositeFeature[], title: string = "Combined Activity Index") {
  return {
    type: "feature",
    source: features,
    title: title,
    renderer: {
      type: "simple",
      symbol: {
        type: "simple-fill",
        color: [0, 0, 0, 0],
        outline: {
          color: [128, 128, 128, 0.5],
          width: "0.5px"
        }
      },
      visualVariables: [{
        type: "color",
        field: "compositeIndex",
        stops: [
          { value: 0, color: [240, 249, 243] },   // #f0f9f3 - light green
          { value: 50, color: [134, 203, 152] },  // #86cb98 - medium green
          { value: 100, color: [51, 168, 82] }    // #33a852 - target green
        ],
        legendOptions: {
          title: "Combined Activity Index"
        }
      }]
    }
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Enable detailed error logging
  console.log('Received request:', {
    method: req.method,
    body: req.body,
    query: req.query
  });

  // Ensure it's a POST request
  if (req.method !== 'POST') {
    console.error('Method Not Allowed:', req.method);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { question } = req.body;

    if (!question) {
      console.error('Invalid request: Missing question');
      return res.status(400).json({ 
        error: 'Invalid request', 
        details: 'Missing question parameter' 
      });
    }

    // Try AI matching first
    try {
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });

      const aiMatches = await performAIMatching(anthropic, question, layers);
      if (aiMatches && aiMatches.length > 0) {
        return res.status(200).json(aiMatches);
      }
    } catch (aiError) {
      console.error('AI matching failed:', aiError);
      // Continue to rules-based matching as fallback
    }

    // Fallback to rules-based matching
    const rulesBasedMatches = performRulesBasedMatching(question);
    return res.status(200).json(rulesBasedMatches);

  } catch (error) {
    console.error('Layer matching error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    return res.status(500).json({ 
      error: 'Layer matching failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

function buildCategoriesFromLayers(layers: Record<string, LayerConfig>): Record<string, string[]> {
  const categories: Record<string, Set<string>> = {};
  
  Object.values(layers).forEach(layer => {
    // Extract terms from metadata tags
    layer.metadata?.tags?.forEach(tag => {
      const category = tag.split('-')[0] || tag; // Use first part of hyphenated tag as category
      if (!categories[category]) {
        categories[category] = new Set<string>();
      }
      categories[category].add(tag);
    });

    // Extract terms from field labels
    layer.fields?.forEach(field => {
      const label = field.label;
      if (label) {
        const terms = label.toLowerCase().split(' ');
        terms.forEach(term => {
          if (!categories[term]) {
            categories[term] = new Set<string>();
          }
          categories[term].add(label.toLowerCase());
        });
      }
    });
  });

  // Convert Sets to arrays
  return Object.fromEntries(
    Object.entries(categories).map(([category, terms]) => [
      category,
      Array.from(terms)
    ])
  );
}

function performRulesBasedMatching(question: string): LayerMatch[] {
  const questionLower = question.toLowerCase();
  const matches: LayerMatch[] = [];

  // Get all retail/store layers from layer configuration
  const retailLayers = Object.entries(layers).filter(([_, layer]) => {
    const tags = layer.metadata?.tags || [];
    const isRetail = tags.some(tag => 
      tag.includes('retail') || 
      tag.includes('store') || 
      tag.includes('shop')
    );
    return isRetail && layer.status === 'active';
  });

  // Build search terms for each layer from its metadata
  retailLayers.forEach(([layerId, layer]) => {
    const searchTerms = new Set<string>();
    
    // Add terms from layer name
    layer.name?.toLowerCase().split(/[\s-]+/).forEach(term => searchTerms.add(term));
    
    // Add terms from tags
    layer.metadata?.tags?.forEach(tag => {
      tag.toLowerCase().split(/[\s-]+/).forEach(term => searchTerms.add(term));
    });
    
    // Add terms from description
    if (layer.description) {
      const keywords = layer.description.toLowerCase()
        .split(/[\s-]+/)
        .filter(word => word.length > 3); // Filter out short words
      keywords.forEach(term => searchTerms.add(term));
    }

    // Check if any search terms match the question
    if (Array.from(searchTerms).some(term => questionLower.includes(term))) {
      matches.push({
        layerId,
        relevance: 100,
        confidence: 1.0,
        matchMethod: 'rules',
        reasoning: `${layer.name} locations based on metadata match`
      });

      // Add demographic layers for filtering if query mentions areas or demographics
      if (questionLower.includes('area') || 
          questionLower.includes('demographic') || 
          questionLower.includes('young') || 
          questionLower.includes('professional') ||
          questionLower.includes('high') || 
          questionLower.includes('concentration')) {
        
        // Find demographic layers from metadata
        const demographicLayers = Object.entries(layers).filter(([_, l]) => 
          l.metadata?.tags?.some(tag => 
            tag.includes('demographic') || 
            tag.includes('population') ||
            tag.includes('income')
          ) && l.status === 'active'
        );

        demographicLayers.forEach(([demoLayerId, demoLayer]) => {
          matches.push({
            layerId: demoLayerId,
            relevance: 90,
            confidence: 0.9,
            matchMethod: 'rules',
            field: demoLayer.rendererField || '',
            threshold: 'top10percent',
            reasoning: `Areas with high ${demoLayer.name?.toLowerCase()}`
          });
        });
      }
    }
  });

  // If no specific store was mentioned but query is about retail/stores
  if (matches.length === 0 && 
      (questionLower.includes('store') || 
       questionLower.includes('retail') || 
       questionLower.includes('shop') || 
       questionLower.includes('location'))) {
    
    // Add all retail layers with lower relevance
    retailLayers.forEach(([layerId, layer]) => {
      matches.push({
        layerId,
        relevance: 80,
        confidence: 0.8,
        matchMethod: 'rules',
        reasoning: `General retail location query matching ${layer.name}`
      });
    });
  }

  return matches;
}

async function performAIMatching(anthropic: Anthropic, question: string, layers: Record<string, LayerConfig>): Promise<LayerMatch[]> {
  // Get all active layers and their metadata
  const activeLayers = Object.entries(layers).filter(([_, layer]) => layer.status === 'active');
  const validLayerIds = activeLayers.map(([id]) => id);
  
  if (validLayerIds.length === 0) {
    return [];
  }

  const queryBuilder = new QueryBuilder(layers);
  const isLocationQuery = queryBuilder.isLocationQuery(question);
  const isAreaQuery = queryBuilder.isAreaQuery(question);
  const isHighValueQuery = question.toLowerCase().includes('high') || question.toLowerCase().includes('top');
  const isPointInPolygonQuery = question.toLowerCase().includes('in') && 
    (question.toLowerCase().includes('area') || question.toLowerCase().includes('region') || 
     question.toLowerCase().includes('neighborhood') || question.toLowerCase().includes('zone'));

  const response = await anthropic.messages.create({
    model: "claude-3-sonnet-20240229",
    max_tokens: 1024,
    temperature: 0,
    system: `You are a geospatial data expert. Only return matches from these valid layer IDs: ${validLayerIds.join(', ')}. 
Each match must include the exact rendererField from the layer config.

Query Context:
- Location Query: ${isLocationQuery ? 'Yes - prioritize point layers for physical locations' : 'No'}
- Area Query: ${isAreaQuery ? 'Yes - prioritize polygon layers for regional analysis' : 'No'}
- High Value Query: ${isHighValueQuery ? 'Yes - include threshold for top 10% filtering' : 'No'}
- Point-in-Polygon Query: ${isPointInPolygonQuery ? 'Yes - requires both point and polygon layers' : 'No'}

Guidelines:
1. For location queries (e.g., "show me target stores"), prioritize point layers
2. For area-based queries (e.g., "show me high diversity areas"), prioritize polygon layers
3. For compound queries with high-value areas (e.g., "show me stores in high energy drink areas"):
   - Primary: Point layer matching the location type
   - Secondary: Polygon layer for filtering by top 10% of values
4. For point-in-polygon queries (e.g., "show me stores in high-income areas"):
   - Primary: Point layer for the locations
   - Secondary: Polygon layer for the areas
   - Set visualizationMode to "point-in-polygon"
   - Include both pointLayerId and polygonLayerId`,
    messages: [{
      role: "user",
      content: `Question: "${question}"

Available layers:
${activeLayers.map(([id, layer]) => `
- ID: ${id}
  Name: ${layer.name}
  Description: ${layer.description || 'N/A'}
  Fields: ${layer.fields?.map(f => f.label).join(', ') || 'N/A'}
  Tags: ${layer.metadata?.tags?.join(', ') || 'N/A'}
  Renderer Field: ${layer.rendererField}
  Geometry Type: ${layer.metadata?.geometryType || 'N/A'}
`).join('\n')}

Return as JSON array with fields:
- layerId: string (must be one of: ${validLayerIds.join(', ')})
- relevance: number (0-100)
- confidence: number (0-1)
- reasons: string[]
- matchMethod: "ai"
${isHighValueQuery ? '- threshold: "top10percent"\n- intent: "high-value"' : ''}
${isPointInPolygonQuery ? '- visualizationMode: "point-in-polygon"\n- pointLayerId: string (for point layer)\n- polygonLayerId: string (for polygon layer)' : ''}`
    }]
  });

  try {
    const content = response.content[0].type === 'text' ? response.content[0].text : '';
    const matches = JSON.parse(content);
    
    // For point-in-polygon queries, ensure we have both point and polygon layers
    if (isPointInPolygonQuery) {
      const pointMatches = matches.filter((m: LayerMatch) => 
        layers[m.layerId]?.metadata?.geometryType === 'point'
      );
      const polygonMatches = matches.filter((m: LayerMatch) => 
        layers[m.layerId]?.metadata?.geometryType === 'polygon'
      );

      if (pointMatches.length > 0 && polygonMatches.length > 0) {
        // Update matches with point-in-polygon information
        pointMatches.forEach((match: LayerMatch) => {
          match.visualizationMode = 'point-in-polygon';
          match.pointLayerId = match.layerId;
          match.polygonLayerId = polygonMatches[0].layerId;
        });
      }
    }

    // Validate matches against actual layer configuration
    return matches.filter((match: LayerMatch) => 
      validLayerIds.includes(match.layerId) && 
      layers[match.layerId]?.rendererField === match.field
    );
  } catch (e) {
    console.error('Failed to parse AI response:', e);
    return [];
  }
}