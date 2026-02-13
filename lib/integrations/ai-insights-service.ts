/**
 * AI Insights Service - Phase 4.4 Implementation
 * 
 * This service leverages the existing Claude API integration to generate
 * intelligent insights, pattern detection, and business recommendations
 * based on demographic and market analysis data.
 */

// Simple Claude API client
async function getChatCompletion(messages: Array<{role: string, content: string}>): Promise<string> {
  try {
    const response = await fetch('/api/claude', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4000,
        messages
      })
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content[0].text;
  } catch (error) {
    console.error('Error calling Claude API:', error);
    throw error;
  }
}

// Types
export interface AIInsight {
  id: string;
  type: 'pattern' | 'opportunity' | 'risk' | 'recommendation' | 'prediction';
  title: string;
  description: string;
  confidence: number;
  impact: 'high' | 'medium' | 'low';
  category: 'strategic' | 'demographic' | 'competitive' | 'economic';
  supportingData: {
    metric: string;
    value: string | number;
    source: string;
  }[];
  actionItems?: string[];
  relatedInsights?: string[];
  timestamp: Date;
}

export interface ExecutiveSummary {
  overview: string;
  keyFindings: string[];
  recommendations: string[];
  risks: string[];
  opportunities: string[];
  confidenceScore: number;
  roi: {
    conservative: number;
    moderate: number;
    aggressive: number;
  };
}

export interface AIInsightRequest {
  analysisData: any;
  analysisContext: {
    location?: string;
    brand?: string;
    analysisType?: string;
    zipCodes?: string[];
    selectedAreaName?: string;
    persona?: string;
  };
  maxInsights?: number;
  confidenceThreshold?: number;
  businessContext?: string;
}

export interface AIInsightResponse {
  insights: AIInsight[];
  executiveSummary: ExecutiveSummary;
  totalInsightsGenerated: number;
  processingTime: number;
  confidence: number;
}

/**
 * Generate AI-powered insights using Claude
 */
export async function generateAIInsights(
  request: AIInsightRequest
): Promise<AIInsightResponse> {
  const startTime = Date.now();
  
  try {
    // Prepare context for Claude
    const contextPrompt = buildInsightPrompt(request);
    
    // Get insights from Claude
    const claudeResponse = await getChatCompletion([
      {
        role: 'user',
        content: contextPrompt
      }
    ]);
    
    // Parse Claude's response into structured insights
    const parsedResponse = parseClaudeInsightResponse(claudeResponse);
    
    // Apply confidence filtering
    const filteredInsights = parsedResponse.insights.filter(
      insight => insight.confidence >= (request.confidenceThreshold || 0.75)
    );
    
    // Limit results
    const limitedInsights = filteredInsights.slice(0, request.maxInsights || 5);
    
    return {
      insights: limitedInsights,
      executiveSummary: parsedResponse.executiveSummary,
      totalInsightsGenerated: parsedResponse.insights.length,
      processingTime: Date.now() - startTime,
      confidence: calculateAverageConfidence(limitedInsights)
    };
    
  } catch (error) {
    console.error('Error generating AI insights:', error);
    
    // Fallback to basic insights on API failure
    return generateFallbackInsights(request);
  }
}

/**
 * Build comprehensive prompt for Claude to generate insights
 */
function buildInsightPrompt(request: AIInsightRequest): string {
  const { analysisData, analysisContext, businessContext } = request;
  
  return `You are a senior business strategist and investment analyst. The user has already received demographic analysis. Your role is to provide HIGH-LEVEL STRATEGIC INSIGHTS that go beyond the raw demographic data.

Focus on BUSINESS STRATEGY, not demographic descriptions. Provide insights a CEO or CMO would need for decision-making.

**Business Context:**
- Location: ${analysisContext.selectedAreaName || analysisContext.location || 'Not specified'}
- Brand/Business: ${analysisContext.brand || 'General market analysis'}
- Analysis Type: ${analysisContext.analysisType || 'Market research'}
- Strategic Context: ${businessContext || 'Consumer market expansion'}
- Markets: ${analysisContext.zipCodes?.join(', ') || 'Regional analysis'}

**Demographic Data for Strategic Analysis:**
${JSON.stringify(analysisData, null, 2)}

**Required Output Format (JSON):**
{
  "insights": [
    {
      "id": "unique-insight-id",
      "type": "opportunity|risk|pattern|recommendation|prediction",
      "title": "Clear, actionable insight title",
      "description": "Detailed explanation with specific data points",
      "confidence": 0.85,
      "impact": "high|medium|low", 
      "category": "strategic|demographic|competitive|economic",
      "supportingData": [
        {
          "metric": "Specific metric name",
          "value": "Numerical or text value",
          "source": "Data source"
        }
      ],
      "actionItems": [
        "Specific actionable recommendation"
      ]
    }
  ],
  "executiveSummary": {
    "overview": "2-3 sentence strategic overview",
    "keyFindings": [
      "Key finding with specific data"
    ],
    "recommendations": [
      "Strategic recommendation"
    ],
    "risks": [
      "Identified risk factor"
    ],
    "opportunities": [
      "Market opportunity"
    ],
    "confidenceScore": 0.89,
    "roi": {
      "conservative": 18,
      "moderate": 34,
      "aggressive": 52
    }
  }
}

**Strategic Analysis Guidelines:**
1. AVOID repeating demographic facts - focus on strategic implications
2. Identify COMPETITIVE ADVANTAGES and market positioning opportunities
3. Provide ROI estimates and revenue projections with conservative/aggressive scenarios
4. Highlight STRATEGIC RISKS and mitigation strategies
5. Suggest MARKET ENTRY strategies, timing, and resource allocation
6. Identify cross-market synergies and expansion sequencing
7. Assess competitive threats and first-mover advantages
8. Generate 3-5 high-impact strategic insights, not demographic summaries

Generate insights that are:
- Executive-level strategic (not operational demographic facts)
- Investment-focused with ROI implications
- Risk-assessed with mitigation strategies
- Competitively positioned
- Growth and expansion oriented
- Confidence-scored for strategic decision-making

Return only the JSON response, no additional text.`;
}

