import React, { useState } from 'react';
import {
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Switch,
  Tooltip,
  Box
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Settings,
  Analytics,
  Delete
} from '@mui/icons-material';
import { LayerConfig } from '@/types/layers';
import { LayerStats } from './LayerStats';

interface LayerListItemProps {
  layer: LayerConfig;
  visible: boolean;
  onVisibilityChange: (layerId: string, visible: boolean) => void;
  onDelete: (layerId: string) => void;
}

export const LayerListItem: React.FC<LayerListItemProps> = ({
  layer,
  visible,
  onVisibilityChange,
  onDelete
}) => {
  const [showStats, setShowStats] = useState(false);

  return (
    <>
      <ListItem>
        <ListItemText
          primary={layer.name}
          secondary={layer.description}
        />
        <ListItemSecondaryAction>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Layer Statistics">
              <IconButton
                edge="end"
                size="small"
                onClick={() => setShowStats(true)}
              >
                <Analytics />
              </IconButton>
            </Tooltip>
            <Tooltip title={visible ? "Hide Layer" : "Show Layer"}>
              <IconButton
                edge="end"
                size="small"
                onClick={() => onVisibilityChange(layer.id, !visible)}
              >
                {visible ? <Visibility /> : <VisibilityOff />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete Layer">
              <IconButton
                edge="end"
                size="small"
                onClick={() => onDelete(layer.id)}
              >
                <Delete />
              </IconButton>
            </Tooltip>
          </Box>
        </ListItemSecondaryAction>
      </ListItem>

      {showStats && (
        <LayerStats
          layer={layer}
          onClose={() => setShowStats(false)}
        />
      )}
    </>
  );
}; 