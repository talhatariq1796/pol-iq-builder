import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from "@/components/ui/select";

interface ChartCustomizerProps {
  isOpen: boolean;
  onClose: () => void;
  chartType: string;
  config: ChartConfig;
  onConfigChange: (config: ChartConfig) => void;
}

import type { ChartConfig } from '@/types/reports';

const CHART_TYPES = ['bar', 'line', 'pie', 'donut'];
const COLOR_PRESETS = [
  ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'],
  ['#16a34a', '#22c55e', '#4ade80', '#86efac', '#bbf7d0'],
  ['#9333ea', '#a855f7', '#c084fc', '#d8b4fe', '#e9d5ff'],
];

export const ChartCustomizer: React.FC<ChartCustomizerProps> = ({
  isOpen,
  onClose,
  chartType,
  config,
  onConfigChange,
}) => {
  const handleColorChange = (index: number, color: string) => {
    const newColors = [...config.colors];
    newColors[index] = color;
    onConfigChange({ ...config, colors: newColors });
  };

  const handlePresetSelect = (preset: string[]) => {
    onConfigChange({ ...config, colors: [...preset] });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-white">
        <DialogHeader>
          <DialogTitle>Customize Chart</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Chart Type</Label>
            <Select
              value={config.type}
              onValueChange={(value) => 
                onConfigChange({ ...config, type: value as ChartConfig['type'] })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select chart type" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                {CHART_TYPES.map(type => (
                  <SelectItem key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Color Scheme</Label>
            <div className="grid grid-cols-3 gap-2">
              {COLOR_PRESETS.map((preset, i) => (
                <Button
                  key={i}
                  variant="outline"
                  className="h-8 p-1"
                  onClick={() => handlePresetSelect(preset)}
                >
                  <div className="flex w-full h-full">
                    {preset.map((color, j) => (
                      <div
                        key={j}
                        className="flex-1 h-full"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Custom Colors</Label>
            <div className="grid grid-cols-5 gap-2">
              {config.colors.map((color, i) => (
                <Input
                  key={i}
                  type="color"
                  value={color}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleColorChange(i, e.target.value)}
                  className="h-8 p-1"
                />
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="showLegend"
              checked={config.showLegend}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                onConfigChange({ ...config, showLegend: e.target.checked })
              }
            />
            <Label htmlFor="showLegend">Show Legend</Label>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};