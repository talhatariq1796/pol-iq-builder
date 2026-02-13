/**
 * BoundaryLayerPicker Component
 *
 * Dropdown selector for choosing boundary layer types
 * (precincts, ZIP codes, block groups, legislative districts, etc.)
 */

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  MapPin,
  Mail,
  Grid3X3,
  Building2,
  Landmark,
  Vote,
  GraduationCap,
  Trees,
} from 'lucide-react';
import type { BoundaryLayerType, BoundaryLayerConfig } from '@/types/political';

// Boundary layer configurations
// NOTE: hasData indicates whether the GeoJSON file exists and can be loaded
// Data paths point to actual GeoJSON files in /public/data/political/
export const BOUNDARY_LAYERS: Record<BoundaryLayerType, BoundaryLayerConfig> = {
  'precinct': {
    type: 'precinct',
    displayName: 'Precinct',
    pluralName: 'Precincts',
    source: 'County Clerk',
    idField: 'PRECINCT_ID',
    nameField: 'PRECINCT_NAME',
    dataPath: '/data/political/ingham_precincts.geojson',
    color: '#6366f1', // Indigo
    hasData: true,
  },
  'zip-code': {
    type: 'zip-code',
    displayName: 'ZIP Code',
    pluralName: 'ZIP Codes',
    source: 'Census/USPS',
    idField: 'ZCTA5CE20',
    nameField: 'ZCTA5CE20',
    dataPath: '/data/political/ingham_zipcodes.geojson',
    color: '#8b5cf6', // Violet
    hasData: true,
  },
  'block-group': {
    type: 'block-group',
    displayName: 'Block Group',
    pluralName: 'Block Groups',
    source: 'Census Bureau',
    idField: 'GEOID',
    nameField: 'NAMELSAD',
    dataPath: '/data/political/ingham_block_groups.geojson',
    color: '#06b6d4', // Cyan
    hasData: true,
  },
  'census-tract': {
    type: 'census-tract',
    displayName: 'Census Tract',
    pluralName: 'Census Tracts',
    source: 'Census Bureau',
    idField: 'GEOID',
    nameField: 'NAMELSAD',
    dataPath: '/data/political/ingham_tracts.geojson',
    color: '#14b8a6', // Teal
    hasData: true,
  },
  'state-house': {
    type: 'state-house',
    displayName: 'State House District',
    pluralName: 'State House Districts',
    source: 'Michigan Legislature',
    idField: 'SLDLST',
    nameField: 'NAMELSAD',
    dataPath: '/data/political/michigan_state_house.geojson',
    color: '#f59e0b', // Amber
    hasData: true,
  },
  'state-senate': {
    type: 'state-senate',
    displayName: 'State Senate District',
    pluralName: 'State Senate Districts',
    source: 'Michigan Legislature',
    idField: 'SLDUST',
    nameField: 'NAMELSAD',
    dataPath: '/data/political/michigan_state_senate.geojson',
    color: '#ef4444', // Red
    hasData: true,
  },
  'congressional': {
    type: 'congressional',
    displayName: 'Congressional District',
    pluralName: 'Congressional Districts',
    source: 'Census Bureau',
    idField: 'CD118FP',
    nameField: 'NAMELSAD',
    dataPath: '/data/political/michigan_congressional.geojson',
    color: '#3b82f6', // Blue
    hasData: true,
  },
  'municipality': {
    type: 'municipality',
    displayName: 'Municipality',
    pluralName: 'Municipalities',
    source: 'Ingham County GIS',
    idField: 'JURISDICTION_NAME',
    nameField: 'JURISDICTION_NAME',
    dataPath: '/data/political/ingham_municipalities.geojson',
    color: '#22c55e', // Green
    hasData: true,
  },
  'township': {
    type: 'township',
    displayName: 'Township/City',
    pluralName: 'Townships & Cities',
    source: 'Ingham County GIS',
    idField: 'JURISDICTION_NAME',
    nameField: 'JURISDICTION_NAME',
    dataPath: '/data/political/ingham_townships.geojson',
    color: '#84cc16', // Lime
    hasData: true,
  },
  'school-district': {
    type: 'school-district',
    displayName: 'School District',
    pluralName: 'School Districts',
    source: 'Michigan GIS',
    idField: 'DCode',
    nameField: 'Name',
    dataPath: '/data/political/ingham_school_districts.geojson',
    color: '#f97316', // Orange
    hasData: true,
  },
  // County Commission Districts: Hidden until GIS data is available
  // Ingham County only publishes PDF maps, no shapefile/GeoJSON
  // 'county-commission': {
  //   type: 'county-commission',
  //   displayName: 'County Commission District',
  //   pluralName: 'County Commission Districts',
  //   source: 'Ingham County',
  //   idField: 'DISTRICT',
  //   nameField: 'NAME',
  //   dataPath: '/data/political/ingham_county_commission.geojson',
  //   color: '#ec4899', // Pink
  //   hasData: false,
  // },
};

