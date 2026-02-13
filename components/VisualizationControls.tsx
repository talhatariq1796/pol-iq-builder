import React from 'react';
import { Card, CardContent, Typography, Slider, Select, MenuItem, FormControl, InputLabel } from '@mui/material';

interface VisualizationControlsProps {
  opacity: number;
  blendMode: GlobalCompositeOperation;
  onOpacityChange: (opacity: number) => void;
  onBlendModeChange: (blendMode: GlobalCompositeOperation) => void;
}

export const VisualizationControls: React.FC<VisualizationControlsProps> = ({
  opacity,
  blendMode,
  onOpacityChange,
  onBlendModeChange
}) => {
  const blendModes: GlobalCompositeOperation[] = [
    'source-over',
    'multiply',
    'screen',
    'overlay',
    'darken',
    'lighten',
    'color-dodge',
    'color-burn',
    'hard-light',
    'soft-light',
    'difference',
    'exclusion'
  ];

  return (
    <div>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Opacity
      </Typography>
      <Slider
        size="small"
        value={opacity}
        min={0}
        max={1}
        step={0.1}
        onChange={(_, value) => onOpacityChange(value as number)}
        aria-label="Layer opacity"
      />

      <FormControl fullWidth size="small" sx={{ mt: 2 }}>
        <InputLabel>Blend Mode</InputLabel>
        <Select
          value={blendMode}
          label="Blend Mode"
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onBlendModeChange(e.target.value as GlobalCompositeOperation)}
        >
          {blendModes.map((mode) => (
            <MenuItem key={mode} value={mode}>
              {mode.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </div>
  );
}; 