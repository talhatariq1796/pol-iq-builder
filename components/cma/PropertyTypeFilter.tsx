/**
 * Property Type Filter Component
 *
 * Checkbox-based property type selector with category separation.
 * Prevents mixing residential and revenue properties in CMA analysis.
 */

import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Home, TrendingUp } from 'lucide-react';
import {
  RESIDENTIAL_PROPERTY_TYPES,
  REVENUE_PROPERTY_TYPES,
  validatePropertyTypeSelection,
  getDominantCategory,
  type PropertyCategory,
} from './propertyTypeConfig';

interface PropertyTypeFilterProps {
  selectedTypes: string[];
  onChange: (types: string[], category: PropertyCategory | null) => void;
  disabled?: boolean;
}

export function PropertyTypeFilter({
  selectedTypes,
  onChange,
  disabled = false,
}: PropertyTypeFilterProps) {
  const [validationError, setValidationError] = useState<string | null>(null);

  // Validate selection whenever it changes
  useEffect(() => {
    const error = validatePropertyTypeSelection(selectedTypes);
    setValidationError(error);
  }, [selectedTypes]);

  const handleTypeToggle = (typeId: string, checked: boolean) => {
    let newSelection: string[];

    if (checked) {
      newSelection = [...selectedTypes, typeId];
    } else {
      newSelection = selectedTypes.filter(id => id !== typeId);
    }

    // Get dominant category from new selection
    const category = getDominantCategory(newSelection);

    onChange(newSelection, category);
  };

  const isTypeSelected = (typeId: string) => selectedTypes.includes(typeId);

  // Determine if a type should be disabled (mixing prevention)
  const isTypeDisabled = (typeId: string, category: PropertyCategory) => {
    if (disabled) return true;
    if (selectedTypes.length === 0) return false;

    const currentCategory = getDominantCategory(selectedTypes);
    if (!currentCategory) return false;

    // Can't select types from different category
    return currentCategory !== category;
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs text-[#484247] font-montserrat font-semibold flex items-center gap-2">
          <Home className="w-4 h-4" />
          Property Types
        </Label>
        <p className="text-xs text-[#666] font-montserrat">
          Select property types to include in analysis. Revenue and Residential properties cannot be mixed.
        </p>
      </div>

      {/* Validation Error */}
      {validationError && (
        <Alert variant="destructive" className="border-orange-500 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-xs text-orange-800 font-montserrat">
            {validationError}
          </AlertDescription>
        </Alert>
      )}

      {/* Residential Properties */}
      <div className="space-y-3 p-4 border border-gray-200 rounded-lg bg-blue-50/30">
        <div className="flex items-center gap-2">
          <Home className="w-4 h-4 text-blue-600" />
          <Label className="text-sm font-semibold text-blue-900 font-montserrat">
            Residential Properties
          </Label>
        </div>
        <p className="text-xs text-blue-700 font-montserrat">
          Single-family homes, condos, and townhouses for owner-occupancy
        </p>

        <div className="space-y-2">
          {RESIDENTIAL_PROPERTY_TYPES.map(type => {
            const checked = isTypeSelected(type.id);
            const typeDisabled = isTypeDisabled(type.id, 'residential');

            return (
              <div
                key={type.id}
                className={`flex items-start space-x-3 p-2 rounded hover:bg-blue-100/50 transition-colors ${
                  typeDisabled ? 'opacity-50' : ''
                }`}
              >
                <Checkbox
                  id={`type-${type.id}`}
                  checked={checked}
                  onCheckedChange={(checked: boolean) => handleTypeToggle(type.id, checked)}
                  disabled={typeDisabled}
                  className="border-blue-600 data-[state=checked]:bg-blue-600 mt-0.5"
                />
                <div className="flex-1">
                  <Label
                    htmlFor={`type-${type.id}`}
                    className="text-xs font-medium text-[#484247] font-montserrat cursor-pointer"
                  >
                    {type.icon} {type.label}
                  </Label>
                  <p className="text-xs text-gray-600 font-montserrat mt-0.5">
                    {type.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Revenue Properties */}
      <div className="space-y-3 p-4 border border-gray-200 rounded-lg bg-green-50/30">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-green-600" />
          <Label className="text-sm font-semibold text-green-900 font-montserrat">
            Revenue Properties (Investment)
          </Label>
        </div>
        <p className="text-xs text-green-700 font-montserrat">
          Multi-unit buildings and commercial properties generating rental income
        </p>

        <div className="space-y-2">
          {REVENUE_PROPERTY_TYPES.map(type => {
            const checked = isTypeSelected(type.id);
            const typeDisabled = isTypeDisabled(type.id, 'revenue');

            return (
              <div
                key={type.id}
                className={`flex items-start space-x-3 p-2 rounded hover:bg-green-100/50 transition-colors ${
                  typeDisabled ? 'opacity-50' : ''
                }`}
              >
                <Checkbox
                  id={`type-${type.id}`}
                  checked={checked}
                  onCheckedChange={(checked: boolean) => handleTypeToggle(type.id, checked)}
                  disabled={typeDisabled}
                  className="border-green-600 data-[state=checked]:bg-green-600 mt-0.5"
                />
                <div className="flex-1">
                  <Label
                    htmlFor={`type-${type.id}`}
                    className="text-xs font-medium text-[#484247] font-montserrat cursor-pointer"
                  >
                    {type.icon} {type.label}
                  </Label>
                  <p className="text-xs text-gray-600 font-montserrat mt-0.5">
                    {type.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selection Summary */}
      {selectedTypes.length > 0 && !validationError && (
        <div className="text-xs text-gray-600 font-montserrat bg-gray-50 p-3 rounded-lg">
          <strong>Selected:</strong> {selectedTypes.length} property type(s) •{' '}
          <strong>Category:</strong> {getDominantCategory(selectedTypes) === 'residential' ? 'Residential' : 'Revenue'}
        </div>
      )}

      {selectedTypes.length === 0 && (
        <div className="text-xs text-gray-500 font-montserrat italic bg-gray-50 p-3 rounded-lg">
          No types selected • All property types will be included
        </div>
      )}
    </div>
  );
}
