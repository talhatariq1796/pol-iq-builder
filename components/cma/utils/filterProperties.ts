/**
 * Property Filtering Utilities
 *
 * Consolidated filtering logic for CMA properties.
 * Used by both CMAInterface and CMACard to ensure consistent filtering behavior.
 *
 * Issue #6: Consolidate duplicate filtering logic
 */

import type { CMAProperty, CMAFilters } from '../types';

/**
 * Determines if a property is sold based on status field(s)
 * Handles both 'status' and 'st' field formats with normalization
 *
 * @param property - Property to check
 * @returns true if property is sold, false otherwise
 */
export function isPropertySold(property: CMAProperty): boolean {
  // Check 'st' field (standard status code): 'SO' = sold
  if (property.st) {
    const stUpper = property.st.toUpperCase();
    if (stUpper === 'SO') return true;
  }

  // Check 'status' field: 'sold' (case-insensitive)
  if (property.status) {
    const statusLower = property.status.toLowerCase();
    if (statusLower === 'sold') return true;
  }

  // Default to not sold if neither field indicates sold status
  return false;
}

/**
 * Filter properties by listing status (sold/active/both)
 *
 * @param properties - Array of properties to filter
 * @param listingStatus - Desired listing status: 'sold', 'active', or 'both'
 * @returns Filtered array of properties
 */
export function filterPropertiesByStatus(
  properties: CMAProperty[],
  listingStatus: 'sold' | 'active' | 'both'
): CMAProperty[] {
  // Return all properties if 'both' is selected
  if (listingStatus === 'both') {
    return properties;
  }

  // Filter based on listing status
  return properties.filter(property => {
    const isSold = isPropertySold(property);

    return (
      (listingStatus === 'sold' && isSold) ||
      (listingStatus === 'active' && !isSold)
    );
  });
}

/**
 * Comprehensive property filtering using CMA filters
 * Applies all filter criteria: property type, listing status, bedrooms, bathrooms, price, sqft
 *
 * @param properties - Array of properties to filter
 * @param filters - CMA filter criteria
 * @returns Filtered array of properties
 */
export function filterPropertiesByFilters(
  properties: CMAProperty[],
  filters: CMAFilters
): CMAProperty[] {
  // Start with all properties
  let filtered = properties;

  // Apply property type/category filter (house, condo, revenue)
  if (filters.propertyType && filters.propertyType !== 'all') {
    filtered = filtered.filter(p => {
      // Check propertyCategory or property_category field (house, condo, revenue)
      const category = ((p as any).propertyCategory || (p as any).property_category)?.toLowerCase();
      // Check property_type field for additional matching
      const propType = p.property_type?.toLowerCase();
      const filterType = filters.propertyType.toLowerCase();

      // Match by category first (preferred), then by property_type
      if (category) {
        return category === filterType;
      }
      if (propType) {
        // Map property_type codes to filter categories
        // APT/CO = condo, BUN/TH = house, revenue types
        if (filterType === 'condo') {
          return propType === 'apt' || propType === 'co' || propType === 'condo';
        }
        if (filterType === 'house') {
          return propType === 'bun' || propType === 'th' || propType === 'house' || propType === 'townhouse';
        }
        if (filterType === 'revenue') {
          // Revenue properties may have 'oth' type or specific revenue types
          return propType === 'oth' || propType === 'revenue' || propType === 'multiplex' || propType === 'income';
        }
        // For other types, do a direct match
        return propType === filterType;
      }
      return true; // Include if no type info available
    });
  }

  // Apply listing status filter
  filtered = filterPropertiesByStatus(filtered, filters.listingStatus);

  // Apply bedrooms filter
  if (filters.bedrooms) {
    filtered = filtered.filter(p => {
      const beds = p.bedrooms || 0;
      const minOk = filters.bedrooms.min === 0 || beds >= filters.bedrooms.min;
      const maxOk = filters.bedrooms.max === 10 || beds <= filters.bedrooms.max;
      return minOk && maxOk;
    });
  }

  // Apply bathrooms filter
  if (filters.bathrooms) {
    filtered = filtered.filter(p => {
      const baths = p.bathrooms || 0;
      const minOk = filters.bathrooms.min === 0 || baths >= filters.bathrooms.min;
      const maxOk = filters.bathrooms.max === 10 || baths <= filters.bathrooms.max;
      return minOk && maxOk;
    });
  }

  // Apply price range filter
  if (filters.priceRange) {
    filtered = filtered.filter(p => {
      const price = p.price || 0;
      const minOk = filters.priceRange.min === 0 || price >= filters.priceRange.min;
      const maxOk = filters.priceRange.max === 2000000 || price <= filters.priceRange.max;
      return minOk && maxOk;
    });
  }

  // Apply square footage filter
  if (filters.squareFootage) {
    filtered = filtered.filter(p => {
      const sqft = p.squareFootage || (p as any).square_footage || p.living_area || 0;
      // Skip sqft filter if property has no sqft data
      if (sqft === 0) return true;
      const minOk = filters.squareFootage.min === 0 || sqft >= filters.squareFootage.min;
      const maxOk = filters.squareFootage.max === 10000 || sqft <= filters.squareFootage.max;
      return minOk && maxOk;
    });
  }

  return filtered;
}

/**
 * Get statistics about filtered properties
 * Useful for debugging and logging filter results
 *
 * @param properties - Original property array
 * @param filtered - Filtered property array
 * @param listingStatus - Applied listing status filter
 * @returns Statistics object with counts and distribution
 */
export function getFilterStatistics(
  properties: CMAProperty[],
  filtered: CMAProperty[],
  listingStatus: 'sold' | 'active' | 'both'
): {
  totalCount: number;
  filteredCount: number;
  removedCount: number;
  listingStatus: string;
  stDistribution: Record<string, number>;
} {
  // Count distribution of 'st' field values
  const stDistribution = properties.reduce((acc, p) => {
    const key = p.st || 'undefined';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    totalCount: properties.length,
    filteredCount: filtered.length,
    removedCount: properties.length - filtered.length,
    listingStatus,
    stDistribution,
  };
}
