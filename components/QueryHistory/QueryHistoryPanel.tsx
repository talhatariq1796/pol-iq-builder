import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Tooltip,
  Divider,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  Chip,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button
} from '@mui/material';
import {
  Star,
  StarBorder,
  Delete,
  Refresh,
  Search,
  MoreVert,
  History,
  Favorite
} from '@mui/icons-material';
import { QueryHistoryManager, QueryHistoryItem } from '@/utils/query-history';
import { LayerConfig } from '@/types/layers';
import { format } from 'date-fns';

interface QueryHistoryPanelProps {
  layers: LayerConfig[];
  onQuerySelect: (query: QueryHistoryItem) => void;
}

type TabValue = 'all' | 'favorites' | 'recent';

export const QueryHistoryPanel: React.FC<QueryHistoryPanelProps> = ({
  layers,
  onQuerySelect
}) => {
  const [currentTab, setCurrentTab] = useState<TabValue>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [queries, setQueries] = useState<QueryHistoryItem[]>([]);
  const [selectedQuery, setSelectedQuery] = useState<QueryHistoryItem | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const queryHistoryManager = QueryHistoryManager.getInstance();

  const loadQueries = useCallback(() => {
    let filteredQueries: QueryHistoryItem[];
    
    if (searchTerm) {
      filteredQueries = queryHistoryManager.searchQueries(searchTerm);
    } else {
      switch (currentTab) {
        case 'favorites':
          filteredQueries = queryHistoryManager.getFavorites();
          break;
        case 'recent':
          filteredQueries = queryHistoryManager.getRecentQueries(10);
          break;
        default:
          filteredQueries = queryHistoryManager.getAllQueries();
      }
    }
    
    setQueries(filteredQueries);
  }, [currentTab, searchTerm, queryHistoryManager]);

  useEffect(() => {
    loadQueries();
  }, [loadQueries]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: TabValue) => {
    setCurrentTab(newValue);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleQueryClick = (query: QueryHistoryItem) => {
    onQuerySelect(query);
  };

  const handleFavoriteToggle = (query: QueryHistoryItem) => {
    queryHistoryManager.toggleFavorite(query.id);
    loadQueries();
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, query: QueryHistoryItem) => {
    setSelectedQuery(query);
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedQuery(null);
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const handleDeleteConfirm = () => {
    if (selectedQuery) {
      queryHistoryManager.deleteQuery(selectedQuery.id);
      loadQueries();
    }
    setDeleteDialogOpen(false);
  };

  const getLayerNames = (layerIds: string[]): string[] => {
    return layerIds.map(id => layers.find(l => l.id === id)?.name || id);
  };

  return (
    <Paper sx={{ p: 2, maxWidth: 400 }}>
      <Typography variant="h6" gutterBottom>
        Query History
      </Typography>

      <Tabs
        value={currentTab}
        onChange={handleTabChange}
        sx={{ mb: 2 }}
      >
        <Tab value="all" label="All" />
        <Tab value="favorites" label="Favorites" />
        <Tab value="recent" label="Recent" />
      </Tabs>

      <TextField
        fullWidth
        size="small"
        placeholder="Search queries..."
        value={searchTerm}
        onChange={handleSearchChange}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search />
            </InputAdornment>
          ),
        }}
        sx={{ mb: 2 }}
      />

      <List>
        {queries.map((query) => (
          <React.Fragment key={query.id}>
            <ListItem
              component="div"
              onClick={() => handleQueryClick(query)}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                py: 1,
                cursor: 'pointer'
              }}
            >
              <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle2">
                  {query.name}
                </Typography>
                <Box>
                  <IconButton
                    size="small"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      handleFavoriteToggle(query);
                    }}
                  >
                    {query.isFavorite ? <Star color="primary" /> : <StarBorder />}
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={(e: React.MouseEvent<HTMLElement>) => {
                      e.stopPropagation();
                      handleMenuOpen(e, query);
                    }}
                  >
                    <MoreVert />
                  </IconButton>
                </Box>
              </Box>
              
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {format(new Date(query.timestamp), 'MMM d, yyyy HH:mm')}
              </Typography>
              
              <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                <Chip
                  size="small"
                  label={query.type}
                  color="primary"
                  variant="outlined"
                />
                {getLayerNames(query.layers).map((name) => (
                  <Chip
                    key={name}
                    size="small"
                    label={name}
                    variant="outlined"
                  />
                ))}
              </Box>
            </ListItem>
            <Divider />
          </React.Fragment>
        ))}
      </List>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleDeleteClick}>
          <Delete fontSize="small" sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Query</DialogTitle>
        <DialogContent>
          Are you sure you want to delete this query?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}; 