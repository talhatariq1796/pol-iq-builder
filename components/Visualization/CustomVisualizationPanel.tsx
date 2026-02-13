import React, { useState } from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import {
  Box,
  Typography,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Slider,
  Switch,
  FormControlLabel,
  Divider,
  Alert,
  SelectChangeEvent,
  IconButton,
} from '@mui/material';
import { VisualizationType, VisualizationStrategy } from '@/types/visualization';
import { LayerConfig } from '@/types/layers';
import { VisualizationIntegration } from '@/utils/visualization-integration';
import { LayerErrorHandler } from '@/utils/layer-error-handler';
import CloseIcon from '@mui/icons-material/Close';

interface VisualizationConfig {
  type: VisualizationType;
  strategy: VisualizationStrategy;
  options: {
    colorScheme: string;
    opacity: number;
    showLegend: boolean;
    showLabels: boolean;
    clusteringEnabled: boolean;
    maxFeatures: number;
    clusters?: { maxClusters: number; minMembers: number };
  };
}

interface CustomVisualizationPanelProps {
  layer: LayerConfig;
  onVisualizationUpdate: (config: VisualizationConfig) => void;
  onClose: () => void;
}

interface VisualizationOptions {
  type: VisualizationType;
  title: string;
  description: string;
  colorScheme: string;
  opacity: number;
  showLegend: boolean;
  showLabels: boolean;
  clusteringEnabled: boolean;
  maxFeatures: number;
  clustersOn: boolean;
  maxClusters: number;
  minMembers: number;
}

