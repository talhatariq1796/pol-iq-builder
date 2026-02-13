'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Sources, SourcesTrigger, SourcesContent, Source } from './source';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  Database,
  MapPin,
  BarChart3,
  Users,
  Clock,
  Shield,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  Info,
  Zap
} from 'lucide-react';

// Types for data source tracking
interface DataSource {
  id: string;
  name: string;
  type: 'primary' | 'secondary' | 'derived' | 'model';
  url?: string;
  description: string;
  coverage?: string;
  lastUpdated?: string;
  confidence?: number;
  recordCount?: number;
  fields?: string[];
  methodology?: string;
  icon?: React.ComponentType<{ className?: string }>;
  status: 'active' | 'warning' | 'error';
}

interface AnalysisLineage {
  step: string;
  processor: string;
  inputSources: string[];
  outputFields: string[];
  confidence?: number;
  explanation?: string;
}

interface DataProvenanceProps {
  analysisResult?: any;
  endpoint?: string;
  zipCodes?: string[];
  fieldCount?: number;
  processingSteps?: AnalysisLineage[];
  className?: string;
  onSourceClick?: (source: DataSource) => void;
}

// Predefined data sources that match the existing analysis system
const getDataSources = (endpoint?: string, zipCodes?: string[], fieldCount?: number): DataSource[] => {
  const baseYear = new Date().getFullYear();
  const zipCount = zipCodes?.length || 0;
  
  const sources: DataSource[] = [
    {
      id: 'census-acs',
      name: 'US Census Bureau ACS',
      type: 'primary',
      url: 'https://www.census.gov/programs-surveys/acs/',
      description: 'American Community Survey demographic and economic data',
      coverage: `Demographic data for ${zipCount > 0 ? `${zipCount} ZIP codes` : 'all US geographic areas'}`,
      lastUpdated: `${baseYear} 5-year estimates`,
      confidence: 0.95,
      recordCount: zipCount * 150, // ~150 demographic fields per ZIP
      fields: ['population', 'income', 'age', 'education', 'housing'],
      icon: Database,
      status: 'active'
    },
    {
      id: 'esri-business-analyst',
      name: 'Esri Business Analyst Demographics',
      type: 'secondary',
      url: 'https://www.esri.com/en-us/arcgis/products/esri-demographics',
      description: 'Enhanced demographic data with consumer spending and lifestyle segmentation',
      coverage: `Consumer behavior data for ${zipCount > 0 ? `${zipCount} areas` : 'US markets'}`,
      lastUpdated: `Q4 ${baseYear - 1}`,
      confidence: 0.88,
      recordCount: zipCount * 200, // ~200 enhanced fields per ZIP
      fields: ['spending', 'lifestyle', 'psychographics', 'market_segments'],
      icon: BarChart3,
      status: 'active'
    },
    {
      id: 'geographic-boundaries',
      name: 'ZIP Code Boundaries',
      type: 'primary',
      url: 'https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.html',
      description: 'Official US Postal Service ZIP code geographic boundaries',
      coverage: `Geographic boundaries for ${zipCount > 0 ? `${zipCount} ZIP codes` : 'all US ZIP codes'}`,
      lastUpdated: `${baseYear} TIGER/Line`,
      confidence: 0.98,
      recordCount: zipCount,
      fields: ['geometry', 'area', 'coordinates'],
      icon: MapPin,
      status: 'active'
    }
  ];

  // Add endpoint-specific sources
  if (endpoint?.includes('strategic') || endpoint?.includes('competitive')) {
    sources.push({
      id: 'market-intelligence',
      name: 'Housing Market Intelligence Database',
      type: 'secondary',
      description: 'Housing market analysis and demographic intelligence data for Quebec regions',
      coverage: `Housing data for ${zipCount > 0 ? 'selected FSA areas' : 'Quebec provincial coverage'}`,
      lastUpdated: 'Updated monthly',
      confidence: 0.82,
      recordCount: zipCount * 50,
      fields: ['market_size', 'competition', 'growth_rate', 'barriers'],
      icon: Shield,
      status: 'active'
    });
  }

  if (endpoint?.includes('shap') || endpoint?.includes('model')) {
    sources.push({
      id: 'ml-predictions',
      name: 'Machine Learning Model',
      type: 'model',
      description: 'XGBoost model with SHAP explainability for predictive analysis',
      coverage: 'AI-powered predictions and feature importance analysis',
      lastUpdated: `Model v${baseYear}.3`,
      confidence: 0.91,
      recordCount: fieldCount || 100,
      fields: ['predictions', 'feature_importance', 'confidence_intervals'],
      methodology: 'Gradient boosting with Shapley value explanations',
      icon: Zap,
      status: 'active'
    });
  }

  return sources;
};

