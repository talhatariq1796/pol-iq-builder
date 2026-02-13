"use client";

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calculator,
  Loader2,
  Filter,
  X
} from 'lucide-react';
import { CMABufferSelectionDialog, CMABufferConfig } from './CMABufferSelectionDialog';
import { CMAFilterDialog } from './CMAFilterDialog';
import { CMAReport } from './CMAReport';
import { useCMAAnalysis } from './hooks/useCMAAnalysis';
import { useChartGeneration } from '@/hooks/useChartGeneration';
import type { CMAFilters, AreaSelection, PropertyParams } from './types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { FileText } from 'lucide-react';
import Image from 'next/image';
import { filterPropertiesByFilters } from './utils/filterProperties';
import {
  addSimilarityScores,
  sortBySimilarity,
  extractFilterReference
} from './utils/similarityScore';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CMAStatsPreview } from './CMAStatsPreview';

interface CMACardProps {
  selectedArea?: AreaSelection;
  onAreaSelectionRequired?: () => void;
  isSelected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  // Props to distinguish popup-initiated CMA vs analysis UI CMA
  fromPopup?: boolean;
  forceBufferDialog?: boolean;
  // Callback to expose CMA data to parent
  onCMADataChange?: (data: { bufferConfig: CMABufferConfig; properties: any[]; stats: any; filters: CMAFilters }) => void;
  // Pre-extracted property params (replaces selectedProperty: __esri.Graphic)
  propertyParams?: PropertyParams;
}

