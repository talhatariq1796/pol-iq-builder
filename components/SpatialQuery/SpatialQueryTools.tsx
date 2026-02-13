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
  Stack
} from '@mui/material';
import {
  Draw as DrawIcon,
  Clear,
  Save,
  Route,
  Circle,
  Rectangle,
  CropSquare
} from '@mui/icons-material';
import { LayerConfig } from '@/types/layers';
import { LayerErrorHandler } from '@/utils/layer-error-handler';
import type { Geometry } from '@arcgis/core/geometry';
import Query from '@arcgis/core/rest/support/Query';
import DrawAction from '@arcgis/core/views/draw/DrawAction';

type SpatialRelationship = NonNullable<Query['spatialRelationship']>;

interface SpatialQueryToolsProps {
  mapView: __esri.MapView;
  layers: LayerConfig[];
  onQueryComplete: (results: any) => void;
}

type DrawMode = 'polygon' | 'circle' | 'rectangle' | 'route';
type SpatialOperation = 'intersects' | 'contains' | 'crosses' | 'disjoint' | 'overlaps' | 'touches' | 'within' | 'envelope-intersects' | 'index-intersects' | 'relation';

interface QuerySettings {
  drawMode: DrawMode;
  operation: SpatialOperation;
  bufferDistance?: number;
  nearDistance?: number;
  selectedLayers: string[];
  relation?: string;
}

export const SpatialQueryTools: React.FC<SpatialQueryToolsProps> = ({
  mapView,
  layers,
  onQueryComplete
}) => {
  const [settings, setSettings] = useState<QuerySettings>({
    drawMode: 'polygon',
    operation: 'intersects',
    selectedLayers: []
  });
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawnGeometry, setDrawnGeometry] = useState<Geometry | null>(null);
  const errorHandler = LayerErrorHandler.getInstance();

  const handleDrawModeChange = (mode: DrawMode) => {
    setSettings((prev: any) => ({ ...prev, drawMode: mode }));
    startDrawing(mode);
  };

  const handleOperationChange = (operation: SpatialOperation) => {
    setSettings((prev: any) => ({ ...prev, operation }));
  };

  const handleLayerSelection = (layerIds: string[]) => {
    setSettings((prev: any) => ({ ...prev, selectedLayers: layerIds }));
  };

  const startDrawing = async (mode: DrawMode) => {
    try {
      const draw = new __esri.Draw({
        view: mapView
      });

      let drawAction: DrawAction;
      switch (mode) {
        case 'polygon':
          drawAction = await draw.create('polygon');
          break;
        case 'circle':
          drawAction = await draw.create('circle');
          break;
        case 'rectangle':
          drawAction = await draw.create('rectangle');
          break;
        case 'route':
          drawAction = await draw.create('polyline');
          break;
        default:
          throw new Error('Invalid draw mode');
      }

      const geometry = await new Promise<Geometry>((resolve) => {
        drawAction.on('complete', (event) => {
          resolve(event.geometry);
        });
      });

      if (geometry) {
        await executeSpatialQuery(geometry);
      }
    } catch (error) {
      console.error('Error during drawing:', error);
    }
  };

  const executeSpatialQuery = async (geometry: Geometry) => {
    try {
      const results = [];
      for (const layerId of settings.selectedLayers) {
        const layer = mapView.map.layers.find(l => l.id === layerId) as __esri.FeatureLayer;
        if (layer) {
          const query = layer.createQuery();
          query.geometry = geometry;
          query.spatialRelationship = settings.operation;
          
          if (settings.bufferDistance) {
            query.distance = settings.bufferDistance;
          }

          const result = await layer.queryFeatures(query);
          results.push({
            layerId,
            features: result.features
          });
        }
      }
      onQueryComplete(results);
    } catch (error) {
      console.error('Error executing spatial query:', error);
    }
  };

  const clearDrawing = () => {
    setDrawnGeometry(null);
    mapView.graphics.removeAll();
  };

  return (
    <Paper sx={{ p: 2, maxWidth: 400 }}>
      <Typography variant="h6" gutterBottom>
        Spatial Query Tools
      </Typography>

      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Draw Mode
        </Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Draw Polygon">
            <IconButton
              color={settings.drawMode === 'polygon' ? 'primary' : 'default'}
              onClick={() => handleDrawModeChange('polygon')}
            >
              <CropSquare />
            </IconButton>
          </Tooltip>
          <Tooltip title="Draw Circle">
            <IconButton
              color={settings.drawMode === 'circle' ? 'primary' : 'default'}
              onClick={() => handleDrawModeChange('circle')}
            >
              <Circle />
            </IconButton>
          </Tooltip>
          <Tooltip title="Draw Rectangle">
            <IconButton
              color={settings.drawMode === 'rectangle' ? 'primary' : 'default'}
              onClick={() => handleDrawModeChange('rectangle')}
            >
              <Rectangle />
            </IconButton>
          </Tooltip>
          <Tooltip title="Draw Route">
            <IconButton
              color={settings.drawMode === 'route' ? 'primary' : 'default'}
              onClick={() => handleDrawModeChange('route')}
            >
              <Route />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      <Divider sx={{ my: 2 }} />

      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Spatial Operation
        </Typography>
        <FormControl fullWidth size="small">
          <Select
            value={settings.operation}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleOperationChange(e.target.value as SpatialOperation)}
          >
            <MenuItem value="intersects">Intersects</MenuItem>
            <MenuItem value="contains">Contains</MenuItem>
            <MenuItem value="crosses">Crosses</MenuItem>
            <MenuItem value="disjoint">Disjoint</MenuItem>
            <MenuItem value="overlaps">Overlaps</MenuItem>
            <MenuItem value="touches">Touches</MenuItem>
            <MenuItem value="within">Within</MenuItem>
            <MenuItem value="envelope-intersects">Envelope Intersects</MenuItem>
            <MenuItem value="index-intersects">Index Intersects</MenuItem>
            <MenuItem value="relation">Relation</MenuItem>
          </Select>
        </FormControl>

        {settings.operation === 'relation' && (
          <TextField
            fullWidth
            size="small"
            type="text"
            label="Relation"
            value={settings.relation || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings((prev: any) => ({ ...prev, relation: e.target.value }))}
            sx={{ mt: 1 }}
          />
        )}
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
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleLayerSelection(e.target.value as unknown as string[])}
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
          onClick={clearDrawing}
          disabled={!drawnGeometry}
        >
          Clear
        </Button>
        <Button
          variant="contained"
          startIcon={<DrawIcon />}
          onClick={() => startDrawing(settings.drawMode)}
          disabled={isDrawing}
        >
          {isDrawing ? 'Drawing...' : 'Draw'}
        </Button>
      </Box>
    </Paper>
  );
}; 