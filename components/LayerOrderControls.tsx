import React from 'react';
import { 
  List, 
  ListItem, 
  ListItemText, 
  ListItemSecondaryAction,
  IconButton,
  Typography,
  Box
} from '@mui/material';
import { 
  DragIndicator as DragIndicatorIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon
} from '@mui/icons-material';
import { 
  DragDropContext, 
  Droppable, 
  Draggable,
  DropResult,
  DroppableProvided,
  DraggableProvided
} from 'react-beautiful-dnd';
import { layerStateManager } from '../utils/layer-state-manager';
import { layers } from '../config/layers';

interface LayerOrderControlsProps {
  onLayerOrderChange?: (layerId: string, newOrder: number) => void;
}

export const LayerOrderControls: React.FC<LayerOrderControlsProps> = ({
  onLayerOrderChange
}) => {
  const orderedLayers = layerStateManager.getOrderedLayers();

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination } = result;
    const layerId = orderedLayers[source.index];
    const newOrder = destination.index;

    layerStateManager.setLayerOrder(layerId, newOrder);
    onLayerOrderChange?.(layerId, newOrder);
  };

  const moveLayer = (layerId: string, direction: 'up' | 'down') => {
    const currentIndex = orderedLayers.indexOf(layerId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' 
      ? Math.max(0, currentIndex - 1)
      : Math.min(orderedLayers.length - 1, currentIndex + 1);

    if (newIndex !== currentIndex) {
      layerStateManager.setLayerOrder(layerId, newIndex);
      onLayerOrderChange?.(layerId, newIndex);
    }
  };

  const renderLayer = (layerId: string, index: number) => {
    const layer = layers[layerId];
    if (!layer) return null;

    return (
      <Draggable key={layerId} draggableId={layerId} index={index}>
        {(provided: DraggableProvided) => (
          <ListItem
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
          >
            <DragIndicatorIcon sx={{ mr: 2, color: 'text.secondary' }} />
            <ListItemText 
              primary={layer.name}
              secondary={layer.description}
            />
            <ListItemSecondaryAction>
              <IconButton
                edge="end"
                onClick={() => moveLayer(layerId, 'up')}
                disabled={index === 0}
              >
                <ArrowUpwardIcon />
              </IconButton>
              <IconButton
                edge="end"
                onClick={() => moveLayer(layerId, 'down')}
                disabled={index === orderedLayers.length - 1}
              >
                <ArrowDownwardIcon />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        )}
      </Draggable>
    );
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 360, bgcolor: 'background.paper' }}>
      <Typography variant="h6" sx={{ p: 2 }}>
        Layer Order
      </Typography>
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="layers">
          {(provided: DroppableProvided) => (
            <List
              {...provided.droppableProps}
              ref={provided.innerRef}
            >
              {orderedLayers.map((layerId, index) => renderLayer(layerId, index))}
              {provided.placeholder}
            </List>
          )}
        </Droppable>
      </DragDropContext>
    </Box>
  );
}; 