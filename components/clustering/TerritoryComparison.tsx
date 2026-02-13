/**
 * Territory Comparison Component
 * 
 * Provides side-by-side comparison of territories with interactive charts,
 * ranking tables, and campaign planning insights for strategic decision making.
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

const recharts = require('recharts') as { 
  RadarChart: React.ComponentType<any>; 
  PolarGrid: React.ComponentType<any>;
  PolarAngleAxis: React.ComponentType<any>;
  PolarRadiusAxis: React.ComponentType<any>;
  Radar: React.ComponentType<any>;
  ScatterChart: React.ComponentType<any>; 
  Scatter: React.ComponentType<any>; 
};
const RadarChart = recharts.RadarChart;
const PolarGrid = recharts.PolarGrid;
const PolarAngleAxis = recharts.PolarAngleAxis;
const PolarRadiusAxis = recharts.PolarRadiusAxis;
const Radar = recharts.Radar;
const ScatterChart = recharts.ScatterChart;
const Scatter = recharts.Scatter;
import { 
  Target, 
  Users, 
  MapPin, 
  TrendingUp,
  DollarSign,
  Award,
  AlertTriangle,
  BarChart3,
  Download,
  Eye,
  Scale
} from 'lucide-react';

import { ClusterResult } from '@/lib/clustering/types';
import { CampaignRecommendation, CampaignPlanningService } from '@/lib/clustering/campaign/CampaignPlanningService';

interface TerritoryComparisonProps {
  territories: ClusterResult[];
  selectedTerritoryIds: number[];
  onTerritoryToggle: (territoryId: number) => void;
  onExportComparison?: () => void;
  maxComparisons?: number;
  className?: string;
}

type ComparisonMetric = 'score' | 'population' | 'zipCodes' | 'radius' | 'efficiency';
type ChartType = 'bar' | 'radar' | 'scatter';

export function TerritoryComparison({
  territories,
  selectedTerritoryIds,
  onTerritoryToggle,
  onExportComparison,
  maxComparisons = 6,
  className = ''
}: TerritoryComparisonProps) {
  const [comparisonMetric, setComparisonMetric] = useState<ComparisonMetric>('score');
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [showCampaignData, setShowCampaignData] = useState(false);

  // Get selected territories for comparison
  const selectedTerritories = territories.filter(t => 
    selectedTerritoryIds.includes(t.clusterId)
  );

  // Generate campaign recommendations for selected territories
  const campaignRecommendations = useMemo(() => {
    if (!showCampaignData) return [];
    
    const campaignService = CampaignPlanningService.getInstance();
    return selectedTerritories.map(territory => 
      campaignService.generateTerritoryRecommendation(territory, 'analysis-geographic')
    );
  }, [selectedTerritories, showCampaignData]);

  // Prepare chart data
  const chartData = useMemo(() => {
    return selectedTerritories.map(territory => ({
      name: territory.name.length > 15 ? 
        territory.name.substring(0, 15) + '...' : 
        territory.name,
      fullName: territory.name,
      score: territory.averageScore,
      population: territory.totalPopulation / 1000, // Convert to thousands
      zipCodes: territory.zipCodes.length,
      radius: territory.radiusMiles,
      efficiency: territory.totalPopulation / territory.radiusMiles, // People per mile
      clusterId: territory.clusterId
    }));
  }, [selectedTerritories]);

  // Colors for territories
  const territoryColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96C93F', 
    '#FFA07A', '#DDA0DD', '#F0E68C', '#FFB347'
  ];

  if (selectedTerritories.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="text-center py-8">
          <Scale className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Territory Comparison</h3>
          <p className="text-muted-foreground">
            Select 2 or more territories to compare their characteristics and performance.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Comparison Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" />
                Territory Comparison ({selectedTerritories.length})
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Compare territories side-by-side to inform strategic decisions
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCampaignData(!showCampaignData)}
              >
                <Target className="h-4 w-4 mr-2" />
                {showCampaignData ? 'Hide' : 'Show'} Campaign Data
              </Button>
              
              {onExportComparison && (
                <Button variant="outline" size="sm" onClick={onExportComparison}>
                  <Download className="h-4 w-4 mr-2" />
                  Export Comparison
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Comparison Controls */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Metric:</span>
              <Select value={comparisonMetric} onValueChange={(value: ComparisonMetric) => setComparisonMetric(value)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="score">Score</SelectItem>
                  <SelectItem value="population">Population</SelectItem>
                  <SelectItem value="zipCodes">Zip Codes</SelectItem>
                  <SelectItem value="radius">Radius</SelectItem>
                  <SelectItem value="efficiency">Efficiency</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Chart:</span>
              <Select value={chartType} onValueChange={(value: ChartType) => setChartType(value)}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bar">Bar</SelectItem>
                  <SelectItem value="radar">Radar</SelectItem>
                  <SelectItem value="scatter">Scatter</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Comparison Chart */}
          <div className="h-80 mb-6">
            {chartType === 'bar' && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value: any, name: any, props: any) => [
                    typeof value === 'number' ? value.toFixed(1) : value,
                    getMetricLabel(comparisonMetric),
                    props.payload?.fullName
                  ]} />
                  <Bar dataKey={comparisonMetric} fill="#8884d8">
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={territoryColors[index % territoryColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}

            {chartType === 'radar' && (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={chartData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="name" />
                  <PolarRadiusAxis angle={90} domain={[0, 'dataMax']} />
                  <Radar
                    name="Territory Metrics"
                    dataKey={comparisonMetric}
                    stroke="#8884d8"
                    fill="#8884d8"
                    fillOpacity={0.3}
                  />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            )}

            {chartType === 'scatter' && (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="population" name="Population (K)" />
                  <YAxis dataKey="score" name="Score" />
                  <Tooltip formatter={(value: any, name: any) => [
                    typeof value === 'number' ? value.toFixed(1) : value,
                    name === 'population' ? 'Population (K)' : 'Score'
                  ]} />
                  <Scatter name="Territories" data={chartData} fill="#8884d8">
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={territoryColors[index % territoryColors.length]} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detailed Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Territory</TableHead>
                <TableHead className="text-center">Score</TableHead>
                <TableHead className="text-center">Population</TableHead>
                <TableHead className="text-center">Zip Codes</TableHead>
                <TableHead className="text-center">Radius</TableHead>
                <TableHead className="text-center">Efficiency</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedTerritories.map((territory, index) => {
                const efficiency = territory.totalPopulation / territory.radiusMiles;
                return (
                  <TableRow key={territory.clusterId}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: territoryColors[index % territoryColors.length] }}
                        />
                        <div>
                          <div className="font-medium">{territory.name}</div>
                          <div className="text-xs text-muted-foreground">
                            ID: {territory.clusterId}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="font-medium">{territory.averageScore.toFixed(1)}</div>
                      <Progress value={(territory.averageScore / 10) * 100} className="h-1 mt-1" />
                    </TableCell>
                    <TableCell className="text-center">
                      {territory.totalPopulation.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">
                      {territory.zipCodes.length}
                    </TableCell>
                    <TableCell className="text-center">
                      {territory.radiusMiles.toFixed(1)}mi
                    </TableCell>
                    <TableCell className="text-center">
                      {Math.round(efficiency).toLocaleString()}/mi
                    </TableCell>
                    <TableCell>
                      {territory.isValid ? (
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          Valid
                        </Badge>
                      ) : (
                        <Badge variant="destructive">Invalid</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Rankings */}
      <RankingCards territories={selectedTerritories} />

      {/* Campaign Comparison (if enabled) */}
      {showCampaignData && campaignRecommendations.length > 0 && (
        <CampaignComparisonSection recommendations={campaignRecommendations} />
      )}

      {/* Territory Selection Panel */}
      <TerritorySelectionPanel
        territories={territories}
        selectedIds={selectedTerritoryIds}
        onToggle={onTerritoryToggle}
        maxSelections={maxComparisons}
      />
    </div>
  );
}

function getMetricLabel(metric: ComparisonMetric): string {
  switch (metric) {
    case 'score': return 'Score';
    case 'population': return 'Population (K)';
    case 'zipCodes': return 'Zip Codes';
    case 'radius': return 'Radius (mi)';
    case 'efficiency': return 'People/Mile';
    default: return 'Value';
  }
}

interface RankingCardsProps {
  territories: ClusterResult[];
}

function RankingCards({ territories }: RankingCardsProps) {
  const sortedByScore = [...territories].sort((a, b) => b.averageScore - a.averageScore);
  const sortedByPopulation = [...territories].sort((a, b) => b.totalPopulation - a.totalPopulation);
  const sortedByEfficiency = [...territories].sort((a, b) => 
    (b.totalPopulation / b.radiusMiles) - (a.totalPopulation / a.radiusMiles)
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-4 w-4 text-yellow-600" />
            Top by Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {sortedByScore.slice(0, 3).map((territory, index) => (
              <div key={territory.clusterId} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="w-6 h-6 rounded-full p-0 flex items-center justify-center text-xs">
                    {index + 1}
                  </Badge>
                  <span className="text-sm font-medium truncate">{territory.name}</span>
                </div>
                <span className="text-sm font-bold">{territory.averageScore.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-600" />
            Largest Population
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {sortedByPopulation.slice(0, 3).map((territory, index) => (
              <div key={territory.clusterId} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="w-6 h-6 rounded-full p-0 flex items-center justify-center text-xs">
                    {index + 1}
                  </Badge>
                  <span className="text-sm font-medium truncate">{territory.name}</span>
                </div>
                <span className="text-sm font-bold">{Math.round(territory.totalPopulation / 1000)}K</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            Most Efficient
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {sortedByEfficiency.slice(0, 3).map((territory, index) => (
              <div key={territory.clusterId} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="w-6 h-6 rounded-full p-0 flex items-center justify-center text-xs">
                    {index + 1}
                  </Badge>
                  <span className="text-sm font-medium truncate">{territory.name}</span>
                </div>
                <span className="text-sm font-bold">
                  {Math.round(territory.totalPopulation / territory.radiusMiles).toLocaleString()}/mi
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface CampaignComparisonSectionProps {
  recommendations: CampaignRecommendation[];
}

function CampaignComparisonSection({ recommendations }: CampaignComparisonSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4" />
          Campaign Comparison
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Territory</TableHead>
              <TableHead className="text-center">Strategy</TableHead>
              <TableHead className="text-center">Budget</TableHead>
              <TableHead className="text-center">Priority</TableHead>
              <TableHead className="text-center">Timeline</TableHead>
              <TableHead>Primary Channels</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recommendations.map((rec) => (
              <TableRow key={rec.territoryId}>
                <TableCell className="font-medium">{rec.territoryName}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline">
                    {rec.campaignStrategy.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  ${rec.recommendedBudget.optimal.toLocaleString()}
                </TableCell>
                <TableCell className="text-center">
                  <Badge 
                    variant={rec.campaignStrategy.priority === 'high' ? 'default' : 
                             rec.campaignStrategy.priority === 'medium' ? 'secondary' : 'outline'}
                  >
                    {rec.campaignStrategy.priority}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  {rec.campaignStrategy.timeline}
                </TableCell>
                <TableCell>
                  <div className="text-xs">
                    {rec.mediaRecommendations.primaryChannels.slice(0, 2).map(channel => channel.name).join(', ')}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

interface TerritorySelectionPanelProps {
  territories: ClusterResult[];
  selectedIds: number[];
  onToggle: (id: number) => void;
  maxSelections: number;
}

function TerritorySelectionPanel({ territories, selectedIds, onToggle, maxSelections }: TerritorySelectionPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Select Territories to Compare</CardTitle>
        <p className="text-sm text-muted-foreground">
          Choose up to {maxSelections} territories ({selectedIds.length} selected)
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {territories.map((territory) => {
            const isSelected = selectedIds.includes(territory.clusterId);
            const isDisabled = !isSelected && selectedIds.length >= maxSelections;
            
            return (
              <div 
                key={territory.clusterId}
                className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
                  isSelected ? 'bg-blue-50 border-blue-200' : 
                  isDisabled ? 'bg-gray-50 border-gray-200 opacity-50' : 
                  'bg-white border-gray-200 hover:bg-gray-50'
                }`}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggle(territory.clusterId)}
                  disabled={isDisabled}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{territory.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Score: {territory.averageScore.toFixed(1)} • {territory.zipCodes.length} zip codes
                  </div>
                  {!territory.isValid && (
                    <div className="flex items-center gap-1 mt-1">
                      <AlertTriangle className="h-3 w-3 text-orange-500" />
                      <span className="text-xs text-orange-600">Invalid</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}