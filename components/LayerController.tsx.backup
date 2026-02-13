/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Slider,
  Typography,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Divider,
  Tabs,
  Tab
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Edit as EditIcon,
  DragIndicator as DragIndicatorIcon
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { LayerConfig, LayerGroup, ProjectLayerConfig } from '../types/layers';
import { createProjectConfig } from '../adapters/layerConfigAdapter';
import { layerStatePersistence } from '../utils/layer-state-persistence';
import { LayerFilter } from './LayerFilter';
import { LayerBookmarks } from './LayerBookmarks';
import MapView from '@arcgis/core/views/MapView';
import { LayerState } from './types';

interface LayerControllerProps {
  view: MapView;
  config: ProjectLayerConfig;
  onLayerStatesChange: (states: { [key: string]: LayerState }) => void;
  onLayerInitializationProgress?: (progress: { loaded: number; total: number }) => void;
  onInitializationComplete?: () => void;
  visible?: boolean;
  onLayerVisibilityChange?: (layerId: string, visible: boolean) => void;
  onLayerOpacityChange?: (layerId: string, opacity: number) => void;
  onLayerOrderChange?: (layerId: string, newOrder: number) => void;
  onGroupChange?: (groupId: string, updates: Partial<LayerGroup>) => void;
  onLayerGroupChange?: (layerId: string, newGroupId: string) => void;
}

