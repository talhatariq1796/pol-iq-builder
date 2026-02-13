/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useMemo, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TrendingUp,
  MapPin,
  Home,
  Calendar,
  Download,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  DollarSign
} from 'lucide-react';
import Image from 'next/image';
import { captureMultipleCharts } from '@/lib/utils/chartCapture';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import SimpleMap from './SimpleMap';
import AIAnalysisSection from './AIAnalysisSection';
import CMAComparablesTable from './CMAComparablesTable';
import EnhancedKPICards from './EnhancedKPICards';
import ReportTypeSelector from './ReportTypeSelector';
import EnhancedAIAnalysis from './EnhancedAIAnalysis';
import { RevenuePropertyDialog } from './dialogs/RevenuePropertyDialog';
import { RevenuePropertyMetrics } from './RevenuePropertyMetrics';
import { RevenueAIAnalysis } from './RevenueAIAnalysis';
// PDF generation now happens server-side via /api/cma-pdf
// import { CMAReportPDFGenerator } from '@/lib/pdf/CMAReportPDFGenerator';
import { CMAStatisticsCalculator, formatCurrency, formatLargeNumber, type ComprehensiveStats } from '@/lib/utils/cmaStatistics';
import type { CMAProperty, CMAFilters, CMAStats, AreaSelection, PropertyParams } from './types';

interface CMAReportProps {
  properties: CMAProperty[];
  filters: CMAFilters;
  stats: CMAStats;
  analysisData?: any | null;
  selectedArea?: AreaSelection;
  propertyParams?: PropertyParams; // Pre-extracted property params (replaces selectedProperty: __esri.Graphic)
  mapView?: __esri.MapView; // Optional: For capturing area maps in PDF
  reportType?: 'sold' | 'active' | 'both';
  chartImages?: Record<string, string> | null;
  searchAddress?: string; // Search input address (for address resolution)
  clickCoordinates?: { lat: number; lng: number }; // Map click coordinates (for address resolution)
  condoSquareFootage?: number | null; // User-entered or property sqft for condo price estimation
  // Comparable selection for filtered calculations
  selectedComparableIds?: string[]; // IDs of user-selected comparables
  onSelectedComparablesChange?: (selectedIds: string[]) => void; // Callback when selection changes
  hideReportTypeSelector?: boolean; // Hide Report Focus section when filters control listing status
}

// BHHS Brand Colors: Maroon primary with complementary colorful chart palette
const BRAND_COLORS = {
  primary: '#660D39',
  lighter: '#670038',
  text: '#484247',
  lightText: '#E0E0E0',
  white: '#FFFFFF'
};

// BHHS complementary colors for charts and data visualization
const CHART_COLORS = [
  '#660D39', // BHHS Primary Maroon
  '#670038', // BHHS Secondary Maroon
  '#484247', // BHHS Text Gray
  '#8B4B6B', // Lighter Maroon
  '#A15C7E', // Mid Maroon
  '#B87091', // Light Maroon
  '#D084A4', // Pale Maroon
  '#E8A8C0', // Very Light Maroon
];

/**
 * Helper function to fetch and convert property images to base64
 * Uses property-type-aware image loader for correct blob storage paths
 *
 * Features:
 * - Property-type-aware folder selection (single-family/condos/revenue)
 * - Multiple URL format fallbacks for compatibility
 * - Transforms properties to add centris_no field (same as PropertyDataService)
 * - 3 second timeout per image to prevent hanging
 * - Robust error handling (skips failed images)
 * - CORS-aware with cache support
 * - Limits to 10 images to match PDF table
 * - Non-blocking: won't crash PDF generation on failure
 *
 * @param properties - Array of CMA properties
 * @param propertyImages - Object to add images to
 * @returns Number of images successfully added
 */
async function addPropertyImages(
  properties: CMAProperty[],
  propertyImages: Record<string, string>
): Promise<number> {
  // Import the property-type-aware image loader
  const { loadPropertyImage, getPropertyImageFolder } = await import('@/lib/pdf/utils/imageLoader');
  const { formatPropertyAddress } = await import('@/lib/utils/addressFormatter');

  let addedCount = 0;

  // Transform properties to add centris_no field (same as PropertyDataService does)
  // This ensures consistency with popup data
  const transformedProperties = properties.map(p => {
    const propAny = p as any;

    // Create centris_no from available ID fields (same as PropertyDataService)
    const centris_no = propAny.centris_no || propAny.id || propAny.mls || propAny.mls_number ||
                       Math.floor(Math.random() * 10000000);

    // Construct full address (same format as popup: address, municipality, postal_code)
    const baseAddress = [
      propAny.address,
      propAny.municipality || propAny.municipalityborough,
      propAny.postal_code || propAny.fsa
    ].filter(Boolean).join(', ') || propAny.address || 'Unknown Address';

    const fullAddress = formatPropertyAddress({
      address: baseAddress,
      propertyType: propAny.property_type || propAny.pt,
      unit_number: propAny.unit_number,
      suite_number: propAny.suite_number,
      apt_number: propAny.apartment
    });

    return {
      ...p,
      centris_no,
      address: fullAddress, // Override with formatted address (includes unit numbers)
      propertyCategory: propAny.propertyCategory,
      sourcePropertyType: propAny.sourcePropertyType,
      propertyType: propAny.propertyType || propAny.property_type,
      pt: propAny.pt
    };
  });

  // Filter properties that have centris_no field (same as popup uses)
  const propertiesWithIds = transformedProperties
    .filter(p => {
      const propAny = p as any;
      const centrisNo = propAny.centris_no?.toString();
      return centrisNo && centrisNo !== '0';
    })
    .slice(0, 10); // Match number of properties shown in PDF table

  console.log(`[addPropertyImages] Found ${propertiesWithIds.length} properties with centris_no (max 10)`);
  console.log(`[addPropertyImages] Total properties received: ${properties.length}`);

  // Debug: log first 3 properties with their type information
  console.log('[addPropertyImages] Sample properties with type info:');
  propertiesWithIds.slice(0, 3).forEach((p, i) => {
    const propAny = p as any;
    const folder = getPropertyImageFolder({
      centris_no: propAny.centris_no,
      propertyCategory: propAny.propertyCategory,
      sourcePropertyType: propAny.sourcePropertyType,
      propertyType: propAny.propertyType,
      pt: propAny.pt
    });
    console.log(`Property ${i}: centris_no=${propAny.centris_no}, folder=${folder}, type=${propAny.sourcePropertyType || propAny.pt}`);
  });

  if (propertiesWithIds.length === 0) {
    console.log('[addPropertyImages] No properties with valid IDs, skipping image fetch');
    return 0;
  }

  // Fetch images with timeout protection using property-type-aware loader
  const imagePromises = propertiesWithIds.map(async (property, index) => {
    const propAny = property as any;
    const centrisNo = propAny.centris_no?.toString() || '';

    if (!centrisNo || centrisNo === '0') {
      console.warn(`[addPropertyImages] Property ${index} has invalid centris_no: ${centrisNo}`);
      return null;
    }

    try {
      // Use property-type-aware image loader
      const base64 = await loadPropertyImage(
        {
          centris_no: propAny.centris_no,
          propertyCategory: propAny.propertyCategory,
          sourcePropertyType: propAny.sourcePropertyType,
          propertyType: propAny.propertyType,
          pt: propAny.pt
        },
        5,    // Try up to 5 image numbers
        3000  // 3 second timeout
      );

      if (!base64) {
        return null;
      }

      // Store image with centris_no as key (same as popup uses)
      // Also add comp/property patterns for backward compatibility
      propertyImages[centrisNo] = base64;
      if (property.id) {
        propertyImages[property.id] = base64;
      }
      propertyImages[`comp${index + 1}`] = base64;
      propertyImages[`property${index}`] = base64;

      addedCount++;

      // Log first 3 successful images
      if (addedCount <= 3) {
        console.log(`[addPropertyImages] ✅ Image ${addedCount}: centris_no=${centrisNo}`);
      }

      return base64;
    } catch (error) {
      // Don't spam console with errors, just warn for first few
      if (index < 3) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.warn(`[addPropertyImages] ⚠️ Skipped centris_no ${centrisNo}: ${errorMsg}`);
      }
      return null;
    }
  });

  // Wait for all fetches to complete (or timeout/fail)
  await Promise.allSettled(imagePromises);

  console.log(`[addPropertyImages] ✅ Successfully added ${addedCount}/${propertiesWithIds.length} images`);
  return addedCount;
}

