import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Divider,
  CircularProgress,
  IconButton,
  Tooltip,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  Close,
  Info,
  Update,
  Storage,
  Security,
  Speed,
  History,
  Analytics
} from '@mui/icons-material';
import { LayerConfig } from '@/types/layers';
import { LayerErrorHandler } from '@/utils/layer-error-handler';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { layerMetricsTracker } from '@/utils/layer-metrics';

interface LayerStatsProps {
  layer: LayerConfig;
  onClose: () => void;
}

interface LayerStats {
  featureCount: number;
  lastUpdated: Date;
  size: number;
  usageCount: number;
  errorRate: number;
  averageLoadTime: number;
}

export const LayerStats: React.FC<LayerStatsProps> = ({ layer, onClose }) => {
  const [stats, setStats] = useState<LayerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const errorHandler = LayerErrorHandler.getInstance();

  const loadLayerStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const startTime = performance.now();
      const featureLayer = new FeatureLayer({
        url: layer.url,
        outFields: ['*']
      });

      // Get feature count
      const countResult = await featureLayer.queryFeatureCount();
      
      // Get layer metadata
      const metadata = layer.metadata || {};

      // Track load time
      const loadTime = performance.now() - startTime;
      layerMetricsTracker.trackLayerLoadTime(layer.id, loadTime);
      layerMetricsTracker.trackLayerAccess(layer.id);

      // Get metrics
      const metrics = layerMetricsTracker.getLayerMetrics(layer.id);

      // Calculate statistics
      const stats: LayerStats = {
        featureCount: countResult,
        lastUpdated: metadata.lastUpdate || new Date(),
        size: calculateLayerSize(countResult, layer.fields.length),
        usageCount: metrics.usageCount,
        errorRate: layerMetricsTracker.getErrorRate(layer.id),
        averageLoadTime: layerMetricsTracker.getAverageLoadTime(layer.id)
      };

      setStats(stats);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load layer statistics';
      setError(errorMessage);
      errorHandler.handleValidationError('stats', error);
      layerMetricsTracker.trackLayerError(layer.id);
    } finally {
      setLoading(false);
    }
  }, [layer, errorHandler]);

  useEffect(() => {
    loadLayerStats();
  }, [loadLayerStats]);

  const calculateLayerSize = (featureCount: number, fieldCount: number): number => {
    // Rough estimate of layer size in bytes
    const averageFeatureSize = fieldCount * 100; // Assuming average field size of 100 bytes
    return featureCount * averageFeatureSize;
  };

  const formatSize = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  return (
    <Paper sx={{ p: 2, maxWidth: 600, width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Analytics /> Layer Statistics: {layer.name}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <Close />
        </IconButton>
      </Box>

      {error && (
        <Box sx={{ color: 'error.main', mb: 2 }}>
          <Typography variant="body2">{error}</Typography>
        </Box>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" p={3}>
          <CircularProgress />
        </Box>
      ) : stats ? (
        <Box>
          <List>
            <ListItem>
              <ListItemIcon>
                <Storage />
              </ListItemIcon>
              <ListItemText
                primary="Feature Count"
                secondary={stats.featureCount.toLocaleString()}
              />
            </ListItem>

            <ListItem>
              <ListItemIcon>
                <Update />
              </ListItemIcon>
              <ListItemText
                primary="Last Updated"
                secondary={stats.lastUpdated.toLocaleDateString()}
              />
            </ListItem>

            <ListItem>
              <ListItemIcon>
                <Storage />
              </ListItemIcon>
              <ListItemText
                primary="Layer Size"
                secondary={formatSize(stats.size)}
              />
            </ListItem>

            <ListItem>
              <ListItemIcon>
                <Speed />
              </ListItemIcon>
              <ListItemText
                primary="Average Load Time"
                secondary={`${stats.averageLoadTime.toFixed(2)}ms`}
              />
            </ListItem>

            <ListItem>
              <ListItemIcon>
                <History />
              </ListItemIcon>
              <ListItemText
                primary="Usage Count"
                secondary={stats.usageCount.toLocaleString()}
              />
            </ListItem>

            <ListItem>
              <ListItemIcon>
                <Security />
              </ListItemIcon>
              <ListItemText
                primary="Error Rate"
                secondary={`${(stats.errorRate * 100).toFixed(2)}%`}
              />
            </ListItem>
          </List>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" gutterBottom>
            Layer Metadata
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            <Chip
              label={`Provider: ${layer.metadata.provider}`}
              size="small"
              icon={<Info />}
            />
            <Chip
              label={`Version: ${layer.metadata.version}`}
              size="small"
              icon={<Info />}
            />
            <Chip
              label={`Update Frequency: ${layer.metadata.updateFrequency}`}
              size="small"
              icon={<Info />}
            />
            {layer.metadata.tags?.map((tag, index) => (
              <Chip
                key={index}
                label={tag}
                size="small"
                variant="outlined"
              />
            ))}
          </Box>

          <Typography variant="subtitle2" gutterBottom>
            Performance Settings
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText
                primary="Max Features"
                secondary={layer.performance?.maxFeatures?.toLocaleString() ?? 'Not set'}
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Timeout"
                secondary={`${layer.performance?.timeoutMs ?? 0}ms`}
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Rate Limit"
                secondary={`${layer.performance?.rateLimits?.requestsPerSecond ?? 0} req/s`}
              />
            </ListItem>
          </List>
        </Box>
      ) : null}
    </Paper>
  );
}; 