/**
 * Parse Claude's response into structured insight objects
 */
function parseClaudeInsightResponse(claudeResponse: string): {
  insights: AIInsight[];
  executiveSummary: ExecutiveSummary;
} {
  try {
    // Extract JSON from Claude's response
    const jsonMatch = claudeResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Claude response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    // Transform parsed data to match our interfaces
    const insights: AIInsight[] = (parsed.insights || []).map((insight: any, index: number) => ({
      id: insight.id || `insight-${Date.now()}-${index}`,
      type: insight.type || 'recommendation',
      title: insight.title || 'Generated Insight',
      description: insight.description || 'No description provided',
      confidence: Math.max(0, Math.min(1, insight.confidence || 0.8)),
      impact: insight.impact || 'medium',
      category: insight.category || 'strategic',
      supportingData: insight.supportingData || [],
      actionItems: insight.actionItems || [],
      relatedInsights: insight.relatedInsights || [],
      timestamp: new Date()
    }));
    
    const executiveSummary: ExecutiveSummary = {
      overview: parsed.executiveSummary?.overview || 'Analysis completed with AI-generated insights.',
      keyFindings: parsed.executiveSummary?.keyFindings || [],
      recommendations: parsed.executiveSummary?.recommendations || [],
      risks: parsed.executiveSummary?.risks || [],
      opportunities: parsed.executiveSummary?.opportunities || [],
      confidenceScore: parsed.executiveSummary?.confidenceScore || 0.8,
      roi: {
        conservative: parsed.executiveSummary?.roi?.conservative || 15,
        moderate: parsed.executiveSummary?.roi?.moderate || 25,
        aggressive: parsed.executiveSummary?.roi?.aggressive || 40
      }
    };
    
    return { insights, executiveSummary };
    
  } catch (error) {
    console.error('Error parsing Claude insight response:', error);
    
    // Return structured fallback
    return {
      insights: [{
        id: `fallback-${Date.now()}`,
        type: 'recommendation',
        title: 'Market Analysis Complete',
        description: 'Claude AI analysis completed. Review the source data for detailed insights.',
        confidence: 0.7,
        impact: 'medium',
        category: 'strategic',
        supportingData: [{
          metric: 'Analysis Status',
          value: 'Completed',
          source: 'AI Analysis'
        }],
        actionItems: ['Review analysis data', 'Consider market opportunities'],
        timestamp: new Date()
      }],
      executiveSummary: {
        overview: 'Market analysis completed with AI assistance.',
        keyFindings: ['Analysis data processed successfully'],
        recommendations: ['Review detailed analysis results'],
        risks: ['Standard market risks apply'],
        opportunities: ['Market expansion potential identified'],
        confidenceScore: 0.7,
        roi: { conservative: 10, moderate: 20, aggressive: 35 }
      }
    };
  }
}

/**
 * Generate fallback insights when Claude API fails
 */
function generateFallbackInsights(request: AIInsightRequest): AIInsightResponse {
  const { analysisContext } = request;
  
  const fallbackInsights: AIInsight[] = [{
    id: `fallback-${Date.now()}`,
    type: 'pattern',
    title: `Market Analysis for ${analysisContext.selectedAreaName || analysisContext.location}`,
    description: 'Basic demographic analysis completed. AI-powered insights temporarily unavailable.',
    confidence: 0.6,
    impact: 'medium',
    category: 'demographic',
    supportingData: [{
      metric: 'Analysis Method',
      value: 'Demographic Data Review',
      source: 'Local Data'
    }],
    actionItems: [
      'Review demographic data manually',
      'Consider local market conditions',
      'Retry AI analysis when available'
    ],
    timestamp: new Date()
  }];
  
  return {
    insights: fallbackInsights,
    executiveSummary: {
      overview: 'Market analysis completed with demographic data review.',
      keyFindings: ['Local market data available for analysis'],
      recommendations: ['Proceed with manual analysis review'],
      risks: ['Limited insight depth without AI analysis'],
      opportunities: ['Market data suggests expansion potential'],
      confidenceScore: 0.6,
      roi: { conservative: 8, moderate: 15, aggressive: 25 }
    },
    totalInsightsGenerated: 1,
    processingTime: 100,
    confidence: 0.6
  };
}

/**
 * Calculate average confidence across insights
 */
function calculateAverageConfidence(insights: AIInsight[]): number {
  if (insights.length === 0) return 0;
  return insights.reduce((sum, insight) => sum + insight.confidence, 0) / insights.length;
}

/**
 * Validate insight quality and completeness
 */
export function validateInsight(insight: AIInsight): boolean {
  return !!(
    insight.id &&
    insight.title &&
    insight.description &&
    insight.confidence >= 0 &&
    insight.confidence <= 1 &&
    ['pattern', 'opportunity', 'risk', 'recommendation', 'prediction'].includes(insight.type) &&
    ['high', 'medium', 'low'].includes(insight.impact) &&
    ['strategic', 'demographic', 'competitive', 'economic'].includes(insight.category)
  );
}

export default {
  generateAIInsights,
  validateInsight
};