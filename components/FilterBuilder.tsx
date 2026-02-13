import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Select,
  MenuItem,
  TextField,
  Button,
  IconButton,
  Box,
  Chip,
  FormControl,
  InputLabel,
  SelectChangeEvent
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import { FilterOperator, FilterCondition, FilterPreset } from '../types/filter';

interface FilterBuilderProps {
  fields: Array<{ name: string; type: string }>;
  onFilterChange: (conditions: FilterCondition[]) => void;
  onSavePreset?: (preset: FilterPreset) => void;
  presets?: FilterPreset[];
  onLoadPreset?: (preset: FilterPreset) => void;
}

export const FilterBuilder: React.FC<FilterBuilderProps> = ({
  fields,
  onFilterChange,
  onSavePreset,
  presets = [],
  onLoadPreset
}) => {
  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const [presetName, setPresetName] = useState('');

  const operators: FilterOperator[] = [
    'equals',
    'notEquals',
    'greaterThan',
    'lessThan',
    'greaterThanOrEqual',
    'lessThanOrEqual',
    'contains',
    'notContains',
    'startsWith',
    'endsWith',
    'isNull',
    'isNotNull',
    'between',
    'in',
    'notIn'
  ];

  const addCondition = () => {
    setConditions([
      ...conditions,
      { field: '', operator: 'equals', value: '' }
    ]);
  };

  const removeCondition = (index: number) => {
    const newConditions = conditions.filter((_, i) => i !== index);
    setConditions(newConditions);
    onFilterChange(newConditions);
  };

  const updateCondition = (index: number, updates: Partial<FilterCondition>) => {
    const newConditions = conditions.map((condition, i) =>
      i === index ? { ...condition, ...updates } : condition
    );
    setConditions(newConditions);
    onFilterChange(newConditions);
  };

  const handleSavePreset = () => {
    if (presetName && onSavePreset) {
      onSavePreset({
        name: presetName,
        conditions: [...conditions]
      });
      setPresetName('');
    }
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Filter Builder
        </Typography>

        {/* Presets Section */}
        {presets.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Saved Presets
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {presets.map((preset) => (
                <Chip
                  key={preset.name}
                  label={preset.name}
                  onClick={() => onLoadPreset?.(preset)}
                  onDelete={() => {/* Add delete handler */}}
                />
              ))}
            </Box>
          </Box>
        )}

        {/* Conditions */}
        {conditions.map((condition, index) => (
          <Box key={index} sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Field</InputLabel>
              <Select
                value={condition.field}
                label="Field"
                onChange={(e: SelectChangeEvent) =>
                  updateCondition(index, { field: e.target.value })
                }
              >
                {fields.map((field) => (
                  <MenuItem key={field.name} value={field.name}>
                    {field.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Operator</InputLabel>
              <Select
                value={condition.operator}
                label="Operator"
                onChange={(e: SelectChangeEvent) =>
                  updateCondition(index, { operator: e.target.value as FilterOperator })
                }
              >
                {operators.map((op) => (
                  <MenuItem key={op} value={op}>
                    {op.replace(/([A-Z])/g, ' $1').trim()}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {!['isNull', 'isNotNull'].includes(condition.operator) && (
              <TextField
                size="small"
                value={condition.value}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  updateCondition(index, { value: e.target.value })
                }
                placeholder="Value"
                sx={{ flexGrow: 1 }}
              />
            )}

            <IconButton
              size="small"
              onClick={() => removeCondition(index)}
              color="error"
            >
              <DeleteIcon />
            </IconButton>
          </Box>
        ))}

        {/* Add Condition Button */}
        <Button
          startIcon={<AddIcon />}
          onClick={addCondition}
          variant="outlined"
          size="small"
          sx={{ mr: 1 }}
        >
          Add Condition
        </Button>

        {/* Save Preset */}
        {onSavePreset && (
          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            <TextField
              size="small"
              value={presetName}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPresetName(e.target.value)}
              placeholder="Preset name"
            />
            <Button
              startIcon={<SaveIcon />}
              onClick={handleSavePreset}
              variant="outlined"
              size="small"
              disabled={!presetName || conditions.length === 0}
            >
              Save Preset
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}; 