'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { activeState } from '@/lib/config/activeState';
import type { TapestryFilters as TapestryFiltersType, TapestrySegment } from '@/lib/segmentation/types';

interface TapestryFiltersProps {
  filters: TapestryFiltersType;
  onChange: (filters: TapestryFiltersType) => void;
}

type LifeModeGroupOption = {
  id: number;
  name: string;
  description: string;
};

// Generic fallback LifeMode groups used when the active state has no precinct-level Tapestry codes.
const FALLBACK_LIFEMODE_GROUPS: LifeModeGroupOption[] = [
  { id: 1, name: 'Affluent Estates', description: 'Wealthy, suburban, established families' },
  { id: 2, name: 'Uptown Individuals', description: 'Urban singles, high-income, young professionals' },
  { id: 3, name: 'Upscale Avenues', description: 'Successful urban professionals' },
  { id: 4, name: 'Family Landscapes', description: 'Suburban families with children' },
  { id: 5, name: 'GenXurban', description: 'Middle-age suburban and exurban' },
  { id: 6, name: 'Cozy Country Living', description: 'Rural, comfortable, established' },
  { id: 7, name: 'Ethnic Enclaves', description: 'Urban diverse neighborhoods' },
  { id: 8, name: 'Middle Ground', description: 'Middle-income, diverse age' },
  { id: 10, name: 'Rural Resort Dwellers', description: 'Rural, modest income' },
  { id: 12, name: 'Traditional Living', description: 'Traditional values, family-oriented' },
  { id: 14, name: 'Scholars and Patriots', description: 'Students and military communities' },
];

const URBANIZATION_OPTIONS = [
  { value: 'urban', label: 'Urban' },
  { value: 'suburban', label: 'Suburban' },
  { value: 'exurban', label: 'Exurban' },
  { value: 'rural', label: 'Rural' },
];

const LIFESTAGE_OPTIONS = [
  { value: 'young_singles', label: 'Young Singles' },
  { value: 'young_families', label: 'Young Families' },
  { value: 'middle_age', label: 'Middle Age' },
  { value: 'empty_nesters', label: 'Empty Nesters' },
  { value: 'seniors', label: 'Seniors' },
];

const AFFLUENCE_OPTIONS = [
  { value: 'high', label: 'High' },
  { value: 'upper_middle', label: 'Upper Middle' },
  { value: 'middle', label: 'Middle' },
  { value: 'modest', label: 'Modest' },
  { value: 'low', label: 'Low' },
];

const PARTISAN_LEAN_OPTIONS = [
  { value: 'strong_dem', label: 'Strong Democrat' },
  { value: 'lean_dem', label: 'Lean Democrat' },
  { value: 'toss_up', label: 'Toss-up' },
  { value: 'lean_rep', label: 'Lean Republican' },
  { value: 'strong_rep', label: 'Strong Republican' },
];

