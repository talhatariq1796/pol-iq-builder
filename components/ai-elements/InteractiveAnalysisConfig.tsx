'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CodeBlock, CodeBlockCopyButton } from './code-block';
import { Actions, Action } from './actions';
import { cn } from '@/lib/utils';
import {
  Settings,
  Play,
  Save,
  Download,
  Upload,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Info,
  Zap,
  MapPin,
  Target,
  Users,
  TrendingUp,
  Database,
  Clock
} from 'lucide-react';

// Types for analysis configuration
interface AnalysisConfig {
  // From SemanticEnhancedHybridEngine
  endpoint: string;
  confidence: number;
  
  // From GeoAwarenessEngine
  geographicScope: string;
  zipCodes: string[];
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  
  // From BrandNameResolver
  targetBrand?: string;
  
  // From DynamicFieldDetector
  detectedFields: string[];
  relevanceThreshold: number;
  
  // From ConfigurationManager
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
  
  // Analysis parameters
  analysisType: 'strategic' | 'demographic' | 'competitive' | 'trend' | 'location' | 'predictive';
  persona: 'strategist' | 'analyst' | 'consultant';
  
  // Advanced options
  includeShap: boolean;
  generateInsights: boolean;
  confidenceLevel: number;
  maxResults: number;
}

interface ValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  suggestions: string[];
}

interface ConfigTemplate {
  id: string;
  name: string;
  description: string;
  config: Partial<AnalysisConfig>;
  category: 'retail' | 'healthcare' | 'realestate' | 'finance' | 'custom';
}

interface InteractiveAnalysisConfigProps {
  initialConfig?: Partial<AnalysisConfig>;
  onConfigChange?: (config: AnalysisConfig) => void;
  onRunAnalysis?: (config: AnalysisConfig) => void;
  onSaveTemplate?: (template: ConfigTemplate) => void;
  onLoadTemplate?: (templateId: string) => void;
  className?: string;
  availableTemplates?: ConfigTemplate[];
  isRunning?: boolean;
  validationEnabled?: boolean;
}

// Default configuration
const DEFAULT_CONFIG: AnalysisConfig = {
  endpoint: 'strategic-analysis',
  confidence: 0.92,
  geographicScope: 'Selected Area',
  zipCodes: [],
  detectedFields: [],
  relevanceThreshold: 0.8,
  scoreConfig: {
    weights: {
      demographic: 0.4,
      economic: 0.3,
      competitive: 0.2,
      geographic: 0.1
    },
    filters: {},
    clustering: {
      enabled: true,
      algorithm: 'DBSCAN',
      eps: 0.5,
      minSamples: 5
    }
  },
  analysisType: 'strategic',
  persona: 'strategist',
  includeShap: false,
  generateInsights: true,
  confidenceLevel: 0.95,
  maxResults: 100
};

// Built-in templates
const BUILTIN_TEMPLATES: ConfigTemplate[] = [
  {
    id: 'retail-expansion',
    name: 'Retail Expansion Analysis',
    description: 'Optimized for retail location and market expansion analysis',
    category: 'retail',
    config: {
      analysisType: 'strategic',
      scoreConfig: {
        weights: {
          demographic: 0.5,
          economic: 0.3,
          competitive: 0.2
        },
        filters: {
          minPopulation: 10000,
          minMedianIncome: 40000
        },
        clustering: {
          enabled: true,
          algorithm: 'DBSCAN',
          eps: 0.3,
          minSamples: 3
        }
      },
      includeShap: true,
      generateInsights: true
    }
  },
  {
    id: 'demographic-study',
    name: 'Demographic Deep Dive',
    description: 'Comprehensive demographic and population analysis',
    category: 'custom',
    config: {
      analysisType: 'demographic',
      persona: 'analyst',
      scoreConfig: {
        weights: {
          demographic: 0.7,
          economic: 0.2,
          geographic: 0.1
        },
        filters: {},
        clustering: {
          enabled: true,
          algorithm: 'HDBSCAN',
          eps: 0.4,
          minSamples: 5
        }
      },
      confidenceLevel: 0.99,
      maxResults: 200
    }
  },
  {
    id: 'competitive-landscape',
    name: 'Competitive Analysis',
    description: 'Market competition and gap analysis',
    category: 'custom',
    config: {
      analysisType: 'competitive',
      persona: 'consultant',
      scoreConfig: {
        weights: {
          competitive: 0.5,
          economic: 0.3,
          demographic: 0.2
        },
        filters: {},
        clustering: {
          enabled: false,
          algorithm: 'DBSCAN',
          eps: 0.5,
          minSamples: 5
        }
      },
      includeShap: false,
      generateInsights: true
    }
  }
];

