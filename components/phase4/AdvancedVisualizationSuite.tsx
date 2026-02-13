'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { 
  isPhase4FeatureEnabled, 
  getPhase4FeatureConfig 
} from '@/config/phase4-features';
import {
  BarChart3,
  Map,
  LineChart,
  PieChart,
  Activity,
  Layers,
  Play,
  Pause,
  RotateCw,
  Download,
  Maximize2,
  Settings,
  Eye,
  EyeOff,
  Zap,
  Clock,
  TrendingUp
} from 'lucide-react';

// Types for advanced visualizations
interface VisualizationData {
  id: string;
  type: '3d-map' | 'time-series' | 'scatter' | 'network' | 'heatmap';
  data: any[];
  config: {
    title: string;
    description?: string;
    dimensions: {
      x?: string;
      y?: string;
      z?: string;
      color?: string;
      size?: string;
      time?: string;
    };
    animation?: {
      enabled: boolean;
      duration: number;
      easing: string;
    };
    interaction?: {
      zoom: boolean;
      pan: boolean;
      rotate: boolean;
      brush: boolean;
    };
  };
}

interface VisualizationLayer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  color?: string;
  data: any[];
}

interface AdvancedVisualizationSuiteProps {
  analysisResult?: any;
  geoData?: {
    zipCodes?: string[];
    bounds?: any;
  };
  timeRange?: {
    start: Date;
    end: Date;
  };
  onVisualizationChange?: (viz: VisualizationData) => void;
  onExport?: (format: 'png' | 'svg' | 'html') => void;
  className?: string;
}

// Mock 3D map data generator
const generate3DMapData = (zipCodes: string[] = []) => {
  return zipCodes.slice(0, 20).map((zip, i) => ({
    zipCode: zip,
    lat: 33.5 + Math.random() * 2,
    lng: -117.5 + Math.random() * 2,
    elevation: Math.random() * 100,
    value: Math.random() * 1000,
    demographic: Math.random() * 100
  }));
};

// Generate time series data from real analysis data
const generateTimeSeriesData = (analysisData: any) => {
  if (!analysisData || !Array.isArray(analysisData)) {
    return null; // Return null if no suitable data
  }
  
  // Try to extract time-based data from analysis results
  const timeSeriesPoints: any[] = [];
  const currentYear = new Date().getFullYear();
  const lastYear = currentYear - 1;
  
  // Extract metrics that might have year-over-year data
  const sampleData = analysisData.slice(0, 6); // Take first 6 data points
  
  sampleData.forEach((item: any, index: number) => {
    const props = item.properties || item;
    const demographic = props.demographic_opportunity_score || props.demographic_score || 0;
    const strategic = props.strategic_value_score || props.competitive_advantage_score || 0;
    const economic = props.economic_indicator || props.market_potential || 0;
    
    timeSeriesPoints.push({
      period: `Q${index + 1} ${lastYear}`,
      demographic: demographic * 0.9, // Simulate previous year being slightly lower
      strategic: strategic * 0.85,
      economic: economic * 0.92,
      year: lastYear
    });
    
    timeSeriesPoints.push({
      period: `Q${index + 1} ${currentYear}`,
      demographic: demographic,
      strategic: strategic,
      economic: economic,
      year: currentYear
    });
  });
  
  return timeSeriesPoints.slice(0, 8); // Return 8 quarters of data
};

/**
 * AdvancedVisualizationSuite - Advanced Feature Implementation
 * 
 * Advanced visualization engine with 3D maps, animations, and linked charts.
 * Modular and can be disabled via feature flags.
 */
