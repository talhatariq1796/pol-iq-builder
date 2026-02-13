/**
 * Visualization Tab Component
 * 
 * Provides comprehensive visualization customization options including color schemes,
 * symbol sizing, opacity controls, labeling, and legend positioning.
 */

import React, { useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { 
  Eye,
  Palette,
  Circle,
  Tag,
  Map,
  Settings,
  RotateCcw,
  Info,
  Layers,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight
} from 'lucide-react';

import { FilterTabProps, VisualizationConfig } from '../types';
import { fieldDiscoveryService } from '../services/FieldDiscoveryService';

// ============================================================================
// COLOR SCHEME DEFINITIONS
// ============================================================================

interface ColorScheme {
  id: string;
  name: string;
  description: string;
  colors: string[];
  type: 'sequential' | 'diverging' | 'categorical';
  preview: string; // CSS gradient for preview
}

const COLOR_SCHEMES: ColorScheme[] = [
  {
    id: 'viridis',
    name: 'Viridis',
    description: 'Perceptually uniform, colorblind-friendly',
    colors: ['#440154', '#31688e', '#35b779', '#fde725'],
    type: 'sequential',
    preview: 'linear-gradient(90deg, #440154, #31688e, #35b779, #fde725)',
  },
  {
    id: 'plasma',
    name: 'Plasma',
    description: 'High contrast, vibrant colors',
    colors: ['#0d0887', '#7e03a8', '#cc4678', '#f89441', '#f0f921'],
    type: 'sequential',
    preview: 'linear-gradient(90deg, #0d0887, #7e03a8, #cc4678, #f89441, #f0f921)',
  },
  {
    id: 'cividis',
    name: 'Cividis',
    description: 'Colorblind-friendly, blue to yellow',
    colors: ['#00224e', '#123570', '#3b496c', '#575d6d', '#707173', '#8a8678', '#a69c75', '#c4b56c', '#e1ce55', '#ffea46'],
    type: 'sequential',
    preview: 'linear-gradient(90deg, #00224e, #575d6d, #a69c75, #ffea46)',
  },
  {
    id: 'cool-warm',
    name: 'Cool-Warm',
    description: 'Blue to red diverging scale',
    colors: ['#3b4cc0', '#6788ee', '#9bb8ff', '#c9d7f0', '#edddd9', '#f4a582', '#e26952', '#b40426'],
    type: 'diverging',
    preview: 'linear-gradient(90deg, #3b4cc0, #9bb8ff, #edddd9, #e26952, #b40426)',
  },
  {
    id: 'spectral',
    name: 'Spectral',
    description: 'Full spectrum rainbow colors',
    colors: ['#d53e4f', '#f46d43', '#fdae61', '#fee08b', '#e6f598', '#abdda4', '#66c2a5', '#3288bd'],
    type: 'diverging',
    preview: 'linear-gradient(90deg, #d53e4f, #fdae61, #e6f598, #66c2a5, #3288bd)',
  },
  {
    id: 'category10',
    name: 'Category 10',
    description: '10 distinct colors for categories',
    colors: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'],
    type: 'categorical',
    preview: 'linear-gradient(90deg, #1f77b4, #ff7f0e, #2ca02c, #d62728, #9467bd)',
  },
  {
    id: 'pastel',
    name: 'Pastel',
    description: 'Soft, muted colors',
    colors: ['#fbb4ae', '#b3cde3', '#ccebc5', '#decbe4', '#fed9a6', '#ffffcc', '#e5d8bd', '#fddaec'],
    type: 'categorical',
    preview: 'linear-gradient(90deg, #fbb4ae, #b3cde3, #ccebc5, #decbe4, #fed9a6)',
  },
  {
    id: 'dark2',
    name: 'Dark',
    description: 'High contrast dark colors',
    colors: ['#1b9e77', '#d95f02', '#7570b3', '#e7298a', '#66a61e', '#e6ab02', '#a6761d', '#666666'],
    type: 'categorical',
    preview: 'linear-gradient(90deg, #1b9e77, #d95f02, #7570b3, #e7298a, #66a61e)',
  },
];

// ============================================================================
// LEGEND POSITION OPTIONS
// ============================================================================

const LEGEND_POSITIONS = [
  { value: 'top', label: 'Top', icon: AlignCenter },
  { value: 'bottom', label: 'Bottom', icon: AlignCenter },
  { value: 'left', label: 'Left', icon: AlignLeft },
  { value: 'right', label: 'Right', icon: AlignRight },
] as const;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function VisualizationTab({
  config,
  onConfigChange,
  availableFields,
  endpoint,
}: FilterTabProps) {
  
  // This project uses a custom accordion that only allows one item open at a time
  // So we don't need to manage multiple selected items

  // Get available fields for labeling and sizing options
  const fields = useMemo(() => {
    if (endpoint && fieldDiscoveryService.supportsEndpoint(endpoint)) {
      return fieldDiscoveryService.getFieldsForEndpoint(endpoint);
    }
    return availableFields || fieldDiscoveryService.getCommonFields();
  }, [endpoint, availableFields]);

  // Get numeric fields for symbol sizing
  const numericFields = useMemo(() => {
    return fields.filter(field => field.type === 'numeric');
  }, [fields]);

  // Get all fields suitable for labeling (text and short categorical)
  const labelFields = useMemo(() => {
    return fields.filter(field => 
      field.type === 'text' || 
      (field.type === 'categorical' && (!field.categories || field.categories.length <= 50))
    );
  }, [fields]);

  // Handle visualization config changes
  const handleVisualizationChange = useCallback((changes: Partial<VisualizationConfig>) => {
    onConfigChange({
      ...config,
      visualization: {
        ...config.visualization,
        ...changes,
      },
    });
  }, [config, onConfigChange]);

  // Reset visualization config to defaults
  const handleReset = useCallback(() => {
    const defaultConfig: VisualizationConfig = {
      colorScheme: 'viridis',
      symbolSize: {
        enabled: false,
        min: 4,
        max: 20,
      },
      opacity: {
        enabled: false,
        value: 0.8,
      },
      labels: {
        enabled: false,
      },
      legend: {
        enabled: true,
        position: 'bottom',
      },
    };

    handleVisualizationChange(defaultConfig);
  }, [handleVisualizationChange]);

  // Calculate active customizations count
  const activeCustomizations = useMemo(() => {
    let count = 0;
    if (config.visualization.colorScheme !== 'viridis') count++;
    if (config.visualization.symbolSize.enabled) count++;
    if (config.visualization.opacity.enabled) count++;
    if (config.visualization.labels.enabled) count++;
    if (!config.visualization.legend.enabled || config.visualization.legend.position !== 'bottom') count++;
    return count;
  }, [config.visualization]);

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Header with stats and controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            <span className="font-medium">Visualization Options</span>
            {activeCustomizations > 0 && (
              <Badge variant="secondary">
                {activeCustomizations} active
              </Badge>
            )}
          </div>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="text-xs"
          disabled={activeCustomizations === 0}
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          Reset
        </Button>
      </div>

      <Separator />

      {/* Visualization Options */}
      <div className="flex-1 overflow-y-auto">
        <Accordion className="space-y-2">
          
          {/* Color Schemes Section */}
          <AccordionItem value="colors">
            <AccordionTrigger className="py-3">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                <span>Color Schemes</span>
                {config.visualization.colorScheme !== 'viridis' && (
                  <Badge variant="outline" className="text-xs">
                    Custom
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-1 gap-3">
                  {COLOR_SCHEMES.map((scheme) => (
                    <Card
                      key={scheme.id}
                      className={`cursor-pointer transition-all duration-200 ${
                        config.visualization.colorScheme === scheme.id
                          ? 'ring-2 ring-primary border-primary'
                          : 'hover:border-primary/50'
                      }`}
                      onClick={() => handleVisualizationChange({ colorScheme: scheme.id })}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-12 h-6 rounded border"
                            style={{ background: scheme.preview }}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{scheme.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {scheme.type}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {scheme.description}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Symbol Size Section */}
          <AccordionItem value="symbols">
            <AccordionTrigger className="py-3">
              <div className="flex items-center gap-2">
                <Circle className="h-4 w-4" />
                <span>Symbol Size</span>
                {config.visualization.symbolSize.enabled && (
                  <Badge variant="secondary" className="text-xs">
                    Enabled
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="symbol-size-enabled" className="text-sm font-medium">
                    Enable Variable Symbol Size
                  </Label>
                  <Switch
                    id="symbol-size-enabled"
                    checked={config.visualization.symbolSize.enabled}
                    onCheckedChange={(enabled: boolean) =>
                      handleVisualizationChange({
                        symbolSize: { ...config.visualization.symbolSize, enabled }
                      })
                    }
                  />
                </div>

                {config.visualization.symbolSize.enabled && (
                  <div className="space-y-3 ml-4 border-l-2 border-muted pl-4">
                    <div className="space-y-2">
                      <Label className="text-sm">Size Range</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Min Size</Label>
                          <div className="mt-1">
                            <Slider
                              value={config.visualization.symbolSize.min}
                              onValueChange={(value: number[]) =>
                                handleVisualizationChange({
                                  symbolSize: { ...config.visualization.symbolSize, min: value[0] }
                                })
                              }
                              min={2}
                              max={10}
                              step={1}
                              className="w-full"
                            />
                            <div className="text-xs text-center mt-1">
                              {config.visualization.symbolSize.min}px
                            </div>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Max Size</Label>
                          <div className="mt-1">
                            <Slider
                              value={config.visualization.symbolSize.max}
                              onValueChange={(value: number[]) =>
                                handleVisualizationChange({
                                  symbolSize: { ...config.visualization.symbolSize, max: value[0] }
                                })
                              }
                              min={15}
                              max={50}
                              step={1}
                              className="w-full"
                            />
                            <div className="text-xs text-center mt-1">
                              {config.visualization.symbolSize.max}px
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {numericFields.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm">Size Field</Label>
                        <Select
                          value={config.visualization.symbolSize.field || ''}
                          onValueChange={(field) =>
                            handleVisualizationChange({
                              symbolSize: { ...config.visualization.symbolSize, field }
                            })
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Select field for sizing..." />
                          </SelectTrigger>
                          <SelectContent>
                            {numericFields.map((field) => (
                              <SelectItem key={field.name} value={field.name}>
                                <div className="flex items-center gap-2">
                                  <Circle className="h-3 w-3" />
                                  <span>{field.displayName}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Opacity Section */}
          <AccordionItem value="opacity">
            <AccordionTrigger className="py-3">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4" />
                <span>Opacity & Transparency</span>
                {config.visualization.opacity.enabled && (
                  <Badge variant="secondary" className="text-xs">
                    {Math.round(config.visualization.opacity.value * 100)}%
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="opacity-enabled" className="text-sm font-medium">
                    Enable Custom Opacity
                  </Label>
                  <Switch
                    id="opacity-enabled"
                    checked={config.visualization.opacity.enabled}
                    onCheckedChange={(enabled: boolean) =>
                      handleVisualizationChange({
                        opacity: { ...config.visualization.opacity, enabled }
                      })
                    }
                  />
                </div>

                {config.visualization.opacity.enabled && (
                  <div className="space-y-3 ml-4 border-l-2 border-muted pl-4">
                    <div className="space-y-2">
                      <Label className="text-sm">Opacity Level</Label>
                      <div className="px-2">
                        <Slider
                          value={config.visualization.opacity.value}
                          onValueChange={(value: number[]) =>
                            handleVisualizationChange({
                              opacity: { ...config.visualization.opacity, value: value[0] }
                            })
                          }
                          min={0.1}
                          max={1.0}
                          step={0.05}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground mt-2">
                          <span>Transparent</span>
                          <span className="font-medium">
                            {Math.round(config.visualization.opacity.value * 100)}%
                          </span>
                          <span>Opaque</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Labels Section */}
          <AccordionItem value="labels">
            <AccordionTrigger className="py-3">
              <div className="flex items-center gap-2">
                <Type className="h-4 w-4" />
                <span>Labels</span>
                {config.visualization.labels.enabled && (
                  <Badge variant="secondary" className="text-xs">
                    Enabled
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="labels-enabled" className="text-sm font-medium">
                    Show Labels on Map
                  </Label>
                  <Switch
                    id="labels-enabled"
                    checked={config.visualization.labels.enabled}
                    onCheckedChange={(enabled: boolean) =>
                      handleVisualizationChange({
                        labels: { ...config.visualization.labels, enabled }
                      })
                    }
                  />
                </div>

                {config.visualization.labels.enabled && (
                  <div className="space-y-3 ml-4 border-l-2 border-muted pl-4">
                    {labelFields.length > 0 ? (
                      <div className="space-y-2">
                        <Label className="text-sm">Label Field</Label>
                        <Select
                          value={config.visualization.labels.field || ''}
                          onValueChange={(field) =>
                            handleVisualizationChange({
                              labels: { ...config.visualization.labels, field }
                            })
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Select field for labels..." />
                          </SelectTrigger>
                          <SelectContent>
                            {labelFields.map((field) => (
                              <SelectItem key={field.name} value={field.name}>
                                <div className="flex items-center gap-2">
                                  <Tag className="h-3 w-3" />
                                  <span>{field.displayName}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {field.type}
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                        <Info className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          No suitable fields found for labeling in this endpoint
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Legend Section */}
          <AccordionItem value="legend">
            <AccordionTrigger className="py-3">
              <div className="flex items-center gap-2">
                <Map className="h-4 w-4" />
                <span>Legend</span>
                {config.visualization.legend.enabled && (
                  <Badge variant="secondary" className="text-xs">
                    {config.visualization.legend.position}
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="legend-enabled" className="text-sm font-medium">
                    Show Legend
                  </Label>
                  <Switch
                    id="legend-enabled"
                    checked={config.visualization.legend.enabled}
                    onCheckedChange={(enabled: boolean) =>
                      handleVisualizationChange({
                        legend: { ...config.visualization.legend, enabled }
                      })
                    }
                  />
                </div>

                {config.visualization.legend.enabled && (
                  <div className="space-y-3 ml-4 border-l-2 border-muted pl-4">
                    <div className="space-y-2">
                      <Label className="text-sm">Legend Position</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {LEGEND_POSITIONS.map((position) => {
                          const Icon = position.icon;
                          const isSelected = config.visualization.legend.position === position.value;
                          
                          return (
                            <Button
                              key={position.value}
                              variant={isSelected ? "default" : "outline"}
                              size="sm"
                              className="justify-start text-xs"
                              onClick={() =>
                                handleVisualizationChange({
                                  legend: { ...config.visualization.legend, position: position.value }
                                })
                              }
                            >
                              <Icon className="h-3 w-3 mr-2" />
                              {position.label}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

        </Accordion>
      </div>

      {/* Preview Section */}
      {activeCustomizations > 0 && (
        <div className="border-t pt-4">
          <Card className="bg-muted/20">
            <CardHeader className="py-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings className="h-3 w-3" />
                Active Customizations
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <div className="flex flex-wrap gap-1">
                {config.visualization.colorScheme !== 'viridis' && (
                  <Badge variant="secondary" className="text-xs">
                    Color: {COLOR_SCHEMES.find(s => s.id === config.visualization.colorScheme)?.name}
                  </Badge>
                )}
                {config.visualization.symbolSize.enabled && (
                  <Badge variant="secondary" className="text-xs">
                    Size: {config.visualization.symbolSize.min}-{config.visualization.symbolSize.max}px
                  </Badge>
                )}
                {config.visualization.opacity.enabled && (
                  <Badge variant="secondary" className="text-xs">
                    Opacity: {Math.round(config.visualization.opacity.value * 100)}%
                  </Badge>
                )}
                {config.visualization.labels.enabled && (
                  <Badge variant="secondary" className="text-xs">
                    Labels: {config.visualization.labels.field || 'Enabled'}
                  </Badge>
                )}
                {(!config.visualization.legend.enabled || config.visualization.legend.position !== 'bottom') && (
                  <Badge variant="secondary" className="text-xs">
                    Legend: {config.visualization.legend.enabled ? config.visualization.legend.position : 'Hidden'}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}