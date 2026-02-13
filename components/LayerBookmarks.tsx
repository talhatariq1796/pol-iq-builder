import React, { useState, useEffect } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Tooltip,
  Divider
} from '@mui/material';
import {
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import { ProjectLayerConfig } from '../types/layers';

interface LayerBookmark {
  id: string;
  name: string;
  description?: string;
  layers: string[];
  lastUsed: Date;
}

export interface LayerBookmarksProps {
  config: ProjectLayerConfig;
  onLayerStatesChange: (states: { [key: string]: any }) => void;
}

const STORAGE_KEY = 'layerBookmarks';

export const LayerBookmarks: React.FC<LayerBookmarksProps> = ({
  config,
  onLayerStatesChange
}) => {
  const [bookmarks, setBookmarks] = useState<LayerBookmark[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<LayerBookmark | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    layers: [] as string[]
  });

  useEffect(() => {
    // Load bookmarks from localStorage
    const savedBookmarks = localStorage.getItem(STORAGE_KEY);
    if (savedBookmarks) {
      setBookmarks(JSON.parse(savedBookmarks));
    } else {
      // Initialize default bookmarks for Canadian housing markets
      const defaultBookmarks: LayerBookmark[] = [
        {
          id: 'montreal',
          name: 'Montreal Housing Market',
          description: 'Housing data and demographics for Montreal, Quebec',
          layers: Object.keys(config.layers).filter(id => 
            config.layers[id].group === 'housing-group' || 
            config.layers[id].group === 'demographics-group'
          ),
          lastUsed: new Date()
        },
        {
          id: 'quebec-city',
          name: 'Quebec City Housing Market',
          description: 'Housing analysis for Quebec City metropolitan area',
          layers: Object.keys(config.layers).filter(id => 
            config.layers[id].group === 'housing-group' || 
            config.layers[id].group === 'income-group'
          ),
          lastUsed: new Date()
        },
        {
          id: 'laval',
          name: 'Laval Housing Market',
          description: 'Residential housing trends and demographics for Laval',
          layers: Object.keys(config.layers).filter(id => 
            config.layers[id].group === 'housing-group' || 
            config.layers[id].group === 'demographics-group'
          ),
          lastUsed: new Date()
        },
        {
          id: 'gatineau',
          name: 'Gatineau Housing Market', 
          description: 'Housing affordability and market analysis for Gatineau',
          layers: Object.keys(config.layers).filter(id => 
            config.layers[id].group === 'housing-group' || 
            config.layers[id].group === 'income-group'
          ),
          lastUsed: new Date()
        }
      ];
      
      setBookmarks(defaultBookmarks);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultBookmarks));
    }
  }, [config.layers]);

  const handleAddBookmark = () => {
    setEditingBookmark(null);
    setFormData({
      name: '',
      description: '',
      layers: Object.keys(config.layers).filter(id => config.layers[id].visible)
    });
    setIsDialogOpen(true);
  };

  const handleEditBookmark = (bookmark: LayerBookmark) => {
    setEditingBookmark(bookmark);
    setFormData({
      name: bookmark.name,
      description: bookmark.description || '',
      layers: bookmark.layers
    });
    setIsDialogOpen(true);
  };

  const handleDeleteBookmark = (bookmarkId: string) => {
    const updatedBookmarks = bookmarks.filter(b => b.id !== bookmarkId);
    setBookmarks(updatedBookmarks);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedBookmarks));
  };

  const handleSaveBookmark = () => {
    const newBookmark: LayerBookmark = {
      id: editingBookmark?.id || Date.now().toString(),
      name: formData.name,
      description: formData.description,
      layers: formData.layers,
      lastUsed: new Date()
    };

    const updatedBookmarks = editingBookmark
      ? bookmarks.map(b => b.id === editingBookmark.id ? newBookmark : b)
      : [...bookmarks, newBookmark];

    setBookmarks(updatedBookmarks);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedBookmarks));
    setIsDialogOpen(false);
  };

  const handleBookmarkSelect = (bookmark: LayerBookmark) => {
    // Update layer visibility based on bookmark
    const newStates = { ...config.layers };
    Object.keys(newStates).forEach(layerId => {
      newStates[layerId].visible = bookmark.layers.includes(layerId);
    });
    onLayerStatesChange(newStates);

    // Update last used timestamp
    const updatedBookmarks = bookmarks.map(b => 
      b.id === bookmark.id ? { ...b, lastUsed: new Date() } : b
    );
    setBookmarks(updatedBookmarks);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedBookmarks));
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 360, bgcolor: 'background.paper' }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6">Layer Bookmarks</Typography>
        <Tooltip title="Add Bookmark">
          <IconButton onClick={handleAddBookmark} size="small">
            <AddIcon />
          </IconButton>
        </Tooltip>
      </Box>
      <Divider />
      <List>
        {bookmarks.map(bookmark => (
          <ListItem
            key={bookmark.id}
            component="div"
            onClick={() => handleBookmarkSelect(bookmark)}
            sx={{
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: 'action.hover'
              }
            }}
          >
            <ListItemText
              primary={bookmark.name}
              secondary={
                <>
                  {bookmark.description && (
                    <Typography variant="body2" color="text.secondary">
                      {bookmark.description}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {bookmark.layers.length} layers • Last used: {new Date(bookmark.lastUsed).toLocaleString()}
                  </Typography>
                </>
              }
            />
            <ListItemSecondaryAction>
              <IconButton
                edge="end"
                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.stopPropagation();
                  handleEditBookmark(bookmark);
                }}
                size="small"
              >
                <EditIcon />
              </IconButton>
              <IconButton
                edge="end"
                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.stopPropagation();
                  handleDeleteBookmark(bookmark.id);
                }}
                size="small"
              >
                <DeleteIcon />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        ))}
      </List>

      <Dialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)}>
        <DialogTitle>
          {editingBookmark ? 'Edit Bookmark' : 'Add Bookmark'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Name"
            fullWidth
            value={formData.name}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData((prev: any) => ({ ...prev, name: e.target.value }))}
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            multiline
            rows={4}
            value={formData.description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData((prev: any) => ({ ...prev, description: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveBookmark} variant="contained" startIcon={<SaveIcon />}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}; 