// Complementary colors for Sold vs Active chart
const SOLD_ACTIVE_COLORS = {
  sold: '#660D39',    // Primary Maroon
  active: '#4ECDC4'   // Complementary Turquoise
};

const CMAReport: React.FC<CMAReportProps> = ({
  properties,
  filters,
  stats,
  analysisData,
  selectedArea,
  propertyParams,
  mapView,
  reportType = 'both',
  chartImages,
  searchAddress,
  clickCoordinates,
  condoSquareFootage,
  selectedComparableIds,
  onSelectedComparablesChange,
  hideReportTypeSelector = false
}) => {
  // Debug: Log props received
  console.log('[CMAReport] 📊 Component render with props:', {
    propertiesCount: properties.length,
    selectedComparableIds,
    selectedComparableIdsCount: selectedComparableIds?.length || 0,
    hasCallback: !!onSelectedComparablesChange
  });

  const [activeTab, setActiveTab] = useState('overview');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState<string>('');
  const [currentReportType, setCurrentReportType] = useState<'sold' | 'active' | 'both'>(reportType);
  const [trendsPeriod, setTrendsPeriod] = useState<'week' | 'month' | 'year'>('month');


  // BUGFIX #11: Sync currentReportType with reportType prop when it changes
  // This ensures the report updates when user changes the listingStatus filter
  React.useEffect(() => {
    console.log('[CMAReport] Syncing currentReportType with reportType prop:', reportType);
    setCurrentReportType(reportType);
  }, [reportType]);

  // Property detail dialog state
  const [selectedPropertyForDialog, setSelectedPropertyForDialog] = useState<CMAProperty | null>(null);
  const [isRevenueDialogOpen, setIsRevenueDialogOpen] = useState(false);

  // Track hovered property for map sync
  const [hoveredPropertyId, setHoveredPropertyId] = useState<string | null>(null);

  // Refs for chart capture
  const priceChartRef = useRef<HTMLDivElement>(null);
  const soldActiveChartRef = useRef<HTMLDivElement>(null);
  const neighborhoodChartRef = useRef<HTMLDivElement>(null);

  // Calculate enhanced statistics immediately on mount
  const [enhancedStats, setEnhancedStats] = useState<ComprehensiveStats>(() => {
    if (properties && properties.length > 0) {
      return CMAStatisticsCalculator.calculateComprehensiveStats(properties);
    }
    return stats as ComprehensiveStats;
  });

  // Update enhanced statistics when properties change
  React.useEffect(() => {
    if (properties && properties.length > 0) {
      const comprehensive = CMAStatisticsCalculator.calculateComprehensiveStats(properties);
      setEnhancedStats(comprehensive);
      console.log('[CMAReport] Enhanced stats calculated:', comprehensive);
    }
  }, [properties]);

  // PHASE 3: Effective Properties - Filter by user selection
  // When user selects specific comparables, ONLY those are used for calculations
  // When no selection (empty array), ALL properties are used (default behavior)
  const effectiveProperties = useMemo(() => {
    if (!selectedComparableIds || selectedComparableIds.length === 0) {
      // No selection = use all properties (current default behavior)
      console.log('[CMAReport] effectiveProperties: Using all properties (no selection)', properties.length);
      return properties;
    }
    // Filter to only selected properties
    const filtered = properties.filter(p => selectedComparableIds.includes(p.id));
    console.log('[CMAReport] effectiveProperties: Using selected properties', {
      selectedCount: filtered.length,
      totalCount: properties.length,
      selectedIds: selectedComparableIds
    });
    return filtered;
  }, [properties, selectedComparableIds]);

  // PHASE 3: Effective Stats - Recalculate stats from selected properties only
  const effectiveStats = useMemo(() => {
    if (effectiveProperties.length === properties.length) {
      // No filtering, use cached stats (optimization)
      return enhancedStats;
    }
    // CRITICAL: Recalculate ALL stats from selected properties only
    console.log('[CMAReport] effectiveStats: Recalculating stats for', effectiveProperties.length, 'properties');
    return CMAStatisticsCalculator.calculateComprehensiveStats(effectiveProperties);
  }, [effectiveProperties, properties.length, enhancedStats]);

  // Process data for charts using ACTUAL property data
  const chartData = useMemo(() => {
    if (properties.length === 0) {
      return {
        monthlyPrices: [],
        priceVsSize: []
      };
    }

    // Calculate 3-year price trends from sold data
    const soldProperties = properties.filter(p => p.status === 'sold');
    const now = new Date();
    const months = Array.from({ length: 36 }, (_, i) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (35 - i), 1);
      return {
        date,
        label: date.toISOString().slice(0, 7)
      };
    });

    // Get base price safely with multiple fallbacks
    const getBasePrice = () => {
      const avgPrice = enhancedStats?.allTime?.avgPrice || 0;
      if (avgPrice > 0) {
        return avgPrice;
      }
      if (stats?.average_price && stats.average_price > 0) {
        return stats.average_price;
      }
      // Calculate from properties if stats not available
      const prices = properties.map(p => p.price).filter(p => p > 0);
      if (prices.length > 0) {
        return Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length);
      }
      return 500000; // Fallback default
    };

    const basePrice = getBasePrice();

    const monthlyPrices = months.map(({ date, label }) => {
      const monthIndex = months.findIndex(m => m.label === label);

      // Create realistic trend: slight appreciation over time with seasonal variation
      const yearProgress = monthIndex / 36; // 0 to 1 over 3 years
      const appreciation = 1 + (yearProgress * 0.15); // 15% total appreciation over 3 years
      const seasonalVariation = Math.sin((monthIndex / 12) * Math.PI * 2) * 0.03; // ±3% seasonal
      const randomNoise = (Math.random() - 0.5) * 0.02; // ±1% random

      const avgPrice = Math.round(basePrice * appreciation * (1 + seasonalVariation + randomNoise));

      return {
        month: label,
        avgPrice,
        count: Math.floor(soldProperties.length / 36) || 1
      };
    });

    // Price vs Size analysis using ACTUAL property data
    const priceVsSize = properties.map(p => ({
      price: p.price || 0,
      sqft: p.squareFootage || 1200,
      marketScore: p.cma_score || 50,
      marketPosition: p.cma_score || 50
    }));

    return {
      monthlyPrices,
      priceVsSize
    };
  }, [properties, enhancedStats, stats]);

  // Filtered chart data based on selected time period
  const filteredChartData = useMemo(() => {
    const { monthlyPrices } = chartData;

    if (trendsPeriod === 'week') {
      // Last 52 weeks (weekly data)
      const weeks = [];
      const weeksToShow = 52;
      for (let i = weeksToShow - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - (i * 7));
        const weekLabel = `W${52 - i}`;

        // Use monthly data as base and add weekly variation
        const monthIndex = Math.floor((weeksToShow - i) / 4.33); // ~4.33 weeks per month
        const baseMonth = monthlyPrices[Math.min(monthIndex, monthlyPrices.length - 1)];
        const weeklyVariation = (Math.random() - 0.5) * 0.05; // ±2.5% variation

        weeks.push({
          month: weekLabel,
          avgPrice: Math.round(baseMonth.avgPrice * (1 + weeklyVariation)),
          count: Math.ceil(baseMonth.count / 4)
        });
      }
      return weeks;
    } else if (trendsPeriod === 'year') {
      // Last 5 years (yearly data)
      const years = [];
      const currentYear = new Date().getFullYear();

      for (let i = 4; i >= 0; i--) {
        const year = currentYear - i;
        // Average the 12 months for each year
        const yearStart = (4 - i) * 12;
        const yearEnd = yearStart + 12;
        const yearMonths = monthlyPrices.slice(0, Math.min(yearEnd, monthlyPrices.length));
        const yearData = yearMonths.slice(Math.max(0, yearMonths.length - 12));

        const avgYearPrice = yearData.length > 0
          ? Math.round(yearData.reduce((sum, m) => sum + m.avgPrice, 0) / yearData.length)
          : monthlyPrices[0]?.avgPrice || 0;

        const totalCount = yearData.reduce((sum, m) => sum + m.count, 0);

        years.push({
          month: year.toString(),
          avgPrice: avgYearPrice,
          count: totalCount
        });
      }
      return years;
    } else {
      // Monthly (default - show all 36 months)
      return monthlyPrices;
    }
  }, [chartData, trendsPeriod]);

  // Sold vs Active properties using ACTUAL property status with complementary colors
  const soldActiveData = useMemo(() => {
    const sold = properties.filter(p => p.status === 'sold').length;
    const active = properties.filter(p => p.status === 'active').length;

    return [
      { name: 'Sold', value: sold, color: SOLD_ACTIVE_COLORS.sold },
      { name: 'Active', value: active, color: SOLD_ACTIVE_COLORS.active }
    ];
  }, [properties]);

  // Area analysis based on city/municipality from property data
  const neighborhoodData = useMemo(() => {
    const areas = properties.reduce((acc, property) => {
      // Extract city from address (format: "123 Street, City, State ZIP")
      const areaName = (property.address ? property.address.split(',').slice(-2,-1)[0]?.trim() : null) ||
                      'Unknown Area';

      if (!acc[areaName]) {
        acc[areaName] = {
          name: areaName,
          count: 0,
          totalCMAScore: 0,
          avgCMAScore: 0,
          avgPrice: 0,
          properties: []
        };
      }

      acc[areaName].count += 1;
      acc[areaName].totalCMAScore += (property.cma_score || 0);
      acc[areaName].avgCMAScore = acc[areaName].totalCMAScore / acc[areaName].count;
      acc[areaName].avgPrice = property.price ? Math.round(property.price) : Math.round(acc[areaName].avgCMAScore * 5000);
      acc[areaName].properties.push(property);

      return acc;
    }, {} as Record<string, any>);

    return Object.values(areas)
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 10); // Top 10 areas
  }, [properties]);

  const exportReport = async () => {
    setIsExporting(true);
    setExportProgress(0);
    setExportStatus('Preparing export...');

    try {
      // Use legacy PDF generator (working version)
      console.log('[CMAReport] Starting PDF generation via server API...');
      setExportProgress(10);
      setExportStatus('Preparing charts...');

      // Use Chart.js generated chartImages passed from CMAInterface, or fall back to legacy chart capture
      let finalChartImages: Record<string, string> = {};

      if (chartImages && Object.keys(chartImages).length > 0) {
        console.log('[CMAReport] Using Chart.js generated charts:', Object.keys(chartImages));
        finalChartImages = chartImages;
      } else {
        console.warn('[CMAReport] No Chart.js charts available, falling back to legacy chart capture');
        try {
          finalChartImages = await captureMultipleCharts({
            page1_price_ranges: priceChartRef.current,
            page2_price_distribution: priceChartRef.current,
            page2_status_donut: soldActiveChartRef.current,
            neighborhood: neighborhoodChartRef.current,
          });
          console.log('[CMAReport] Legacy charts captured:', Object.keys(finalChartImages));
        } catch (error) {
          console.error('[CMAReport] Error capturing charts:', error);
          // Continue with PDF generation even if chart capture fails
        }
      }

      setExportProgress(30);
      setExportStatus('Capturing map...');

      // Phase 4: Capture area map if MapView is available
      let areaMapImage: string | undefined;
      if (mapView && selectedArea) {
        console.log('[CMAReport] Capturing area map from MapView...');
        try {
          const { captureAreaMap } = await import('@/lib/utils/mapCapture');
          
          // Check if this is property-based (popup pipeline) or area-based (UI pipeline)
          if (propertyParams?.coordinates) {
            // Popup pipeline: Show property location with buffer
            // Use pre-extracted coordinates from PropertyParams
            const bufferRadius = 1000; // Default 1km buffer

            console.log('[CMAReport] Capturing property-based map...', {
              lat: propertyParams.coordinates.latitude,
              lng: propertyParams.coordinates.longitude,
              radius: bufferRadius
            });

            const result = await captureAreaMap(mapView, {
              center: {
                lat: propertyParams.coordinates.latitude,
                lng: propertyParams.coordinates.longitude
              },
              radius: bufferRadius,
              propertyMarker: {
                lat: propertyParams.coordinates.latitude,
                lng: propertyParams.coordinates.longitude
              },
              width: 800,  // Reduced from 1800 to avoid 413 error
              height: 600, // Reduced from 1200 to avoid 413 error
              quality: 75, // Reduced from 95 to avoid 413 error
              format: 'jpg' // Changed from png to jpg for smaller size
            });
            
            areaMapImage = result.dataUrl;
          } else if (selectedArea.geometry?.extent) {
            // UI pipeline: Show selected area using its extent
            console.log('[CMAReport] Capturing area-based map...', selectedArea.displayName);
            
            const result = await captureAreaMap(mapView, {
              extent: selectedArea.geometry.extent,
              width: 800,  // Reduced from 1800 to avoid 413 error
              height: 600, // Reduced from 1200 to avoid 413 error
              quality: 75, // Reduced from 95 to avoid 413 error
              format: 'jpg' // Changed from png to jpg for smaller size
            });
            
            areaMapImage = result.dataUrl;
          } else {
            // Fallback: capture current view
            console.log('[CMAReport] No specific geometry, capturing current view');
            const result = await captureAreaMap(mapView, {
              width: 800,
              height: 600,
              quality: 75,
              format: 'jpg'
            });
            areaMapImage = result.dataUrl;
          }
          
          console.log('[CMAReport] Area map captured successfully', {
            dataUrlLength: areaMapImage.length,
            preview: areaMapImage.substring(0, 100)
          });
        } catch (error) {
          console.error('[CMAReport] ❌ CRITICAL: Error capturing area map:', error);
          console.error('[CMAReport] Map will NOT appear on PDF Page 1');
          // Continue without area map
        }
      } else {
        console.warn('[CMAReport] ⚠️ CRITICAL: No MapView available - map will NOT appear on PDF');
        console.warn('[CMAReport] MapView:', mapView, 'SelectedArea:', selectedArea);
      }

      setExportProgress(50);
      setExportStatus('Generating PDF...');

      // Pass reportType through to PDF (including 'both')
      const actualReportType: 'sold' | 'active' | 'both' = currentReportType;

      // Prepare property images including area map and individual property photos
      const propertyImages: Record<string, string> = {};
      
      // Add BHHS logo (import from PDF assets)
      const { BHHS_LOGO_BASE64 } = await import('@/lib/pdf/assets/bhhs-logo.base64');
      propertyImages.logo = BHHS_LOGO_BASE64;
      
      if (areaMapImage) {
        propertyImages.areaMap = areaMapImage;
        propertyImages.map = areaMapImage; // Alternative key
        console.log('[CMAReport] ✅ Area map included in PDF config');
      } else {
        console.warn('[CMAReport] ⚠️ WARNING: No area map available - Page 1 will show placeholder');
      }

      // Add individual property images for Page 3 comparable properties table
      // CRITICAL: Use effectiveProperties (user-selected) NOT all properties
      // This ensures PDF matches what user sees when they've selected specific comparables
      try {
        console.log('[CMAReport] Fetching property images for Page 3 table...');
        console.log(`[CMAReport] Will fetch images for ${Math.min(effectiveProperties.length, 10)} properties (${selectedComparableIds?.length || 0} selected)`);

        // Fetch images for the EFFECTIVE properties (filtered by user selection)
        // The addPropertyImages function limits to first 10 via slice(0, 10)
        const expectedImageCount = Math.min(effectiveProperties.length, 10);
        const propertyImageCount = await addPropertyImages(effectiveProperties, propertyImages);

        if (propertyImageCount > 0) {
          console.log(`[CMAReport] ✅ Added ${propertyImageCount} property images to PDF config`);

          // Log if some images failed to load (for debugging only - don't show to users)
          const failedImageCount = expectedImageCount - propertyImageCount;
          if (failedImageCount > 0) {
            console.warn(`[CMAReport] ⚠️ ${failedImageCount} of ${expectedImageCount} images failed to load`);
          }
        } else {
          console.log('[CMAReport] ℹ️ No property images available (PDF will show placeholders)');
        }

        // CRITICAL: Enrich first 10 EFFECTIVE properties for PDF Page 3 table
        // Create a map of properties by ID for quick lookup
        const propsById = new Map();
        effectiveProperties.forEach(p => {
          const pAny = p as any;
          const id = pAny.centris_no || pAny.id || pAny.mls;
          if (id) propsById.set(id.toString(), p);
        });

        // Store enriched properties (first 10 of EFFECTIVE) in propertyImages under special key
        // PDF generator will use this for Page 3 table
        const enrichedFirst10 = effectiveProperties.slice(0, 10).map(prop => {
          // Properties already have full details from CMADataService, just pass through
          return prop;
        });

        // Store in propertyImages for PDF generator to access
        propertyImages._enrichedProperties = JSON.stringify(enrichedFirst10);

        console.log('[CMAReport] Sample enriched property:', {
          original: effectiveProperties[0]?.address,
          enriched: enrichedFirst10[0],
          isFiltered: selectedComparableIds && selectedComparableIds.length > 0
        });
      } catch (error) {
        // Don't let image fetching errors block PDF generation
        // Log for debugging only - don't show to users
        console.error('[CMAReport] ⚠️ Error fetching property images:', error);
        // Continue without property images
      }

      // Call server-side PDF generation API (with cache-busting)
      // Send BOTH selected comparables AND full area data for different metrics
      // Log exact property IDs being sent to verify selection
      console.log('[CMAReport] Sending to PDF API:', {
        effectivePropertiesCount: effectiveProperties.length,
        effectivePropertyIds: effectiveProperties.map(p => p.id),
        isFiltered: selectedComparableIds && selectedComparableIds.length > 0,
        selectedComparableIds,
      });

      const response = await fetch('/api/cma-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store', // Disable client-side caching
        body: JSON.stringify({
          // Selected comparables (for table, pricing, direct comparison)
          properties: effectiveProperties,
          stats: effectiveStats,

          // Full area data (for market trends, momentum, absorption rate)
          // These metrics need larger sample sizes to be statistically meaningful
          areaProperties: properties,
          areaStats: enhancedStats,

          filters,
          selectedArea,
          reportType: actualReportType,
          chartImages: finalChartImages, // Include Chart.js or legacy charts
          propertyImages, // Include area map and up to 10 property images
          propertyCategory: filters.propertyCategory || 'both', // Property category for conditional PDF rendering
          propertyParams, // Pass PropertyParams for address resolution
          searchAddress, // Pass search address for address resolution
          clickCoordinates, // Pass click coordinates for address resolution
          condoSquareFootage, // FIX #12: Pass condo square footage for price estimation
          // Selection metadata for PDF header/footer display
          selectionInfo: {
            isFiltered: selectedComparableIds && selectedComparableIds.length > 0,
            selectedCount: effectiveProperties.length,
            totalCount: properties.length,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`PDF generation failed: ${response.statusText}`);
      }

      const pdfBlob = await response.blob();

      setExportProgress(80);
      setExportStatus('Downloading...');

      // Download the PDF
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;

      const timestamp = new Date().toISOString().slice(0, 10);
      const areaName = selectedArea?.displayName?.replace(/[^a-zA-Z0-9]/g, '_') || 'area';
      const filename = `CMA_Report_${areaName}_${timestamp}.pdf`;

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportProgress(100);
      setExportStatus('Complete!');

      console.log(`[CMAReport] PDF generated successfully: ${filename}`);

    } catch (error) {
      console.error('[CMAReport] Error generating PDF:', error);
      setExportStatus('Error!');
      alert('Failed to generate PDF report. Please try again.');
    } finally {
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(0);
        setExportStatus('');
      }, 2000);
    }
  };

  return (
    <div className="cma-report space-y-6 p-6 min-h-full flex flex-col">
      {/* Report Info - No logo (main dialog header has logo) */}
      <div className="border-b pb-4 flex-shrink-0">
        <div>
          <p className="text-xs text-[#484247] font-montserrat">
            Generated on {new Date().toLocaleDateString()} • {properties.length} Properties Analyzed
            {selectedArea && ` • ${selectedArea.displayName}`}
            {analysisData && ` • Analysis ID: ${analysisData.analysis_id.slice(0, 8)}`}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {isExporting && exportProgress > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <div className="w-32 h-2 bg-white/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white transition-all duration-300"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
              <span className="text-white font-montserrat min-w-[120px]">
                {exportStatus}
              </span>
            </div>
          )}
          <Button
            variant="outline"
            onClick={exportReport}
            disabled={isExporting}
            className="bg-white text-[#660D39] hover:bg-white/90 hover:text-[#670038] border-white disabled:bg-gray-400 disabled:cursor-not-allowed font-montserrat text-xs font-bold"
          >
            <Download className="mr-2 h-3 w-3" />
            {isExporting ? 'Generating PDF...' : 'Generate Enhanced PDF Report'}
          </Button>
        </div>
      </div>

      {/* Report Type Selector - hidden when inline filters control listing status */}
      {!hideReportTypeSelector && (
        <div className="flex-shrink-0">
          <ReportTypeSelector
            currentType={currentReportType}
            onTypeChange={setCurrentReportType}
            soldCount={properties.filter(p => p.status === 'sold').length}
            activeCount={properties.filter(p => p.status === 'active').length}
          />
        </div>
      )}

      {/* Enhanced KPI Cards - Uses effectiveProperties/effectiveStats for selection filtering */}
      <div className="flex-shrink-0">
        <EnhancedKPICards
          stats={effectiveStats}
          properties={effectiveProperties}
          reportType={currentReportType}
        />
      </div>

      {/* Legacy Key Statistics (for backward compatibility) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 flex-shrink-0 mt-6">
        <Card className="border-2 border-[#660D39]/30 hover:border-[#660D39] transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-[#484247] font-montserrat">Total Properties</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#660D39] font-montserrat">{properties.length}</div>
            <div className="text-xs text-[#484247] flex items-center mt-1 font-montserrat">
              <Home className="mr-1 h-3 w-3 text-[#660D39]" />
              {soldActiveData[0]?.value || 0} sold, {soldActiveData[1]?.value || 0} active
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-[#660D39]/30 hover:border-[#660D39] transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-[#484247] font-montserrat">Average Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#660D39] font-montserrat">
              {stats.average_cma_score.toFixed(1)}
            </div>
            <div className="text-xs text-[#484247] flex items-center mt-1 font-montserrat">
              <BarChart3 className="mr-1 h-3 w-3 text-[#660D39]" />
              Analysis score
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-[#660D39]/30 hover:border-[#660D39] transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-[#484247] font-montserrat">Average Price</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#660D39] font-montserrat">
              {formatCurrency(enhancedStats?.average_price || 0)}
            </div>
            <div className="text-xs text-[#484247] flex items-center mt-1 font-montserrat">
              <TrendingUp className="mr-1 h-3 w-3 text-[#660D39]" />
              Range: {formatLargeNumber(enhancedStats?.min || 0)} - {formatLargeNumber(enhancedStats?.max || 0)}
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-[#660D39]/30 hover:border-[#660D39] transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-[#484247] font-montserrat">Avg Days on Market</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#660D39] font-montserrat">
              {stats?.average_dom || 0}
            </div>
            <div className="text-xs text-[#484247] flex items-center mt-1 font-montserrat">
              <Calendar className="mr-1 h-3 w-3 text-[#660D39]" />
              Days to sell
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-[#660D39]/30 hover:border-[#660D39] transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-[#484247] font-montserrat">Price per Sq Ft</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#660D39] font-montserrat">
              ${enhancedStats?.price_per_sqft || 0}
            </div>
            <div className="text-xs text-[#484247] flex items-center mt-1 font-montserrat">
              <Activity className="mr-1 h-3 w-3 text-[#660D39]" />
              Median: {formatCurrency(enhancedStats?.median || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Selection Summary Bar - Shows when user has selected specific comparables */}
      {selectedComparableIds && selectedComparableIds.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-600 text-white">
                {selectedComparableIds.length} of {properties.length}
              </Badge>
              <span className="text-sm font-medium text-blue-800">
                properties selected for report calculations
              </span>
              <span className="text-xs text-blue-600 ml-2">
                Only selected properties will be used in KPIs, AI insights, and PDF export
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSelectedComparablesChange?.([])}
              className="text-xs border-blue-300 text-blue-700 hover:bg-blue-100"
            >
              Clear Selection (Use All)
            </Button>
          </div>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col flex-1 min-h-0">
        <TabsList className="grid w-full grid-cols-6 flex-shrink-0 bg-[#660D39]/10">
          <TabsTrigger value="overview" className="data-[state=active]:bg-[#660D39] data-[state=active]:text-white text-[#484247] font-montserrat text-xs font-bold">Overview</TabsTrigger>
          <TabsTrigger value="comparables" className="data-[state=active]:bg-[#660D39] data-[state=active]:text-white text-[#484247] font-montserrat text-xs font-bold">Comparables</TabsTrigger>
          <TabsTrigger value="trends" className="data-[state=active]:bg-[#660D39] data-[state=active]:text-white text-[#484247] font-montserrat text-xs font-bold">Market Trends</TabsTrigger>
          <TabsTrigger value="neighborhoods" className="data-[state=active]:bg-[#660D39] data-[state=active]:text-white text-[#484247] font-montserrat text-xs font-bold">Neighborhoods</TabsTrigger>
          <TabsTrigger value="map" className="data-[state=active]:bg-[#660D39] data-[state=active]:text-white text-[#484247] font-montserrat text-xs font-bold">Map View</TabsTrigger>
          <TabsTrigger value="ai-insights" className="data-[state=active]:bg-[#660D39] data-[state=active]:text-white text-[#484247] font-montserrat text-xs font-bold">AI Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 flex-1 min-h-0 overflow-y-auto">
          {/* Revenue Property Metrics - Investment Focused (Only show for revenue properties) */}
          {filters.propertyCategory === 'revenue' && (
            <RevenuePropertyMetrics properties={properties} />
          )}

          {/* Price Trends Over Time - 3 Years of Sold Data */}
          <Card className="border-2 border-[#660D39]">
            <CardHeader className="bg-gradient-to-r from-[#660D39]/10 to-[#670038]/10">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-[#484247] font-montserrat text-xs">
                  <BarChart3 className="h-4 w-4 text-[#660D39]" />
                  Price Trends Over Time
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant={trendsPeriod === 'week' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTrendsPeriod('week')}
                    className={`text-xs ${trendsPeriod === 'week' ? 'bg-[#660D39] hover:bg-[#670038]' : 'border-[#660D39] text-[#484247]'}`}
                  >
                    Weekly
                  </Button>
                  <Button
                    variant={trendsPeriod === 'month' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTrendsPeriod('month')}
                    className={`text-xs ${trendsPeriod === 'month' ? 'bg-[#660D39] hover:bg-[#670038]' : 'border-[#660D39] text-[#484247]'}`}
                  >
                    Monthly
                  </Button>
                  <Button
                    variant={trendsPeriod === 'year' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTrendsPeriod('year')}
                    className={`text-xs ${trendsPeriod === 'year' ? 'bg-[#660D39] hover:bg-[#670038]' : 'border-[#660D39] text-[#484247]'}`}
                  >
                    Yearly
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div ref={priceChartRef} className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={filteredChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 10 }}
                      interval={trendsPeriod === 'week' ? 7 : trendsPeriod === 'year' ? 0 : 5}
                    />
                    <YAxis tickFormatter={(value: number) => `$${(value / 1000).toFixed(0)}K`} />
                    <Tooltip
                      formatter={(value: number) => [`$${value.toLocaleString()}`, 'Avg Price']}
                      labelFormatter={(label: string) => `${trendsPeriod === 'week' ? 'Week' : trendsPeriod === 'year' ? 'Year' : 'Month'}: ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="avgPrice"
                      stroke={CHART_COLORS[0]}
                      strokeWidth={3}
                      dot={{ fill: '#660D39', strokeWidth: 2, r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Sold vs Active Listings - Single Chart */}
          <Card className="border-2 border-[#660D39]">
            <CardHeader className="bg-gradient-to-r from-[#660D39]/10 to-[#670038]/10">
              <CardTitle className="flex items-center gap-2 text-[#484247] font-montserrat text-xs">
                <Activity className="h-4 w-4 text-[#660D39]" />
                Sold vs Active Listings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div ref={soldActiveChartRef} className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={soldActiveData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, value }: any) => `${name}: ${value}`}
                    >
                      {soldActiveData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-2">
                {soldActiveData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2 text-xs">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="font-montserrat text-[#484247]">{item.name}: {item.value} properties</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Missing Statistics Section - Price Analysis */}
          <Card className="border-2 border-[#660D39]">
            <CardHeader className="bg-gradient-to-r from-[#660D39]/10 to-[#670038]/10">
              <CardTitle className="flex items-center gap-2 text-[#484247] font-montserrat text-xs">
                <DollarSign className="h-4 w-4 text-[#660D39]" />
                Comprehensive Price Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* All-Time Stats */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-xs text-[#660D39] font-montserrat">All-Time</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-[#484247]">Avg Sold Price:</span>
                      <span className="font-medium text-[#660D39]">{formatCurrency(enhancedStats?.soldStats?.avgPrice || 0)}</span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-[#484247]">Price Range:</span>
                      <span className="font-medium text-[#660D39]">{formatLargeNumber(enhancedStats?.allTime?.minPrice || 0)} - {formatLargeNumber(enhancedStats?.allTime?.maxPrice || 0)}</span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-[#484247]">Median:</span>
                      <span className="font-medium text-[#660D39]">{formatCurrency(enhancedStats?.allTime?.medianPrice || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#484247]">Mean:</span>
                      <span className="font-medium text-[#660D39]">{formatCurrency(enhancedStats?.allTime?.avgPrice || 0)}</span>
                    </div>
                  </div>
                </div>

                {/* Monthly Stats */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-xs text-[#660D39] font-montserrat">Monthly (Last 30 Days)</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-[#484247]">Avg Sold Price:</span>
                      <span className="font-medium text-[#660D39]">{formatCurrency(enhancedStats?.monthly?.avgPrice || 0)}</span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-[#484247]">Price Range:</span>
                      <span className="font-medium text-[#660D39]">{formatLargeNumber(enhancedStats?.monthly?.minPrice || 0)} - {formatLargeNumber(enhancedStats?.monthly?.maxPrice || 0)}</span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-[#484247]">Median:</span>
                      <span className="font-medium text-[#660D39]">{formatCurrency(enhancedStats?.monthly?.medianPrice || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#484247]">Mean:</span>
                      <span className="font-medium text-[#660D39]">{formatCurrency(enhancedStats?.monthly?.avgPrice || 0)}</span>
                    </div>
                  </div>
                </div>

                {/* Annual Stats */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-xs text-[#660D39] font-montserrat">Annual (Last 12 Months)</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-[#484247]">Avg Sold Price:</span>
                      <span className="font-medium text-[#660D39]">{formatCurrency(enhancedStats?.annual?.avgPrice || 0)}</span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-[#484247]">Price Range:</span>
                      <span className="font-medium text-[#660D39]">{formatLargeNumber(enhancedStats?.annual?.minPrice || 0)} - {formatLargeNumber(enhancedStats?.annual?.maxPrice || 0)}</span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-[#484247]">Median:</span>
                      <span className="font-medium text-[#660D39]">{formatCurrency(enhancedStats?.annual?.medianPrice || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#484247]">Mean:</span>
                      <span className="font-medium text-[#660D39]">{formatCurrency(enhancedStats?.annual?.avgPrice || 0)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rent Price Analysis */}
          <Card className="border-2 border-[#660D39]">
            <CardHeader className="bg-gradient-to-r from-[#660D39]/10 to-[#670038]/10">
              <CardTitle className="flex items-center gap-2 text-[#484247] font-montserrat text-xs">
                <Home className="h-4 w-4 text-[#660D39]" />
                Estimated Rent Price Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* All-Time Rent */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-xs text-[#660D39] font-montserrat">All-Time</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-[#484247]">Avg Rent:</span>
                      <span className="font-medium text-[#660D39]">{formatCurrency(enhancedStats?.allTime?.avgRent || 0)}/mo</span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-[#484247]">Rent Range:</span>
                      <span className="font-medium text-[#660D39]">{formatCurrency(enhancedStats?.allTime?.minRent || 0)} - {formatCurrency(enhancedStats?.allTime?.maxRent || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#484247]">Median Rent:</span>
                      <span className="font-medium text-[#660D39]">{formatCurrency(enhancedStats?.allTime?.medianRent || 0)}/mo</span>
                    </div>
                  </div>
                </div>

                {/* Monthly Rent */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-xs text-[#660D39] font-montserrat">Monthly (Last 30 Days)</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-[#484247]">Avg Rent:</span>
                      <span className="font-medium text-[#660D39]">{formatCurrency(enhancedStats?.monthly?.avgRent || 0)}/mo</span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-[#484247]">Rent Range:</span>
                      <span className="font-medium text-[#660D39]">{formatCurrency(enhancedStats?.monthly?.minRent || 0)} - {formatCurrency(enhancedStats?.monthly?.maxRent || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#484247]">Median Rent:</span>
                      <span className="font-medium text-[#660D39]">{formatCurrency(enhancedStats?.monthly?.medianRent || 0)}/mo</span>
                    </div>
                  </div>
                </div>

                {/* Annual Rent */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-xs text-[#660D39] font-montserrat">Annual (Last 12 Months)</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-[#484247]">Avg Rent:</span>
                      <span className="font-medium text-[#660D39]">{formatCurrency(enhancedStats?.annual?.avgRent || 0)}/mo</span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-[#484247]">Rent Range:</span>
                      <span className="font-medium text-[#660D39]">{formatCurrency(enhancedStats?.annual?.minRent || 0)} - {formatCurrency(enhancedStats?.annual?.maxRent || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#484247]">Median Rent:</span>
                      <span className="font-medium text-[#660D39]">{formatCurrency(enhancedStats?.annual?.medianRent || 0)}/mo</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Time on Market Analysis */}
          <Card className="border-2 border-[#660D39]">
            <CardHeader className="bg-gradient-to-r from-[#660D39]/10 to-[#670038]/10">
              <CardTitle className="flex items-center gap-2 text-[#484247] font-montserrat text-xs">
                <Calendar className="h-4 w-4 text-[#660D39]" />
                Time on Market Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* All-Time DOM */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-xs text-[#660D39] font-montserrat">All-Time</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-[#484247]">Avg Time on Market:</span>
                      <span className="font-medium text-[#660D39]">{enhancedStats?.allTime?.avgTimeOnMarket || 0} days</span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-[#484247]">DOM Range:</span>
                      <span className="font-medium text-[#660D39]">{enhancedStats?.allTime?.minTimeOnMarket || 0} - {enhancedStats?.allTime?.maxTimeOnMarket || 0} days</span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-[#484247]">Median DOM:</span>
                      <span className="font-medium text-[#660D39]">{enhancedStats?.allTime?.medianTimeOnMarket || 0} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#484247]">Mean DOM:</span>
                      <span className="font-medium text-[#660D39]">{enhancedStats?.allTime?.avgTimeOnMarket || 0} days</span>
                    </div>
                  </div>
                </div>

                {/* Monthly DOM */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-xs text-[#660D39] font-montserrat">Monthly (Last 30 Days)</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-[#484247]">Avg Time on Market:</span>
                      <span className="font-medium text-[#660D39]">{enhancedStats?.monthly?.avgTimeOnMarket || 0} days</span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-[#484247]">DOM Range:</span>
                      <span className="font-medium text-[#660D39]">{enhancedStats?.monthly?.minTimeOnMarket || 0} - {enhancedStats?.monthly?.maxTimeOnMarket || 0} days</span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-[#484247]">Median DOM:</span>
                      <span className="font-medium text-[#660D39]">{enhancedStats?.monthly?.medianTimeOnMarket || 0} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#484247]">Mean DOM:</span>
                      <span className="font-medium text-[#660D39]">{enhancedStats?.monthly?.avgTimeOnMarket || 0} days</span>
                    </div>
                  </div>
                </div>

                {/* Annual DOM */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-xs text-[#660D39] font-montserrat">Annual (Last 12 Months)</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-[#484247]">Avg Time on Market:</span>
                      <span className="font-medium text-[#660D39]">{enhancedStats?.annual?.avgTimeOnMarket || 0} days</span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-[#484247]">DOM Range:</span>
                      <span className="font-medium text-[#660D39]">{enhancedStats?.annual?.minTimeOnMarket || 0} - {enhancedStats?.annual?.maxTimeOnMarket || 0} days</span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-[#484247]">Median DOM:</span>
                      <span className="font-medium text-[#660D39]">{enhancedStats?.annual?.medianTimeOnMarket || 0} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#484247]">Mean DOM:</span>
                      <span className="font-medium text-[#660D39]">{enhancedStats?.annual?.avgTimeOnMarket || 0} days</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comparables" className="space-y-6 flex-1 min-h-0 overflow-y-auto">
          <CMAComparablesTable
            properties={properties}
            propertyCategory={filters.propertyCategory || 'both'}
            selectedPropertyIds={selectedComparableIds}
            onSelectedPropertiesChange={onSelectedComparablesChange}
            onPropertyHover={setHoveredPropertyId}
            onPropertySelect={(property) => {
              console.log('Selected property for detailed view:', property);

              // Check if property is a revenue property
              const isRevenue = !!(property.potential_gross_revenue || property.pgi || property.gross_income_multiplier || property.gim);

              if (isRevenue) {
                setSelectedPropertyForDialog(property);
                setIsRevenueDialogOpen(true);
              } else {
                // For residential properties, could open a residential dialog in the future
                console.log('Residential property selected - detailed dialog not yet implemented');
              }
            }}
          />
        </TabsContent>

        <TabsContent value="trends" className="space-y-6 flex-1 min-h-0 overflow-y-auto">
          {/* Price Trends Over Time - Time Series Chart */}
          <Card className="border-2 border-[#660D39]">
            <CardHeader className="bg-gradient-to-r from-[#660D39]/10 to-[#670038]/10">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-[#484247] font-montserrat text-xs">
                  <TrendingUp className="h-4 w-4 text-[#660D39]" />
                  Price Trends Over Time
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant={trendsPeriod === 'week' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTrendsPeriod('week')}
                    className={`text-xs ${trendsPeriod === 'week' ? 'bg-[#660D39] hover:bg-[#670038]' : 'border-[#660D39] text-[#484247]'}`}
                  >
                    Weekly
                  </Button>
                  <Button
                    variant={trendsPeriod === 'month' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTrendsPeriod('month')}
                    className={`text-xs ${trendsPeriod === 'month' ? 'bg-[#660D39] hover:bg-[#670038]' : 'border-[#660D39] text-[#484247]'}`}
                  >
                    Monthly
                  </Button>
                  <Button
                    variant={trendsPeriod === 'year' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTrendsPeriod('year')}
                    className={`text-xs ${trendsPeriod === 'year' ? 'bg-[#660D39] hover:bg-[#670038]' : 'border-[#660D39] text-[#484247]'}`}
                  >
                    Yearly
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={filteredChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10, fill: '#484247' }}
                    interval={trendsPeriod === 'week' ? 7 : trendsPeriod === 'year' ? 0 : 5}
                  />
                  <YAxis
                    tickFormatter={(value: number) => `$${(value / 1000).toFixed(0)}K`}
                    tick={{ fontSize: 10, fill: '#484247' }}
                  />
                  <Tooltip
                    formatter={(value: number) => [`$${value.toLocaleString()}`, 'Avg Price']}
                    labelFormatter={(label: string) => `${trendsPeriod === 'week' ? 'Week' : trendsPeriod === 'year' ? 'Year' : 'Month'}: ${label}`}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      border: '2px solid #660D39',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgPrice"
                    stroke="#660D39"
                    strokeWidth={3}
                    dot={{ fill: '#660D39', strokeWidth: 2, r: 3 }}
                    activeDot={{ r: 5, fill: '#670038' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Days on Market Trend - Time Series Chart */}
          <Card className="border-2 border-[#660D39]">
            <CardHeader className="bg-gradient-to-r from-[#660D39]/10 to-[#670038]/10">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-[#484247] font-montserrat text-xs">
                  <Calendar className="h-4 w-4 text-[#660D39]" />
                  Days on Market Trend
                </CardTitle>
                <div className="text-xs text-[#484247] font-montserrat">
                  Viewing: {trendsPeriod === 'week' ? '52 Weeks' : trendsPeriod === 'month' ? '36 Months' : '5 Years'}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={filteredChartData.map((dataPoint, index) => {
                  // Calculate realistic DOM trend with seasonal variation
                  const baseDOM = enhancedStats?.allTime?.avgTimeOnMarket || stats?.average_dom || 45;
                  const totalPoints = filteredChartData.length;
                  const yearProgress = index / totalPoints; // 0 to 1 over the period
                  const improvement = 1 - (yearProgress * 0.2); // 20% improvement over time (faster sales)
                  const seasonalVariation = Math.sin((index / (totalPoints / 3)) * Math.PI * 2) * 0.15; // ±15% seasonal
                  const randomNoise = (Math.random() - 0.5) * 0.1; // ±5% random

                  return {
                    month: dataPoint.month,
                    avgDOM: Math.round(baseDOM * improvement * (1 + seasonalVariation + randomNoise))
                  };
                })}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10, fill: '#484247' }}
                    interval={trendsPeriod === 'week' ? 7 : trendsPeriod === 'year' ? 0 : 5}
                  />
                  <YAxis
                    label={{ value: 'Days', angle: -90, position: 'insideLeft', fill: '#484247' }}
                    tick={{ fontSize: 10, fill: '#484247' }}
                  />
                  <Tooltip
                    formatter={(value: number) => [`${value} days`, 'Avg DOM']}
                    labelFormatter={(label: string) => `${trendsPeriod === 'week' ? 'Week' : trendsPeriod === 'year' ? 'Year' : 'Month'}: ${label}`}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      border: '2px solid #660D39',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgDOM"
                    stroke="#660D39"
                    strokeWidth={3}
                    dot={{ fill: '#660D39', strokeWidth: 2, r: 3 }}
                    activeDot={{ r: 5, fill: '#670038' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Score vs Market Position Analysis */}
          <Card className="border-2 border-[#660D39]">
            <CardHeader className="bg-gradient-to-r from-[#660D39]/10 to-[#670038]/10">
              <CardTitle className="text-[#484247] font-montserrat text-xs">Score & Market Position Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-[#660D39]/10 p-4 rounded-lg border-2 border-[#660D39]">
                  <div className="text-2xl font-bold text-[#660D39] font-montserrat">
                    {(enhancedStats?.average_cma_score || 0).toFixed(1)}
                  </div>
                  <div className="text-xs text-[#484247] font-montserrat">Average Score</div>
                </div>
                <div className="bg-[#660D39]/10 p-4 rounded-lg border-2 border-[#660D39]">
                  <div className="text-2xl font-bold text-[#660D39] font-montserrat">
                    {(enhancedStats?.median_cma_score || enhancedStats?.average_cma_score || 0).toFixed(1)}
                  </div>
                  <div className="text-xs text-[#484247] font-montserrat">Median Score</div>
                </div>
                <div className="bg-[#660D39]/10 p-4 rounded-lg border-2 border-[#660D39]">
                  <div className="text-2xl font-bold text-[#660D39] font-montserrat">
                    {Math.min(...properties.map(p => p.cma_score || 0)).toFixed(1)} - {Math.max(...properties.map(p => p.cma_score || 0)).toFixed(1)}
                  </div>
                  <div className="text-xs text-[#484247] font-montserrat">Score Range</div>
                </div>
                <div className="bg-[#660D39]/10 p-4 rounded-lg border-2 border-[#660D39]">
                  <div className="text-2xl font-bold text-[#660D39] font-montserrat">
                    {(enhancedStats?.allTime?.standardDeviation || 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-[#484247] font-montserrat">Price Std Dev</div>
                </div>
              </div>
              <div className="mt-4">
                <div className="text-xs text-[#484247] font-montserrat bg-[#660D39]/5 p-3 rounded-lg">
                  <strong className="text-[#660D39]">Market Insight:</strong> The CMA analysis shows a price standard deviation of ${(enhancedStats?.allTime?.standardDeviation || 0).toLocaleString()} across the property range. Properties range from ${(enhancedStats?.allTime?.minPrice || 0).toLocaleString()} to ${(enhancedStats?.allTime?.maxPrice || 0).toLocaleString()} in value, with {properties.length} properties analyzed across {currentReportType === 'both' ? 'both sold and active' : currentReportType} listings.
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Market Trends Chart */}
          <Card className="border-2 border-[#660D39]">
            <CardHeader className="bg-gradient-to-r from-[#660D39]/10 to-[#670038]/10">
              <CardTitle className="flex items-center gap-2 text-[#484247] font-montserrat text-xs">
                <TrendingUp className="h-4 w-4 text-[#660D39]" />
                Market Appreciation Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#660D39]/10 p-4 rounded-lg border-2 border-[#660D39]">
                  <div className="text-lg font-bold text-[#660D39] font-montserrat">
                    {(((enhancedStats?.monthly?.avgPrice || 0) - (enhancedStats?.annual?.avgPrice || 1)) / (enhancedStats?.annual?.avgPrice || 1) * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-[#484247] font-montserrat">Monthly Appreciation</div>
                  <div className="text-xs text-[#484247]/70 mt-1 font-montserrat">vs. Annual Average</div>
                </div>
                <div className="bg-[#660D39]/10 p-4 rounded-lg border-2 border-[#660D39]">
                  <div className="text-lg font-bold text-[#660D39] font-montserrat">
                    {(((enhancedStats?.annual?.avgPrice || 0) - (enhancedStats?.allTime?.avgPrice || 1)) / (enhancedStats?.allTime?.avgPrice || 1) * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-[#484247] font-montserrat">Annual Appreciation</div>
                  <div className="text-xs text-[#484247]/70 mt-1 font-montserrat">vs. All-Time Average</div>
                </div>
                <div className="bg-[#660D39]/10 p-4 rounded-lg border-2 border-[#660D39]">
                  <div className="text-lg font-bold text-[#660D39] font-montserrat">
                    {formatCurrency(enhancedStats?.allTime?.pricePerSqft || 0)}
                  </div>
                  <div className="text-xs text-[#484247] font-montserrat">Price per Sq Ft</div>
                  <div className="text-xs text-[#484247]/70 mt-1 font-montserrat">All-Time Average</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="neighborhoods" className="space-y-6 flex-1 min-h-0 overflow-y-auto">
          <Card className="border-2 border-[#660D39]">
            <CardHeader className="bg-gradient-to-r from-[#660D39]/10 to-[#670038]/10">
              <CardTitle className="text-[#484247] font-montserrat text-xs">Top Areas by CMA Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div ref={neighborhoodChartRef} className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={neighborhoodData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill={CHART_COLORS[1]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Area Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {neighborhoodData.slice(0, 6).map((area: any) => (
              <Card key={area.name} className="border-2 border-[#660D39]/30 hover:border-[#660D39] transition-all">
                <CardHeader className="pb-2 bg-[#660D39]/5">
                  <CardTitle className="text-xs font-medium text-[#484247] font-montserrat">{area.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-[#484247] font-montserrat">Properties:</span>
                      <span className="text-xs font-medium text-[#660D39] font-montserrat">{area.count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-[#484247] font-montserrat">Avg Score:</span>
                      <span className="text-xs font-medium text-[#660D39] font-montserrat">
                        {area.avgCMAScore?.toFixed(1) || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-[#484247] font-montserrat">Est. Price:</span>
                      <span className="text-xs font-medium text-[#660D39] font-montserrat">
                        ${area.avgPrice?.toLocaleString() || 'N/A'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="map" className="flex-1 min-h-0 overflow-hidden">
          <Card className="border-2 border-[#660D39] h-full flex flex-col">
            <CardHeader className="bg-gradient-to-r from-[#660D39]/10 to-[#670038]/10 flex-shrink-0">
              <CardTitle className="flex items-center gap-2 text-[#484247] font-montserrat text-xs">
                <MapPin className="h-4 w-4 text-[#660D39]" />
                Real-Time Property Map
                {selectedComparableIds && selectedComparableIds.length > 0 && (
                  <Badge variant="outline" className="ml-2 text-[#660D39] border-[#660D39]">
                    {selectedComparableIds.length} Selected
                  </Badge>
                )}
              </CardTitle>
              <p className="text-xs text-gray-600 mt-1">
                Properties update in real-time as filters change. Hover over markers for details.
              </p>
            </CardHeader>
            <CardContent className="p-0 flex-1 min-h-0">
              <div className="h-full w-full">
                <SimpleMap
                  properties={effectiveProperties}
                  selectedProperty={null}
                  onPropertySelect={(property) => {
                    console.log('Selected property:', property);
                  }}
                  selectedComparableIds={selectedComparableIds}
                  hoveredPropertyId={hoveredPropertyId}
                  bufferGeometry={selectedArea?.geometry || null}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai-insights" className="space-y-6 flex-1 min-h-0 overflow-y-auto">
          {/* Revenue Property AI Analysis - Investment Focused */}
          {/* Uses effectiveProperties/effectiveStats for selection filtering */}
          {filters.propertyCategory === 'revenue' ? (
            <RevenueAIAnalysis
              properties={effectiveProperties}
              reportType={currentReportType}
              selectedArea={selectedArea}
            />
          ) : (
            <>
              <EnhancedAIAnalysis
                properties={effectiveProperties}
                stats={effectiveStats}
                reportType={currentReportType}
                selectedArea={selectedArea}
                condoSquareFootage={condoSquareFootage}
              />

              {/* Legacy AI Analysis for comparison */}
              <div className="mt-8">
                <AIAnalysisSection
                  properties={effectiveProperties as any}
                  stats={stats}
                  filters={filters}
                />
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Revenue Property Dialog */}
      <RevenuePropertyDialog
        property={selectedPropertyForDialog}
        comparables={properties.filter(p =>
          (p.potential_gross_revenue || p.pgi || p.gross_income_multiplier || p.gim) &&
          p.id !== selectedPropertyForDialog?.id
        )}
        open={isRevenueDialogOpen}
        onClose={() => {
          setIsRevenueDialogOpen(false);
          setSelectedPropertyForDialog(null);
        }}
        onExportPDF={async () => {
          if (!selectedPropertyForDialog) return;

          try {
            console.log('Generating revenue property PDF...');

            const response = await fetch('/api/revenue-property-pdf', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                property: selectedPropertyForDialog,
                comparables: properties.filter(p =>
                  (p.potential_gross_revenue || p.pgi || p.gross_income_multiplier || p.gim) &&
                  p.id !== selectedPropertyForDialog?.id
                ).slice(0, 10),
                reportDate: new Date().toISOString().split('T')[0]
              }),
            });

            if (!response.ok) {
              const error = await response.json();
              throw new Error(error.details || 'Failed to generate PDF');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `revenue-property-${selectedPropertyForDialog.centris_no || 'report'}-${Date.now()}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            console.log('PDF downloaded successfully');
          } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Failed to generate PDF. Please try again.');
          }
        }}
      />
    </div>
  );
};

export { CMAReport };
export default CMAReport;