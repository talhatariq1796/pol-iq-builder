import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Chip,
  Stack,
  Switch,
  FormControlLabel
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  Timeline,
  Clear,
  Save,
  CalendarMonth,
  AccessTime,
  History
} from '@mui/icons-material';
import { LayerConfig } from '@/types/layers';
import { LayerErrorHandler } from '@/utils/layer-error-handler';

interface TemporalQueryToolsProps {
  mapView: __esri.MapView;
  layers: LayerConfig[];
  onQueryComplete: (results: any) => void;
}

type TemporalOperation = 'during' | 'before' | 'after' | 'between' | 'latest' | 'earliest';

interface QuerySettings {
  operation: TemporalOperation;
  startDate: Date | null;
  endDate: Date | null;
  selectedLayers: string[];
  useTimeRange: boolean;
}

export const TemporalQueryTools: React.FC<TemporalQueryToolsProps> = ({
  mapView,
  layers,
  onQueryComplete
}) => {
  const [settings, setSettings] = useState<QuerySettings>({
    operation: 'during',
    startDate: null,
    endDate: null,
    selectedLayers: [],
    useTimeRange: false
  });
  const [isQuerying, setIsQuerying] = useState(false);
  const errorHandler = LayerErrorHandler.getInstance();

  const handleOperationChange = (operation: TemporalOperation) => {
    setSettings((prev: any) => ({ ...prev, operation }));
  };

  const handleLayerSelection = (layerIds: string[]) => {
    setSettings((prev: any) => ({ ...prev, selectedLayers: layerIds }));
  };

  const handleDateChange = (field: 'startDate' | 'endDate') => (date: Date | null) => {
    setSettings((prev: any) => ({ ...prev, [field]: date }));
  };

  const handleTimeRangeToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSettings((prev: any) => ({ ...prev, useTimeRange: event.target.checked }));
  };

  const executeTemporalQuery = async () => {
    try {
      setIsQuerying(true);
      const results = await Promise.all(
        settings.selectedLayers.map(async (layerId) => {
          const layer = layers.find(l => l.id === layerId);
          if (!layer) return null;

          const featureLayer = new (await import('@arcgis/core/layers/FeatureLayer')).default({
            url: layer.url
          });

          const query = featureLayer.createQuery();
          
          // Build temporal query based on operation
          switch (settings.operation) {
            case 'during':
              if (settings.startDate && settings.endDate) {
                query.timeExtent = {
                  start: settings.startDate,
                  end: settings.endDate
                };
              }
              break;
            case 'before':
              if (settings.endDate) {
                query.timeExtent = {
                  end: settings.endDate
                };
              }
              break;
            case 'after':
              if (settings.startDate) {
                query.timeExtent = {
                  start: settings.startDate
                };
              }
              break;
            case 'between':
              if (settings.startDate && settings.endDate) {
                query.timeExtent = {
                  start: settings.startDate,
                  end: settings.endDate
                };
              }
              break;
            case 'latest':
              query.orderByFields = ['lastUpdate DESC'];
              query.num = 1;
              break;
            case 'earliest':
              query.orderByFields = ['lastUpdate ASC'];
              query.num = 1;
              break;
          }

          // Add time range if enabled
          if (settings.useTimeRange && settings.startDate && settings.endDate) {
            query.timeExtent = {
              start: settings.startDate,
              end: settings.endDate
            };
          }

          const result = await featureLayer.queryFeatures(query);
          return {
            layerId,
            features: result.features
          };
        })
      );

      onQueryComplete(results.filter(Boolean));
    } catch (error) {
      errorHandler.handleValidationError('query', error);
    } finally {
      setIsQuerying(false);
    }
  };

  const clearQuery = () => {
    setSettings((prev: any) => ({
      ...prev,
      startDate: null,
      endDate: null
    }));
  };

  return (
    <Paper sx={{ p: 2, maxWidth: 400 }}>
      <Typography variant="h6" gutterBottom>
        Temporal Query Tools
      </Typography>

      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Temporal Operation
        </Typography>
        <FormControl fullWidth size="small">
          <Select
            value={settings.operation}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleOperationChange(e.target.value as TemporalOperation)}
          >
            <MenuItem value="during">During</MenuItem>
            <MenuItem value="before">Before</MenuItem>
            <MenuItem value="after">After</MenuItem>
            <MenuItem value="between">Between</MenuItem>
            <MenuItem value="latest">Latest</MenuItem>
            <MenuItem value="earliest">Earliest</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Divider sx={{ my: 2 }} />

      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Date Range
        </Typography>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Stack spacing={2}>
            <DatePicker
              label="Start Date"
              value={settings.startDate}
              onChange={handleDateChange('startDate')}
              slotProps={{ textField: { size: 'small', fullWidth: true } }}
            />
            <DatePicker
              label="End Date"
              value={settings.endDate}
              onChange={handleDateChange('endDate')}
              slotProps={{ textField: { size: 'small', fullWidth: true } }}
            />
          </Stack>
        </LocalizationProvider>
        <FormControlLabel
          control={
            <Switch
              checked={settings.useTimeRange}
              onChange={handleTimeRangeToggle}
              size="small"
            />
          }
          label="Use Time Range"
          sx={{ mt: 1 }}
        />
      </Box>

      <Divider sx={{ my: 2 }} />

      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Select Layers
        </Typography>
        <FormControl fullWidth size="small">
          <Select
            multiple
            value={settings.selectedLayers}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleLayerSelection(e.target.value as unknown as string[])}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.map((value) => (
                  <Chip
                    key={value}
                    label={layers.find(l => l.id === value)?.name || value}
                    size="small"
                  />
                ))}
              </Box>
            )}
          >
            {layers.map((layer) => (
              <MenuItem key={layer.id} value={layer.id}>
                {layer.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          startIcon={<Clear />}
          onClick={clearQuery}
          disabled={!settings.startDate && !settings.endDate}
        >
          Clear
        </Button>
        <Button
          variant="contained"
          startIcon={<Timeline />}
          onClick={executeTemporalQuery}
          disabled={isQuerying || settings.selectedLayers.length === 0}
        >
          {isQuerying ? 'Querying...' : 'Query'}
        </Button>
      </Box>
    </Paper>
  );
}; 