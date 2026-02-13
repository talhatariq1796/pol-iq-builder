/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Switch
} from "@/components/ui/switch";
import * as colorRendererCreator from "@arcgis/core/smartMapping/renderers/color";
import PopupTemplate from "@arcgis/core/PopupTemplate";
import Legend from "@arcgis/core/widgets/Legend";

const DEMOGRAPHICS_FIELDS = [
  { value: 'HTYP05A_CY', label: 'Cohabiting with Children', description: 'Number of households with cohabiting couples and children' },
  { value: 'HTYP05A_CY_P', label: 'Cohabiting with Children (%)', description: 'Percentage of households with cohabiting couples and children' },
  { value: 'PP_CY', label: 'Purchasing Power', description: 'Total purchasing power in the area' },
  { value: 'PPPC_CY', label: 'Purchasing Power (per capita)', description: 'Average purchasing power per person' },
  { value: 'HTYP03_CY', label: 'Cohabiting', description: 'Number of cohabiting households' },
  { value: 'HTYP03_CY_P', label: 'Cohabiting (%)', description: 'Percentage of cohabiting households' }
] as const;

const VEHICLE_FIELDS = [
  { value: 'KMS_TOT', label: 'Total Kilometers', description: 'Total kilometers driven' },
  { value: 'KMS_AVG', label: 'Average Kilometers', description: 'Average kilometers per vehicle' },
  { value: 'VEH_TOT', label: 'Total Vehicles', description: 'Total number of vehicles' }
] as const;

interface LayerConfig {
  id: string;
  title: string;
  description: string;
  fields: typeof DEMOGRAPHICS_FIELDS | typeof VEHICLE_FIELDS;
  defaultField: string;
}

const LAYER_CONFIGS: Record<string, LayerConfig> = {
  dublin_smallareas: {
    id: 'dublin_smallareas',
    title: 'Demographics',
    description: 'Population and household characteristics',
    fields: DEMOGRAPHICS_FIELDS,
    defaultField: 'PP_CY'
  },
  sales_kms: {
    id: 'sales_kms',
    title: 'Vehicle Data',
    description: 'Vehicle usage and distribution',
    fields: VEHICLE_FIELDS,
    defaultField: 'KMS_TOT'
  }
};

interface LayerControlProps {
  layers: __esri.FeatureLayer[];
  view: __esri.MapView;
}

interface LayerState {
  selectedField: string;
  visible: boolean;
  legend: __esri.Legend | null;
}

const findLayerConfig = (layer: __esri.FeatureLayer): LayerConfig | undefined => {
  const serviceUrl = layer.url?.toLowerCase() || '';
  return Object.values(LAYER_CONFIGS).find(cfg => 
    serviceUrl.includes(cfg.id.toLowerCase())
  );
};

