"use client";

import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Target,
  Car,
  PersonStanding,
  MapPin,
  Clock,
  Ruler,
  Filter,
  Loader2
} from 'lucide-react';
import { generateAutoFilters, describeAutoFilters, toPropertyFilterParams } from './utils/autoFilterUtils';
import { PropertyDataService } from './services/PropertyDataService';
import type { PropertyParams } from './types';

export interface CMABufferConfig {
  type: 'radius' | 'drivetime' | 'walktime';
  value: number;
  unit: 'km' | 'minutes'; // Note: Only km for radius, minutes for time-based
}

interface CMABufferSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (config: CMABufferConfig) => void;
  initialConfig?: CMABufferConfig;
  propertyParams?: PropertyParams; // Pre-extracted property params (no re-extraction needed)
}

const CMABufferSelectionDialog: React.FC<CMABufferSelectionDialogProps> = ({
  isOpen,
  onClose,
  onSelect,
  initialConfig,
  propertyParams
}) => {
  const [bufferType, setBufferType] = useState<'radius' | 'drivetime' | 'walktime'>(
    initialConfig?.type || 'radius'
  );
  const [bufferValue, setBufferValue] = useState<string>(
    initialConfig?.value?.toString() || '1'
  );
  const [propertyCounts, setPropertyCounts] = useState<Record<string, number>>({});
  const [isCountingProperties, setIsCountingProperties] = useState(false);

  /**
   * Calculate distance in kilometers between two lat/lng points using Haversine formula
   */
  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  /**
   * Calculate property counts for different buffer sizes when dialog opens
   */
  useEffect(() => {
    if (!isOpen || !propertyParams) {
      return;
    }

    const calculatePropertyCounts = async () => {
      setIsCountingProperties(true);
      const counts: Record<string, number> = {};

      try {
        // Get property location from PropertyParams (pre-extracted coordinates)
        if (!propertyParams.coordinates) {
          console.warn('[CMABufferSelectionDialog] PropertyParams has no coordinates');
          setIsCountingProperties(false);
          return;
        }

        const centerLat = propertyParams.coordinates.latitude;
        const centerLon = propertyParams.coordinates.longitude;

        // Validate center coordinates
        if (typeof centerLat !== 'number' || typeof centerLon !== 'number') {
          console.warn('[CMABufferSelectionDialog] PropertyParams has invalid coordinates');
          setIsCountingProperties(false);
          return;
        }

        console.log('[CMABufferSelectionDialog] Calculating property counts for center:', {
          lat: centerLat,
          lon: centerLon,
          address: propertyParams.address
        });

        // Load all properties from PropertyDataService
        const propertyService = PropertyDataService.getInstance();
        const allProperties = await propertyService.loadProperties();

        console.log('[CMABufferSelectionDialog] Loaded properties:', allProperties.length);

        // Count properties within each buffer radius
        const bufferSizes = [0.5, 1, 2, 5, 10]; // km

        for (const bufferKm of bufferSizes) {
          const count = allProperties.filter(prop => {
            const lat = (prop as any).latitude;
            const lon = (prop as any).longitude;

            // Skip properties without valid coordinates
            if (typeof lat !== 'number' || typeof lon !== 'number') {
              return false;
            }

            const distance = calculateDistance(centerLat, centerLon, lat, lon);
            return distance <= bufferKm;
          }).length;

          counts[bufferKm.toString()] = count;
          console.log(`[CMABufferSelectionDialog] Buffer ${bufferKm}km: ${count} properties`);
        }

        setPropertyCounts(counts);
      } catch (error) {
        console.error('[CMABufferSelectionDialog] Error calculating property counts:', error);
      } finally {
        setIsCountingProperties(false);
      }
    };

    calculatePropertyCounts();
  }, [isOpen, propertyParams, calculateDistance]);

  // Generate auto-filter preview based on PropertyParams (no re-extraction needed)
  const autoFilterPreview = useMemo(() => {
    if (!propertyParams) return null;

    // Use PropertyParams directly - no extraction needed!
    const autoFilters = generateAutoFilters(propertyParams, {
      includeAllStatuses: true,
    });

    // Convert to PropertyFilterParams for describeAutoFilters
    const filterParams = toPropertyFilterParams(propertyParams);

    return {
      propertyParams: filterParams,
      filters: autoFilters,
      description: describeAutoFilters(filterParams, autoFilters)
    };
  }, [propertyParams]);

  // Predefined options for each buffer type
  const radiusOptions = [
    { value: '0.5', label: '0.5 km' },
    { value: '1', label: '1 km' },
    { value: '2', label: '2 km' },
    { value: '5', label: '5 km' },
    { value: '10', label: '10 km' }
  ];

  const driveTimeOptions = [
    { value: '5', label: '5-minute drive' },
    { value: '10', label: '10-minute drive' },
    { value: '15', label: '15-minute drive' },
    { value: '20', label: '20-minute drive' },
    { value: '30', label: '30-minute drive' }
  ];

  const walkTimeOptions = [
    { value: '5', label: '5-minute walk' },
    { value: '10', label: '10-minute walk' },
    { value: '15', label: '15-minute walk' },
    { value: '20', label: '20-minute walk' },
    { value: '30', label: '30-minute walk' }
  ];

  const getCurrentOptions = () => {
    switch (bufferType) {
      case 'radius': return radiusOptions;
      case 'drivetime': return driveTimeOptions;
      case 'walktime': return walkTimeOptions;
      default: return radiusOptions;
    }
  };

  const getCurrentUnit = (): 'km' | 'minutes' => {
    return bufferType === 'radius' ? 'km' : 'minutes';
  };

  const getBufferTypeIcon = (type: string) => {
    switch (type) {
      case 'radius': return <Target className="w-5 h-5" />;
      case 'drivetime': return <Car className="w-5 h-5" />;
      case 'walktime': return <PersonStanding className="w-5 h-5" />;
      default: return <Target className="w-5 h-5" />;
    }
  };

  const getBufferTypeLabel = (type: string) => {
    switch (type) {
      case 'radius': return 'Radius Distance';
      case 'drivetime': return 'Driving Time';
      case 'walktime': return 'Walking Time';
      default: return 'Radius Distance';
    }
  };

  const getBufferTypeDescription = (type: string) => {
    switch (type) {
      case 'radius': return 'Circular area around the selected point';
      case 'drivetime': return 'Area reachable by car within specified time';
      case 'walktime': return 'Area reachable on foot within specified time';
      default: return 'Circular area around the selected point';
    }
  };

  const handleConfirm = useCallback(() => {
    const config: CMABufferConfig = {
      type: bufferType,
      value: parseFloat(bufferValue),
      unit: getCurrentUnit()
    };
    onSelect(config);
    onClose();
  }, [bufferType, bufferValue, getCurrentUnit, onSelect, onClose]);

  const handleQuickSelect = useCallback((value: string) => {
    setBufferValue(value);
  }, []);

  const isValidValue = () => {
    const value = parseFloat(bufferValue);
    return !isNaN(value) && value > 0 && value <= (bufferType === 'radius' ? 50 : 120);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-[95vw] sm:w-auto max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0 bg-gradient-to-r from-[#660D39] to-[#670038] p-6 rounded-t-lg">
          <DialogTitle className="flex items-center gap-2 !text-white font-montserrat text-lg font-bold">
            <MapPin className="h-5 w-5 !text-white" />
            Select CMA Buffer
          </DialogTitle>
          <DialogDescription className="text-xs !text-white/90 mt-2 font-montserrat font-bold">
            Choose how to define the area around your selected location for comparative market analysis.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 px-1"
             style={{ maxHeight: 'calc(85vh - 120px)' }}>
          <div className="space-y-6 py-4">
          {/* Buffer Type Selection */}
          <div className="space-y-4">
            <Label className="text-base font-medium text-[#484247] font-montserrat">Buffer Type</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {(['radius', 'drivetime', 'walktime'] as const).map((type) => (
                <Card
                  key={type}
                  className={`cursor-pointer transition-all border-2 ${
                    bufferType === type
                      ? 'border-[#660D39] bg-[#660D39]/10 shadow-md'
                      : 'border-gray-200 hover:border-[#660D39]/50'
                  }`}
                  onClick={() => setBufferType(type)}
                >
                  <CardContent className="p-4 text-center">
                    <div className={`mx-auto mb-3 w-12 h-12 rounded-full flex items-center justify-center ${
                      bufferType === type ? 'bg-[#660D39] text-white font-bold' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {getBufferTypeIcon(type)}
                    </div>
                    <h3 className="font-medium text-sm mb-1 font-montserrat">
                      {getBufferTypeLabel(type)}
                    </h3>
                    <p className="text-xs text-gray-600 font-montserrat">
                      {getBufferTypeDescription(type)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Quick Selection Options */}
          <div className="space-y-4">
            <Label className="text-base font-medium flex items-center gap-2 text-[#484247] font-montserrat">
              {bufferType === 'radius' ? <Ruler className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
              Quick Selection
              {isCountingProperties && bufferType === 'radius' && (
                <span className="ml-2 text-xs text-[#484247]/60 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Counting properties...
                </span>
              )}
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {getCurrentOptions().map((option) => {
                const count = propertyCounts[option.value];
                const showCount = bufferType === 'radius' && count !== undefined;

                return (
                  <Button
                    key={option.value}
                    variant={bufferValue === option.value ? "default" : "outline"}
                    size="sm"
                    className={`text-sm h-auto py-2 font-montserrat flex flex-col gap-1 ${
                      bufferValue === option.value
                        ? 'bg-[#660D39] hover:bg-[#670038] text-white'
                        : 'border-[#660D39] text-[#484247] hover:bg-[#660D39]/10'
                    }`}
                    onClick={() => handleQuickSelect(option.value)}
                  >
                    <span>{option.label}</span>
                    {showCount && (
                      <span className={`text-xs font-normal ${
                        bufferValue === option.value ? 'text-white/80' : 'text-[#484247]/70'
                      }`}>
                        ~{count.toLocaleString()} {count === 1 ? 'property' : 'properties'}
                      </span>
                    )}
                  </Button>
                );
              })}
            </div>
            {bufferType !== 'radius' && (
              <p className="text-xs text-[#484247]/70 font-montserrat italic">
                Property counts are only available for radius buffers. Drive time and walk time counts will be calculated after selection.
              </p>
            )}
          </div>

          {/* Custom Value Input */}
          <div className="space-y-2">
            <Label htmlFor="custom-value" className="text-base font-medium text-[#484247] font-montserrat">
              Custom Value
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="custom-value"
                type="number"
                value={bufferValue}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBufferValue(e.target.value)}
                placeholder={`Enter ${getCurrentUnit()}`}
                min="0.1"
                max={bufferType === 'radius' ? "50" : "120"}
                step="0.1"
                className="flex-1 border-[#660D39] focus:ring-[#660D39] focus:border-[#660D39] font-montserrat"
              />
              <span className="text-sm text-[#484247] min-w-[60px] font-montserrat">
                {getCurrentUnit()}
              </span>
            </div>
            <p className="text-xs text-gray-500 font-montserrat">
              {bufferType === 'radius'
                ? 'Maximum: 50 km'
                : 'Maximum: 120 minutes'}
            </p>
          </div>

          {/* Auto-Filter Preview */}
          {propertyParams && autoFilterPreview && (
            <div className="bg-[#660D39]/10 border-2 border-[#660D39] rounded-lg p-4">
              <h4 className="font-medium text-[#484247] mb-2 flex items-center gap-2 font-montserrat">
                <Filter className="w-4 h-4" />
                Auto-Applied Filters
              </h4>
              <div className="text-sm text-[#484247] mb-2">
                <span className="font-medium">Based on:</span> <span className="break-words">{propertyParams.address || 'Selected property'}</span>
              </div>
              <div className="text-sm text-[#484247] mb-3 leading-relaxed">
                {autoFilterPreview.description}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {autoFilterPreview.propertyParams.bedrooms && (
                  <div className="flex items-center gap-1">
                    <span className="text-[#484247] font-medium">Bedrooms:</span>
                    <span className="bg-[#E0E0E0] px-2 py-1 rounded text-[#484247]">
                      {autoFilterPreview.filters.bedrooms.min}-{autoFilterPreview.filters.bedrooms.max}
                    </span>
                  </div>
                )}
                {autoFilterPreview.propertyParams.bathrooms && (
                  <div className="flex items-center gap-1">
                    <span className="text-[#484247] font-medium">Bathrooms:</span>
                    <span className="bg-[#E0E0E0] px-2 py-1 rounded text-[#484247]">
                      {autoFilterPreview.filters.bathrooms.min}-{autoFilterPreview.filters.bathrooms.max}
                    </span>
                  </div>
                )}
                {autoFilterPreview.propertyParams.squareFootage && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[#484247] font-medium">Sq Ft:</span>
                    <span className="bg-[#E0E0E0] px-2 py-1 rounded text-[#484247]">
                      {(autoFilterPreview.filters.squareFootage?.min ?? 0).toLocaleString()}-{(autoFilterPreview.filters.squareFootage?.max ?? 10000).toLocaleString()}
                    </span>
                  </div>
                )}
                {autoFilterPreview.propertyParams.price && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[#484247] font-medium">Price:</span>
                    <span className="bg-[#E0E0E0] px-2 py-1 rounded text-[#484247]">
                      ${(autoFilterPreview.filters.priceRange?.min ?? 0).toLocaleString()}-${(autoFilterPreview.filters.priceRange?.max ?? 2000000).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Preview Information */}
          {isValidValue() && (
            <div className="bg-[#660D39]/10 border border-[#660D39] rounded-lg p-4">
              <h4 className="font-medium text-[#484247] mb-2">Selected Buffer</h4>
              <div className="flex items-center gap-2 text-sm text-[#484247]">
                {getBufferTypeIcon(bufferType)}
                <span>
                  {bufferValue} {getCurrentUnit()} {getBufferTypeLabel(bufferType).toLowerCase()}
                </span>
              </div>
              <p className="text-xs text-[#484247]/80 mt-2">
                This will analyze comparable properties within this area{propertyParams ? ' using the filters shown above' : ''}.
              </p>
            </div>
          )}
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 flex flex-col sm:flex-row gap-2 mt-4 bg-gray-50 p-4">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto border-[#484247] text-[#484247] hover:bg-[#484247] hover:text-white font-montserrat"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!isValidValue()}
            className="w-full sm:w-auto bg-[#660D39] hover:bg-[#670038] disabled:bg-gray-400 disabled:cursor-not-allowed font-montserrat text-sm font-bold text-white"
          >
            Apply Buffer Selection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export { CMABufferSelectionDialog };
export default CMABufferSelectionDialog;