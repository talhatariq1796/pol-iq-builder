import React, { useRef, useState, useEffect, memo, useCallback, useMemo } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer,
  Bar,
  Cell,
  BarChart
} from 'recharts';

const ComposedChart = (require('recharts') as { ComposedChart: React.ComponentType<any> }).ComposedChart;
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Graphic from "@arcgis/core/Graphic";

// Use AnalysisEngine types instead of deleted AILayerManager
import { AnalysisResult, ProcessedAnalysisData } from '@/lib/analysis/types';

// Type aliases for backward compatibility
type AIResponse = AnalysisResult;
type AIResponseData = ProcessedAnalysisData;

// Constants
const defaultColors = [
  '#4285f4', // Google Blue
  '#34a853', // Google Green
  '#fbbc05', // Google Yellow
  '#ea4335', // Google Red
  '#5f6368', // Google Grey
  '#185abc', // Dark Blue
  '#137333', // Dark Green
  '#ea8600', // Dark Yellow
  '#c5221f'  // Dark Red
];

interface VisualizationProps {
  response: AIResponse;
  view: __esri.MapView;
  onSelect?: (features: __esri.Graphic[]) => void;
}

const AIVisualization: React.FC<VisualizationProps> = memo(({
  response,
  view,
  onSelect
}) => {
  const [highlights, setHighlights] = useState<__esri.Handle[]>([]);
  const chartRef = useRef<HTMLDivElement>(null);
  const highlightsRef = useRef<__esri.Handle[]>([]);

  // Update ref when highlights change
  useEffect(() => {
    highlightsRef.current = highlights;
  }, [highlights]);

  // Cleanup highlights on unmount only
  useEffect(() => {
    return () => {
      highlightsRef.current.forEach(handle => {
        if (handle && handle.remove) {
          handle.remove();
        }
      });
    };
  }, []); // Empty dependency - cleanup on unmount only

  // Handle chart click interactions
  const handleChartClick = (data: any) => {
    if (!response || !view) return;

    // Clear existing highlights
    highlights.forEach(handle => {
      if (handle && handle.remove) {
        handle.remove();
      }
    });

    // Use records instead of features for AnalysisEngine
    let selectedFeatures: __esri.Graphic[] = [];
    
    // Simple fallback - highlight all available data
    if (response.data.records && response.data.records.length > 0) {
      // Convert records to graphics if needed
      selectedFeatures = response.data.records.map((record: any) => {
        return new Graphic({
          geometry: record.geometry,
          attributes: record
        });
      }).slice(0, 10); // Limit to first 10 for performance
    }

    if (selectedFeatures.length > 0) {
      // Create new highlights
      const newHighlights: __esri.Handle[] = [];
      
      selectedFeatures.forEach(feature => {
        const highlightGraphic = new Graphic({
          geometry: feature.geometry,
          symbol: {
            type: feature.geometry?.type === "polygon" ? "simple-fill" :
                  feature.geometry?.type === "polyline" ? "simple-line" :
                  "simple-marker",
            color: [255, 255, 0, 0.3],
            outline: {
              color: [255, 255, 0],
              width: 2
            }
          } as any
        });
        
        // Add to view graphics and create a handle for cleanup
        view.graphics.add(highlightGraphic);
        newHighlights.push({
          remove: () => {
            view.graphics.remove(highlightGraphic);
          }
        });
      });
      
      setHighlights(newHighlights);

      // Notify parent component
      onSelect?.(selectedFeatures);

      // Zoom to selected features
      view.goTo(selectedFeatures);
    }
  };

  // Competition chart renderer
  const renderCompetitionChart = (data: AIResponseData) => {
    if (!data.statistics) return null;

    const chartData = [{
      name: 'Competition Analysis',
      competitors: (data.statistics as any).competitors || 0,
      marketGap: (data.statistics as any).marketGap || 0,
      averageDistance: (data.statistics as any).averageDistance || 0
    }];

    return (
      <div className="space-y-6">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} onClick={handleChartClick}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis yAxisId="left" orientation="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip 
                formatter={(value: number, name: string) => [
                  name === 'averageDistance' 
                    ? `${(value / 1000).toFixed(2)} km`
                    : value.toLocaleString(),
                  name.split(/(?=[A-Z])/).join(' ')
                ]}
              />
              <Legend />
              <Bar 
                yAxisId="left"
                dataKey="competitors" 
                fill={defaultColors[0]}
                onClick={handleChartClick}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="averageDistance"
                stroke={defaultColors[1]}
                strokeWidth={2}
              />
              <Bar
                yAxisId="left"
                dataKey="marketGap"
                fill={defaultColors[2]}
                onClick={handleChartClick}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Summary metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg bg-blue-50 p-4">
            <div className="text-sm text-blue-600 font-medium">Competitors</div>
            <div className="text-2xl font-bold text-blue-700">
              {chartData[0].competitors}
            </div>
          </div>
          <div className="rounded-lg bg-green-50 p-4">
            <div className="text-sm text-green-600 font-medium">Avg Distance</div>
            <div className="text-2xl font-bold text-green-700">
              {(chartData[0].averageDistance / 1000).toFixed(2)} km
            </div>
          </div>
          <div className="rounded-lg bg-yellow-50 p-4">
            <div className="text-sm text-yellow-600 font-medium">Market Gap</div>
            <div className="text-2xl font-bold text-yellow-700">
              {chartData[0].marketGap ? "Yes" : "No"}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Market analysis chart renderer
  const renderMarketChart = (data: AIResponseData) => {
    if (!data.statistics) return null;

    const chartData = [
      {
        name: 'Market Metrics',
        population: (data.statistics as any).population || 0,
        spendingPower: (data.statistics as any).spendingPower || 0,
        penetrationRate: ((data.statistics as any).penetrationRate || 0) * 100
      }
    ];

    const chartHeight = 300;
    const chartWidth = Math.min(600, window.innerWidth - 64);

    return (
      <div className="space-y-6">
        {/* Main metrics chart */}
        <div className="h-80">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <ComposedChart data={chartData} onClick={handleChartClick}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis 
                yAxisId="left"
                orientation="left"
                label={{ value: 'Population', angle: -90, position: 'insideLeft' }}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                label={{ value: 'Spending Power ($)', angle: 90, position: 'insideRight' }}
              />
              <Tooltip
                formatter={(value: number, name: string) => {
                  switch (name) {
                    case 'population':
                      return [value.toLocaleString(), 'Population'];
                    case 'spendingPower':
                      return [`$${value.toLocaleString()}`, 'Spending Power'];
                    case 'penetrationRate':
                      return [`${value.toFixed(1)}%`, 'Penetration Rate'];
                    default:
                      return [value, name];
                  }
                }}
              />
              <Legend />
              <Bar 
                yAxisId="left"
                dataKey="population" 
                fill="#4285f4"
                name="Population"
                onClick={handleChartClick}
              />
              <Bar 
                yAxisId="right"
                dataKey="spendingPower" 
                fill="#34a853"
                name="Spending Power"
                onClick={handleChartClick}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="penetrationRate"
                stroke="#fbbc05"
                strokeWidth={2}
                name="Penetration Rate (%)"
                dot={{ stroke: '#fbbc05', strokeWidth: 2, r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Key metrics summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg bg-blue-50 p-4">
            <div className="text-sm text-blue-600 font-medium">Population</div>
            <div className="text-2xl font-bold text-blue-700">
              {chartData[0].population.toLocaleString()}
            </div>
          </div>
          <div className="rounded-lg bg-green-50 p-4">
            <div className="text-sm text-green-600 font-medium">Spending Power</div>
            <div className="text-2xl font-bold text-green-700">
              ${chartData[0].spendingPower.toLocaleString()}
            </div>
          </div>
          <div className="rounded-lg bg-yellow-50 p-4">
            <div className="text-sm text-yellow-600 font-medium">Penetration Rate</div>
            <div className="text-2xl font-bold text-yellow-700">
              {chartData[0].penetrationRate.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Standard analysis chart renderer
  const renderStandardChart = (data: AIResponseData) => {
    if (!data.statistics || Object.keys(data.statistics).length === 0) return null;

    // Transform statistics into chart data
    const chartData = Object.entries(data.statistics).map(([key, value]) => ({
      name: key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
      value: value
    }));

    return (
      <div className="space-y-6">
        {/* Main metrics chart */}
        <div className="h-80">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={100}
                interval={0}
                tick={{ fontSize: 12 }}
              />
              <YAxis />
              <Tooltip
                formatter={(value: number) => [value.toLocaleString(), 'Value']}
              />
              <Legend />
              <Bar 
                dataKey="value" 
                fill="#4285f4"
                name="Value"
                onClick={handleChartClick}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`}
                    fill={defaultColors[index % defaultColors.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Statistics summary grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {chartData.map((stat, index) => (
            <div 
              key={stat.name}
              className="rounded-lg bg-gray-50 p-4 hover:bg-gray-100 cursor-pointer"
              onClick={() => handleChartClick({ payload: stat })}
            >
              <div className="text-sm text-gray-600 font-medium">{stat.name}</div>
              <div 
                className="text-xl font-bold"
                style={{ color: defaultColors[index % defaultColors.length] }}
              >
                {stat.value.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Main visualization renderer
  const renderVisualization = () => {
    if (!response) return null;

    // Use endpoint or analysis type to determine visualization
    const analysisType = (response as any).endpoint || (response as any).type || 'STANDARD';
    
    if (analysisType.includes('competitive') || analysisType === 'COMPETITION') {
      return renderCompetitionChart(response.data);
    } else if (analysisType.includes('market') || analysisType === 'MARKET') {
      return renderMarketChart(response.data);
    } else {
      return renderStandardChart(response.data);
    }
  };

  if (!response) {
    return (
      <Alert>
        <AlertDescription>
          No visualization data available
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div ref={chartRef}>
          {renderVisualization()}
        </div>
      </CardContent>
    </Card>
  );
});

AIVisualization.displayName = 'AIVisualization';

export default AIVisualization;