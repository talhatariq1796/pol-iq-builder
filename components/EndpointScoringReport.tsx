import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, TrendingUp, Target, Users, BarChart3, Zap, Shield, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import endpointScoringService, { ENDPOINT_CONFIGS } from '@/lib/services/EndpointScoringService';
import MapLogo from '@/components/MapLogo';
import MapView from '@arcgis/core/views/MapView';
import Map from '@arcgis/core/Map';
import Graphic from '@arcgis/core/Graphic';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import * as geometryEngine from '@arcgis/core/geometry/geometryEngine';

interface EndpointData {
  overall_score?: number;
  confidence_score?: number;
  recommendation?: string;
  [key: string]: any;
}

interface EndpointScoringReportProps {
  geometry: __esri.Geometry | null;
  view?: __esri.MapView | __esri.SceneView | null;
  onExportPDF?: () => void;
  reportType?: 'market-intelligence' | 'endpoint-scoring';
}

// Icon mapping for endpoint types
const getIconForEndpoint = (iconName: string) => {
  const iconMap: { [key: string]: any } = {
    'target': Target,
    'zap': Zap,
    'shield': Shield,
    'trending-up': TrendingUp,
    'bar-chart-3': BarChart3,
    'users': Users
  };
  return iconMap[iconName] || Target;
};