// Get boundary types that have data available
export const AVAILABLE_BOUNDARY_TYPES = Object.values(BOUNDARY_LAYERS)
  .filter(layer => layer.hasData)
  .map(layer => layer.type);

// Icon mapping for each boundary type
const BOUNDARY_ICONS: Record<BoundaryLayerType, React.ReactNode> = {
  'precinct': <Vote className="h-4 w-4" />,
  'zip-code': <Mail className="h-4 w-4" />,
  'block-group': <Grid3X3 className="h-4 w-4" />,
  'census-tract': <Grid3X3 className="h-4 w-4" />,
  'state-house': <Landmark className="h-4 w-4" />,
  'state-senate': <Landmark className="h-4 w-4" />,
  'congressional': <Landmark className="h-4 w-4" />,
  'municipality': <Building2 className="h-4 w-4" />,
  'township': <Trees className="h-4 w-4" />,
  'school-district': <GraduationCap className="h-4 w-4" />,
};

interface BoundaryLayerPickerProps {
  value: BoundaryLayerType | null;
  onChange: (type: BoundaryLayerType) => void;
  disabled?: boolean;
  availableLayers?: BoundaryLayerType[];
  showLabel?: boolean;
  placeholder?: string;
}

export function BoundaryLayerPicker({
  value,
  onChange,
  disabled = false,
  availableLayers,
  showLabel = true,
  placeholder = 'Select boundary type...',
}: BoundaryLayerPickerProps) {
  // Filter to available layers if specified, otherwise show layers with data first
  const allLayers = Object.values(BOUNDARY_LAYERS);
  const layers = availableLayers
    ? availableLayers.map(type => BOUNDARY_LAYERS[type])
    : [
        // Show layers with data first
        ...allLayers.filter(l => l.hasData),
        // Then layers without data
        ...allLayers.filter(l => !l.hasData),
      ];

  return (
    <div className="space-y-2">
      {showLabel && (
        <Label className="text-xs font-medium">Boundary Type</Label>
      )}
      <Select
        value={value || undefined}
        onValueChange={(val) => onChange(val as BoundaryLayerType)}
        disabled={disabled}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder}>
            {value && (
              <div className="flex items-center gap-2">
                {BOUNDARY_ICONS[value]}
                <span>{BOUNDARY_LAYERS[value].displayName}</span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {layers.map((layer) => (
            <SelectItem
              key={layer.type}
              value={layer.type}
              disabled={!layer.hasData}
              className={!layer.hasData ? 'opacity-50' : ''}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: layer.hasData ? layer.color : '#9ca3af' }}
                />
                {BOUNDARY_ICONS[layer.type]}
                <div className="flex flex-col">
                  <span className={!layer.hasData ? 'text-muted-foreground' : ''}>
                    {layer.displayName}
                    {!layer.hasData && <span className="text-xs ml-1 text-gray-400">(data needed)</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {layer.source}
                  </span>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default BoundaryLayerPicker;
