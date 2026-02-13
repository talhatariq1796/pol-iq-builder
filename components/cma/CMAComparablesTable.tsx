"use client";

import React, { useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  ArrowUpDown,
  Home,
  MapPin,
  Calendar,
  Ruler,
  Bath,
  Bed,
  Camera,
  Star,
  Download,
  BarChart3,
  CheckSquare,
  Square
} from 'lucide-react';
import { getPropertyImageUrl } from '@/lib/utils/image-resolver';
import { formatPropertyAddress } from '@/lib/utils/addressFormatter';
import type { CMAProperty } from './types';
import type { PropertyCategory } from './propertyTypeConfig';
import { getSimilarityScoreColor } from './utils/similarityScore';

// Memoized property thumbnail to prevent re-renders from image loading
const PropertyThumbnail = React.memo(({ propertyId, centrisNo, address }: { propertyId: string; centrisNo?: string | number; address: string }) => {
  // Use centris_no for image lookup if available, otherwise fall back to propertyId
  // Image resolver expects numeric centris_no like "24450668"
  const imageId = centrisNo?.toString() || propertyId;
  const [imgSrc, setImgSrc] = useState<string>(getPropertyImageUrl(imageId, '/images/property-placeholder.jpg'));
  const [hasError, setHasError] = useState(false);

  const handleError = useCallback(() => {
    if (!hasError) {
      setHasError(true);
      setImgSrc('/images/property-placeholder.jpg');
    }
  }, [hasError]);

  return (
    <div className="w-12 h-8 sm:w-16 sm:h-12 rounded-lg overflow-hidden relative bg-gray-100">
      <Image
        src={imgSrc}
        alt={address || 'Property'}
        width={80}
        height={80}
        className="object-cover w-full h-full"
        onError={handleError}
        loading="lazy"
      />
    </div>
  );
});
PropertyThumbnail.displayName = 'PropertyThumbnail';

interface CMAComparablesTableProps {
  properties: CMAProperty[];
  onPropertySelect?: (property: CMAProperty) => void;
  onSelectedPropertiesChange?: (selectedIds: string[]) => void;
  selectedPropertyIds?: string[]; // Controlled selection from parent
  propertyCategory?: PropertyCategory | 'both'; // Determines which columns to show
  onPropertyHover?: (propertyId: string | null) => void; // NEW: Callback when row is hovered
}

type SortField = keyof CMAProperty | 'price_per_sqft' | 'status_priority' | 'similarity_score';
type SortDirection = 'asc' | 'desc';

