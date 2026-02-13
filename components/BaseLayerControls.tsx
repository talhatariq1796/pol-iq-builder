import React from 'react';
import { Slider } from '@mui/material';
import { Card, CardContent, Typography } from '@mui/material';

interface BaseLayerControlsProps {
  layer: __esri.FeatureLayer;
  onOpacityChange: (opacity: number) => void;
}

export const BaseLayerControls: React.FC<BaseLayerControlsProps> = ({ layer, onOpacityChange }) => {
  const handleOpacityChange = (_: Event, value: number | number[]) => {
    const opacity = value as number;
    layer.opacity = opacity;
    onOpacityChange(opacity);
  };

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="subtitle2" gutterBottom>
          {layer.title || 'Base Layer'} Controls
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Opacity
        </Typography>
        <Slider
          size="small"
          defaultValue={layer.opacity}
          min={0}
          max={1}
          step={0.1}
          onChange={handleOpacityChange}
          aria-label="Layer opacity"
        />
      </CardContent>
    </Card>
  );
}; 