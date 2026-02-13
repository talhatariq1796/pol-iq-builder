import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ChevronDown, ChevronRight, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import Graphic from "@arcgis/core/Graphic";
import Legend from "@arcgis/core/widgets/Legend";
import { ApplianceIndexLayerController } from './ApplianceIndexLayerController';
import { LAYER_GROUPS } from './layer-groups';

interface IndexWidgetProps {
  view: __esri.MapView;
  onClose: () => void;
}

interface Variable {
  field: string;
  label: string;
  reverseVariable: boolean;
  weight: number;
}

interface FieldConfig {
  url: string;
  field: string;
  label: string;
  group: string;
}

type IndexMethod = typeof INDEX_METHODS[number]['value'];

const INDEX_METHODS = [
  { 
    value: 'meanPercentile' as const, 
    label: 'Mean Percentile',
    description: 'Converts values to percentiles then calculates weighted mean'
  }
] as const;

const extractFields = (): FieldConfig[] => {
  const fields: FieldConfig[] = [];
  
  LAYER_GROUPS.forEach(group => {
    // Skip point layers (gyms, spas, etc.)
    const indexLayers = group.layers.filter(layer => 
      'fields' in layer && 
      'index' in layer.fields && 
      typeof layer.fields.index === 'string'
    );
    
    indexLayers.forEach(layer => {
      if ('fields' in layer && 'index' in layer.fields && typeof layer.fields.index === 'string') {
        fields.push({
          url: layer.url,
          field: layer.fields.index,
          label: layer.title,
          group: group.title
        });
      }
    });
  });
  
  return fields;
};

const AVAILABLE_FIELDS = extractFields();

const calculateStatistics = (features: __esri.Graphic[], field: string) => {
  const values = features.map(f => f.attributes[field]).filter(v => v != null);
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min, max, mean };
};

const calculatePercentile = (value: number, values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const index = sorted.findIndex(v => v >= value);
  return (index / sorted.length) * 100;
};