const CMAComparablesTable: React.FC<CMAComparablesTableProps> = ({
  properties,
  onPropertySelect,
  onSelectedPropertiesChange,
  selectedPropertyIds,
  propertyCategory = 'both',
  onPropertyHover
}) => {
  // Default sort by similarity_score if available, otherwise cma_score
  const [sortField, setSortField] = useState<SortField>('similarity_score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Track hovered property for map sync
  const [hoveredPropertyId, setHoveredPropertyId] = useState<string | null>(null);

  // Use controlled selection if provided, otherwise use local state
  const [localSelectedProperties, setLocalSelectedProperties] = useState<Set<string>>(new Set());
  const selectedProperties = useMemo(() => {
    if (selectedPropertyIds !== undefined) {
      return new Set(selectedPropertyIds);
    }
    return localSelectedProperties;
  }, [selectedPropertyIds, localSelectedProperties]);

  // Determine which columns to show based on property category AND actual data
  // Smart column visibility: only show revenue columns if there are revenue properties with data
  const hasRevenueData = useMemo(() => {
    return properties.some(p =>
      (p.potential_gross_revenue && p.potential_gross_revenue > 0) ||
      (p.gross_income_multiplier && p.gross_income_multiplier > 0) ||
      ((p as any).pgi && (p as any).pgi > 0) ||
      ((p as any).gim && (p as any).gim > 0)
    );
  }, [properties]);

  // Show revenue columns only if category is revenue OR if we actually have revenue data
  const showRevenueColumns = propertyCategory === 'revenue' || (propertyCategory === 'both' && hasRevenueData);
  // Show residential columns if category is residential, both, or we don't have revenue data
  const showResidentialColumns = propertyCategory === 'residential' || propertyCategory === 'both' || !hasRevenueData;

  // MEMOIZED: Calculate derived values to prevent recalculation on every render
  const propertiesWithDerived = useMemo(() =>
    properties.map(property => ({
      ...property,
      price_per_sqft: property.squareFootage > 0 ? Math.round(property.price / property.squareFootage) : 0,
      status_priority: property.status === 'sold' ? 1 : 2,
      estimated_price: Math.round((property.cma_score || 0) * 5000),
    })),
    [properties]
  );

  // MEMOIZED: Sort properties to prevent re-sorting on every render
  const sortedProperties = useMemo(() => {
    return [...propertiesWithDerived].sort((a, b) => {
      let aValue = a[sortField as keyof typeof a];
      let bValue = b[sortField as keyof typeof b];

      if (aValue === undefined) aValue = 0;
      if (bValue === undefined) bValue = 0;

      const aNum = typeof aValue === 'number' ? aValue : 0;
      const bNum = typeof bValue === 'number' ? bValue : 0;

      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
    });
  }, [propertiesWithDerived, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // MEMOIZED: Toggle property selection (works with both controlled and uncontrolled)
  const togglePropertySelection = useCallback((propertyId: string) => {
    console.log('[CMAComparablesTable] 🔲 togglePropertySelection called:', {
      propertyId,
      isControlled: selectedPropertyIds !== undefined,
      currentControlledCount: selectedPropertyIds?.length,
      currentLocalCount: localSelectedProperties.size,
      hasCallback: !!onSelectedPropertiesChange
    });

    const currentSelected = selectedPropertyIds !== undefined
      ? new Set(selectedPropertyIds)
      : localSelectedProperties;

    const newSelected = new Set(currentSelected);
    if (newSelected.has(propertyId)) {
      newSelected.delete(propertyId);
    } else {
      newSelected.add(propertyId);
    }

    console.log('[CMAComparablesTable] 🔲 Selection updated:', {
      previousCount: currentSelected.size,
      newCount: newSelected.size,
      action: newSelected.has(propertyId) ? 'added' : 'removed',
      newSelectedIds: Array.from(newSelected)
    });

    // Update local state if uncontrolled
    if (selectedPropertyIds === undefined) {
      setLocalSelectedProperties(newSelected);
    }

    // Always notify parent
    console.log('[CMAComparablesTable] 🔔 Calling onSelectedPropertiesChange with', newSelected.size, 'items');
    onSelectedPropertiesChange?.(Array.from(newSelected));
  }, [selectedPropertyIds, localSelectedProperties, onSelectedPropertiesChange]);

  // MEMOIZED: Select/deselect all properties
  const selectAllProperties = useCallback(() => {
    const allSelected = selectedProperties.size === properties.length;
    const newSelected = allSelected ? [] : properties.map(p => p.id);

    // Update local state if uncontrolled
    if (selectedPropertyIds === undefined) {
      setLocalSelectedProperties(new Set(newSelected));
    }

    // Always notify parent
    onSelectedPropertiesChange?.(newSelected);
  }, [selectedProperties.size, properties, selectedPropertyIds, onSelectedPropertiesChange]);

  // MEMOIZED: Clear all selections
  const clearSelection = useCallback(() => {
    if (selectedPropertyIds === undefined) {
      setLocalSelectedProperties(new Set());
    }
    onSelectedPropertiesChange?.([]);
  }, [selectedPropertyIds, onSelectedPropertiesChange]);

  const exportSelectedProperties = () => {
    const selectedProps = properties.filter(p => selectedProperties.has(p.id));
    const csvContent = [
      ['Address', 'Price', 'Bedrooms', 'Bathrooms', 'Square Feet', 'Year Built', 'Status', 'Similarity', 'CMA Score'].join(','),
      ...selectedProps.map(p => [
        `"${p.address}"`,
        p.price,
        p.bedrooms,
        p.bathrooms,
        p.squareFootage,
        p.yearBuilt,
        p.status,
        p.similarity_score ?? 'N/A',
        (p.cma_score || 0).toFixed(1)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cma-comparables-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const viewSelectedComparison = () => {
    const selectedProps = properties.filter(p => selectedProperties.has(p.id));
    console.log('Viewing comparison for:', selectedProps);
    // This would open a detailed comparison modal
    alert(`Comparing ${selectedProps.length} properties. Detailed comparison modal would open here.`);
  };

  const formatPrice = (price: number | undefined | null) => {
    return `$${(price ?? 0).toLocaleString()}`;
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: string) => {
    const isActive = status.toLowerCase() === 'active';
    return (
      <Badge 
        variant={isActive ? "destructive" : "default"}
        className={isActive ? "bg-red-500 text-white" : "bg-green-500 text-white"}
      >
        {status.toUpperCase()}
      </Badge>
    );
  };

  const getCMAScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600 font-bold";
    if (score >= 80) return "text-blue-600 font-semibold";
    if (score >= 70) return "text-orange-600";
    return "text-gray-600";
  };

  const SortButton: React.FC<{ field: SortField; children: React.ReactNode }> = ({ field, children }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => handleSort(field)}
      className="h-auto p-1 font-semibold text-left justify-start"
    >
      {children}
      <ArrowUpDown className="ml-1 h-3 w-3" />
    </Button>
  );

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Home className="h-5 w-5" />
            <span className="text-base sm:text-lg">Comparable Properties Analysis</span>
            <Badge variant="outline" className="ml-2">
              {properties.length} Properties
            </Badge>
          </div>
          
          {/* Action Buttons */}
          {selectedProperties.size > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={exportSelectedProperties}
                className="flex items-center gap-1 text-xs sm:text-sm"
              >
                <Download className="h-3 w-3" />
                <span className="hidden sm:inline">Export</span> ({selectedProperties.size})
              </Button>
              
              {selectedProperties.size >= 2 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={viewSelectedComparison}
                  className="flex items-center gap-1 text-xs sm:text-sm"
                >
                  <BarChart3 className="h-3 w-3" />
                  <span className="hidden sm:inline">Compare</span> ({selectedProperties.size})
                </Button>
              )}
            </div>
          )}
        </CardTitle>
        <div className="text-sm text-gray-600">
          {selectedProperties.size > 0 ? (
            <span>{selectedProperties.size} of {properties.length} properties selected for PDF report</span>
          ) : (
            <span>Select up to 10 properties to include in the PDF report (or leave empty to include all)</span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={selectAllProperties}
                    className="h-auto p-1"
                  >
                    {selectedProperties.size === properties.length ? (
                      <CheckSquare className="h-4 w-4" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </Button>
                </TableHead>
                <TableHead className="w-16 sm:w-20">Photo</TableHead>
                <TableHead className="min-w-[180px] sm:min-w-[200px]">
                  <SortButton field="address">Address</SortButton>
                </TableHead>
                <TableHead className="min-w-[80px]">MLS#</TableHead>
                <TableHead className="min-w-[80px]">
                  <SortButton field="status_priority">Status</SortButton>
                </TableHead>
                <TableHead className="text-center min-w-[90px]">
                  <SortButton field="similarity_score">Similarity</SortButton>
                </TableHead>
                <TableHead className="text-right min-w-[100px]">
                  <SortButton field="price">Price</SortButton>
                </TableHead>
                
                {/* Revenue Property Columns - Only show if we have revenue data */}
                {showRevenueColumns && (
                  <>
                    <TableHead className="text-right min-w-[100px]">
                      <SortButton field="potential_gross_revenue">Gross Income</SortButton>
                    </TableHead>
                    <TableHead className="text-right min-w-[80px]">
                      <SortButton field="gross_income_multiplier">GIM</SortButton>
                    </TableHead>
                    <TableHead className="text-right min-w-[100px]">
                      <SortButton field="price_vs_assessment">Price/Assessment</SortButton>
                    </TableHead>
                  </>
                )}

                {/* Residential Property Columns */}
                {showResidentialColumns && (
                  <>
                    <TableHead className="text-right min-w-[80px]">
                      <SortButton field="price_per_sqft">$/SF</SortButton>
                    </TableHead>
                    <TableHead className="text-center min-w-[60px]">
                      <SortButton field="bedrooms">Beds</SortButton>
                    </TableHead>
                    <TableHead className="text-center min-w-[70px]">
                      <SortButton field="bathrooms">Baths</SortButton>
                    </TableHead>
                    <TableHead className="text-right min-w-[80px]">
                      <SortButton field="squareFootage">Sq Ft</SortButton>
                    </TableHead>
                    <TableHead className="text-center min-w-[60px]">
                      <SortButton field="yearBuilt">Year</SortButton>
                    </TableHead>
                  </>
                )}
                
                <TableHead className="text-center min-w-[90px]">
                  <SortButton field="cma_score">CMA Score</SortButton>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedProperties.map((property) => (
                <TableRow
                  key={property.id}
                  className={`hover:bg-purple-50 cursor-pointer transition-colors ${
                    selectedProperties.has(property.id) ? 'bg-blue-50 border-blue-200' : ''
                  } ${
                    hoveredPropertyId === property.id ? 'bg-purple-100 ring-2 ring-purple-400' : ''
                  }`}
                  onClick={() => {
                    // CHANGED: Row click now toggles selection (for easier selection UX)
                    // Use the Eye button to view property details
                    console.log('[CMAComparablesTable] 🖱️ Row clicked, toggling selection for:', property.id);
                    togglePropertySelection(property.id);
                  }}
                  onMouseEnter={() => {
                    setHoveredPropertyId(property.id);
                    onPropertyHover?.(property.id);
                  }}
                  onMouseLeave={() => {
                    setHoveredPropertyId(null);
                    onPropertyHover?.(null);
                  }}
                >
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedProperties.has(property.id)}
                      onChange={(e) => {
                        console.log('[CMAComparablesTable] ✅ Checkbox onChange fired for:', property.id);
                        e.stopPropagation();
                        togglePropertySelection(property.id);
                      }}
                      onClick={(e) => {
                        // Also stop click propagation to prevent row click handler
                        console.log('[CMAComparablesTable] ✅ Checkbox onClick fired for:', property.id);
                        e.stopPropagation();
                      }}
                      className="rounded border-gray-300 cursor-pointer w-4 h-4"
                    />
                  </TableCell>
                  
                  <TableCell>
                    <PropertyThumbnail
                      propertyId={property.id}
                      centrisNo={property.centris_no || property.mls_number}
                      address={property.address || ''}
                    />
                  </TableCell>
                  
                  <TableCell>
                    <div>
                      <div className="font-medium text-xs sm:text-sm break-words">
                        {formatPropertyAddress({
                          address: property.address || 'Unknown',
                          propertyType: (property as any).property_type || (property as any).pt,
                          unit_number: (property as any).unit_number,
                          suite_number: (property as any).suite_number,
                          apt_number: (property as any).apartment
                        })}
                      </div>
                      {property.geometry && (
                        <div className="text-xs text-gray-500 flex items-center mt-1">
                          <MapPin className="h-3 w-3 mr-1" />
                          <span className="hidden sm:inline">View on Map</span>
                          <span className="sm:hidden">Map</span>
                        </div>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <code className="text-xs bg-gray-100 px-1 sm:px-2 py-1 rounded break-all">
                      {property.centris_no || property.mls_number || property.id.slice(0, 8)}
                    </code>
                  </TableCell>

                  <TableCell>
                    {getStatusBadge(property.status)}
                  </TableCell>

                  <TableCell className="text-center">
                    {property.similarity_score !== undefined ? (
                      <div className="flex flex-col items-center gap-1">
                        <div className={`font-semibold ${getSimilarityScoreColor(property.similarity_score)}`}>
                          {property.similarity_score}%
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${
                              property.similarity_score >= 80 ? 'bg-green-600' :
                              property.similarity_score >= 60 ? 'bg-blue-600' :
                              'bg-gray-400'
                            }`}
                            style={{ width: `${property.similarity_score}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </TableCell>

                  <TableCell className="text-right font-semibold text-xs sm:text-sm">
                    <div className="truncate">{formatPrice(property.price)}</div>
                  </TableCell>
                  
                  {/* Revenue Property Columns - Only show if we have revenue data */}
                  {showRevenueColumns && (
                    <>
                      <TableCell className="text-right text-xs sm:text-sm">
                        <span className="font-medium">
                          {formatPrice((property as any).potential_gross_revenue || 0)}
                        </span>
                      </TableCell>

                      <TableCell className="text-right text-xs sm:text-sm">
                        <span className="font-medium">
                          {((property as any).gross_income_multiplier || 0).toFixed(2)}
                        </span>
                      </TableCell>

                      <TableCell className="text-right text-xs sm:text-sm">
                        <span className="font-medium">
                          {((property as any).price_vs_assessment || 0).toFixed(2)}%
                        </span>
                      </TableCell>
                    </>
                  )}

                  {/* Residential Property Columns */}
                  {showResidentialColumns && (
                    <>
                      <TableCell className="text-right text-xs sm:text-sm">
                        <span className="font-medium">
                          ${property.price_per_sqft}
                          <span className="hidden sm:inline">/sf</span>
                        </span>
                      </TableCell>
                      
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center">
                          <Bed className="h-3 w-3 mr-1 text-gray-400" />
                          {property.bedrooms}
                        </div>
                      </TableCell>
                      
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center">
                          <Bath className="h-3 w-3 mr-1 text-gray-400" />
                          {property.bathrooms}
                        </div>
                      </TableCell>
                      
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end">
                          <Ruler className="h-3 w-3 mr-1 text-gray-400" />
                          {(property.squareFootage ?? 0).toLocaleString()}
                        </div>
                      </TableCell>
                      
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center">
                          <Calendar className="h-3 w-3 mr-1 text-gray-400" />
                          {property.yearBuilt}
                        </div>
                      </TableCell>
                    </>
                  )}

                  <TableCell className="text-center">
                    <div className={`flex items-center justify-center ${getCMAScoreColor(property.cma_score || 0)}`}>
                      <Star className="h-3 w-3 mr-1" />
                      {(property.cma_score || 0).toFixed(1)}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {properties.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Home className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No comparable properties found for the selected criteria.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CMAComparablesTable;