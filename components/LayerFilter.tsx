import React, { useState, useMemo } from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  Chip,
  Stack,
  Typography,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { ProjectLayerConfig, LayerConfig, LayerGroup } from '../types/layers';

export interface LayerFilterProps {
  config: ProjectLayerConfig;
  onFilterChange: (filteredLayers: Record<string, LayerConfig>) => void;
  onGroupFilterChange: (filteredGroups: LayerGroup[]) => void;
}

export const LayerFilter: React.FC<LayerFilterProps> = ({
  config,
  onFilterChange,
  onGroupFilterChange
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showMetadata, setShowMetadata] = useState(false);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    Object.values(config.layers).forEach(layer => {
      layer.metadata?.tags?.forEach((tag: string) => tags.add(tag));
    });
    return Array.from(tags);
  }, [config.layers]);

  const filteredLayers = useMemo(() => {
    return Object.entries(config.layers).reduce((acc, [id, layer]) => {
      const matchesSearch = layer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        layer.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTags = selectedTags.length === 0 ||
        selectedTags.every(tag => layer.metadata?.tags?.includes(tag));
      
      if (matchesSearch && matchesTags) {
        acc[id] = layer;
      }
      return acc;
    }, {} as Record<string, LayerConfig>);
  }, [config.layers, searchTerm, selectedTags]);

  const filteredGroups = useMemo(() => {
    return config.groups.filter(group => {
      const hasVisibleLayers = group.layers?.some(layer => 
        Object.keys(filteredLayers).includes(layer.id)
      ) ?? false;
      return hasVisibleLayers;
    });
  }, [config.groups, filteredLayers]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleTagClick = (tag: string) => {
    setSelectedTags((prev: string[]) => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedTags([]);
  };

  React.useEffect(() => {
    onFilterChange(filteredLayers);
    onGroupFilterChange(filteredGroups);
  }, [filteredLayers, filteredGroups, onFilterChange, onGroupFilterChange]);

  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search layers..."
            value={searchTerm}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />,
              endAdornment: searchTerm && (
                <IconButton size="small" onClick={handleClearFilters}>
                  <ClearIcon />
                </IconButton>
              )
            }}
          />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FilterListIcon color="action" />
          <Typography variant="subtitle2" color="text.secondary">
            Filter by tags:
          </Typography>
          <Tooltip title="Toggle metadata view">
            <IconButton 
              size="small" 
              onClick={() => setShowMetadata(!showMetadata)}
              color={showMetadata ? 'primary' : 'default'}
            >
              <InfoIcon />
            </IconButton>
          </Tooltip>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {allTags.map(tag => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              onClick={() => handleTagClick(tag)}
              color={selectedTags.includes(tag) ? 'primary' : 'default'}
              variant={selectedTags.includes(tag) ? 'filled' : 'outlined'}
            />
          ))}
        </Box>

        {showMetadata && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Layer Metadata
            </Typography>
            <Stack spacing={1}>
              {Object.values(filteredLayers).map(layer => (
                <Box key={layer.id} sx={{ p: 1, bgcolor: 'background.paper', borderRadius: 1 }}>
                  <Typography variant="subtitle2">{layer.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Provider: {layer.metadata?.provider}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Update Frequency: {layer.metadata?.updateFrequency}
                  </Typography>
                  {layer.metadata?.lastUpdate && (
                    <Typography variant="body2" color="text.secondary">
                      Last Update: {new Date(layer.metadata.lastUpdate).toLocaleDateString()}
                    </Typography>
                  )}
                </Box>
              ))}
            </Stack>
          </Box>
        )}
      </Stack>
    </Box>
  );
}; 