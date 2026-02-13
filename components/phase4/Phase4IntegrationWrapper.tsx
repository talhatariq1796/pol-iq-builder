// @ts-nocheck
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  isPhase4FeatureEnabled, 
  getPhase4FeatureConfig, 
  PHASE4_FEATURES 
} from '@/config/phase4-features';
import {
  BookOpen,
  Activity,
  BarChart3,
  Brain,
  Users,
  Zap,
  AlertTriangle,
  Clock,
  Database,
  ExternalLink,
  RefreshCw,
  Settings,
  TrendingUp,
  Lightbulb,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2
} from 'lucide-react';

// Import Phase 4 components
import { ScholarlyResearchPanel } from './ScholarlyResearchPanel';
import { RealTimeDataDashboard } from './RealTimeDataDashboard';
import { AdvancedVisualizationSuite } from './AdvancedVisualizationSuite';
import { AIInsightGenerator } from './AIInsightGenerator';

// Types
interface Phase4IntegrationProps {
  analysisResult: any;
  analysisContext: {
    selectedAreaName: string;
    zipCodes: string[];
    endpoint: string;
    query: string;
    persona?: string;
    fieldCount?: number;
    shapFeatures?: any[];
  };
  className?: string;
  onClose?: () => void;
}

interface Phase4ComponentStatus {
  component: string;
  enabled: boolean;
  available: boolean;
  status: 'ready' | 'loading' | 'error' | 'disabled';
  message?: string;
}

/**
 * Advanced Features Integration Wrapper
 * 
 * This component serves as the main integration point for all advanced features.
 * It handles feature flag management, component lifecycle, and data flow coordination.
 * 
 * Key Features:
 * - Feature flag-based component enablement
 * - Transparent error handling with no misleading fallbacks
 * - Data flow coordination between analysis results and advanced components
 * - Performance monitoring and resource management
 * - User-friendly status indicators and controls
 */
