'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  Play,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Users,
  MapPin,
  Zap,
  AlertCircle,
  Info,
  CheckCircle,
  Clock,
  Target,
  DollarSign,
  Percent,
  Activity
} from 'lucide-react';

// Types for what-if analysis
interface AnalysisConfig {
  endpoint: string;
  confidence: number;
  geographicScope: string;
  zipCodes: string[];
  targetBrand?: string;
  detectedFields: string[];
  relevanceThreshold: number;
  scoreConfig: {
    weights: Record<string, number>;
    filters: Record<string, any>;
    clustering: {
      enabled: boolean;
      algorithm: 'DBSCAN' | 'HDBSCAN';
      eps: number;
      minSamples: number;
    };
  };
  analysisType: 'strategic' | 'demographic' | 'competitive' | 'trend' | 'location' | 'predictive';
  persona: 'strategist' | 'analyst' | 'consultant';
  includeShap: boolean;
  generateInsights: boolean;
  confidenceLevel: number;
  maxResults: number;
}

interface WhatIfScenario {
  id: string;
  name: string;
  description: string;
  configChanges: Partial<AnalysisConfig>;
  impact: 'low' | 'medium' | 'high';
  confidence: number;
}

interface PreviewMetrics {
  expectedResults: number;
  estimatedProcessingTime: number;
  confidenceScore: number;
  dataQualityScore: number;
  resourceUsage: {
    apiCalls: number;
    computeTime: number;
    memoryUsage: number;
  };
  potentialIssues: string[];
  improvementSuggestions: string[];
}

interface ComparisonResult {
  metric: string;
  current: number;
  proposed: number;
  change: number;
  changePercent: number;
  impact: 'positive' | 'negative' | 'neutral';
  description: string;
}

interface WhatIfAnalysisPreviewProps {
  baseConfig: AnalysisConfig;
  proposedConfig: AnalysisConfig;
  onRunScenario?: (scenario: WhatIfScenario) => void;
  onApplyChanges?: (config: AnalysisConfig) => void;
  className?: string;
  isLoading?: boolean;
}

// Predefined scenarios
const WHAT_IF_SCENARIOS: WhatIfScenario[] = [
  {
    id: 'higher-confidence',
    name: 'Higher Confidence Threshold',
    description: 'Increase confidence level to 0.99 for more reliable results',
    configChanges: {
      confidenceLevel: 0.99,
      relevanceThreshold: 0.9
    },
    impact: 'medium',
    confidence: 0.87
  },
  {
    id: 'enable-clustering',
    name: 'Enable Advanced Clustering',
    description: 'Turn on HDBSCAN clustering for better pattern detection',
    configChanges: {
      scoreConfig: {
        weights: { demographic: 0.4, economic: 0.3, competitive: 0.2, geographic: 0.1 },
        filters: {},
        clustering: {
          enabled: true,
          algorithm: 'HDBSCAN',
          eps: 0.3,
          minSamples: 5
        }
      }
    },
    impact: 'high',
    confidence: 0.92
  },
  {
    id: 'focus-demographic',
    name: 'Demographic Focus',
    description: 'Emphasize demographic factors for population-based analysis',
    configChanges: {
      scoreConfig: {
        weights: { demographic: 0.6, economic: 0.2, competitive: 0.1, geographic: 0.1 },
        filters: {},
        clustering: {
          enabled: true,
          algorithm: 'DBSCAN',
          eps: 0.5,
          minSamples: 5
        }
      },
      analysisType: 'demographic'
    },
    impact: 'medium',
    confidence: 0.89
  },
  {
    id: 'enable-shap',
    name: 'Add SHAP Analysis',
    description: 'Include feature importance analysis for explainable AI insights',
    configChanges: {
      includeShap: true,
      generateInsights: true
    },
    impact: 'high',
    confidence: 0.95
  }
];

