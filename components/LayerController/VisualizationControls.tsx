import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import type { BlendMode } from '@/utils/visualizations/base-visualization';

interface VisualizationControlsProps {
  layer: __esri.FeatureLayer;
  opacity: number;
  blendMode: BlendMode;
  onOpacityChange: (opacity: number) => void;
  onBlendModeChange: (mode: BlendMode) => void;
  showBlendMode?: boolean;
}

const blendModes: { value: BlendMode; label: string; description: string }[] = [
  { value: 'normal', label: 'Normal', description: 'Standard layer blending' },
  { value: 'multiply', label: 'Multiply', description: 'Darkens the base layer' },
  { value: 'screen', label: 'Screen', description: 'Lightens the base layer' },
  { value: 'overlay', label: 'Overlay', description: 'Combines multiply and screen effects' },
  { value: 'darken', label: 'Darken', description: 'Shows darker colors' },
  { value: 'lighten', label: 'Lighten', description: 'Shows lighter colors' },
  { value: 'color-dodge', label: 'Color Dodge', description: 'Brightens the base layer' },
  { value: 'color-burn', label: 'Color Burn', description: 'Darkens the base layer' },
  { value: 'hard-light', label: 'Hard Light', description: 'Strong contrast effect' },
  { value: 'soft-light', label: 'Soft Light', description: 'Subtle contrast effect' },
  { value: 'difference', label: 'Difference', description: 'Shows absolute difference' },
  { value: 'exclusion', label: 'Exclusion', description: 'Similar to difference but softer' }
];

export const VisualizationControls: React.FC<VisualizationControlsProps> = ({
  layer,
  opacity,
  blendMode,
  onOpacityChange,
  onBlendModeChange,
  showBlendMode = true
}) => {
  return (
    <Card className="w-full">
      <CardContent className="p-4 space-y-4">
        {/* Opacity Control */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="opacity">Opacity</Label>
            <span className="text-sm text-gray-500">{Math.round(opacity * 100)}%</span>
          </div>
          <Slider
            id="opacity"
            min={0}
            max={1}
            step={0.01}
            value={opacity}
            onValueChange={(value: number[]) => onOpacityChange(value[0])}
            className="w-full"
          />
        </div>

        {/* Blend Mode Control */}
        {showBlendMode && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="blend-mode">Blend Mode</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-gray-400" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Choose how this layer blends with layers below it</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Select value={blendMode} onValueChange={(value) => onBlendModeChange(value as BlendMode)}>
              <SelectTrigger id="blend-mode" className="w-full">
                <SelectValue placeholder="Select blend mode" />
              </SelectTrigger>
              <SelectContent>
                {blendModes.map((mode) => (
                  <SelectItem key={mode.value} value={mode.value}>
                    <div className="flex flex-col">
                      <span>{mode.label}</span>
                      <span className="text-xs text-gray-500">{mode.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
    </Card>
  );
}; 