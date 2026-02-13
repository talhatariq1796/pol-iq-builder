/**
 * Cluster View Toggle Component
 * 
 * Provides toggle controls to switch between individual zip code view,
 * clustered territory view, and combined view modes in the analysis interface.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ToggleGroup, 
  ToggleGroupItem 
} from '@/components/ui/toggle-group';
import { Card, CardContent } from '@/components/ui/card';
import { 
  MapPin, 
  Target, 
  BarChart3,
  Eye,
  EyeOff,
  Users,
  TrendingUp
} from 'lucide-react';

export type ViewMode = 'individual' | 'clustered' | 'both';

interface ClusterViewToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  individualCount: number;
  clusterCount: number;
  clusteredZipCodes: number;
  unclusteredCount?: number;
  className?: string;
  showStats?: boolean;
  disabled?: boolean;
}

export function ClusterViewToggle({
  viewMode,
  onViewModeChange,
  individualCount,
  clusterCount,
  clusteredZipCodes,
  unclusteredCount = 0,
  className = '',
  showStats = true,
  disabled = false
}: ClusterViewToggleProps) {
  const coverage = individualCount > 0 ? (clusteredZipCodes / individualCount) * 100 : 0;

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-4">
            <h4 className="font-medium">View Mode:</h4>
            <ToggleGroup 
              type="single" 
              value={viewMode} 
              onValueChange={(value: string) => value && onViewModeChange(value as ViewMode)}
              className="bg-muted rounded-lg p-1"
            >
              <ToggleGroupItem 
                value="individual" 
                aria-label="Individual zip code view"
                className="flex items-center gap-2"
              >
                <MapPin className="h-4 w-4" />
                <span>Individual</span>
                <Badge variant="outline" className="ml-1">
                  {individualCount}
                </Badge>
              </ToggleGroupItem>
              
              <ToggleGroupItem 
                value="clustered" 
                aria-label="Clustered territory view"
                className="flex items-center gap-2"
                disabled={clusterCount === 0}
              >
                <Target className="h-4 w-4" />
                <span>Territories</span>
                <Badge variant="outline" className="ml-1">
                  {clusterCount}
                </Badge>
              </ToggleGroupItem>
              
              <ToggleGroupItem 
                value="both" 
                aria-label="Both individual and clustered view"
                className="flex items-center gap-2"
                disabled={clusterCount === 0}
              >
                <BarChart3 className="h-4 w-4" />
                <span>Both</span>
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Quick Stats */}
          {showStats && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{clusteredZipCodes} of {individualCount} clustered</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4" />
                <span>{coverage.toFixed(0)}% coverage</span>
              </div>
              {unclusteredCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {unclusteredCount} unclustered
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* View Mode Description */}
        <div className="mt-3 pt-3 border-t">
          <ViewModeDescription 
            mode={viewMode} 
            clusterCount={clusterCount}
            individualCount={individualCount}
            clusteredZipCodes={clusteredZipCodes}
          />
        </div>
      </CardContent>
    </Card>
  );
}

interface ViewModeDescriptionProps {
  mode: ViewMode;
  clusterCount: number;
  individualCount: number;
  clusteredZipCodes: number;
}

function ViewModeDescription({ 
  mode, 
  clusterCount, 
  individualCount, 
  clusteredZipCodes 
}: ViewModeDescriptionProps) {
  const descriptions = {
    individual: {
      icon: <MapPin className="h-4 w-4 text-blue-600" />,
      title: 'Individual Zip Code View',
      description: `Showing ${individualCount} individual zip codes with their analysis scores. Each zip code is displayed as a separate data point for detailed analysis.`
    },
    clustered: {
      icon: <Target className="h-4 w-4 text-green-600" />,
      title: 'Territory Clustered View',
      description: `Showing ${clusterCount} campaign territories containing ${clusteredZipCodes} zip codes. Territories are grouped by analysis similarity and geographic proximity for campaign planning.`
    },
    both: {
      icon: <BarChart3 className="h-4 w-4 text-purple-600" />,
      title: 'Combined View',
      description: `Showing both individual zip codes and ${clusterCount} territories side-by-side. Compare individual performance with territory-level aggregated insights.`
    }
  };

  const current = descriptions[mode];

  return (
    <div className="flex items-start gap-3">
      {current.icon}
      <div>
        <h5 className="font-medium text-sm">{current.title}</h5>
        <p className="text-xs text-muted-foreground mt-1">
          {current.description}
        </p>
      </div>
    </div>
  );
}

