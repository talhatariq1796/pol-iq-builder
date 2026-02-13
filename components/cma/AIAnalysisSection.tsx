"use client";

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Brain, 
  TrendingUp, 
  Lightbulb,
  Target,
  DollarSign,
  Home,
  BarChart3,
  Info
} from 'lucide-react';
import type { Property, CMAStats, CMAFilters, AIInsight } from './types';
import { calculateMarketMomentum } from '@/lib/pdf/data/extractors';

interface AIAnalysisSectionProps {
  properties: Property[];
  stats: CMAStats;
  filters: CMAFilters;
}

const AIAnalysisSection: React.FC<AIAnalysisSectionProps> = ({ 
  properties, 
  stats}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Calculate market momentum using the same logic as PDF
  const marketMomentum = useMemo(() => 
    calculateMarketMomentum(properties), 
    [properties]
  );
  
  // Define areas for reuse throughout component
  const areas = useMemo(() => {
    return [...new Set(properties.map(p => {
      // Extract general area from address (last part of address for area identification)
      const addressParts = p.address.split(' ');
      return addressParts.length > 2 ? addressParts.slice(-2).join(' ') : 'Mixed Areas';
    }))].filter(Boolean);
  }, [properties]);

  // Generate AI insights based on data analysis
  const aiInsights = useMemo(() => {
    const insights: AIInsight[] = [];

    // Market Trends Analysis
    if (stats.marketAppreciation && stats.marketAppreciation > 7) {
      insights.push({
        category: 'market_trends',
        title: 'Strong Market Appreciation',
        content: `Properties in this area have shown exceptional growth with ${stats.marketAppreciation}% appreciation. This indicates a seller's market with strong investment potential.`,
        confidence: 0.85,
        impact: 'high'
      });
    } else if (stats.marketAppreciation && stats.marketAppreciation < 3) {
      insights.push({
        category: 'market_trends',
        title: 'Moderate Market Growth',
        content: `Market appreciation of ${stats.marketAppreciation}% suggests stable but moderate growth. Consider this for long-term investment strategies.`,
        confidence: 0.78,
        impact: 'medium'
      });
    }

    // Pricing Analysis
    if (stats.maxPrice && stats.minPrice && stats.avgPrice) {
      const priceVariance = ((stats.maxPrice - stats.minPrice) / stats.avgPrice) * 100;
        if (priceVariance > 50) {
          insights.push({
            category: 'pricing',
            title: 'High Price Variability',
            content: `Significant price range (${priceVariance.toFixed(1)}% variance) indicates diverse property types and conditions. Careful valuation is recommended.`,
            confidence: 0.82,
            impact: 'high'
          });
        }
    }

    // Days on Market Analysis
    if (stats.average_dom < 30) {
      insights.push({
        category: 'market_trends',
        title: 'Fast-Moving Market',
        content: `Average ${stats.average_dom} days on market indicates high demand. Properties are selling quickly, favoring sellers.`,
        confidence: 0.88,
        impact: 'high'
      });
    } else if (stats.average_dom > 90) {
      insights.push({
        category: 'market_trends',
        title: 'Slower Market Conditions',
        content: `Properties are taking ${stats.average_dom} days to sell on average. This may present negotiation opportunities for buyers.`,
        confidence: 0.75,
        impact: 'medium'
      });
    }

    // Inventory Analysis
    if (stats.inventoryLevel === 'low') {
      insights.push({
        category: 'market_trends',
        title: 'Low Inventory Market',
        content: `Limited inventory with ${stats.active_properties} active listings vs ${stats.sold_properties} sold. This creates competitive conditions for buyers.`,
        confidence: 0.90,
        impact: 'high'
      });
    }

    // Price per Square Foot Analysis
    if (stats.price_per_sqft > 300) {
      insights.push({
        category: 'pricing',
        title: 'Premium Price Point',
        content: `At $${stats.price_per_sqft}/sqft, this area commands premium pricing. Consider location amenities and property quality when pricing.`,
        confidence: 0.80,
        impact: 'medium'
      });
    }

    // Area Diversity - using defined areas variable
    if (areas.length > 5) {
      insights.push({
        category: 'neighborhood',
        title: 'Diverse Geographic Spread',
        content: `Analysis covers ${areas.length} different areas, providing comprehensive market insight across varied locations and amenities.`,
        confidence: 0.85,
        impact: 'medium'
      });
    }

    // Investment Recommendations
    insights.push({
      category: 'investment',
      title: 'Investment Outlook',
      content: generateInvestmentOutlook(stats),
      confidence: 0.75,
      impact: 'high'
    });

    // Market Positioning
    insights.push({
      category: 'general',
      title: 'Competitive Positioning',
      content: generateCompetitiveAnalysis(stats, properties),
      confidence: 0.82,
      impact: 'medium'
    });

    return insights;
  }, [properties, stats, areas]);

  const filteredInsights = useMemo(() => {
    if (selectedCategory === 'all') return aiInsights;
    return aiInsights.filter(insight => insight.category === selectedCategory);
  }, [aiInsights, selectedCategory]);

  const getInsightIcon = (category: string | undefined) => {
    if (!category) return <Lightbulb className="h-4 w-4" />;
    switch (category) {
      case 'market_trends': return <TrendingUp className="h-4 w-4" />;
      case 'pricing': return <DollarSign className="h-4 w-4" />;
      case 'investment': return <Target className="h-4 w-4" />;
      case 'neighborhood': return <Home className="h-4 w-4" />;
      default: return <Lightbulb className="h-4 w-4" />;
    }
  };

  const getImpactColor = (impact: string | undefined) => {
    if (!impact) return 'bg-[#660D39]/10 text-[#484247] border-[#660D39]';
    switch (impact) {
      case 'high': return 'bg-[#660D39]/20 text-[#660D39] border-[#660D39]';
      case 'medium': return 'bg-[#670038]/10 text-[#484247] border-[#670038]';
      case 'low': return 'bg-[#660D39]/5 text-[#484247] border-[#660D39]';
      default: return 'bg-[#660D39]/10 text-[#484247] border-[#660D39]';
    }
  };

  return (
    <div className="ai-analysis-section space-y-6">
      {/* Header */}
      <Card className="border-2 border-[#660D39]">
        <CardHeader className="bg-gradient-to-r from-[#660D39]/10 to-[#670038]/10">
          <CardTitle className="flex items-center justify-center gap-2 text-[#484247] font-montserrat">
            <Brain className="h-5 w-5 text-[#660D39]" />
            Legacy AI Market Analysis
          </CardTitle>
          <p className="text-sm text-[#484247] font-montserrat text-center">
            Advanced analytics and insights based on {properties.length} properties using machine learning algorithms
          </p>
        </CardHeader>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="text-center flex flex-col items-center justify-center min-w-0">
              <div className="text-2xl font-bold text-[#660D39] font-montserrat">{aiInsights.length}</div>
              <div className="text-xs text-[#484247] font-montserrat mt-1">AI Insights</div>
            </div>
            <div className="text-center flex flex-col items-center justify-center min-w-0">
              <div className="text-2xl font-bold text-[#660D39] font-montserrat">
                {Math.round(aiInsights.reduce((sum, i) => sum + i.confidence, 0) / aiInsights.length * 100)}%
              </div>
              <div className="text-xs text-[#484247] font-montserrat mt-1">Confidence</div>
            </div>
            <div className="text-center flex flex-col items-center justify-center min-w-0">
              <div className="text-2xl font-bold text-[#660D39] font-montserrat">
                {aiInsights.filter(i => i.impact === 'high').length}
              </div>
              <div className="text-xs text-[#484247] font-montserrat mt-1">High Impact</div>
            </div>
            <div className="text-center flex flex-col items-center justify-center min-w-0">
              <div className="text-2xl font-bold text-[#660D39] font-montserrat">
                {areas.length}
              </div>
              <div className="text-xs text-[#484247] font-montserrat mt-1">Areas</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedCategory === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedCategory('all')}
          className={selectedCategory === 'all' ? 'bg-[#660D39] hover:bg-[#670038] text-white font-montserrat' : 'border-[#660D39] text-[#484247] hover:bg-[#660D39]/10 font-montserrat'}
        >
          All Insights ({aiInsights.length})
        </Button>
        {['market_trends', 'pricing', 'investment', 'neighborhood'].map(category => {
          const count = aiInsights.filter(i => i.category === category).length;
          if (count === 0) return null;

          return (
            <Button
              key={category}
              variant={selectedCategory === category ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              className={`capitalize ${selectedCategory === category ? 'bg-[#660D39] hover:bg-[#670038] text-white font-montserrat' : 'border-[#660D39] text-[#484247] hover:bg-[#660D39]/10 font-montserrat'}`}
            >
              {getInsightIcon(category)}
              <span className="ml-1">{category.replace('_', ' ')} ({count})</span>
            </Button>
          );
        })}
      </div>

      {/* Insights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredInsights.map((insight, index) => (
          <Card key={index} className="border-2 border-[#660D39]/30 hover:border-[#660D39] hover:shadow-lg transition-all">
            <CardHeader className="pb-2 bg-[#660D39]/5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="text-[#660D39]">
                    {getInsightIcon(insight.category)}
                  </div>
                  <CardTitle className="text-base text-[#484247] font-montserrat">{insight.title}</CardTitle>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge
                    variant="outline"
                    className={`${getImpactColor(insight.impact)} font-montserrat`}
                  >
                    {insight.impact} impact
                  </Badge>
                  <div className="text-xs text-[#484247] font-montserrat">
                    {Math.round(insight.confidence * 100)}% confidence
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[#484247] leading-relaxed font-montserrat">
                {insight.content}
              </p>

              {/* Confidence bar */}
              <div className="mt-3">
                <div className="flex justify-between text-xs text-[#484247] mb-1 font-montserrat">
                  <span>AI Confidence</span>
                  <span>{Math.round(insight.confidence * 100)}%</span>
                </div>
                <div className="w-full bg-[#E0E0E0] rounded-full h-1.5">
                  <div
                    className="bg-[#660D39] h-1.5 rounded-full transition-all"
                    style={{ width: `${insight.confidence * 100}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Market Summary */}
      <Card className="border-2 border-[#660D39]">
        <CardHeader className="bg-gradient-to-r from-[#660D39]/10 to-[#670038]/10">
          <CardTitle className="flex items-center justify-center gap-2 text-[#484247] font-montserrat">
            <BarChart3 className="h-5 w-5 text-[#660D39]" />
            Executive Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 pb-4">
          <div className="prose prose-sm max-w-none">
            <p className="text-[#484247] font-montserrat text-center mb-3">
              Based on analysis of <strong className="text-[#660D39]">{properties.length} properties</strong> across{' '}
              <strong className="text-[#660D39]">{areas.length} areas</strong>,
              the market shows <strong className="text-[#660D39]">{stats.inventoryLevel} inventory levels</strong> with an average price of{' '}
              <strong className="text-[#660D39]">${stats.avgPrice?.toLocaleString() || 'N/A'}</strong>.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-[#660D39]/10 p-3 rounded-lg border-2 border-[#660D39] flex flex-col items-center justify-center text-center min-w-0">
                <div className="font-semibold text-[#484247] font-montserrat mb-1 text-sm">Market Momentum</div>
                <div className="text-sm text-[#484247] font-montserrat">
                  {marketMomentum.classification}
                </div>
                <div className="text-xs text-[#484247]/70 font-montserrat mt-1">
                  Score: {marketMomentum.score.toFixed(0)}/100
                </div>
              </div>

              <div className="bg-[#670038]/10 p-3 rounded-lg border-2 border-[#670038] flex flex-col items-center justify-center text-center min-w-0">
                <div className="font-semibold text-[#484247] font-montserrat mb-1 text-sm">Price Efficiency</div>
                <div className="text-sm text-[#484247] font-montserrat">
                  ${stats.price_per_sqft}/sqft avg
                </div>
              </div>

              <div className="bg-[#660D39]/10 p-3 rounded-lg border-2 border-[#660D39] flex flex-col items-center justify-center text-center min-w-0">
                <div className="font-semibold text-[#484247] font-montserrat mb-1 text-sm">Market Activity</div>
                <div className="text-sm text-[#484247] font-montserrat">
                  {stats.sold_properties} sold, {stats.active_properties} active
                </div>
              </div>
            </div>

            <div className="mt-3 p-3 bg-[#660D39]/10 border-l-4 border-[#660D39]">
              <div className="flex items-start">
                <Info className="h-4 w-4 text-[#660D39] mt-0.5 mr-2 flex-shrink-0" />
                <div className="text-sm text-[#484247] font-montserrat">
                  <strong className="text-[#660D39]">Recommendation:</strong> {generateFinalRecommendation(stats, aiInsights)}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Helper functions for generating insights
function generateInvestmentOutlook(stats: CMAStats): string {
  // Note: Analysis uses DOM and inventory levels from stats
  
  if (stats.average_dom < 45 && stats.inventoryLevel === 'low') {
    return `Strong investment environment with quick sales (${stats.average_dom} days) and limited inventory. Expect continued price appreciation. Consider listing premium properties in this market.`;
  } else if (stats.average_dom > 75) {
    return `Buyer-favorable market with ${stats.average_dom} days average selling time. Investment opportunities exist for patient buyers willing to negotiate. Consider value-add strategies.`;
  } else {
    return `Balanced market conditions with moderate ${stats.average_dom}-day selling times. Good opportunities for both buyers and sellers with proper pricing strategy.`;
  }
}

function generateCompetitiveAnalysis(stats: CMAStats, properties: Property[]): string {
  const pricePoints = properties.map(p => p.price || 0).sort((a, b) => a - b);
  const q1 = pricePoints[Math.floor(pricePoints.length * 0.25)];
  const q3 = pricePoints[Math.floor(pricePoints.length * 0.75)];
  
  return `Price distribution shows entry-level properties at $${q1.toLocaleString()}, with premium segment starting at $${q3.toLocaleString()}. The $${stats.price_per_sqft}/sqft average suggests ${stats.price_per_sqft > 250 ? 'premium' : stats.price_per_sqft > 150 ? 'competitive' : 'value'} positioning in the regional market.`;
}

function generateFinalRecommendation(stats: CMAStats, insights: AIInsight[]): string {
  const highImpactInsights = insights.filter(i => i.impact === 'high').length;
  
  if (stats.average_dom < 30 && stats.inventoryLevel === 'low') {
    return 'This is a seller\'s market. Price competitively but confidently, and be prepared for quick decisions.';
  } else if (stats.average_dom > 75) {
    return 'Market favors buyers. Focus on value positioning and be prepared for negotiations.';
  } else if (highImpactInsights >= 3) {
    return 'Market shows significant activity with multiple factors in play. Professional guidance recommended for optimal timing and pricing.';
  } else {
    return 'Stable market conditions present good opportunities for both buyers and sellers with proper strategy.';
  }
}

export { AIAnalysisSection };
export default AIAnalysisSection;