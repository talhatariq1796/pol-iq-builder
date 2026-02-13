"use client";

import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { YearMonthPicker } from '@/components/ui/year-month-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CalendarIcon, Filter, BarChart3, MapPin, Target, AlertTriangle, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import type { CMAFilters, AreaSelection, CMADataRanges } from './types';
import { DEFAULT_DATA_RANGES } from './types';
import { SimplifiedPropertyTypeFilter } from './SimplifiedPropertyTypeFilter';
import { RevenuePropertyFilters } from './RevenuePropertyFilters';

interface CMAFilterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  filters: CMAFilters;
  onFiltersChange: (filters: CMAFilters) => void;
  onGenerateReport: () => void;
  propertiesCount: number;
  selectedArea?: AreaSelection;
  isLoading?: boolean;
  error?: string | null;
  dataRanges?: CMADataRanges; // Dynamic ranges from actual data
}

const CMAFilterDialog: React.FC<CMAFilterDialogProps> = ({
  isOpen,
  onClose,
  filters,
  onFiltersChange,
  onGenerateReport,
  propertiesCount,
  selectedArea,
  isLoading = false,
  error = null,
  dataRanges
}) => {
  // Use dynamic ranges if provided, otherwise fall back to defaults
  const activeRanges = dataRanges || DEFAULT_DATA_RANGES;

  const [localFilters, setLocalFilters] = useState<CMAFilters>(() => {
    // CRITICAL: Use filters prop for slider VALUES (preset from property)
    // Use dataRanges only as slider BOUNDS (min/max limits)
    const ranges = dataRanges || DEFAULT_DATA_RANGES;

    // Default to full data range only if no filters provided
    const defaultFilters: CMAFilters = {
      propertyType: 'all',
      selectedPropertyTypes: [],
      propertyCategory: 'both',
      priceRange: { min: ranges.priceRange.min, max: ranges.priceRange.max },
      bedrooms: { min: ranges.bedrooms.min, max: ranges.bedrooms.max },
      bathrooms: { min: ranges.bathrooms.min, max: ranges.bathrooms.max },
      squareFootage: { min: ranges.squareFootage.min, max: ranges.squareFootage.max },
      yearBuilt: { min: ranges.yearBuilt.min, max: ranges.yearBuilt.max },
      listingStatus: 'both',
      dateRange: {
        start: new Date(new Date().getFullYear() - 1, 0, 1),
        end: new Date()
      }
    };

    // If filters provided (from property selection), use those values for slider positions
    // This ensures sliders show the auto-generated preset (e.g., 3-3 beds from property)
    if (!filters) return defaultFilters;

    return {
      propertyType: filters.propertyType || defaultFilters.propertyType,
      selectedPropertyTypes: filters.selectedPropertyTypes || defaultFilters.selectedPropertyTypes,
      propertyCategory: filters.propertyCategory || defaultFilters.propertyCategory,
      listingStatus: filters.listingStatus || defaultFilters.listingStatus,
      // Use filters prop values (preset ranges from property), NOT dataRanges (full data)
      priceRange: {
        min: filters.priceRange?.min ?? defaultFilters.priceRange.min,
        max: filters.priceRange?.max ?? defaultFilters.priceRange.max
      },
      bedrooms: {
        min: filters.bedrooms?.min ?? defaultFilters.bedrooms.min,
        max: filters.bedrooms?.max ?? defaultFilters.bedrooms.max
      },
      bathrooms: {
        min: filters.bathrooms?.min ?? defaultFilters.bathrooms.min,
        max: filters.bathrooms?.max ?? defaultFilters.bathrooms.max
      },
      squareFootage: {
        min: filters.squareFootage?.min ?? defaultFilters.squareFootage.min,
        max: filters.squareFootage?.max ?? defaultFilters.squareFootage.max
      },
      yearBuilt: {
        min: filters.yearBuilt?.min ?? defaultFilters.yearBuilt.min,
        max: filters.yearBuilt?.max ?? defaultFilters.yearBuilt.max
      },
      dateRange: {
        start: filters.dateRange?.start ?? defaultFilters.dateRange.start,
        end: filters.dateRange?.end ?? defaultFilters.dateRange.end
      }
    };
  });

  // Track when filter changes are pending (for debounce and preventing reset loop)
  const [isPendingFilterChange, setIsPendingFilterChange] = React.useState(false);

  // Track collapsible state for "More Filters" section
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = React.useState(false);

  // CRITICAL: Update localFilters when filters prop changes (e.g., new property selected)
  // This ensures sliders reset to the preset values from the selected property
  // BUT: Don't reset if we're in the middle of pending filter changes (avoid reset loop)
  React.useEffect(() => {
    // Skip if we have pending changes - this prevents reset loop when user is actively filtering
    if (isPendingFilterChange) {
      console.log('[CMAFilterDialog] Skipping filters prop sync - pending filter change in progress');
      return;
    }

    if (filters) {
      console.log('[CMAFilterDialog] Filters prop changed - resetting sliders to preset values:', filters);
      setLocalFilters({
        propertyType: filters.propertyType || 'all',
        selectedPropertyTypes: filters.selectedPropertyTypes || [],
        propertyCategory: filters.propertyCategory || 'both',
        listingStatus: filters.listingStatus || 'both',
        priceRange: {
          min: filters.priceRange?.min ?? activeRanges.priceRange.min,
          max: filters.priceRange?.max ?? activeRanges.priceRange.max
        },
        bedrooms: {
          min: filters.bedrooms?.min ?? activeRanges.bedrooms.min,
          max: filters.bedrooms?.max ?? activeRanges.bedrooms.max
        },
        bathrooms: {
          min: filters.bathrooms?.min ?? activeRanges.bathrooms.min,
          max: filters.bathrooms?.max ?? activeRanges.bathrooms.max
        },
        squareFootage: {
          min: filters.squareFootage?.min ?? activeRanges.squareFootage.min,
          max: filters.squareFootage?.max ?? activeRanges.squareFootage.max
        },
        yearBuilt: {
          min: filters.yearBuilt?.min ?? activeRanges.yearBuilt.min,
          max: filters.yearBuilt?.max ?? activeRanges.yearBuilt.max
        },
        dateRange: {
          start: filters.dateRange?.start ?? new Date(new Date().getFullYear() - 1, 0, 1),
          end: filters.dateRange?.end ?? new Date()
        }
      });
    }
  }, [filters, activeRanges, isPendingFilterChange]);

  // Update localFilters when dataRanges changes (e.g., new area selected or properties loaded)
  // This constrains slider positions to stay within valid data bounds
  React.useEffect(() => {
    if (dataRanges) {
      setLocalFilters(prevFilters => ({
        ...prevFilters,
        // Update ranges to match data, but keep user's position within the new range
        priceRange: {
          min: Math.max(prevFilters.priceRange.min, dataRanges.priceRange.min),
          max: Math.min(prevFilters.priceRange.max, dataRanges.priceRange.max)
        },
        bedrooms: {
          min: Math.max(prevFilters.bedrooms.min, dataRanges.bedrooms.min),
          max: Math.min(prevFilters.bedrooms.max, dataRanges.bedrooms.max)
        },
        bathrooms: {
          min: Math.max(prevFilters.bathrooms.min, dataRanges.bathrooms.min),
          max: Math.min(prevFilters.bathrooms.max, dataRanges.bathrooms.max)
        },
        squareFootage: {
          min: Math.max(prevFilters.squareFootage.min, dataRanges.squareFootage.min),
          max: Math.min(prevFilters.squareFootage.max, dataRanges.squareFootage.max)
        },
        yearBuilt: {
          min: Math.max(prevFilters.yearBuilt.min, dataRanges.yearBuilt.min),
          max: Math.min(prevFilters.yearBuilt.max, dataRanges.yearBuilt.max)
        }
      }));
    }
  }, [dataRanges]);

  // Render logging removed to reduce noise

  // Debounce timer for updates
  const debounceTimerRef = React.useRef(null as unknown as ReturnType<typeof setTimeout> | null);

  // Log prop updates for debugging
  React.useEffect(() => {
    console.log('[CMAFilterDialog] Props updated:', {
      propertiesCount,
      isLoading,
      isPendingFilterChange,
      hasDataRanges: !!dataRanges,
      dataRanges: dataRanges ? {
        priceRange: dataRanges.priceRange,
        bedrooms: dataRanges.bedrooms,
        bathrooms: dataRanges.bathrooms
      } : 'using defaults'
    });
  }, [propertiesCount, isLoading, isPendingFilterChange, dataRanges]);

  // Track propertiesCount changes specifically for debugging badge updates
  React.useEffect(() => {
    console.log('[CMAFilterDialog] propertiesCount changed:', {
      propertiesCount,
      isPendingFilterChange,
      isLoading,
      timestamp: new Date().toISOString()
    });
  }, [propertiesCount, isLoading, isPendingFilterChange]);

  // Helper function to determine data sufficiency status
  const getDataSufficiencyStatus = useCallback(() => {
    if (isLoading || isPendingFilterChange) {
      return { type: 'loading', message: '', showWarning: false };
    }
    
    if (propertiesCount === 0) {
      return { 
        type: 'error', 
        message: 'No properties found - try adjusting filters or selecting a different area',
        showWarning: true 
      };
    }
    
    if (propertiesCount === 1) {
      return { 
        type: 'error', 
        message: 'Only 1 property found - CMA requires at least 2 comparable properties',
        showWarning: true 
      };
    }
    
    if (propertiesCount < 10) {
      return { 
        type: 'warning', 
        message: `Limited data (${propertiesCount} properties) - results may be less reliable. Consider expanding your search area or adjusting filters.`,
        showWarning: true 
      };
    }
    
    return { type: 'success', message: '', showWarning: false };
  }, [propertiesCount, isLoading, isPendingFilterChange]);

  const dataSufficiency = getDataSufficiencyStatus();

  const handleFilterUpdate = useCallback((updates: Partial<CMAFilters>) => {
    console.log('[CMAFilterDialog] handleFilterUpdate called:', {
      updates,
      beforePending: isPendingFilterChange,
      timestamp: new Date().toISOString()
    });

    // Indicate filter change is pending IMMEDIATELY
    setIsPendingFilterChange(true);
    console.log('[CMAFilterDialog] Set isPendingFilterChange to TRUE');

    setLocalFilters((prevFilters) => {
      const newFilters = { ...prevFilters, ...updates };
      console.log('[CMAFilterDialog] Filter update - scheduling debounced onFiltersChange:', {
        updates,
        newFilters,
        isPending: true
      });

      // Clear existing timer
      if (debounceTimerRef.current) {
        console.log('[CMAFilterDialog] Clearing existing debounce timer');
        clearTimeout(debounceTimerRef.current);
      }

      // Debounce the parent callback to avoid excessive API calls
      // This also fixes the setState-in-render warning by deferring the call
      debounceTimerRef.current = setTimeout(() => {
        console.log('[CMAFilterDialog] Debounce timer fired - calling onFiltersChange');
        onFiltersChange(newFilters);
        // Filter change is no longer pending after callback fires
        setIsPendingFilterChange(false);
        console.log('[CMAFilterDialog] Set isPendingFilterChange to FALSE');
      }, 250); // 250ms debounce - optimized for better UX

      return newFilters;
    });
  }, [onFiltersChange, isPendingFilterChange]);

  // Cleanup debounce timer on unmount
  React.useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Input box handlers with validation
  const handlePriceMinChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    const numValue = value ? parseInt(value, 10) : activeRanges.priceRange.min;
    handleFilterUpdate({
      priceRange: { min: numValue, max: localFilters.priceRange.max }
    });
  }, [handleFilterUpdate, activeRanges.priceRange.min, localFilters.priceRange.max]);

  const handlePriceMaxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    const numValue = value ? parseInt(value, 10) : activeRanges.priceRange.max;
    handleFilterUpdate({
      priceRange: { min: localFilters.priceRange.min, max: numValue }
    });
  }, [handleFilterUpdate, activeRanges.priceRange.max, localFilters.priceRange.min]);

  const handleBedroomsMinChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const numValue = parseInt(e.target.value, 10) || activeRanges.bedrooms.min;
    handleFilterUpdate({
      bedrooms: { min: numValue, max: localFilters.bedrooms.max }
    });
  }, [handleFilterUpdate, activeRanges.bedrooms.min, localFilters.bedrooms.max]);

  const handleBedroomsMaxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const numValue = parseInt(e.target.value, 10) || activeRanges.bedrooms.max;
    handleFilterUpdate({
      bedrooms: { min: localFilters.bedrooms.min, max: numValue }
    });
  }, [handleFilterUpdate, activeRanges.bedrooms.max, localFilters.bedrooms.min]);

  const handleBathroomsMinChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const numValue = parseInt(e.target.value, 10) || activeRanges.bathrooms.min;
    handleFilterUpdate({
      bathrooms: { min: numValue, max: localFilters.bathrooms.max }
    });
  }, [handleFilterUpdate, activeRanges.bathrooms.min, localFilters.bathrooms.max]);

  const handleBathroomsMaxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const numValue = parseInt(e.target.value, 10) || activeRanges.bathrooms.max;
    handleFilterUpdate({
      bathrooms: { min: localFilters.bathrooms.min, max: numValue }
    });
  }, [handleFilterUpdate, activeRanges.bathrooms.max, localFilters.bathrooms.min]);

  const handleSquareFootageMinChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const numValue = parseInt(e.target.value, 10) || activeRanges.squareFootage.min;
    handleFilterUpdate({
      squareFootage: { min: numValue, max: localFilters.squareFootage.max }
    });
  }, [handleFilterUpdate, activeRanges.squareFootage.min, localFilters.squareFootage.max]);

  const handleSquareFootageMaxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const numValue = parseInt(e.target.value, 10) || activeRanges.squareFootage.max;
    handleFilterUpdate({
      squareFootage: { min: localFilters.squareFootage.min, max: numValue }
    });
  }, [handleFilterUpdate, activeRanges.squareFootage.max, localFilters.squareFootage.min]);

  const handleYearBuiltMinChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const numValue = parseInt(e.target.value, 10) || activeRanges.yearBuilt.min;
    handleFilterUpdate({
      yearBuilt: { min: numValue, max: localFilters.yearBuilt.max }
    });
  }, [handleFilterUpdate, activeRanges.yearBuilt.min, localFilters.yearBuilt.max]);

  const handleYearBuiltMaxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const numValue = parseInt(e.target.value, 10) || activeRanges.yearBuilt.max;
    handleFilterUpdate({
      yearBuilt: { min: localFilters.yearBuilt.min, max: numValue }
    });
  }, [handleFilterUpdate, activeRanges.yearBuilt.max, localFilters.yearBuilt.min]);

  const handleGenerateClick = useCallback(() => {
    onGenerateReport();
    onClose();
  }, [onGenerateReport, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col p-0 overflow-hidden">
        {/* Fixed Header with BHHS Maroon Branding */}
        <DialogHeader className="flex-shrink-0 p-6 pb-4 border-b bg-gradient-to-r from-[#660D39] to-[#670038]">
          <DialogTitle className="flex items-center gap-2 !text-white font-montserrat text-lg font-bold">
            <Filter className="h-5 w-5 !text-white" />
            CMA Filter & Report Generator
          </DialogTitle>
          <DialogDescription className="sr-only">
            Configure filters for comparative market analysis
          </DialogDescription>
          <div className="flex flex-col gap-2 text-xs text-white mt-2">
            {selectedArea && (
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="bg-white/20 !text-white border-white/30 hover:bg-white/30 text-xs font-bold">
                  <MapPin className="h-3 w-3 mr-1 !text-white" />
                  Area: {selectedArea.displayName}
                </Badge>
                <Badge
                  variant="outline"
                  className={`text-xs font-bold ${
                    dataSufficiency.type === 'error' 
                      ? 'bg-red-500/90 !text-white border-red-600 hover:bg-red-600'
                      : dataSufficiency.type === 'warning'
                      ? 'bg-yellow-500/90 !text-white border-yellow-600 hover:bg-yellow-600'
                      : 'bg-white/20 !text-white border-white/30 hover:bg-white/30'
                  }`}
                >
                  {dataSufficiency.type === 'error' || dataSufficiency.type === 'warning' ? (
                    <AlertTriangle className="h-3 w-3 mr-1 !text-white" />
                  ) : (
                    <BarChart3 className="h-3 w-3 mr-1 !text-white" />
                  )}
                  {(localFilters.selectedPropertyTypes?.length ?? 0) === 0
                    ? 'Select a property type to see results'
                    : (isPendingFilterChange ? 'Updating...' : isLoading ? 'Loading...' : `${propertiesCount || 0} properties found`)
                  }
                </Badge>
              </div>
            )}
            {/* Data Sufficiency Warning/Error Message */}
            {dataSufficiency.showWarning && dataSufficiency.message && (localFilters.selectedPropertyTypes?.length ?? 0) > 0 && (
              <div className={`text-xs p-3 rounded-lg border ${
                dataSufficiency.type === 'error'
                  ? 'bg-red-500/10 text-red-200 border-red-500/30'
                  : 'bg-yellow-500/10 text-yellow-200 border-yellow-500/30'
              }`}>
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{dataSufficiency.message}</span>
                </div>
              </div>
            )}
            {error && (
              <div className="text-red-600 text-xs bg-red-50 p-2 rounded border mt-2">
                Error: {error}
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Property Type Filter - Simplified 3-Checkbox UI */}
            <div className="lg:col-span-2">
              <SimplifiedPropertyTypeFilter
                selectedTypes={localFilters.selectedPropertyTypes || []}
                onChange={(types, category) => {
                  handleFilterUpdate({
                    selectedPropertyTypes: types,
                    propertyCategory: category || 'both',
                  });
                }}
                disabled={isLoading || isPendingFilterChange}
              />
            </div>

            {/* Conditional Filters Based on Property Category */}
            {localFilters.propertyCategory === 'revenue' ? (
              /* Revenue Property Filters - Investment Focused */
              <div className="lg:col-span-2">
                <RevenuePropertyFilters
                  filters={localFilters}
                  onFilterChange={handleFilterUpdate}
                  disabled={isLoading}
                />
              </div>
            ) : localFilters.propertyCategory === 'both' ? (
              /* Both Categories Selected - Show Message */
              <div className="lg:col-span-2 p-6 border border-figma-gray-600 rounded-lg bg-figma-glass-white-5">
                <div className="text-center text-figma-gray-300">
                  <p className="text-sm font-medium mb-2">Select a property category to continue</p>
                  <p className="text-xs text-figma-gray-400">
                    Choose either residential or revenue properties above to see relevant filters
                  </p>
                </div>
              </div>
            ) : (
              /* Residential Property Filters */
              <>
                {/* Listing Status */}
                <div className="space-y-2">
                  <Label className="text-xs text-[#484247] font-montserrat font-semibold">Listing Status</Label>
                  <RadioGroup
                    value={localFilters.listingStatus}
                    onValueChange={(value: string) => handleFilterUpdate({ listingStatus: value as 'both' | 'sold' | 'active' })}
                    className="flex flex-wrap gap-4"
                    disabled={isLoading || isPendingFilterChange}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem 
                        value="both" 
                        id="both" 
                        className="border-[#660D39] text-[#660D39]"
                        disabled={isLoading || isPendingFilterChange}
                      />
                      <Label 
                        htmlFor="both" 
                        className={`text-xs font-montserrat ${isLoading || isPendingFilterChange ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        Both
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem 
                        value="sold" 
                        id="sold" 
                        className="border-[#660D39] text-[#660D39]"
                        disabled={isLoading || isPendingFilterChange}
                      />
                      <Label 
                        htmlFor="sold" 
                        className={`text-xs font-montserrat ${isLoading || isPendingFilterChange ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        Sold
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem 
                        value="active" 
                        id="active" 
                        className="border-[#660D39] text-[#660D39]"
                        disabled={isLoading || isPendingFilterChange}
                      />
                      <Label 
                        htmlFor="active" 
                        className={`text-xs font-montserrat ${isLoading || isPendingFilterChange ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        Active
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

            {/* Price Range */}
            <div className="space-y-3 lg:col-span-2">
              <Label className="text-xs text-[#484247] font-montserrat font-semibold">
                Price Range
                <span className="text-xs font-normal ml-2 text-[#484247]/70">
                  (Data: ${activeRanges.priceRange.min.toLocaleString()} - ${activeRanges.priceRange.max.toLocaleString()})
                </span>
              </Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="price-min" className="text-xs text-[#484247]/70 font-montserrat">Min Price</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#484247]">$</span>
                    <Input
                      id="price-min"
                      type="text"
                      value={localFilters.priceRange.min.toLocaleString()}
                      onChange={handlePriceMinChange}
                      disabled={isLoading || isPendingFilterChange}
                      className="pl-6 font-montserrat text-sm border-[#660D39]/30 focus:border-[#660D39]"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="price-max" className="text-xs text-[#484247]/70 font-montserrat">Max Price</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#484247]">$</span>
                    <Input
                      id="price-max"
                      type="text"
                      value={localFilters.priceRange.max.toLocaleString()}
                      onChange={handlePriceMaxChange}
                      disabled={isLoading || isPendingFilterChange}
                      className="pl-6 font-montserrat text-sm border-[#660D39]/30 focus:border-[#660D39]"
                    />
                  </div>
                </div>
              </div>
              {localFilters.priceRange.min > localFilters.priceRange.max && (
                <p className="text-xs text-red-600 font-montserrat">Min price cannot exceed max price</p>
              )}
            </div>

            {/* Bedrooms */}
            <div className="space-y-3">
              <Label className="text-xs text-[#484247] font-montserrat font-semibold">
                Bedrooms
                <span className="text-xs font-normal ml-2 text-[#484247]/70">
                  (Data: {activeRanges.bedrooms.min} - {activeRanges.bedrooms.max})
                </span>
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="bedrooms-min" className="text-xs text-[#484247]/70 font-montserrat">Min</Label>
                  <Input
                    id="bedrooms-min"
                    type="number"
                    min={activeRanges.bedrooms.min}
                    max={activeRanges.bedrooms.max}
                    value={localFilters.bedrooms.min}
                    onChange={handleBedroomsMinChange}
                    disabled={isLoading || isPendingFilterChange}
                    className="font-montserrat text-sm border-[#660D39]/30 focus:border-[#660D39]"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="bedrooms-max" className="text-xs text-[#484247]/70 font-montserrat">Max</Label>
                  <Input
                    id="bedrooms-max"
                    type="number"
                    min={activeRanges.bedrooms.min}
                    max={activeRanges.bedrooms.max}
                    value={localFilters.bedrooms.max}
                    onChange={handleBedroomsMaxChange}
                    disabled={isLoading || isPendingFilterChange}
                    className="font-montserrat text-sm border-[#660D39]/30 focus:border-[#660D39]"
                  />
                </div>
              </div>
              {localFilters.bedrooms.min > localFilters.bedrooms.max && (
                <p className="text-xs text-red-600 font-montserrat">Min cannot exceed max</p>
              )}
            </div>

            {/* More Filters - Collapsible Section */}
            <div className="lg:col-span-2">
              <Collapsible open={isMoreFiltersOpen} onOpenChange={setIsMoreFiltersOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200">
                  <span className="text-sm font-semibold text-[#484247] font-montserrat">More Filters</span>
                  <ChevronDown className={`h-4 w-4 text-[#660D39] transition-transform ${isMoreFiltersOpen ? 'transform rotate-180' : ''}`} />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Bathrooms */}
                    <div className="space-y-3">
                      <Label className="text-xs text-[#484247] font-montserrat font-semibold">
                        Bathrooms
                        <span className="text-xs font-normal ml-2 text-[#484247]/70">
                          (Data: {activeRanges.bathrooms.min} - {activeRanges.bathrooms.max})
                        </span>
                      </Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="bathrooms-min" className="text-xs text-[#484247]/70 font-montserrat">Min</Label>
                          <Input
                            id="bathrooms-min"
                            type="number"
                            min={activeRanges.bathrooms.min}
                            max={activeRanges.bathrooms.max}
                            value={localFilters.bathrooms.min}
                            onChange={handleBathroomsMinChange}
                            disabled={isLoading || isPendingFilterChange}
                            className="font-montserrat text-sm border-[#660D39]/30 focus:border-[#660D39]"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="bathrooms-max" className="text-xs text-[#484247]/70 font-montserrat">Max</Label>
                          <Input
                            id="bathrooms-max"
                            type="number"
                            min={activeRanges.bathrooms.min}
                            max={activeRanges.bathrooms.max}
                            value={localFilters.bathrooms.max}
                            onChange={handleBathroomsMaxChange}
                            disabled={isLoading || isPendingFilterChange}
                            className="font-montserrat text-sm border-[#660D39]/30 focus:border-[#660D39]"
                          />
                        </div>
                      </div>
                      {localFilters.bathrooms.min > localFilters.bathrooms.max && (
                        <p className="text-xs text-red-600 font-montserrat">Min cannot exceed max</p>
                      )}
                    </div>

                    {/* Square Footage */}
                    <div className="space-y-3">
                      <Label className="text-xs text-[#484247] font-montserrat font-semibold">
                        Square Footage
                        <span className="text-xs font-normal ml-2 text-[#484247]/70">
                          (Data: {activeRanges.squareFootage.min.toLocaleString()} - {activeRanges.squareFootage.max.toLocaleString()} sqft)
                        </span>
                      </Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="sqft-min" className="text-xs text-[#484247]/70 font-montserrat">Min</Label>
                          <Input
                            id="sqft-min"
                            type="number"
                            min={activeRanges.squareFootage.min}
                            max={activeRanges.squareFootage.max}
                            step={100}
                            value={localFilters.squareFootage.min}
                            onChange={handleSquareFootageMinChange}
                            disabled={isLoading || isPendingFilterChange}
                            className="font-montserrat text-sm border-[#660D39]/30 focus:border-[#660D39]"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="sqft-max" className="text-xs text-[#484247]/70 font-montserrat">Max</Label>
                          <Input
                            id="sqft-max"
                            type="number"
                            min={activeRanges.squareFootage.min}
                            max={activeRanges.squareFootage.max}
                            step={100}
                            value={localFilters.squareFootage.max}
                            onChange={handleSquareFootageMaxChange}
                            disabled={isLoading || isPendingFilterChange}
                            className="font-montserrat text-sm border-[#660D39]/30 focus:border-[#660D39]"
                          />
                        </div>
                      </div>
                      {localFilters.squareFootage.min > localFilters.squareFootage.max && (
                        <p className="text-xs text-red-600 font-montserrat">Min cannot exceed max</p>
                      )}
                    </div>

                    {/* Year Built */}
                    <div className="space-y-3 lg:col-span-2">
                      <Label className="text-xs text-[#484247] font-montserrat font-semibold">
                        Year Built
                        <span className="text-xs font-normal ml-2 text-[#484247]/70">
                          (Data: {activeRanges.yearBuilt.min} - {activeRanges.yearBuilt.max})
                        </span>
                      </Label>
                      <div className="grid grid-cols-2 gap-3 max-w-md">
                        <div className="space-y-1">
                          <Label htmlFor="year-min" className="text-xs text-[#484247]/70 font-montserrat">Min</Label>
                          <Input
                            id="year-min"
                            type="number"
                            min={activeRanges.yearBuilt.min}
                            max={activeRanges.yearBuilt.max}
                            value={localFilters.yearBuilt.min}
                            onChange={handleYearBuiltMinChange}
                            disabled={isLoading || isPendingFilterChange}
                            className="font-montserrat text-sm border-[#660D39]/30 focus:border-[#660D39]"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="year-max" className="text-xs text-[#484247]/70 font-montserrat">Max</Label>
                          <Input
                            id="year-max"
                            type="number"
                            min={activeRanges.yearBuilt.min}
                            max={activeRanges.yearBuilt.max}
                            value={localFilters.yearBuilt.max}
                            onChange={handleYearBuiltMaxChange}
                            disabled={isLoading || isPendingFilterChange}
                            className="font-montserrat text-sm border-[#660D39]/30 focus:border-[#660D39]"
                          />
                        </div>
                      </div>
                      {localFilters.yearBuilt.min > localFilters.yearBuilt.max && (
                        <p className="text-xs text-red-600 font-montserrat">Min cannot exceed max</p>
                      )}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* Date Range */}
            <div className="space-y-2 lg:col-span-2">
              <Label className="text-xs text-[#484247] font-montserrat font-semibold">Date Range</Label>
              <div className="flex flex-col sm:flex-row gap-4">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start text-left font-normal w-full sm:w-auto border-[#660D39] hover:bg-[#660D39]/10 font-montserrat text-xs">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {localFilters.dateRange.start
                        ? format(localFilters.dateRange.start, "MMM yyyy")
                        : "Start date"
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <YearMonthPicker
                      date={localFilters.dateRange.start}
                      onDateChange={(date: Date) => 
                        handleFilterUpdate({
                          dateRange: { ...localFilters.dateRange, start: date }
                        })
                      }
                      fromYear={2000}
                      toYear={new Date().getFullYear()}
                    />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start text-left font-normal w-full sm:w-auto border-[#660D39] hover:bg-[#660D39]/10 font-montserrat text-xs">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {localFilters.dateRange.end
                        ? format(localFilters.dateRange.end, "MMM yyyy")
                        : "End date"
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <YearMonthPicker
                      date={localFilters.dateRange.end}
                      onDateChange={(date: Date) => 
                        handleFilterUpdate({
                          dateRange: { ...localFilters.dateRange, end: date }
                        })
                      }
                      fromYear={2000}
                      toYear={new Date().getFullYear()}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
              </>
            )}
          </div>
        </div>

        {/* Fixed Footer with BHHS Branding */}
        <DialogFooter className="flex-shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 pt-4 border-t bg-gray-50">
          <div className="text-xs text-gray-600 font-montserrat">
            {selectedArea ? (
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className="mr-2 bg-[#660D39]/10 text-[#484247] border-[#660D39] text-xs"
                >
                  <Target className="h-3 w-3 mr-1" />
                  {(localFilters.selectedPropertyTypes?.length ?? 0) === 0
                    ? 'Select a property type'
                    : (isPendingFilterChange ? 'Updating...' : isLoading ? 'Analyzing...' : `${propertiesCount || 0} properties selected`)
                  }
                </Badge>
                <span className="hidden sm:inline text-xs text-[#484247]">
                  {isLoading ? 'Running analysis...' : 'Ready to generate comprehensive CMA report'}
                </span>
              </div>
            ) : (
              <span className="text-xs text-orange-600 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                Please select an area on the map first
              </span>
            )}
          </div>
          <div className="flex space-x-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 sm:flex-initial border-[#484247] text-[#484247] hover:bg-[#484247] hover:text-white font-montserrat"
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerateClick}
              disabled={!selectedArea || propertiesCount < 2 || isLoading || !!error}
              className="bg-[#660D39] hover:bg-[#670038] disabled:bg-gray-400 disabled:cursor-not-allowed flex-1 sm:flex-initial font-montserrat text-sm font-bold text-white"
              title={propertiesCount < 2 ? 'At least 2 properties required for CMA' : ''}
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <BarChart3 className="mr-2 h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {isLoading ? 'Analyzing...' : 'Generate CMA'}
              </span>
              <span className="sm:hidden">
                {isLoading ? 'Analyzing...' : 'Generate'}
              </span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export { CMAFilterDialog };
export default CMAFilterDialog;