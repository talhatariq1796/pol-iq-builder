import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Box,
  Tooltip,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DownloadIcon from '@mui/icons-material/Download';
import ClearIcon from '@mui/icons-material/Clear';
import { LocalGeospatialFeature } from '../types/geospatial';

interface FeatureSelectionProps {
  selectedFeatures: LocalGeospatialFeature[];
  onSelectionChange: (features: LocalGeospatialFeature[]) => void;
  onExport?: (features: LocalGeospatialFeature[], format: 'csv' | 'geojson' | 'shapefile') => void;
}

export const FeatureSelection: React.FC<FeatureSelectionProps> = ({
  selectedFeatures,
  onSelectionChange,
  onExport
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'geojson' | 'shapefile'>('csv');
  const [exportFileName, setExportFileName] = useState('');

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleExport = () => {
    if (onExport) {
      onExport(selectedFeatures, exportFormat);
      setExportDialogOpen(false);
    }
  };

  const removeFeature = (feature: LocalGeospatialFeature) => {
    onSelectionChange(selectedFeatures.filter(f => f !== feature));
  };

  const clearSelection = () => {
    onSelectionChange([]);
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            Selected Features ({selectedFeatures.length})
          </Typography>
          <Box>
            <Tooltip title="Export">
              <IconButton onClick={() => setExportDialogOpen(true)}>
                <DownloadIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="More options">
              <IconButton onClick={handleMenuClick}>
                <MoreVertIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <List>
          {selectedFeatures.map((feature, index) => (
            <ListItem key={index}>
              <ListItemText
                primary={feature.properties?.name || `Feature ${index + 1}`}
                secondary={Object.entries(feature.properties || {})
                  .filter(([key]) => key !== 'name')
                  .map(([key, value]) => `${key}: ${value}`)
                  .join(', ')}
              />
              <ListItemSecondaryAction>
                <IconButton
                  edge="end"
                  aria-label="remove"
                  onClick={() => removeFeature(feature)}
                >
                  <ClearIcon />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>

        {selectedFeatures.length > 0 && (
          <Button
            variant="outlined"
            color="error"
            onClick={clearSelection}
            fullWidth
            sx={{ mt: 2 }}
          >
            Clear Selection
          </Button>
        )}

        {/* Export Dialog */}
        <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)}>
          <DialogTitle>Export Features</DialogTitle>
          <DialogContent>
            <TextField
              select
              label="Format"
              value={exportFormat}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExportFormat(e.target.value as any)}
              fullWidth
              sx={{ mb: 2, mt: 1 }}
            >
              <MenuItem value="csv">CSV</MenuItem>
              <MenuItem value="geojson">GeoJSON</MenuItem>
              <MenuItem value="shapefile">Shapefile</MenuItem>
            </TextField>
            <TextField
              label="File Name"
              value={exportFileName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExportFileName(e.target.value)}
              fullWidth
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setExportDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleExport} variant="contained">
              Export
            </Button>
          </DialogActions>
        </Dialog>

        {/* More Options Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={() => {
            setExportDialogOpen(true);
            handleMenuClose();
          }}>
            Export Selection
          </MenuItem>
          <MenuItem onClick={() => {
            clearSelection();
            handleMenuClose();
          }}>
            Clear Selection
          </MenuItem>
        </Menu>
      </CardContent>
    </Card>
  );
}; 