export function TapestryFilters({ filters, onChange }: TapestryFiltersProps) {
  const [segments, setSegments] = useState<TapestrySegment[]>([]);
  const [isSegmentsOpen, setIsSegmentsOpen] = useState(false);
  const [isLifeModeOpen, setIsLifeModeOpen] = useState(false);

  // Load Tapestry segments
  useEffect(() => {
    loadSegments();
  }, []);

  const loadSegments = async () => {
    try {
      const precinctResponse = await fetch(activeState.paths.precinctDemographics);
      if (precinctResponse.ok) {
        const data = await precinctResponse.json();
        const precinctRows = Object.values(
          data?.precincts || {},
        ) as Array<Record<string, unknown>>;
        const byCode = new Map<
          string,
          {
            count: number;
            lifeModeGroup?: number;
            lifeModeCode?: string;
            urbanicityCode?: string;
          }
        >();

        for (const row of precinctRows) {
          const code = String(
            row.tapestry_code ?? row.tapestryCode ?? '',
          ).trim();
          if (!code || code === 'UN') continue;
          const current = byCode.get(code) || { count: 0 };
          const lifeModeGroup = Number(
            row.tapestry_lifemode_group_num ?? row.tapestryLifeModeGroup,
          );
          const lifeModeCode = String(
            row.tapestry_lifemode_group ?? row.tapestryLifeModeCode ?? '',
          ).trim();
          const urbanicityCode = String(
            row.tapestry_urbanicity_code ?? row.tapestryUrbanicityCode ?? '',
          ).trim();
          byCode.set(code, {
            count: current.count + 1,
            lifeModeGroup: Number.isFinite(lifeModeGroup)
              ? lifeModeGroup
              : current.lifeModeGroup,
            lifeModeCode: lifeModeCode || current.lifeModeCode,
            urbanicityCode: urbanicityCode || current.urbanicityCode,
          });
        }

        if (byCode.size > 0) {
          const actualSegments = Array.from(byCode.entries())
            .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
            .map(([code, meta]) => {
              const urbanization = urbanicityToBucket(meta.urbanicityCode);
              return {
                code,
                name: `Tapestry ${code}`,
                lifeModeGroup: meta.lifeModeGroup ?? 0,
                lifeModeGroupName: meta.lifeModeCode
                  ? `LifeMode ${meta.lifeModeCode}`
                  : 'LifeMode',
                urbanization,
                lifestage: inferLifestageFromLifeMode(meta.lifeModeCode),
                affluence: inferAffluenceFromLifeMode(meta.lifeModeCode),
                medianAge: 0,
                medianIncome: 0,
                collegePct: 0,
                expectedPartisanLean: 0,
                expectedTurnout: 0,
                donorPropensity: 'medium',
                mediaPreference: [],
                topIssues: [],
                description: `${meta.count.toLocaleString()} precincts`,
              } satisfies TapestrySegment;
            });
          setSegments(actualSegments);
          return;
        }
      }

      const response = await fetch('/data/tapestry/tapestry_segments.json');
      if (response.ok) {
        const data = await response.json();
        setSegments(data);
      }
    } catch (error) {
      console.error('Error loading Tapestry segments:', error);
    }
  };

  const urbanicityToBucket = (
    code?: string,
  ): 'urban' | 'suburban' | 'exurban' | 'rural' => {
    const n = Number(code);
    if (Number.isFinite(n)) {
      if (n >= 1 && n <= 5) return 'urban';
      if (n >= 6 && n <= 8) return 'suburban';
      if (n === 9) return 'exurban';
      if (n >= 10) return 'rural';
    }
    return 'suburban';
  };

  const inferLifestageFromLifeMode = (
    code?: string,
  ): 'young_singles' | 'young_families' | 'middle_age' | 'empty_nesters' | 'seniors' => {
    switch ((code || '').toUpperCase()) {
      case 'C':
      case 'K':
        return 'young_singles';
      case 'D':
        return 'young_families';
      case 'I':
      case 'J':
      case 'L':
        return 'seniors';
      case 'A':
      case 'B':
      case 'E':
      case 'F':
      case 'G':
      case 'H':
      default:
        return 'middle_age';
    }
  };

  const inferAffluenceFromLifeMode = (
    code?: string,
  ): 'high' | 'upper_middle' | 'middle' | 'modest' | 'low' => {
    switch ((code || '').toUpperCase()) {
      case 'A':
      case 'B':
        return 'high';
      case 'C':
      case 'D':
      case 'E':
        return 'upper_middle';
      case 'F':
      case 'H':
        return 'middle';
      case 'G':
      case 'I':
      case 'K':
        return 'modest';
      case 'J':
      case 'L':
      default:
        return 'low';
    }
  };

  const updateFilter = <K extends keyof TapestryFiltersType>(
    key: K,
    value: TapestryFiltersType[K]
  ) => {
    onChange({ ...filters, [key]: value });
  };

  const toggleSegment = (code: string) => {
    const current = filters.tapestrySegments || [];
    const updated = current.includes(code)
      ? current.filter((c) => c !== code)
      : [...current, code];
    updateFilter('tapestrySegments', updated.length > 0 ? updated : undefined);
  };

  const toggleLifeModeGroup = (groupId: number) => {
    const current = filters.lifeModeGroups || [];
    const updated = current.includes(groupId)
      ? current.filter((g) => g !== groupId)
      : [...current, groupId];
    updateFilter('lifeModeGroups', updated.length > 0 ? updated : undefined);
  };

  const toggleUrbanization = (value: 'urban' | 'suburban' | 'exurban' | 'rural') => {
    const current = filters.urbanization || [];
    const updated = current.includes(value)
      ? current.filter((u) => u !== value)
      : [...current, value];
    updateFilter('urbanization', updated.length > 0 ? updated : undefined);
  };

  const toggleLifestage = (value: 'young_singles' | 'young_families' | 'middle_age' | 'empty_nesters' | 'seniors') => {
    const current = filters.lifestage || [];
    const updated = current.includes(value)
      ? current.filter((l) => l !== value)
      : [...current, value];
    updateFilter('lifestage', updated.length > 0 ? updated : undefined);
  };

  const toggleAffluence = (value: 'high' | 'upper_middle' | 'middle' | 'modest' | 'low') => {
    const current = filters.affluence || [];
    const updated = current.includes(value)
      ? current.filter((a) => a !== value)
      : [...current, value];
    updateFilter('affluence', updated.length > 0 ? updated : undefined);
  };

  // Quick filter presets
  const applyQuickFilter = (preset: string) => {
    const codesFor = (predicate: (segment: TapestrySegment) => boolean) => {
      const codes = segments.filter(predicate).map((segment) => segment.code);
      return codes.length > 0 ? codes : undefined;
    };

    switch (preset) {
      case 'progressive_urban':
        onChange({
          ...filters,
          urbanization: ['urban'],
          expectedPartisanLean: 'strong_dem',
        });
        break;
      case 'suburban_swing':
        onChange({
          ...filters,
          urbanization: ['suburban'],
          expectedPartisanLean: 'toss_up',
        });
        break;
      case 'young_voters':
        onChange({
          ...filters,
          tapestrySegments: codesFor((segment) =>
            ['young_singles', 'young_families'].includes(segment.lifestage),
          ),
        });
        break;
      case 'high_donor':
        onChange({
          ...filters,
          tapestrySegments: codesFor((segment) =>
            ['high', 'upper_middle'].includes(segment.affluence),
          ),
        });
        break;
    }
  };

  const lifeModeGroups = useMemo<LifeModeGroupOption[]>(() => {
    const fromSegments = new Map<
      number,
      { id: number; name: string; description: string }
    >();
    for (const segment of segments) {
      if (!segment.lifeModeGroup) continue;
      if (!fromSegments.has(segment.lifeModeGroup)) {
        fromSegments.set(segment.lifeModeGroup, {
          id: segment.lifeModeGroup,
          name: segment.lifeModeGroupName || `LifeMode ${segment.lifeModeGroup}`,
          description: 'Present in the active state data',
        });
      }
    }
    return fromSegments.size > 0
      ? Array.from(fromSegments.values()).sort((a, b) => a.id - b.id)
      : FALLBACK_LIFEMODE_GROUPS;
  }, [segments]);

  // Get partisan lean color
  const getPartisanColor = (lean: number) => {
    if (lean > 20) return 'bg-blue-600';
    if (lean > 5) return 'bg-blue-400';
    if (lean > -5) return 'bg-purple-500';
    if (lean > -20) return 'bg-red-400';
    return 'bg-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Quick Filters */}
      <div className="space-y-3">
        <Label>Quick Filters</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyQuickFilter('progressive_urban')}
          >
            Progressive Urban
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyQuickFilter('suburban_swing')}
          >
            Suburban Swing
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyQuickFilter('young_voters')}
          >
            Young Voters
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyQuickFilter('high_donor')}
          >
            High Donor Potential
          </Button>
        </div>
      </div>

      {/* Tapestry Segments */}
      <Collapsible open={isSegmentsOpen} onOpenChange={setIsSegmentsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-0">
            <Label className="cursor-pointer">
              Tapestry Segments
              {filters.tapestrySegments && filters.tapestrySegments.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {filters.tapestrySegments.length}
                </Badge>
              )}
            </Label>
            {isSegmentsOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {segments.map((segment) => (
              <div key={segment.code} className="flex items-start space-x-2 p-2 rounded hover:bg-muted/50">
                <Checkbox
                  id={`segment-${segment.code}`}
                  checked={filters.tapestrySegments?.includes(segment.code) ?? false}
                  onCheckedChange={() => toggleSegment(segment.code)}
                />
                <div className="flex-1">
                  <label
                    htmlFor={`segment-${segment.code}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {segment.code}: {segment.name}
                  </label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {segment.lifeModeGroupName}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`w-2 h-2 rounded-full ${getPartisanColor(segment.expectedPartisanLean)}`} />
                    <span className="text-xs text-muted-foreground">
                      {segment.expectedPartisanLean > 0 ? 'D+' : 'R+'}{Math.abs(segment.expectedPartisanLean)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {segment.urbanization}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* LifeMode Groups */}
      <Collapsible open={isLifeModeOpen} onOpenChange={setIsLifeModeOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-0">
            <Label className="cursor-pointer">
              LifeMode Groups
              {filters.lifeModeGroups && filters.lifeModeGroups.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {filters.lifeModeGroups.length}
                </Badge>
              )}
            </Label>
            {isLifeModeOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {lifeModeGroups.map((group) => (
              <div key={group.id} className="flex items-start space-x-2">
                <Checkbox
                  id={`lifemode-${group.id}`}
                  checked={filters.lifeModeGroups?.includes(group.id) ?? false}
                  onCheckedChange={() => toggleLifeModeGroup(group.id)}
                />
                <div className="flex-1">
                  <label
                    htmlFor={`lifemode-${group.id}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {group.id}. {group.name}
                  </label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {group.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Urbanization */}
      <div className="space-y-3">
        <Label>Urbanization</Label>
        <div className="grid grid-cols-2 gap-2">
          {URBANIZATION_OPTIONS.map((option) => (
            <div key={option.value} className="flex items-center space-x-2">
              <Checkbox
                id={`urbanization-${option.value}`}
                checked={filters.urbanization?.includes(option.value as 'urban' | 'suburban' | 'exurban' | 'rural') ?? false}
                onCheckedChange={() => toggleUrbanization(option.value as 'urban' | 'suburban' | 'exurban' | 'rural')}
              />
              <label
                htmlFor={`urbanization-${option.value}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {option.label}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Lifestage */}
      <div className="space-y-3">
        <Label>Life Stage</Label>
        <div className="space-y-2">
          {LIFESTAGE_OPTIONS.map((option) => (
            <div key={option.value} className="flex items-center space-x-2">
              <Checkbox
                id={`lifestage-${option.value}`}
                checked={filters.lifestage?.includes(option.value as 'young_singles' | 'young_families' | 'middle_age' | 'empty_nesters' | 'seniors') ?? false}
                onCheckedChange={() => toggleLifestage(option.value as 'young_singles' | 'young_families' | 'middle_age' | 'empty_nesters' | 'seniors')}
              />
              <label
                htmlFor={`lifestage-${option.value}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {option.label}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Affluence */}
      <div className="space-y-3">
        <Label>Affluence Level</Label>
        <div className="space-y-2">
          {AFFLUENCE_OPTIONS.map((option) => (
            <div key={option.value} className="flex items-center space-x-2">
              <Checkbox
                id={`affluence-${option.value}`}
                checked={filters.affluence?.includes(option.value as 'high' | 'upper_middle' | 'middle' | 'modest' | 'low') ?? false}
                onCheckedChange={() => toggleAffluence(option.value as 'high' | 'upper_middle' | 'middle' | 'modest' | 'low')}
              />
              <label
                htmlFor={`affluence-${option.value}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {option.label}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Expected Partisan Lean */}
      <div className="space-y-3">
        <Label>Expected Partisan Lean</Label>
        <Select
          value={filters.expectedPartisanLean || 'any'}
          onValueChange={(value: string) =>
            updateFilter(
              'expectedPartisanLean',
              value && value !== 'any' ? (value as 'strong_dem' | 'lean_dem' | 'toss_up' | 'lean_rep' | 'strong_rep') : undefined
            )
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Any partisan lean" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any</SelectItem>
            {PARTISAN_LEAN_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tapestry Diversity */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Minimum Tapestry Diversity</Label>
          <span className="text-sm text-muted-foreground">
            {filters.minTapestryDiversity?.toFixed(1) ?? '1.0'}
          </span>
        </div>
        <div className="space-y-2">
          <Slider
            value={[filters.minTapestryDiversity ?? 1.0]}
            min={1.0}
            max={3.0}
            step={0.1}
            onValueChange={(value: number[]) => updateFilter('minTapestryDiversity', value[0])}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Homogeneous</span>
            <span>Mixed</span>
          </div>
        </div>
      </div>

      {/* Clear All Filters */}
      <Button
        variant="ghost"
        className="w-full"
        onClick={() => onChange({})}
      >
        Clear All Tapestry Filters
      </Button>
    </div>
  );
}