const CMACard: React.FC<CMACardProps> = ({
  selectedArea,
  onAreaSelectionRequired,
  isSelected = false,
  onClick,
  disabled = false,
  className = "",
  fromPopup = false,
  forceBufferDialog = false,
  onCMADataChange,
  propertyParams
}) => {
  const [isBufferDialogOpen, setIsBufferDialogOpen] = useState(false);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [pendingReportOpen, setPendingReportOpen] = useState(false);
  const [bufferConfig, setBufferConfig] = useState<CMABufferConfig>({
    type: 'radius',
    value: 1,
    unit: 'km'
  });

  // Selected comparable property IDs for PDF generation
  // When empty, all filtered properties are used (default behavior)
  const [selectedComparableIds, setSelectedComparableIds] = useState<string[]>([]);

  // Handler for comparable property selection changes
  const handleSelectedComparablesChange = useCallback((selectedIds: string[]) => {
    console.log('[CMACard] 📥 handleSelectedComparablesChange CALLED:', {
      previousCount: selectedComparableIds.length,
      newCount: selectedIds.length,
      selectedIds,
      timestamp: new Date().toISOString()
    });
    setSelectedComparableIds(selectedIds);
  }, [selectedComparableIds.length]);

  // Initialize filters from PropertyParams if available (no re-extraction needed)
  const getInitialFilters = useCallback((): CMAFilters => {
    if (propertyParams) {
      // Use pre-extracted PropertyParams directly - much cleaner!
      const beds = propertyParams.bedrooms || 0;
      const baths = propertyParams.bathrooms || 0;
      const sqft = propertyParams.squareFootage || 0;
      const price = propertyParams.price || 0;
      const yearBuilt = propertyParams.yearBuilt || new Date().getFullYear();

      return {
        propertyType: 'all',
        // Only set price range if we have a valid price, otherwise use full range
        priceRange: {
          min: price > 0 ? Math.round(price * 0.8) : 0,
          max: price > 0 ? Math.round(price * 1.2) : 2000000
        },
        bedrooms: {
          min: beds > 0 ? Math.max(0, beds - 1) : 0,
          max: beds > 0 ? beds + 1 : 10
        },
        bathrooms: {
          min: baths > 0 ? Math.max(0, baths - 1) : 0,
          max: baths > 0 ? baths + 1 : 10
        },
        squareFootage: {
          min: sqft > 0 ? Math.max(0, sqft * 0.8) : 0,
          max: sqft > 0 ? sqft * 1.2 : 10000
        },
        yearBuilt: {
          min: yearBuilt > 1900 ? yearBuilt - 10 : 1900,
          max: yearBuilt > 1900 ? yearBuilt + 10 : new Date().getFullYear()
        },
        listingStatus: 'both',
        dateRange: {
          start: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
          end: new Date()
        }
      };
    }

    // Default filters when no property selected
    return {
      propertyType: 'all',
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
    };
  }, [propertyParams]);

  const [filters, setFilters] = useState<CMAFilters>(getInitialFilters);

  // Update filters when PropertyParams changes
  useEffect(() => {
    setFilters(getInitialFilters());
  }, [propertyParams, getInitialFilters]);

  const { properties, stats, isLoading, error, dataRanges } = useCMAAnalysis({
    selectedArea,
    filters,
    enabled: !!selectedArea
  });

  // Apply client-side filtering using shared utility
  const filteredProperties = React.useMemo(() => {
    console.log('[CMACard] Starting filter:', {
      totalProperties: properties.length,
      listingStatus: filters.listingStatus
    });

    // Step 1: Filter by listing status and other criteria
    const filtered = filterPropertiesByFilters(properties, filters);

    console.log('[CMACard] Filter complete:', {
      beforeFilter: properties.length,
      afterFilter: filtered.length,
      filterType: filters.listingStatus
    });

    // Step 2: Add similarity scores and sort
    // For property pipeline: Compare to PropertyParams
    // For area pipeline: Compare to filter criteria center-point
    if (propertyParams) {
      console.log('[CMACard] Adding similarity scores (property pipeline)');
      const reference = {
        bedrooms: propertyParams.bedrooms ?? 0,
        bathrooms: propertyParams.bathrooms ?? 0,
        squareFootage: propertyParams.squareFootage ?? 0,
        yearBuilt: propertyParams.yearBuilt ?? new Date().getFullYear(),
        price: propertyParams.price ?? 0
      };
      const withScores = addSimilarityScores(filtered, reference);
      const sorted = sortBySimilarity(withScores);
      console.log('[CMACard] Similarity scoring complete:', {
        propertiesScored: sorted.length,
        topScore: sorted[0]?.similarity_score,
        avgScore: sorted.length > 0 ? Math.round(sorted.reduce((sum, p) => sum + p.similarity_score, 0) / sorted.length) : 0
      });
      return sorted;
    } else {
      console.log('[CMACard] Adding similarity scores (area pipeline)');
      const reference = extractFilterReference(filters);
      const withScores = addSimilarityScores(filtered, reference);
      const sorted = sortBySimilarity(withScores);
      console.log('[CMACard] Similarity scoring complete:', {
        propertiesScored: sorted.length,
        topScore: sorted[0]?.similarity_score,
        avgScore: sorted.length > 0 ? Math.round(sorted.reduce((sum, p) => sum + p.similarity_score, 0) / sorted.length) : 0
      });
      return sorted;
    }
  }, [properties, filters, propertyParams]);

  // Chart generation for CMACard's own report dialog
  // This is separate from CMAInterface and won't cause race condition since they open independently
  const { chartImages, isGenerating: isGeneratingCharts, error: chartError, generateCharts } = useChartGeneration();

  // Generate charts when report dialog opens (only if not already generated)
  useEffect(() => {
    if (isReportDialogOpen && filteredProperties.length > 0 && stats && !chartImages && !isGeneratingCharts) {
      console.log('[CMACard] Report dialog opened - generating charts for', filteredProperties.length, 'properties');
      generateCharts(filteredProperties, stats);
    }
  }, [isReportDialogOpen, filteredProperties, stats, chartImages, isGeneratingCharts, generateCharts]);

  // Notify parent of CMA data changes
  useEffect(() => {
    if (onCMADataChange) {
      onCMADataChange({ bufferConfig, properties: filteredProperties, stats, filters });
    }
  }, [bufferConfig, filteredProperties, stats, filters, onCMADataChange]);

  // Open report dialog when loading completes (replaces polling anti-pattern)
  useEffect(() => {
    if (pendingReportOpen && !isLoading) {
      console.log('[CMACard] Data loaded, opening report dialog');
      setIsReportDialogOpen(true);
      setPendingReportOpen(false);
    }
  }, [pendingReportOpen, isLoading]);

  const handleCardClick = useCallback(() => {
    console.log('[CMACard] Card clicked:', {
      disabled,
      hasSelectedArea: !!selectedArea,
      fromPopup,
      forceBufferDialog,
      selectedAreaSource: (selectedArea as any)?.source
    });

    if (disabled) return;

    if (!selectedArea) {
      onAreaSelectionRequired?.();
      return;
    }

    onClick?.();

    // Only show buffer dialog if:
    // 1. Explicitly forced (forceBufferDialog = true)
    // 2. Coming from popup (fromPopup = true)
    // Skip buffer dialog for analysis UI (fromPopup = false)
    const shouldShowBufferDialog = forceBufferDialog || fromPopup;

    console.log('[CMACard] shouldShowBufferDialog:', shouldShowBufferDialog);

    if (shouldShowBufferDialog) {
      console.log('[CMACard] Opening buffer dialog');
      setIsBufferDialogOpen(true);
    } else {
      // Streamlined workflow: Skip intermediate filter dialog, go directly to report
      // User can adjust filters via "Adjust Filters" button in CMAInterface if needed
      console.log('[CMACard] Skipping buffer dialog, opening report directly');
      if (isLoading) {
        setPendingReportOpen(true);
      } else {
        setIsReportDialogOpen(true);
      }
    }
  }, [disabled, selectedArea, onAreaSelectionRequired, onClick, fromPopup, forceBufferDialog, isLoading]);

  const handleBufferSelect = useCallback((config: CMABufferConfig) => {
    console.log('[CMACard] Buffer selected:', { config, fromPopup });
    setBufferConfig(config);
    setIsBufferDialogOpen(false);

    // Streamlined workflow: If from popup, skip filter dialog and go straight to report
    if (fromPopup) {
      console.log('[CMACard] Popup pipeline: Skipping filter dialog, opening report directly');
      // Use pendingReportOpen flag - useEffect will open dialog when loading completes
      if (isLoading) {
        setPendingReportOpen(true);
      } else {
        // Data already loaded, open immediately
        setIsReportDialogOpen(true);
      }
    } else {
      console.log('[CMACard] UI pipeline: Opening filter dialog');
      setIsFilterDialogOpen(true);
    }
  }, [fromPopup, isLoading]);

  const handleGenerateReport = useCallback(() => {
    console.log('[CMACard] handleGenerateReport called:', {
      hasSelectedArea: !!selectedArea,
      propertiesCount: filteredProperties.length,
      isLoading,
      error
    });

    if (!selectedArea) {
      alert('Please select an area on the map first to run CMA analysis.');
      return;
    }

    // Wait for loading to complete before allowing report generation
    if (isLoading) {
      console.warn('[CMACard] Still loading, wait for analysis to complete');
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

    console.log('[CMACard] Opening report dialog with', filteredProperties.length, 'properties');
    setIsFilterDialogOpen(false);
    setIsReportDialogOpen(true);
  }, [selectedArea, filteredProperties.length, isLoading, error]);

  // Generate filter badges for inline accordion
  const filterBadges = useMemo(() => {
    const badges: { label: string; value: string }[] = [];

    if (filters.propertyType !== 'all') {
      badges.push({ label: 'Type', value: filters.propertyType.charAt(0).toUpperCase() + filters.propertyType.slice(1) });
    }
    if (filters.priceRange.min > 0 || filters.priceRange.max < 2000000) {
      badges.push({
        label: 'Price',
        value: `$${filters.priceRange.min.toLocaleString()} - $${filters.priceRange.max.toLocaleString()}`
      });
    }
    if (filters.bedrooms.min > 0 || filters.bedrooms.max < 10) {
      badges.push({ label: 'Beds', value: `${filters.bedrooms.min}-${filters.bedrooms.max}` });
    }
    if (filters.bathrooms.min > 0 || filters.bathrooms.max < 10) {
      badges.push({ label: 'Baths', value: `${filters.bathrooms.min}-${filters.bathrooms.max}` });
    }
    if (filters.squareFootage.min > 0 || filters.squareFootage.max < 10000) {
      badges.push({ label: 'SqFt', value: `${filters.squareFootage.min}-${filters.squareFootage.max}` });
    }
    if (filters.listingStatus !== 'both') {
      badges.push({ label: 'Status', value: filters.listingStatus === 'sold' ? 'Sold Only' : 'Active Only' });
    }

    return badges;
  }, [filters]);

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: CMAFilters) => {
    console.log('[CMACard] Filter change triggered');
    setFilters(newFilters);
  }, []);

  // Clear all filters to defaults
  const handleClearFilters = useCallback(() => {
    setFilters({
      propertyType: 'all',
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

  // Card is disabled if explicitly disabled OR if still loading
  const isCardDisabled = disabled || isLoading;

  return (
    <>
      <Card
        className={`transition-all h-32 animate-entrance ${
          isSelected ? 'theme-analysis-card-selected' : 'theme-analysis-card'
        } ${isCardDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
        onClick={isCardDisabled ? undefined : handleCardClick}
      >
        <CardHeader className="!p-3 !pb-1">
          <CardTitle className="flex items-center gap-2 text-xs">
            <Calculator className="h-5 w-5 text-[#660D39] flex-shrink-0" />
            <span className="text-sm font-bold text-[#484247]">CMA</span>
            {isLoading && <Loader2 className="h-3 w-3 animate-spin text-[#660D39] ml-auto" />}
          </CardTitle>
        </CardHeader>

        <CardContent className="!p-3 !pt-0">
          <div className="text-xs theme-text-secondary leading-tight">
            <p className="text-left">Comparative Market Analysis</p>
          </div>
        </CardContent>
      </Card>

      {/* Buffer Selection Dialog */}
      <CMABufferSelectionDialog
        isOpen={isBufferDialogOpen}
        onClose={() => setIsBufferDialogOpen(false)}
        onSelect={handleBufferSelect}
        initialConfig={bufferConfig}
      />

      {/* Filter Dialog */}
      <CMAFilterDialog
        isOpen={isFilterDialogOpen}
        onClose={() => setIsFilterDialogOpen(false)}
        filters={filters}
        onFiltersChange={setFilters}
        onGenerateReport={handleGenerateReport}
        propertiesCount={filteredProperties.length}
        selectedArea={selectedArea}
        isLoading={isLoading}
        error={error}
        dataRanges={dataRanges}
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

            {/* Inline Filters Accordion */}
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
                    {/* Property Type and Listing Status Row */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Property Type */}
                      <div>
                        <Label className="text-xs font-medium text-[#484247] mb-2 block">Property Type</Label>
                        <RadioGroup
                          value={filters.propertyType}
                          onValueChange={(value: string) => handleFilterChange({ ...filters, propertyType: value as 'all' | 'house' | 'condo' | 'townhouse' | 'apartment' | 'duplex' | 'commercial' | 'revenue' })}
                          className="flex gap-3 flex-wrap"
                        >
                          <div className="flex items-center space-x-1">
                            <RadioGroupItem value="all" id="cmacard-type-all" />
                            <Label htmlFor="cmacard-type-all" className="text-xs cursor-pointer">All</Label>
                          </div>
                          <div className="flex items-center space-x-1">
                            <RadioGroupItem value="house" id="cmacard-type-house" />
                            <Label htmlFor="cmacard-type-house" className="text-xs cursor-pointer">House</Label>
                          </div>
                          <div className="flex items-center space-x-1">
                            <RadioGroupItem value="condo" id="cmacard-type-condo" />
                            <Label htmlFor="cmacard-type-condo" className="text-xs cursor-pointer">Condo</Label>
                          </div>
                          <div className="flex items-center space-x-1">
                            <RadioGroupItem value="revenue" id="cmacard-type-revenue" />
                            <Label htmlFor="cmacard-type-revenue" className="text-xs cursor-pointer">Revenue</Label>
                          </div>
                        </RadioGroup>
                      </div>

                      {/* Listing Status */}
                      <div>
                        <Label className="text-xs font-medium text-[#484247] mb-2 block">Listing Status</Label>
                        <RadioGroup
                          value={filters.listingStatus}
                          onValueChange={(value: string) => handleFilterChange({ ...filters, listingStatus: value as 'sold' | 'active' | 'both' })}
                          className="flex gap-3"
                        >
                          <div className="flex items-center space-x-1">
                            <RadioGroupItem value="both" id="cmacard-status-both" />
                            <Label htmlFor="cmacard-status-both" className="text-xs cursor-pointer">Both</Label>
                          </div>
                          <div className="flex items-center space-x-1">
                            <RadioGroupItem value="sold" id="cmacard-status-sold" />
                            <Label htmlFor="cmacard-status-sold" className="text-xs cursor-pointer">Sold</Label>
                          </div>
                          <div className="flex items-center space-x-1">
                            <RadioGroupItem value="active" id="cmacard-status-active" />
                            <Label htmlFor="cmacard-status-active" className="text-xs cursor-pointer">Active</Label>
                          </div>
                        </RadioGroup>
                      </div>
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
                            value={filters.bedrooms.min || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFilterChange({
                              ...filters,
                              bedrooms: { ...filters.bedrooms, min: parseInt(e.target.value) || 0 }
                            })}
                            className="h-8 text-xs w-16"
                          />
                          <span className="text-xs text-gray-400">-</span>
                          <Input
                            type="number"
                            placeholder="Max"
                            value={filters.bedrooms.max === 10 ? '' : filters.bedrooms.max}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFilterChange({
                              ...filters,
                              bedrooms: { ...filters.bedrooms, max: parseInt(e.target.value) || 10 }
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
                            value={filters.priceRange.min ? `$${filters.priceRange.min.toLocaleString()}` : ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                              const value = parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0;
                              handleFilterChange({
                                ...filters,
                                priceRange: { ...filters.priceRange, min: value }
                              });
                            }}
                            className="h-8 text-xs w-24"
                          />
                          <span className="text-xs text-gray-400">-</span>
                          <Input
                            type="text"
                            placeholder="Max"
                            value={filters.priceRange.max && filters.priceRange.max < 2000000 ? `$${filters.priceRange.max.toLocaleString()}` : ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                              const value = parseInt(e.target.value.replace(/[^0-9]/g, '')) || 2000000;
                              handleFilterChange({
                                ...filters,
                                priceRange: { ...filters.priceRange, max: value }
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
                            value={filters.bathrooms.min || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFilterChange({
                              ...filters,
                              bathrooms: { ...filters.bathrooms, min: parseInt(e.target.value) || 0 }
                            })}
                            className="h-8 text-xs w-16"
                          />
                          <span className="text-xs text-gray-400">-</span>
                          <Input
                            type="number"
                            placeholder="Max"
                            value={filters.bathrooms.max === 10 ? '' : filters.bathrooms.max}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFilterChange({
                              ...filters,
                              bathrooms: { ...filters.bathrooms, max: parseInt(e.target.value) || 10 }
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
                            value={filters.squareFootage.min || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFilterChange({
                              ...filters,
                              squareFootage: { ...filters.squareFootage, min: parseInt(e.target.value) || 0 }
                            })}
                            className="h-8 text-xs w-16"
                          />
                          <span className="text-xs text-gray-400">-</span>
                          <Input
                            type="number"
                            placeholder="Max"
                            value={filters.squareFootage.max === 10000 ? '' : filters.squareFootage.max}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFilterChange({
                              ...filters,
                              squareFootage: { ...filters.squareFootage, max: parseInt(e.target.value) || 10000 }
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

            {/* Quick Stats Preview Panel */}
            <div className="mb-4">
              <CMAStatsPreview
                properties={filteredProperties}
                isLoading={isLoading}
              />
            </div>

            {/* CMA Report with full functionality */}
            <CMAReport
              properties={filteredProperties}
              filters={filters}
              stats={stats}
              analysisData={null}
              selectedArea={selectedArea}
              propertyParams={propertyParams}
              reportType={filters.listingStatus === 'sold' ? 'sold' :
                         filters.listingStatus === 'active' ? 'active' : 'both'}
              chartImages={chartImages}
              hideReportTypeSelector={true}
              searchAddress={selectedArea?.method === 'search' ? selectedArea.displayName : undefined}
              clickCoordinates={(() => {
                // Extract centroid coordinates from area selection for reverse geocoding
                // This enables address resolution on PDF cover page when no specific property/address is selected
                const centroid = selectedArea?.metadata?.centroid as __esri.Point | undefined;
                if (centroid && typeof centroid.latitude === 'number' && typeof centroid.longitude === 'number') {
                  return {
                    lat: centroid.latitude,
                    lng: centroid.longitude
                  };
                }
                return undefined;
              })()}
              selectedComparableIds={selectedComparableIds}
              onSelectedComparablesChange={handleSelectedComparablesChange}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export { CMACard };
export default CMACard;