export const WhatIfAnalysisPreview: React.FC<WhatIfAnalysisPreviewProps> = ({
  baseConfig,
  proposedConfig,
  onRunScenario,
  onApplyChanges,
  className,
  isLoading = false
}) => {
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [previewMetrics, setPreviewMetrics] = useState<PreviewMetrics | null>(null);
  const [activeTab, setActiveTab] = useState<string>('overview');

  // Calculate preview metrics based on configuration
  const calculatePreviewMetrics = useCallback((config: AnalysisConfig): PreviewMetrics => {
    const baseResults = Math.min(config.maxResults, 1000);
    const zipCodeMultiplier = config.zipCodes.length || 100;
    const complexityMultiplier = config.includeShap ? 1.5 : 1.0;
    const clusteringMultiplier = config.scoreConfig.clustering.enabled ? 1.3 : 1.0;
    
    const expectedResults = Math.floor(baseResults * (config.confidenceLevel * 0.8 + 0.2));
    const estimatedProcessingTime = Math.floor(
      (zipCodeMultiplier * 0.1 + 
       complexityMultiplier * 2 + 
       clusteringMultiplier * 1.5) * 1000
    );
    
    const confidenceScore = Math.min(
      config.confidenceLevel * 0.9 + 
      (config.zipCodes.length > 10 ? 0.05 : 0) +
      (config.includeShap ? 0.05 : 0),
      1.0
    );
    
    const dataQualityScore = Math.min(
      config.relevanceThreshold * 0.8 +
      (config.detectedFields.length > 0 ? 0.15 : 0.05) +
      (config.scoreConfig.clustering.enabled ? 0.05 : 0),
      1.0
    );

    const apiCalls = Math.floor(
      zipCodeMultiplier * 0.5 + 
      (config.includeShap ? zipCodeMultiplier * 0.2 : 0) +
      (config.scoreConfig.clustering.enabled ? 2 : 1)
    );

    const potentialIssues: string[] = [];
    const improvementSuggestions: string[] = [];

    // Analyze potential issues
    if (config.zipCodes.length === 0) {
      potentialIssues.push('No geographic areas selected');
    }
    if (config.zipCodes.length > 500) {
      potentialIssues.push('Large dataset may impact performance');
    }
    if (config.confidenceLevel > 0.98) {
      potentialIssues.push('Very high confidence may exclude useful results');
    }
    if (!config.scoreConfig.clustering.enabled && config.zipCodes.length > 50) {
      improvementSuggestions.push('Consider enabling clustering for pattern detection');
    }
    if (!config.includeShap && config.analysisType === 'predictive') {
      improvementSuggestions.push('SHAP analysis recommended for predictive modeling');
    }
    if (config.maxResults > 1000) {
      improvementSuggestions.push('Consider reducing max results for faster processing');
    }

    return {
      expectedResults,
      estimatedProcessingTime,
      confidenceScore,
      dataQualityScore,
      resourceUsage: {
        apiCalls,
        computeTime: estimatedProcessingTime,
        memoryUsage: Math.floor(zipCodeMultiplier * 0.5 + complexityMultiplier * 10)
      },
      potentialIssues,
      improvementSuggestions
    };
  }, []);

  // Calculate metrics for current and proposed configs
  const baseMetrics = useMemo(() => calculatePreviewMetrics(baseConfig), [baseConfig, calculatePreviewMetrics]);
  const proposedMetrics = useMemo(() => calculatePreviewMetrics(proposedConfig), [proposedConfig, calculatePreviewMetrics]);

  // Generate comparison results
  const comparisonResults: ComparisonResult[] = useMemo(() => {
    return [
      {
        metric: 'Expected Results',
        current: baseMetrics.expectedResults,
        proposed: proposedMetrics.expectedResults,
        change: proposedMetrics.expectedResults - baseMetrics.expectedResults,
        changePercent: ((proposedMetrics.expectedResults - baseMetrics.expectedResults) / baseMetrics.expectedResults) * 100,
        impact: proposedMetrics.expectedResults > baseMetrics.expectedResults ? 'positive' : 
                proposedMetrics.expectedResults < baseMetrics.expectedResults ? 'negative' : 'neutral',
        description: 'Number of analysis results expected'
      },
      {
        metric: 'Processing Time',
        current: baseMetrics.estimatedProcessingTime,
        proposed: proposedMetrics.estimatedProcessingTime,
        change: proposedMetrics.estimatedProcessingTime - baseMetrics.estimatedProcessingTime,
        changePercent: ((proposedMetrics.estimatedProcessingTime - baseMetrics.estimatedProcessingTime) / baseMetrics.estimatedProcessingTime) * 100,
        impact: proposedMetrics.estimatedProcessingTime < baseMetrics.estimatedProcessingTime ? 'positive' : 
                proposedMetrics.estimatedProcessingTime > baseMetrics.estimatedProcessingTime ? 'negative' : 'neutral',
        description: 'Estimated analysis processing time'
      },
      {
        metric: 'Confidence Score',
        current: baseMetrics.confidenceScore,
        proposed: proposedMetrics.confidenceScore,
        change: proposedMetrics.confidenceScore - baseMetrics.confidenceScore,
        changePercent: ((proposedMetrics.confidenceScore - baseMetrics.confidenceScore) / baseMetrics.confidenceScore) * 100,
        impact: proposedMetrics.confidenceScore > baseMetrics.confidenceScore ? 'positive' : 
                proposedMetrics.confidenceScore < baseMetrics.confidenceScore ? 'negative' : 'neutral',
        description: 'Overall analysis confidence level'
      },
      {
        metric: 'Data Quality',
        current: baseMetrics.dataQualityScore,
        proposed: proposedMetrics.dataQualityScore,
        change: proposedMetrics.dataQualityScore - baseMetrics.dataQualityScore,
        changePercent: ((proposedMetrics.dataQualityScore - baseMetrics.dataQualityScore) / baseMetrics.dataQualityScore) * 100,
        impact: proposedMetrics.dataQualityScore > baseMetrics.dataQualityScore ? 'positive' : 
                proposedMetrics.dataQualityScore < baseMetrics.dataQualityScore ? 'negative' : 'neutral',
        description: 'Expected quality of analysis data'
      },
      {
        metric: 'API Calls',
        current: baseMetrics.resourceUsage.apiCalls,
        proposed: proposedMetrics.resourceUsage.apiCalls,
        change: proposedMetrics.resourceUsage.apiCalls - baseMetrics.resourceUsage.apiCalls,
        changePercent: ((proposedMetrics.resourceUsage.apiCalls - baseMetrics.resourceUsage.apiCalls) / baseMetrics.resourceUsage.apiCalls) * 100,
        impact: proposedMetrics.resourceUsage.apiCalls < baseMetrics.resourceUsage.apiCalls ? 'positive' : 
                proposedMetrics.resourceUsage.apiCalls > baseMetrics.resourceUsage.apiCalls ? 'negative' : 'neutral',
        description: 'External API requests required'
      }
    ];
  }, [baseMetrics, proposedMetrics]);

  // Handle scenario application
  const handleApplyScenario = useCallback((scenario: WhatIfScenario) => {
    const newConfig = { ...baseConfig, ...scenario.configChanges };
    onApplyChanges?.(newConfig);
    setSelectedScenario(scenario.id);
  }, [baseConfig, onApplyChanges]);

  // Get impact color class
  const getImpactColor = (impact: 'positive' | 'negative' | 'neutral') => {
    switch (impact) {
      case 'positive': return 'text-green-600 dark:text-green-400';
      case 'negative': return 'text-red-600 dark:text-red-400';
      case 'neutral': return 'text-gray-600 dark:text-gray-400';
    }
  };

  // Get impact icon
  const getImpactIcon = (impact: 'positive' | 'negative' | 'neutral') => {
    switch (impact) {
      case 'positive': return TrendingUp;
      case 'negative': return TrendingDown;
      case 'neutral': return Activity;
    }
  };

  // Format time duration
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  // Format percentage
  const formatPercentage = (value: number) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white">
          <Zap className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">What-If Analysis Preview</h3>
          <p className="text-xs text-muted-foreground">
            Preview changes before running analysis
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="scenarios" className="text-xs">Scenarios</TabsTrigger>
          <TabsTrigger value="comparison" className="text-xs">Comparison</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-blue-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Expected Results</p>
                    <p className="text-lg font-semibold">{proposedMetrics.expectedResults}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-green-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Est. Processing</p>
                    <p className="text-lg font-semibold">{formatDuration(proposedMetrics.estimatedProcessingTime)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-purple-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Confidence</p>
                    <p className="text-lg font-semibold">{Math.round(proposedMetrics.confidenceScore * 100)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-orange-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Data Quality</p>
                    <p className="text-lg font-semibold">{Math.round(proposedMetrics.dataQualityScore * 100)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Resource Usage */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Resource Usage Estimate</CardTitle>
              <CardDescription>Estimated computational resources required</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span>API Calls</span>
                  <span>{proposedMetrics.resourceUsage.apiCalls}</span>
                </div>
                <Progress value={Math.min(proposedMetrics.resourceUsage.apiCalls / 10 * 100, 100)} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span>Compute Time</span>
                  <span>{formatDuration(proposedMetrics.resourceUsage.computeTime)}</span>
                </div>
                <Progress value={Math.min(proposedMetrics.resourceUsage.computeTime / 5000 * 100, 100)} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span>Memory Usage</span>
                  <span>{proposedMetrics.resourceUsage.memoryUsage} MB</span>
                </div>
                <Progress value={Math.min(proposedMetrics.resourceUsage.memoryUsage / 100 * 100, 100)} />
              </div>
            </CardContent>
          </Card>

          {/* Issues and Suggestions */}
          {(proposedMetrics.potentialIssues.length > 0 || proposedMetrics.improvementSuggestions.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {proposedMetrics.potentialIssues.length > 0 && (
                <Card className="border-l-4 border-l-yellow-500">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-yellow-500" />
                      Potential Issues
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="text-xs space-y-1">
                      {proposedMetrics.potentialIssues.map((issue, i) => (
                        <li key={i} className="text-yellow-700 dark:text-yellow-300">• {issue}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {proposedMetrics.improvementSuggestions.length > 0 && (
                <Card className="border-l-4 border-l-blue-500">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Info className="w-4 h-4 text-blue-500" />
                      Suggestions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="text-xs space-y-1">
                      {proposedMetrics.improvementSuggestions.map((suggestion, i) => (
                        <li key={i} className="text-blue-700 dark:text-blue-300">• {suggestion}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Scenarios Tab */}
        <TabsContent value="scenarios" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {WHAT_IF_SCENARIOS.map((scenario) => (
              <Card 
                key={scenario.id} 
                className={cn(
                  "cursor-pointer transition-colors hover:bg-muted/50",
                  selectedScenario === scenario.id && "ring-2 ring-blue-500"
                )}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{scenario.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={scenario.impact === 'high' ? 'default' : scenario.impact === 'medium' ? 'secondary' : 'outline'}
                        className="text-xs"
                      >
                        {scenario.impact} impact
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {Math.round(scenario.confidence * 100)}%
                      </Badge>
                    </div>
                  </div>
                  <CardDescription className="text-xs">
                    {scenario.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      Click to preview changes
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleApplyScenario(scenario)}
                        className="text-xs"
                      >
                        Apply
                      </Button>
                      {onRunScenario && (
                        <Button
                          size="sm"
                          onClick={() => onRunScenario(scenario)}
                          className="text-xs"
                        >
                          <Play className="w-3 h-3 mr-1" />
                          Run
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Comparison Tab */}
        <TabsContent value="comparison" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Configuration Comparison</CardTitle>
              <CardDescription>Current vs. proposed configuration impact</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {comparisonResults.map((result, i) => {
                  const ImpactIcon = getImpactIcon(result.impact);
                  
                  return (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div className={cn("p-1 rounded", {
                          'bg-green-100 dark:bg-green-900/20': result.impact === 'positive',
                          'bg-red-100 dark:bg-red-900/20': result.impact === 'negative',
                          'bg-gray-100 dark:bg-gray-900/20': result.impact === 'neutral'
                        })}>
                          <ImpactIcon className={cn("w-4 h-4", getImpactColor(result.impact))} />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{result.metric}</p>
                          <p className="text-xs text-muted-foreground">{result.description}</p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Current</p>
                            <p className="text-sm font-mono">
                              {result.metric.includes('Time') ? formatDuration(result.current) : 
                               result.metric.includes('Score') ? `${Math.round(result.current * 100)}%` :
                               result.current.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Proposed</p>
                            <p className="text-sm font-mono">
                              {result.metric.includes('Time') ? formatDuration(result.proposed) : 
                               result.metric.includes('Score') ? `${Math.round(result.proposed * 100)}%` :
                               result.proposed.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Change</p>
                            <p className={cn("text-sm font-mono", getImpactColor(result.impact))}>
                              {formatPercentage(result.changePercent)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4 border-t">
        <div className="text-xs text-muted-foreground">
          Preview updated based on current configuration
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onApplyChanges?.(baseConfig)}
            className="text-xs"
          >
            Revert Changes
          </Button>
          
          <Button
            size="sm"
            onClick={() => onApplyChanges?.(proposedConfig)}
            disabled={isLoading}
            className="text-xs"
          >
            {isLoading ? (
              <>
                <Activity className="w-3 h-3 mr-1 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Play className="w-3 h-3 mr-1" />
                Apply & Run
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WhatIfAnalysisPreview;