export const CustomVisualizationPanel: React.FC<CustomVisualizationPanelProps> = ({
  layer,
  onVisualizationUpdate,
  onClose,
}) => {
  const [options, setOptions] = useState<VisualizationOptions>({
    type: 'default',
    title: layer.name,
    description: layer.description || '',
    colorScheme: 'default',
    opacity: 0.7,
    showLegend: true,
    showLabels: false,
    clusteringEnabled: layer.type === 'point',
    maxFeatures: layer.performance?.maxFeatures || 10000,
    clustersOn: false,
    maxClusters: 5,
    minMembers: 5
  });

  const [error, setError] = useState<string | null>(null);
  const errorHandler = LayerErrorHandler.getInstance();
  const visualizationIntegration = VisualizationIntegration.getInstance();

  const handleTypeChange = (event: SelectChangeEvent<VisualizationType>) => {
    setOptions((prev: VisualizationOptions) => ({
      ...prev,
      type: event.target.value as VisualizationType
    }));
  };

  const handleOptionChange = (field: keyof VisualizationOptions) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | SelectChangeEvent
  ) => {
    const target = event.target as HTMLInputElement;
    if (target.type === 'checkbox') {
      setOptions((prev: VisualizationOptions) => ({
        ...prev,
        [field]: target.checked
      }));
    } else {
      setOptions((prev: VisualizationOptions) => ({
        ...prev,
        [field]: target.value
      }));
    }
  };

  const handleSliderChange = (field: keyof VisualizationOptions) => (
    _event: Event,
    value: number | number[]
  ) => {
    setOptions((prev: VisualizationOptions) => ({
      ...prev,
      [field]: value
    }));
  };

  const applyVisualization = async () => {
    try {
      const strategy: VisualizationStrategy = {
        title: options.title,
        description: options.description,
        targetVariable: layer.rendererField,
        correlationField: options.type === 'correlation' ? layer.rendererField : undefined,
        rankingField: options.type === 'ranking' ? layer.rendererField : undefined,
        distributionField: options.type === 'distribution' ? layer.rendererField : undefined
      };

      const config = {
        type: options.type,
        strategy,
        options: {
          colorScheme: options.colorScheme,
          opacity: options.opacity,
          showLegend: options.showLegend,
          showLabels: options.showLabels,
          clusteringEnabled: options.clusteringEnabled,
          maxFeatures: options.maxFeatures,
          clusters: options.clustersOn ? { maxClusters: options.maxClusters, minMembers: options.minMembers } : undefined
        }
      };

      await visualizationIntegration.updateLayerOptimization(
        layer,
        {
          ...layer,
          performance: {
            ...layer.performance,
            maxFeatures: options.maxFeatures
          }
        },
        {
          useClustering: options.clusteringEnabled,
          useFeatureReduction: options.maxFeatures > 10000,
          maxFeatures: options.maxFeatures
        }
      );

      onVisualizationUpdate(config);
      setError(null);
    } catch (err) {
      const errorMessage = await errorHandler.handleValidationError('visualization', err);
      if (typeof errorMessage === 'string') {
        setError(errorMessage);
      } else {
        setError('An error occurred while applying visualization');
      }
    }
  };

  const theme = createTheme({
    typography: { fontSize: 12 },
    palette: { primary: { main: '#33a852' } }
  });

  return (
    <ThemeProvider theme={theme}>
    <Paper sx={{ p: 2, position: 'relative', maxHeight: '90vh', overflowY: 'auto', fontSize: '0.75rem' }}>
      <IconButton
        aria-label="close"
        onClick={onClose}
        sx={{ position: 'absolute', right: 8, top: 8 }}
      >
        <CloseIcon />
      </IconButton>
      <Typography variant="h6" gutterBottom>
        Custom Visualization
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box>
            <FormControl fullWidth>
              <InputLabel>Visualization Type</InputLabel>
              <Select<VisualizationType>
                value={options.type}
                onChange={handleTypeChange}
                label="Visualization Type"
              >
                <MenuItem value="default">Default</MenuItem>
                <MenuItem value="correlation">Correlation Analysis</MenuItem>
                <MenuItem value="ranking">Ranking</MenuItem>
                <MenuItem value="distribution">Distribution</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Box>
            <TextField
              fullWidth
              label="Title"
              value={options.title}
              onChange={handleOptionChange('title')}
            />
          </Box>

          <Box>
            <TextField
              fullWidth
              label="Description"
              multiline
              rows={2}
              value={options.description}
              onChange={handleOptionChange('description')}
            />
          </Box>

          <Box>
            <FormControl fullWidth>
              <InputLabel>Color Scheme</InputLabel>
              <Select<string>
                value={options.colorScheme}
                onChange={handleOptionChange('colorScheme')}
                label="Color Scheme"
              >
                <MenuItem value="default">Default</MenuItem>
                <MenuItem value="sequential">Sequential</MenuItem>
                <MenuItem value="diverging">Diverging</MenuItem>
                <MenuItem value="categorical">Categorical</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Box>
            <Typography gutterBottom>Opacity</Typography>
            <Slider
              value={options.opacity}
              onChange={handleSliderChange('opacity')}
              min={0}
              max={1}
              step={0.1}
              valueLabelDisplay="auto"
            />
          </Box>

          <Box>
            <Typography gutterBottom>Maximum Features</Typography>
            <Slider
              value={options.maxFeatures}
              onChange={handleSliderChange('maxFeatures')}
              min={1000}
              max={100000}
              step={1000}
              valueLabelDisplay="auto"
            />
          </Box>

          <Box>
            <Divider sx={{ my: 2 }} />
          </Box>

          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={options.showLegend}
                  onChange={handleOptionChange('showLegend')}
                />
              }
              label="Show Legend"
            />
          </Box>

          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={options.showLabels}
                  onChange={handleOptionChange('showLabels')}
                />
              }
              label="Show Labels"
            />
          </Box>

          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={options.clusteringEnabled}
                  onChange={handleOptionChange('clusteringEnabled')}
                  disabled={layer.type !== 'point'}
                />
              }
              label="Enable Clustering"
            />
          </Box>

          <Box>
            <Divider sx={{ my: 2 }} />
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={options.clustersOn}
                onChange={(_e: React.ChangeEvent<HTMLInputElement>, checked: boolean) => setOptions((prev: VisualizationOptions) => ({ ...prev, clustersOn: checked }))}
              />
            }
            label="Group results into clusters"
          />

          {options.clustersOn && (
            <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
              <TextField
                label="Number of clusters"
                type="number"
                size="small"
                value={options.maxClusters}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOptions((prev: VisualizationOptions) => ({ ...prev, maxClusters: Number(e.target.value) }))}
                inputProps={{ min: 1 }}
              />
              <TextField
                label="Min members/cluster"
                type="number"
                size="small"
                value={options.minMembers}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOptions((prev: VisualizationOptions) => ({ ...prev, minMembers: Number(e.target.value) }))}
                inputProps={{ min: 1 }}
              />
            </Box>
          )}

          <Box>
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                color="primary"
                onClick={applyVisualization}
              >
                Apply Visualization
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>
    </Paper>
    </ThemeProvider>
  );
}; 