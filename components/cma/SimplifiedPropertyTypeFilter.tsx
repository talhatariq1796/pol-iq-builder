/**
 * Simplified Property Type Filter Component
 *
 * Three radio buttons for CMA analysis (only one type can be selected):
 * 1. Residential - Houses (includes house + townhouse)
 * 2. Residential - Condos (includes condo)
 * 3. Revenue Properties (includes duplex + multiplex + commercial)
 */

import React from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Home, Building2, TrendingUp } from 'lucide-react';
import type { PropertyCategory } from './propertyTypeConfig';

interface SimplifiedPropertyTypeFilterProps {
  selectedTypes: string[];
  onChange: (types: string[], category: PropertyCategory | null) => void;
  disabled?: boolean;
}

// Simplified type mapping
const SIMPLIFIED_TYPES = {
  RESIDENTIAL_HOUSES: {
    id: 'residential-houses',
    label: 'Residential - Houses',
    description: 'Single-family homes and townhouses',
    icon: Home,
    category: 'residential' as PropertyCategory,
    maps_to: ['house', 'townhouse'],  // Maps to original type IDs
  },
  RESIDENTIAL_CONDOS: {
    id: 'residential-condos',
    label: 'Residential - Condos',
    description: 'Condominiums and apartments',
    icon: Building2,
    category: 'residential' as PropertyCategory,
    maps_to: ['condo'],
  },
  REVENUE_PROPERTIES: {
    id: 'revenue-properties',
    label: 'Revenue Properties',
    description: 'Multi-unit and commercial investment properties',
    icon: TrendingUp,
    category: 'revenue' as PropertyCategory,
    maps_to: ['duplex', 'multiplex', 'commercial'],
  },
};

