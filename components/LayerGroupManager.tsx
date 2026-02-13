import React, { useState } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { layerStateManager } from '../utils/layer-state-manager';
import { layers } from '../config/layers';
import { LayerGroup } from '../types/layers';

interface LayerGroupManagerProps {
  onGroupChange?: (groupId: string, action: 'create' | 'edit' | 'delete') => void;
}

export const LayerGroupManager: React.FC<LayerGroupManagerProps> = ({
  onGroupChange
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<LayerGroup | null>(null);
  const [groupTitle, setGroupTitle] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedLayers, setSelectedLayers] = useState<string[]>([]);

  const handleOpenDialog = (group?: LayerGroup) => {
    if (group) {
      setEditingGroup(group);
      setGroupTitle(group.title);
      setGroupDescription(group.description || '');
      setSelectedLayers(group.layers?.map(l => l.id) || []);
    } else {
      setEditingGroup(null);
      setGroupTitle('');
      setGroupDescription('');
      setSelectedLayers([]);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingGroup(null);
    setGroupTitle('');
    setGroupDescription('');
    setSelectedLayers([]);
  };

  const handleSaveGroup = () => {
    if (!groupTitle) return;

    const group: LayerGroup = {
      id: editingGroup?.id || `group-${Date.now()}`,
      title: groupTitle,
      description: groupDescription,
      layers: selectedLayers.map(id => layers[id]).filter(Boolean)
    };

    if (editingGroup) {
      // Update existing group
      const groups = layerStateManager.groups.map(g => 
        g.id === group.id ? group : g
      );
      layerStateManager.groups = groups;
      onGroupChange?.(group.id, 'edit');
    } else {
      // Create new group
      layerStateManager.groups = [...layerStateManager.groups, group];
      onGroupChange?.(group.id, 'create');
    }

    handleCloseDialog();
  };

  const handleDeleteGroup = (groupId: string) => {
    layerStateManager.groups = layerStateManager.groups.filter(g => g.id !== groupId);
    onGroupChange?.(groupId, 'delete');
  };

  const renderGroup = (group: LayerGroup) => {
    const layersInGroup = layerStateManager.getLayersByGroup(group.id);

    return (
      <ListItem key={group.id}>
        <ListItemText
          primary={group.title}
          secondary={
            <>
              {group.description}
              <br />
              {layersInGroup.length} layers
            </>
          }
        />
        <ListItemSecondaryAction>
          <IconButton edge="end" onClick={() => handleOpenDialog(group)}>
            <EditIcon />
          </IconButton>
          <IconButton edge="end" onClick={() => handleDeleteGroup(group.id)}>
            <DeleteIcon />
          </IconButton>
        </ListItemSecondaryAction>
      </ListItem>
    );
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 360, bgcolor: 'background.paper' }}>
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">Layer Groups</Typography>
        <IconButton onClick={() => handleOpenDialog()}>
          <AddIcon />
        </IconButton>
      </Box>
      <List>
        {layerStateManager.groups.map(renderGroup)}
      </List>

      <Dialog open={isDialogOpen} onClose={handleCloseDialog}>
        <DialogTitle>
          {editingGroup ? 'Edit Group' : 'Create New Group'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Group Title"
            fullWidth
            value={groupTitle}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setGroupTitle(e.target.value)}
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            multiline
            rows={2}
            value={groupDescription}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setGroupDescription(e.target.value)}
          />
          <FormControl fullWidth margin="dense">
            <InputLabel>Layers</InputLabel>
            <Select
              multiple
              value={selectedLayers}
              onChange={(e: any) => setSelectedLayers(e.target.value)}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => (
                    <Typography key={value} variant="body2">
                      {layers[value]?.name}
                    </Typography>
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
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSaveGroup} variant="contained">
            {editingGroup ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}; 