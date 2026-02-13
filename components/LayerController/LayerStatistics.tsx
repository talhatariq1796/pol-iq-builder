import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Paper, CircularProgress, Grid } from '@mui/material';
import { LayerConfig } from '@/types/layers';
import { LayerErrorHandler } from '@/utils/layer-error-handler';
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';

interface LayerStatisticsProps {
  layer: LayerConfig;
  view: __esri.MapView;
}

interface LayerStats {
  featureCount: number;
  extent: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
  };
  fieldStats: Record<string, {
    min: number;
    max: number;
    mean: number;
    median: number;
    stdDev: number;
  }>;
  lastUpdated: Date;
}

export const LayerStatistics: React.FC<LayerStatisticsProps> = ({ layer, view }) => {
  const [stats, setStats] = useState<LayerStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const errorHandler = LayerErrorHandler.getInstance();

  const fetchLayerStats = useCallback(async () => {
    try {
      const layerView = view.map.findLayerById(layer.id) as FeatureLayer;
      if (!layerView) return;

      const features = await layerView.queryFeatures();
      const extent = await layerView.queryExtent();

      // Calculate field statistics
      const fieldStats: Record<string, any> = {};
      const numericFields = layer.fields?.filter(f => 
        ['double', 'single', 'integer', 'small-integer'].includes(f.type)
      ) || [];

      for (const field of numericFields) {
        const values = features.features
          .map((f: __esri.Graphic) => f.attributes[field.name])
          .filter((v: any) => v !== null && v !== undefined)
          .map(Number)
          .sort((a: number, b: number) => a - b);

        if (values.length > 0) {
          const sum = values.reduce((a: number, b: number) => a + b, 0);
          const mean = sum / values.length;
          const median = values.length % 2 === 0
            ? (values[values.length / 2 - 1] + values[values.length / 2]) / 2
            : values[Math.floor(values.length / 2)];
          const variance = values.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) / values.length;
          const stdDev = Math.sqrt(variance);

          fieldStats[field.name] = {
            min: values[0],
            max: values[values.length - 1],
            mean,
            median,
            stdDev
          };
        }
      }

      setStats({
        featureCount: features.features.length,
        extent: extent.extent,
        fieldStats,
        lastUpdated: new Date()
      });
    } catch (error) {
      errorHandler.handleValidationError('statistics', error);
    } finally {
      setLoading(false);
    }
  }, [layer, view, errorHandler]);

  useEffect(() => {
    fetchLayerStats();
  }, [fetchLayerStats]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!stats) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="error">Failed to load layer statistics</Typography>
      </Box>
    );
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Layer Statistics
      </Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ flex: '1 1 300px', minWidth: 0 }}>
          <Typography variant="subtitle1" gutterBottom>
            General Information
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Feature Count: {stats.featureCount}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Last Updated: {stats.lastUpdated.toLocaleString()}
          </Typography>
        </Box>

        <Box sx={{ flex: '2 1 400px', minWidth: 0 }}>
          <Typography variant="subtitle1" gutterBottom>
            Field Statistics
          </Typography>
          {Object.entries(stats.fieldStats).map(([fieldName, fieldStats]) => (
            <Box key={fieldName} sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                {fieldName}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ flex: '1 1 120px' }}>
                  <Typography variant="body2" color="text.secondary">
                    Min: {fieldStats.min.toFixed(2)}
                  </Typography>
                </Box>
                <Box sx={{ flex: '1 1 120px' }}>
                  <Typography variant="body2" color="text.secondary">
                    Max: {fieldStats.max.toFixed(2)}
                  </Typography>
                </Box>
                <Box sx={{ flex: '1 1 120px' }}>
                  <Typography variant="body2" color="text.secondary">
                    Mean: {fieldStats.mean.toFixed(2)}
                  </Typography>
                </Box>
                <Box sx={{ flex: '1 1 120px' }}>
                  <Typography variant="body2" color="text.secondary">
                    Std Dev: {fieldStats.stdDev.toFixed(2)}
                  </Typography>
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Paper>
  );
}; 