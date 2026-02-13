/**
 * Territory Summary Cards Component
 * 
 * Displays comprehensive summary cards for each territory with key metrics,
 * campaign insights, and actionable information for marketing planning.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
// Simple collapsible implementation (avoiding Radix dependency)
const SimpleCollapsible: React.FC<{ 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}> = ({ open, onOpenChange, children }) => {
  return <div>{children}</div>;
};

const SimpleCollapsibleTrigger: React.FC<{ 
  asChild?: boolean; 
  children: React.ReactNode;
}> = ({ children }) => {
  return <div>{children}</div>;
};

const SimpleCollapsibleContent: React.FC<{ 
  children: React.ReactNode;
}> = ({ children }) => {
  return <div>{children}</div>;
};
import { 
  Target, 
  MapPin, 
  Users, 
  TrendingUp,
  DollarSign,
  Calendar,
  Eye,
  ChevronDown,
  ChevronUp,
  Download,
  Share2,
  BarChart3,
  Zap
} from 'lucide-react';

import { ClusterResult } from '@/lib/clustering/types';

interface TerritorySummaryCardsProps {
  clusters: ClusterResult[];
  selectedClusterId?: number | null;
  onClusterSelect?: (clusterId: number | null) => void;
  onExportTerritory?: (clusterId: number) => void;
  onShareTerritory?: (clusterId: number) => void;
  sortBy?: 'score' | 'population' | 'zipCodes' | 'name';
  showInvalidClusters?: boolean;
  className?: string;
}

type SortOption = 'score' | 'population' | 'zipCodes' | 'name';

export function TerritorySummaryCards({
  clusters,
  selectedClusterId = null,
  onClusterSelect,
  onExportTerritory,
  onShareTerritory,
  sortBy = 'score',
  showInvalidClusters = false,
  className = ''
}: TerritorySummaryCardsProps) {
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [currentSort, setCurrentSort] = useState<SortOption>(sortBy);

  // Filter and sort clusters
  const filteredClusters = clusters.filter(c => showInvalidClusters || c.isValid);
  const sortedClusters = [...filteredClusters].sort((a, b) => {
    switch (currentSort) {
      case 'score':
        return b.averageScore - a.averageScore;
      case 'population':
        return b.totalPopulation - a.totalPopulation;
      case 'zipCodes':
        return b.zipCodes.length - a.zipCodes.length;
      case 'name':
        return a.name.localeCompare(b.name);
      default:
        return 0;
    }
  });

  const handleCardExpand = (clusterId: number) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(clusterId)) {
      newExpanded.delete(clusterId);
    } else {
      newExpanded.add(clusterId);
    }
    setExpandedCards(newExpanded);
  };

  const handleClusterSelect = (clusterId: number) => {
    const newSelectedId = selectedClusterId === clusterId ? null : clusterId;
    onClusterSelect?.(newSelectedId);
  };

  if (sortedClusters.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="text-center py-8">
          <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No territories available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Sort Controls */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Territory Summary</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sort by:</span>
          <select
            value={currentSort}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCurrentSort(e.target.value as SortOption)}
            className="text-sm border rounded px-2 py-1"
          >
            <option value="score">Score</option>
            <option value="population">Population</option>
            <option value="zipCodes">Zip Codes</option>
            <option value="name">Name</option>
          </select>
        </div>
      </div>

      {/* Territory Cards */}
      <div className="grid gap-4">
        {sortedClusters.map((cluster, index) => (
          <TerritoryCard
            key={cluster.clusterId}
            cluster={cluster}
            rank={index + 1}
            isSelected={selectedClusterId === cluster.clusterId}
            isExpanded={expandedCards.has(cluster.clusterId)}
            onSelect={() => handleClusterSelect(cluster.clusterId)}
            onExpand={() => handleCardExpand(cluster.clusterId)}
            onExport={() => onExportTerritory?.(cluster.clusterId)}
            onShare={() => onShareTerritory?.(cluster.clusterId)}
          />
        ))}
      </div>

      {/* Summary Stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Overall Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{sortedClusters.length}</div>
              <div className="text-muted-foreground">Total Territories</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {sortedClusters.reduce((sum, c) => sum + c.zipCodes.length, 0)}
              </div>
              <div className="text-muted-foreground">Total Zip Codes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {Math.round(sortedClusters.reduce((sum, c) => sum + c.totalPopulation, 0) / 1000)}K
              </div>
              <div className="text-muted-foreground">Total Population</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {(sortedClusters.reduce((sum, c) => sum + c.averageScore, 0) / sortedClusters.length).toFixed(1)}
              </div>
              <div className="text-muted-foreground">Avg Score</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface TerritoryCardProps {
  cluster: ClusterResult;
  rank: number;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  onExpand: () => void;
  onExport?: () => void;
  onShare?: () => void;
}

function TerritoryCard({
  cluster,
  rank,
  isSelected,
  isExpanded,
  onSelect,
  onExpand,
  onExport,
  onShare
}: TerritoryCardProps) {
  const scoreColor = cluster.averageScore >= 7 ? 'text-green-600' : 
                    cluster.averageScore >= 5 ? 'text-blue-600' : 
                    cluster.averageScore >= 3 ? 'text-orange-600' : 'text-red-600';

  const scoreProgress = (cluster.averageScore / 10) * 100;

  return (
    <Card 
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected ? 'ring-2 ring-blue-500 shadow-lg' : ''
      } ${!cluster.isValid ? 'opacity-75 border-dashed' : ''}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Badge variant="outline" className="text-xs">#{rank}</Badge>
              <CardTitle className="text-lg">{cluster.name}</CardTitle>
              {!cluster.isValid && (
                <Badge variant="destructive" className="text-xs">Invalid</Badge>
              )}
              {isSelected && (
                <Eye className="h-4 w-4 text-blue-500" />
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {cluster.keyInsights}
            </p>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${scoreColor}`}>
              {cluster.averageScore.toFixed(1)}
            </div>
            <div className="text-xs text-muted-foreground">Score</div>
          </div>
        </div>

        {/* Score Progress Bar */}
        <div className="w-full">
          <Progress value={scoreProgress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Score Range: {cluster.scoreRange[0].toFixed(1)} - {cluster.scoreRange[1].toFixed(1)}</span>
            <span>{scoreProgress.toFixed(0)}%</span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <MapPin className="h-4 w-4 text-blue-600" />
              <span className="font-semibold">{cluster.zipCodes.length}</span>
            </div>
            <div className="text-xs text-muted-foreground">Zip Codes</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Users className="h-4 w-4 text-green-600" />
              <span className="font-semibold">{Math.round(cluster.totalPopulation / 1000)}K</span>
            </div>
            <div className="text-xs text-muted-foreground">Population</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Target className="h-4 w-4 text-orange-600" />
              <span className="font-semibold">{cluster.radiusMiles.toFixed(0)}mi</span>
            </div>
            <div className="text-xs text-muted-foreground">Radius</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onSelect}
            className="flex-1 mr-2"
          >
            {isSelected ? 'Deselect' : 'Select Territory'}
          </Button>
          
          <div className="flex gap-1">
            {onExport && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  onExport();
                }}
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
            {onShare && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  onShare();
                }}
              >
                <Share2 className="h-4 w-4" />
              </Button>
            )}
            <SimpleCollapsible open={isExpanded} onOpenChange={onExpand}>
              <SimpleCollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" onClick={onExpand}>
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </SimpleCollapsibleTrigger>
            </SimpleCollapsible>
          </div>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <SimpleCollapsibleContent>
            <Separator className="my-4" />
            
            <div className="space-y-4">
              {/* Detailed Metrics */}
              <div>
                <h5 className="font-medium mb-2 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Detailed Metrics
                </h5>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Territory ID:</span>
                    <span className="ml-2 font-medium">{cluster.clusterId}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Population Density:</span>
                    <span className="ml-2 font-medium">
                      {Math.round(cluster.totalPopulation / cluster.zipCodes.length).toLocaleString()}/zip
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Score Variance:</span>
                    <span className="ml-2 font-medium">
                      {(cluster.scoreRange[1] - cluster.scoreRange[0]).toFixed(1)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Compactness:</span>
                    <span className="ml-2 font-medium">
                      {cluster.radiusMiles <= 30 ? 'High' : cluster.radiusMiles <= 50 ? 'Medium' : 'Low'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Campaign Recommendations */}
              <div>
                <h5 className="font-medium mb-2 flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Campaign Recommendations
                </h5>
                <div className="space-y-2 text-sm">
                  <CampaignRecommendation cluster={cluster} />
                </div>
              </div>

              {/* Validation Issues (if any) */}
              {!cluster.isValid && cluster.validationIssues.length > 0 && (
                <div>
                  <h5 className="font-medium mb-2 text-red-600">Validation Issues</h5>
                  <ul className="text-sm text-red-600 space-y-1">
                    {cluster.validationIssues.map((issue, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-red-500">•</span>
                        {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Zip Code List (first 10) */}
              <div>
                <h5 className="font-medium mb-2 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Zip Codes ({cluster.zipCodes.length})
                </h5>
                <div className="flex flex-wrap gap-1">
                  {cluster.zipCodes.slice(0, 10).map((zipCode) => (
                    <Badge key={zipCode} variant="secondary" className="text-xs">
                      {zipCode}
                    </Badge>
                  ))}
                  {cluster.zipCodes.length > 10 && (
                    <Badge variant="outline" className="text-xs">
                      +{cluster.zipCodes.length - 10} more
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </SimpleCollapsibleContent>
        )}
      </CardContent>
    </Card>
  );
}

function CampaignRecommendation({ cluster }: { cluster: ClusterResult }) {
  const recommendations: string[] = [];

  // Budget recommendation
  if (cluster.totalPopulation >= 100000) {
    recommendations.push(`💰 Large-scale campaign recommended (${Math.round(cluster.totalPopulation / 1000)}K population)`);
  } else if (cluster.totalPopulation >= 50000) {
    recommendations.push(`💰 Medium campaign budget suitable (${Math.round(cluster.totalPopulation / 1000)}K population)`);
  } else {
    recommendations.push(`💰 Focused local campaign (${Math.round(cluster.totalPopulation / 1000)}K population)`);
  }

  // Score-based recommendation
  if (cluster.averageScore >= 7) {
    recommendations.push('🎯 High-priority target for premium campaigns');
  } else if (cluster.averageScore >= 5) {
    recommendations.push('🎯 Strong potential for standard campaigns');
  } else if (cluster.averageScore >= 3) {
    recommendations.push('🎯 Consider awareness or educational campaigns');
  } else {
    recommendations.push('🎯 Long-term development opportunity');
  }

  // Geographic recommendation
  if (cluster.radiusMiles <= 25) {
    recommendations.push('📍 Compact territory - ideal for local media and events');
  } else if (cluster.radiusMiles <= 50) {
    recommendations.push('📍 Regional territory - suitable for digital and broadcast media');
  } else {
    recommendations.push('📍 Large territory - consider sub-regional campaigns');
  }

  return (
    <div className="space-y-1">
      {recommendations.map((rec, index) => (
        <div key={index} className="text-sm text-muted-foreground">
          {rec}
        </div>
      ))}
    </div>
  );
}