const LayerControl = ({ layers, view }: LayerControlProps) => {
  const [layerStates, setLayerStates] = useState<Record<string, LayerState>>({});
  const [isLoading, setIsLoading] = useState(true);
  const legendRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const cleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const initializeLayers = async () => {
      setIsLoading(true);
      try {
        await Promise.all(layers.map(layer => layer.when()));
        
        const initialStates: Record<string, LayerState> = {};
        layers.forEach(layer => {
          const config = findLayerConfig(layer);
          if (config) {
            initialStates[layer.id] = {
              selectedField: config.defaultField,
              visible: true,
              legend: null
            };
          }
        });
        setLayerStates(initialStates);
        
        await Promise.all(
          layers.map(async layer => {
            const config = findLayerConfig(layer);
            if (config) {
              await updateRenderer(layer, config.defaultField);
            }
          })
        );
      } catch (error) {
        console.error('Error initializing layers:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeLayers();
  }, [layers]);

  const updateRenderer = async (layer: __esri.FeatureLayer, fieldName: string) => {
    try {
      const config = findLayerConfig(layer);
      if (!config) return;

      const params = {
        layer,
        view,
        field: fieldName,
        theme: 'high-to-low' as const,
        defaultSymbolEnabled: false
      };

      const { renderer } = await colorRendererCreator.createContinuousRenderer(params);
      layer.renderer = renderer;

      const allFieldInfos = config.fields.map(option => ({
        fieldName: option.value,
        label: option.label,
        format: {
          places: option.value.endsWith('_P') ? 1 : 0,
          digitSeparator: true
        }
      }));

      const selectedFieldInfo = allFieldInfos.find(info => info.fieldName === fieldName);
      const otherFieldInfos = allFieldInfos.filter(info => info.fieldName !== fieldName);

      layer.popupTemplate = new PopupTemplate({
        title: "{DESCRIPTION}",
        content: [{
          type: "fields",
          fieldInfos: selectedFieldInfo 
            ? [selectedFieldInfo, ...otherFieldInfos]
            : allFieldInfos
        }]
      });
    } catch (error) {
      console.error('Error updating renderer:', error);
    }
  };

  const handleFieldChange = (layerId: string, value: string) => {
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;

    setLayerStates((prev: Record<string, LayerState>) => ({
      ...prev,
      [layerId]: {
        ...prev[layerId],
        selectedField: value
      }
    }));
    updateRenderer(layer, value);
  };

  const handleVisibilityChange = (layerId: string, checked: boolean) => {
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;

    layer.visible = checked;
    setLayerStates((prev: Record<string, LayerState>) => ({
      ...prev,
      [layerId]: {
        ...prev[layerId],
        visible: checked
      }
    }));
  };

  const setLegendRef = useCallback((layerId: string, element: HTMLDivElement | null) => {
    if (element && !legendRefs.current[layerId]) {
      legendRefs.current[layerId] = element;
      const layer = layers.find(l => l.id === layerId);
      if (layer) {
        const legend = new Legend({
          view,
          container: element,
          layerInfos: [{
            layer,
            title: ''
          }],
          style: {
            type: "card",
            layout: "side-by-side"
          }
        });

        setLayerStates((prev: Record<string, LayerState>) => ({
          ...prev,
          [layerId]: {
            ...prev[layerId],
            legend
          }
        }));
      }
    }
  }, [layers, view]);

  useEffect(() => {
    const currentTimeout = cleanupTimeoutRef.current;
    // Effect code here
    
    return () => {
      if (currentTimeout) {
        clearTimeout(currentTimeout);
      }
    };
  }, [/* dependencies */]);

  useEffect(() => {
    // Remove this effect since updateRenderer requires parameters
    // The initialization is already handled in the first useEffect
  }, []);

  useEffect(() => {
    // Effect code here
  }, [layerStates]); // Add layerStates to dependencies

  if (isLoading) {
    return (
      <div className="p-4">
        <p className="text-sm text-gray-600">Loading layers...</p>
      </div>
    );
  }

  const validLayers = layers.filter(layer => findLayerConfig(layer));

  if (validLayers.length === 0) {
    return (
      <div className="p-4">
        <p className="text-sm text-gray-600">No layers available</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-gray-900">
          Layer Controls
        </h3>
      </div>

      <Accordion 
        defaultValue={validLayers.map(l => l.id)} 
        className="space-y-2"
      >
        {validLayers.map(layer => {
          const config = findLayerConfig(layer);
          const state = layerStates[layer.id];
          if (!config || !state) return null;

          return (
            <AccordionItem 
              key={layer.id} 
              value={layer.id}
              className="border rounded-lg bg-white shadow-sm"
            >
              <div className="flex items-center px-4 py-2 space-x-3">
                <Switch
                  checked={state.visible}
                  onCheckedChange={(checked: boolean) => handleVisibilityChange(layer.id, checked)}
                />
                <AccordionTrigger className="flex-1 hover:no-underline py-2">
                  <span className="font-medium">{config.title}</span>
                </AccordionTrigger>
              </div>
              
              <AccordionContent className="px-4 pt-2 pb-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Variable
                    </label>
                    <Select 
                      value={state.selectedField} 
                      onValueChange={(value) => handleFieldChange(layer.id, value)}
                    >
                      <SelectTrigger className="w-full bg-white border border-gray-200">
                        <SelectValue placeholder="Select a variable" />
                      </SelectTrigger>
                      <SelectContent className="bg-white shadow-lg border border-gray-200">
                        {config.fields.map((option) => (
                          <SelectItem 
                            key={option.value} 
                            value={option.value}
                            className="hover:bg-gray-100"
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {config.fields.find(f => f.value === state.selectedField)?.description && (
                      <p className="text-sm text-gray-500 italic">
                        {config.fields.find(f => f.value === state.selectedField)?.description}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-700">Legend</h4>
                    <div 
                      ref={(el) => setLegendRef(layer.id, el)}
                      className="legend-container bg-white rounded-md border border-gray-200 p-2"
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
};

export default LayerControl;