export function SimplifiedPropertyTypeFilter({
  selectedTypes,
  onChange,
  disabled = false,
}: SimplifiedPropertyTypeFilterProps) {
  // Determine which radio button is selected based on selectedTypes
  const getSelectedRadioValue = (): string => {
    const hasHouses = selectedTypes.some(t => 
      SIMPLIFIED_TYPES.RESIDENTIAL_HOUSES.maps_to.includes(t)
    );
    const hasCondos = selectedTypes.some(t => 
      SIMPLIFIED_TYPES.RESIDENTIAL_CONDOS.maps_to.includes(t)
    );
    const hasRevenue = selectedTypes.some(t => 
      SIMPLIFIED_TYPES.REVENUE_PROPERTIES.maps_to.includes(t)
    );

    if (hasHouses) return SIMPLIFIED_TYPES.RESIDENTIAL_HOUSES.id;
    if (hasCondos) return SIMPLIFIED_TYPES.RESIDENTIAL_CONDOS.id;
    if (hasRevenue) return SIMPLIFIED_TYPES.REVENUE_PROPERTIES.id;
    return ''; // None selected
  };

  const handleRadioChange = (value: string) => {
    console.log('[SimplifiedPropertyTypeFilter] Radio changed to:', value);

    let simplifiedType: typeof SIMPLIFIED_TYPES[keyof typeof SIMPLIFIED_TYPES] | null = null;

    if (value === SIMPLIFIED_TYPES.RESIDENTIAL_HOUSES.id) {
      simplifiedType = SIMPLIFIED_TYPES.RESIDENTIAL_HOUSES;
    } else if (value === SIMPLIFIED_TYPES.RESIDENTIAL_CONDOS.id) {
      simplifiedType = SIMPLIFIED_TYPES.RESIDENTIAL_CONDOS;
    } else if (value === SIMPLIFIED_TYPES.REVENUE_PROPERTIES.id) {
      simplifiedType = SIMPLIFIED_TYPES.REVENUE_PROPERTIES;
    }

    if (!simplifiedType) {
      // No selection (shouldn't happen with radio, but handle it)
      console.log('[SimplifiedPropertyTypeFilter] No type selected, clearing');
      onChange([], null);
      return;
    }

    // Set selectedTypes to only the types that map to this radio selection
    const newSelection = [...simplifiedType.maps_to];
    const category = simplifiedType.category;

    console.log('[SimplifiedPropertyTypeFilter] Calling onChange with:', {
      newSelection,
      category,
      label: simplifiedType.label
    });

    onChange(newSelection, category);
  };

  const getSelectedTypeName = () => {
    const radioValue = getSelectedRadioValue();
    if (radioValue === SIMPLIFIED_TYPES.RESIDENTIAL_HOUSES.id) {
      return SIMPLIFIED_TYPES.RESIDENTIAL_HOUSES.label;
    }
    if (radioValue === SIMPLIFIED_TYPES.RESIDENTIAL_CONDOS.id) {
      return SIMPLIFIED_TYPES.RESIDENTIAL_CONDOS.label;
    }
    if (radioValue === SIMPLIFIED_TYPES.REVENUE_PROPERTIES.id) {
      return SIMPLIFIED_TYPES.REVENUE_PROPERTIES.label;
    }
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs text-[#484247] font-montserrat font-semibold flex items-center gap-2">
          <Home className="w-4 h-4" />
          Property Type (Select One)
        </Label>
        <p className="text-xs text-[#666] font-montserrat">
          Select one property type for your analysis. Each type uses different comparable metrics.
        </p>
      </div>

      {/* Radio Group for Property Types */}
      <RadioGroup value={getSelectedRadioValue()} onValueChange={handleRadioChange} disabled={disabled}>
        <div className="space-y-3">
          {/* Residential - Houses */}
          <div className="p-4 border border-gray-200 rounded-lg bg-blue-50/30 hover:bg-blue-50/50 transition-colors">
            <div className="flex items-start space-x-3">
              <RadioGroupItem
                value={SIMPLIFIED_TYPES.RESIDENTIAL_HOUSES.id}
                id="type-residential-houses"
                className="border-blue-600 text-blue-600 mt-0.5"
              />
              <div className="flex-1">
                <Label
                  htmlFor="type-residential-houses"
                  className="text-sm font-semibold text-blue-900 font-montserrat cursor-pointer flex items-center gap-2"
                >
                  <Home className="w-4 h-4" />
                  {SIMPLIFIED_TYPES.RESIDENTIAL_HOUSES.label}
                </Label>
                <p className="text-xs text-blue-700 font-montserrat mt-1">
                  {SIMPLIFIED_TYPES.RESIDENTIAL_HOUSES.description}
                </p>
              </div>
            </div>
          </div>

          {/* Residential - Condos */}
          <div className="p-4 border border-gray-200 rounded-lg bg-teal-50/30 hover:bg-teal-50/50 transition-colors">
            <div className="flex items-start space-x-3">
              <RadioGroupItem
                value={SIMPLIFIED_TYPES.RESIDENTIAL_CONDOS.id}
                id="type-residential-condos"
                className="border-teal-600 text-teal-600 mt-0.5"
              />
              <div className="flex-1">
                <Label
                  htmlFor="type-residential-condos"
                  className="text-sm font-semibold text-teal-900 font-montserrat cursor-pointer flex items-center gap-2"
                >
                  <Building2 className="w-4 h-4" />
                  {SIMPLIFIED_TYPES.RESIDENTIAL_CONDOS.label}
                </Label>
                <p className="text-xs text-teal-700 font-montserrat mt-1">
                  {SIMPLIFIED_TYPES.RESIDENTIAL_CONDOS.description}
                </p>
              </div>
            </div>
          </div>

          {/* Revenue Properties */}
          <div className="p-4 border border-gray-200 rounded-lg bg-green-50/30 hover:bg-green-50/50 transition-colors">
            <div className="flex items-start space-x-3">
              <RadioGroupItem
                value={SIMPLIFIED_TYPES.REVENUE_PROPERTIES.id}
                id="type-revenue-properties"
                className="border-green-600 text-green-600 mt-0.5"
              />
              <div className="flex-1">
                <Label
                  htmlFor="type-revenue-properties"
                  className="text-sm font-semibold text-green-900 font-montserrat cursor-pointer flex items-center gap-2"
                >
                  <TrendingUp className="w-4 h-4" />
                  {SIMPLIFIED_TYPES.REVENUE_PROPERTIES.label}
                </Label>
                <p className="text-xs text-green-700 font-montserrat mt-1">
                  {SIMPLIFIED_TYPES.REVENUE_PROPERTIES.description}
                </p>
              </div>
            </div>
          </div>
        </div>
      </RadioGroup>

      {/* Selection Summary */}
      {selectedTypes.length > 0 && (
        <div className="text-xs text-gray-600 font-montserrat bg-gray-50 p-3 rounded-lg">
          <strong>Selected:</strong> {getSelectedTypeName()}
        </div>
      )}

      {selectedTypes.length === 0 && (
        <div className="text-xs text-gray-500 font-montserrat bg-gray-50 p-3 rounded-lg">
          Select a property type to begin your analysis.
        </div>
      )}
    </div>
  );
}
