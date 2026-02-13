import React, { useState, useCallback } from 'react';
import { Box, Paper, Tab, Tabs } from '@mui/material';
import MapView from '@arcgis/core/views/MapView';
import { LayerController } from './LayerController';
import { LayerFilter } from './LayerFilter';
import { LayerBookmarks } from './LayerBookmarks';
import { LayerConfig, LayerGroup, ProjectLayerConfig } from '../types/layers';
import { LayerState } from './types';

interface LayerPanelProps {
  view: MapView;
  config: ProjectLayerConfig;
  onLayerStatesChange: (states: { [key: string]: LayerState }) => void;
  onLayerInitializationProgress?: (progress: { loaded: number; total: number }) => void;
  onInitializationComplete?: () => void;
  visible?: boolean;
}

const LayerPanel: React.FC<LayerPanelProps> = ({
  view,
  config,
  onLayerStatesChange,
  onLayerInitializationProgress,
  onInitializationComplete,
  visible = false
}) => {
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <Paper 
      elevation={3}
      sx={{
        width: 350,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange}
          aria-label="layer management tabs"
        >
          <Tab label="Layers" />
          <Tab label="Bookmarks" />
        </Tabs>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {activeTab === 0 ? (
          <>
            <LayerFilter
              config={config}
              onFilterChange={() => {}}
              onGroupFilterChange={() => {}}
            />
            <LayerController
              view={view}
              config={config}
              onLayerStatesChange={onLayerStatesChange}
              onLayerInitializationProgress={onLayerInitializationProgress}
              onInitializationComplete={onInitializationComplete}
              visible={visible}
            />
          </>
        ) : (
          <LayerBookmarks
            config={config}
            onLayerStatesChange={onLayerStatesChange}
          />
        )}
      </Box>
    </Paper>
  );
};

export default LayerPanel; 