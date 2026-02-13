/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Lightbulb,
  BarChart3,
  RefreshCw,
  DollarSign,
  Calendar
} from 'lucide-react';
import { ComprehensiveStats } from '@/lib/utils/cmaStatistics';
import { CMAProperty, calculateTimeOnMarket } from './types';
import { calculateMarketMomentum } from '@/lib/pdf/data/extractors';
import { estimateCondoPrice, formatPriceEstimate } from '@/lib/analysis/calculations/condoPriceEstimator';

interface EnhancedAIAnalysisProps {
  properties: CMAProperty[];
  stats: ComprehensiveStats;
  reportType: 'sold' | 'active' | 'both';
  selectedArea?: {
    displayName: string;
  };
  condoSquareFootage?: number | null; // User-entered or property sqft for condo price estimation
}

interface AIInsight {
  id: string;
  type: 'trend' | 'opportunity' | 'warning' | 'recommendation';
  title: string;
  content: string;
  confidence: number;
  impact: 'high' | 'medium' | 'low';
  data?: any;
}

const EnhancedAIAnalysis: React.FC<EnhancedAIAnalysisProps> = ({
  properties,
  stats,
  reportType,
  selectedArea,
  condoSquareFootage
}) => {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Filter and enrich properties based on report type
  const filteredProperties = useMemo(() => {
    // First, enrich all properties with calculated time_on_market if missing
    const enrichedProperties = properties.map(p => {
      if (!p.time_on_market || p.time_on_market <= 0) {
        const calculatedDOM = calculateTimeOnMarket(p);
        return { ...p, time_on_market: calculatedDOM };
      }
      return p;
    });

    // Then filter by report type
    if (reportType === 'sold') {
      return enrichedProperties.filter(p => p.status === 'sold' || p.st?.toUpperCase() === 'SO');
    } else if (reportType === 'active') {
      return enrichedProperties.filter(p => p.status === 'active' || p.st?.toUpperCase() === 'AC');
    }
    return enrichedProperties; // 'both' returns all
  }, [properties, reportType]);

  useEffect(() => {
    generateAIInsights();
  }, [filteredProperties, stats, reportType]);

  const generateAIInsights = async () => {
    setIsGenerating(true);
    try {
      // Simulate AI analysis delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      const newInsights = generateContextualInsights();
      setInsights(newInsights);
    } catch (error) {
      console.error('Error generating AI insights:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateContextualInsights = (): AIInsight[] => {
    const insights: AIInsight[] = [];

    // Calculate market momentum using FILTERED properties with calculated time_on_market
    const marketMomentum = calculateMarketMomentum(filteredProperties);
    
    // Price trend analysis
    const monthlyAppreciation = stats.monthly.avgPrice > 0 && stats.annual.avgPrice > 0 
      ? ((stats.monthly.avgPrice - stats.annual.avgPrice) / stats.annual.avgPrice) * 100
      : 0;

    // Count filtered properties by status for accurate reporting
    const filteredSoldCount = filteredProperties.filter(p => p.status === 'sold' || p.st?.toUpperCase() === 'SO').length;
    const filteredActiveCount = filteredProperties.filter(p => p.status === 'active' || p.st?.toUpperCase() === 'AC').length;

    if (reportType === 'sold' || reportType === 'both') {
      // Sold properties insights - use filtered count
      const soldPropertyCount = reportType === 'sold' ? filteredProperties.length : filteredSoldCount;
      insights.push({
        id: 'sold-performance',
        type: 'trend',
        title: 'Market Performance Analysis',
        content: `Based on ${soldPropertyCount} sold properties, the market shows ${monthlyAppreciation > 5 ? 'strong appreciation' : monthlyAppreciation > 0 ? 'positive growth' : monthlyAppreciation > -5 ? 'stable conditions' : 'declining values'} with ${monthlyAppreciation > 0 ? '+' : ''}${monthlyAppreciation.toFixed(1)}% price movement. The average sale price of $${stats.soldStats.avgPrice.toLocaleString()} indicates ${stats.soldStats.avgPrice > stats.allTime.avgPrice ? 'above-average' : 'below-average'} market positioning.`,
        confidence: 85,
        impact: 'high',
        data: { appreciation: monthlyAppreciation, avgPrice: stats.soldStats.avgPrice, propertyCount: soldPropertyCount }
      });

      // Market Momentum - show DOM data for debugging
      const domData = marketMomentum.components.daysOnMarket;
      const domDescription = domData.current > 0
        ? `Properties are selling ${Math.abs(domData.change).toFixed(1)}% ${domData.trend === 'faster' ? 'faster' : domData.trend === 'slower' ? 'slower' : 'at a similar pace'} (avg ${domData.current} days vs ${domData.previous} days previously).`
        : `Days on market data is currently being calculated.`;

      insights.push({
        id: 'market-momentum',
        type: marketMomentum.classification === 'Accelerating' ? 'opportunity' : marketMomentum.classification === 'Decelerating' ? 'warning' : 'recommendation',
        title: 'Market Momentum Assessment',
        content: `The market is showing ${marketMomentum.classification.toLowerCase()} momentum (score: ${marketMomentum.score.toFixed(0)}/100). ${domDescription} Prices are ${marketMomentum.components.priceVelocity.trend}, and inventory turnover is ${marketMomentum.components.inventoryTurnover.trend} with a ${marketMomentum.components.inventoryTurnover.ratio.toFixed(2)}x ratio. This indicates ${marketMomentum.classification === 'Accelerating' ? 'strong buyer demand and competitive conditions' : marketMomentum.classification === 'Decelerating' ? 'softer market conditions with more negotiation opportunities' : 'stable market conditions with balanced supply and demand'}.`,
        confidence: 90,
        impact: 'high',
        data: {
          momentum: marketMomentum.classification,
          score: marketMomentum.score,
          domCurrent: domData.current,
          domPrevious: domData.previous,
          domChange: domData.change,
          inventoryRatio: marketMomentum.components.inventoryTurnover.ratio
        }
      });
    }

    if (reportType === 'active' || reportType === 'both') {
      // Active listings insights - use filtered count
      const activePropertyCount = reportType === 'active' ? filteredProperties.length : filteredActiveCount;
      const totalPropertyCount = stats.activeStats.count + stats.soldStats.count;
      const activePercentage = totalPropertyCount > 0 ? (stats.activeStats.count / totalPropertyCount * 100) : 0;

      insights.push({
        id: 'inventory-analysis',
        type: stats.activeStats.count > stats.soldStats.count ? 'warning' : 'opportunity',
        title: 'Current Inventory Assessment',
        content: `The market currently has ${activePropertyCount} active listings with an average asking price of $${stats.activeStats.avgPrice.toLocaleString()}. This represents ${activePercentage.toFixed(1)}% of total market activity. ${stats.activeStats.count > stats.soldStats.count ? 'High inventory levels suggest buyer market conditions with more negotiation opportunities.' : 'Limited inventory indicates seller market conditions with competitive pricing.'}`,
        confidence: 88,
        impact: 'high',
        data: { activeCount: activePropertyCount, percentage: activePercentage }
      });

      insights.push({
        id: 'pricing-strategy',
        type: 'recommendation',
        title: 'Optimal Pricing Strategy',
        content: `Based on current active listings, properties priced between $${stats.activeStats.medianPrice.toLocaleString()} (median) and $${(stats.activeStats.avgPrice * 1.1).toLocaleString()} (+10% above average) are likely to see optimal market response. The current spread of $${(stats.activeStats.maxPrice - stats.activeStats.minPrice).toLocaleString()} indicates ${stats.activeStats.maxPrice / stats.activeStats.minPrice > 3 ? 'diverse' : 'focused'} market segments.`,
        confidence: 82,
        impact: 'medium',
        data: { medianPrice: stats.activeStats.medianPrice, suggestedRange: [stats.activeStats.medianPrice, stats.activeStats.avgPrice * 1.1] }
      });
    }

    // Rental analysis
    const rentalYield = stats.allTime.avgRent > 0 ? (stats.allTime.avgRent * 12 / stats.allTime.avgPrice) * 100 : 0;
    insights.push({
      id: 'rental-potential',
      type: rentalYield > 6 ? 'opportunity' : rentalYield > 4 ? 'recommendation' : 'warning',
      title: 'Investment & Rental Potential',
      content: `The estimated rental yield of ${rentalYield.toFixed(2)}% suggests ${rentalYield > 6 ? 'strong investment potential' : rentalYield > 4 ? 'moderate investment appeal' : 'limited rental returns'}. Average estimated rent of $${stats.allTime.avgRent.toLocaleString()}/month positions this market ${rentalYield > 5 ? 'favorably' : 'competitively'} for real estate investors seeking ${rentalYield > 6 ? 'high-yield' : 'stable'} rental income.`,
      confidence: 75,
      impact: 'medium',
      data: { rentalYield, avgRent: stats.allTime.avgRent }
    });

    // Market timing insight - use actual price range from filtered properties
    const priceRange = stats.allTime.maxPrice - stats.allTime.minPrice;
    const priceRangeRatio = stats.allTime.minPrice > 0 ? stats.allTime.maxPrice / stats.allTime.minPrice : 1;
    const priceVarianceDescription = priceRangeRatio > 3 ? 'high' : priceRangeRatio > 2 ? 'moderate' : 'low';

    insights.push({
      id: 'market-timing',
      type: 'recommendation',
      title: 'Market Timing Analysis',
      content: `Current market conditions suggest ${monthlyAppreciation > 3 ? 'favorable timing for sellers, with strong appreciation trends' : monthlyAppreciation < -3 ? 'buyer opportunities, with price adjustments creating value' : 'balanced conditions suitable for both buyers and sellers'}. The ${priceVarianceDescription} price spread of $${priceRange.toLocaleString()} (from $${stats.allTime.minPrice.toLocaleString()} to $${stats.allTime.maxPrice.toLocaleString()}) indicates ${priceVarianceDescription === 'high' ? 'diverse property types and price points' : 'consistent market positioning'}.`,
      confidence: 80,
      impact: 'high',
      data: {
        timing: monthlyAppreciation > 3 ? 'seller' : monthlyAppreciation < -3 ? 'buyer' : 'balanced',
        priceRange: { min: stats.allTime.minPrice, max: stats.allTime.maxPrice, spread: priceRange }
      }
    });

    // Condo price estimation (if condos are in the analysis) - use filtered properties
    const condoProperties = filteredProperties.filter(p => {
      const propType = (p as any).property_type?.toLowerCase() || (p as any).pt?.toLowerCase() || '';
      return propType.includes('condo') || propType.includes('apartment');
    });

    if (condoProperties.length >= 3) {
      // Use user-entered/property sqft if available, otherwise default to 1000 sqft
      const sqftForEstimate = condoSquareFootage && condoSquareFootage > 0 ? condoSquareFootage : 1000;
      const isUserProvided = condoSquareFootage && condoSquareFootage > 0;

      const priceEstimate = estimateCondoPrice(sqftForEstimate, condoProperties);

      if (priceEstimate.comparablesUsed > 0) {
        // Generate different content based on whether sqft was user-provided or default
        const sqftSource = isUserProvided
          ? `your ${sqftForEstimate.toLocaleString()} sqft property`
          : `a typical ${sqftForEstimate.toLocaleString()} sqft condo`;

        const calculationExplanation = isUserProvided
          ? `\n\n**Calculation:** ${sqftForEstimate.toLocaleString()} sqft × $${priceEstimate.avgPricePerSqFt.toFixed(2)}/sqft = $${priceEstimate.estimatedPrice.toLocaleString()}`
          : '';

        // Calculate price per sqft comparison with market average
        const marketAvgPricePerSqft = stats.allTime.pricePerSqft || 0;
        const priceDiffPercent = marketAvgPricePerSqft > 0
          ? ((priceEstimate.avgPricePerSqFt - marketAvgPricePerSqft) / marketAvgPricePerSqft * 100)
          : 0;

        const priceComparisonSentence = marketAvgPricePerSqft > 0
          ? `\n\n**Price Per Sqft Comparison:** Condo comparables at $${priceEstimate.avgPricePerSqFt.toFixed(2)}/sqft are ${Math.abs(priceDiffPercent).toFixed(1)}% ${priceDiffPercent >= 0 ? 'above' : 'below'} the overall market average of $${marketAvgPricePerSqft.toFixed(2)}/sqft. ${priceDiffPercent >= 10 ? 'This premium reflects higher condo demand or superior building quality in this area.' : priceDiffPercent <= -10 ? 'This discount may represent value opportunities or older building stock.' : 'This is consistent with overall market pricing in the area.'}`
          : '';

        insights.push({
          id: 'condo-pricing',
          type: 'recommendation',
          title: isUserProvided ? 'Your Condo Price Estimation' : 'Condo Price Estimation',
          content: `Based on ${priceEstimate.comparablesUsed} comparable sold condos, the average price per square foot is **$${priceEstimate.avgPricePerSqFt.toFixed(2)}/sqft**. For ${sqftSource}, this translates to an estimated price of **$${priceEstimate.estimatedPrice.toLocaleString()}** (${priceEstimate.confidenceLevel} confidence). Price range: $${priceEstimate.priceRange?.min.toLocaleString()} - $${priceEstimate.priceRange?.max.toLocaleString()}.${calculationExplanation}${priceComparisonSentence}\n\nRemember that actual condo prices vary significantly based on floor level, views, building amenities, and renovation quality.`,
          confidence: priceEstimate.confidenceLevel === 'high' ? 85 : priceEstimate.confidenceLevel === 'medium' ? 75 : 65,
          impact: isUserProvided ? 'high' : 'medium',
          data: {
            avgPricePerSqFt: priceEstimate.avgPricePerSqFt,
            estimatedPrice: priceEstimate.estimatedPrice,
            comparablesUsed: priceEstimate.comparablesUsed,
            squareFootageUsed: sqftForEstimate,
            isUserProvided,
            marketAvgPricePerSqft,
            priceDiffPercent: priceDiffPercent.toFixed(1)
          }
        });
      }
    }

    return insights;
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'trend': return <TrendingUp className="h-5 w-5" />;
      case 'opportunity': return <CheckCircle className="h-5 w-5" />;
      case 'warning': return <AlertTriangle className="h-5 w-5" />;
      case 'recommendation': return <Lightbulb className="h-5 w-5" />;
      default: return <Brain className="h-5 w-5" />;
    }
  };

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'trend': return 'blue';
      case 'opportunity': return 'green';
      case 'warning': return 'yellow';
      case 'recommendation': return 'purple';
      default: return 'gray';
    }
  };

  return (
    <div className="space-y-6">
      {/* Analysis Area Info */}
      {selectedArea && (
        <div className="p-4 bg-gradient-to-r from-[#660D39]/10 to-[#670038]/10 border-2 border-[#660D39] rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#484247] font-montserrat">
                <strong>Analysis Area:</strong> {selectedArea.displayName} •
                <strong> Properties:</strong> {properties.length} •
                <strong> Report Focus:</strong> {reportType === 'sold' ? 'Historical Sales' : reportType === 'active' ? 'Current Listings' : 'Complete Market'}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={generateAIInsights}
              disabled={isGenerating}
              className="flex items-center gap-2 bg-[#660D39] text-white hover:bg-[#670038] border-[#660D39] font-montserrat"
            >
              <RefreshCw className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
              {isGenerating ? 'Analyzing...' : 'Refresh Analysis'}
            </Button>
          </div>
        </div>
      )}

      {isGenerating ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-[#660D39] mx-auto mb-4" />
            <p className="text-gray-600 font-montserrat">Generating AI insights based on {reportType} market data...</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {insights.map((insight) => (
            <Card key={insight.id} className="border-2 border-[#660D39]">
              <CardHeader className="pb-3 bg-gradient-to-r from-[#660D39]/10 to-[#670038]/10">
                <CardTitle className="text-base flex items-center gap-2 font-montserrat">
                  <div className="text-[#660D39]">
                    {getInsightIcon(insight.type)}
                  </div>
                  {insight.title}
                  <div className="ml-auto flex items-center gap-2">
                    <Badge variant="outline" className="text-xs bg-[#660D39]/10 text-[#484247] border-[#660D39] font-montserrat">
                      {insight.confidence}% confidence
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-xs bg-[#660D39]/10 text-[#484247] border-[#660D39] font-montserrat"
                    >
                      {insight.impact} impact
                    </Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[#484247] leading-relaxed font-montserrat">{insight.content}</p>
                {insight.data && (
                  <div className="mt-3 p-2 bg-[#660D39]/10 rounded text-xs text-[#484247] font-montserrat">
                    <strong>Key Metrics:</strong> {JSON.stringify(insight.data, null, 0).replace(/[{}]/g, '').replace(/"/g, '')}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {/* Market Summary */}
          <Card className="bg-gradient-to-r from-[#660D39]/5 to-[#670038]/10 border-2 border-[#660D39]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#484247] font-montserrat">
                <BarChart3 className="h-5 w-5 text-[#660D39]" />
                AI Market Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-[#660D39]" />
                  <div>
                    <div className="font-semibold text-[#484247] font-montserrat">Price Trend</div>
                    <div className="text-[#484247] font-montserrat">
                      {stats.monthly.avgPrice > stats.annual.avgPrice ? 'Appreciating' :
                       stats.monthly.avgPrice < stats.annual.avgPrice ? 'Declining' : 'Stable'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#660D39]" />
                  <div>
                    <div className="font-semibold text-[#484247] font-montserrat">Market Speed</div>
                    <div className="text-[#484247] font-montserrat">
                      {stats.allTime.avgTimeOnMarket < 45 ? 'Fast' :
                       stats.allTime.avgTimeOnMarket < 90 ? 'Normal' : 'Slow'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[#660D39]" />
                  <div>
                    <div className="font-semibold text-[#484247] font-montserrat">Investment Appeal</div>
                    <div className="text-[#484247] font-montserrat">
                      {(stats.allTime.avgRent * 12 / stats.allTime.avgPrice) > 0.06 ? 'High' :
                       (stats.allTime.avgRent * 12 / stats.allTime.avgPrice) > 0.04 ? 'Medium' : 'Low'}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default EnhancedAIAnalysis;