export const IndexWidget: React.FC<IndexWidgetProps> = ({ view, onClose }) => {
  const [initialized, setInitialized] = useState(false);
  const [loadingState, setLoadingState] = useState<'initializing' | 'ready' | 'error'>('initializing');
  const layerController = useRef<ApplianceIndexLayerController | null>(null);
  const [selectedFields, setSelectedFields] = useState<Variable[]>([]);
  const [indexMethod, setIndexMethod] = useState<IndexMethod>('meanPercentile');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [collapsedGroups, setCollapsedGroups] = useState<{ [key: string]: boolean}>(() => {
    const groups = AVAILABLE_FIELDS.reduce((acc: { [key: string]: boolean }, field) => {
      acc[field.group] = false;
      return acc;
    }, {});
    return groups;
  });

  const groupedFields = AVAILABLE_FIELDS.reduce((acc: { [key: string]: FieldConfig[] }, field) => {
    if (!acc[field.group]) {
      acc[field.group] = [];
    }
    acc[field.group].push(field);
    return acc;
  }, {});

  useEffect(() => {
    const initializeWidget = async () => {
      try {
        if (!view || initialized) return;

        const legend = new Legend({
          view: view,
          container: document.createElement('div')
        });

        layerController.current = ApplianceIndexLayerController.getInstance(view, legend);
        
        await view.when();
        
        setInitialized(true);
        setLoadingState('ready');
      } catch (error) {
        console.error('Error initializing IndexWidget:', error);
        setLoadingState('error');
        setError('Failed to initialize widget. Please try again.');
      }
    };

    initializeWidget();

    return () => {
      if (layerController.current) {
        layerController.current.clearLayer();
      }
    };
  }, [view, initialized]);

  const cleanupLegend = useCallback(() => {
    const legendElements = document.querySelectorAll('.esri-legend');
    legendElements.forEach(element => element.remove());

    const legendContainers = document.querySelectorAll('.esri-ui-bottom-right');
    legendContainers.forEach(container => {
      if (container instanceof HTMLElement) {
        container.style.display = 'none';
      }
    });
  }, []);

  const handleCancel = useCallback(() => {
    layerController.current?.clearLayer();
    cleanupLegend();
    onClose();
  }, [onClose, cleanupLegend]);

  const toggleGroup = useCallback((groupId: string) => {
    setCollapsedGroups((prev: any) => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  }, []);

  const handleFieldToggle = useCallback((field: string, label: string) => {
    setSelectedFields((prev: Variable[]) => {
      const exists = prev.find(f => f.field === field);
      if (exists) {
        return prev.filter(f => f.field !== field);
      }
      return [...prev, { field, label, reverseVariable: false, weight: 1 }];
    });
  }, []);

  const handleWeightChange = useCallback((field: string, weight: number) => {
    setSelectedFields((prev: Variable[]) =>
      prev.map(f => f.field === field ? { ...f, weight: Math.max(0.1, Math.min(10, weight)) } : f)
    );
  }, []);

  const handleReverseToggle = useCallback((field: string) => {
    setSelectedFields((prev: Variable[]) =>
      prev.map(f => f.field === field ? { ...f, reverseVariable: !f.reverseVariable } : f)
    );
  }, []);

  const calculateIndex = useCallback(async () => {
    if (selectedFields.length < 2) {
      setError('Please select at least 2 variables');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const fieldLabels = selectedFields.reduce((acc: { [key: string]: string }, field) => {
        acc[field.field] = field.label;
        return acc;
      }, {});

      const fieldData = await Promise.all(
        selectedFields.map(async (selectedField) => {
          const fieldConfig = AVAILABLE_FIELDS.find(f => f.field === selectedField.field);
          if (!fieldConfig) {
            throw new Error(`Configuration not found for field: ${selectedField.field}`);
          }

          const layer = new FeatureLayer({
            url: fieldConfig.url
          });

          const query = layer.createQuery();
          query.outFields = [fieldConfig.field, "DESCRIPTION"];
          query.returnGeometry = true;

          const results = await layer.queryFeatures(query);
          if (!results.features[0]?.geometry) {
            throw new Error(`No valid geometry found for field: ${selectedField.field}`);
          }
          return {
            field: selectedField.field,
            features: results.features,
            geometry: results.features[0].geometry,
            url: fieldConfig.url
          };
        })
      );

      const geomType = fieldData[0]?.geometry?.type;
      if (!geomType) {
        throw new Error('Invalid geometry type in first layer');
      }

      if (!fieldData.every(data => data.geometry?.type === geomType)) {
        throw new Error('All selected variables must be from layers with the same geometry type');
      }

      const combinedFeatures = fieldData[0].features.map((feature, index) => {
        const attributes = { 
          ...feature.attributes,
          DESCRIPTION: feature.attributes.DESCRIPTION
        };
        
        fieldData.slice(1).forEach(data => {
          attributes[data.field] = data.features[index].attributes[data.field];
        });

        return new Graphic({
          geometry: feature.geometry,
          attributes
        });
      });

      const fieldStats: { [key: string]: { min: number; max: number; mean: number; values: number[] } } = {};
      selectedFields.forEach(({ field }) => {
        const values = combinedFeatures.map(f => f.attributes[field]);
        fieldStats[field] = {
          ...calculateStatistics(combinedFeatures, field),
          values
        };
      });

      const indexedFeatures = combinedFeatures.map(feature => {
        const attributes = { ...feature.attributes };
        
        const normalizedValues = selectedFields.map(({ field, weight, reverseVariable }) => {
          const value = feature.attributes[field];
          let normalizedValue = calculatePercentile(value, fieldStats[field].values) / 100;
          
          if (reverseVariable) {
            normalizedValue = 1 - normalizedValue;
          }

          return Math.pow(normalizedValue, weight);
        });

        const indexValue = normalizedValues.reduce((a, b) => a + b, 0) / selectedFields.length;
        attributes['compositeIndex'] = indexValue;

        return new Graphic({
          geometry: feature.geometry,
          attributes
        });
      });

      const methodInfo = INDEX_METHODS.find(m => m.value === indexMethod);
      const title = 'Fitness Index';
      const description = `${methodInfo?.label || 'Composite Index'}\n` +
        `Variables: ${selectedFields.map(field => field.label).join(', ')}`;

      await layerController.current?.setLayer(
        indexedFeatures,
        selectedFields.map(f => ({
          field: f.field,
          label: fieldLabels[f.field]
        })),
        title,
        description,
        fieldLabels
      );

      onClose();

    } catch (err) {
      console.error('Error calculating index:', err);
      setError(err instanceof Error ? err.message : 'Failed to calculate index. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedFields, indexMethod, onClose]);

  if (loadingState === 'initializing') {
    return (
      <div className="esri-widget esri-component p-4">
        <div className="flex items-center justify-center space-x-2">
          <Loader2 className="animate-spin h-5 w-4 text-[#6632a8]" />
          <span>Initializing widget...</span>
        </div>
      </div>
    );
  }

  if (loadingState === 'error') {
    return (
      <div className="esri-widget esri-component p-4">
        <Alert variant="destructive">
          <AlertDescription>{error || 'Failed to initialize widget'}</AlertDescription>
        </Alert>
        <Button 
          onClick={handleCancel}
          className="mt-4"
          variant="outline"
        >
          Close
        </Button>
      </div>
    );
  }

  return (
    <div className="esri-widget esri-component">
      <div className="p-4 space-y-4 max-h-[calc(100vh-120px)] overflow-y-auto">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-700">Index Method</Label>
          <Select 
            value={indexMethod} 
            onValueChange={(value: IndexMethod) => setIndexMethod(value)}
          >
            <SelectTrigger className="w-full bg-white border border-gray-300">
              <SelectValue placeholder="Select index method" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              {INDEX_METHODS.map(method => (
                <SelectItem 
                  key={method.value} 
                  value={method.value}
                >
                  <div className="flex items-center justify-between w-full">
                    <span>{method.label}</span>
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-gray-500 ml-2" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-white">
                          <p className="max-w-xs">{method.description}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-700">
            Select Variables (min 2)
          </Label>
          {Object.entries(groupedFields).map(([groupName, fields]) => (
            <div key={groupName} className="border rounded-lg bg-white shadow-sm">
              <div
                className="flex items-center space-x-2 p-3 cursor-pointer border-b"
                onClick={() => toggleGroup(groupName)}
              >
                {collapsedGroups[groupName] ? 
                  <ChevronRight className="h-4 w-4 text-gray-500" /> : 
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                }
                <span className="font-medium text-sm">{groupName}</span>
              </div>
              
              {!collapsedGroups[groupName] && (
                <div className="p-3 space-y-2">
                  {fields.map((field) => (
                    <div key={field.field} className="flex items-center justify-between space-x-2 p-2 hover:bg-gray-50 rounded">
                      <div className="flex items-center space-x-2 flex-1">
                        <Checkbox
                          id={field.field}
                          checked={selectedFields.some(f => f.field === field.field)}
                          onCheckedChange={() => handleFieldToggle(field.field, field.label)}
                        />
                        <div className="space-y-1 flex-1">
                        <Label 
                            htmlFor={field.field} 
                            className="text-sm cursor-pointer"
                          >
                            {field.label}
                          </Label>
                        </div>
                      </div>
                      {selectedFields.some(f => f.field === field.field) && (
                        <div className="flex items-center space-x-2">
                          <Label className="text-xs text-gray-500">Weight:</Label>
                          <Input
                            type="number"
                            value={selectedFields.find(f => f.field === field.field)?.weight || 1}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleWeightChange(field.field, Number(e.target.value))}
                            className="w-20 text-sm"
                            min={0.1}
                            max={10}
                            step={0.1}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {selectedFields.length > 0 && (
          <div className="border rounded-lg bg-white p-4 space-y-3">
            <Label className="text-sm font-medium text-gray-700">Selected Variables Configuration</Label>
            <div className="space-y-2">
              {selectedFields.map(field => {
                const fieldConfig = AVAILABLE_FIELDS.find(f => f.field === field.field);
                return (
                  <div key={field.field} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="text-sm flex-1 space-y-1">
                      <div>{fieldConfig?.label || field.label}</div>
                      <div className="text-xs text-gray-500">
                        Weight: {field.weight} {field.reverseVariable ? '| Reversed' : ''}
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <TooltipProvider delayDuration={0}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center space-x-1">
                              <Checkbox
                                checked={field.reverseVariable}
                                onCheckedChange={() => handleReverseToggle(field.field)}
                              />
                              <Label className="text-sm cursor-help">Reverse</Label>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="bg-white">
                            <p>Reverse this variable&apos;s direction (higher values become lower)</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedFields((prev: Variable[]) => prev.filter(f => f.field !== field.field));
                        }}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={handleCancel}
          >
            Cancel
          </Button>
          <Button 
            onClick={calculateIndex} 
            disabled={isLoading || selectedFields.length < 2}
            className="bg-[#6632a8] hover:bg-[#552a8c] text-white"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Calculate Index
          </Button>
        </div>

        {isLoading && (
          <div className="fixed inset-0 bg-black/20 flex items-center justify-center">
            <div className="bg-white p-4 rounded-lg shadow-lg flex items-center space-x-2">
              <Loader2 className="animate-spin h-5 w-5 text-[#6632a8]" />
              <span>Calculating index...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default IndexWidget;