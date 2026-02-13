import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Button,
  Divider,
  Alert,
  IconButton,
  Tooltip,
  SelectChangeEvent
} from '@mui/material';
import { Sync, SyncDisabled, Settings, Delete } from '@mui/icons-material';
import { MapView } from '@/types/map';
import { ViewSyncManager } from '@/utils/view-sync-manager';
import { LayerErrorHandler } from '@/utils/layer-error-handler';

interface ViewSynchronizationProps {
  views: MapView[];
  onSyncUpdate?: (viewId: string, config: any) => void;
}

interface SyncConfig {
  enabled: boolean;
  syncExtent: boolean;
  syncRotation: boolean;
  syncZoom: boolean;
  syncLayers: boolean;
  syncTime: boolean;
  syncSelection: boolean;
  syncPopups: boolean;
}

export const ViewSynchronization: React.FC<ViewSynchronizationProps> = ({
  views,
  onSyncUpdate
}) => {
  const [selectedView, setSelectedView] = useState<string>('');
  const [syncConfig, setSyncConfig] = useState<SyncConfig>({
    enabled: false,
    syncExtent: true,
    syncRotation: true,
    syncZoom: true,
    syncLayers: true,
    syncTime: false,
    syncSelection: false,
    syncPopups: false
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const errorHandler = LayerErrorHandler.getInstance();
  const syncManager = ViewSyncManager.getInstance();

  useEffect(() => {
    if (selectedView) {
      const view = views.find(v => v.id === selectedView);
      if (view?.syncConfig) {
        setSyncConfig(view.syncConfig);
      }
    }
  }, [selectedView, views]);

  const handleViewChange = (event: SelectChangeEvent<string>) => {
    setSelectedView(event.target.value);
  };

  const handleConfigChange = (field: keyof SyncConfig) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setSyncConfig((prev: any) => ({
      ...prev,
      [field]: event.target.checked
    }));
  };

  const handleApplySync = async () => {
    if (!selectedView) return;

    setIsLoading(true);
    setError(null);

    try {
      const view = views.find(v => v.id === selectedView);
      if (!view) {
        throw new Error('Selected view not found');
      }

      await syncManager.updateViewSyncConfig(selectedView, syncConfig);
      
      if (onSyncUpdate) {
        onSyncUpdate(selectedView, syncConfig);
      }
    } catch (err) {
      const errorMessage = await errorHandler.handleValidationError('view-sync', err);
      if (typeof errorMessage === 'string') {
        setError(errorMessage);
      } else {
        setError('Failed to update view synchronization');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearSync = async () => {
    if (!selectedView) return;

    setIsLoading(true);
    setError(null);

    try {
      await syncManager.clearSyncConfig(selectedView);
      setSyncConfig({
        enabled: false,
        syncExtent: true,
        syncRotation: true,
        syncZoom: true,
        syncLayers: true,
        syncTime: false,
        syncSelection: false,
        syncPopups: false
      });
      
      if (onSyncUpdate) {
        onSyncUpdate(selectedView, null);
      }
    } catch (err) {
      const errorMessage = await errorHandler.handleValidationError('view-sync', err);
      if (typeof errorMessage === 'string') {
        setError(errorMessage);
      } else {
        setError('Failed to clear view synchronization');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Sync /> View Synchronization
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box>
          <FormControl fullWidth>
            <InputLabel>Select View</InputLabel>
            <Select
              value={selectedView}
              onChange={handleViewChange}
              label="Select View"
            >
              {views.map(view => (
                <MenuItem key={view.id} value={view.id}>
                  {view.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {selectedView && (
          <>
            <Divider sx={{ my: 1 }} />

            <FormControlLabel
              control={
                <Switch
                  checked={syncConfig.enabled}
                  onChange={handleConfigChange('enabled')}
                />
              }
              label="Enable Synchronization"
            />

            <Typography variant="subtitle2" gutterBottom>
              Synchronization Options
            </Typography>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={syncConfig.syncExtent}
                    onChange={handleConfigChange('syncExtent')}
                    disabled={!syncConfig.enabled}
                  />
                }
                label="Extent"
                sx={{ minWidth: 200 }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={syncConfig.syncRotation}
                    onChange={handleConfigChange('syncRotation')}
                    disabled={!syncConfig.enabled}
                  />
                }
                label="Rotation"
                sx={{ minWidth: 200 }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={syncConfig.syncZoom}
                    onChange={handleConfigChange('syncZoom')}
                    disabled={!syncConfig.enabled}
                  />
                }
                label="Zoom Level"
                sx={{ minWidth: 200 }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={syncConfig.syncLayers}
                    onChange={handleConfigChange('syncLayers')}
                    disabled={!syncConfig.enabled}
                  />
                }
                label="Layer Visibility"
                sx={{ minWidth: 200 }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={syncConfig.syncTime}
                    onChange={handleConfigChange('syncTime')}
                    disabled={!syncConfig.enabled}
                  />
                }
                label="Time Extent"
                sx={{ minWidth: 200 }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={syncConfig.syncSelection}
                    onChange={handleConfigChange('syncSelection')}
                    disabled={!syncConfig.enabled}
                  />
                }
                label="Feature Selection"
                sx={{ minWidth: 200 }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={syncConfig.syncPopups}
                    onChange={handleConfigChange('syncPopups')}
                    disabled={!syncConfig.enabled}
                  />
                }
                label="Popups"
                sx={{ minWidth: 200 }}
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 2 }}>
              <Button
                variant="outlined"
                color="error"
                onClick={handleClearSync}
                disabled={isLoading}
                startIcon={<Delete />}
              >
                Clear Sync
              </Button>
              <Button
                variant="contained"
                onClick={handleApplySync}
                disabled={isLoading}
                startIcon={<Sync />}
              >
                Apply Sync
              </Button>
            </Box>
          </>
        )}
      </Box>
    </Paper>
  );
}; 