/**
 * Compact version for use in headers or toolbars
 */
export function CompactClusterViewToggle({
  viewMode,
  onViewModeChange,
  clusterCount,
  disabled = false,
  className = ''
}: {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  clusterCount: number;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-sm font-medium">View:</span>
      <ToggleGroup 
        type="single" 
        value={viewMode} 
        onValueChange={(value: string) => value && onViewModeChange(value as ViewMode)}
        className="bg-muted rounded p-1"
      >
        <ToggleGroupItem value="individual" aria-label="Individual view">
          <MapPin className="h-3 w-3" />
        </ToggleGroupItem>
        <ToggleGroupItem 
          value="clustered" 
          aria-label="Clustered view" 
          disabled={clusterCount === 0}
        >
          <Target className="h-3 w-3" />
        </ToggleGroupItem>
        <ToggleGroupItem 
          value="both" 
          aria-label="Both views" 
          disabled={clusterCount === 0}
        >
          <BarChart3 className="h-3 w-3" />
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}

/**
 * View Toggle with Visibility Controls
 */
export function AdvancedClusterViewToggle({
  viewMode,
  onViewModeChange,
  individualCount,
  clusterCount,
  clusteredZipCodes,
  showIndividual = true,
  showClusters = true,
  onToggleIndividual,
  onToggleClusters,
  className = ''
}: ClusterViewToggleProps & {
  showIndividual?: boolean;
  showClusters?: boolean;
  onToggleIndividual?: (show: boolean) => void;
  onToggleClusters?: (show: boolean) => void;
}) {
  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Main View Toggle */}
          <div className="flex items-center justify-between">
            <ClusterViewToggle
              viewMode={viewMode}
              onViewModeChange={onViewModeChange}
              individualCount={individualCount}
              clusterCount={clusterCount}
              clusteredZipCodes={clusteredZipCodes}
              showStats={false}
              className="border-0 shadow-none"
            />
          </div>

          {/* Layer Visibility Controls */}
          <div className="flex items-center justify-between pt-3 border-t">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">Visibility:</span>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleIndividual?.(!showIndividual)}
                className="flex items-center gap-2"
              >
                {showIndividual ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                <span>Individual</span>
                <Badge variant="outline" className="ml-1">
                  {individualCount}
                </Badge>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleClusters?.(!showClusters)}
                className="flex items-center gap-2"
                disabled={clusterCount === 0}
              >
                {showClusters ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                <span>Territories</span>
                <Badge variant="outline" className="ml-1">
                  {clusterCount}
                </Badge>
              </Button>
            </div>

            {/* Coverage Stats */}
            <div className="text-sm text-muted-foreground">
              {clusteredZipCodes} of {individualCount} zip codes in territories
              ({((clusteredZipCodes / individualCount) * 100).toFixed(0)}% coverage)
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Hook for managing view mode state
 */
export function useClusterViewMode(initialMode: ViewMode = 'individual') {
  const [viewMode, setViewMode] = useState<ViewMode>(initialMode);
  const [showIndividual, setShowIndividual] = useState(true);
  const [showClusters, setShowClusters] = useState(true);

  const handleViewModeChange = React.useCallback((mode: ViewMode) => {
    setViewMode(mode);
    
    // Auto-adjust visibility based on view mode
    switch (mode) {
      case 'individual':
        setShowIndividual(true);
        setShowClusters(false);
        break;
      case 'clustered':
        setShowIndividual(false);
        setShowClusters(true);
        break;
      case 'both':
        setShowIndividual(true);
        setShowClusters(true);
        break;
    }
  }, []);

  return {
    viewMode,
    showIndividual,
    showClusters,
    setViewMode: handleViewModeChange,
    setShowIndividual,
    setShowClusters
  };
}