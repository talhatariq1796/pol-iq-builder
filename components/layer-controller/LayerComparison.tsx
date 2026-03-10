import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Divider,
  CircularProgress,
  Button,
  IconButton,
  Tooltip
} from '@mui/material';
import type { GridProps } from '@mui/material/Grid';
import { Close, CompareArrows, Info } from '@mui/icons-material';
import { LayerConfig } from '@/types/layers';
import { StatisticalVisualizations } from '@/utils/visualizations/statistical-visualizations';
import { LayerErrorHandler } from '@/utils/layer-error-handler';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Layer from '@arcgis/core/layers/Layer';

interface LayerComparisonProps {
  layers: Record<string, LayerConfig>;
  onClose: () => void;
  view?: __esri.MapView;
}

interface ComparisonMetrics {
  correlation: number;
  overlap: number;
  differences: {
    field: string;
    value1: number;
    value2: number;
    difference: number;
  }[];
  statistics: {
    layer1: {
      mean: number;
      median: number;
      stdDev: number;
    };
    layer2: {
      mean: number;
      median: number;
      stdDev: number;
    };
  };
}

export const LayerComparison: React.FC<LayerComparisonProps> = ({ layers, onClose, view }) => {
  const [layer1, setLayer1] = useState<string>('');
  const [layer2, setLayer2] = useState<string>('');
  const [metrics, setMetrics] = useState<ComparisonMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorHandler = LayerErrorHandler.getInstance();
  const statisticalViz = new StatisticalVisualizations();

  const compareLayers = useCallback(async () => {
    if (!layer1 || !layer2) return;

    setLoading(true);
    setError(null);

    try {
      // Layer access validation skipped - function not available

      // Get layer data
      const layer1Data = layers[layer1];
      const layer2Data = layers[layer2];

      // Create FeatureLayer instances
      const featureLayer1 = new FeatureLayer({
        url: layer1Data.url,
        outFields: ['*']
      });

      const featureLayer2 = new FeatureLayer({
        url: layer2Data.url,
        outFields: ['*']
      });

      // Load features
      const [features1, features2] = await Promise.all([
        featureLayer1.queryFeatures(),
        featureLayer2.queryFeatures()
      ]);

      // Calculate metrics
      const correlation = await statisticalViz.calculateLayerCorrelation(
        featureLayer1,
        layer1Data.rendererField || 'value',
        featureLayer2,
        layer2Data.rendererField || 'value'
      );

      const overlap = await statisticalViz.calculateLayerSpatialOverlap(featureLayer1, featureLayer2);
      
      const commonFields = layer1Data.fields
        .filter(f1 => layer2Data.fields.some(f2 => f2.name === f1.name))
        .map(f => f.name);

      const differences = await statisticalViz.calculateLayerFieldDifferences(
        featureLayer1,
        featureLayer2,
        commonFields
      );

      const statistics = {
        layer1: {
          mean: statisticalViz.calculateMean(features1.features.map(f => f.attributes[layer1Data.rendererField || 'value'])),
          median: statisticalViz.calculateMedian(features1.features.map(f => f.attributes[layer1Data.rendererField || 'value'])),
          stdDev: statisticalViz.calculateStandardDeviation(features1.features.map(f => f.attributes[layer1Data.rendererField || 'value']))
        },
        layer2: {
          mean: statisticalViz.calculateMean(features2.features.map(f => f.attributes[layer2Data.rendererField || 'value'])),
          median: statisticalViz.calculateMedian(features2.features.map(f => f.attributes[layer2Data.rendererField || 'value'])),
          stdDev: statisticalViz.calculateStandardDeviation(features2.features.map(f => f.attributes[layer2Data.rendererField || 'value']))
        }
      };

      setMetrics({
        correlation,
        overlap,
        differences,
        statistics
      });

      // Update map view if available
      if (view) {
        // Clear existing comparison layers
        view.map.layers.forEach(layer => {
          if (layer.id?.includes('comparison')) {
            view.map.remove(layer);
          }
        });

        // Add comparison layers with different styles
        const comparisonLayer1 = featureLayer1 as unknown as Layer;
        const comparisonLayer2 = featureLayer2 as unknown as Layer;

        comparisonLayer1.id = 'comparison-layer-1';
        comparisonLayer2.id = 'comparison-layer-2';

        view.map.add(comparisonLayer1);
        view.map.add(comparisonLayer2);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred during comparison';
      setError(errorMessage);
      errorHandler.handleValidationError('comparison', error);
    } finally {
      setLoading(false);
    }
  }, [layer1, layer2, layers, view, errorHandler, statisticalViz]);

  useEffect(() => {
    if (layer1 && layer2) {
      compareLayers();
    }
  }, [layer1, layer2, compareLayers]);

  return (
    <Paper sx={{ p: 2, maxWidth: 800, width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CompareArrows /> Layer Comparison
        </Typography>
        <IconButton onClick={onClose} size="small">
          <Close />
        </IconButton>
      </Box>

      <Box sx={{ display: 'flex', gap: 2 }}>
        <FormControl fullWidth>
          <InputLabel>Layer 1</InputLabel>
          <Select
            value={layer1}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setLayer1(e.target.value)}
            label="Layer 1"
          >
            {Object.entries(layers).map(([id, layer]) => (
              <MenuItem key={id} value={id}>
                {layer.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth>
          <InputLabel>Layer 2</InputLabel>
          <Select
            value={layer2}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setLayer2(e.target.value)}
            label="Layer 2"
          >
            {Object.entries(layers).map(([id, layer]) => (
              <MenuItem key={id} value={id}>
                {layer.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Divider sx={{ my: 2 }} />

      {error && (
        <Box sx={{ color: 'error.main', mb: 2 }}>
          <Typography variant="body2">{error}</Typography>
        </Box>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" p={3}>
          <CircularProgress />
        </Box>
      ) : metrics ? (
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            Comparison Results
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <Paper sx={{ p: 2, flex: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Correlation
              </Typography>
              <Typography variant="h4" color="primary">
                {metrics.correlation.toFixed(2)}
              </Typography>
              <Tooltip title="Pearson correlation coefficient between the two layers">
                <Info fontSize="small" sx={{ ml: 1, color: 'text.secondary' }} />
              </Tooltip>
            </Paper>

            <Paper sx={{ p: 2, flex: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Spatial Overlap
              </Typography>
              <Typography variant="h4" color="primary">
                {(metrics.overlap * 100).toFixed(1)}%
              </Typography>
              <Tooltip title="Percentage of spatial overlap between the two layers">
                <Info fontSize="small" sx={{ ml: 1, color: 'text.secondary' }} />
              </Tooltip>
            </Paper>
          </Box>

          <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
            Statistical Analysis
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <Paper sx={{ p: 2, flex: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                {layers[layer1].name}
              </Typography>
              <Typography variant="body2">
                Mean: {metrics.statistics.layer1.mean.toFixed(2)}
              </Typography>
              <Typography variant="body2">
                Median: {metrics.statistics.layer1.median.toFixed(2)}
              </Typography>
              <Typography variant="body2">
                Std Dev: {metrics.statistics.layer1.stdDev.toFixed(2)}
              </Typography>
            </Paper>

            <Paper sx={{ p: 2, flex: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                {layers[layer2].name}
              </Typography>
              <Typography variant="body2">
                Mean: {metrics.statistics.layer2.mean.toFixed(2)}
              </Typography>
              <Typography variant="body2">
                Median: {metrics.statistics.layer2.median.toFixed(2)}
              </Typography>
              <Typography variant="body2">
                Std Dev: {metrics.statistics.layer2.stdDev.toFixed(2)}
              </Typography>
            </Paper>
          </Box>

          <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
            Field Differences
          </Typography>
          <Paper sx={{ p: 2 }}>
            {metrics.differences.map((diff, index) => (
              <Box key={index} sx={{ mb: 1 }}>
                <Typography variant="body2">
                  {diff.field}: {diff.value1.toFixed(2)} vs {diff.value2.toFixed(2)} 
                  (Δ: {diff.difference.toFixed(2)})
                </Typography>
              </Box>
            ))}
          </Paper>
        </Box>
      ) : null}
    </Paper>
  );
}; 