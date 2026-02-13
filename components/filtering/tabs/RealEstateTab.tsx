/**
 * Real Estate Filter Tab Component
 * 
 * Provides broker-friendly filtering options for property analysis.
 * Integrates CMA-style filters into the advanced filter dialog.
 */

import React, { useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Home, DollarSign, Bed, Bath, Square, Calendar as CalendarCheck, Filter } from 'lucide-react';
import { format } from 'date-fns';
import type { FilterTabProps, RealEstateFilterConfig } from '../types';

interface RealEstateTabProps extends FilterTabProps {
  // Additional props specific to real estate filtering
  totalProperties?: number;
  filteredProperties?: number;
}

const RealEstateTab: React.FC<RealEstateTabProps> = ({
  config,
  onConfigChange,
  totalProperties = 0,
  filteredProperties = 0,
}) => {
  const { realEstateFilters } = config;

  // Helper function to update real estate filters
  const updateRealEstateFilters = useCallback((updates: Partial<RealEstateFilterConfig>) => {
    const newConfig = {
      ...config,
      realEstateFilters: {
        ...realEstateFilters,
        ...updates,
      },
    };
    onConfigChange(newConfig);
  }, [config, realEstateFilters, onConfigChange]);

  // Individual filter update handlers
  const handlePropertyTypeChange = useCallback((value: string, enabled: boolean) => {
    updateRealEstateFilters({
      propertyType: {
        enabled,
        value: value as any,
      },
    });
  }, [updateRealEstateFilters]);

  const handlePriceRangeChange = useCallback((values: number[], enabled: boolean) => {
    updateRealEstateFilters({
      priceRange: {
        enabled,
        min: values[0],
        max: values[1],
      },
    });
  }, [updateRealEstateFilters]);

  const handleBedroomsChange = useCallback((values: number[], enabled: boolean) => {
    updateRealEstateFilters({
      bedrooms: {
        enabled,
        min: values[0],
        max: values[1],
      },
    });
  }, [updateRealEstateFilters]);

  const handleBathroomsChange = useCallback((values: number[], enabled: boolean) => {
    updateRealEstateFilters({
      bathrooms: {
        enabled,
        min: values[0],
        max: values[1],
      },
    });
  }, [updateRealEstateFilters]);

  const handleSquareFootageChange = useCallback((values: number[], enabled: boolean) => {
    updateRealEstateFilters({
      squareFootage: {
        enabled,
        min: values[0],
        max: values[1],
      },
    });
  }, [updateRealEstateFilters]);

  const handleYearBuiltChange = useCallback((values: number[], enabled: boolean) => {
    updateRealEstateFilters({
      yearBuilt: {
        enabled,
        min: values[0],
        max: values[1],
      },
    });
  }, [updateRealEstateFilters]);

  const handleListingStatusChange = useCallback((value: string, enabled: boolean) => {
    updateRealEstateFilters({
      listingStatus: {
        enabled,
        value: value as any,
      },
    });
  }, [updateRealEstateFilters]);

  const handleDateRangeChange = useCallback((field: 'start' | 'end', date: Date | undefined, enabled: boolean) => {
    if (!date) return;
    
    updateRealEstateFilters({
      dateRange: {
        ...realEstateFilters.dateRange,
        enabled,
        [field]: date,
      },
    });
  }, [updateRealEstateFilters, realEstateFilters.dateRange]);

  // Count active filters
  const activeFilters = Object.values(realEstateFilters).filter(filter => filter.enabled).length;

  return (
    <div className="space-y-6 p-4">
      {/* Header with property count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Home className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Real Estate Filters</h3>
          {activeFilters > 0 && (
            <Badge variant="secondary">
              {activeFilters} active
            </Badge>
          )}
        </div>
        <div className="text-sm text-gray-600">
          <Badge variant="outline">
            {filteredProperties} of {totalProperties} properties
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Property Type */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Property Type
            </Label>
            <Switch
              checked={realEstateFilters.propertyType.enabled}
              onCheckedChange={(enabled: boolean) => 
                handlePropertyTypeChange(realEstateFilters.propertyType.value, enabled)
              }
            />
          </div>
          <Select
            value={realEstateFilters.propertyType.value}
            onValueChange={(value: string) => 
              handlePropertyTypeChange(value, realEstateFilters.propertyType.enabled)
            }
            disabled={!realEstateFilters.propertyType.enabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select property type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="house">House</SelectItem>
              <SelectItem value="condo">Condo</SelectItem>
              <SelectItem value="townhouse">Townhouse</SelectItem>
              <SelectItem value="apartment">Apartment</SelectItem>
              <SelectItem value="duplex">Duplex</SelectItem>
              <SelectItem value="commercial">Commercial</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Listing Status */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Listing Status
            </Label>
            <Switch
              checked={realEstateFilters.listingStatus.enabled}
              onCheckedChange={(enabled: boolean) => 
                handleListingStatusChange(realEstateFilters.listingStatus.value, enabled)
              }
            />
          </div>
          <RadioGroup
            value={realEstateFilters.listingStatus.value}
            onValueChange={(value: string) => 
              handleListingStatusChange(value, realEstateFilters.listingStatus.enabled)
            }
            disabled={!realEstateFilters.listingStatus.enabled}
            className="flex space-x-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="both" id="both" />
              <Label htmlFor="both">Both</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="sold" id="sold" />
              <Label htmlFor="sold">Sold</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="active" id="active" />
              <Label htmlFor="active">Active</Label>
            </div>
          </RadioGroup>
        </div>

        {/* Price Range */}
        <div className="space-y-4 md:col-span-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Price Range
            </Label>
            <Switch
              checked={realEstateFilters.priceRange.enabled}
              onCheckedChange={(enabled: boolean) => 
                handlePriceRangeChange([realEstateFilters.priceRange.min, realEstateFilters.priceRange.max], enabled)
              }
            />
          </div>
          <div className="px-3">
            <Slider
              min={0}
              max={2000000}
              step={10000}
              value={[realEstateFilters.priceRange.min, realEstateFilters.priceRange.max]}
              onValueChange={(values: number[]) => 
                handlePriceRangeChange(values, realEstateFilters.priceRange.enabled)
              }
              disabled={!realEstateFilters.priceRange.enabled}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-gray-600 mt-1">
              <span>${realEstateFilters.priceRange.min.toLocaleString()}</span>
              <span>${realEstateFilters.priceRange.max.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Bedrooms */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Bed className="h-4 w-4" />
              Bedrooms
            </Label>
            <Switch
              checked={realEstateFilters.bedrooms.enabled}
              onCheckedChange={(enabled: boolean) => 
                handleBedroomsChange([realEstateFilters.bedrooms.min, realEstateFilters.bedrooms.max], enabled)
              }
            />
          </div>
          <div className="px-3">
            <Slider
              min={0}
              max={10}
              step={1}
              value={[realEstateFilters.bedrooms.min, realEstateFilters.bedrooms.max]}
              onValueChange={(values: number[]) => 
                handleBedroomsChange(values, realEstateFilters.bedrooms.enabled)
              }
              disabled={!realEstateFilters.bedrooms.enabled}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-gray-600 mt-1">
              <span>{realEstateFilters.bedrooms.min}</span>
              <span>{realEstateFilters.bedrooms.max}</span>
            </div>
          </div>
        </div>

        {/* Bathrooms */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Bath className="h-4 w-4" />
              Bathrooms
            </Label>
            <Switch
              checked={realEstateFilters.bathrooms.enabled}
              onCheckedChange={(enabled: boolean) => 
                handleBathroomsChange([realEstateFilters.bathrooms.min, realEstateFilters.bathrooms.max], enabled)
              }
            />
          </div>
          <div className="px-3">
            <Slider
              min={0}
              max={10}
              step={0.5}
              value={[realEstateFilters.bathrooms.min, realEstateFilters.bathrooms.max]}
              onValueChange={(values: number[]) => 
                handleBathroomsChange(values, realEstateFilters.bathrooms.enabled)
              }
              disabled={!realEstateFilters.bathrooms.enabled}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-gray-600 mt-1">
              <span>{realEstateFilters.bathrooms.min}</span>
              <span>{realEstateFilters.bathrooms.max}</span>
            </div>
          </div>
        </div>

        {/* Square Footage */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Square className="h-4 w-4" />
              Square Footage
            </Label>
            <Switch
              checked={realEstateFilters.squareFootage.enabled}
              onCheckedChange={(enabled: boolean) => 
                handleSquareFootageChange([realEstateFilters.squareFootage.min, realEstateFilters.squareFootage.max], enabled)
              }
            />
          </div>
          <div className="px-3">
            <Slider
              min={0}
              max={10000}
              step={100}
              value={[realEstateFilters.squareFootage.min, realEstateFilters.squareFootage.max]}
              onValueChange={(values: number[]) => 
                handleSquareFootageChange(values, realEstateFilters.squareFootage.enabled)
              }
              disabled={!realEstateFilters.squareFootage.enabled}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-gray-600 mt-1">
              <span>{realEstateFilters.squareFootage.min.toLocaleString()} sq ft</span>
              <span>{realEstateFilters.squareFootage.max.toLocaleString()} sq ft</span>
            </div>
          </div>
        </div>

        {/* Year Built */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4" />
              Year Built
            </Label>
            <Switch
              checked={realEstateFilters.yearBuilt.enabled}
              onCheckedChange={(enabled: boolean) => 
                handleYearBuiltChange([realEstateFilters.yearBuilt.min, realEstateFilters.yearBuilt.max], enabled)
              }
            />
          </div>
          <div className="px-3">
            <Slider
              min={1900}
              max={new Date().getFullYear()}
              step={1}
              value={[realEstateFilters.yearBuilt.min, realEstateFilters.yearBuilt.max]}
              onValueChange={(values: number[]) => 
                handleYearBuiltChange(values, realEstateFilters.yearBuilt.enabled)
              }
              disabled={!realEstateFilters.yearBuilt.enabled}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-gray-600 mt-1">
              <span>{realEstateFilters.yearBuilt.min}</span>
              <span>{realEstateFilters.yearBuilt.max}</span>
            </div>
          </div>
        </div>

        {/* Date Range */}
        <div className="space-y-3 md:col-span-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              Date Range
            </Label>
            <Switch
              checked={realEstateFilters.dateRange.enabled}
              onCheckedChange={(enabled: boolean) => 
                handleDateRangeChange('start', realEstateFilters.dateRange.start, enabled)
              }
            />
          </div>
          <div className="flex space-x-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  className="justify-start text-left font-normal"
                  disabled={!realEstateFilters.dateRange.enabled}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {realEstateFilters.dateRange.start 
                    ? format(realEstateFilters.dateRange.start, "PPP")
                    : "Start date"
                  }
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={realEstateFilters.dateRange.start}
                  onSelect={(date: Date | undefined) => 
                    handleDateRangeChange('start', date, realEstateFilters.dateRange.enabled)
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  className="justify-start text-left font-normal"
                  disabled={!realEstateFilters.dateRange.enabled}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {realEstateFilters.dateRange.end 
                    ? format(realEstateFilters.dateRange.end, "PPP")
                    : "End date"
                  }
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={realEstateFilters.dateRange.end}
                  onSelect={(date: Date | undefined) => 
                    handleDateRangeChange('end', date, realEstateFilters.dateRange.enabled)
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Filter Summary */}
      {activeFilters > 0 && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-medium text-blue-900 mb-2">Active Filters Summary:</h4>
          <div className="flex flex-wrap gap-2">
            {realEstateFilters.propertyType.enabled && (
              <Badge variant="outline" className="bg-white">
                Type: {realEstateFilters.propertyType.value}
              </Badge>
            )}
            {realEstateFilters.priceRange.enabled && (
              <Badge variant="outline" className="bg-white">
                Price: ${realEstateFilters.priceRange.min.toLocaleString()} - ${realEstateFilters.priceRange.max.toLocaleString()}
              </Badge>
            )}
            {realEstateFilters.bedrooms.enabled && (
              <Badge variant="outline" className="bg-white">
                Beds: {realEstateFilters.bedrooms.min} - {realEstateFilters.bedrooms.max}
              </Badge>
            )}
            {realEstateFilters.bathrooms.enabled && (
              <Badge variant="outline" className="bg-white">
                Baths: {realEstateFilters.bathrooms.min} - {realEstateFilters.bathrooms.max}
              </Badge>
            )}
            {realEstateFilters.squareFootage.enabled && (
              <Badge variant="outline" className="bg-white">
                Sq Ft: {realEstateFilters.squareFootage.min.toLocaleString()} - {realEstateFilters.squareFootage.max.toLocaleString()}
              </Badge>
            )}
            {realEstateFilters.yearBuilt.enabled && (
              <Badge variant="outline" className="bg-white">
                Built: {realEstateFilters.yearBuilt.min} - {realEstateFilters.yearBuilt.max}
              </Badge>
            )}
            {realEstateFilters.listingStatus.enabled && (
              <Badge variant="outline" className="bg-white">
                Status: {realEstateFilters.listingStatus.value}
              </Badge>
            )}
            {realEstateFilters.dateRange.enabled && (
              <Badge variant="outline" className="bg-white">
                Date: {format(realEstateFilters.dateRange.start, "MMM d")} - {format(realEstateFilters.dateRange.end, "MMM d, yyyy")}
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RealEstateTab;