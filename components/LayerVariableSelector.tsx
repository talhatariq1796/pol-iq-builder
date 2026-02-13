import React, { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import * as colorRendererCreator from "@arcgis/core/smartMapping/renderers/color";
import PopupTemplate from "@arcgis/core/PopupTemplate";

// Define the variables and their display names
const FIELD_OPTIONS = [
  { value: 'HTYP05A_CY', label: 'Cohabiting with Children' },
  { value: 'HTYP05A_CY_P', label: 'Cohabiting with Children (%)' },
  { value: 'PP_CY', label: 'Purchasing Power' },
  { value: 'PPPC_CY', label: 'Purchasing Power (per capita)' },
  { value: 'HTYP03_CY', label: 'Cohabiting' },
  { value: 'HTYP03_CY_P', label: 'Cohabiting (%)' }
];

interface LayerVariableSelectorProps {
  layer: __esri.FeatureLayer;
  view: __esri.MapView;
}

const LayerVariableSelector = ({ layer, view }: LayerVariableSelectorProps) => {
  const [selectedField, setSelectedField] = useState('PP_CY');

  const updateRenderer = async (fieldName: string) => {
    try {
      const params = {
        layer,
        view,
        field: fieldName,
        theme: 'high-to-low' as const,
        defaultSymbolEnabled: false
      };

      const { renderer } = await colorRendererCreator.createContinuousRenderer(params);
      layer.renderer = renderer;

      // Update popup template for the selected field
      const selectedOption = FIELD_OPTIONS.find(opt => opt.value === fieldName);
      layer.popupTemplate = new PopupTemplate({
        title: "{DESCRIPTION}",
        content: [{
          type: "fields",
          fieldInfos: [{
            fieldName: fieldName,
            label: selectedOption?.label || fieldName,
            format: {
              places: fieldName.endsWith('_P') ? 1 : 0,
              digitSeparator: true
            }
          }]
        }]
      });
    } catch (error) {
      console.error('Error updating renderer:', error);
    }
  };

  const handleFieldChange = (value: string) => {
    setSelectedField(value);
    updateRenderer(value);
  };

  // Initialize renderer on mount
  useEffect(() => {
    updateRenderer(selectedField);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Select Variable
      </label>
<Select value={selectedField} onValueChange={handleFieldChange}>
  <SelectTrigger className="w-full bg-white">
    <SelectValue placeholder="Select a variable" />
  </SelectTrigger>
  <SelectContent className="bg-white">
    {FIELD_OPTIONS.map((option) => (
      <SelectItem key={option.value} value={option.value}>
        {option.label}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
    </div>
  );
};

export default LayerVariableSelector;