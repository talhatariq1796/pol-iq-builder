"use client";

import { useMemo } from 'react';
import type { Property, CMAFilters, CMAStats } from '../types';
import { filterPropertiesByType } from '../propertyTypeConfig';

interface UseCMADataProps {
  properties: Property[];
  filters: CMAFilters;
}

// Force rebuild: 2025-11-13 19:10
export const useCMAData = ({ properties, filters }: UseCMADataProps) => {
  
  const filteredProperties = useMemo(() => {
    console.log('[useCMAData] 🔍 Starting filter process:', {
      totalProperties: properties.length,
      listingStatusFilter: filters.listingStatus,
      firstThreeProperties: properties.slice(0, 3).map(p => ({
        address: p.address,
        st: p.st,
        status: p.status
      }))
    });

    // First, apply property type and category filtering
    let filtered = properties;

    if (filters.selectedPropertyTypes && filters.selectedPropertyTypes.length > 0) {
      filtered = filterPropertiesByType(
        filtered,
        filters.selectedPropertyTypes,
        filters.propertyCategory === 'both' ? undefined : filters.propertyCategory
      );
    }

    // Then apply other filters
    return filtered.filter(property => {

      // Price range filter
      const price = property.price || 0;
      if (price < filters.priceRange.min || price > filters.priceRange.max) {
        return false;
      }

      // Bedrooms filter
      const bedrooms = property.bedrooms || 0;
      if (bedrooms < filters.bedrooms.min || bedrooms > filters.bedrooms.max) {
        return false;
      }

      // Bathrooms filter
      const bathrooms = property.bathrooms || 0;
      if (bathrooms < filters.bathrooms.min || bathrooms > filters.bathrooms.max) {
        return false;
      }

      // Square footage filter
      const sqft = property.squareFootage || 0;
      if (sqft && (sqft < filters.squareFootage.min || sqft > filters.squareFootage.max)) {
        return false;
      }

      // Year built filter (if available)
      if (property.yearBuilt) {
        if (property.yearBuilt < filters.yearBuilt.min || property.yearBuilt > filters.yearBuilt.max) {
          return false;
        }
      }

    // Listing status filter
    // Property data uses abbreviated codes: 'SO' = sold, 'AC' = active
    if (filters.listingStatus !== 'both') {
      const isSold = property.st === 'SO';
      console.log('[useCMAData] 🔍 Listing status check:', {
        address: property.address,
        property_st: property.st,
        isSold,
        filterRequires: filters.listingStatus,
        willKeep: (filters.listingStatus === 'sold' && isSold) || (filters.listingStatus === 'active' && !isSold)
      });
      if (filters.listingStatus === 'sold' && !isSold) {
        return false;
      }
      if (filters.listingStatus === 'active' && isSold) {
        return false;
      }
    }      // Date range filter
      const propertyDate = getPropertyDate(property);
      if (propertyDate) {
        if (propertyDate < filters.dateRange.start || propertyDate > filters.dateRange.end) {
          return false;
        }
      }

      return true;
    });
    
    console.log('[useCMAData] 🔍 Filter complete:', {
      beforeFilter: properties.length,
      afterFilter: filtered.length,
      listingStatusFilter: filters.listingStatus,
      filterReduction: properties.length - filtered.length
    });
    
    return filtered;
  }, [properties, filters]);

  const stats = useMemo(() => {
    if (filteredProperties.length === 0) {
      return {
        avgPrice: 0,
        medianPrice: 0,
        minPrice: 0,
        maxPrice: 0,
        pricePerSqFt: 0,
        avgDaysOnMarket: 0,
        totalSold: 0,
        totalActive: 0,
        avgBedrooms: 0,
        avgBathrooms: 0,
        avgSquareFootage: 0,
        marketAppreciation: 0,
        inventoryLevel: 'normal' as const
      };
    }

    const prices = filteredProperties
      .map(p => p.price || 0)
      .filter(p => p > 0)
      .sort((a, b) => a - b);

    const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const medianPrice = prices[Math.floor(prices.length / 2)];
    
    // Use 'st' field with abbreviated codes: 'SO' = sold, 'AC' = active
    const soldProperties = filteredProperties.filter(p => p.st === 'SO');
    const activeProperties = filteredProperties.filter(p => p.st === 'AC');

    // Calculate average square footage and price per sqft
    const propertiesWithSqft = filteredProperties
      .map(p => ({
        price: p.price || 0,
        sqft: p.squareFootage || 0
      }))
      .filter(p => p.sqft && p.sqft > 0);

    const avgSquareFootage = propertiesWithSqft.length > 0
      ? propertiesWithSqft.reduce((sum, p) => sum + (p.sqft || 0), 0) / propertiesWithSqft.length
      : 0;

    const pricePerSqFt = propertiesWithSqft.length > 0
      ? Math.round(propertiesWithSqft.reduce((sum, p) => sum + (p.price / (p.sqft || 1)), 0) / propertiesWithSqft.length)
      : 0;

    // Calculate average days on market (mock calculation)
    const avgDaysOnMarket = Math.round(Math.random() * 60 + 30); // Mock data

    // Calculate average bedrooms and bathrooms
    const avgBedrooms = filteredProperties.reduce((sum, p) => sum + (p.bedrooms || 0), 0) / filteredProperties.length;
    const avgBathrooms = filteredProperties.reduce((sum, p) => sum + (p.bathrooms || 0), 0) / filteredProperties.length;

    // Determine inventory level
    const soldToActiveRatio = soldProperties.length / (activeProperties.length || 1);
    let inventoryLevel: 'low' | 'normal' | 'high' = 'normal';
    if (soldToActiveRatio > 2) inventoryLevel = 'low';
    else if (soldToActiveRatio < 0.5) inventoryLevel = 'high';

    return {
      avgPrice: Math.round(avgPrice),
      medianPrice: Math.round(medianPrice),
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      pricePerSqFt,
      avgDaysOnMarket,
      totalSold: soldProperties.length,
      totalActive: activeProperties.length,
      avgBedrooms: Math.round(avgBedrooms * 10) / 10,
      avgBathrooms: Math.round(avgBathrooms * 10) / 10,
      avgSquareFootage: Math.round(avgSquareFootage),
      marketAppreciation: 5.2, // Mock data - would be calculated from historical data
      inventoryLevel
    };
  }, [filteredProperties]);

  const isLoading = false; // Would be true during async data fetching

  return {
    filteredProperties,
    stats,
    isLoading
  };
};

// Helper functions
function extractSquareFootage(livingAreaImperial?: string): number | null {
  if (!livingAreaImperial) return null;
  
  // Extract numbers from strings like "1,500 sqft" or "1500 sq ft"
  const match = livingAreaImperial.match(/[\d,]+/);
  if (match) {
    const numStr = match[0].replace(/,/g, '');
    const num = parseInt(numStr, 10);
    return isNaN(num) ? null : num;
  }
  
  return null;
}

function getPropertyDate(_property: Property): Date | null {
  // For CMA properties, we don't have specific date fields
  // Return current date minus random days to simulate listing dates
  const daysAgo = Math.floor(Math.random() * 365);
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
}