export default function EndpointScoringReport({ 
  geometry, 
  view, 
  onExportPDF, 
  reportType = 'endpoint-scoring' 
}: EndpointScoringReportProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [endpointData, setEndpointData] = useState<{ [key: string]: EndpointData }>({});
  const [mapLoading, setMapLoading] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapViewRef = useRef<MapView | null>(null);

  // Load endpoint data based on geometry using the service
  useEffect(() => {
    const loadEndpointData = async () => {
      if (!geometry) {
        setError('No geometry available for analysis');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        console.log('[EndpointScoringReport] Loading endpoint data using service...');
        const data = await endpointScoringService.loadEndpointData(geometry);
        setEndpointData(data);
      } catch (err) {
        console.error('[EndpointScoringReport] Error loading endpoint data:', err);
        setError('Failed to load scoring data');
      } finally {
        setLoading(false);
      }
    };

    loadEndpointData();
  }, [geometry]);

  // Initialize mini map to show geometry
  useEffect(() => {
    if (!geometry) {
      console.log('[MiniMap] No geometry provided');
      return;
    }

    if (!mapContainerRef.current) {
      console.log('[MiniMap] Map container ref not available');
      return;
    }

    const initializeMiniMap = async () => {
      try {
        console.log('[MiniMap] Initializing mini map...');
        setMapLoading(true);
        
        // Clean up any existing map view first
        if (mapViewRef.current) {
          console.log('[MiniMap] Cleaning up existing map view');
          mapViewRef.current.destroy();
          mapViewRef.current = null;
        }

        // Create a simple map
        const map = new Map({
          basemap: "gray-vector"
        });

        // Create graphics layer for the study area
        const graphicsLayer = new GraphicsLayer();
        map.add(graphicsLayer);

        console.log('[MiniMap] Creating MapView...');
        // Create the map view
        const mapView = new MapView({
          container: mapContainerRef.current!,
          map: map,
          center: [-98, 39], // Center US initially
          zoom: 4,
          ui: {
            components: [] // Remove all UI components for clean mini map
          }
        });

        mapViewRef.current = mapView;

        console.log('[MiniMap] Waiting for map view to load...');
        await mapView.when();
        console.log('[MiniMap] Map view loaded successfully');

        // Add the study area geometry to the map
        console.log('[MiniMap] Geometry type:', geometry.type);
        console.log('[MiniMap] Geometry extent:', geometry.extent);
        
        const fillSymbol = new SimpleFillSymbol({
          color: [27, 154, 89, 0.25], // Green fill with transparency  
          outline: new SimpleLineSymbol({
            color: [27, 154, 89, 1], // Solid green outline (Esri style)
            width: 2
          })
        });

        const graphic = new Graphic({
          geometry: geometry,
          symbol: fillSymbol
        });

        graphicsLayer.add(graphic);
        console.log('[MiniMap] Added study area graphic with geometry:', {
          type: geometry.type,
          hasExtent: !!geometry.extent,
          spatialReference: geometry.spatialReference?.wkid
        });

        // Zoom to the geometry extent
        const extent = geometry.extent;
        if (extent) {
          console.log('[MiniMap] Zooming to geometry extent');
          await mapView.goTo(extent.expand(1.3), { 
            duration: 1000 
          }); // Add some padding with animation
        } else {
          console.warn('[MiniMap] Geometry has no extent, cannot zoom to area');
        }

        console.log('[MiniMap] Mini map initialization complete');
        setMapLoading(false);

      } catch (error) {
        console.error('[MiniMap] Error initializing mini map:', error);
        setMapLoading(false);
      }
    };

    // Add a small delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      initializeMiniMap();
    }, 100);

    // Cleanup
    return () => {
      clearTimeout(timeoutId);
      if (mapViewRef.current) {
        console.log('[MiniMap] Cleaning up map view on unmount');
        mapViewRef.current.destroy();
        mapViewRef.current = null;
      }
    };
  }, [geometry]);

  // Calculate overall composite score using the service
  const compositeScore = useMemo(() => {
    return endpointScoringService.calculateCompositeScore(endpointData);
  }, [endpointData]);

  // Generate AI-powered insights based on the scores
  const aiInsights = useMemo(() => {
    if (Object.keys(endpointData).length === 0) return null;

    const insights: { [key: string]: string } = {};
    const scores = Object.entries(endpointData).map(([id, data]) => ({
      id,
      name: ENDPOINT_CONFIGS.find(c => c.id === id)?.name || id,
      score: data.overall_score || 0,
      confidence: data.confidence_score || 0,
      data
    })).filter(item => item.score > 0);

    // Overall assessment
    if (compositeScore >= 85) {
      insights.overall = "Exceptional performance across multiple intelligence dimensions. This area demonstrates outstanding strategic positioning with strong competitive advantages and robust market opportunities.";
    } else if (compositeScore >= 70) {
      insights.overall = "Strong overall performance with notable competitive advantages. The area shows solid strategic positioning with several high-performing dimensions.";
    } else if (compositeScore >= 55) {
      insights.overall = "Moderate performance with mixed results across dimensions. Some areas show promise while others may require strategic attention.";
    } else {
      insights.overall = "Below-average performance indicators. Multiple dimensions suggest challenges that may require comprehensive strategic intervention.";
    }

    // Top performing areas
    const topScores = scores.sort((a, b) => b.score - a.score).slice(0, 3);
    if (topScores.length > 0) {
      insights.strengths = `Primary strengths lie in ${topScores.map(s => s.name).join(', ')}. ${topScores[0].name} shows exceptional performance (${topScores[0].score}/100), indicating ${
        topScores[0].id.includes('strategic') ? 'excellent strategic market positioning' :
        topScores[0].id.includes('brand') ? 'strong brand differentiation capabilities' :
        topScores[0].id.includes('competitive') ? 'superior competitive advantages' :
        topScores[0].id.includes('trend') ? 'positive market trend alignment' :
        topScores[0].id.includes('predictive') ? 'favorable future performance indicators' :
        'significant performance advantages'
      }.`;
    }

    // Areas for improvement
    const lowScores = scores.filter(s => s.score < 60).sort((a, b) => a.score - b.score).slice(0, 2);
    if (lowScores.length > 0) {
      insights.opportunities = `Areas for strategic focus include ${lowScores.map(s => s.name).join(' and ')}. ${
        lowScores[0].score < 40 ? 'Immediate attention required' : 'Moderate improvement potential exists'
      } in ${lowScores[0].name.toLowerCase()}, which could unlock significant value through targeted interventions.`;
    }

    // Aggregation insights
    const aggregationInfo = endpointData[Object.keys(endpointData)[0]]?.aggregation_info;
    if (aggregationInfo && aggregationInfo.source_count > 1) {
      insights.methodology = `Analysis aggregated ${aggregationInfo.source_count} data points within the study area using ${aggregationInfo.aggregation_method.replace(/_/g, ' ')}. Total population coverage: ${aggregationInfo.total_population?.toLocaleString() || 'N/A'}.`;
    }

    // Confidence assessment
    const avgConfidence = scores.reduce((sum, s) => sum + s.confidence, 0) / scores.length;
    if (avgConfidence >= 80) {
      insights.confidence = "High confidence in analysis results. Data quality and coverage are excellent across multiple endpoints.";
    } else if (avgConfidence >= 60) {
      insights.confidence = "Moderate confidence in analysis results. Most endpoints provide reliable data with acceptable coverage.";
    } else {
      insights.confidence = "Limited confidence in analysis results. Data quality or coverage may be insufficient for some endpoints.";
    }

    return insights;
  }, [endpointData, compositeScore]);

  // Calculate geometry area and other stats
  const geometryStats = useMemo(() => {
    if (!geometry) return null;

    try {
      let area = 0;
      if (geometry.type === 'polygon') {
        area = geometryEngine.geodesicArea(geometry as __esri.Polygon, 'square-kilometers');
      } else {
        // For other geometry types, use extent area as approximation
        const extent = geometry.extent;
        if (extent) {
          const width = extent.width;
          const height = extent.height; 
          area = (width / 1000) * (height / 1000); // Rough approximation in km²
        }
      }
      
      const extent = geometry.extent;
      
      return {
        area: Math.round(area * 100) / 100, // Round to 2 decimal places
        areaUnit: 'km²',
        center: extent ? [(extent.xmin + extent.xmax) / 2, (extent.ymin + extent.ymax) / 2] : null,
        type: geometry.type,
        description: geometry.type === 'polygon' ? 'Custom Area' : 
                    'Study Area'
      };
    } catch (error) {
      console.warn('Error calculating geometry stats:', error);
      return {
        area: 0,
        areaUnit: 'km²',
        center: null,
        type: geometry.type,
        description: 'Study Area'
      };
    }
  }, [geometry]);

  const getColorClasses = (color: string) => {
    const colorMap: { [key: string]: { bg: string; text: string; border: string } } = {
      blue: { bg: 'bg-blue-50', text: 'text-blue-900', border: 'border-blue-200' },
      purple: { bg: 'bg-purple-50', text: 'text-purple-900', border: 'border-purple-200' },
      red: { bg: 'bg-red-50', text: 'text-red-900', border: 'border-red-200' },
      green: { bg: 'bg-green-50', text: 'text-green-900', border: 'border-green-200' },
      orange: { bg: 'bg-orange-50', text: 'text-orange-900', border: 'border-orange-200' },
      cyan: { bg: 'bg-cyan-50', text: 'text-cyan-900', border: 'border-cyan-200' },
      amber: { bg: 'bg-amber-50', text: 'text-amber-900', border: 'border-amber-200' },
      indigo: { bg: 'bg-indigo-50', text: 'text-indigo-900', border: 'border-indigo-200' },
      pink: { bg: 'bg-pink-50', text: 'text-pink-900', border: 'border-pink-200' },
      emerald: { bg: 'bg-emerald-50', text: 'text-emerald-900', border: 'border-emerald-200' }
    };
    return colorMap[color] || colorMap.blue;
  };

  const renderSingleScoreEndpoint = (config: typeof ENDPOINT_CONFIGS[0], data: EndpointData) => {
    const colors = getColorClasses(config.color);
    const IconComponent = getIconForEndpoint(config.icon);
    
    const score = data.overall_score || 0;
    const progressClass = score >= 80 ? 'arcgis-progress-fill--high' : 
                          score >= 60 ? 'arcgis-progress-fill--medium' : 
                          score >= 40 ? 'arcgis-progress-fill--primary' : 
                          'arcgis-progress-fill--low';

    return (
      <Card key={config.id} className={`arcgis-score-card ${colors.bg} ${colors.border} border`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <IconComponent className={`h-6 w-6 ${config.color === 'blue' ? 'text-blue-600' : 
              config.color === 'purple' ? 'text-purple-600' :
              config.color === 'red' ? 'text-red-600' :
              config.color === 'green' ? 'text-green-600' :
              config.color === 'orange' ? 'text-orange-600' : 'text-blue-600'}`} />
            <h3 className={`font-semibold ${colors.text}`} style={{ fontFamily: 'var(--arcgis-font-family)' }}>
              {config.name}
            </h3>
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-2xl font-bold" style={{ color: 'var(--arcgis-gray-900)' }}>
              {score}
            </span>
            <span className="text-xs" style={{ color: 'var(--arcgis-gray-600)' }}>
              out of 100
            </span>
          </div>
          
          {/* ArcGIS-style progress bar */}
          <div className="arcgis-progress-track mb-3">
            <div 
              className={`arcgis-progress-fill ${progressClass}`}
              style={{ width: `${score}%` }}
            ></div>
          </div>

          <p className="text-sm mb-2" style={{ color: 'var(--arcgis-gray-600)' }}>
            {config.description}
          </p>
          {data.confidence_score && (
            <p className="text-xs mb-2" style={{ color: 'var(--arcgis-gray-600)' }}>
              Confidence: {data.confidence_score}%
            </p>
          )}
          {data.recommendation && (
            <p className="text-xs italic" style={{ color: 'var(--arcgis-gray-600)' }}>
              {data.recommendation}
            </p>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderDetailedBreakdownEndpoint = (config: typeof ENDPOINT_CONFIGS[0], data: EndpointData) => {
    const colors = getColorClasses(config.color);
    const IconComponent = getIconForEndpoint(config.icon);
    
    return (
      <Card key={config.id} className="col-span-2">
        <CardHeader className={`${colors.bg} pb-3`}>
          <div className="flex items-center gap-3">
            <IconComponent className="h-5 w-5" />
            <h3 className={`font-semibold ${colors.text}`}>{config.name}</h3>
            <span className="ml-auto text-lg font-bold">{data.overall_score || 0}/100</span>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <p className="text-sm text-gray-600 mb-3">{config.description}</p>
          {/* TODO: Add detailed breakdown based on endpoint type */}
          <div className="text-sm text-gray-500">
            Detailed breakdown will be implemented based on specific endpoint data structure
          </div>
        </CardContent>
      </Card>
    );
  };

  if (!geometry) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <AlertCircle className="h-8 w-8 text-red-600 mb-2" />
        <p className="text-sm text-gray-600">No geometry selected for analysis</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-green-600 mx-auto mb-2" />
          <p className="text-sm text-gray-600">Loading endpoint scoring data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="endpoint-scoring-report relative" style={{ 
      fontFamily: '"Avenir Next", "Avenir", "Helvetica Neue", sans-serif',
      background: '#ffffff'
    }}>
      {/* Background Logo Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 opacity-10">
        <MapLogo 
          position="center"
          style="permanent"
          size="xlarge"
          sidebarWidth={0}
        />
      </div>
      
      {/* CSS Variables matching ArcGIS theme */}
      <style>{`
        .endpoint-scoring-report {
          --arcgis-font-family: "Avenir Next", "Avenir", "Helvetica Neue", sans-serif;
          --arcgis-blue-primary: #0079c1;
          --arcgis-blue-light: #00a0ff;
          --arcgis-green-success: #35ac46;
          --arcgis-yellow-warning: #f7931e;
          --arcgis-red-danger: #d83027;
          --arcgis-gray-100: #f8f9fa;
          --arcgis-gray-200: #e9ecef;
          --arcgis-gray-600: #6c757d;
          --arcgis-gray-900: #212529;
          --arcgis-border-radius: 4px;
          --arcgis-card-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        .arcgis-score-card {
          border-radius: var(--arcgis-border-radius);
          box-shadow: var(--arcgis-card-shadow);
          overflow: hidden;
        }
        .arcgis-progress-track {
          background: var(--arcgis-gray-200);
          border-radius: 2px;
          height: 8px;
          overflow: hidden;
          position: relative;
        }
        .arcgis-progress-fill {
          height: 100%;
          border-radius: 2px;
          transition: width 0.3s ease;
        }
        .arcgis-progress-fill--high { background: var(--arcgis-green-success); }
        .arcgis-progress-fill--medium { background: var(--arcgis-yellow-warning); }  
        .arcgis-progress-fill--low { background: var(--arcgis-red-danger); }
        .arcgis-progress-fill--primary { background: linear-gradient(90deg, var(--arcgis-blue-primary), var(--arcgis-blue-light)); }
      `}</style>

      <div className="p-6 max-w-6xl mx-auto relative z-10">
        {/* Header matching ArcGIS style */}
        <div className="text-center mb-8 border-b pb-6" style={{ 
          borderColor: 'var(--arcgis-gray-200)',
          fontFamily: 'var(--arcgis-font-family)'
        }}>
          <h1 className="text-3xl font-bold mb-2" style={{ 
            color: 'var(--arcgis-gray-900)',
            fontFamily: 'var(--arcgis-font-family)'
          }}>
            {reportType === 'market-intelligence' 
              ? 'Quebec Housing Market Analysis Report' 
              : 'AI Endpoint Scoring Analysis'
            }
          </h1>
          <p className="text-lg" style={{ color: 'var(--arcgis-gray-600)' }}>
            {reportType === 'market-intelligence' 
              ? 'Professional Market Analysis with Strategic Recommendations' 
              : 'Comprehensive Area Intelligence Report'
            }
          </p>
          <p className="text-sm mt-2" style={{ color: 'var(--arcgis-gray-600)' }}>
            Generated on {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* Study Area Information and Map */}
        {geometryStats && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Study Area Stats */}
            <Card className="lg:col-span-1 arcgis-score-card">
              <CardHeader className="bg-gray-50 pb-3">
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold text-gray-900" style={{ fontFamily: 'var(--arcgis-font-family)' }}>
                    Study Area
                  </h3>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm" style={{ color: 'var(--arcgis-gray-600)' }}>Type:</span>
                    <span className="text-sm font-medium" style={{ color: 'var(--arcgis-gray-900)' }}>
                      {geometryStats.description}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm" style={{ color: 'var(--arcgis-gray-600)' }}>Area:</span>
                    <span className="text-sm font-medium" style={{ color: 'var(--arcgis-gray-900)' }}>
                      {geometryStats.area} {geometryStats.areaUnit}
                    </span>
                  </div>
                  {geometryStats.center && (
                    <div className="text-xs" style={{ color: 'var(--arcgis-gray-600)' }}>
                      Center: {geometryStats.center[0].toFixed(3)}, {geometryStats.center[1].toFixed(3)}
                    </div>
                  )}
                  <div className="text-xs mt-2 p-2 bg-green-50 rounded" style={{ color: 'var(--arcgis-green-primary)' }}>
                    Analysis covers {Object.keys(endpointData).filter(key => endpointData[key]?.overall_score && endpointData[key]?.overall_score > 0).length} active endpoints
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Mini Map */}
            <Card className="lg:col-span-2 arcgis-score-card">
              <CardHeader className="bg-gray-50 pb-3">
                <h3 className="font-semibold text-gray-900" style={{ fontFamily: 'var(--arcgis-font-family)' }}>
                  Study Area Location
                </h3>
              </CardHeader>
              <CardContent className="p-0">
                <div 
                  ref={mapContainerRef} 
                  style={{ 
                    width: '100%', 
                    height: '300px',
                    minHeight: '300px',
                    border: '1px solid #e5e7eb',
                    backgroundColor: '#f9fafb',
                    borderRadius: '0.375rem',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {/* Loading indicator while map initializes */}
                  {mapLoading && (
                    <div 
                      className="absolute inset-0 flex items-center justify-center text-gray-500"
                      style={{
                        backgroundColor: 'rgba(249, 250, 251, 0.8)',
                        zIndex: 1
                      }}
                    >
                      <div className="flex flex-col items-center">
                        <Loader2 className="h-8 w-8 animate-spin mb-2" />
                        <span className="text-sm">Loading study area map...</span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Executive Summary */}
        <Card className="mb-8 arcgis-score-card">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 pb-3">
            <h2 className="text-xl font-semibold text-gray-900" style={{ fontFamily: 'var(--arcgis-font-family)' }}>
              Executive Summary
            </h2>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="text-center">
                <div className="text-5xl font-bold text-green-600 mb-2">{compositeScore}</div>
                <div className="text-lg font-semibold text-gray-700">Overall Intelligence Score</div>
                <div className="text-sm text-gray-600 mt-1">
                  Combined analysis across {Object.keys(endpointData).filter(key => endpointData[key]?.overall_score && endpointData[key]?.overall_score > 0).length} active endpoints
                </div>
              </div>
              <div className="space-y-3">
                {aiInsights?.overall && (
                  <p className="text-sm text-gray-700 leading-relaxed">{aiInsights.overall}</p>
                )}
                {geometryStats && (
                  <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded">
                    <strong>Study Area:</strong> {geometryStats.description} covering {geometryStats.area} {geometryStats.areaUnit}
                    {geometryStats.center && (
                      <span> • Center: {geometryStats.center[0].toFixed(3)}, {geometryStats.center[1].toFixed(3)}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Key Performance Indicators */}
        <Card className="mb-8 arcgis-score-card">
          <CardHeader className="bg-gray-50 pb-3">
            <h3 className="text-lg font-semibold text-gray-900" style={{ fontFamily: 'var(--arcgis-font-family)' }}>
              Key Performance Indicators
            </h3>
            <p className="text-sm text-gray-600 mt-1">Primary strategic and competitive metrics</p>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              {ENDPOINT_CONFIGS.filter(config => config.type === 'single-score').map(config => {
                const data = endpointData[config.id] || {};
                return renderSingleScoreEndpoint(config, data);
              })}
            </div>
            {aiInsights?.strengths && (
              <div className="mt-4 p-4 bg-green-50 rounded-lg border-l-4 border-green-600">
                <h4 className="font-semibold text-green-900 mb-2 text-sm">Key Insights</h4>
                <p className="text-sm text-green-800 leading-relaxed">{aiInsights.strengths}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Housing Market & Demographics */}
        <Card className="mb-8 arcgis-score-card">
          <CardHeader className="bg-gray-50 pb-3">
            <h3 className="text-lg font-semibold text-gray-900" style={{ fontFamily: 'var(--arcgis-font-family)' }}>
              Housing Market & Demographics
            </h3>
            <p className="text-sm text-gray-600 mt-1">Housing profiles, demographic insights, and market analysis</p>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {ENDPOINT_CONFIGS.filter(config => config.type === 'hybrid' || config.type === 'detailed-breakdown').map(config => {
                const data = endpointData[config.id] || {};
                return (
                  <div key={config.id} className="space-y-4">
                    {renderDetailedBreakdownEndpoint(config, data)}
                    {/* Add demographic context if available */}
                    {config.id === 'customer-profile' && data.demographic_breakdown && (
                      <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded border">
                        <strong>Demographics:</strong> {typeof data.demographic_breakdown === 'string' 
                          ? data.demographic_breakdown 
                          : 'Detailed customer segment analysis available'}
                      </div>
                    )}
                    {config.id === 'demographic-insights' && (
                      <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded border">
                        <strong>Population Insights:</strong> Analysis covers demographic patterns, income distributions, and lifestyle segments within the study area.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Market Analysis Commentary */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-3 text-sm">Market Analysis</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="text-sm text-gray-700">
                  <strong>Consumer Base:</strong> The study area demographics indicate {
                    compositeScore >= 75 ? 'a highly attractive consumer market' :
                    compositeScore >= 60 ? 'a moderately attractive consumer market' :
                    'a developing consumer market with growth potential'
                  } with diverse customer segments and spending patterns.
                </div>
                <div className="text-sm text-gray-700">
                  <strong>Market Position:</strong> {
                    aiInsights?.opportunities ? 
                    aiInsights.opportunities.split('.')[0] + '.' :
                    'Strategic positioning analysis indicates balanced competitive landscape.'
                  }
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Economic Conditions & Trends */}
        <Card className="mb-8 arcgis-score-card">
          <CardHeader className="bg-gray-50 pb-3">
            <h3 className="text-lg font-semibold text-gray-900" style={{ fontFamily: 'var(--arcgis-font-family)' }}>
              Economic Conditions & Future Outlook
            </h3>
            <p className="text-sm text-gray-600 mt-1">Trend analysis, predictive modeling, and resilience assessment</p>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Trend Analysis */}
              {(() => {
                const trendData = endpointData['trend-analysis'] || {};
                const predictiveData = endpointData['predictive-modeling'] || {};
                const resilienceData = endpointData['scenario-analysis'] || {};
                
                return (
                  <>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2 text-sm flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          Market Trends
                        </h4>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl font-bold text-green-600">{trendData.overall_score || 0}</span>
                          <div className="flex-1">
                            <div className="arcgis-progress-track">
                              <div 
                                className="arcgis-progress-fill arcgis-progress-fill--primary"
                                style={{ width: `${trendData.overall_score || 0}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600">
                          {(trendData.overall_score || 0) >= 80 ? 'Excellent trend alignment with strong market momentum' :
                           (trendData.overall_score || 0) >= 60 ? 'Positive trends with moderate growth indicators' :
                           'Mixed trends requiring strategic attention'}
                        </p>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2 text-sm flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-gray-600" />
                          Future Performance
                        </h4>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl font-bold text-gray-600">{predictiveData.overall_score || 0}</span>
                          <div className="flex-1">
                            <div className="arcgis-progress-track">
                              <div 
                                className="arcgis-progress-fill arcgis-progress-fill--primary"
                                style={{ width: `${predictiveData.overall_score || 0}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600">
                          {(predictiveData.overall_score || 0) >= 80 ? 'Highly favorable future performance indicators' :
                           (predictiveData.overall_score || 0) >= 60 ? 'Positive future outlook with growth potential' :
                           'Conservative future projections with some uncertainty'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2 text-sm flex items-center gap-2">
                          <Shield className="h-4 w-4 text-red-600" />
                          Market Resilience
                        </h4>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl font-bold text-red-600">{resilienceData.overall_score || 0}</span>
                          <div className="flex-1">
                            <div className="arcgis-progress-track">
                              <div 
                                className="arcgis-progress-fill arcgis-progress-fill--primary"
                                style={{ width: `${resilienceData.overall_score || 0}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600">
                          {(resilienceData.overall_score || 0) >= 80 ? 'Highly resilient to market disruptions' :
                           (resilienceData.overall_score || 0) >= 60 ? 'Moderately resilient with manageable risks' :
                           'Vulnerability to market changes requires risk mitigation'}
                        </p>
                      </div>

                      {/* Economic Context */}
                      <div className="bg-gray-50 p-4 rounded-lg border">
                        <h4 className="font-semibold text-gray-900 mb-2 text-sm">Economic Context</h4>
                        <p className="text-sm text-gray-800">
                          The combination of trend analysis ({trendData.overall_score || 0}/100), predictive modeling ({predictiveData.overall_score || 0}/100), 
                          and resilience assessment ({resilienceData.overall_score || 0}/100) suggests {
                            ((trendData.overall_score || 0) + (predictiveData.overall_score || 0) + (resilienceData.overall_score || 0)) / 3 >= 75 ? 
                            'a robust economic environment with strong fundamentals and positive outlook.' :
                            ((trendData.overall_score || 0) + (predictiveData.overall_score || 0) + (resilienceData.overall_score || 0)) / 3 >= 60 ?
                            'stable economic conditions with moderate growth potential.' :
                            'challenging economic conditions requiring careful strategic planning.'
                          }
                        </p>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>

        {/* Strategic Recommendations & Market Position */}
        {aiInsights && (
          <Card className="mb-8 arcgis-score-card">
            <CardHeader className="bg-gray-50 pb-3">
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5 text-green-600" />
                <div>
                  <h3 className="font-semibold text-gray-900" style={{ fontFamily: 'var(--arcgis-font-family)' }}>
                    Strategic Recommendations
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">AI-powered analysis and actionable insights</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Opportunities & Actions */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900 mb-3 text-sm">Priority Actions</h4>
                  
                  {aiInsights.opportunities && (
                    <div className="p-4 bg-red-50 rounded-lg border-l-4 border-red-600">
                      <h5 className="font-semibold text-red-900 mb-2 text-sm">Focus Areas</h5>
                      <p className="text-sm text-red-800 leading-relaxed">{aiInsights.opportunities}</p>
                    </div>
                  )}

                  {/* Competitive Positioning */}
                  {(() => {
                    const strategicScore = endpointData['strategic-analysis']?.overall_score || 0;
                    const competitiveScore = endpointData['competitive-analysis']?.overall_score || 0;
                    const brandScore = endpointData['brand-difference']?.overall_score || 0;
                    
                    return (
                      <div className="p-4 bg-green-50 rounded-lg border-l-4 border-green-600">
                        <h5 className="font-semibold text-green-900 mb-2 text-sm">Market Positioning</h5>
                        <div className="space-y-2 text-sm text-green-800">
                          <div>• Strategic Position: {strategicScore >= 80 ? 'Dominant' : strategicScore >= 60 ? 'Strong' : 'Developing'} ({strategicScore}/100)</div>
                          <div>• Competitive Edge: {competitiveScore >= 80 ? 'Superior' : competitiveScore >= 60 ? 'Competitive' : 'Challenged'} ({competitiveScore}/100)</div>
                          <div>• Brand Differentiation: {brandScore >= 80 ? 'Exceptional' : brandScore >= 60 ? 'Solid' : 'Limited'} ({brandScore}/100)</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Housing Market Summary */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900 mb-3 text-sm">Housing Market Summary</h4>
                  
                  {/* Data Quality & Methodology */}
                  <div className="space-y-3">
                    {aiInsights.confidence && (
                      <div className="p-3 bg-gray-50 rounded-lg border">
                        <h5 className="font-semibold text-gray-900 mb-1 text-xs">Data Confidence</h5>
                        <p className="text-xs text-gray-800">{aiInsights.confidence}</p>
                      </div>
                    )}
                    
                    {aiInsights.methodology && (
                      <div className="p-3 bg-white rounded-lg border">
                        <h5 className="font-semibold text-gray-900 mb-1 text-xs">Analysis Coverage</h5>
                        <p className="text-xs text-gray-700">{aiInsights.methodology}</p>
                      </div>
                    )}

                    {/* Key Metrics Summary */}
                    <div className="p-3 bg-green-50 rounded-lg">
                      <h5 className="font-semibold text-green-900 mb-1 text-xs">Performance Summary</h5>
                      <div className="text-xs text-green-800 space-y-1">
                        <div>Overall Score: {compositeScore}/100</div>
                        <div>Active Endpoints: {Object.keys(endpointData).filter(key => endpointData[key]?.overall_score && endpointData[key]?.overall_score > 0).length}</div>
                        <div>Study Area: {geometryStats?.area} {geometryStats?.areaUnit}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Action Items */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <h4 className="font-semibold text-gray-900 mb-3 text-sm">Next Steps</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="p-3 bg-red-50 rounded-lg border">
                    <strong className="text-red-800">Short Term (30 days)</strong>
                    <p className="text-red-700 mt-1">
                      {compositeScore >= 80 ? 'Leverage high-performing areas for expansion opportunities' :
                       compositeScore >= 60 ? 'Optimize current strengths while addressing moderate weaknesses' :
                       'Focus on foundational improvements in lowest-scoring areas'}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg border">
                    <strong className="text-gray-800">Medium Term (90 days)</strong>
                    <p className="text-gray-700 mt-1">
                      Implement strategic recommendations from priority focus areas and monitor performance improvements
                    </p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg border">
                    <strong className="text-green-800">Long Term (6+ months)</strong>
                    <p className="text-green-700 mt-1">
                      Re-evaluate market position and expand analysis to adjacent areas showing similar patterns
                    </p>
                  </div>
                </div>
              </div>

              {/* AI Disclaimer */}
              <div className="text-xs text-gray-500 italic mt-6 pt-4 border-t border-gray-200">
                <p>🤖 Strategic recommendations generated through AI analysis of spatial intelligence data. Validate insights with local market expertise before implementation.</p>
              </div>
            </CardContent>
          </Card>
        )}

      {/* Footer */}
      <div className="text-center pt-6 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Generated with AI-powered geospatial intelligence • Data sources vary by endpoint
        </p>
        {onExportPDF && (
          <Button onClick={onExportPDF} className="mt-4" variant="outline">
            Export Report PDF
          </Button>
        )}
        </div>
      </div>
    </div>
  );
}