export const LayerController: React.FC<LayerControllerProps> = ({
  onLayerVisibilityChange,
  onLayerOpacityChange,
  onLayerOrderChange,
  onGroupChange,
  onLayerGroupChange
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [layerStates, setLayerStates] = useState<Record<string, any>>({});
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<LayerGroup | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '' });
  const [activeTab, setActiveTab] = useState(0);
  const [filteredLayers, setFilteredLayers] = useState<LayerConfig[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<LayerGroup[]>([]);
  
  // Get project config from adapter
  const projectLayerConfig = createProjectConfig();

  useEffect(() => {
    // Load initial state from persistence
    const persistedState = layerStatePersistence.getState();
    setExpandedGroups(
      Object.fromEntries(
        Object.entries(persistedState.groups).map(([id, group]) => [id, group.expanded])
      )
    );
    setLayerStates(persistedState.layers);
    
    // Extract layers from groups
    const allLayers = projectLayerConfig.groups.reduce((acc: Record<string, LayerConfig>, group: LayerGroup) => {
      if (group.layers) {
        group.layers.forEach((layer: LayerConfig) => {
          acc[layer.id] = layer;
        });
      }
      return acc;
    }, {} as Record<string, LayerConfig>);
    
    setFilteredLayers(Object.values(allLayers));
    setFilteredGroups(projectLayerConfig.groups);
  }, [projectLayerConfig]);

  const handleGroupToggle = (groupId: string) => {
    const newExpanded = !expandedGroups[groupId];
    setExpandedGroups(prev => ({ ...prev, [groupId]: newExpanded }));
    layerStatePersistence.updateGroupState(groupId, { expanded: newExpanded });
  };

  const handleLayerVisibilityToggle = (layerId: string) => {
    const newVisible = !layerStates[layerId]?.visible;
    setLayerStates(prev => ({
      ...prev,
      [layerId]: { ...prev[layerId], visible: newVisible }
    }));
    layerStatePersistence.updateLayerState(layerId, { visible: newVisible });
    onLayerVisibilityChange?.(layerId, newVisible);
  };

  const handleOpacityChange = (layerId: string, newOpacity: number) => {
    setLayerStates(prev => ({
      ...prev,
      [layerId]: { ...prev[layerId], opacity: newOpacity }
    }));
    layerStatePersistence.updateLayerState(layerId, { opacity: newOpacity });
    onLayerOpacityChange?.(layerId, newOpacity);
  };

  const handleEditGroup = (group: LayerGroup) => {
    setEditingGroup(group);
    setEditForm({
      title: group.title,
      description: group.description || ''
    });
    setEditDialogOpen(true);
  };

  const handleSaveGroup = () => {
    if (editingGroup) {
      const updates = {
        title: editForm.title,
        description: editForm.description
      };
      onGroupChange?.(editingGroup.id, updates);
      layerStatePersistence.updateGroupState(editingGroup.id, updates);
      setEditDialogOpen(false);
    }
  };


  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const { source, destination } = result;
    const sourceGroupId = source.droppableId;
    const destGroupId = destination.droppableId;
    const layerId = result.draggableId;

    // If moving within the same group
    if (sourceGroupId === destGroupId) {
      const groupLayers = filteredLayers.filter(layer => layer.group === sourceGroupId);
      const [movedLayer] = groupLayers.splice(source.index, 1);
      groupLayers.splice(destination.index, 0, movedLayer);

      // Update layer order in persistence
      groupLayers.forEach((layer, index) => {
        layerStatePersistence.updateLayerState(layer.id, { order: index });
        onLayerOrderChange?.(layer.id, index);
      });
    } else {
      // Moving between groups
      const layer = filteredLayers.find(l => l.id === layerId);
      if (layer) {
        layerStatePersistence.updateLayerState(layerId, { group: destGroupId });
        onLayerGroupChange?.(layerId, destGroupId);
      }
    }
  };

  const renderLayerItem = (layer: LayerConfig, index: number) => {
    const state = layerStates[layer.id] || {
      visible: (projectLayerConfig.defaultVisibility as Record<string, boolean>)?.[layer.id] ?? false,
      opacity: 1 // Default opacity if globalSettings is not available
    };

    return (
      <Draggable key={layer.id} draggableId={layer.id} index={index}>
        {(provided, snapshot) => (
          <ListItem
            ref={provided.innerRef}
            {...provided.draggableProps}
            component="div"
            sx={{
              pl: 4,
              '&:hover': {
                backgroundColor: 'action.hover'
              },
              backgroundColor: snapshot.isDragging ? 'action.selected' : 'inherit'
            }}
          >
            <ListItemIcon {...provided.dragHandleProps}>
              <DragIndicatorIcon />
            </ListItemIcon>
            <ListItemIcon>
              <IconButton
                edge="start"
                onClick={() => handleLayerVisibilityToggle(layer.id)}
                size="small"
              >
                {state.visible ? <VisibilityIcon /> : <VisibilityOffIcon />}
              </IconButton>
            </ListItemIcon>
            <ListItemText
              primary={layer.name}
              secondary={
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                  <Typography variant="caption" sx={{ mr: 2 }}>
                    Opacity
                  </Typography>
                  <Slider
                    size="small"
                    value={state.opacity}
                    onChange={(_, value) => handleOpacityChange(layer.id, value as number)}
                    min={0}
                    max={1}
                    step={0.1}
                    sx={{ width: 100 }}
                  />
                </Box>
              }
            />
          </ListItem>
        )}
      </Draggable>
    );
  };

  const renderGroup = (group: LayerGroup) => {
    const isExpanded = expandedGroups[group.id] ?? false;
    const groupLayers = filteredLayers.filter(
      layer => layer.group === group.id
    );

    if (groupLayers.length === 0) return null;

    return (
      <Box key={group.id}>
        <ListItem
          component="div"
          disablePadding
          onClick={() => handleGroupToggle(group.id)}
          sx={{
            cursor: 'pointer',
            '&:hover': {
              backgroundColor: 'action.hover'
            }
          }}
        >
          <ListItemIcon>
            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </ListItemIcon>
          <ListItemText
            primary={group.title}
            secondary={group.description}
          />
          <ListItemSecondaryAction>
            <IconButton
              edge="end"
              onClick={(e) => {
                e.stopPropagation();
                handleEditGroup(group);
              }}
              size="small"
            >
              <EditIcon />
            </IconButton>
          </ListItemSecondaryAction>
        </ListItem>
        <Collapse in={isExpanded}>
          <Droppable droppableId={group.id}>
            {(provided) => (
              <List
                ref={provided.innerRef}
                {...provided.droppableProps}
                disablePadding
              >
                {groupLayers.map((layer, index) => renderLayerItem(layer, index))}
                {provided.placeholder}
              </List>
            )}
          </Droppable>
        </Collapse>
        <Divider />
      </Box>
    );
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 360, bgcolor: 'background.paper' }}>
      <Tabs
        value={activeTab}
        onChange={(_, newValue) => setActiveTab(newValue)}
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="Layers" />
        <Tab label="Bookmarks" />
      </Tabs>

      {activeTab === 0 ? (
        <DragDropContext onDragEnd={handleDragEnd}>
          <LayerFilter
            config={{
              ...projectLayerConfig,
              layers: projectLayerConfig.groups.reduce((acc: Record<string, LayerConfig>, group: LayerGroup) => {
                if (group.layers) {
                  group.layers.forEach((layer: LayerConfig) => {
                    acc[layer.id] = layer;
                  });
                }
                return acc;
              }, {} as Record<string, LayerConfig>),
              globalSettings: {
                defaultOpacity: 1,
                maxVisibleLayers: 10,
                performanceMode: 'standard'
              }
            }}
            onFilterChange={(filteredLayers) => setFilteredLayers(Object.values(filteredLayers))}
            onGroupFilterChange={setFilteredGroups}
          />
          <List>
            {filteredGroups.map(renderGroup)}
          </List>
        </DragDropContext>
      ) : (
        <LayerBookmarks 
          config={{
            ...projectLayerConfig,
            layers: projectLayerConfig.groups.reduce((acc: Record<string, LayerConfig>, group: LayerGroup) => {
              if (group.layers) {
                group.layers.forEach((layer: LayerConfig) => {
                  acc[layer.id] = layer;
                });
              }
              return acc;
            }, {} as Record<string, LayerConfig>),
            globalSettings: {
              defaultOpacity: 1,
              maxVisibleLayers: 10,
              performanceMode: 'standard'
            }
          }}
          onLayerStatesChange={(states) => {
            Object.entries(states).forEach(([layerId, state]) => {
              if (state.visible !== layerStates[layerId]?.visible) {
                handleLayerVisibilityToggle(layerId);
              }
            });
          }}
        />
      )}

      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)}>
        <DialogTitle>Edit Group</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Title"
            fullWidth
            value={editForm.title}
            onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            multiline
            rows={4}
            value={editForm.description}
            onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveGroup} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}; 