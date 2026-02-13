"use client";

import React, { useState, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Calculator, AlertTriangle, Filter, X } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { CMAFilterDialog } from './CMAFilterDialog';
import { CMAReport } from './CMAReport';
import { SquareFootageDialog } from './dialogs/SquareFootageDialog';
import { CMAStatsPreview } from './CMAStatsPreview';
import { useCMAAnalysis } from './hooks/useCMAAnalysis';
import { useChartGeneration } from '@/hooks/useChartGeneration';
import { PropertyTypeValidator } from '@/lib/cma/PropertyTypeValidator';
import type { CMAFilters, AreaSelection, PropertyParams } from './types';
import { generateAutoFilters, describeAutoFilters, toPropertyFilterParams } from './utils/autoFilterUtils';
import {
  addSimilarityScores,
  sortBySimilarity,
  extractFilterReference
} from './utils/similarityScore';
import { filterPropertiesByFilters, getFilterStatistics } from './utils/filterProperties';

interface CMAInterfaceProps {
  selectedArea?: AreaSelection;
  propertyParams?: PropertyParams; // Pre-extracted property params (replaces selectedProperty: __esri.Graphic)
  onAreaSelectionRequired?: () => void;
  bufferConfig?: { type: 'radius' | 'drivetime' | 'walktime'; value: number; unit: 'km' | 'minutes' };
  mapView?: __esri.MapView; // Optional: For capturing area maps in PDF
  searchAddress?: string; // Search input address (for address resolution)
  clickCoordinates?: { lat: number; lng: number }; // Map click coordinates (for address resolution)
}