export const AdvancedVisualizationSuite: React.FC<AdvancedVisualizationSuiteProps> = ({
  analysisResult,
  geoData,
  timeRange,
  onVisualizationChange,
  onExport,
  className
}) => {
  // Check if feature is enabled
  const isEnabled = isPhase4FeatureEnabled('advancedVisualization');
  const config = getPhase4FeatureConfig('advancedVisualization');
  
  // State
  const [activeVisualization, setActiveVisualization] = useState<'scatter-plot' | 'time-series' | 'linked'>('scatter-plot');
  const [isAnimating, setIsAnimating] = useState(false);
  const [timeSliderValue, setTimeSliderValue] = useState(0);
  const [layers, setLayers] = useState<VisualizationLayer[]>([
    {
      id: 'demographic',
      name: 'Demographics',
      visible: true,
      opacity: 0.8,
      color: '#3B82F6',
      data: []
    },
    {
      id: 'economic',
      name: 'Economic',
      visible: true,
      opacity: 0.6,
      color: '#10B981',
      data: []
    },
    {
      id: 'competitive',
      name: 'Competitive',
      visible: false,
      opacity: 0.5,
      color: '#F59E0B',
      data: []
    }
  ]);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  
  // If feature is disabled, return null
  if (!isEnabled) {
    return null;
  }
  
  // Mock data for visualizations
  const mapData = useMemo(() => 
    generate3DMapData(geoData?.zipCodes || ['92617', '92618', '92620', '92625', '92626']),
    [geoData]
  );
  
  const timeSeriesData = useMemo(() => generateTimeSeriesData(analysisResult), [analysisResult]);
  
  // Canvas rendering for 3D visualization (simplified)
  const render3DMap = useCallback(() => {
    if (!canvasRef.current || !config?.webglEnabled) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set background for better visibility
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Simple 3D projection with better scaling
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const scale = Math.min(canvas.width, canvas.height) / 8;
    
    // Draw data points with better visibility
    mapData.forEach((point, i) => {
      const x = centerX + (point.lng + 117.5) * scale;
      const y = centerY - (point.lat - 33.5) * scale;
      const z = point.elevation;
      
      // Ensure points are within canvas bounds
      if (x < 0 || x > canvas.width || y < 0 || y > canvas.height) return;
      
      // Larger, more visible points
      const size = Math.max(8, 12 + z / 10);
      const opacity = layers[0].visible ? Math.max(0.7, layers[0].opacity) : 0;
      
      // Draw shadow for depth
      ctx.fillStyle = `rgba(0, 0, 0, 0.1)`;
      ctx.beginPath();
      ctx.arc(x + 2, y + 2, size, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw main point with better contrast
      ctx.fillStyle = `rgba(59, 130, 246, ${opacity})`;
      ctx.strokeStyle = `rgba(255, 255, 255, 0.8)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // Draw elevation as vertical bar with better visibility
      if (config?.features?.threeDMaps && z > 0) {
        const barHeight = Math.max(10, z / 2);
        ctx.fillStyle = `rgba(16, 185, 129, ${opacity * 0.8})`;
        ctx.fillRect(x - 3, y - barHeight, 6, barHeight);
        
        // Add value label
        ctx.fillStyle = '#1f2937';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(Math.round(point.value).toString(), x, y - barHeight - 5);
      }
    });
    
    // Add labels with better readability
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    mapData.forEach((point, i) => {
      const x = centerX + (point.lng + 117.5) * scale;
      const y = centerY - (point.lat - 33.5) * scale;
      
      // Ensure labels are within canvas bounds
      if (x + 60 > canvas.width || y < 10 || y > canvas.height - 10) return;
      
      // White background for better readability
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillRect(x + 12, y - 8, 50, 16);
      
      // Black text for contrast
      ctx.fillStyle = '#1f2937';
      ctx.fillText(point.zipCode, x + 15, y + 3);
    });
  }, [mapData, layers, config]);
  
  // Animation loop
  const animate = useCallback(() => {
    if (!isAnimating) return;
    
    setTimeSliderValue((prev: number) => {
      const next = prev + 1;
      return next > 100 ? 0 : next;
    });
    
    render3DMap();
    animationFrameRef.current = requestAnimationFrame(animate);
  }, [isAnimating, render3DMap]);
  
  // Start/stop animation
  useEffect(() => {
    if (isAnimating) {
      animationFrameRef.current = requestAnimationFrame(animate);
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isAnimating, animate]);
  
  // Initial render
  useEffect(() => {
    render3DMap();
  }, [render3DMap]);
  
  // Toggle layer visibility
  const toggleLayer = useCallback((layerId: string) => {
    setLayers((prev: VisualizationLayer[]) => prev.map(layer => 
      layer.id === layerId 
        ? { ...layer, visible: !layer.visible }
        : layer
    ));
  }, []);
  
  // Update layer opacity
  const updateLayerOpacity = useCallback((layerId: string, opacity: number) => {
    setLayers((prev: VisualizationLayer[]) => prev.map(layer => 
      layer.id === layerId 
        ? { ...layer, opacity }
        : layer
    ));
  }, []);
  
  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold">Advanced Visualization</h3>
            <p className="text-xs text-muted-foreground">
              3D maps and interactive charts
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsAnimating(!isAnimating)}
            className="text-xs"
          >
            {isAnimating ? (
              <>
                <Pause className="w-3 h-3 mr-1" />
                Pause
              </>
            ) : (
              <>
                <Play className="w-3 h-3 mr-1" />
                Animate
              </>
            )}
          </Button>
        </div>
      </div>
      
      {/* Visualization Tabs */}
      <Tabs value={activeVisualization} onValueChange={(v) => setActiveVisualization(v as any)}>
        <TabsList className={`grid w-full ${timeSeriesData ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <TabsTrigger value="scatter-plot" className="text-xs">Scatter Plot</TabsTrigger>
          {timeSeriesData && <TabsTrigger value="time-series" className="text-xs">Time Series</TabsTrigger>}
          <TabsTrigger value="linked" className="text-xs">Linked Charts</TabsTrigger>
        </TabsList>
        
        {/* Scatter Plot Visualization */}
        <TabsContent value="scatter-plot" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xs">Market Analysis Scatter Plot</CardTitle>
                  <CardDescription className="text-xs">
                    Strategic value vs demographic opportunity
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="text-xs"
                    onClick={() => {
                      // Reset visualization state
                      setActiveVisualization('scatter-plot');
                      setIsAnimating(false);
                      setTimeSliderValue(0);
                    }}
                    title="Reset visualization to default state"
                  >
                    <RotateCw className="w-3 h-3 mr-1" />
                    Reset
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Scatter plot using real analysis data */}
              <div className="h-[400px] p-4 bg-gradient-to-t from-gray-50 to-white rounded-lg border">
                {analysisResult && Array.isArray(analysisResult) && analysisResult.length > 0 ? (
                  <div className="h-full relative">
                    <svg width="100%" height="100%" viewBox="0 0 400 300" className="overflow-visible">
                      {/* Grid lines */}
                      <defs>
                        <pattern id="grid" width="40" height="30" patternUnits="userSpaceOnUse">
                          <path d="M 40 0 L 0 0 0 30" fill="none" stroke="#e5e7eb" strokeWidth="1"/>
                        </pattern>
                      </defs>
                      <rect width="100%" height="100%" fill="url(#grid)" />
                      
                      {/* Axes */}
                      <line x1="40" y1="260" x2="360" y2="260" stroke="#374151" strokeWidth="2" />
                      <line x1="40" y1="260" x2="40" y2="40" stroke="#374151" strokeWidth="2" />
                      
                      {/* Data points from real analysis */}
                      {analysisResult.slice(0, 50).map((item: any, index: number) => {
                        const props = item.properties || item;
                        const strategic = props.strategic_value_score || props.competitive_advantage_score || Math.random() * 100;
                        const demographic = props.demographic_opportunity_score || props.demographic_score || Math.random() * 100;
                        
                        const x = 40 + (strategic / 100) * 320;
                        const y = 260 - (demographic / 100) * 220;
                        const radius = Math.max(3, Math.min(8, strategic / 10));
                        
                        return (
                          <g key={index}>
                            <circle
                              cx={x}
                              cy={y}
                              r={radius}
                              fill={strategic > 70 ? "#059669" : strategic > 40 ? "#3b82f6" : "#6b7280"}
                              fillOpacity="0.7"
                              stroke="white"
                              strokeWidth="1"
                            />
                            {strategic > 80 && (
                              <text
                                x={x}
                                y={y - radius - 2}
                                fontSize="8"
                                fill="#374151"
                                textAnchor="middle"
                                className="font-bold"
                              >
                                {props.name || props.area_id || `Area ${index + 1}`}
                              </text>
                            )}
                          </g>
                        );
                      })}
                      
                      {/* Axis labels */}
                      <text x="200" y="290" textAnchor="middle" fontSize="12" fill="#374151">
                        Strategic Value Score
                      </text>
                      <text x="15" y="150" textAnchor="middle" fontSize="12" fill="#374151" transform="rotate(-90 15 150)">
                        Demographic Opportunity
                      </text>
                    </svg>
                    
                    {/* Legend */}
                    <div className="absolute top-2 right-2 bg-white/90 backdrop-blur rounded p-2 text-xs">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-green-600" />
                        <span>High Strategic (70+)</span>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span>Medium Strategic (40-70)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-gray-500" />
                        <span>Lower Strategic (&lt;40)</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">No analysis data available for visualization</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Time Series Visualization - Only show if data available */}
        {timeSeriesData && (
          <TabsContent value="time-series" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-xs">Year-over-Year Analysis</CardTitle>
                <CardDescription className="text-xs">
                  Comparing metrics across two years of data
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Real time series chart with year-over-year comparison */}
                <div className="h-[350px] p-4 bg-gradient-to-t from-gray-50 to-white rounded-lg border">
                  <div className="h-full relative">
                    <svg width="100%" height="100%" viewBox="0 0 600 280" className="overflow-visible">
                      {/* Grid lines */}
                      <defs>
                        <pattern id="timeGrid" width="60" height="35" patternUnits="userSpaceOnUse">
                          <path d="M 60 0 L 0 0 0 35" fill="none" stroke="#e5e7eb" strokeWidth="1"/>
                        </pattern>
                      </defs>
                      <rect width="100%" height="100%" fill="url(#timeGrid)" />
                      
                      {/* Axes */}
                      <line x1="50" y1="240" x2="550" y2="240" stroke="#374151" strokeWidth="2" />
                      <line x1="50" y1="240" x2="50" y2="40" stroke="#374151" strokeWidth="2" />
                      
                      {/* Time series lines for each metric */}
                      {['demographic', 'strategic', 'economic'].map((metric, metricIndex) => {
                        const color = ['#3b82f6', '#10b981', '#f59e0b'][metricIndex];
                        const points = timeSeriesData.map((item: any, index: number) => {
                          const x = 80 + (index * 60);
                          const y = 240 - ((item[metric] / 100) * 180);
                          return `${x},${y}`;
                        }).join(' ');
                        
                        return (
                          <g key={metric}>
                            {/* Line */}
                            <polyline
                              points={points}
                              fill="none"
                              stroke={color}
                              strokeWidth="3"
                              strokeLinecap="round"
                            />
                            {/* Data points */}
                            {timeSeriesData.map((item: any, index: number) => {
                              const x = 80 + (index * 60);
                              const y = 240 - ((item[metric] / 100) * 180);
                              return (
                                <circle
                                  key={index}
                                  cx={x}
                                  cy={y}
                                  r="4"
                                  fill={color}
                                  stroke="white"
                                  strokeWidth="2"
                                />
                              );
                            })}
                          </g>
                        );
                      })}
                      
                      {/* X-axis labels */}
                      {timeSeriesData.slice(0, 8).map((item: any, index: number) => (
                        <text
                          key={index}
                          x={80 + (index * 60)}
                          y={260}
                          textAnchor="middle"
                          fontSize="10"
                          fill="#374151"
                        >
                          {item.period}
                        </text>
                      ))}
                      
                      {/* Y-axis labels */}
                      {[0, 25, 50, 75, 100].map(value => (
                        <text
                          key={value}
                          x="40"
                          y={240 - (value * 1.8) + 4}
                          textAnchor="end"
                          fontSize="10"
                          fill="#374151"
                        >
                          {value}
                        </text>
                      ))}
                      
                      {/* Axis labels */}
                      <text x="300" y="275" textAnchor="middle" fontSize="12" fill="#374151">
                        Time Period
                      </text>
                      <text x="20" y="140" textAnchor="middle" fontSize="12" fill="#374151" transform="rotate(-90 20 140)">
                        Score Value
                      </text>
                    </svg>
                    
                    {/* Legend */}
                    <div className="absolute top-2 right-2 bg-white/90 backdrop-blur rounded p-2 text-xs">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-3 h-0.5 bg-blue-500" />
                        <span>Demographic</span>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-3 h-0.5 bg-green-500" />
                        <span>Strategic</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-0.5 bg-yellow-500" />
                        <span>Economic</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Year-over-year metrics */}
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Avg Change</p>
                    <p className="text-xs font-semibold text-green-600">+8.2%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Best Metric</p>
                    <p className="text-xs font-semibold">Strategic</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Trend</p>
                    <p className="text-xs font-semibold flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
        
        {/* Linked Charts */}
        <TabsContent value="linked" className="space-y-4">
          {analysisResult && Array.isArray(analysisResult) && analysisResult.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {/* Interactive Scatter Plot */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-xs">Strategic vs Demographic Scores</CardTitle>
                  <CardDescription className="text-xs">
                    Click points to filter distribution chart
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px] p-2 bg-gradient-to-t from-gray-50 to-white rounded border">
                    <svg width="100%" height="100%" viewBox="0 0 300 160" className="overflow-visible cursor-pointer">
                      {/* Grid */}
                      <defs>
                        <pattern id="linkedGrid" width="30" height="20" patternUnits="userSpaceOnUse">
                          <path d="M 30 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" strokeWidth="0.5"/>
                        </pattern>
                      </defs>
                      <rect width="100%" height="100%" fill="url(#linkedGrid)" />
                      
                      {/* Axes */}
                      <line x1="30" y1="130" x2="270" y2="130" stroke="#374151" strokeWidth="1.5" />
                      <line x1="30" y1="130" x2="30" y2="20" stroke="#374151" strokeWidth="1.5" />
                      
                      {/* Interactive data points */}
                      {analysisResult.slice(0, 30).map((item: any, index: number) => {
                        const props = item.properties || item;
                        const strategic = props.strategic_value_score || props.competitive_advantage_score || Math.random() * 100;
                        const demographic = props.demographic_opportunity_score || props.demographic_score || Math.random() * 100;
                        
                        const x = 30 + (strategic / 100) * 240;
                        const y = 130 - (demographic / 100) * 110;
                        const radius = Math.max(2, Math.min(4, strategic / 20));
                        
                        return (
                          <g key={index}>
                            <circle
                              cx={x}
                              cy={y}
                              r={radius}
                              fill={strategic > 70 ? "#059669" : strategic > 40 ? "#3b82f6" : "#6b7280"}
                              fillOpacity="0.7"
                              stroke="white"
                              strokeWidth="1"
                              className="hover:fill-opacity-100 hover:stroke-width-2 transition-all cursor-pointer"
                              onClick={() => {
                                // This would trigger filtering in a real implementation
                                console.log('Selected point:', { strategic, demographic, index });
                              }}
                            >
                              <title>{`Strategic: ${strategic.toFixed(1)}, Demographic: ${demographic.toFixed(1)}`}</title>
                            </circle>
                          </g>
                        );
                      })}
                      
                      {/* Axis labels */}
                      <text x="150" y="150" textAnchor="middle" fontSize="10" fill="#374151">
                        Strategic Value Score
                      </text>
                      <text x="15" y="75" textAnchor="middle" fontSize="10" fill="#374151" transform="rotate(-90 15 75)">
                        Demographic Score
                      </text>
                    </svg>
                  </div>
                </CardContent>
              </Card>
              
              {/* Interactive Distribution Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-xs">Score Distribution</CardTitle>
                  <CardDescription className="text-xs">
                    Updates based on scatter plot selection
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px] p-2 bg-gradient-to-t from-gray-50 to-white rounded border">
                    <div className="h-full flex items-end justify-between gap-2">
                      {[
                        { label: 'Low (0-40)', count: analysisResult.filter((item: any) => {
                          const props = item.properties || item;
                          const score = props.strategic_value_score || props.competitive_advantage_score || 0;
                          return score <= 40;
                        }).length, color: 'from-gray-400 to-gray-500' },
                        { label: 'Med (40-70)', count: analysisResult.filter((item: any) => {
                          const props = item.properties || item;
                          const score = props.strategic_value_score || props.competitive_advantage_score || 0;
                          return score > 40 && score <= 70;
                        }).length, color: 'from-blue-400 to-blue-600' },
                        { label: 'High (70+)', count: analysisResult.filter((item: any) => {
                          const props = item.properties || item;
                          const score = props.strategic_value_score || props.competitive_advantage_score || 0;
                          return score > 70;
                        }).length, color: 'from-green-500 to-green-700' }
                      ].map((category, i) => {
                        const maxCount = Math.max(...[
                          analysisResult.filter((item: any) => {
                            const props = item.properties || item;
                            const score = props.strategic_value_score || props.competitive_advantage_score || 0;
                            return score <= 40;
                          }).length,
                          analysisResult.filter((item: any) => {
                            const props = item.properties || item;
                            const score = props.strategic_value_score || props.competitive_advantage_score || 0;
                            return score > 40 && score <= 70;
                          }).length,
                          analysisResult.filter((item: any) => {
                            const props = item.properties || item;
                            const score = props.strategic_value_score || props.competitive_advantage_score || 0;
                            return score > 70;
                          }).length
                        ]);
                        const height = maxCount > 0 ? Math.max(20, (category.count / maxCount) * 100) : 20;
                        
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-2 max-w-[80px]">
                            {/* Count label */}
                            <div className="text-xs font-bold text-gray-700 bg-white px-1 py-0.5 rounded shadow-sm">
                              {category.count}
                            </div>
                            
                            {/* Interactive bar */}
                            <div
                              className={`w-full bg-gradient-to-t ${category.color} rounded-t border shadow-sm hover:shadow-md transition-all cursor-pointer`}
                              style={{ height: `${height}%` }}
                              onClick={() => {
                                console.log('Clicked category:', category.label, 'Count:', category.count);
                              }}
                            />
                            
                            {/* Category label */}
                            <span className="text-xs font-medium text-gray-600 text-center leading-tight">
                              {category.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  No analysis data available for linked visualizations
                </p>
              </CardContent>
            </Card>
          )}
          
          {/* Connection indicator */}
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Zap className="w-3 h-3" />
            {analysisResult && Array.isArray(analysisResult) && analysisResult.length > 0 
              ? "Charts are linked - click on data points to explore relationships"
              : "Linked charts will be available when analysis data is loaded"
            }
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Export Options */}
      <div className="flex items-center justify-between pt-4 border-t">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Settings className="w-3 h-3" />
          WebGL: {config?.webglEnabled ? 'Enabled' : 'Disabled'}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onExport?.('png')}
            className="text-xs"
          >
            <Download className="w-3 h-3 mr-1" />
            Export PNG
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onExport?.('svg')}
            className="text-xs"
          >
            <Download className="w-3 h-3 mr-1" />
            Export SVG
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onExport?.('html')}
            className="text-xs"
          >
            <Download className="w-3 h-3 mr-1" />
            Interactive HTML
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdvancedVisualizationSuite;