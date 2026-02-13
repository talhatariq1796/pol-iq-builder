import React, { useState, useCallback } from 'react';
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
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  SelectChangeEvent,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  FilterList as FilterListIcon,
  DateRange as DateRangeIcon,
  LocationOn as LocationOnIcon,
  Draw as DrawIcon,
  CropSquare as SquareIcon,
  RadioButtonUnchecked as CircleIcon,
  ShowChart as ChartIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { queryAnalyzer, QueryOptions, QueryResult } from '../utils/query-analyzer';
import { layers } from '../config/layers';
import type { LayerConfig } from '../types/layers';
import { layerStateManager } from '../utils/layer-state-manager';

interface MapRef {
  current: {
    activateDrawingTool: (mode: 'polygon' | 'circle' | 'rectangle') => void;
    clearDrawing: () => void;
    getView: () => {
      extent: {
        xmin: number;
        ymin: number;
        xmax: number;
        ymax: number;
      };
    };
  } | null;
}

interface ComplexQueryPanelProps {
  onQueryResult?: (result: QueryResult) => void;
  onSpatialFilterChange?: (geometry: any) => void;
  onTemporalFilterChange?: (startDate: Date, endDate: Date) => void;
  mapRef?: MapRef;
}

type AttributeFilter = {
  field: string;
  operator: '=' | '>' | '<' | '>=' | '<=' | '!=' | 'like' | 'in';
  value: any;
};

type DrawingMode = 'polygon' | 'circle' | 'rectangle';

