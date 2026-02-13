/**
 * Property Filter Dialog for Layer Actions
 * 
 * Provides real estate filtering specifically for property layers in the layer list widget.
 * Uses the same filter types as the analysis Real Estate tab.
 */

import React, { useState, useCallback } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Home, DollarSign, Bed, Bath, Square, Calendar as CalendarCheck, Filter, X } from 'lucide-react';
import { format } from 'date-fns';
import type { RealEstateFilterConfig } from '@/components/filtering/types';
import { DEFAULT_REAL_ESTATE_FILTER_CONFIG } from '@/components/filtering/types';

interface PropertyFilterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFilters: (filters: RealEstateFilterConfig) => void;
  layerTitle: string;
  initialFilters?: RealEstateFilterConfig;
  propertyCount?: number;
  totalProperties?: number;
}

const PropertyFilterDialog: React.FC<PropertyFilterDialogProps> = ({
  isOpen,
  onClose,
  onApplyFilters,
  layerTitle,
  initialFilters = DEFAULT_REAL_ESTATE_FILTER_CONFIG,
  propertyCount = 0,
  totalProperties = 0
}) => {
  const [filters, setFilters] = useState<RealEstateFilterConfig>(initialFilters);

  // Helper function to update filters
  const updateFilters = useCallback((updates: Partial<RealEstateFilterConfig>) => {
    setFilters((prev: RealEstateFilterConfig) => ({ ...prev, ...updates }));
  }, []);

  // Individual filter update handlers
  const handlePropertyTypeChange = useCallback((value: string, enabled: boolean) => {
    updateFilters({
      propertyType: {
        enabled,
        value: value as any,
      },
    });
  }, [updateFilters]);

  const handlePriceRangeChange = useCallback((values: number[], enabled: boolean) => {
    updateFilters({
      priceRange: {
        enabled,
        min: values[0],
        max: values[1],
      },
    });
  }, [updateFilters]);

  const handleBedroomsChange = useCallback((values: number[], enabled: boolean) => {
    updateFilters({
      bedrooms: {
        enabled,
        min: values[0],
        max: values[1],
      },
    });
  }, [updateFilters]);

  const handleBathroomsChange = useCallback((values: number[], enabled: boolean) => {
    updateFilters({
      bathrooms: {
        enabled,
        min: values[0],
        max: values[1],
      },
    });
  }, [updateFilters]);

  const handleSquareFootageChange = useCallback((values: number[], enabled: boolean) => {
    updateFilters({
      squareFootage: {
        enabled,
        min: values[0],
        max: values[1],
      },
    });
  }, [updateFilters]);

  const handleYearBuiltChange = useCallback((values: number[], enabled: boolean) => {
    updateFilters({
      yearBuilt: {
        enabled,
        min: values[0],
        max: values[1],
      },
    });
  }, [updateFilters]);

  const handleListingStatusChange = useCallback((value: string, enabled: boolean) => {
    updateFilters({
      listingStatus: {
        enabled,
        value: value as any,
      },
    });
  }, [updateFilters]);

  const handleDateRangeChange = useCallback((field: 'start' | 'end', date: Date | undefined, enabled: boolean) => {
    if (!date) return;
    
    updateFilters({
      dateRange: {
        ...filters.dateRange,
        enabled,
        [field]: date,
      },
    });
  }, [updateFilters, filters.dateRange]);

  // Apply filters and close
  const handleApply = useCallback(() => {
    onApplyFilters(filters);
    onClose();
  }, [filters, onApplyFilters, onClose]);

  // Reset filters
  const handleReset = useCallback(() => {
    setFilters(DEFAULT_REAL_ESTATE_FILTER_CONFIG);
  }, []);

  // Count active filters
  const activeFilters = Object.values(filters).filter(filter => filter.enabled).length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter {layerTitle}
            {activeFilters > 0 && (
              <Badge variant="secondary">
                {activeFilters} active
              </Badge>
            )}
          </DialogTitle>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Badge variant="outline">
              {propertyCount} of {totalProperties} properties match
            </Badge>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
          {/* Property Type */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                Property Type
              </Label>
              <Switch
                checked={filters.propertyType.enabled}
                onCheckedChange={(enabled: boolean) => 
                  handlePropertyTypeChange(filters.propertyType.value, enabled)
                }
              />
            </div>
            <Select
              value={filters.propertyType.value}
              onValueChange={(value: string) => 
                handlePropertyTypeChange(value, filters.propertyType.enabled)
              }
              disabled={!filters.propertyType.enabled}
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

          {/* Listing Status - Show relevant status for the layer */}
          {layerTitle.includes('Active') || layerTitle.includes('Sold') ? null : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Listing Status
                </Label>
                <Switch
                  checked={filters.listingStatus.enabled}
                  onCheckedChange={(enabled: boolean) => 
                    handleListingStatusChange(filters.listingStatus.value, enabled)
                  }
                />
              </div>
              <RadioGroup
                value={filters.listingStatus.value}
                onValueChange={(value: string) => 
                  handleListingStatusChange(value, filters.listingStatus.enabled)
                }
                disabled={!filters.listingStatus.enabled}
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
          )}

          {/* Price Range */}
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Price Range
              </Label>
              <Switch
                checked={filters.priceRange.enabled}
                onCheckedChange={(enabled: boolean) => 
                  handlePriceRangeChange([filters.priceRange.min, filters.priceRange.max], enabled)
                }
              />
            </div>
            <div className="px-3">
              <Slider
                min={0}
                max={2000000}
                step={10000}
                value={[filters.priceRange.min, filters.priceRange.max]}
                onValueChange={(values: number[]) => 
                  handlePriceRangeChange(values, filters.priceRange.enabled)
                }
                disabled={!filters.priceRange.enabled}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-gray-600 mt-1">
                <span>${filters.priceRange.min.toLocaleString()}</span>
                <span>${filters.priceRange.max.toLocaleString()}</span>
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
                checked={filters.bedrooms.enabled}
                onCheckedChange={(enabled: boolean) => 
                  handleBedroomsChange([filters.bedrooms.min, filters.bedrooms.max], enabled)
                }
              />
            </div>
            <div className="px-3">
              <Slider
                min={0}
                max={10}
                step={1}
                value={[filters.bedrooms.min, filters.bedrooms.max]}
                onValueChange={(values: number[]) => 
                  handleBedroomsChange(values, filters.bedrooms.enabled)
                }
                disabled={!filters.bedrooms.enabled}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-gray-600 mt-1">
                <span>{filters.bedrooms.min}</span>
                <span>{filters.bedrooms.max}</span>
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
                checked={filters.bathrooms.enabled}
                onCheckedChange={(enabled: boolean) => 
                  handleBathroomsChange([filters.bathrooms.min, filters.bathrooms.max], enabled)
                }
              />
            </div>
            <div className="px-3">
              <Slider
                min={0}
                max={10}
                step={0.5}
                value={[filters.bathrooms.min, filters.bathrooms.max]}
                onValueChange={(values: number[]) => 
                  handleBathroomsChange(values, filters.bathrooms.enabled)
                }
                disabled={!filters.bathrooms.enabled}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-gray-600 mt-1">
                <span>{filters.bathrooms.min}</span>
                <span>{filters.bathrooms.max}</span>
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
                checked={filters.squareFootage.enabled}
                onCheckedChange={(enabled: boolean) => 
                  handleSquareFootageChange([filters.squareFootage.min, filters.squareFootage.max], enabled)
                }
              />
            </div>
            <div className="px-3">
              <Slider
                min={0}
                max={10000}
                step={100}
                value={[filters.squareFootage.min, filters.squareFootage.max]}
                onValueChange={(values: number[]) => 
                  handleSquareFootageChange(values, filters.squareFootage.enabled)
                }
                disabled={!filters.squareFootage.enabled}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-gray-600 mt-1">
                <span>{filters.squareFootage.min.toLocaleString()} sq ft</span>
                <span>{filters.squareFootage.max.toLocaleString()} sq ft</span>
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
                checked={filters.yearBuilt.enabled}
                onCheckedChange={(enabled: boolean) => 
                  handleYearBuiltChange([filters.yearBuilt.min, filters.yearBuilt.max], enabled)
                }
              />
            </div>
            <div className="px-3">
              <Slider
                min={1900}
                max={new Date().getFullYear()}
                step={1}
                value={[filters.yearBuilt.min, filters.yearBuilt.max]}
                onValueChange={(values: number[]) => 
                  handleYearBuiltChange(values, filters.yearBuilt.enabled)
                }
                disabled={!filters.yearBuilt.enabled}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-gray-600 mt-1">
                <span>{filters.yearBuilt.min}</span>
                <span>{filters.yearBuilt.max}</span>
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
                checked={filters.dateRange.enabled}
                onCheckedChange={(enabled: boolean) => 
                  handleDateRangeChange('start', filters.dateRange.start, enabled)
                }
              />
            </div>
            <div className="flex space-x-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="justify-start text-left font-normal"
                    disabled={!filters.dateRange.enabled}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.dateRange.start 
                      ? format(filters.dateRange.start, "PPP")
                      : "Start date"
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filters.dateRange.start}
                    onSelect={(date: Date | undefined) => 
                      handleDateRangeChange('start', date, filters.dateRange.enabled)
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
                    disabled={!filters.dateRange.enabled}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.dateRange.end 
                      ? format(filters.dateRange.end, "PPP")
                      : "End date"
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filters.dateRange.end}
                    onSelect={(date: Date | undefined) => 
                      handleDateRangeChange('end', date, filters.dateRange.enabled)
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
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-900 mb-2">Active Filters:</h4>
            <div className="flex flex-wrap gap-2">
              {filters.propertyType.enabled && (
                <Badge variant="outline" className="bg-white">
                  Type: {filters.propertyType.value}
                </Badge>
              )}
              {filters.priceRange.enabled && (
                <Badge variant="outline" className="bg-white">
                  Price: ${filters.priceRange.min.toLocaleString()} - ${filters.priceRange.max.toLocaleString()}
                </Badge>
              )}
              {filters.bedrooms.enabled && (
                <Badge variant="outline" className="bg-white">
                  Beds: {filters.bedrooms.min} - {filters.bedrooms.max}
                </Badge>
              )}
              {filters.bathrooms.enabled && (
                <Badge variant="outline" className="bg-white">
                  Baths: {filters.bathrooms.min} - {filters.bathrooms.max}
                </Badge>
              )}
              {filters.squareFootage.enabled && (
                <Badge variant="outline" className="bg-white">
                  Sq Ft: {filters.squareFootage.min.toLocaleString()} - ${filters.squareFootage.max.toLocaleString()}
                </Badge>
              )}
              {filters.yearBuilt.enabled && (
                <Badge variant="outline" className="bg-white">
                  Built: {filters.yearBuilt.min} - {filters.yearBuilt.max}
                </Badge>
              )}
              {filters.listingStatus.enabled && (
                <Badge variant="outline" className="bg-white">
                  Status: {filters.listingStatus.value}
                </Badge>
              )}
              {filters.dateRange.enabled && (
                <Badge variant="outline" className="bg-white">
                  Date: {format(filters.dateRange.start, "MMM d")} - {format(filters.dateRange.end, "MMM d, yyyy")}
                </Badge>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            <Badge variant="outline" className="mr-2">
              {propertyCount} properties selected
            </Badge>
            Ready to apply filters
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={handleReset}>
              Reset
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleApply}
              className="bg-[#2C5AA0] hover:bg-[#1e3f73]"
            >
              Apply Filters
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PropertyFilterDialog;