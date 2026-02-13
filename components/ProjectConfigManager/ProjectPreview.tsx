/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Eye, 
  Play, 
  RotateCcw, 
  Download, 
  RefreshCw, 
  BarChart3, 
  Map, 
  Database, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  Globe, 
  Activity,
  TrendingUp,
  Maximize2,
  Minimize2,
  Split,
  GitCompare,
  Timer,
  FileText,
  Share2,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { 
  ProjectConfiguration, 
  ImpactAnalysis,
  LivePreviewConfiguration,
  PreviewState,
  PreviewData,
  PreviewPerformanceMetrics,
  PreviewValidationResult,
  DifferenceAnalysis,
  PreviewMode,
  PreviewSettings,
  PreviewLayerData,
  PreviewGroupData,
  ComparisonPreviewConfig,
  PerformanceAlert,
  PerformanceRecommendation
} from '@/types/project-config';

interface ProjectPreviewProps {
  config: ProjectConfiguration;
  impactAnalysis: ImpactAnalysis | null;
  onConfigurationChange?: (config: ProjectConfiguration) => void;
  onPreviewModeChange?: (mode: PreviewMode) => void;
}

export const ProjectPreview: React.FC<ProjectPreviewProps> = ({
  config,
  onPreviewModeChange
}) => {
  // State Management
  const [activeTab, setActiveTab] = useState<'preview' | 'comparison' | 'performance' | 'export'>('preview');
  const [previewState, setPreviewState] = useState<PreviewState & { mapPreview: { isLoaded: boolean; isLoading: boolean; lastLoadTime: number; loadTime?: number } }>({
    isLoading: false,
    isError: false,
    currentConfiguration: config,
    previewData: null,
    performanceMetrics: null,
    validationResults: [],
    userInteractions: [],
    lastUpdateTime: new Date().toISOString(),
    mapPreview: {
      isLoaded: false,
      isLoading: false,
      lastLoadTime: Date.now(),
      loadTime: undefined
    }
  });

  const [livePreviewConfig, setLivePreviewConfig] = useState<LivePreviewConfiguration>({
    id: 'live-preview-' + Date.now(),
    name: 'Live Preview',
    description: 'Real-time preview of project configuration',
    isActive: true,
    previewMode: {
      type: 'single',
      configuration: {
        projectConfiguration: config,
        viewMode: 'combined',
        highlightChanges: true,
        showMetadata: true
      }
    },
    realTimeUpdates: true,
    autoRefresh: true,
    refreshInterval: 5,
    previewSettings: getDefaultPreviewSettings(),
    mapConfiguration: getDefaultMapConfiguration(),
    dataConfiguration: getDefaultDataConfiguration(),
    performanceMetrics: getDefaultPerformanceMetrics(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const [comparisonConfig, setComparisonConfig] = useState<ComparisonPreviewConfig | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5);
  const refreshIntervalRef = useRef<NodeJS.Timeout>();

  // Effects
  useEffect(() => {
    if (autoRefreshEnabled && !previewState.isLoading) {
      refreshIntervalRef.current = setInterval(() => {
        handleRefreshPreview();
      }, refreshInterval * 1000);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefreshEnabled, refreshInterval, previewState.isLoading]);

  useEffect(() => {
    setPreviewState((prev: any) => ({
      ...prev,
      currentConfiguration: config,
      lastUpdateTime: new Date().toISOString()
    }));
    
    if (autoRefreshEnabled) {
      handleRefreshPreview();
    }
  }, [config]);

  // Event Handlers
  const handleRefreshPreview = useCallback(async () => {
    setPreviewState((prev: any) => ({ ...prev, isLoading: true, isError: false }));

    try {
      // Simulate preview data generation
      const mockPreviewData = await generateMockPreviewData(config);
      const mockPerformanceMetrics = await generateMockPerformanceMetrics();
      const mockValidationResults = await generateMockValidationResults(config);

      setPreviewState((prev: any) => ({
        ...prev,
        isLoading: false,
        previewData: mockPreviewData,
        performanceMetrics: mockPerformanceMetrics,
        validationResults: mockValidationResults,
        lastUpdateTime: new Date().toISOString()
      }));
    } catch (error) {
      setPreviewState((prev: any) => ({
        ...prev,
        isLoading: false,
        isError: true,
        errorMessage: error instanceof Error ? error.message : 'Failed to refresh preview'
      }));
    }
  }, [config]);

  const handlePreviewModeChange = (newMode: PreviewMode) => {
    setLivePreviewConfig((prev: any) => ({
      ...prev,
      previewMode: newMode,
      updatedAt: new Date().toISOString()
    }));
    
    onPreviewModeChange?.(newMode);
  };


  const handleExportPreview = async (format: 'json' | 'pdf' | 'html') => {
    try {
      const exportData = {
        configuration: config,
        previewData: previewState.previewData,
        performanceMetrics: previewState.performanceMetrics,
        validationResults: previewState.validationResults,
        timestamp: new Date().toISOString()
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `${config.name}_preview_${format}.${format === 'json' ? 'json' : format}`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } catch (error) {
      console.error('Failed to export preview:', error);
    }
  };

  // Render Functions
  const renderPreviewHeader = () => (
    <div className="flex items-center justify-between p-4 border-b">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${previewState.isLoading ? 'bg-yellow-500 animate-pulse' : previewState.isError ? 'bg-red-500' : 'bg-green-500'}`} />
          <span className="font-medium">
            {previewState.isLoading ? 'Loading...' : previewState.isError ? 'Error' : 'Live Preview'}
          </span>
        </div>
        
        <Badge variant="outline">
          {Object.keys(config.layers).length} Layers
        </Badge>
        
        <Badge variant="outline">
          {config.groups.length} Groups
        </Badge>
      </div>

      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-2">
          <Switch
            checked={autoRefreshEnabled}
            onCheckedChange={setAutoRefreshEnabled}
            id="auto-refresh"
          />
          <Label htmlFor="auto-refresh" className="text-sm">Auto-refresh</Label>
        </div>

        <Select value={refreshInterval.toString()} onValueChange={(value) => setRefreshInterval(parseInt(value))}>
          <SelectTrigger className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1s</SelectItem>
            <SelectItem value="5">5s</SelectItem>
            <SelectItem value="10">10s</SelectItem>
            <SelectItem value="30">30s</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRefreshPreview}
          disabled={previewState.isLoading}
        >
          <RefreshCw className={`h-4 w-4 ${previewState.isLoading ? 'animate-spin' : ''}`} />
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsFullscreen(!isFullscreen)}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );

  const renderLivePreview = () => (
    <div className="space-y-6">
      {/* Preview Mode Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Eye className="h-5 w-5" />
            <span>Preview Mode</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <Button
              variant={livePreviewConfig.previewMode.type === 'single' ? 'default' : 'outline'}
              onClick={() => handlePreviewModeChange({ type: 'single', configuration: { projectConfiguration: config, viewMode: 'combined', highlightChanges: true, showMetadata: true } })}
              className="flex flex-col items-center p-4 h-auto"
            >
              <Map className="h-6 w-6 mb-2" />
              <span>Single View</span>
            </Button>
            
            <Button
              variant={livePreviewConfig.previewMode.type === 'comparison' ? 'default' : 'outline'}
              onClick={() => setActiveTab('comparison')}
              className="flex flex-col items-center p-4 h-auto"
            >
              <Split className="h-6 w-6 mb-2" />
              <span>Comparison</span>
            </Button>
            
            <Button
              variant={livePreviewConfig.previewMode.type === 'timeline' ? 'default' : 'outline'}
              className="flex flex-col items-center p-4 h-auto"
              disabled
            >
              <Clock className="h-6 w-6 mb-2" />
              <span>Timeline</span>
              <Badge variant="secondary" className="mt-1 text-xs">Coming Soon</Badge>
            </Button>
            
            <Button
              variant={livePreviewConfig.previewMode.type === 'interactive' ? 'default' : 'outline'}
              className="flex flex-col items-center p-4 h-auto"
              disabled
            >
              <Activity className="h-6 w-6 mb-2" />
              <span>Interactive</span>
              <Badge variant="secondary" className="mt-1 text-xs">Coming Soon</Badge>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Layer Preview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Map Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Globe className="h-5 w-5" />
              <span>Map Preview</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="aspect-video bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 relative overflow-hidden">
              {previewState.mapPreview.isLoaded ? (
                <div className="w-full h-full relative bg-gradient-to-br from-blue-50 to-green-50">
                  {/* Mock Map Background */}
                  <div className="absolute inset-0 opacity-20">
                    <svg width="100%" height="100%" viewBox="0 0 400 300">
                      {/* Grid pattern for map */}
                      <defs>
                        <pattern id="mapGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#94a3b8" strokeWidth="1" opacity="0.3"/>
                        </pattern>
                      </defs>
                      <rect width="100%" height="100%" fill="url(#mapGrid)" />
                      
                      {/* Mock geographic features */}
                      <path d="M50,50 Q100,30 150,50 T250,60 L250,120 Q200,140 150,120 T50,110 Z" 
                            fill="#3b82f6" opacity="0.6" />
                      <path d="M300,80 Q350,60 380,90 L380,150 Q350,170 300,150 Z" 
                            fill="#10b981" opacity="0.6" />
                      <circle cx="200" cy="150" r="30" fill="#f59e0b" opacity="0.6" />
                      <rect x="100" y="200" width="60" height="40" fill="#8b5cf6" opacity="0.6" />
                    </svg>
                  </div>
                  
                  {/* Layer indicators */}
                  <div className="absolute top-4 left-4 space-y-2">
                    {Object.entries(config.layers).slice(0, 5).map(([layerId, layer], index) => (
                      <div key={layerId} className="flex items-center gap-2 bg-white/80 backdrop-blur-sm px-2 py-1 rounded text-xs">
                        <div className={`w-3 h-3 rounded-full ${
                          index === 0 ? 'bg-blue-500' :
                          index === 1 ? 'bg-green-500' :
                          index === 2 ? 'bg-orange-500' :
                          index === 3 ? 'bg-purple-500' : 'bg-gray-500'
                        }`} />
                        <span className="font-medium">{layer.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {layer.status || 'active'}
                        </Badge>
                      </div>
                    ))}
                    {Object.keys(config.layers).length > 5 && (
                      <div className="text-xs text-gray-600 bg-white/80 backdrop-blur-sm px-2 py-1 rounded">
                        +{Object.keys(config.layers).length - 5} more layers
                      </div>
                    )}
                  </div>
                  
                  {/* Map controls */}
                  <div className="absolute top-4 right-4 space-y-2">
                    <Button size="sm" variant="outline" className="bg-white/80 backdrop-blur-sm">
                      <ZoomIn className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="bg-white/80 backdrop-blur-sm">
                      <ZoomOut className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="bg-white/80 backdrop-blur-sm">
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  {/* Performance indicator */}
                  <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm border rounded-lg p-2 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span>Live Preview Active</span>
                    </div>
                    <div className="text-gray-500 mt-1">
                      {Object.keys(config.layers).length} layers • {previewState.performanceMetrics?.loadTime || 1200}ms
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Map className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 mb-2">Interactive Map Preview</p>
                    <p className="text-sm text-gray-400 mb-4">
                      {Object.keys(config.layers).length} layers ready to display
                    </p>
                    <Button 
                      className="mt-4" 
                      onClick={() => {
                        setPreviewState((prev: any) => ({
                          ...prev,
                          mapPreview: {
                            ...prev.mapPreview,
                            isLoading: true
                          }
                        }));
                        
                        // Simulate map loading
                        setTimeout(() => {
                          setPreviewState((prev: any) => ({
                            ...prev,
                            mapPreview: {
                              ...prev.mapPreview,
                              isLoading: false,
                              isLoaded: true,
                              loadTime: Date.now() - prev.mapPreview.lastLoadTime
                            }
                          }));
                        }, 2000);
                      }}
                      disabled={previewState.mapPreview.isLoading}
                    >
                      {previewState.mapPreview.isLoading ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Loading Map...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Load Map Preview
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Data Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Database className="h-5 w-5" />
              <span>Data Preview</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-80">
              {previewState.previewData?.layers.map((layer) => (
                <div key={layer.layerId} className="mb-4 p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{layer.name}</h4>
                    <Badge variant={layer.status === 'loaded' ? 'default' : layer.status === 'loading' ? 'secondary' : 'destructive'}>
                      {layer.status}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Records:</span>
                      <span className="ml-2 font-medium">{layer.recordCount.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Type:</span>
                      <span className="ml-2 font-medium">{layer.geometryType}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Fields:</span>
                      <span className="ml-2 font-medium">{layer.fields.length}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Visible:</span>
                      <span className="ml-2 font-medium">{layer.renderingInfo.visible ? 'Yes' : 'No'}</span>
                    </div>
                  </div>

                  {layer.fields.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm text-gray-500 mb-2">Sample Fields:</p>
                      <div className="flex flex-wrap gap-1">
                        {layer.fields.slice(0, 5).map((field) => (
                          <Badge key={field.name} variant="outline" className="text-xs">
                            {field.alias || field.name}
                          </Badge>
                        ))}
                        {layer.fields.length > 5 && (
                          <Badge variant="outline" className="text-xs">
                            +{layer.fields.length - 5} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )) || (
                <div className="text-center py-8">
                  <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 mb-2">No preview data available</p>
                  <Button onClick={handleRefreshPreview} disabled={previewState.isLoading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${previewState.isLoading ? 'animate-spin' : ''}`} />
                    Load Preview Data
                  </Button>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Validation Results */}
      {previewState.validationResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5" />
              <span>Validation Results</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {previewState.validationResults.map((result, index) => (
                <Alert key={index} className={result.status === 'error' ? 'border-red-200' : result.status === 'warning' ? 'border-yellow-200' : 'border-green-200'}>
                  {result.status === 'error' ? <AlertTriangle className="h-4 w-4" /> : 
                   result.status === 'warning' ? <Info className="h-4 w-4" /> : 
                   <CheckCircle className="h-4 w-4" />}
                  <AlertDescription>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{result.message}</p>
                        {result.details && <p className="text-sm text-gray-600 mt-1">{result.details}</p>}
                      </div>
                      {result.autoFixAvailable && (
                        <Button size="sm" variant="outline">
                          Auto Fix
                        </Button>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderConfigurationComparison = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <GitCompare className="h-5 w-5" />
            <span>Configuration Comparison</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <GitCompare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">Compare configurations to identify differences</p>
            <div className="space-y-4 max-w-md mx-auto">
              <div>
                <Label htmlFor="base-config">Base Configuration</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select base configuration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">Current Configuration</SelectItem>
                    <SelectItem value="template">Template Configuration</SelectItem>
                    <SelectItem value="previous">Previous Version</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="target-config">Target Configuration</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select target configuration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">Current Configuration</SelectItem>
                    <SelectItem value="template">Template Configuration</SelectItem>
                    <SelectItem value="modified">Modified Configuration</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Button className="w-full" disabled>
                <GitCompare className="h-4 w-4 mr-2" />
                Start Comparison
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderPerformanceMonitor = () => (
    <div className="space-y-6">
      {/* Performance Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Timer className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Load Time</span>
            </div>
            <p className="text-2xl font-bold mt-2">
              {previewState.performanceMetrics?.loadTime || 0}ms
            </p>
            <p className="text-xs text-gray-500 mt-1">Average load time</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Memory</span>
            </div>
            <p className="text-2xl font-bold mt-2">
              {previewState.performanceMetrics?.memoryUsage || 0}MB
            </p>
            <p className="text-xs text-gray-500 mt-1">Current usage</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Globe className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium">Requests</span>
            </div>
            <p className="text-2xl font-bold mt-2">
              {previewState.performanceMetrics?.networkRequests || 0}
            </p>
            <p className="text-xs text-gray-500 mt-1">Network requests</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium">Errors</span>
            </div>
            <p className="text-2xl font-bold mt-2">
              {previewState.performanceMetrics?.errorCount || 0}
            </p>
            <p className="text-xs text-gray-500 mt-1">Error count</p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5" />
            <span>Performance Alerts</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {generateMockPerformanceAlerts().map((alert, index) => (
              <Alert key={index} className={alert.severity === 'critical' ? 'border-red-200' : alert.severity === 'warning' ? 'border-yellow-200' : 'border-blue-200'}>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{alert.message}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        Current: {alert.currentValue} | Threshold: {alert.threshold}
                      </p>
                    </div>
                    <Badge variant={alert.severity === 'critical' ? 'destructive' : alert.severity === 'warning' ? 'secondary' : 'default'}>
                      {alert.severity}
                    </Badge>
                  </div>
                </AlertDescription>
              </Alert>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Performance Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5" />
            <span>Optimization Recommendations</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {generateMockPerformanceRecommendations().map((rec, index) => (
              <div key={index} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{rec.description}</h4>
                  <Badge variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'secondary' : 'outline'}>
                    {rec.priority} priority
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 mb-2">{rec.implementation}</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-green-600">Expected Impact: {rec.expectedImpact}</span>
                  <span className="text-gray-500">Effort: {rec.estimatedEffort}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderExportOptions = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Download className="h-5 w-5" />
            <span>Export Preview</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              onClick={() => handleExportPreview('json')}
              className="flex flex-col items-center p-6 h-auto"
              variant="outline"
            >
              <FileText className="h-8 w-8 mb-2" />
              <span className="font-medium">JSON Export</span>
              <span className="text-sm text-gray-500 mt-1">Raw configuration data</span>
            </Button>

            <Button
              onClick={() => handleExportPreview('pdf')}
              className="flex flex-col items-center p-6 h-auto"
              variant="outline"
              disabled
            >
              <FileText className="h-8 w-8 mb-2" />
              <span className="font-medium">PDF Report</span>
              <span className="text-sm text-gray-500 mt-1">Formatted report</span>
              <Badge variant="secondary" className="mt-2 text-xs">Coming Soon</Badge>
            </Button>

            <Button
              onClick={() => handleExportPreview('html')}
              className="flex flex-col items-center p-6 h-auto"
              variant="outline"
              disabled
            >
              <Globe className="h-8 w-8 mb-2" />
              <span className="font-medium">HTML Preview</span>
              <span className="text-sm text-gray-500 mt-1">Interactive web page</span>
              <Badge variant="secondary" className="mt-2 text-xs">Coming Soon</Badge>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Share2 className="h-5 w-5" />
            <span>Share Preview</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="share-url">Shareable Preview URL</Label>
              <div className="flex space-x-2 mt-1">
                <Input
                  id="share-url"
                  value={`${window.location.origin}/preview/${livePreviewConfig.id}`}
                  readOnly
                />
                <Button variant="outline" disabled>
                  Copy
                </Button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Share this URL to allow others to view the preview (read-only)
              </p>
            </div>

            <div>
              <Label htmlFor="embed-code">Embed Code</Label>
              <Textarea
                id="embed-code"
                value={`<iframe src="${window.location.origin}/preview/${livePreviewConfig.id}/embed" width="800" height="600" frameborder="0"></iframe>`}
                readOnly
                className="mt-1"
                rows={3}
              />
              <p className="text-sm text-gray-500 mt-1">
                Embed this preview in external websites or documentation
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className={`h-full flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-white' : ''}`}>
      {renderPreviewHeader()}
      
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="preview" className="flex items-center space-x-2">
              <Eye className="h-4 w-4" />
              <span>Live Preview</span>
            </TabsTrigger>
            <TabsTrigger value="comparison" className="flex items-center space-x-2">
              <GitCompare className="h-4 w-4" />
              <span>Comparison</span>
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4" />
              <span>Performance</span>
            </TabsTrigger>
            <TabsTrigger value="export" className="flex items-center space-x-2">
              <Download className="h-4 w-4" />
              <span>Export</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto">
            <TabsContent value="preview" className="h-full p-6">
              {renderLivePreview()}
            </TabsContent>

            <TabsContent value="comparison" className="h-full p-6">
              {renderConfigurationComparison()}
            </TabsContent>

            <TabsContent value="performance" className="h-full p-6">
              {renderPerformanceMonitor()}
            </TabsContent>

            <TabsContent value="export" className="h-full p-6">
              {renderExportOptions()}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
};

// Helper Functions
function getDefaultPreviewSettings(): PreviewSettings {
  return {
    mapSettings: {
      basemap: 'streets',
      zoom: {
        min: 1,
        max: 20,
        initial: 10
      },
      center: {
        latitude: 40.7128,
        longitude: -74.0060
      }
    },
    layerSettings: {
      defaultOpacity: 0.8,
      maxVisibleLayers: 10,
      renderingMode: 'balanced',
      symbolization: 'default'
    },
    uiSettings: {
      showLegend: true,
      showLayerList: true,
      showMeasurementTools: false,
      showSearchTool: true,
      compactMode: false,
      theme: 'auto'
    },
    dataSettings: {
      maxRecordsPerLayer: 1000,
      enableCaching: true,
      cacheTimeout: 30,
      enableClustering: true,
      clusteringDistance: 50
    }
  };
}

function getDefaultMapConfiguration(): any {
  return {
    mapLibrary: 'arcgis',
    apiKeys: {},
    basemapOptions: [
      { id: 'streets', name: 'Streets', type: 'tile' },
      { id: 'satellite', name: 'Satellite', type: 'tile' },
      { id: 'hybrid', name: 'Hybrid', type: 'tile' }
    ],
    defaultBasemap: 'streets',
    mapExtent: {
      xmin: -180,
      ymin: -90,
      xmax: 180,
      ymax: 90,
      spatialReference: { wkid: 4326 }
    },
    projectionSettings: {
      inputProjection: 4326,
      outputProjection: 3857
    },
    renderingSettings: {
      antialiasing: true,
      transparency: true,
      decluttering: true,
      labelingEnabled: true,
      symbolQuality: 'medium',
      textHinting: true
    }
  };
}

function getDefaultDataConfiguration(): any {
  return {
    sampleDataSize: 100,
    enableRealTimeData: false,
    dataRefreshInterval: 30,
    dataValidation: {
      enableValidation: true,
      validationRules: [],
      showValidationErrors: true,
      strictMode: false
    },
    statisticsCalculation: {
      enableStatistics: true,
      autoCalculate: true,
      statisticTypes: ['count', 'sum', 'avg'],
      groupByFields: [],
      updateInterval: 60
    },
    spatialAnalysis: {
      enableSpatialAnalysis: false,
      analysisTypes: ['buffer', 'intersect'],
      defaultBufferDistance: 100,
      defaultBufferUnits: 'meters',
      enableGeometryValidation: true
    }
  };
}

function getDefaultPerformanceMetrics(): PreviewPerformanceMetrics {
  return {
    loadTime: 0,
    renderTime: 0,
    memoryUsage: 0,
    networkRequests: 0,
    dataTransferred: 0,
    errorCount: 0,
    warningCount: 0,
    lastUpdated: new Date().toISOString(),
    historicalMetrics: []
  };
}

async function generateMockPreviewData(config: ProjectConfiguration): Promise<PreviewData> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  const layers: PreviewLayerData[] = Object.values(config.layers).map((layer) => ({
    layerId: layer.id,
    name: layer.name,
    recordCount: Math.floor(Math.random() * 10000) + 100,
    geometryType: ['Point', 'Polygon', 'Polyline'][Math.floor(Math.random() * 3)],
    extent: {
      xmin: -180,
      ymin: -90,
      xmax: 180,
      ymax: 90,
      spatialReference: { wkid: 4326 }
    },
    fields: layer.fields?.map(field => ({
      name: field.name,
      type: field.type,
      alias: field.alias,
      uniqueValues: [],
      statistics: {
        count: Math.floor(Math.random() * 1000),
        min: Math.random() * 100,
        max: Math.random() * 1000 + 100,
        avg: Math.random() * 500 + 50
      },
      nullCount: Math.floor(Math.random() * 50),
      sampleValues: ['Sample 1', 'Sample 2', 'Sample 3']
    })) || [],
    sampleData: [],
    renderingInfo: {
      renderer: {},
      transparency: layer.projectOverrides?.priority || 80,
      visible: layer.projectOverrides?.isVisible !== false,
      minScale: 0,
      maxScale: 0
    },
    status: Math.random() > 0.1 ? 'loaded' : 'error',
    errorMessage: Math.random() > 0.9 ? 'Failed to load layer data' : undefined
  }));

  const groups: PreviewGroupData[] = config.groups.map(group => ({
    groupId: group.id,
    name: group.name,
    layerCount: group.layers.length,
    visibleLayerCount: Math.floor(group.layers.length * 0.7),
    totalRecordCount: Math.floor(Math.random() * 50000) + 1000,
    isExpanded: !group.isCollapsed,
    status: 'loaded'
  }));

  return {
    layers,
    groups,
    statistics: {
      totalLayers: layers.length,
      activeLayers: layers.filter(l => l.status === 'loaded').length,
      totalRecords: layers.reduce((sum, l) => sum + l.recordCount, 0),
      averageLoadTime: Math.random() * 2000 + 500,
      dataTransferred: Math.random() * 1000 + 100,
      cacheHitRate: Math.random() * 100,
      errorRate: Math.random() * 10
    },
    spatialExtent: {
      xmin: -180,
      ymin: -90,
      xmax: 180,
      ymax: 90,
      spatialReference: { wkid: 4326 }
    },
    dataQuality: {
      completeness: Math.random() * 20 + 80,
      accuracy: Math.random() * 15 + 85,
      consistency: Math.random() * 25 + 75,
      validity: Math.random() * 10 + 90,
      issues: []
    }
  };
}

async function generateMockPerformanceMetrics(): Promise<PreviewPerformanceMetrics> {
  await new Promise(resolve => setTimeout(resolve, 500));

  return {
    loadTime: Math.floor(Math.random() * 3000) + 500,
    renderTime: Math.floor(Math.random() * 1000) + 200,
    memoryUsage: Math.floor(Math.random() * 500) + 100,
    networkRequests: Math.floor(Math.random() * 50) + 10,
    dataTransferred: Math.floor(Math.random() * 2000) + 500,
    errorCount: Math.floor(Math.random() * 5),
    warningCount: Math.floor(Math.random() * 10),
    lastUpdated: new Date().toISOString(),
    historicalMetrics: []
  };
}

async function generateMockValidationResults(config: ProjectConfiguration): Promise<PreviewValidationResult[]> {
  const results: PreviewValidationResult[] = [];

  // Configuration validation
  results.push({
    type: 'configuration',
    status: 'pass',
    message: 'Configuration structure is valid',
    autoFixAvailable: false
  });

  // Performance validation
  if (Object.keys(config.layers).length > 20) {
    results.push({
      type: 'performance',
      status: 'warning',
      message: 'High number of layers may impact performance',
      details: `${Object.keys(config.layers).length} layers detected. Consider grouping or lazy loading.`,
      suggestion: 'Enable layer grouping and lazy loading for better performance',
      autoFixAvailable: true
    });
  }

  // Data validation
  results.push({
    type: 'data',
    status: 'pass',
    message: 'All layer data sources are accessible',
    autoFixAvailable: false
  });

  return results;
}


function generateMockPerformanceAlerts(): PerformanceAlert[] {
  return [
    {
      type: 'memory',
      severity: 'warning',
      message: 'Memory usage approaching threshold',
      threshold: 500,
      currentValue: 450,
      suggestion: 'Consider reducing the number of visible layers'
    },
    {
      type: 'load_time',
      severity: 'info',
      message: 'Load time within acceptable range',
      threshold: 3000,
      currentValue: 1250
    }
  ];
}

function generateMockPerformanceRecommendations(): PerformanceRecommendation[] {
  return [
    {
      type: 'optimization',
      priority: 'high',
      description: 'Enable layer clustering for point data',
      implementation: 'Add clustering configuration to point layers with high feature counts',
      expectedImpact: 'Reduce render time by 40-60%',
      estimatedEffort: 'low'
    },
    {
      type: 'configuration',
      priority: 'medium',
      description: 'Optimize layer visibility settings',
      implementation: 'Set appropriate min/max scale ranges for detailed layers',
      expectedImpact: 'Improve map performance at different zoom levels',
      estimatedEffort: 'medium'
    }
  ];
} 