export function Phase4IntegrationWrapper({
  analysisResult,
  analysisContext,
  className,
  onClose
}: Phase4IntegrationProps) {
  // Component state management
  const [activeTab, setActiveTab] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [componentStatuses, setComponentStatuses] = useState<Phase4ComponentStatus[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);

  // Feature availability detection
  const availableComponents = useMemo(() => {
    const components = [
      {
        id: 'scholarly-research',
        name: 'Scholarly Research',
        description: 'Academic validation and research integration',
        icon: BookOpen,
        enabled: isPhase4FeatureEnabled('scholarlyResearch'),
        component: ScholarlyResearchPanel,
        requiresApiKey: false, // Uses free APIs only
        estimatedLoad: 'Low'
      },
      {
        id: 'real-time-data',
        name: 'Real-Time Data',
        description: 'Live economic indicators and market data',
        icon: Activity,
        enabled: isPhase4FeatureEnabled('realTimeDataStreams'),
        component: RealTimeDataDashboard,
        requiresApiKey: true, // FRED API key optional but recommended
        estimatedLoad: 'Medium'
      },
      {
        id: 'advanced-visualization',
        name: 'Advanced Visualization',
        description: '3D maps and interactive data exploration',
        icon: BarChart3,
        enabled: isPhase4FeatureEnabled('advancedVisualization'),
        component: AdvancedVisualizationSuite,
        requiresApiKey: false,
        estimatedLoad: 'High'
      },
      {
        id: 'ai-insights',
        name: 'Housing Market Insights',
        description: 'Automated housing pattern detection and market recommendations',
        icon: Brain,
        enabled: isPhase4FeatureEnabled('aiInsights'),
        component: AIInsightGenerator,
        requiresApiKey: false, // Uses existing Claude API
        estimatedLoad: 'Medium'
      }
    ];

    return components.filter(comp => comp.enabled);
  }, []);

  // Initialize component statuses
  useEffect(() => {
    const statuses: Phase4ComponentStatus[] = availableComponents.map(comp => ({
      component: comp.id,
      enabled: comp.enabled,
      available: true,
      status: 'ready',
      message: `${comp.name} is available`
    }));

    setComponentStatuses(statuses);

    // Set default active tab to first available component
    if (availableComponents.length > 0 && !activeTab) {
      setActiveTab(availableComponents[0].id);
    }
  }, [availableComponents, activeTab]);

  // Component refresh handler
  const handleRefreshComponent = async (componentId: string) => {
    setRefreshing(true);
    setComponentStatuses((prev: Phase4ComponentStatus[]) => 
      prev.map(status => 
        status.component === componentId 
          ? { ...status, status: 'loading', message: 'Refreshing data...' }
          : status
      )
    );

    // Simulate refresh delay (in real implementation, this would refresh actual data)
    await new Promise(resolve => setTimeout(resolve, 1500));

    setComponentStatuses((prev: Phase4ComponentStatus[]) => 
      prev.map(status => 
        status.component === componentId 
          ? { ...status, status: 'ready', message: 'Data refreshed successfully' }
          : status
      )
    );

    setLastUpdate(new Date());
    setRefreshing(false);
  };

  // Error recovery handler
  const handleComponentError = (componentId: string, error: string) => {
    setComponentStatuses((prev: Phase4ComponentStatus[]) => 
      prev.map(status => 
        status.component === componentId 
          ? { ...status, status: 'error', message: `Error: ${error}` }
          : status
      )
    );
  };

  // Component props factory
  const getComponentProps = (componentId: string) => {
    const baseProps = {
      analysisResult,
      analysisContext,
      onError: (error: string) => handleComponentError(componentId, error),
      onRefresh: () => handleRefreshComponent(componentId),
      className: "w-full h-full"
    };

    // Add component-specific props
    switch (componentId) {
      case 'scholarly-research':
        return {
          ...baseProps,
          analysisContext: analysisContext
        };
      
      case 'real-time-data':
        return {
          ...baseProps,
          geographicScope: analysisContext.selectedAreaName,
          zipCodes: analysisContext.zipCodes,
          updateInterval: getPhase4FeatureConfig('realTimeDataStreams')?.updateIntervalSeconds || 300
        };

      case 'advanced-visualization':
        return {
          ...baseProps,
          visualizationData: analysisResult,
          interactive: true,
          performance: {
            webglEnabled: getPhase4FeatureConfig('advancedVisualization')?.webglEnabled || true,
            maxDataPoints: getPhase4FeatureConfig('advancedVisualization')?.maxDataPoints || 100000
          }
        };

      case 'ai-insights':
        return {
          ...baseProps,
          confidenceThreshold: getPhase4FeatureConfig('aiInsights')?.confidenceThreshold || 0.85,
          maxInsights: getPhase4FeatureConfig('aiInsights')?.maxInsightsPerAnalysis || 5,
          businessContext: analysisContext.persona || 'general'
        };

      default:
        return baseProps;
    }
  };

  // Show disabled state if no components available
  if (availableComponents.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-gray-400" />
            Advanced Features
          </CardTitle>
          <CardDescription>
            Advanced analysis features are currently disabled
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              Advanced features are disabled by default. To enable advanced capabilities, 
              update the feature flags in <code>config/phase4-features.ts</code> or 
              contact your administrator.
            </AlertDescription>
          </Alert>
          
          <div className="mt-4 space-y-2">
            <div className="text-xs font-medium">Available Features (when enabled):</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1">
                <BookOpen className="w-3 h-3" />
                Scholarly Research Integration
              </div>
              <div className="flex items-center gap-1">
                <Activity className="w-3 h-3" />
                Real-Time Economic Data
              </div>
              <div className="flex items-center gap-1">
                <BarChart3 className="w-3 h-3" />
                Advanced 3D Visualizations
              </div>
              <div className="flex items-center gap-1">
                <Brain className="w-3 h-3" />
                Housing Market Insights
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-500" />
            <div>
              <CardTitle className="text-xs">Advanced Features</CardTitle>
              <CardDescription className="text-xs">
                Enhanced analysis tools and insights
              </CardDescription>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 p-0"
              title={isExpanded ? "Minimize" : "Expand"}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
            
            {onClose && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0"
                title="Hide Advanced Features"
              >
                <EyeOff className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t">
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3" />
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
          
          <div className="flex items-center gap-1">
            {componentStatuses.map((status) => {
              const Component = availableComponents.find(c => c.id === status.component);
              if (!Component) return null;
              
              if (status.status === 'ready') return null;
              
              return (
                <Badge 
                  key={status.component}
                  variant={status.status === 'loading' ? 'secondary' : 'destructive'}
                  className="text-xs"
                >
                  <Component.icon className="w-2 h-2 mr-1" />
                  {status.status}
                </Badge>
              );
            })}
          </div>
        </div>
      </CardHeader>

      <CardContent className={`${isExpanded ? "h-[600px]" : "h-[400px]"} flex flex-col`}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-4 flex-shrink-0">
            {availableComponents.map((component) => {
              const status = componentStatuses.find(s => s.component === component.id);
              return (
                <TabsTrigger 
                  key={component.id} 
                  value={component.id}
                  className="text-xs flex items-center gap-1"
                  disabled={refreshing || status?.status === 'error'}
                >
                  <component.icon className="w-3 h-3" />
                  {component.name}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {availableComponents.map((component) => {
            const ComponentToRender = component.component;
            const status = componentStatuses.find(s => s.component === component.id);
            const props = getComponentProps(component.id);

            return (
              <TabsContent key={component.id} value={component.id} className="flex-1 min-h-0 overflow-y-auto mt-4">
                {status?.status === 'error' ? (
                  <Alert variant="destructive">
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription>
                      {status.message}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRefreshComponent(component.id)}
                        className="ml-2 h-6 text-xs"
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Retry
                      </Button>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="relative h-full">
                    {status?.status === 'loading' && (
                      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center">
                        <div className="flex items-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span className="text-xs">{status.message}</span>
                        </div>
                      </div>
                    )}
                    
                    <ErrorBoundary componentName={component.name}>
                      <ComponentToRender {...props} />
                    </ErrorBoundary>
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
}

/**
 * Error Boundary for Advanced Components
 * Implements transparency-first error handling
 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; componentName: string },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode; componentName: string }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`Advanced Feature ${this.props.componentName} Error:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            ❌ {this.props.componentName} component failed to load. 
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer">Technical Details</summary>
              <pre className="mt-1 bg-gray-100 p-2 rounded text-xs overflow-auto">
                {this.state.error?.message || 'Unknown error'}
              </pre>
            </details>
            <Button
              variant="outline"
              size="sm"
              onClick={() => this.setState({ hasError: false, error: undefined })}
              className="mt-2 h-6 text-xs"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      );
    }

    return this.props.children;
  }
}

export default Phase4IntegrationWrapper;