/* eslint-disable @typescript-eslint/no-unused-vars */
// EndpointScoreInfographic.tsx
// A custom infographic component that uses only endpoint data, not ArcGIS services

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  Target, 
  Users, 
  DollarSign, 
  BarChart3, 
  Activity,
  Award,
  Building2,
  MapPin,
  Zap,
  Download,
  Loader2
} from 'lucide-react';

interface EndpointData {
  OBJECTID: number;
  DESCRIPTION: string;
  strategic_score?: number;
  strategic_value_score?: number;
  competitive_score?: number;
  competitive_advantage_score?: number;
  market_opportunity?: number;
  market_dominance?: number;
  demographic_advantage?: number;
  economic_advantage?: number;
  population_advantage?: number;
  X14060_X?: number; // Total revenue/sales
  X14068_X?: number; // Industry metric
  GENZ_CY?: number; // Gen Z population
  GENZ_CY_P?: number; // Gen Z percentage
  [key: string]: any;
}

interface ScoreMetric {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  description: string;
}

interface EndpointScoreInfographicProps {
  geometry: __esri.Geometry | null;
  endpointType?: 'strategic' | 'competitive' | 'demographic';
  onExportPDF?: () => void;
}

const EndpointScoreInfographic: React.FC<EndpointScoreInfographicProps> = ({
  geometry,
  endpointType = 'strategic',
  onExportPDF
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [areaData, setAreaData] = useState<EndpointData[]>([]);
  const [aggregatedScores, setAggregatedScores] = useState<Record<string, number>>({});

  // Fetch endpoint data based on geometry
  useEffect(() => {
    if (!geometry) {
      setAreaData([]);
      setAggregatedScores({});
      return;
    }

    const fetchAreaData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Determine which endpoint to fetch based on type
        const endpointMap = {
          strategic: '/scripts/automation/generated_endpoints/strategic-analysis.json',
          competitive: '/scripts/automation/generated_endpoints/competitive-analysis.json',
          demographic: '/scripts/automation/generated_endpoints/demographic-insights.json'
        };

        const response = await fetch(endpointMap[endpointType]);
        if (!response.ok) throw new Error('Failed to fetch endpoint data');
        
        const data = await response.json();
        
        // Filter data points within the geometry bounds
        // This is a simplified version - in production you'd need proper spatial filtering
        const bounds = (geometry as __esri.Polygon).extent;
        const filteredData = data.results.filter((point: EndpointData) => {
          // Check if point has valid coordinates
          if (!point.LATITUDE || !point.LONGITUDE) return false;
          
          // Simple bounds check (you'd use proper geometry contains in production)
          if (!bounds) return true;
          return point.LATITUDE >= bounds.ymin && 
                 point.LATITUDE <= bounds.ymax &&
                 point.LONGITUDE >= bounds.xmin && 
                 point.LONGITUDE <= bounds.xmax;
        });

        setAreaData(filteredData);
        
        // Aggregate scores
        const scores = calculateAggregatedScores(filteredData, endpointType);
        setAggregatedScores(scores);
        
      } catch (err) {
        console.error('Error fetching endpoint data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchAreaData();
  }, [geometry, endpointType]);

  // Calculate aggregated scores for the area
  const calculateAggregatedScores = (data: EndpointData[], type: string): Record<string, number> => {
    if (data.length === 0) return {};

    const scores: Record<string, number> = {};
    
    if (type === 'strategic') {
      scores.strategic_value = average(data.map(d => d.strategic_value_score || 0));
      scores.market_opportunity = average(data.map(d => d.market_opportunity || 0));
      scores.strategic_overall = average(data.map(d => d.strategic_score || 0));
    } else if (type === 'competitive') {
      scores.competitive_advantage = average(data.map(d => d.competitive_advantage_score || 0));
      scores.market_dominance = average(data.map(d => d.market_dominance || 0));
      scores.demographic_advantage = average(data.map(d => d.demographic_advantage || 0));
      scores.economic_advantage = average(data.map(d => d.economic_advantage || 0));
      scores.competitive_overall = average(data.map(d => d.competitive_score || 0));
    }

    // Calculate demographic metrics
    scores.total_revenue = sum(data.map(d => d.X14060_X || 0));
    scores.avg_revenue = average(data.map(d => d.X14060_X || 0));
    scores.gen_z_percentage = average(data.map(d => d.GENZ_CY_P || 0));
    scores.data_points = data.length;

    return scores;
  };

  // Helper functions
  const average = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

  // Format score metrics for display
  const scoreMetrics = useMemo((): ScoreMetric[] => {
    const metrics: ScoreMetric[] = [];

    if (endpointType === 'strategic') {
      if (aggregatedScores.strategic_value !== undefined) {
        metrics.push({
          label: 'Strategic Value',
          value: Math.round(aggregatedScores.strategic_value),
          icon: Target,
          color: 'text-blue-600',
          description: 'Overall strategic importance of this area'
        });
      }
      if (aggregatedScores.market_opportunity !== undefined) {
        metrics.push({
          label: 'Market Opportunity',
          value: Math.round(aggregatedScores.market_opportunity),
          icon: TrendingUp,
          color: 'text-green-600',
          description: 'Potential for market growth and expansion'
        });
      }
    } else if (endpointType === 'competitive') {
      if (aggregatedScores.competitive_advantage !== undefined) {
        metrics.push({
          label: 'Competitive Advantage',
          value: Math.round(aggregatedScores.competitive_advantage),
          icon: Award,
          color: 'text-purple-600',
          description: 'Competitive positioning strength'
        });
      }
      if (aggregatedScores.market_dominance !== undefined) {
        metrics.push({
          label: 'Market Dominance',
          value: Math.round(aggregatedScores.market_dominance),
          icon: Building2,
          color: 'text-indigo-600',
          description: 'Market share and influence'
        });
      }
      if (aggregatedScores.economic_advantage !== undefined) {
        metrics.push({
          label: 'Economic Advantage',
          value: Math.round(aggregatedScores.economic_advantage),
          icon: DollarSign,
          color: 'text-green-600',
          description: 'Economic strength and potential'
        });
      }
    }

    // Add common demographic metrics
    if (aggregatedScores.gen_z_percentage !== undefined && aggregatedScores.gen_z_percentage > 0) {
      metrics.push({
        label: 'Gen Z Population',
        value: Math.round(aggregatedScores.gen_z_percentage),
        icon: Users,
        color: 'text-cyan-600',
        description: 'Percentage of Gen Z demographic'
      });
    }

    return metrics;
  }, [aggregatedScores, endpointType]);

  // Render score card
  const renderScoreCard = (metric: ScoreMetric) => {
    const Icon = metric.icon;
    const getScoreColor = (score: number) => {
      if (score >= 75) return 'bg-green-100 border-green-300';
      if (score >= 50) return 'bg-yellow-100 border-yellow-300';
      if (score >= 25) return 'bg-orange-100 border-orange-300';
      return 'bg-red-100 border-red-300';
    };

    return (
      <div 
        key={metric.label}
        className={`p-4 rounded-lg border-2 ${getScoreColor(metric.value)} transition-all hover:shadow-md`}
      >
        <div className="flex items-start justify-between mb-2">
          {React.createElement(Icon, { className: `h-6 w-6 ${metric.color}` })}
          <span className="text-2xl font-bold">{metric.value}</span>
        </div>
        <h4 className="font-semibold text-gray-900 mb-1">{metric.label}</h4>
        <p className="text-xs text-gray-600">{metric.description}</p>
        <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-blue-400 to-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${metric.value}%` }}
          />
        </div>
      </div>
    );
  };

  // Render insights section
  const renderInsights = () => {
    const insights: string[] = [];
    
    if (endpointType === 'strategic') {
      if (aggregatedScores.strategic_value > 70) {
        insights.push('This area shows high strategic value with strong growth potential');
      }
      if (aggregatedScores.market_opportunity > 60) {
        insights.push('Significant market opportunities exist in this region');
      }
    } else if (endpointType === 'competitive') {
      if (aggregatedScores.competitive_advantage > 65) {
        insights.push('Strong competitive positioning compared to surrounding areas');
      }
      if (aggregatedScores.economic_advantage > 70) {
        insights.push('Economic indicators suggest robust business environment');
      }
    }

    if (aggregatedScores.gen_z_percentage > 30) {
      insights.push('High concentration of younger demographics indicates future growth potential');
    }

    if (aggregatedScores.data_points < 5) {
      insights.push('Limited data points in this area - results should be interpreted with caution');
    }

    return insights.length > 0 ? (
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-600" />
            Key Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {insights.map((insight, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-blue-900">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    ) : null;
  };

  // Main render
  if (!geometry) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent className="text-center">
          <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">Draw an area on the map to generate score analysis</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-3" />
          <p className="text-gray-600">Analyzing area scores...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-full">
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="h-full overflow-auto p-4 bg-gray-50">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl">
                  {endpointType === 'strategic' ? 'Strategic Analysis' : 
                   endpointType === 'competitive' ? 'Competitive Analysis' : 
                   'Demographic Analysis'} Report
                </CardTitle>
                <p className="text-gray-600 mt-1">
                  Analysis based on {aggregatedScores.data_points || 0} data points in selected area
                </p>
              </div>
              {onExportPDF && (
                <Button onClick={onExportPDF} size="sm" variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
              )}
            </div>
          </CardHeader>
        </Card>

        {/* Score Cards Grid */}
        {scoreMetrics.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {scoreMetrics.map(renderScoreCard)}
          </div>
        )}

        {/* Summary Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Area Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">Data Points</p>
                <p className="text-xl font-semibold">{aggregatedScores.data_points || 0}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Overall Score</p>
                <p className="text-xl font-semibold">
                  {Math.round(aggregatedScores[`${endpointType}_overall`] || 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-xl font-semibold">
                  ${(aggregatedScores.total_revenue || 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Avg Revenue</p>
                <p className="text-xl font-semibold">
                  ${Math.round(aggregatedScores.avg_revenue || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Insights */}
        {renderInsights()}

        {/* Footer */}
        <div className="text-center text-xs text-gray-500 py-4">
          Generated from endpoint data • {new Date().toLocaleString()}
        </div>
      </div>
    </div>
  );
};

export default EndpointScoreInfographic;