export const ComplexQueryPanel: React.FC<ComplexQueryPanelProps> = ({
  onQueryResult,
  onSpatialFilterChange,
  onTemporalFilterChange,
  mapRef
}) => {
  const [selectedLayers, setSelectedLayers] = useState<string[]>([]);
  const [spatialFilter, setSpatialFilter] = useState<QueryOptions['spatialFilter']>();
  const [temporalFilter, setTemporalFilter] = useState<QueryOptions['temporalFilter']>();
  const [attributeFilters, setAttributeFilters] = useState<AttributeFilter[]>([]);
  const [isSpatialDialogOpen, setIsSpatialDialogOpen] = useState(false);
  const [isTemporalDialogOpen, setIsTemporalDialogOpen] = useState(false);
  const [isAttributeDialogOpen, setIsAttributeDialogOpen] = useState(false);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [drawingMode, setDrawingMode] = useState<DrawingMode>('polygon');
  const [drawnGeometry, setDrawnGeometry] = useState<any>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const handleLayerChange = (event: SelectChangeEvent<string[]>) => {
    const newSelectedLayers = event.target.value as string[];
    setSelectedLayers(newSelectedLayers);
    
    // Update layer visibility in the map
    Object.entries(layers).forEach(([id, layer]) => {
      const isVisible = newSelectedLayers.includes(id);
      layerStateManager.setLayerVisibility(id, isVisible);
    });
  };

  const handleAddAttributeFilter = () => {
    setAttributeFilters([
      ...attributeFilters,
      { field: '', operator: '=', value: '' }
    ]);
  };

  const handleRemoveAttributeFilter = (index: number) => {
    setAttributeFilters(attributeFilters.filter((_, i) => i !== index));
  };

  const handleAttributeFilterChange = (
    index: number,
    field: keyof AttributeFilter,
    value: any
  ) => {
    const newFilters = [...attributeFilters];
    newFilters[index] = { ...newFilters[index], [field]: value };
    setAttributeFilters(newFilters);
  };

  const handleDrawingModeChange = useCallback((
    event: React.MouseEvent<HTMLElement>,
    newMode: DrawingMode
  ) => {
    if (newMode !== null) {
      setDrawingMode(newMode);
      if (mapRef?.current) {
        mapRef.current.activateDrawingTool(newMode);
      }
    }
  }, [mapRef]);

  const handleGeometryDrawn = useCallback((geometry: any) => {
    setDrawnGeometry(geometry);
    onSpatialFilterChange?.(geometry);
  }, [onSpatialFilterChange]);

  const handleApplySpatialFilter = () => {
    if (drawnGeometry) {
      const filter = {
        geometry: drawnGeometry,
        spatialRel: 'intersects' as const
      };
      setSpatialFilter(filter);
      setIsSpatialDialogOpen(false);
    }
  };

  const handleClearSpatialFilter = () => {
    setSpatialFilter(undefined);
    setDrawnGeometry(null);
    if (mapRef?.current) {
      mapRef.current.clearDrawing();
    }
    setIsSpatialDialogOpen(false);
  };

  const handleApplyTemporalFilter = () => {
    if (startDate && endDate) {
      const filter = {
        startDate,
        endDate
      };
      setTemporalFilter(filter);
      onTemporalFilterChange?.(startDate, endDate);
      setIsTemporalDialogOpen(false);
    }
  };

  const handleClearTemporalFilter = () => {
    setTemporalFilter(undefined);
    setStartDate(null);
    setEndDate(null);
    setIsTemporalDialogOpen(false);
  };

  const renderAttributeFilterDialog = () => (
    <Dialog open={isAttributeDialogOpen} onClose={() => setIsAttributeDialogOpen(false)}>
      <DialogTitle>Add Attribute Filter</DialogTitle>
      <DialogContent>
        <List>
          {attributeFilters.map((filter, index) => (
            <ListItem key={index}>
              <Box sx={{ display: 'flex', width: '100%', gap: 2 }}>
                <FormControl sx={{ flex: 4 }}>
                  <InputLabel>Field</InputLabel>
                  <Select
                    value={filter.field}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleAttributeFilterChange(index, 'field', e.target.value)}
                  >
                    {selectedLayers.map(layerId => {
                      const layer = layers[layerId];
                      return layer.fields.map(field => (
                        <MenuItem key={field.name} value={field.name}>
                          {field.label}
                        </MenuItem>
                      ));
                    })}
                  </Select>
                </FormControl>
                <FormControl sx={{ flex: 3 }}>
                  <InputLabel>Operator</InputLabel>
                  <Select
                    value={filter.operator}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleAttributeFilterChange(index, 'operator', e.target.value)}
                  >
                    <MenuItem value="=">=</MenuItem>
                    <MenuItem value=">">&gt;</MenuItem>
                    <MenuItem value="<">&lt;</MenuItem>
                    <MenuItem value=">=">&gt;=</MenuItem>
                    <MenuItem value="<=">&lt;=</MenuItem>
                    <MenuItem value="!=">!=</MenuItem>
                    <MenuItem value="like">LIKE</MenuItem>
                    <MenuItem value="in">IN</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  sx={{ flex: 4 }}
                  label="Value"
                  value={filter.value}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleAttributeFilterChange(index, 'value', e.target.value)}
                />
                <IconButton onClick={() => handleRemoveAttributeFilter(index)}>
                  <DeleteIcon />
                </IconButton>
              </Box>
            </ListItem>
          ))}
        </List>
        <Button
          startIcon={<AddIcon />}
          onClick={handleAddAttributeFilter}
          sx={{ mt: 2 }}
        >
          Add Filter
        </Button>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setIsAttributeDialogOpen(false)}>Close</Button>
      </DialogActions>
    </Dialog>
  );

  const renderSpatialFilterDialog = () => (
    <Dialog 
      open={isSpatialDialogOpen} 
      onClose={() => setIsSpatialDialogOpen(false)}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>Spatial Filter</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Drawing Tools
          </Typography>
          <ToggleButtonGroup
            value={drawingMode}
            exclusive
            onChange={handleDrawingModeChange}
            aria-label="drawing mode"
          >
            <ToggleButton value="polygon" aria-label="draw polygon">
              <ChartIcon />
            </ToggleButton>
            <ToggleButton value="circle" aria-label="draw circle">
              <CircleIcon />
            </ToggleButton>
            <ToggleButton value="rectangle" aria-label="draw rectangle">
              <SquareIcon />
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Box sx={{ height: 400, border: '1px solid #ccc', borderRadius: 1 }}>
          {/* Map will be rendered here by the parent component */}
          <Typography variant="body2" sx={{ p: 2, textAlign: 'center' }}>
            Draw on the map to create a spatial filter
          </Typography>
        </Box>

        {drawnGeometry && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Selected Area
            </Typography>
            <Typography variant="body2">
              {`Type: ${drawnGeometry.type}`}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClearSpatialFilter}>Clear</Button>
        <Button onClick={() => setIsSpatialDialogOpen(false)}>Cancel</Button>
        <Button 
          onClick={handleApplySpatialFilter}
          variant="contained"
          disabled={!drawnGeometry}
        >
          Apply Filter
        </Button>
      </DialogActions>
    </Dialog>
  );

  const renderTemporalFilterDialog = () => (
    <Dialog 
      open={isTemporalDialogOpen} 
      onClose={() => setIsTemporalDialogOpen(false)}
    >
      <DialogTitle>Temporal Filter</DialogTitle>
      <DialogContent>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <DatePicker
              label="Start Date"
              value={startDate}
              onChange={(newValue: Date | null) => setStartDate(newValue)}
              maxDate={endDate || undefined}
            />
            <DatePicker
              label="End Date"
              value={endDate}
              onChange={(newValue: Date | null) => setEndDate(newValue)}
              minDate={startDate || undefined}
            />
          </Box>
        </LocalizationProvider>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClearTemporalFilter}>Clear</Button>
        <Button onClick={() => setIsTemporalDialogOpen(false)}>Cancel</Button>
        <Button 
          onClick={handleApplyTemporalFilter}
          variant="contained"
          disabled={!startDate || !endDate}
        >
          Apply Filter
        </Button>
      </DialogActions>
    </Dialog>
  );

  const handleExecuteQuery = async () => {
    if (selectedLayers.length === 0) return;

    const options: QueryOptions = {
      spatialFilter,
      temporalFilter,
      attributeFilter: attributeFilters,
      maxFeatures: 1000
    };

    try {
      const result = await queryAnalyzer.executeQuery(selectedLayers, options);
      setQueryResult(result);
      onQueryResult?.(result);

      // Update map view to show results if they have a spatial extent
      if (result.metadata.spatialExtent && mapRef?.current) {
        const { xmin, ymin, xmax, ymax } = result.metadata.spatialExtent;
        mapRef.current.getView().extent = { xmin, ymin, xmax, ymax };
      }
    } catch (error) {
      console.error('Error executing query:', error);
    }
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Complex Query Builder
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <FormControl fullWidth>
          <InputLabel>Select Layers</InputLabel>
          <Select
            multiple
            value={selectedLayers}
            onChange={handleLayerChange}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.map((value) => (
                  <Chip key={value} label={layers[value]?.name} />
                ))}
              </Box>
            )}
          >
            {Object.entries(layers).map(([id, layer]) => (
              <MenuItem key={id} value={id}>
                {layer.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            startIcon={<LocationOnIcon />}
            variant="outlined"
            onClick={() => setIsSpatialDialogOpen(true)}
          >
            Spatial Filter
          </Button>
          <Button
            startIcon={<DateRangeIcon />}
            variant="outlined"
            onClick={() => setIsTemporalDialogOpen(true)}
          >
            Temporal Filter
          </Button>
          <Button
            startIcon={<FilterListIcon />}
            variant="outlined"
            onClick={() => setIsAttributeDialogOpen(true)}
          >
            Attribute Filters
          </Button>
        </Box>

        <Button
          variant="contained"
          fullWidth
          onClick={handleExecuteQuery}
          disabled={selectedLayers.length === 0}
        >
          Execute Query
        </Button>

        {queryResult && (
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              Query Results
            </Typography>
            <Typography variant="body2">
              Total Features: {queryResult.metadata.totalFeatures}
            </Typography>
            <Typography variant="body2">
              Execution Time: {queryResult.metadata.executionTime.toFixed(2)}ms
            </Typography>
          </Box>
        )}
      </Box>

      {renderAttributeFilterDialog()}
      {renderSpatialFilterDialog()}
      {renderTemporalFilterDialog()}
    </Paper>
  );
}; 