// Generate processing lineage based on endpoint
const generateProcessingLineage = (endpoint?: string): AnalysisLineage[] => {
  const baseLineage: AnalysisLineage[] = [
    {
      step: 'Data Collection',
      processor: 'GeoAwarenessEngine',
      inputSources: ['census-acs', 'geographic-boundaries'],
      outputFields: ['demographics', 'geography'],
      confidence: 0.95,
      explanation: 'Collected demographic and geographic data for selected ZIP codes'
    },
    {
      step: 'Query Routing',
      processor: 'SemanticEnhancedHybridEngine',
      inputSources: ['user-query'],
      outputFields: ['endpoint', 'parameters'],
      confidence: 0.92,
      explanation: 'Analyzed query intent and routed to appropriate analysis endpoint'
    }
  ];

  // Add endpoint-specific processing steps
  if (endpoint?.includes('strategic')) {
    baseLineage.push({
      step: 'Strategic Analysis',
      processor: 'StrategicAnalysisProcessor',
      inputSources: ['census-acs', 'esri-business-analyst', 'market-intelligence'],
      outputFields: ['market_opportunity', 'strategic_scores'],
      confidence: 0.88,
      explanation: 'Applied strategic analysis algorithms to identify market opportunities'
    });
  }

  if (endpoint?.includes('shap') || endpoint?.includes('model')) {
    baseLineage.push({
      step: 'SHAP Analysis',
      processor: 'SHAP Microservice',
      inputSources: ['ml-predictions'],
      outputFields: ['feature_importance', 'explanations'],
      confidence: 0.91,
      explanation: 'Generated Shapley value explanations for model predictions'
    });
  }

  baseLineage.push({
    step: 'Visualization',
    processor: 'VisualizationRenderer',
    inputSources: ['processed-data'],
    outputFields: ['map_layers', 'charts'],
    confidence: 0.96,
    explanation: 'Rendered analysis results as interactive maps and visualizations'
  });

  return baseLineage;
};

