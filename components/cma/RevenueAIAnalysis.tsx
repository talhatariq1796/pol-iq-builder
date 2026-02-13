/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Brain, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Lightbulb,
  DollarSign,
  Building2,
  RefreshCw
} from 'lucide-react';
import type { CMAProperty } from './types';
import { calculateRevenueMetrics } from './RevenuePropertyMetrics';

interface RevenueAIAnalysisProps {
  properties: CMAProperty[];
  reportType: 'sold' | 'active' | 'both';
  selectedArea?: {
    displayName: string;
  };
}

interface InvestmentInsight {
  id: string;
  type: 'opportunity' | 'warning' | 'trend' | 'recommendation';
  title: string;
  content: string;
  confidence: number;
  impact: 'high' | 'medium' | 'low';
}

/**
 * Revenue Property AI Analysis Component
 * Provides investment-focused AI insights for revenue properties
 */
export const RevenueAIAnalysis: React.FC<RevenueAIAnalysisProps> = ({
  properties,
  reportType,
  selectedArea
}) => {
  const [insights, setInsights] = useState<InvestmentInsight[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    generateInvestmentInsights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [properties, reportType]);

  const generateInvestmentInsights = async () => {
    setIsGenerating(true);
    try {
      // Simulate AI analysis delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const newInsights = generateContextualInvestmentInsights();
      setInsights(newInsights);
    } catch (error) {
      console.error('Error generating investment insights:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateContextualInvestmentInsights = (): InvestmentInsight[] => {
    const insights: InvestmentInsight[] = [];
    const metrics = calculateRevenueMetrics(properties);

    if (metrics.totalCount === 0) {
      return [{
        id: 'no-data',
        type: 'warning',
        title: 'Insufficient Data',
        content: 'No revenue properties with investment metrics found in this area. Consider expanding your search radius or adjusting filters.',
        confidence: 100,
        impact: 'high'
      }];
    }

    // GIM Analysis
    if (metrics.avgGIM > 0) {
      const gimTrend = metrics.avgGIM < 10 ? 'favorable' : metrics.avgGIM < 15 ? 'moderate' : 'premium';
      insights.push({
        id: 'gim-analysis',
        type: gimTrend === 'favorable' ? 'opportunity' : gimTrend === 'moderate' ? 'trend' : 'warning',
        title: 'Gross Income Multiplier Trend',
        content: `The average GIM of ${metrics.avgGIM.toFixed(1)}x indicates ${gimTrend} pricing. ${
          gimTrend === 'favorable' 
            ? 'This suggests strong cash flow potential with properties trading at attractive multiples of their gross income.'
            : gimTrend === 'moderate'
            ? 'Properties are moderately priced relative to income, offering balanced investment returns.'
            : 'Premium pricing reflects strong market demand but may limit cash flow opportunities. Focus on properties with value-add potential.'
        } GIM range: ${metrics.gimRange.min.toFixed(1)}x to ${metrics.gimRange.max.toFixed(1)}x.`,
        confidence: 85,
        impact: 'high'
      });
    }

    // Cap Rate Analysis
    if (metrics.avgCapRate > 0) {
      const capRateCategory = metrics.avgCapRate > 6 ? 'strong' : metrics.avgCapRate > 4 ? 'moderate' : 'conservative';
      insights.push({
        id: 'cap-rate',
        type: capRateCategory === 'strong' ? 'opportunity' : 'trend',
        title: 'Investment Return Assessment',
        content: `Estimated cap rate of ${metrics.avgCapRate.toFixed(1)}% suggests ${capRateCategory} investment returns. ${
          capRateCategory === 'strong'
            ? 'This area offers attractive income yields for cash flow-focused investors.'
            : capRateCategory === 'moderate'
            ? 'Returns are typical of stable markets with balanced income and appreciation potential.'
            : 'Lower cap rates reflect a mature market where appreciation may drive returns more than cash flow.'
        } Consider your investment strategy when evaluating opportunities.`,
        confidence: 80,
        impact: 'high'
      });
    }

    // PGI Analysis
    if (metrics.avgPGI > 0) {
      const pgiVolatility = ((metrics.pgiRange.max - metrics.pgiRange.min) / metrics.avgPGI) * 100;
      insights.push({
        id: 'pgi-distribution',
        type: 'trend',
        title: 'Income Potential Distribution',
        content: `Average gross income (PGI) of ${Math.round(metrics.avgPGI).toLocaleString()}/year with ${pgiVolatility < 50 ? 'consistent' : 'varied'} income levels across properties (${pgiVolatility.toFixed(0)}% range). ${
          pgiVolatility < 50
            ? 'The consistent income levels suggest stable rental markets with predictable cash flows.'
            : 'The wide income distribution offers opportunities for investors at different price points and return expectations.'
        } Median PGI: ${Math.round(metrics.medianPGI).toLocaleString()}/year.`,
        confidence: 90,
        impact: 'medium'
      });
    }

    // Price vs Assessment Analysis
    if (metrics.avgPriceVsAssessment > 0) {
      const valuationInsight = metrics.avgPriceVsAssessment < 90 ? 'significant value' : 
                               metrics.avgPriceVsAssessment < 100 ? 'value' : 
                               metrics.avgPriceVsAssessment < 110 ? 'fair' : 'premium';
      insights.push({
        id: 'price-assessment',
        type: valuationInsight === 'significant value' || valuationInsight === 'value' ? 'opportunity' : 'recommendation',
        title: 'Market Valuation Assessment',
        content: `Properties trading at ${metrics.avgPriceVsAssessment.toFixed(0)}% of municipal assessment indicate ${valuationInsight} pricing. ${
          valuationInsight === 'significant value'
            ? 'Strong value opportunities exist with properties selling below assessed values. This may indicate distressed sales, motivated sellers, or assessment lag in a declining market.'
            : valuationInsight === 'value'
            ? 'Properties are slightly undervalued relative to assessments, offering potential upside as market prices align with assessed values.'
            : valuationInsight === 'fair'
            ? 'Pricing aligns well with municipal assessments, suggesting efficient market pricing.'
            : 'Premium pricing above assessments reflects strong demand and competitive market conditions. Focus on properties with exceptional income potential to justify premiums.'
        }`,
        confidence: 85,
        impact: 'high'
      });
    }

    // Cash Flow Insight
    if (metrics.avgCashFlow > 0) {
      insights.push({
        id: 'cash-flow',
        type: 'recommendation',
        title: 'Cash Flow Projection',
        content: `Estimated average cash flow of ${Math.round(metrics.avgCashFlow).toLocaleString()}/year after operating expenses and debt service (simplified calculation). ${
          metrics.avgCashFlow > 20000
            ? 'Strong cash flow potential makes this market attractive for income-focused investors.'
            : metrics.avgCashFlow > 10000
            ? 'Moderate cash flow opportunities suitable for balanced investment strategies.'
            : 'Lower cash flow projections suggest appreciation-driven market. Consider value-add strategies to enhance returns.'
        } Verify actual operating expenses and financing terms for precise calculations.`,
        confidence: 75,
        impact: 'medium'
      });
    }

    // Market Activity (Sold vs Active)
    if (reportType === 'both') {
      const soldProperties = properties.filter(p => (p as any).status?.toLowerCase() === 'sold' || (p as any).st === 'SO');
      const activeProperties = properties.filter(p => (p as any).status?.toLowerCase() === 'active' || (p as any).st === 'AC');
      
      if (soldProperties.length > 0 && activeProperties.length > 0) {
        const turnoverRate = (soldProperties.length / (soldProperties.length + activeProperties.length)) * 100;
        insights.push({
          id: 'market-activity',
          type: turnoverRate > 60 ? 'opportunity' : turnoverRate < 40 ? 'warning' : 'trend',
          title: 'Market Liquidity Assessment',
          content: `Market shows ${turnoverRate.toFixed(0)}% turnover rate (${soldProperties.length} sold vs ${activeProperties.length} active). ${
            turnoverRate > 60
              ? 'High turnover indicates strong buyer demand and quick sales, favorable for sellers and investors looking to exit.'
              : turnoverRate < 40
              ? 'Lower turnover suggests longer market times. Buyers may have more negotiating power, but sellers should price competitively.'
              : 'Balanced market activity with typical turnover rates. Neither buyers nor sellers have significant leverage.'
          }`,
          confidence: 80,
          impact: 'medium'
        });
      }
    }

    return insights;
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'opportunity':
        return <TrendingUp className="h-5 w-5 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-orange-600" />;
      case 'trend':
        return <DollarSign className="h-5 w-5 text-blue-600" />;
      case 'recommendation':
        return <Lightbulb className="h-5 w-5 text-purple-600" />;
      default:
        return <CheckCircle className="h-5 w-5 text-gray-600" />;
    }
  };

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'opportunity':
        return 'bg-green-50 border-green-200';
      case 'warning':
        return 'bg-orange-50 border-orange-200';
      case 'trend':
        return 'bg-blue-50 border-blue-200';
      case 'recommendation':
        return 'bg-purple-50 border-purple-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-[#660D39] font-montserrat">
            <Brain className="h-5 w-5" />
            Investment Analysis Insights
            {selectedArea && (
              <span className="text-sm font-normal text-[#484247]/70">
                • {selectedArea.displayName}
              </span>
            )}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={generateInvestmentInsights}
            disabled={isGenerating}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
            {isGenerating ? 'Analyzing...' : 'Refresh'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isGenerating ? (
          <div className="flex items-center justify-center py-8">
            <div className="space-y-2 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#660D39] mx-auto"></div>
              <p className="text-sm text-[#484247]/70">Generating investment insights...</p>
            </div>
          </div>
        ) : (
          <>
            {insights.map((insight) => (
              <div
                key={insight.id}
                className={`flex items-start gap-3 p-4 rounded-lg border ${getInsightColor(insight.type)}`}
              >
                <div className="flex-shrink-0 mt-1">
                  {getInsightIcon(insight.type)}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-semibold text-[#484247] font-montserrat">
                      {insight.title}
                    </h4>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {insight.confidence}% Confidence
                      </Badge>
                      <Badge 
                        variant={insight.impact === 'high' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {insight.impact.charAt(0).toUpperCase() + insight.impact.slice(1)} Impact
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-[#484247]/70 leading-relaxed">
                    {insight.content}
                  </p>
                </div>
              </div>
            ))}

            {insights.length === 0 && (
              <div className="text-center py-8">
                <Building2 className="h-12 w-12 text-[#484247]/30 mx-auto mb-3" />
                <p className="text-sm text-[#484247]/70">
                  No investment insights available. Try adjusting your filters or expanding your search area.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