export const InteractiveAnalysisConfig: React.FC<InteractiveAnalysisConfigProps> = ({
  initialConfig = {},
  onConfigChange,
  onRunAnalysis,
  onSaveTemplate,
  onLoadTemplate,
  className,
  availableTemplates = [],
  isRunning = false,
  validationEnabled = true
}) => {
  // State
  const [config, setConfig] = useState<AnalysisConfig>(() => ({
    ...DEFAULT_CONFIG,
    ...initialConfig
  }));
  
  const [activeTab, setActiveTab] = useState<string>('basic');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<ValidationResult>({
    isValid: true,
    warnings: [],
    errors: [],
    suggestions: []
  });
  
  // Combine built-in and custom templates
  const allTemplates = useMemo(() => [...BUILTIN_TEMPLATES, ...availableTemplates], [availableTemplates]);
  
  // Real-time validation
  const validateConfig = useCallback((config: AnalysisConfig): ValidationResult => {
    const warnings: string[] = [];
    const errors: string[] = [];
    const suggestions: string[] = [];
    
    // Basic validation
    if (config.zipCodes.length === 0) {
      warnings.push('No ZIP codes selected - analysis will use default area');
    }
    
    if (config.zipCodes.length > 500) {
      warnings.push('Large number of ZIP codes may impact performance');
    }
    
    if (config.confidence < 0.7) {
      warnings.push('Low confidence threshold may include unreliable results');
    }
    
    if (config.relevanceThreshold > 0.95) {
      warnings.push('High relevance threshold may exclude useful data');
    }
    
    // Clustering validation
    if (config.scoreConfig.clustering.enabled && config.zipCodes.length < config.scoreConfig.clustering.minSamples * 2) {
      errors.push('Insufficient data points for clustering analysis');
    }
    
    // SHAP validation
    if (config.includeShap && config.detectedFields.length === 0) {
      warnings.push('SHAP analysis requires detected fields - will auto-detect during analysis');
    }
    
    // Performance suggestions
    if (config.maxResults > 1000) {
      suggestions.push('Consider reducing maxResults for better performance');
    }
    
    if (config.analysisType === 'predictive' && !config.includeShap) {
      suggestions.push('Enable SHAP analysis for better predictive insights');
    }
    
    return {
      isValid: errors.length === 0,
      warnings,
      errors,
      suggestions
    };
  }, []);
  
  // Update validation when config changes
  useEffect(() => {
    if (validationEnabled) {
      const result = validateConfig(config);
      setValidationResult(result);
    }
  }, [config, validationEnabled, validateConfig]);
  
  // Notify parent of config changes
  useEffect(() => {
    onConfigChange?.(config);
  }, [config, onConfigChange]);
  
  // Config update handlers
  const updateConfig = useCallback(<K extends keyof AnalysisConfig>(
    key: K,
    value: AnalysisConfig[K]
  ) => {
    setConfig((prev: any) => ({
      ...prev,
      [key]: value
    }));
    setIsEditing(true);
  }, []);
  
  const updateScoreConfigWeights = useCallback((weights: Record<string, number>) => {
    setConfig((prev: any) => ({
      ...prev,
      scoreConfig: {
        ...prev.scoreConfig,
        weights
      }
    }));
    setIsEditing(true);
  }, []);
  
  const updateClusteringConfig = useCallback((clustering: AnalysisConfig['scoreConfig']['clustering']) => {
    setConfig((prev: any) => ({
      ...prev,
      scoreConfig: {
        ...prev.scoreConfig,
        clustering
      }
    }));
    setIsEditing(true);
  }, []);
  
  // Template handlers
  const handleLoadTemplate = useCallback((templateId: string) => {
    const template = allTemplates.find(t => t.id === templateId);
    if (template) {
      setConfig((prev: any) => ({
        ...prev,
        ...template.config
      }));
      setIsEditing(true);
      onLoadTemplate?.(templateId);
    }
  }, [allTemplates, onLoadTemplate]);
  
  const handleSaveTemplate = useCallback(() => {
    const templateName = prompt('Enter template name:');
    if (templateName) {
      const template: ConfigTemplate = {
        id: `custom-${Date.now()}`,
        name: templateName,
        description: 'Custom user template',
        category: 'custom',
        config
      };
      onSaveTemplate?.(template);
      setIsEditing(false);
    }
  }, [config, onSaveTemplate]);
  
  const handleRunAnalysis = useCallback(() => {
    if (validationResult.isValid) {
      onRunAnalysis?.(config);
    }
  }, [config, validationResult.isValid, onRunAnalysis]);
  
  // Generate JSON representation
  const configJson = useMemo(() => JSON.stringify(config, null, 2), [config]);
  
  // Analysis type icons
  const getAnalysisTypeIcon = (type: AnalysisConfig['analysisType']) => {
    switch (type) {
      case 'strategic': return Target;
      case 'demographic': return Users;
      case 'competitive': return TrendingUp;
      case 'trend': return TrendingUp;
      case 'location': return MapPin;
      case 'predictive': return Zap;
      default: return Database;
    }
  };
  
  const AnalysisIcon = getAnalysisTypeIcon(config.analysisType);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white">
            <AnalysisIcon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Analysis Configuration</h3>
            <p className="text-xs text-muted-foreground">
              Interactive parameter editor with real-time validation
            </p>
          </div>
        </div>
        
        <Actions>
          <Action
            tooltip="Load template"
            onClick={() => {
              // Template selector would be implemented here
            }}
          >
            <Upload className="w-3 h-3" />
          </Action>
          <Action
            tooltip="Save as template"
            onClick={handleSaveTemplate}
            disabled={!isEditing}
          >
            <Save className="w-3 h-3" />
          </Action>
          <Action
            tooltip="Export configuration"
            onClick={() => {
              const blob = new Blob([configJson], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `analysis-config-${Date.now()}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="w-3 h-3" />
          </Action>
        </Actions>
      </div>

      {/* Validation Status */}
      {validationEnabled && (validationResult.errors.length > 0 || validationResult.warnings.length > 0) && (
        <Card className={cn(
          "border-l-4",
          validationResult.errors.length > 0 ? "border-l-red-500 bg-red-50 dark:bg-red-950/10" : "border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/10"
        )}>
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              {validationResult.errors.length > 0 ? (
                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5" />
              ) : (
                <Info className="w-4 h-4 text-yellow-500 mt-0.5" />
              )}
              <div className="space-y-2 flex-1">
                {validationResult.errors.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-red-700 dark:text-red-300">Errors:</p>
                    <ul className="text-xs text-red-600 dark:text-red-400 list-disc list-inside space-y-1">
                      {validationResult.errors.map((error, i) => (
                        <li key={i}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {validationResult.warnings.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">Warnings:</p>
                    <ul className="text-xs text-yellow-600 dark:text-yellow-400 list-disc list-inside space-y-1">
                      {validationResult.warnings.map((warning, i) => (
                        <li key={i}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {validationResult.suggestions.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Suggestions:</p>
                    <ul className="text-xs text-blue-600 dark:text-blue-400 list-disc list-inside space-y-1">
                      {validationResult.suggestions.map((suggestion, i) => (
                        <li key={i}>{suggestion}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuration Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic" className="text-xs">Basic</TabsTrigger>
          <TabsTrigger value="advanced" className="text-xs">Advanced</TabsTrigger>
          <TabsTrigger value="templates" className="text-xs">Templates</TabsTrigger>
          <TabsTrigger value="json" className="text-xs">JSON View</TabsTrigger>
        </TabsList>

        {/* Basic Configuration */}
        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Analysis Parameters</CardTitle>
              <CardDescription>Core analysis settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium">Analysis Type</label>
                  <Select 
                    value={config.analysisType} 
                    onValueChange={(value: AnalysisConfig['analysisType']) => updateConfig('analysisType', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="strategic">Strategic Analysis</SelectItem>
                      <SelectItem value="demographic">Demographic Analysis</SelectItem>
                      <SelectItem value="competitive">Competitive Analysis</SelectItem>
                      <SelectItem value="trend">Trend Analysis</SelectItem>
                      <SelectItem value="location">Location Analysis</SelectItem>
                      <SelectItem value="predictive">Predictive Modeling</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium">Persona</label>
                  <Select 
                    value={config.persona} 
                    onValueChange={(value: AnalysisConfig['persona']) => updateConfig('persona', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="strategist">Strategist</SelectItem>
                      <SelectItem value="analyst">Analyst</SelectItem>
                      <SelectItem value="consultant">Consultant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium">Target Brand (Optional)</label>
                <Input
                  value={config.targetBrand || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig('targetBrand', e.target.value || undefined)}
                  placeholder="Enter brand name for analysis"
                  className="text-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium">Confidence Level</label>
                  <Input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={config.confidenceLevel}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig('confidenceLevel', parseFloat(e.target.value))}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium">Relevance Threshold</label>
                  <Input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={config.relevanceThreshold}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig('relevanceThreshold', parseFloat(e.target.value))}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium">Max Results</label>
                  <Input
                    type="number"
                    min="1"
                    max="10000"
                    value={config.maxResults}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig('maxResults', parseInt(e.target.value))}
                    className="text-xs"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advanced Configuration */}
        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Score Weights</CardTitle>
              <CardDescription>Adjust importance of different factors</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(config.scoreConfig.weights).map(([key, value]) => (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium capitalize">{key}</label>
                    <Badge variant="secondary" className="text-xs">{(value * 100).toFixed(0)}%</Badge>
                  </div>
                  <Input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={value}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const newWeights = {
                        ...config.scoreConfig.weights,
                        [key]: parseFloat(e.target.value)
                      };
                      updateScoreConfigWeights(newWeights);
                    }}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Clustering Configuration</CardTitle>
              <CardDescription>Advanced spatial clustering settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="clustering-enabled"
                  checked={config.scoreConfig.clustering.enabled}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateClusteringConfig({
                    ...config.scoreConfig.clustering,
                    enabled: e.target.checked
                  })}
                />
                <label htmlFor="clustering-enabled" className="text-xs font-medium">
                  Enable Clustering
                </label>
              </div>

              {config.scoreConfig.clustering.enabled && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Algorithm</label>
                    <Select 
                      value={config.scoreConfig.clustering.algorithm} 
                      onValueChange={(value: 'DBSCAN' | 'HDBSCAN') => updateClusteringConfig({
                        ...config.scoreConfig.clustering,
                        algorithm: value
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DBSCAN">DBSCAN</SelectItem>
                        <SelectItem value="HDBSCAN">HDBSCAN</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Epsilon</label>
                      <Input
                        type="number"
                        min="0.1"
                        max="2.0"
                        step="0.1"
                        value={config.scoreConfig.clustering.eps}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateClusteringConfig({
                          ...config.scoreConfig.clustering,
                          eps: parseFloat(e.target.value)
                        })}
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium">Min Samples</label>
                      <Input
                        type="number"
                        min="2"
                        max="20"
                        value={config.scoreConfig.clustering.minSamples}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateClusteringConfig({
                          ...config.scoreConfig.clustering,
                          minSamples: parseInt(e.target.value)
                        })}
                        className="text-xs"
                      />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">AI Features</CardTitle>
              <CardDescription>Advanced AI-powered analysis options</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="include-shap"
                  checked={config.includeShap}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig('includeShap', e.target.checked)}
                />
                <label htmlFor="include-shap" className="text-xs font-medium">
                  Include SHAP Analysis (Feature Importance)
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="generate-insights"
                  checked={config.generateInsights}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig('generateInsights', e.target.checked)}
                />
                <label htmlFor="generate-insights" className="text-xs font-medium">
                  Generate AI Insights
                </label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates */}
        <TabsContent value="templates" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allTemplates.map((template) => (
              <Card key={template.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleLoadTemplate(template.id)}>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center justify-between">
                    {template.name}
                    <Badge variant="outline" className="text-xs">
                      {template.category}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {template.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    Quick setup
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* JSON View */}
        <TabsContent value="json" className="space-y-4">
          <CodeBlock
            code={configJson}
            language="json"
            showLineNumbers={true}
          >
            <CodeBlockCopyButton />
          </CodeBlock>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4 border-t">
        <div className="flex items-center gap-2">
          <Badge 
            variant={validationResult.isValid ? "default" : "destructive"}
            className="text-xs"
          >
            {validationResult.isValid ? (
              <>
                <CheckCircle className="w-3 h-3 mr-1" />
                Valid
              </>
            ) : (
              <>
                <AlertTriangle className="w-3 h-3 mr-1" />
                Invalid
              </>
            )}
          </Badge>
          
          {config.zipCodes.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {config.zipCodes.length} ZIP codes
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfig(DEFAULT_CONFIG)}
            className="text-xs"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Reset
          </Button>
          
          <Button
            size="sm"
            onClick={handleRunAnalysis}
            disabled={!validationResult.isValid || isRunning}
            className="text-xs"
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-3 h-3 mr-1" />
                Run Analysis
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InteractiveAnalysisConfig;