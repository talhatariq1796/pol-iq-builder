'use client';

import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { ElectoralFilters as ElectoralFiltersType } from '@/lib/segmentation/types';

interface ElectoralFiltersProps {
  filters: ElectoralFiltersType;
  onChange: (filters: ElectoralFiltersType) => void;
}

// Hardcoded options for Ingham County (MVP)
const STATE_HOUSE_DISTRICTS = [
  { id: 'mi-house-71', name: '71st District', representative: 'Emily Dievendorf' },
  { id: 'mi-house-72', name: '72nd District', representative: 'Kara Hope' },
  { id: 'mi-house-73', name: '73rd District', representative: 'Angela Witwer' },
  { id: 'mi-house-74', name: '74th District', representative: 'Penelope Tsernoglou' },
  { id: 'mi-house-75', name: '75th District', representative: 'Joey Andrews' },
];

const STATE_SENATE_DISTRICTS = [
  { id: 'mi-senate-23', name: '23rd District' },
  { id: 'mi-senate-24', name: '24th District' },
];

const CONGRESSIONAL_DISTRICT = {
  id: 'mi-07',
  name: '7th Congressional District',
};

const MUNICIPALITIES = [
  { id: 'east-lansing', name: 'East Lansing', type: 'city' as const },
  { id: 'lansing', name: 'Lansing', type: 'city' as const },
  { id: 'meridian-township', name: 'Meridian Township', type: 'township' as const },
  { id: 'delhi-township', name: 'Delhi Township', type: 'township' as const },
  { id: 'williamston', name: 'Williamston', type: 'city' as const },
];

export function ElectoralFilters({ filters, onChange }: ElectoralFiltersProps) {
  const updateFilter = <K extends keyof ElectoralFiltersType>(
    key: K,
    value: ElectoralFiltersType[K]
  ) => {
    onChange({ ...filters, [key]: value });
  };

  const toggleStateHouseDistrict = (districtId: string) => {
    const current = filters.stateHouseDistricts || [];
    const updated = current.includes(districtId)
      ? current.filter((d) => d !== districtId)
      : [...current, districtId];
    updateFilter('stateHouseDistricts', updated.length > 0 ? updated : undefined);
  };

  const toggleStateSenateDistrict = (districtId: string) => {
    const current = filters.stateSenateDistricts || [];
    const updated = current.includes(districtId)
      ? current.filter((d) => d !== districtId)
      : [...current, districtId];
    updateFilter('stateSenateDistricts', updated.length > 0 ? updated : undefined);
  };

  const toggleCongressionalDistrict = (checked: boolean) => {
    updateFilter(
      'congressionalDistricts',
      checked ? [CONGRESSIONAL_DISTRICT.id] : undefined
    );
  };

  const toggleMunicipality = (municipalityId: string) => {
    const current = filters.municipalities || [];
    const updated = current.includes(municipalityId)
      ? current.filter((m) => m !== municipalityId)
      : [...current, municipalityId];
    updateFilter('municipalities', updated.length > 0 ? updated : undefined);
  };

  const toggleMunicipalityType = (type: 'city' | 'township') => {
    const current = filters.municipalityTypes || [];
    const updated = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    updateFilter('municipalityTypes', updated.length > 0 ? updated : undefined);
  };

  return (
    <div className="space-y-6">
      {/* State House Districts */}
      <div className="space-y-3">
        <Label>State House Districts</Label>
        <div className="space-y-2">
          {STATE_HOUSE_DISTRICTS.map((district) => (
            <div key={district.id} className="flex items-start space-x-2">
              <Checkbox
                id={`state-house-${district.id}`}
                checked={filters.stateHouseDistricts?.includes(district.id) ?? false}
                onCheckedChange={() => toggleStateHouseDistrict(district.id)}
              />
              <div className="flex-1">
                <label
                  htmlFor={`state-house-${district.id}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {district.name}
                </label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {district.representative}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* State Senate Districts */}
      <div className="space-y-3">
        <Label>State Senate Districts</Label>
        <div className="space-y-2">
          {STATE_SENATE_DISTRICTS.map((district) => (
            <div key={district.id} className="flex items-center space-x-2">
              <Checkbox
                id={`state-senate-${district.id}`}
                checked={filters.stateSenateDistricts?.includes(district.id) ?? false}
                onCheckedChange={() => toggleStateSenateDistrict(district.id)}
              />
              <label
                htmlFor={`state-senate-${district.id}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {district.name}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Congressional District */}
      <div className="space-y-3">
        <Label>Congressional District</Label>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="congressional-mi-07"
            checked={filters.congressionalDistricts?.includes(CONGRESSIONAL_DISTRICT.id) ?? false}
            onCheckedChange={toggleCongressionalDistrict}
          />
          <label
            htmlFor="congressional-mi-07"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {CONGRESSIONAL_DISTRICT.name}
          </label>
        </div>
      </div>

      {/* Municipalities */}
      <div className="space-y-3">
        <Label>Municipalities</Label>
        <div className="space-y-2">
          {MUNICIPALITIES.map((municipality) => (
            <div key={municipality.id} className="flex items-center space-x-2">
              <Checkbox
                id={`municipality-${municipality.id}`}
                checked={filters.municipalities?.includes(municipality.id) ?? false}
                onCheckedChange={() => toggleMunicipality(municipality.id)}
              />
              <label
                htmlFor={`municipality-${municipality.id}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {municipality.name}
              </label>
              <span className="text-xs text-muted-foreground capitalize">
                ({municipality.type})
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Municipality Type Filter */}
      <div className="space-y-3">
        <Label>Municipality Type</Label>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="municipality-type-city"
              checked={filters.municipalityTypes?.includes('city') ?? false}
              onCheckedChange={() => toggleMunicipalityType('city')}
            />
            <label
              htmlFor="municipality-type-city"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Cities Only
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="municipality-type-township"
              checked={filters.municipalityTypes?.includes('township') ?? false}
              onCheckedChange={() => toggleMunicipalityType('township')}
            />
            <label
              htmlFor="municipality-type-township"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Townships Only
            </label>
          </div>
        </div>
      </div>

      {/* Split Precinct Handling */}
      <div className="space-y-3">
        <Label>Split Precincts</Label>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Include precincts that span multiple districts
          </span>
          <Switch
            checked={filters.includeSplitPrecincts ?? true}
            onCheckedChange={(checked: boolean) => updateFilter('includeSplitPrecincts', checked)}
          />
        </div>
      </div>

      {/* Split Weight Method (only if split precincts included) */}
      {filters.includeSplitPrecincts !== false && (
        <div className="space-y-3">
          <Label>Split Precinct Weighting</Label>
          <RadioGroup
            value={filters.splitPrecinctWeight || 'full'}
            onValueChange={(value: 'full' | 'proportional') =>
              updateFilter('splitPrecinctWeight', value)
            }
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="full" id="weight-full" />
              <label
                htmlFor="weight-full"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Full Weight
              </label>
            </div>
            <p className="text-xs text-muted-foreground ml-6">
              Count split precincts fully if they overlap with selected districts
            </p>
            <div className="flex items-center space-x-2 mt-2">
              <RadioGroupItem value="proportional" id="weight-proportional" />
              <label
                htmlFor="weight-proportional"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Proportional Weight
              </label>
            </div>
            <p className="text-xs text-muted-foreground ml-6">
              Weight split precincts by the proportion of area in selected districts
            </p>
          </RadioGroup>
        </div>
      )}
    </div>
  );
}
