import React, { useState } from 'react';
import { 
  List, 
  ListItem, 
  ListItemText, 
  ListItemSecondaryAction,
  IconButton,
  Slider,
  Collapse,
  Typography,
  Box
} from '@mui/material';
import { 
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import { layerStateManager } from '../utils/layer-state-manager';
import { layers } from '../config/layers';
import { LayerGroup } from '../types/layers';

interface LayerControlsProps {
  onLayerVisibilityChange?: (layerId: string, visible: boolean) => void;
  onLayerOpacityChange?: (layerId: string, opacity: number) => void;
}

export const LayerControls: React.FC<LayerControlsProps> = ({
  onLayerVisibilityChange,
  onLayerOpacityChange
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev: Record<string, boolean>) => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  const handleVisibilityToggle = (layerId: string) => {
    const currentState = layerStateManager.getLayerState(layerId);
    if (currentState) {
      const newVisible = !currentState.visible;
      layerStateManager.setLayerVisibility(layerId, newVisible);
      onLayerVisibilityChange?.(layerId, newVisible);
    }
  };

  const handleOpacityChange = (layerId: string, newOpacity: number) => {
    layerStateManager.setLayerOpacity(layerId, newOpacity);
    onLayerOpacityChange?.(layerId, newOpacity);
  };

  const renderLayer = (layerId: string) => {
    const layer = layers[layerId];
    const state = layerStateManager.getLayerState(layerId);
    if (!layer || !state) return null;

    return (
      <ListItem key={layerId}>
        <ListItemText 
          primary={layer.name}
          secondary={layer.description}
        />
        <ListItemSecondaryAction>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Slider
              size="small"
              value={state.opacity}
              min={0}
              max={1}
              step={0.1}
              onChange={(_, value) => handleOpacityChange(layerId, value as number)}
              sx={{ width: 100 }}
            />
            <IconButton
              edge="end"
              onClick={() => handleVisibilityToggle(layerId)}
            >
              {state.visible ? <VisibilityIcon /> : <VisibilityOffIcon />}
            </IconButton>
          </Box>
        </ListItemSecondaryAction>
      </ListItem>
    );
  };

  const renderGroup = (group: LayerGroup) => {
    const layersInGroup = layerStateManager.getLayersByGroup(group.id);
    const isExpanded = expandedGroups[group.id] ?? false;

    return (
      <React.Fragment key={group.id}>
        <ListItem 
          onClick={() => toggleGroup(group.id)}
          sx={{ cursor: 'pointer' }}
        >
          <ListItemText
            primary={group.title}
            secondary={group.description}
          />
          <IconButton edge="end">
            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </ListItem>
        <Collapse in={isExpanded}>
          <List component="div" disablePadding>
            {layersInGroup.map(layerId => renderLayer(layerId))}
          </List>
        </Collapse>
      </React.Fragment>
    );
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 360, bgcolor: 'background.paper' }}>
      <Typography variant="h6" sx={{ p: 2 }}>
        Layer Controls
      </Typography>
      <List>
        {layerStateManager.groups.map(group => renderGroup(group))}
      </List>
    </Box>
  );
}; 