const CMAInterface: React.FC<CMAInterfaceProps> = ({
  selectedArea,
  propertyParams,
  onAreaSelectionRequired,
  bufferConfig,
  mapView,
  searchAddress,
  clickCoordinates
}) => {
  console.log('[CMAInterface] 🚨 COMPONENT RENDER:', {
    timestamp: new Date().toISOString(),
    hasSelectedArea: !!selectedArea,
    hasPropertyParams: !!propertyParams
  });

  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isSquareFootageDialogOpen, setIsSquareFootageDialogOpen] = useState(false);
  const [pendingClickLocation, setPendingClickLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Condo square footage - from user input (dialog) or selected property
  const [userEnteredSquareFootage, setUserEnteredSquareFootage] = useState<number | null>(null);

  // Selected comparable property IDs for CMA report
  // When empty, all properties are used in calculations (default behavior)
  const [selectedComparableIds, setSelectedComparableIds] = useState<string[]>([]);
  
  // Auto-generate initial filters based on PropertyParams (no re-extraction needed!)
  const initialFilters = useMemo(() => {
    console.log('[CMAInterface] 🎯 initialFilters useMemo executing:', {
      hasPropertyParams: !!propertyParams,
      propertyAddress: propertyParams?.address
    });

    if (propertyParams) {
      // Use PropertyParams directly - NO extraction needed!
      console.log('[CMAInterface] 📦 Using pre-extracted PropertyParams:', {
        centrisNo: propertyParams.centrisNo,
        address: propertyParams.address,
        price: propertyParams.price,
        bedrooms: propertyParams.bedrooms
      });

      const autoFilters = generateAutoFilters(propertyParams, {
        includeAllStatuses: true, // Include both sold and active for comparison
      });

      console.log('[CMAInterface] ✨ Generated auto-filters:', {
        selectedPropertyTypes: autoFilters.selectedPropertyTypes,
        propertyCategory: autoFilters.propertyCategory,
        fullFilters: autoFilters
      });

      return autoFilters;
    }

    console.log('[CMAInterface] ⚠️ No propertyParams - using default filters');

    // Default filters when no property is selected (UI pipeline)
    // Default to all residential property types to avoid "No properties found" message
    return {
      propertyType: 'all' as const,
      selectedPropertyTypes: ['house', 'condo', 'townhouse'], // Default: all residential types
      propertyCategory: 'both' as const,
      priceRange: { min: 0, max: 2000000 },
      bedrooms: { min: 0, max: 10 },
      bathrooms: { min: 0, max: 10 },
      squareFootage: { min: 0, max: 10000 },
      yearBuilt: { min: 1900, max: new Date().getFullYear() },
      listingStatus: 'both' as const,
      dateRange: {
        start: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
        end: new Date()
      }
    };
  }, [propertyParams]);

  const [selectedFilters, setSelectedFilters] = useState<CMAFilters>(initialFilters);

  // Sync filters with memoized initialFilters when propertyParams changes
  // This avoids duplicate extraction/generation - useMemo already handles that
  React.useEffect(() => {
    if (propertyParams) {
      setSelectedFilters(initialFilters);
      // Log auto-filter description for debugging
      const filterParams = toPropertyFilterParams(propertyParams);
      console.log('[CMAInterface] Auto-filters:', describeAutoFilters(filterParams, initialFilters));
    }
  }, [propertyParams, initialFilters]);

  // Only enable CMA analysis after filters are properly initialized
  // For popup pipeline: wait until propertyParams has generated auto-filters
  const shouldEnableAnalysis = !!selectedArea && (
    !propertyParams || // No property params (manual workflow)
    (propertyParams && selectedFilters.selectedPropertyTypes && selectedFilters.selectedPropertyTypes.length > 0) // Auto-filters generated
  );

  const { properties: cmaProperties, stats, isLoading, error, dataRanges } = useCMAAnalysis({
    selectedArea,
    filters: selectedFilters,
    enabled: shouldEnableAnalysis
  });

  // Apply client-side filtering (including listingStatus filter)
  // INLINE FILTERING - Direct implementation to ensure it's in bundle
  const filteredProperties = React.useMemo(() => {
    console.log('[CMAInterface] �🔥🔥 USEMEMO EXECUTING 🔥🔥🔥');
    console.log('[CMAInterface] �🔍 Starting inline filter:', {
      totalProperties: cmaProperties.length,
      listingStatus: selectedFilters.listingStatus,
      sampleProperties: cmaProperties.slice(0, 5).map(p => ({
        address: p.address,
        st: p.st,
        status: p.status,
        st_type: typeof p.st,
        st_is_SO: p.st === 'SO',
        st_is_so: p.st === 'so',
        st_lowercase: p.st?.toLowerCase()
      }))
    });

    // Step 1: Filter by listing status using shared utility
    const filtered = filterPropertiesByFilters(cmaProperties, selectedFilters);

    // Log filter statistics
    if (selectedFilters.listingStatus !== 'both') {
      const stats = getFilterStatistics(cmaProperties, filtered, selectedFilters.listingStatus);
      console.log('[CMAInterface] Filter statistics:', stats);
      console.log('[CMAInterface] Filter complete:', {
        beforeFilter: stats.totalCount,
        afterFilter: stats.filteredCount,
        filterType: stats.listingStatus,
        reduction: stats.removedCount
      });
    }

    // Step 2: Add similarity scores and sort
    // For property pipeline: Compare to PropertyParams
    // For area pipeline: Compare to filter criteria center-point
    if (propertyParams) {
      console.log('[CMAInterface] 🎯 Adding similarity scores (property pipeline)');
      // Create reference from PropertyParams directly (no need for extractPropertyReference)
      // Provide defaults for undefined values to satisfy SimilarityReference requirements
      const reference = {
        bedrooms: propertyParams.bedrooms ?? 0,
        bathrooms: propertyParams.bathrooms ?? 0,
        squareFootage: propertyParams.squareFootage ?? 0,
        yearBuilt: propertyParams.yearBuilt ?? new Date().getFullYear(),
        price: propertyParams.price ?? 0
      };
      const withScores = addSimilarityScores(filtered, reference);
      const sorted = sortBySimilarity(withScores);
      console.log('[CMAInterface] ✅ Similarity scoring complete:', {
        propertiesScored: sorted.length,
        topScore: sorted[0]?.similarity_score,
        avgScore: sorted.length > 0 ? Math.round(sorted.reduce((sum, p) => sum + p.similarity_score, 0) / sorted.length) : 0
      });
      return sorted;
    } else {
      console.log('[CMAInterface] 🎯 Adding similarity scores (area pipeline)');
      const reference = extractFilterReference(selectedFilters);
      const withScores = addSimilarityScores(filtered, reference);
      const sorted = sortBySimilarity(withScores);
      console.log('[CMAInterface] ✅ Similarity scoring complete:', {
        propertiesScored: sorted.length,
        topScore: sorted[0]?.similarity_score,
        avgScore: sorted.length > 0 ? Math.round(sorted.reduce((sum, p) => sum + p.similarity_score, 0) / sorted.length) : 0
      });
      return sorted;
    }
  }, [cmaProperties, selectedFilters, propertyParams]);

  // Log filtered count changes
  React.useEffect(() => {
    console.log('[CMAInterface] 🔍 Filtered properties count updated:', {
      unfilteredCount: cmaProperties.length,
      filteredCount: filteredProperties.length,
      listingStatus: selectedFilters.listingStatus,
      difference: cmaProperties.length - filteredProperties.length
    });
  }, [filteredProperties.length, cmaProperties.length, selectedFilters.listingStatus]);

  // Chart generation hook - generates charts when properties are loaded
  const { chartImages, isGenerating: isGeneratingCharts, error: chartError, generateCharts } = useChartGeneration();

  // Calculate effective condo square footage for price estimation
  // Priority: 1. User-entered sqft, 2. PropertyParams sqft, 3. Filter sqft (midpoint), 4. null
  const effectiveCondoSquareFootage = useMemo(() => {
    // If user entered a value via the dialog, use that
    if (userEnteredSquareFootage && userEnteredSquareFootage > 0) {
      console.log('[CMAInterface] Using user-entered square footage:', userEnteredSquareFootage);
      return userEnteredSquareFootage;
    }

    // If PropertyParams has square footage, use it (already extracted!)
    if (propertyParams?.squareFootage && propertyParams.squareFootage > 0) {
      console.log('[CMAInterface] Using PropertyParams square footage:', propertyParams.squareFootage);
      return propertyParams.squareFootage;
    }

    // For area-based CMA (no property selected), use filter sqft range
    // Use midpoint if both min and max are set, otherwise use min or max
    const { min, max } = selectedFilters.squareFootage;
    if (min > 0 && max < 10000 && max > min) {
      // Both min and max set - use midpoint
      const midpoint = Math.round((min + max) / 2);
      console.log('[CMAInterface] Using filter sqft midpoint:', midpoint, '(range:', min, '-', max, ')');
      return midpoint;
    } else if (min > 0 && max >= 10000) {
      // Only min set - use min
      console.log('[CMAInterface] Using filter sqft min:', min);
      return min;
    } else if (min === 0 && max < 10000) {
      // Only max set - use max
      console.log('[CMAInterface] Using filter sqft max:', max);
      return max;
    }

    // No square footage available - analysis will use default
    console.log('[CMAInterface] No sqft source available - using default');
    return null;
  }, [userEnteredSquareFootage, propertyParams, selectedFilters.squareFootage]);

  // Generate charts whenever CMA properties are loaded
  React.useEffect(() => {
    if (filteredProperties.length > 0 && stats && !isLoading) {
      console.log('[CMAInterface] Generating charts for', filteredProperties.length, 'properties');
      generateCharts(filteredProperties, stats);
    }
  }, [filteredProperties, stats, isLoading, generateCharts]);

  const handleFilterChange = useCallback((newFilters: CMAFilters) => {
    console.log('[CMAInterface] Filter change triggered - updating selectedFilters state');
    setSelectedFilters(newFilters);
  }, []);

  const handleGenerateReport = useCallback(() => {
    console.log('[CMAInterface] handleGenerateReport called:', {
      hasSelectedArea: !!selectedArea,
      propertiesCount: filteredProperties.length,
      isLoading,
      error
    });

    if (!selectedArea) {
      onAreaSelectionRequired?.();
      alert('Please select an area on the map first to run CMA analysis.');
      return;
    }

    // Wait for loading to complete before allowing report generation
    if (isLoading) {
      console.warn('[CMAInterface] Still loading, wait for analysis to complete');
      return;
    }

    if (filteredProperties.length === 0) {
      alert('No properties found in the selected area. Try adjusting your filters or selecting a different area.');
      return;
    }

    if (error) {
      alert(`CMA analysis failed: ${error}`);
      return;
    }

    // CRITICAL: Validate property types before generating report
    const validation = PropertyTypeValidator.validateCMASelection(filteredProperties);
    if (!validation.valid) {
      const message = [
        '❌ Property Type Validation Failed',
        '',
        validation.error || 'Invalid property type combination',
        '',
        validation.suggestion || 'Please adjust your selection',
        '',
        `Selected Properties: ${filteredProperties.length}`,
        validation.propertyTypes ? 
          `Property Types: ${PropertyTypeValidator.formatPropertyTypes(validation.propertyTypes)}` : ''
      ].join('\n');
      
      alert(message);
      console.error('[CMAInterface] Property type validation failed:', validation);
      return;
    }

    console.log('[CMAInterface] Property type validation passed:', {
      propertiesCount: filteredProperties.length,
      propertyTypes: Array.from(validation.propertyTypes || [])
    });

    console.log('[CMAInterface] Opening report dialog with', filteredProperties.length, 'properties');
    setIsReportDialogOpen(true);
  }, [selectedArea, filteredProperties, isLoading, error, onAreaSelectionRequired]);

  const handleClearFilters = useCallback(() => {
    setSelectedFilters({
      propertyType: 'all',
      selectedPropertyTypes: ['house', 'condo', 'townhouse'], // Default: all residential types
      propertyCategory: 'both',
      priceRange: { min: 0, max: 2000000 },
      bedrooms: { min: 0, max: 10 },
      bathrooms: { min: 0, max: 10 },
      squareFootage: { min: 0, max: 10000 },
      yearBuilt: { min: 1900, max: new Date().getFullYear() },
      listingStatus: 'both',
      dateRange: {
        start: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        end: new Date()
      }
    });
  }, []);

  // Generate filter badges
  const filterBadges = useMemo(() => {
    const badges: { label: string; value: string }[] = [];

    // Show selected property types from checkbox UI
    if (selectedFilters.selectedPropertyTypes && selectedFilters.selectedPropertyTypes.length > 0) {
      const category = selectedFilters.propertyCategory === 'residential' ? 'Residential' : 'Revenue';
      const typeCount = selectedFilters.selectedPropertyTypes.length;
      badges.push({
        label: category,
        value: `${typeCount} type${typeCount > 1 ? 's' : ''}`
      });
    }
    
    if (selectedFilters.priceRange.min > 0 || selectedFilters.priceRange.max < 2000000) {
      badges.push({ 
        label: 'Price', 
        value: `$${selectedFilters.priceRange.min.toLocaleString()} - $${selectedFilters.priceRange.max.toLocaleString()}` 
      });
    }
    
    if (selectedFilters.bedrooms.min > 0 || selectedFilters.bedrooms.max < 10) {
      badges.push({ 
        label: 'Bedrooms', 
        value: `${selectedFilters.bedrooms.min}-${selectedFilters.bedrooms.max}` 
      });
    }
    
    if (selectedFilters.bathrooms.min > 0 || selectedFilters.bathrooms.max < 10) {
      badges.push({ 
        label: 'Bathrooms', 
        value: `${selectedFilters.bathrooms.min}-${selectedFilters.bathrooms.max}` 
      });
    }
    
    if (selectedFilters.listingStatus !== 'both') {
      badges.push({ label: 'Status', value: selectedFilters.listingStatus });
    }
    
    return badges;
  }, [selectedFilters]);

  // Validate property types and show warning (used for report generation validation)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _propertyTypeValidation = useMemo(() => {
    if (filteredProperties.length === 0) return null;
    return PropertyTypeValidator.validateCMASelection(filteredProperties);
  }, [filteredProperties]);

  // Get property type statistics for display (reserved for future UI)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _propertyTypeStats = useMemo(() => {
    if (filteredProperties.length === 0) return null;
    return PropertyTypeValidator.getTypeStatistics(filteredProperties);
  }, [filteredProperties]);

  // Helper function to format buffer description (reserved for future UI)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _getBufferDescription = () => {
    if (!bufferConfig) return null;

    if (bufferConfig.type === 'radius') {
      return `${bufferConfig.value} ${bufferConfig.unit} radius`;
    } else {
      return `${bufferConfig.value} ${bufferConfig.unit} ${bufferConfig.type === 'drivetime' ? 'drive' : 'walk'}`;
    }
  };

  // Handler for square footage dialog submission (for condos)
  const handleSquareFootageSubmit = useCallback((squareFootage: number) => {
    console.log('[CMAInterface] User entered square footage:', squareFootage, 'sqft');
    console.log('[CMAInterface] Click location:', pendingClickLocation);

    // Store square footage for condo price estimation
    setUserEnteredSquareFootage(squareFootage);
    setIsSquareFootageDialogOpen(false);
    setPendingClickLocation(null);

    // Open the report dialog with the user-entered square footage
    // The CMAReport will use this for condo price calculations
    setIsReportDialogOpen(true);
  }, [pendingClickLocation]);

  const handleSquareFootageCancel = useCallback(() => {
    console.log('[CMAInterface] User canceled square footage dialog');
    setIsSquareFootageDialogOpen(false);
    setPendingClickLocation(null);
  }, []);

  // Handler for comparable property selection changes
  const handleSelectedComparablesChange = useCallback((selectedIds: string[]) => {
    console.log('[CMAInterface] 📥 handleSelectedComparablesChange CALLED:', {
      previousCount: selectedComparableIds.length,
      newCount: selectedIds.length,
      selectedIds,
      timestamp: new Date().toISOString()
    });
    setSelectedComparableIds(selectedIds);
    console.log('[CMAInterface] ✅ State updated with new selection');
  }, [selectedComparableIds.length]);

  return (
    <div className="cma-interface">
      {/* Main CMA Actions */}
      <div className="space-y-4">
        {/* Simplified UI: Only show Generate button and loading/error states */}
        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={() => setIsFilterDialogOpen(true)}
            variant="outline"
            className="flex-1"
            disabled={isLoading}
          >
            <Calculator className="mr-2 h-4 w-4" />
            Adjust Filters
          </Button>
          <Button
            onClick={handleGenerateReport}
            disabled={!selectedArea || (filteredProperties.length === 0 && !isLoading) || isLoading || !!error}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            <FileText className="mr-2 h-4 w-4" />
            {isLoading ? 'Loading...' : 'Generate CMA'}
          </Button>        </div>

        {/* No Properties Found Message */}
        {!isLoading && filteredProperties.length === 0 && selectedArea && !error && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-yellow-800 font-medium text-sm">No properties found</div>
                <div className="text-yellow-700 text-xs mt-1">
                  Click &quot;Adjust Filters&quot; to select property types and adjust your search criteria.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <div className="text-red-600 font-medium">Analysis Error:</div>
              <div className="text-red-700 text-sm">{error}</div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-[#484247]">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#660D39]"></div>
              <span className="text-xs">Loading properties for CMA analysis...</span>
            </div>
          </div>
        )}
      </div>

      {/* Filter Dialog */}
      <CMAFilterDialog
        isOpen={isFilterDialogOpen}
        onClose={() => setIsFilterDialogOpen(false)}
        filters={selectedFilters}
        onFiltersChange={handleFilterChange}
        onGenerateReport={handleGenerateReport}
        propertiesCount={filteredProperties.length}
        selectedArea={selectedArea}
        isLoading={isLoading}
        error={error}
        dataRanges={dataRanges}
      />

      {/* Square Footage Dialog (for condo map clicks) */}
      <SquareFootageDialog
        isOpen={isSquareFootageDialogOpen}
        onSubmit={handleSquareFootageSubmit}
        onCancel={handleSquareFootageCancel}
        propertyType={selectedFilters.propertyType === 'condo' ? 'condo' : 'apartment'}
      />

      {/* Report Dialog */}
      <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
        <DialogContent className="max-w-7xl max-h-[95vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="flex-shrink-0 p-6 pb-4 border-b bg-gradient-to-r from-[#660D39] to-[#670038]">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                <Image
                  src="/BHHS-logo-4.svg"
                  alt="Berkshire Hathaway HomeServices"
                  width={160}
                  height={160}
                  className="brightness-0 invert"
                />
              </div>
              <div>
                <DialogTitle className="flex items-center gap-2 !text-white font-montserrat text-lg font-bold">
                  <FileText className="h-5 w-5 !text-white" />
                  Comparative Market Analysis
                </DialogTitle>
                <DialogDescription className="!text-white text-xs font-montserrat mt-1">
                  Professional Market Analysis • Berkshire Hathaway HomeServices
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* Inline Filters Accordion - Issue #14 */}
          <Accordion type="single" collapsible defaultValue="filters" className="mb-4">
            <AccordionItem value="filters" className="border rounded-lg bg-gray-50">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-[#660D39]" />
                  <span className="font-semibold text-sm text-[#484247]">Filters</span>
                  {filterBadges.length > 0 && (
                    <Badge variant="secondary" className="text-xs ml-2">
                      {filterBadges.length} active
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-4">
                  {/* Property Type Selection */}
                  <div>
                    <Label className="text-xs font-medium text-[#484247] mb-2 block">Property Type</Label>
                    <div className="flex flex-wrap gap-3">
                      {[
                        { id: 'house', label: 'Houses' },
                        { id: 'condo', label: 'Condos' },
                        { id: 'townhouse', label: 'Townhouses' },
                        { id: 'revenue', label: 'Revenue' },
                      ].map((type) => (
                        <div key={type.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`prop-type-${type.id}`}
                            checked={selectedFilters.selectedPropertyTypes?.includes(type.id) ?? false}
                            onCheckedChange={(checked: boolean) => {
                              const current = selectedFilters.selectedPropertyTypes || [];
                              const updated = checked
                                ? [...current, type.id]
                                : current.filter(t => t !== type.id);
                              handleFilterChange({ ...selectedFilters, selectedPropertyTypes: updated });
                            }}
                          />
                          <Label htmlFor={`prop-type-${type.id}`} className="text-xs cursor-pointer">
                            {type.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Listing Status */}
                  <div>
                    <Label className="text-xs font-medium text-[#484247] mb-2 block">Listing Status</Label>
                    <RadioGroup
                      value={selectedFilters.listingStatus}
                      onValueChange={(value: string) => handleFilterChange({ ...selectedFilters, listingStatus: value as 'sold' | 'active' | 'both' })}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="both" id="status-both" />
                        <Label htmlFor="status-both" className="text-xs cursor-pointer">Both</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="sold" id="status-sold" />
                        <Label htmlFor="status-sold" className="text-xs cursor-pointer">Sold Only</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="active" id="status-active" />
                        <Label htmlFor="status-active" className="text-xs cursor-pointer">Active Only</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Essential Filters Row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Bedrooms */}
                    <div>
                      <Label className="text-xs font-medium text-[#484247] mb-1 block">Bedrooms</Label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          placeholder="Min"
                          value={selectedFilters.bedrooms.min || ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFilterChange({
                            ...selectedFilters,
                            bedrooms: { ...selectedFilters.bedrooms, min: parseInt(e.target.value) || 0 }
                          })}
                          className="h-8 text-xs w-16"
                        />
                        <span className="text-xs text-gray-400">-</span>
                        <Input
                          type="number"
                          placeholder="Max"
                          value={selectedFilters.bedrooms.max === 10 ? '' : selectedFilters.bedrooms.max}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFilterChange({
                            ...selectedFilters,
                            bedrooms: { ...selectedFilters.bedrooms, max: parseInt(e.target.value) || 10 }
                          })}
                          className="h-8 text-xs w-16"
                        />
                      </div>
                    </div>

                    {/* Price Range */}
                    <div>
                      <Label className="text-xs font-medium text-[#484247] mb-1 block">Price Range</Label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="text"
                          placeholder="Min"
                          value={selectedFilters.priceRange.min ? `$${selectedFilters.priceRange.min.toLocaleString()}` : ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const value = parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0;
                            handleFilterChange({
                              ...selectedFilters,
                              priceRange: { ...selectedFilters.priceRange, min: value }
                            });
                          }}
                          className="h-8 text-xs w-24"
                        />
                        <span className="text-xs text-gray-400">-</span>
                        <Input
                          type="text"
                          placeholder="Max"
                          value={selectedFilters.priceRange.max && selectedFilters.priceRange.max < 2000000 ? `$${selectedFilters.priceRange.max.toLocaleString()}` : ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const value = parseInt(e.target.value.replace(/[^0-9]/g, '')) || 2000000;
                            handleFilterChange({
                              ...selectedFilters,
                              priceRange: { ...selectedFilters.priceRange, max: value }
                            });
                          }}
                          className="h-8 text-xs w-24"
                        />
                      </div>
                    </div>

                    {/* Bathrooms */}
                    <div>
                      <Label className="text-xs font-medium text-[#484247] mb-1 block">Bathrooms</Label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          placeholder="Min"
                          value={selectedFilters.bathrooms.min || ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFilterChange({
                            ...selectedFilters,
                            bathrooms: { ...selectedFilters.bathrooms, min: parseInt(e.target.value) || 0 }
                          })}
                          className="h-8 text-xs w-16"
                        />
                        <span className="text-xs text-gray-400">-</span>
                        <Input
                          type="number"
                          placeholder="Max"
                          value={selectedFilters.bathrooms.max === 10 ? '' : selectedFilters.bathrooms.max}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFilterChange({
                            ...selectedFilters,
                            bathrooms: { ...selectedFilters.bathrooms, max: parseInt(e.target.value) || 10 }
                          })}
                          className="h-8 text-xs w-16"
                        />
                      </div>
                    </div>

                    {/* Square Footage */}
                    <div>
                      <Label className="text-xs font-medium text-[#484247] mb-1 block">Sq Ft</Label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          placeholder="Min"
                          value={selectedFilters.squareFootage.min || ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFilterChange({
                            ...selectedFilters,
                            squareFootage: { ...selectedFilters.squareFootage, min: parseInt(e.target.value) || 0 }
                          })}
                          className="h-8 text-xs w-16"
                        />
                        <span className="text-xs text-gray-400">-</span>
                        <Input
                          type="number"
                          placeholder="Max"
                          value={selectedFilters.squareFootage.max === 10000 ? '' : selectedFilters.squareFootage.max}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFilterChange({
                            ...selectedFilters,
                            squareFootage: { ...selectedFilters.squareFootage, max: parseInt(e.target.value) || 10000 }
                          })}
                          className="h-8 text-xs w-16"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Clear Filters Button */}
                  <div className="flex justify-end pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearFilters}
                      className="h-7 text-xs text-gray-500 hover:text-gray-700"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Clear Filters
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Quick Stats Preview Panel - Issue #18 */}
          <div className="mb-4">
            <CMAStatsPreview
              properties={filteredProperties}
              isLoading={isLoading}
            />
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
            <Card>
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-[#660D39] mb-1">
                  {isLoading ? '...' : filteredProperties.length}
                </div>
                <div className="text-xs text-[#484247] leading-tight">
                  {selectedArea ? 'Properties in Area' : 'Select Area First'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-[#660D39] mb-1">
                  {isLoading ? '...' : stats.average_cma_score.toFixed(1)}
                </div>
                <div className="text-xs text-[#484247] leading-tight">Average Score</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-[#660D39] mb-1">
                  {stats.average_dom}
                </div>
                <div className="text-xs text-[#484247] leading-tight">Avg Days on Market</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-[#660D39] mb-1">
                  ${stats.price_per_sqft}
                </div>
                <div className="text-xs text-[#484247] leading-tight">Price per Sq Ft</div>
              </CardContent>
            </Card>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
              <div className="flex items-center gap-2">
                <div className="text-red-600 font-medium text-xs">Analysis Error:</div>
                <div className="text-red-700 text-xs">{error}</div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="p-8 text-center">
              <div className="inline-flex items-center gap-2 text-[#484247]">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#660D39]"></div>
                <span className="text-xs">Running CMA analysis for {selectedArea?.displayName}...</span>
              </div>
            </div>
          )}

          {/* Area Info */}
          {selectedArea && filteredProperties.length > 0 && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg mb-4">
              <div className="text-xs">
                <div className="font-medium text-[#484247]">Analysis Area: {selectedArea.displayName}</div>
                <div className="text-[#484247]">
                  Method: {selectedArea.method} |
                  Properties Found: {filteredProperties.length} |
                  Generated: {new Date().toLocaleString()}
                </div>
              </div>
            </div>
          )}

          {/* Chart Generation Status */}
          {isGeneratingCharts && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-xs text-blue-700">Generating charts for PDF...</span>
              </div>
            </div>
          )}

          {chartError && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
              <div className="text-xs text-yellow-700">
                Chart generation failed: {chartError.message}. PDF will be generated without charts.
              </div>
            </div>
          )}

          {/* CMA Report */}
          <CMAReport
            properties={filteredProperties}
            filters={selectedFilters}
            stats={stats}
            analysisData={null}
            selectedArea={selectedArea}
            propertyParams={propertyParams}
            mapView={mapView}
            reportType={selectedFilters.listingStatus === 'sold' ? 'sold' :
                       selectedFilters.listingStatus === 'active' ? 'active' : 'both'}
            chartImages={chartImages}
            searchAddress={searchAddress}
            clickCoordinates={clickCoordinates}
            condoSquareFootage={effectiveCondoSquareFootage}
            selectedComparableIds={selectedComparableIds}
            onSelectedComparablesChange={handleSelectedComparablesChange}
          />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CMAInterface;