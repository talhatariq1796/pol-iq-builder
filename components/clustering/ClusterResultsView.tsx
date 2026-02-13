/**
 * Cluster Results View Component
 * 
 * Displays clustering results alongside or instead of individual zip code results.
 * Provides toggle between individual and clustered view modes.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ToggleGroup, 
  ToggleGroupItem 
} from '@/components/ui/toggle-group';
import { 
  Target, 
  MapPin, 
  Users, 
  TrendingUp,
  Info,
  Eye,
  EyeOff,
  BarChart3,
  Download
} from 'lucide-react';

import { ClusterResult, ClusteringResult } from '@/lib/clustering/types';

interface ClusterResultsViewProps {
  clusteringResult: ClusteringResult;
  individualResults?: any[]; // Original individual zip code results
  onViewModeChange?: (mode: 'individual' | 'clustered' | 'both') => void;
  onClusterSelect?: (clusterId: number | null) => void;
  onExportClusters?: () => void;
  className?: string;
}

type ViewMode = 'individual' | 'clustered' | 'both';

export function ClusterResultsView({
  clusteringResult,
  individualResults = [],
  onViewModeChange,
  onClusterSelect,
  onExportClusters,
  className = ''
}: ClusterResultsViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('clustered');
  const [selectedClusterId, setSelectedClusterId] = useState<number | null>(null);

  const handleViewModeChange = (newMode: ViewMode) => {
    setViewMode(newMode);
    onViewModeChange?.(newMode);
  };

  const handleClusterSelect = (clusterId: number | null) => {
    setSelectedClusterId(clusterId);
    onClusterSelect?.(clusterId);
  };

  const validClusters = clusteringResult.clusters.filter(c => c.isValid);
  const invalidClusters = clusteringResult.clusters.filter(c => !c.isValid);

  if (!clusteringResult.success || clusteringResult.clusters.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Clustering could not be applied to this analysis. Showing individual results only.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* View Mode Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold">Analysis Results</h3>
          <ToggleGroup 
            type="single" 
            value={viewMode} 
            onValueChange={(value: string) => value && handleViewModeChange(value as ViewMode)}
            className="bg-muted rounded-lg p-1"
          >
            <ToggleGroupItem value="individual" aria-label="Individual view">
              <MapPin className="h-4 w-4 mr-2" />
              Individual ({individualResults.length})
            </ToggleGroupItem>
            <ToggleGroupItem value="clustered" aria-label="Clustered view">
              <Target className="h-4 w-4 mr-2" />
              Territories ({validClusters.length})
            </ToggleGroupItem>
            <ToggleGroupItem value="both" aria-label="Both views">
              <BarChart3 className="h-4 w-4 mr-2" />
              Both
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {onExportClusters && (
          <Button onClick={onExportClusters} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Territories
          </Button>
        )}
      </div>

      {/* Clustering Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            Territory Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{validClusters.length}</div>
              <div className="text-muted-foreground">Valid Territories</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{clusteringResult.clusteredZipCodes}</div>
              <div className="text-muted-foreground">Zip Codes Clustered</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {validClusters.reduce((sum, c) => sum + c.totalPopulation, 0).toLocaleString()}
              </div>
              <div className="text-muted-foreground">Total Population</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">{clusteringResult.unclustered.length}</div>
              <div className="text-muted-foreground">Unclustered</div>
            </div>
          </div>
          
          {clusteringResult.unclustered.length > 0 && (
            <Alert className="mt-4">
              <Info className="h-4 w-4" />
              <AlertDescription>
                {clusteringResult.unclustered.length} zip codes could not be clustered due to size, population, or distance constraints.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Cluster Results (when in clustered or both mode) */}
      {(viewMode === 'clustered' || viewMode === 'both') && (
        <div className="space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <Target className="h-4 w-4" />
            Campaign Territories
          </h4>
          
          <div className="grid gap-3">
            {validClusters.map((cluster) => (
              <ClusterCard
                key={cluster.clusterId}
                cluster={cluster}
                isSelected={selectedClusterId === cluster.clusterId}
                onSelect={() => handleClusterSelect(
                  selectedClusterId === cluster.clusterId ? null : cluster.clusterId
                )}
              />
            ))}
          </div>

          {invalidClusters.length > 0 && (
            <div className="mt-6">
              <h5 className="font-medium text-muted-foreground mb-2">
                Invalid Territories ({invalidClusters.length})
              </h5>
              <div className="grid gap-2">
                {invalidClusters.map((cluster) => (
                  <ClusterCard
                    key={cluster.clusterId}
                    cluster={cluster}
                    isSelected={false}
                    onSelect={() => {}}
                    isInvalid={true}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Individual Results (when in individual or both mode) */}
      {(viewMode === 'individual' || viewMode === 'both') && individualResults.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Individual Zip Codes
          </h4>
          
          <div className="max-h-96 overflow-y-auto">
            <div className="grid gap-2">
              {individualResults.slice(0, 50).map((result, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div>
                    <div className="font-medium">{result.area_name || result.zipCode}</div>
                    <div className="text-sm text-muted-foreground">
                      {result.cluster ? `Territory: ${result.cluster.clusterName}` : 'Not clustered'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{result.value?.toFixed(2) || 'N/A'}</div>
                    <div className="text-sm text-muted-foreground">Score</div>
                  </div>
                </div>
              ))}
            </div>
            
            {individualResults.length > 50 && (
              <div className="text-center text-sm text-muted-foreground mt-2">
                Showing first 50 of {individualResults.length} results
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface ClusterCardProps {
  cluster: ClusterResult;
  isSelected: boolean;
  onSelect: () => void;
  isInvalid?: boolean;
}

function ClusterCard({ cluster, isSelected, onSelect, isInvalid = false }: ClusterCardProps) {
  return (
    <Card 
      className={`cursor-pointer transition-all ${
        isSelected ? 'ring-2 ring-blue-500' : ''
      } ${isInvalid ? 'opacity-60' : ''}`}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h5 className="font-medium">{cluster.name}</h5>
              {cluster.isValid ? (
                <Badge variant="secondary">Valid</Badge>
              ) : (
                <Badge variant="destructive">Invalid</Badge>
              )}
              {isSelected && <Eye className="h-4 w-4 text-blue-500" />}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {cluster.keyInsights}
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold">{cluster.averageScore.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">Avg Score</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <MapPin className="h-3 w-3" />
              <span className="font-medium">{cluster.zipCodes.length}</span>
            </div>
            <div className="text-muted-foreground text-xs">Zip Codes</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <Users className="h-3 w-3" />
              <span className="font-medium">{Math.round(cluster.totalPopulation / 1000)}K</span>
            </div>
            <div className="text-muted-foreground text-xs">Population</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <Target className="h-3 w-3" />
              <span className="font-medium">{cluster.radiusMiles.toFixed(0)}mi</span>
            </div>
            <div className="text-muted-foreground text-xs">Radius</div>
          </div>
        </div>

        {!cluster.isValid && cluster.validationIssues.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <div className="text-xs text-muted-foreground">
              Issues: {cluster.validationIssues.join(', ')}
            </div>
          </div>
        )}

        <div className="mt-3 pt-3 border-t">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Score Range: {cluster.scoreRange[0].toFixed(1)} - {cluster.scoreRange[1].toFixed(1)}</span>
            <span>ID: {cluster.clusterId}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}