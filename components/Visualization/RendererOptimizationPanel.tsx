import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Switch,
  FormControlLabel,
  Slider,
  Button,
  Divider,
  Alert,
  CircularProgress
} from '@mui/material';
import { RendererOptimizer } from '@/utils/renderer-optimizer';
import { LayerConfig } from '@/types/layers';
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';

interface RendererOptimizationPanelProps {
  layer: FeatureLayer;
  layerConfig: LayerConfig;
  onOptimizationComplete?: () => void;
}

export const RendererOptimizationPanel: React.FC<RendererOptimizationPanelProps> = ({
  layer,
  layerConfig,
  onOptimizationComplete
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [optimizationOptions, setOptimizationOptions] = useState({
    useClustering: false,
    useFeatureReduction: false,
    useWebGL: false,
    maxFeatures: layerConfig.performance?.maxFeatures || 10000,
    maxGeometryComplexity: layerConfig.performance?.maxGeometryComplexity || 100000,
    batchSize: 1000
  });

  const optimizer = RendererOptimizer.getInstance();

  const handleOptionChange = (option: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setOptimizationOptions((prev: any) => ({
      ...prev,
      [option]: event.target.checked
    }));
  };

  const handleSliderChange = (option: string) => (_: Event, value: number | number[]) => {
    setOptimizationOptions((prev: any) => ({
      ...prev,
      [option]: value
    }));
  };

  const applyOptimizations = async () => {
    setLoading(true);
    setError(null);
    try {
      await optimizer.optimizeRenderer(layer, layerConfig, optimizationOptions);
      const newMetrics = optimizer.getMetrics(layer.id);
      setMetrics(newMetrics);
      onOptimizationComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to optimize renderer');
    } finally {
      setLoading(false);
    }
  };

  const resetOptimizations = () => {
    setOptimizationOptions({
      useClustering: false,
      useFeatureReduction: false,
      useWebGL: false,
      maxFeatures: layerConfig.performance?.maxFeatures || 10000,
      maxGeometryComplexity: layerConfig.performance?.maxGeometryComplexity || 100000,
      batchSize: 1000
    });
    setMetrics(null);
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Renderer Optimization
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Optimization Options
        </Typography>
        
        <FormControlLabel
          control={
            <Switch
              checked={optimizationOptions.useClustering}
              onChange={handleOptionChange('useClustering')}
            />
          }
          label="Use Clustering"
        />
        
        <FormControlLabel
          control={
            <Switch
              checked={optimizationOptions.useFeatureReduction}
              onChange={handleOptionChange('useFeatureReduction')}
            />
          }
          label="Use Feature Reduction"
        />
        
        <FormControlLabel
          control={
            <Switch
              checked={optimizationOptions.useWebGL}
              onChange={handleOptionChange('useWebGL')}
            />
          }
          label="Use WebGL Rendering"
        />
      </Box>

      <Divider sx={{ my: 2 }} />

      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Performance Limits
        </Typography>
        
        <Typography gutterBottom>
          Max Features: {optimizationOptions.maxFeatures}
        </Typography>
        <Slider
          value={optimizationOptions.maxFeatures}
          onChange={handleSliderChange('maxFeatures')}
          min={1000}
          max={100000}
          step={1000}
          valueLabelDisplay="auto"
        />
        
        <Typography gutterBottom>
          Max Geometry Complexity: {optimizationOptions.maxGeometryComplexity}
        </Typography>
        <Slider
          value={optimizationOptions.maxGeometryComplexity}
          onChange={handleSliderChange('maxGeometryComplexity')}
          min={10000}
          max={1000000}
          step={10000}
          valueLabelDisplay="auto"
        />
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
        <Button
          variant="contained"
          onClick={applyOptimizations}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          Apply Optimizations
        </Button>
        
        <Button
          variant="outlined"
          onClick={resetOptimizations}
          disabled={loading}
        >
          Reset
        </Button>
      </Box>

      {metrics && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Performance Metrics
          </Typography>
          <Typography variant="body2">
            Render Time: {metrics.renderTime.toFixed(2)}ms
          </Typography>
          <Typography variant="body2">
            Feature Count: {metrics.featureCount}
          </Typography>
          <Typography variant="body2">
            Geometry Complexity: {metrics.geometryComplexity}
          </Typography>
          <Typography variant="body2">
            Memory Usage: {(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB
          </Typography>
        </Box>
      )}
    </Paper>
  );
}; 