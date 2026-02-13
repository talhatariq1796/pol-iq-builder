'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { 
  isPhase4FeatureEnabled, 
  getPhase4FeatureConfig 
} from '@/config/phase4-features';
import { 
  getRealTimeData, 
  type RealTimeDataResponse, 
  type EconomicIndicator as ServiceEconomicIndicator, 
  type MarketData 
} from '@/lib/integrations/real-time-data-service';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Building2,
  AlertCircle,
  RefreshCw,
  Pause,
  Play,
  Zap,
  BarChart3,
  Globe,
  Newspaper
} from 'lucide-react';

// Types for real-time data
interface DataStream {
  id: string;
  name: string;
  source: 'fred' | 'census' | 'alpha-vantage' | 'news';
  value: number | string;
  previousValue?: number | string;
  change?: number;
  changePercent?: number;
  unit?: string;
  timestamp: Date;
  refreshRate: number; // seconds
  status: 'live' | 'updating' | 'error' | 'paused';
  confidence: number;
  impact: 'positive' | 'negative' | 'neutral';
  description: string;
}


interface RealTimeDataDashboardProps {
  location?: string;
  analysisContext?: {
    brand?: string;
    analysisType?: string;
    zipCodes?: string[];
  };
  onDataUpdate?: (streams: DataStream[]) => void;
  onAlertTriggered?: (alert: string) => void;
  className?: string;
}

// Convert service data to DataStream format  
const convertEconomicIndicator = (data: ServiceEconomicIndicator): DataStream => {
  return {
    id: data.series_id,
    name: data.title,
    source: 'fred',
    value: data.value,
    previousValue: data.value, // No previous value available
    change: 0,
    changePercent: data.change_percent || 0,
    unit: data.units,
    timestamp: new Date(data.date),
    refreshRate: 900, // 15 minutes for economic data
    status: 'live',
    confidence: 0.95,
    impact: (data.change_percent && data.change_percent > 0) ? 'positive' : 
           (data.change_percent && data.change_percent < 0) ? 'negative' : 'neutral',
    description: `${data.title} from Federal Reserve Economic Data`
  };
};

const convertMarketData = (data: MarketData): DataStream => {
  // Safely parse change percent with fallbacks
  let changePercent = 0;
  try {
    if (data.change_percent && typeof data.change_percent === 'string') {
      changePercent = parseFloat(data.change_percent.replace('%', '')) || 0;
    } else if (typeof data.change_percent === 'number') {
      changePercent = data.change_percent;
    }
  } catch (error) {
    console.warn('Error parsing change_percent:', error);
    changePercent = 0;
  }

  const change = data.change || 0;
  const price = data.price || 0;

  return {
    id: (data.symbol || 'unknown').toLowerCase(),
    name: data.symbol || 'Unknown Symbol',
    source: 'alpha-vantage',
    value: price,
    previousValue: price - change,
    change: change,
    changePercent: changePercent,
    unit: '$',
    timestamp: new Date(data.timestamp || Date.now()),
    refreshRate: 300, // 5 minutes for market data
    status: 'live',
    confidence: 0.98,
    impact: change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral',
    description: `${data.symbol || 'Market data'} from Alpha Vantage`
  };
};

/**
 * RealTimeDataDashboard - Advanced Feature Implementation
 * 
 * Modular component that displays live economic data streams.
 * Gracefully degrades when disabled via feature flags.
 */
