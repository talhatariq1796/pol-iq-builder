/**
 * Cluster Preview Component
 * 
 * Shows a preview of clustering results before applying them to the full analysis.
 * Allows users to adjust parameters and see the impact in real-time.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { 
  Target, 
  MapPin, 
  Users, 
  Radius,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Eye,
  Settings
} from 'lucide-react';

import { ClusterConfig, ClusteringResult, ClusterResult } from '@/lib/clustering/types';
import { ClusterConfigPanel } from './ClusterConfigPanel';

interface ClusterPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (config: ClusterConfig) => void;
  initialConfig: ClusterConfig;
  onPreviewGenerate: (config: ClusterConfig) => Promise<ClusteringResult | null>;
  datasetInfo?: {
    totalZipCodes: number;
    totalPopulation: number;
    geographicSpread: { minDistance: number; maxDistance: number };
  };
}

export function ClusterPreview({
  isOpen,
  onClose,
  onApply,
  initialConfig,
  onPreviewGenerate,
  datasetInfo
}: ClusterPreviewProps) {
  const [config, setConfig] = useState<ClusterConfig>(initialConfig);
  const [previewResult, setPreviewResult] = useState<ClusteringResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasGeneratedPreview, setHasGeneratedPreview] = useState(false);

  // Generate initial preview when dialog opens
  useEffect(() => {
    if (isOpen && !hasGeneratedPreview) {
      handleGeneratePreview();
    }
  }, [isOpen]);

  const handleGeneratePreview = async () => {
    setIsGenerating(true);
    setError(null);
    
    try {
      const result = await onPreviewGenerate(config);
      setPreviewResult(result);
      setHasGeneratedPreview(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate preview');
      setPreviewResult(null);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfigChange = (newConfig: ClusterConfig) => {
    setConfig(newConfig);
    // Reset preview when config changes significantly
    if (newConfig.numClusters !== config.numClusters || 
        // Method is now auto-detected, no manual comparison needed
        newConfig.minZipCodes !== config.minZipCodes ||
        newConfig.minPopulation !== config.minPopulation ||
        newConfig.maxRadiusMiles !== config.maxRadiusMiles) {
      setHasGeneratedPreview(false);
      setPreviewResult(null);
    }
  };

  const handleApply = () => {
    onApply(config);
    onClose();
  };

  const validClusters = previewResult?.clusters.filter(c => c.isValid) || [];
  const invalidClusters = previewResult?.clusters.filter(c => !c.isValid) || [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Territory Preview
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Configuration Panel */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configuration
            </h3>
            
            <ClusterConfigPanel
              config={config}
              onConfigChange={handleConfigChange}
              datasetInfo={datasetInfo}
              className="border-0 shadow-none"
            />

            <Button 
              onClick={handleGeneratePreview}
              disabled={isGenerating || !config.enabled}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating Preview...
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  {hasGeneratedPreview ? 'Regenerate Preview' : 'Generate Preview'}
                </>
              )}
            </Button>
          </div>

          {/* Preview Results */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Target className="h-4 w-4" />
              Preview Results
            </h3>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {isGenerating && (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            )}

            {previewResult && !isGenerating && (
              <div className="space-y-4">
                {/* Summary Stats */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Preview Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{validClusters.length}</div>
                        <div className="text-muted-foreground">Valid Territories</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">{invalidClusters.length}</div>
                        <div className="text-muted-foreground">Invalid Territories</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{previewResult.clusteredZipCodes}</div>
                        <div className="text-muted-foreground">Zip Codes Clustered</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-600">{previewResult.unclustered.length}</div>
                        <div className="text-muted-foreground">Unclustered</div>
                      </div>
                    </div>

                    {previewResult.unclustered.length > 0 && (
                      <Alert className="mt-4">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          {previewResult.unclustered.length} zip codes couldn't be clustered. Consider adjusting parameters.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>

                {/* Cluster Quality Indicator */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Quality Assessment
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Validation Rate</span>
                        <div className="flex items-center gap-2">
                          <Badge variant={validClusters.length / previewResult.clusters.length >= 0.8 ? "default" : "secondary"}>
                            {Math.round((validClusters.length / previewResult.clusters.length) * 100)}%
                          </Badge>
                          {validClusters.length / previewResult.clusters.length >= 0.8 ? 
                            <CheckCircle className="h-4 w-4 text-green-600" /> : 
                            <XCircle className="h-4 w-4 text-orange-600" />
                          }
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Coverage Rate</span>
                        <div className="flex items-center gap-2">
                          <Badge variant={previewResult.clusteredZipCodes / previewResult.totalZipCodes >= 0.8 ? "default" : "secondary"}>
                            {Math.round((previewResult.clusteredZipCodes / previewResult.totalZipCodes) * 100)}%
                          </Badge>
                          {previewResult.clusteredZipCodes / previewResult.totalZipCodes >= 0.8 ? 
                            <CheckCircle className="h-4 w-4 text-green-600" /> : 
                            <XCircle className="h-4 w-4 text-orange-600" />
                          }
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Top Clusters Preview */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Top Territories</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {validClusters.slice(0, 5).map((cluster) => (
                        <div key={cluster.clusterId} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                          <div>
                            <div className="font-medium text-sm">{cluster.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {cluster.zipCodes.length} zip codes, {Math.round(cluster.totalPopulation / 1000)}K population
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium text-sm">{cluster.averageScore.toFixed(1)}</div>
                            <div className="text-xs text-muted-foreground">{cluster.radiusMiles.toFixed(0)}mi</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Performance Info */}
                <div className="text-xs text-muted-foreground text-center">
                  Processing time: {previewResult.processingTimeMs}ms
                </div>
              </div>
            )}

            {!previewResult && !isGenerating && !error && (
              <div className="text-center text-muted-foreground py-8">
                <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Click "Generate Preview" to see clustering results</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleApply}
            disabled={!previewResult || !previewResult.success || validClusters.length === 0}
          >
            Apply Clustering
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}