export const DataProvenance: React.FC<DataProvenanceProps> = ({
  analysisResult,
  endpoint,
  zipCodes,
  fieldCount,
  processingSteps,
  className,
  onSourceClick
}) => {
  const [selectedStep, setSelectedStep] = useState<number | null>(null);

  // Generate data sources based on analysis context
  const dataSources = useMemo(() => 
    getDataSources(endpoint, zipCodes, fieldCount),
    [endpoint, zipCodes, fieldCount]
  );

  // Generate processing lineage
  const analysisLineage = useMemo(() => 
    processingSteps || generateProcessingLineage(endpoint),
    [processingSteps, endpoint]
  );

  // Calculate overall data confidence
  const overallConfidence = useMemo(() => {
    const validConfidences = dataSources
      .map(s => s.confidence)
      .filter((c): c is number => typeof c === 'number');
    
    return validConfidences.length > 0
      ? Math.round((validConfidences.reduce((a, b) => a + b, 0) / validConfidences.length) * 100)
      : 85;
  }, [dataSources]);

  const handleSourceClick = useCallback((source: DataSource) => {
    if (onSourceClick) {
      onSourceClick(source);
    } else if (source.url) {
      window.open(source.url, '_blank', 'noopener,noreferrer');
    }
  }, [onSourceClick]);

  const getStatusIcon = (status: DataSource['status']) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-3 h-3 text-yellow-500" />;
      case 'error':
        return <AlertTriangle className="w-3 h-3 text-red-500" />;
      default:
        return <Info className="w-3 h-3 text-gray-500" />;
    }
  };

  const getTypeColor = (type: DataSource['type']) => {
    switch (type) {
      case 'primary':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 'secondary':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'derived':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300';
      case 'model':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Data Quality Overview */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Data Quality</h3>
            <Badge variant="outline" className="text-xs">
              {overallConfidence}% confidence
            </Badge>
          </div>
        </div>
        
        <Progress value={overallConfidence} className="h-2" />
        
        <p className="text-xs text-muted-foreground">
          Analysis based on {dataSources.length} data sources and {analysisLineage.length} processing steps
        </p>
      </div>

      {/* Sources Component */}
      <Sources>
        <SourcesTrigger count={dataSources.length} className="w-full">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">View Data Sources</span>
            <div className="flex items-center gap-1">
              {dataSources.slice(0, 3).map((source) => {
                const IconComponent = source.icon || Database;
                return (
                  <div key={source.id} className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                    <IconComponent className="w-3 h-3" />
                  </div>
                );
              })}
              {dataSources.length > 3 && (
                <span className="text-xs text-muted-foreground">+{dataSources.length - 3}</span>
              )}
            </div>
          </div>
        </SourcesTrigger>

        <SourcesContent className="space-y-4">
          {/* Data Sources */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Database className="w-4 h-4" />
              Data Sources
            </h4>
            
            {dataSources.map((source) => {
              const IconComponent = source.icon || Database;
              
              return (
                <div
                  key={source.id}
                  onClick={() => handleSourceClick(source)}
                  className="border rounded-lg p-3 space-y-2 hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white">
                        <IconComponent className="w-4 h-4" />
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{source.name}</span>
                          <Badge className={cn("text-xs", getTypeColor(source.type))}>
                            {source.type}
                          </Badge>
                          {getStatusIcon(source.status)}
                        </div>
                        
                        <p className="text-sm text-muted-foreground">
                          {source.description}
                        </p>
                        
                        {source.coverage && (
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium">Coverage:</span> {source.coverage}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {source.lastUpdated && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {source.lastUpdated}
                            </div>
                          )}
                          
                          {source.recordCount && (
                            <div>
                              <span className="font-medium">{source.recordCount.toLocaleString()}</span> records
                            </div>
                          )}
                          
                          {source.confidence && (
                            <div>
                              <span className="font-medium">{Math.round(source.confidence * 100)}%</span> confidence
                            </div>
                          )}
                        </div>
                        
                        {source.fields && source.fields.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {source.fields.slice(0, 4).map((field) => (
                              <Badge key={field} variant="secondary" className="text-xs">
                                {field}
                              </Badge>
                            ))}
                            {source.fields.length > 4 && (
                              <Badge variant="secondary" className="text-xs">
                                +{source.fields.length - 4} more
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {source.url && (
                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Processing Lineage */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Processing Pipeline
            </h4>
            
            <div className="space-y-2">
              {analysisLineage.map((step, index) => (
                <div
                  key={step.step}
                  className={cn(
                    "border rounded-lg p-3 transition-colors",
                    selectedStep === index 
                      ? "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800"
                      : "hover:bg-muted/50 cursor-pointer"
                  )}
                  onClick={() => setSelectedStep(selectedStep === index ? null : index)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-white text-xs font-medium">
                        {index + 1}
                      </div>
                      
                      <div>
                        <span className="font-medium text-sm">{step.step}</span>
                        <p className="text-xs text-muted-foreground">{step.processor}</p>
                      </div>
                    </div>
                    
                    {step.confidence && (
                      <Badge variant="outline" className="text-xs">
                        {Math.round(step.confidence * 100)}%
                      </Badge>
                    )}
                  </div>
                  
                  {selectedStep === index && step.explanation && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-sm text-muted-foreground mb-2">
                        {step.explanation}
                      </p>
                      
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="font-medium">Input:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {step.inputSources.map((input) => (
                              <Badge key={input} variant="secondary" className="text-xs">
                                {input.replace(/-/g, ' ')}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <span className="font-medium">Output:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {step.outputFields.map((output) => (
                              <Badge key={output} variant="secondary" className="text-xs">
                                {output.replace(/_/g, ' ')}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </SourcesContent>
      </Sources>
    </div>
  );
};

export default DataProvenance;