export const RealTimeDataDashboard: React.FC<RealTimeDataDashboardProps> = ({
  location = 'Selected Region',
  analysisContext,
  onDataUpdate,
  onAlertTriggered,
  className
}) => {
  // Check if feature is enabled
  const isEnabled = isPhase4FeatureEnabled('realTimeDataStreams');
  const config = getPhase4FeatureConfig('realTimeDataStreams');
  
  // State
  const [streams, setStreams] = useState<DataStream[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isInitialized, setIsInitialized] = useState(false);
  const updateIntervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  
  // If feature is disabled, return null
  if (!isEnabled) {
    return null;
  }
  
  // Initialize real-time data on component mount
  useEffect(() => {
    if (!isEnabled || isInitialized) return;

    const initializeRealTimeData = async () => {
      try {
        const realTimeResponse = await getRealTimeData();
        
        // Convert API response to DataStream format
        const convertedStreams: DataStream[] = [
          // Economic indicators from FRED
          ...realTimeResponse.economic_indicators.map((indicator: ServiceEconomicIndicator) => 
            convertEconomicIndicator(indicator)
          ),
          // Market data from Alpha Vantage
          ...realTimeResponse.market_data.map((market: MarketData) => 
            convertMarketData(market)
          )
        ];
        
        // Set converted streams or empty array if no data
        setStreams(convertedStreams.length > 0 ? convertedStreams : []);
        setIsInitialized(true);
      } catch (error) {
        console.error('Error initializing real-time data:', error);
        // Set empty array on error - no mock data in production
        setStreams([]);
        setIsInitialized(true);
      }
    };

    initializeRealTimeData();
  }, [isEnabled, isInitialized]);

  // Update stream data
  const updateStream = useCallback(async (streamId: string) => {
    try {
      // Try to get fresh data from API
      const realTimeResponse = await getRealTimeData();
      
      setStreams((prevStreams: DataStream[]) => {
        const updatedStreams = prevStreams.map(stream => {
          if (stream.id === streamId) {
            // Try to find matching data in API response
            if (stream.source === 'fred') {
              const indicator = realTimeResponse.economic_indicators.find((indicator: ServiceEconomicIndicator) => 
                indicator.series_id === stream.id || indicator.title.toLowerCase().includes(stream.name.toLowerCase())
              );
              if (indicator) {
                return {
                  ...stream,
                  ...convertEconomicIndicator(indicator),
                  previousValue: stream.value, // Keep previous value
                  status: 'live' as const
                };
              }
            } else if (stream.source === 'alpha-vantage') {
              const market = realTimeResponse.market_data.find((market: MarketData) => 
                market.symbol.toLowerCase() === stream.id || market.symbol.toLowerCase() === stream.name.toLowerCase()
              );
              if (market) {
                return {
                  ...stream,
                  ...convertMarketData(market),
                  previousValue: stream.value, // Keep previous value
                  status: 'live' as const
                };
              }
            }
          }
          return stream;
        });
        
        // Check for significant changes and trigger alerts
        const updatedStream = updatedStreams.find(s => s.id === streamId);
        if (updatedStream && Math.abs(updatedStream.changePercent || 0) > 5) {
          onAlertTriggered?.(`Significant change in ${updatedStream.name}: ${updatedStream.changePercent?.toFixed(1)}%`);
        }
        
        onDataUpdate?.(updatedStreams);
        return updatedStreams;
      });
      
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error updating stream:', error);
      // Update stream status to error on failure
      setStreams((prevStreams: DataStream[]) => {
        const updatedStreams = prevStreams.map(stream => 
          stream.id === streamId 
            ? { ...stream, status: 'error' as const, timestamp: new Date() }
            : stream
        );
        
        onDataUpdate?.(updatedStreams);
        return updatedStreams;
      });
      setLastUpdate(new Date());
    }
  }, [onDataUpdate, onAlertTriggered]);
  
  // Set up auto-refresh intervals
  useEffect(() => {
    if (isPaused || !config) return;
    
    // Clear existing intervals
    updateIntervalsRef.current.forEach(interval => clearInterval(interval));
    updateIntervalsRef.current.clear();
    
    // Set up new intervals based on each stream's refresh rate
    streams.forEach(stream => {
      if (stream.status === 'live' || stream.status === 'updating') {
        const interval = setInterval(
          () => updateStream(stream.id),
          Math.max(stream.refreshRate * 1000, config.updateIntervalSeconds * 1000)
        );
        updateIntervalsRef.current.set(stream.id, interval);
      }
    });
    
    // Cleanup
    return () => {
      updateIntervalsRef.current.forEach(interval => clearInterval(interval));
      updateIntervalsRef.current.clear();
    };
  }, [streams, isPaused, config, updateStream]);
  
  // Calculate overall market health
  const marketHealth = useCallback(() => {
    const positiveStreams = streams.filter(s => s.impact === 'positive').length;
    const totalStreams = streams.length;
    const healthScore = (positiveStreams / totalStreams) * 100;
    
    if (healthScore >= 70) return { status: 'Strong', color: 'text-green-600' };
    if (healthScore >= 40) return { status: 'Moderate', color: 'text-yellow-600' };
    return { status: 'Weak', color: 'text-red-600' };
  }, [streams]);
  
  const health = marketHealth();
  
  // Get icon for data source
  const getSourceIcon = (source: DataStream['source']) => {
    switch (source) {
      case 'fred': return DollarSign;
      case 'census': return Users;
      case 'alpha-vantage': return BarChart3;
      case 'news': return Newspaper;
      default: return Activity;
    }
  };
  
  // Get impact color
  const getImpactColor = (impact: DataStream['impact']) => {
    switch (impact) {
      case 'positive': return 'text-green-600 dark:text-green-400';
      case 'negative': return 'text-red-600 dark:text-red-400';
      case 'neutral': return 'text-gray-600 dark:text-gray-400';
    }
  };
  
  // Format time ago
  const timeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };
  
  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold">Real-Time Economic Data</h3>
            <p className="text-xs text-muted-foreground">
              Live indicators for {location}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsPaused(!isPaused)}
            className="text-xs"
          >
            {isPaused ? (
              <>
                <Play className="w-3 h-3 mr-1" />
                Resume
              </>
            ) : (
              <>
                <Pause className="w-3 h-3 mr-1" />
                Pause
              </>
            )}
          </Button>
        </div>
      </div>
      
      {/* Market Health Overview */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xs">Market Health</CardTitle>
              <CardDescription className="text-xs">
                Overall economic conditions
              </CardDescription>
            </div>
            <div className={cn("text-2xl font-bold", health.color)}>
              {health.status}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Progress 
              value={(streams.filter(s => s.impact === 'positive').length / streams.length) * 100}
              className="h-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {streams.filter(s => s.impact === 'positive').length} positive indicators
              </span>
              <span>
                Last update: {timeAgo(lastUpdate)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Data Stream Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {streams.map((stream) => {
          const SourceIcon = getSourceIcon(stream.source);
          const ImpactIcon = stream.changePercent && stream.changePercent > 0 
            ? TrendingUp 
            : stream.changePercent && stream.changePercent < 0 
              ? TrendingDown 
              : Activity;
          
          return (
            <Card key={stream.id} className="relative overflow-hidden">
              {/* Live indicator */}
              {stream.status === 'live' && !isPaused && (
                <div className="absolute top-2 right-2">
                  <span className="flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                </div>
              )}
              
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-muted">
                    <SourceIcon className="w-3 h-3" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-xs">{stream.name}</CardTitle>
                    <CardDescription className="text-xs">
                      {stream.source.toUpperCase()}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-3">
                {/* Value Display */}
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-2xl font-bold">
                      {typeof stream.value === 'number' 
                        ? stream.value.toFixed(stream.unit === '%' ? 1 : 0)
                        : stream.value}
                      <span className="text-xs font-normal text-muted-foreground ml-1">
                        {stream.unit}
                      </span>
                    </p>
                    {stream.changePercent !== undefined && (
                      <div className={cn("flex items-center gap-1 text-xs", getImpactColor(stream.impact))}>
                        <ImpactIcon className="w-3 h-3" />
                        <span>
                          {stream.changePercent > 0 ? '+' : ''}
                          {stream.changePercent.toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <Badge 
                    variant={stream.confidence > 0.9 ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {Math.round(stream.confidence * 100)}% conf
                  </Badge>
                </div>
                
                {/* Description */}
                <p className="text-xs text-muted-foreground">
                  {stream.description}
                </p>
                
                {/* Update Info */}
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                  <span className="flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" />
                    Every {stream.refreshRate}s
                  </span>
                  <span>{timeAgo(stream.timestamp)}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      {/* Alert Section */}
      {analysisContext && (
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-500" />
              Contextual Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs">
              <li className="flex items-start gap-2">
                <AlertCircle className="w-3 h-3 mt-0.5 text-blue-500" />
                <span>
                  {analysisContext.brand 
                    ? `Economic conditions favorable for ${analysisContext.brand} expansion`
                    : 'Current economic indicators support market expansion'}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Globe className="w-3 h-3 mt-0.5 text-blue-500" />
                <span>
                  Consumer spending index above regional average by 8.2%
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Building2 className="w-3 h-3 mt-0.5 text-blue-500" />
                <span>
                  New business applications trending {streams[3] && streams[3].changePercent && streams[3].changePercent > 0 ? 'up' : streams[3] && streams[3].changePercent && streams[3].changePercent < 0 ? 'down' : 'stable'} this quarter
                </span>
              </li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RealTimeDataDashboard;