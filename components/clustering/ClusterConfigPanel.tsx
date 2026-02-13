/**
 * Cluster Configuration Panel Component
 * 
 * Provides UI controls for configuring campaign territory clustering parameters.
 * Integrates with analysis query pipeline to enable clustering-based results.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Settings, 
  Target, 
  Users, 
  MapPin, 
  Radius,
  Info,
  AlertTriangle,
  Zap,
  Eye
} from 'lucide-react';

import { 
  ClusterConfig, 
  DEFAULT_CLUSTER_CONFIG, 
  CAMPAIGN_PRESETS 
} from '@/lib/clustering/types';
import { validateClusterConfig } from '@/lib/clustering/utils/cluster-validation';

interface ClusterConfigPanelProps {
  config: ClusterConfig;
  onConfigChange: (config: ClusterConfig) => void;
  onPreviewClusters?: () => void;
  onSave?: () => void;
  datasetInfo?: {
    totalZipCodes: number;
    totalPopulation: number;
    geographicSpread: { minDistance: number; maxDistance: number };
  };
  isPreviewLoading?: boolean;
  className?: string;
}

// Clustering method is now auto-detected based on the selected analysis endpoint
// This eliminates redundancy and simplifies the user experience

const PRESET_OPTIONS = [
  { key: 'custom', label: 'Custom Configuration' },
  { key: 'brand-campaign', label: 'Brand Campaign (Large Scale)' },
  { key: 'regional-advertising', label: 'Regional Advertising' },
  { key: 'local-testing', label: 'Local Market Testing' },
  { key: 'competitive-analysis', label: 'Competitive Analysis' }
];

export function ClusterConfigPanel({
  config,
  onConfigChange,
  onPreviewClusters,
  onSave,
  datasetInfo,
  isPreviewLoading = false,
  className = ''
}: ClusterConfigPanelProps) {
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    warnings: string[];
    errors: string[];
  } | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>('custom');

  // Validate configuration whenever it changes
  useEffect(() => {
    if (datasetInfo) {
      const result = validateClusterConfig(
        config,
        datasetInfo.totalZipCodes,
        datasetInfo.totalPopulation,
        datasetInfo.geographicSpread
      );
      setValidationResult(result);
    }
  }, [config, datasetInfo]);

  const handleConfigChange = useCallback((updates: Partial<ClusterConfig>) => {
    const newConfig = { ...config, ...updates };
    onConfigChange(newConfig);
    
    // Reset preset selection if manually changing config
    if (selectedPreset !== 'custom') {
      setSelectedPreset('custom');
    }
  }, [config, onConfigChange, selectedPreset]);

  const handlePresetChange = useCallback((presetKey: string) => {
    setSelectedPreset(presetKey);
    
    if (presetKey === 'custom') {
      return;
    }
    
    const preset = CAMPAIGN_PRESETS[presetKey];
    if (preset) {
      const newConfig = { ...config, ...preset };
      onConfigChange(newConfig);
    }
  }, [config, onConfigChange]);

  const handleToggleClustering = useCallback((enabled: boolean) => {
    handleConfigChange({ enabled });
  }, [handleConfigChange]);

  // Method is now auto-detected, so we display a descriptive message instead

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-[#33a852]" />
            <CardTitle className="text-lg">Clustering Configuration</CardTitle>
          </div>
          <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg">
            <Label htmlFor="clustering-toggle" className="text-sm font-medium cursor-pointer">
              Enable Clustering
            </Label>
            <Switch
              id="clustering-toggle"
              checked={config.enabled}
              onCheckedChange={handleToggleClustering}
              className="data-[state=checked]:bg-[#33a852]"
            />
          </div>
        </div>
        
        {config.enabled && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Clustering groups individual zip codes into territories based on your selected analysis endpoint and geographic proximity. The clustering method is automatically optimized for your chosen analysis type.
            </AlertDescription>
          </Alert>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
          {/* Disabled state message */}
          {!config.enabled && (
            <Alert className="bg-amber-50 border-amber-200">
              <Info className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                Enable clustering using the toggle above to configure territory settings.
              </AlertDescription>
            </Alert>
          )}
          
          {/* Preset Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Configuration Preset</Label>
            <Select value={selectedPreset} onValueChange={handlePresetChange} disabled={!config.enabled}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a preset configuration" />
              </SelectTrigger>
              <SelectContent>
                {PRESET_OPTIONS.map((preset) => (
                  <SelectItem key={preset.key} value={preset.key}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Clustering Method Info - Now Auto-Detected */}
          {config.enabled && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Clustering Method</Label>
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <Target className="h-5 w-5 text-green-600" />
                <div className="flex-1">
                  <div className="font-medium text-green-800">Auto-Detected from Analysis</div>
                  <div className="text-sm text-green-600">
                    The clustering method is automatically optimized based on your selected analysis endpoint, combining analysis scores with geographic proximity for balanced territories.
                  </div>
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Territory Parameters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Number of Clusters */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Number of Territories
                </Label>
                <Badge variant="outline">{config.numClusters}</Badge>
              </div>
              <Slider
                value={config.numClusters}
                onValueChange={(value: number[]) => handleConfigChange({ numClusters: value[0] })}
                min={1}
                max={20}
                step={1}
                className="w-full"
                disabled={!config.enabled}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1 territory</span>
                <span>20 territories</span>
              </div>
            </div>

            {/* Min Zip Codes */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Min Zip Codes per Territory
                </Label>
                <Badge variant="outline">{config.minZipCodes}</Badge>
              </div>
              <Slider
                value={config.minZipCodes}
                onValueChange={(value: number[]) => handleConfigChange({ minZipCodes: value[0] })}
                min={5}
                max={50}
                step={1}
                className="w-full"
                disabled={!config.enabled}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>5 zip codes</span>
                <span>50 zip codes</span>
              </div>
            </div>

            {/* Min Population */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Min Combined Population
                </Label>
                <Badge variant="outline">{config.minPopulation.toLocaleString()}</Badge>
              </div>
              <Slider
                value={config.minPopulation}
                onValueChange={(value: number[]) => handleConfigChange({ minPopulation: value[0] })}
                min={10000}
                max={1000000}
                step={5000}
                className="w-full"
                disabled={!config.enabled}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>10K</span>
                <span>1M</span>
              </div>
            </div>

            {/* Max Radius */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Radius className="h-4 w-4" />
                  Max Territory Radius
                </Label>
                <Badge variant="outline">{config.maxRadiusMiles} miles</Badge>
              </div>
              <Slider
                value={config.maxRadiusMiles}
                onValueChange={(value: number[]) => handleConfigChange({ maxRadiusMiles: value[0] })}
                min={20}
                max={100}
                step={5}
                className="w-full"
                disabled={!config.enabled}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>20 miles</span>
                <span>100 miles</span>
              </div>
            </div>

            {/* Min Score Percentile */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Min Score Percentile
                </Label>
                <Badge variant="outline">Top {100 - (config.minScorePercentile ?? 70)}%</Badge>
              </div>
              <Slider
                value={config.minScorePercentile ?? 70}
                onValueChange={(value: number[]) => handleConfigChange({ minScorePercentile: value[0] })}
                min={50}
                max={90}
                step={5}
                className="w-full"
                disabled={!config.enabled}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Top 50%</span>
                <span>Top 10%</span>
              </div>
            </div>
          </div>

          {/* Validation Messages */}
          {validationResult && (
            <div className="space-y-2">
              {validationResult.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <div className="font-medium">Configuration Issues:</div>
                      {validationResult.errors.map((error, index) => (
                        <div key={index} className="text-sm">• {error}</div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
              
              {validationResult.warnings.length > 0 && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <div className="font-medium">Warnings:</div>
                      {validationResult.warnings.map((warning, index) => (
                        <div key={index} className="text-sm">• {warning}</div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Dataset Information */}
          {datasetInfo && (
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-sm font-medium mb-2">Dataset Information</div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>Total Zip Codes: {datasetInfo.totalZipCodes.toLocaleString()}</div>
                <div>Total Population: {datasetInfo.totalPopulation.toLocaleString()}</div>
                <div>Geographic Span: {datasetInfo.geographicSpread.maxDistance.toFixed(1)} miles</div>
                <div>Avg per Territory: {Math.floor(datasetInfo.totalZipCodes / config.numClusters)} zip codes</div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {onPreviewClusters && (
              <Button 
                onClick={onPreviewClusters}
                disabled={!validationResult?.isValid || isPreviewLoading}
                className="flex-1"
                variant="outline"
              >
                <Eye className="h-4 w-4 mr-2" />
                {isPreviewLoading ? 'Generating Preview...' : 'Preview Territories'}
              </Button>
            )}
            
            {onSave && (
              <Button 
                onClick={onSave}
                className="flex-1 bg-[#33a852] hover:bg-[#2d8f46] text-white"
              >
                <Settings className="h-4 w-4 mr-2" />
                Save Configuration
              </Button>
            )}
          </div>
      </CardContent>
    </Card>
  );
}