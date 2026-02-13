'use client';

/**
 * Donor Concentration Tool - Main Dashboard
 *
 * Features:
 * - Filters bar (election cycle, party, view mode)
 * - Summary statistics cards
 * - Top ZIP codes table with sorting
 * - RFM donor segments table
 * - ZIP detail panel (dialog)
 * - Export and prospect finder actions
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Target,
  TrendingUp,
  Users,
  DollarSign,
  Gift,
  AlertCircle,
  LineChart,
  Loader2,
  RefreshCw,
} from 'lucide-react';

import { DonorTimeSeriesAdapter } from './DonorTimeSeriesAdapter';
import { LapsedDonorPanel } from './LapsedDonorPanel';
import { UpgradeProspectPanel } from './UpgradeProspectPanel';
import { ComparisonView } from './ComparisonView';
import { IESpendingPanel } from './IESpendingPanel';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// NOTE: AIToolAssistant removed - UnifiedAIAssistant is now rendered at page level (app/donors/page.tsx)
// This prevents duplicate AI chat interfaces on the same page

// Wave 6A: State Management for AI context sync
import { getStateManager } from '@/lib/ai-native/ApplicationStateManager';
import { CrossToolNavigator } from '@/lib/ai-native/navigation/CrossToolNavigator';
import { useToast } from '@/hooks/use-toast';
import type { MapCommand } from '@/lib/ai-native/types';

import type {
  Contribution,
  ZIPAggregate,
  DonorProfile,
  DonorSummaryStats,
  DonorFilters,
  ZIPDetailData,
  RFMSegment,
  LapsedDonorData,
  UpgradeProspectData,
  Candidate,
  IndependentExpenditureData,
} from '@/lib/donor/types';

// RFM Segment Configuration
const RFM_SEGMENTS: Record<
  DonorProfile['segment'],
  Omit<RFMSegment, 'donorCount' | 'totalAmount' | 'avgGift'>
> = {
  champion: {
    segment: 'champion',
    name: 'Champions',
    description: 'Recent, frequent, high-value donors',
    emoji: '🏆',
    strategy: 'Thank, recognize, exclusive access',
  },
  loyal: {
    segment: 'loyal',
    name: 'Loyal Donors',
    description: 'Regular mid-level contributors',
    emoji: '💎',
    strategy: 'Upgrade asks, monthly giving programs',
  },
  potential: {
    segment: 'potential',
    name: 'Potential Loyalists',
    description: 'Recent donors, not yet frequent',
    emoji: '⭐',
    strategy: 'Nurture, welcome series, second gift',
  },
  at_risk: {
    segment: 'at_risk',
    name: 'At Risk',
    description: "Were valuable, haven't given recently",
    emoji: '⚠️',
    strategy: 'Reactivation campaigns, special appeals',
  },
  lapsed: {
    segment: 'lapsed',
    name: 'Lapsed',
    description: "Haven't given in 12+ months",
    emoji: '💤',
    strategy: 'Win-back campaigns, updated messaging',
  },
  prospect: {
    segment: 'prospect',
    name: 'Prospects',
    description: 'High-capacity area, no donation history',
    emoji: '🎯',
    strategy: 'Acquisition, events, peer-to-peer',
  },
};

interface DonorDashboardProps {
  className?: string;
  onMapCommand?: (command: MapCommand) => void;
}

type SortField = 'zipCode' | 'totalAmount' | 'donorCount' | 'avgContribution';
type SortDirection = 'asc' | 'desc';

// Memoized ZIP row component for performance
const ZIPRow = React.memo(function ZIPRow({
  zip,
  index,
  formatCurrency,
  formatNumber,
  onClick,
}: {
  zip: ZIPAggregate;
  index: number;
  formatCurrency: (amount: number) => string;
  formatNumber: (num: number) => string;
  onClick: (zipCode: string) => void;
}) {
  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => onClick(zip.zipCode)}
    >
      <TableCell className="font-medium">{index + 1}</TableCell>
      <TableCell className="font-mono">{zip.zipCode}</TableCell>
      <TableCell>{zip.city}</TableCell>
      <TableCell>{formatCurrency(zip.totalAmount)}</TableCell>
      <TableCell>{formatNumber(zip.donorCount)}</TableCell>
      <TableCell>{formatCurrency(zip.avgContribution)}</TableCell>
    </TableRow>
  );
});

// Memoized RFM segment row component
const RFMSegmentRow = React.memo(function RFMSegmentRow({
  segment,
  formatNumber,
  formatCurrency,
  onExport,
}: {
  segment: RFMSegment;
  formatNumber: (num: number) => string;
  formatCurrency: (amount: number) => string;
  onExport: (segmentName: string) => void;
}) {
  return (
    <TableRow>
      <TableCell>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xl">{segment.emoji}</span>
            <span className="font-medium">{segment.name}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {segment.description}
          </div>
        </div>
      </TableCell>
      <TableCell className="text-right font-medium">
        {formatNumber(segment.donorCount)}
      </TableCell>
      <TableCell className="text-right">
        {formatCurrency(segment.totalAmount)}
      </TableCell>
      <TableCell className="text-right">
        {formatCurrency(segment.avgGift)}
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onExport(segment.segment)}
        >
          <Download className="h-3 w-3" />
        </Button>
      </TableCell>
    </TableRow>
  );
});

export function DonorDashboard({ className, onMapCommand }: DonorDashboardProps) {
  // Wave 6A: Toast for feedback
  const { toast } = useToast();

  // State
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [zipAggregates, setZipAggregates] = useState<ZIPAggregate[]>([]);
  const [donorProfiles, setDonorProfiles] = useState<DonorProfile[]>([]);
  const [summaryStats, setSummaryStats] = useState<DonorSummaryStats | null>(null);
  const [selectedZIP, setSelectedZIP] = useState<string | null>(null);
  const [zipDetailData, setZipDetailData] = useState<ZIPDetailData | null>(null);

  // New data for additional panels
  const [lapsedData, setLapsedData] = useState<LapsedDonorData | null>(null);
  const [upgradeData, setUpgradeData] = useState<UpgradeProspectData | null>(null);
  const [candidatesData, setCandidatesData] = useState<Record<string, Candidate>>({});
  const [ieData, setIEData] = useState<IndependentExpenditureData | null>(null);

  const [filters, setFilters] = useState<DonorFilters>({
    cycle: '2024',
    party: 'all',
    view: 'table',
  });

  const [sortField, setSortField] = useState<SortField>('totalAmount');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const [isLoading, setIsLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [timeSeriesData, setTimeSeriesData] = useState<any>(null);
  const [showTimeSeries, setShowTimeSeries] = useState(false);
  const [showProspectFinder, setShowProspectFinder] = useState(false);
  const [campaignZIPs, setCampaignZIPs] = useState<Set<string>>(new Set());

  // Tab navigation state
  const [activeTab, setActiveTab] = useState<string>('overview');

  // Wave 6A: Subscribe to ApplicationStateManager events
  useEffect(() => {
    const stateManager = getStateManager();

    const unsubscribe = stateManager.subscribe((state, event) => {
      switch (event.type) {
        case 'PRECINCT_SELECTED':
          // When user clicks a precinct, show donors for that area's ZIP
          console.log('[DonorDashboard] Precinct selected:', event.payload);
          break;

        case 'SEGMENT_CREATED':
          // When segment is created, suggest donor analysis for those areas
          console.log('[DonorDashboard] Segment created:', event.payload);
          break;

        case 'DONOR_FILTER_CHANGED':
          // Another component changed donor filters - sync if external
          console.log('[DonorDashboard] External donor filter change:', event.payload);
          break;
      }
    });

    // Set current tool context
    stateManager.dispatch({
      type: 'TOOL_CHANGED',
      payload: { tool: 'donors' },
      timestamp: new Date(),
    });

    return () => unsubscribe();
  }, []);

  // Handle adding ZIP to campaign list
  const handleAddToCampaign = (zipCode: string) => {
    setCampaignZIPs((prev: Set<string>) => {
      const newSet = new Set(prev);
      if (newSet.has(zipCode)) {
        newSet.delete(zipCode);
      } else {
        newSet.add(zipCode);
      }
      return newSet;
    });
  };

  // Fetch data on mount
  useEffect(() => {
    fetchDonorData();
    fetchAdditionalData();
  }, []);

  const fetchAdditionalData = async () => {
    try {
      // S8-014: Helper function to safely parse JSON responses
      const safeJsonParse = async (response: Response, context: string) => {
        if (!response.ok) return null;

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.warn(`${context}: Server returned non-JSON response`);
          return null;
        }

        try {
          return await response.json();
        } catch (jsonError) {
          console.warn(`${context}: Invalid JSON response`, jsonError);
          return null;
        }
      };

      // Fetch lapsed donors
      const lapsedRes = await fetch('/data/donors/lapsed-donors.json');
      const lapsedJson = await safeJsonParse(lapsedRes, 'Lapsed donors');
      if (lapsedJson) {
        setLapsedData(lapsedJson);
      }

      // Fetch upgrade prospects
      const upgradeRes = await fetch('/data/donors/upgrade-prospects.json');
      const upgradeJson = await safeJsonParse(upgradeRes, 'Upgrade prospects');
      if (upgradeJson) {
        setUpgradeData(upgradeJson);
      }

      // Fetch candidates
      const candidatesRes = await fetch('/data/donors/mi-candidates.json');
      const candidatesJson = await safeJsonParse(candidatesRes, 'Candidates');
      if (candidatesJson?.candidates) {
        setCandidatesData(candidatesJson.candidates);
      }

      // Fetch IE data
      const ieRes = await fetch('/data/donors/independent-expenditures.json');
      const ieJson = await safeJsonParse(ieRes, 'IE data');
      if (ieJson) {
        setIEData(ieJson);
      }
    } catch (err) {
      console.log('Additional data not available:', err);
      // Non-blocking - these are optional features
    }
  };

  const fetchDonorData = async () => {
    try {
      setIsLoading(true);

      // Fetch summary stats, ZIP aggregates, and donor segments in parallel
      const [summaryRes, aggregatesRes, profilesRes] = await Promise.all([
        fetch('/api/donors?action=summary'),
        fetch('/api/donors?action=aggregates'),
        fetch('/api/donors?action=profiles'),
      ]);

      // S8-014: Check for 503 (data not available) specifically
      if (summaryRes.status === 503 || aggregatesRes.status === 503 || profilesRes.status === 503) {
        // Safely parse error response with validation
        let errorData: any = {};
        try {
          const contentType = summaryRes.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            errorData = await summaryRes.json();
          }
        } catch {
          // Ignore JSON parse errors for error response
        }

        throw new Error(
          errorData.error ||
          'FEC donor data not yet loaded. Run the ingestion script: FEC_API_KEY=your_key npx tsx scripts/donor-ingestion/fetch-fec-api.ts'
        );
      }

      // S8-014: Validate all responses before parsing JSON
      if (!summaryRes.ok || !aggregatesRes.ok || !profilesRes.ok) {
        throw new Error(`HTTP error: ${summaryRes.status} ${summaryRes.statusText}`);
      }

      // Check Content-Type headers
      const validateContentType = (res: Response, name: string) => {
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error(`${name} returned non-JSON response`);
        }
      };

      validateContentType(summaryRes, 'Summary API');
      validateContentType(aggregatesRes, 'Aggregates API');
      validateContentType(profilesRes, 'Profiles API');

      // Parse JSON with error handling
      const [summaryData, aggregatesData, profilesData] = await Promise.all([
        summaryRes.json().catch(() => {
          throw new Error('Invalid JSON from summary API');
        }),
        aggregatesRes.json().catch(() => {
          throw new Error('Invalid JSON from aggregates API');
        }),
        profilesRes.json().catch(() => {
          throw new Error('Invalid JSON from profiles API');
        }),
      ]);

      // Map API response to component state
      if (summaryData.success && summaryData.data) {
        const stats = summaryData.data;
        setSummaryStats({
          totalRaised: stats.totalRaised,
          uniqueDonors: stats.uniqueDonors,
          totalContributions: stats.totalContributions,
          avgGift: stats.avgGift,
          medianGift: stats.medianGift || stats.avgGift * 0.35, // Use actual median if available
          largestGift: stats.largestGift,
          demAmount: stats.demAmount,
          repAmount: stats.repAmount,
          otherAmount: stats.otherAmount,
          demPercent: stats.demPct,
          repPercent: stats.repPct,
          otherPercent: stats.otherPct,
        });
      }

      if (aggregatesData.success && aggregatesData.data) {
        setZipAggregates(aggregatesData.data);
      }

      if (profilesData.success && profilesData.data) {
        setDonorProfiles(profilesData.data);
      }

      // Also fetch time series data (non-blocking)
      fetchTimeSeriesData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      console.error('Error fetching donor data:', err);
      toast({
        title: 'Error Loading Donor Data',
        description: errorMessage.includes('Run the ingestion script')
          ? 'FEC donor data not yet loaded. Please run the data ingestion script or try another tool.'
          : `Unable to load donor data: ${errorMessage}. Please refresh the page or try again later.`,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch time series data for charts
  const fetchTimeSeriesData = async () => {
    try {
      const response = await fetch('/api/donors?action=timeseries');

      // S8-014: Validate response before parsing JSON
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Server returned non-JSON response');
        }

        let data;
        try {
          data = await response.json();
        } catch (jsonError) {
          throw new Error('Invalid JSON response from server');
        }

        if (data.success && data.data) {
          setTimeSeriesData(data.data);
        }
      } else {
        // Show error notification if time series fails to load
        const errorMessage = response.status === 404
          ? 'Historical donation data not available yet'
          : 'Unable to load historical data';

        toast({
          title: 'Historical Data Unavailable',
          description: `${errorMessage}. Other features are still available.`,
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Time series data error:', err);
      toast({
        title: 'Historical Data Unavailable',
        description: 'Unable to load donation trends. Other features are still available.',
        variant: 'destructive',
      });
    }
  };

  // Fetch ZIP detail data when ZIP is selected
  useEffect(() => {
    if (selectedZIP) {
      fetchZIPDetail(selectedZIP);
    }
  }, [selectedZIP]);

  const fetchZIPDetail = async (zipCode: string) => {
    try {
      const response = await fetch(`/api/donors?action=zip&zipCode=${zipCode}`);

      // S8-014: Validate response before parsing JSON
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response');
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        throw new Error('Invalid JSON response from server');
      }
      if (data.success && data.data) {
        // API now returns aggregate with topOccupations included
        const aggregate = data.data;
        setZipDetailData({
          zipCode: aggregate.zipCode,
          city: aggregate.city,
          state: aggregate.state,
          aggregate,
          topOccupations: aggregate.topOccupations || [],
          monthlyTrend: [], // Not available from current API
        });
      }
    } catch (err) {
      console.error('Error fetching ZIP detail:', err);
      setZipDetailData(null);

      // S8-012: Show error toast to user
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast({
        title: 'ZIP Details Unavailable',
        description: `Unable to load details for ZIP ${zipCode}. ${errorMessage}`,
        variant: 'destructive',
      });
    }
  };

  // Calculate cycle date ranges
  const getCycleDateRange = (cycle: string): { start: string; end: string } | null => {
    switch (cycle) {
      case '2024':
        return { start: '2023-01', end: '2024-12' };
      case '2022':
        return { start: '2021-01', end: '2022-12' };
      case '2020':
        return { start: '2019-01', end: '2020-12' };
      default:
        return null;
    }
  };

  // Calculate cycle totals from time series data
  const cycleTotals = useMemo(() => {
    if (!timeSeriesData?.monthlyTotals || filters.cycle === 'all') return null;

    const dateRange = getCycleDateRange(filters.cycle);
    if (!dateRange) return null;

    const cycleMonths = timeSeriesData.monthlyTotals.filter(
      (m: { month: string }) => m.month >= dateRange.start && m.month <= dateRange.end
    );

    if (cycleMonths.length === 0) return null;

    return cycleMonths.reduce(
      (acc: { totalAmount: number; contributions: number; demAmount: number; repAmount: number; otherAmount: number }, m: { totalAmount: number; contributionCount: number; demAmount: number; repAmount: number; otherAmount: number }) => ({
        totalAmount: acc.totalAmount + m.totalAmount,
        contributions: acc.contributions + m.contributionCount,
        demAmount: acc.demAmount + m.demAmount,
        repAmount: acc.repAmount + m.repAmount,
        otherAmount: acc.otherAmount + m.otherAmount,
      }),
      { totalAmount: 0, contributions: 0, demAmount: 0, repAmount: 0, otherAmount: 0 }
    );
  }, [timeSeriesData, filters.cycle]);

  // Filter ZIP aggregates
  const filteredZIPs = useMemo(() => {
    let filtered = [...zipAggregates];

    // Note: ZIP-level cycle filtering is not available because aggregates
    // are pre-computed across all time. We show cycle totals from time-series
    // data in the summary stats instead.
    if (filters.cycle !== 'all') {
      console.log(`[DonorDashboard] Cycle filter '${filters.cycle}' applied - showing cycle totals from time-series data`);
    }

    // Filter by party
    if (filters.party !== 'all') {
      filtered = filtered.filter((zip) => {
        const partyAmount = filters.party === 'DEM' ? zip.demAmount : zip.repAmount;
        const otherAmount = filters.party === 'DEM' ? zip.repAmount : zip.demAmount;
        return partyAmount > otherAmount;
      });
      console.log(`[DonorDashboard] Filtered to ${filtered.length} ZIPs for party ${filters.party}`);
    }

    return filtered;
  }, [zipAggregates, filters.party, filters.cycle]);

  // Calculate summary stats from FILTERED data
  // Wave 7/8: Performance optimization - single-pass aggregation
  const filteredSummaryStats = useMemo(() => {
    if (!summaryStats) return null;

    // If no filters applied, return original summary
    if (filters.party === 'all' && filters.cycle === 'all') {
      return summaryStats;
    }

    // If cycle filter is applied and we have cycle totals, use those for the header stats
    if (filters.cycle !== 'all' && cycleTotals && filters.party === 'all') {
      const totalRaised = cycleTotals.totalAmount;
      return {
        totalRaised,
        uniqueDonors: summaryStats.uniqueDonors, // Can't filter by cycle
        totalContributions: cycleTotals.contributions,
        avgGift: cycleTotals.contributions > 0 ? totalRaised / cycleTotals.contributions : 0,
        medianGift: summaryStats.medianGift, // Can't calculate per-cycle median without raw data
        largestGift: summaryStats.largestGift, // Can't filter by cycle
        demAmount: cycleTotals.demAmount,
        repAmount: cycleTotals.repAmount,
        otherAmount: cycleTotals.otherAmount,
        demPercent: totalRaised > 0 ? (cycleTotals.demAmount / totalRaised) * 100 : 0,
        repPercent: totalRaised > 0 ? (cycleTotals.repAmount / totalRaised) * 100 : 0,
        otherPercent: totalRaised > 0 ? (cycleTotals.otherAmount / totalRaised) * 100 : 0,
      };
    }

    // Recalculate from filtered ZIPs using single-pass reduce
    const aggregated = filteredZIPs.reduce((acc, z) => {
      acc.totalRaised += z.totalAmount;
      acc.uniqueDonors += z.donorCount;
      acc.totalContributions += z.contributionCount;
      acc.demAmount += z.demAmount;
      acc.repAmount += z.repAmount;
      acc.otherAmount += z.otherAmount;
      if (z.maxSingleDonation > acc.largestGift) {
        acc.largestGift = z.maxSingleDonation;
      }
      // Collect median data for weighted calculation
      if (z.medianContribution > 0) {
        acc.medianData.push({ median: z.medianContribution, weight: z.contributionCount });
      }
      return acc;
    }, {
      totalRaised: 0,
      uniqueDonors: 0,
      totalContributions: 0,
      demAmount: 0,
      repAmount: 0,
      otherAmount: 0,
      largestGift: 0,
      medianData: [] as { median: number; weight: number }[],
    });

    // Calculate weighted median from filtered ZIPs
    let medianGift = 0;
    if (aggregated.medianData.length > 0) {
      aggregated.medianData.sort((a, b) => a.median - b.median);
      const totalWeight = aggregated.medianData.reduce((sum, d) => sum + d.weight, 0);
      let cumulativeWeight = 0;
      const halfWeight = totalWeight / 2;
      for (const d of aggregated.medianData) {
        cumulativeWeight += d.weight;
        if (cumulativeWeight >= halfWeight) {
          medianGift = d.median;
          break;
        }
      }
    }

    return {
      ...aggregated,
      avgGift: aggregated.totalContributions > 0 ? aggregated.totalRaised / aggregated.totalContributions : 0,
      medianGift,
      demPercent: aggregated.totalRaised > 0 ? (aggregated.demAmount / aggregated.totalRaised) * 100 : 0,
      repPercent: aggregated.totalRaised > 0 ? (aggregated.repAmount / aggregated.totalRaised) * 100 : 0,
      otherPercent: aggregated.totalRaised > 0 ? (aggregated.otherAmount / aggregated.totalRaised) * 100 : 0,
    };
  }, [filteredZIPs, summaryStats, filters.party, filters.cycle, cycleTotals]);

  // Sort ZIP aggregates
  const sortedZIPs = useMemo(() => {
    const sorted = [...filteredZIPs];

    sorted.sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      switch (sortField) {
        case 'zipCode':
          aVal = a.zipCode;
          bVal = b.zipCode;
          break;
        case 'totalAmount':
          aVal = a.totalAmount;
          bVal = b.totalAmount;
          break;
        case 'donorCount':
          aVal = a.donorCount;
          bVal = b.donorCount;
          break;
        case 'avgContribution':
          aVal = a.avgContribution;
          bVal = b.avgContribution;
          break;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortDirection === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    return sorted;
  }, [filteredZIPs, sortField, sortDirection]);

  // Calculate RFM segments
  // Wave 7/8: Performance optimization - efficient grouping and aggregation
  const rfmSegments = useMemo(() => {
    // Group profiles and calculate aggregates in single pass
    const segmentGroups = donorProfiles.reduce((acc, profile) => {
      if (!acc[profile.segment]) {
        acc[profile.segment] = {
          profiles: [],
          totalAmount: 0,
          count: 0,
        };
      }
      acc[profile.segment].profiles.push(profile);
      acc[profile.segment].totalAmount += profile.totalContributed;
      acc[profile.segment].count += 1;
      return acc;
    }, {} as Record<string, { profiles: DonorProfile[]; totalAmount: number; count: number }>);

    // Map to RFMSegment format
    const segments: RFMSegment[] = Object.entries(segmentGroups).map(
      ([segment, data]) => {
        const avgGift = data.count > 0 ? data.totalAmount / data.count : 0;

        return {
          ...RFM_SEGMENTS[segment as DonorProfile['segment']],
          donorCount: data.count,
          totalAmount: data.totalAmount,
          avgGift,
        };
      }
    );

    return segments;
  }, [donorProfiles]);

  // Get prospect ZIPs (sorted by prospect score)
  // Wave 7/8: Performance optimization - efficient filtering and sorting
  const prospectZIPs = useMemo(() => {
    // Pre-filter before sort to reduce sorting workload
    const highPotential = zipAggregates.filter(zip => zip.prospectScore >= 50);

    // Sort only the filtered subset
    highPotential.sort((a, b) => b.prospectScore - a.prospectScore);

    // Return top 20
    return highPotential.slice(0, 20);
  }, [zipAggregates]);

  // Handlers
  const handleSort = (field: SortField) => {
    setIsFiltering(true);
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    // Brief loading indicator for visual feedback
    setTimeout(() => setIsFiltering(false), 200);
  };

  const handleFilterChange = (key: keyof DonorFilters, value: string) => {
    console.log(`[DonorDashboard] Filter change: ${key} = ${value}`);
    setIsFiltering(true);
    setFilters((prev: DonorFilters) => {
      const updated = { ...prev, [key]: value };
      console.log('[DonorDashboard] Updated filters:', updated);

      // Wave 6A: Emit state change for AI context awareness
      const stateManager = getStateManager();
      stateManager.dispatch({
        type: 'DONOR_FILTER_CHANGED',
        payload: {
          filters: updated,
          filterKey: key,
          filterValue: value,
          resultCount: filteredZIPs.length,
        },
        timestamp: new Date(),
      });

      // Log exploration for AI context
      stateManager.logExploration({
        tool: 'donors',
        action: 'filter_changed',
        result: `${key} = ${value}`,
      });

      return updated;
    });
    // Brief loading indicator for visual feedback
    setTimeout(() => setIsFiltering(false), 300);
  };

  const handleZIPClick = (zipCode: string) => {
    setSelectedZIP(zipCode);

    // Wave 6A: Log ZIP selection for AI context
    const stateManager = getStateManager();
    stateManager.logExploration({
      tool: 'donors',
      action: 'zip_selected',
      metadata: { zipCode },
    });
  };

  const handleExportAllData = () => {
    // Generate CSV
    const csv = generateCSV(filteredZIPs);
    downloadCSV(csv, `donor-data-${filters.cycle}.csv`);

    // Wave 6A: Notify of export and show toast
    const stateManager = getStateManager();
    stateManager.dispatch({
      type: 'DATA_EXPORTED',
      payload: {
        tool: 'donors',
        format: 'csv',
        recordCount: filteredZIPs.length,
        filename: `donor-data-${filters.cycle}.csv`,
      },
      timestamp: new Date(),
    });

    toast({
      title: 'Data exported',
      description: `Exported ${filteredZIPs.length} ZIP codes to CSV`,
    });
  };

  const handleExportSegment = (segment: string) => {
    const segmentProfiles = donorProfiles.filter((p) => p.segment === segment);
    const csv = generateDonorCSV(segmentProfiles);
    downloadCSV(csv, `donor-segment-${segment}.csv`);

    // Wave 6A: Notify of segment export
    const stateManager = getStateManager();
    stateManager.dispatch({
      type: 'DATA_EXPORTED',
      payload: {
        tool: 'donors',
        format: 'csv',
        segment,
        recordCount: segmentProfiles.length,
        filename: `donor-segment-${segment}.csv`,
      },
      timestamp: new Date(),
    });

    toast({
      title: 'Segment exported',
      description: `Exported ${segmentProfiles.length} donors from "${segment}" segment`,
    });
  };

  const handleFindProspects = () => {
    setShowProspectFinder(true);

    // Wave 6A: Log exploration
    const stateManager = getStateManager();
    stateManager.logExploration({
      tool: 'donors',
      action: 'prospect_finder_opened',
      result: 'Opened prospect finder panel',
    });
  };

  /**
   * Handle AI actions
   */
  const handleAIAction = (action: { type: string; payload: Record<string, unknown> }) => {
    console.log('[DonorDashboard] AI action received:', action);

    switch (action.type) {
      case 'applyFilter':
        // Apply filters from AI suggestion
        if (action.payload.cycle) {
          handleFilterChange('cycle', action.payload.cycle as string);
        }
        if (action.payload.party) {
          handleFilterChange('party', action.payload.party as string);
        }
        if (action.payload.view) {
          handleFilterChange('view', action.payload.view as string);
        }
        break;

      case 'showOnMap':
        // Show donor concentration on map
        if (action.payload.zipCode) {
          handleZIPClick(action.payload.zipCode as string);
        }
        break;

      case 'exportData':
        // Export data
        if (action.payload.type === 'all') {
          handleExportAllData();
        } else if (action.payload.type === 'segment' && action.payload.segment) {
          handleExportSegment(action.payload.segment as string);
        }
        break;

      case 'highlightEntity':
        // Highlight a ZIP code
        if (action.payload.zipCode) {
          handleZIPClick(action.payload.zipCode as string);
        }
        break;

      case 'navigateTo':
        // Navigate to a different tab or page
        if (action.payload.tab) {
          setActiveTab(action.payload.tab as string);
        }
        break;
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Format number (whole numbers only, no rounding for display)
  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  // Format percentage
  const formatPercent = (num: number) => {
    return `${num.toFixed(1)}%`;
  };

  // CSV escaping helper
  const escapeCSV = (value: string | number | undefined): string => {
    if (value === undefined || value === null) return '';
    const str = String(value);
    // If contains comma, quote, or newline, wrap in quotes and escape internal quotes
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // CSV generation helpers
  // Wave 7/8: Memoized CSV generation functions for better performance
  const generateCSV = useCallback((zips: ZIPAggregate[]) => {
    const headers = [
      'ZIP',
      'City',
      'State',
      'Total Amount',
      'Donor Count',
      'Contributions',
      'Avg Gift',
      'Median Gift',
      'Max Single',
      'DEM Amount',
      'REP Amount',
      'Other Amount',
      'Prospect Score',
    ];

    const rows = zips.map((zip) => [
      escapeCSV(zip.zipCode),
      escapeCSV(zip.city),
      escapeCSV(zip.state),
      escapeCSV(zip.totalAmount),
      escapeCSV(zip.donorCount),
      escapeCSV(zip.contributionCount),
      escapeCSV(zip.avgContribution),
      escapeCSV(zip.medianContribution),
      escapeCSV(zip.maxSingleDonation),
      escapeCSV(zip.demAmount),
      escapeCSV(zip.repAmount),
      escapeCSV(zip.otherAmount),
      escapeCSV(zip.prospectScore),
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }, []);

  const generateDonorCSV = useCallback((profiles: DonorProfile[]) => {
    const headers = [
      'Donor ID',
      'ZIP',
      'City',
      'Total Contributed',
      'Contribution Count',
      'Avg Gift',
      'Last Gift Date',
      'Segment',
      'Party',
      'Recency Score',
      'Frequency Score',
      'Monetary Score',
    ];

    const rows = profiles.map((profile) => [
      escapeCSV(profile.donorId),
      escapeCSV(profile.zipCode),
      escapeCSV(profile.city),
      escapeCSV(profile.totalContributed),
      escapeCSV(profile.contributionCount),
      escapeCSV(profile.avgContribution),
      escapeCSV(profile.lastContributionDate),
      escapeCSV(profile.segment),
      escapeCSV(profile.likelyParty),
      escapeCSV(profile.recencyScore),
      escapeCSV(profile.frequencyScore),
      escapeCSV(profile.monetaryScore),
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }, []);

  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Get party badge color
  const getPartyBadgeVariant = (party: string): 'default' | 'secondary' | 'destructive' => {
    if (party === 'DEM') return 'default';
    if (party === 'REP') return 'destructive';
    return 'secondary';
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className={className}>
        <div className="space-y-6">
          <Skeleton className="h-12 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  // Note: Error display removed - now using toast notifications for consistent UX

  return (
    <div className={className + " relative"}>
      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="inline-flex h-10 items-center justify-start rounded-md bg-muted p-1 text-muted-foreground">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="lapsed" disabled={!lapsedData}>
            Lapsed Donors
            {lapsedData?.metadata?.totalLapsed && (
              <Badge variant="secondary" className="ml-2">
                {lapsedData.metadata.totalLapsed}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="upgrade" disabled={!upgradeData}>
            Upgrade Prospects
            {upgradeData?.metadata?.totalProspects && (
              <Badge variant="secondary" className="ml-2">
                {upgradeData.metadata.totalProspects}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="compare" disabled={Object.keys(candidatesData).length === 0}>
            Compare Candidates
          </TabsTrigger>
          <TabsTrigger value="ie" disabled={!ieData}>
            Outside Money
          </TabsTrigger>
        </TabsList>

        {/* Filters Bar - Available on All Tabs */}
        <Card className="mb-6 mt-6">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4 items-center justify-between">
              <div className="flex gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Election Cycle</label>
                  <Select
                    value={filters.cycle}
                    onValueChange={(value) => handleFilterChange('cycle', value)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="2024">2024</SelectItem>
                      <SelectItem value="2022">2022</SelectItem>
                      <SelectItem value="2020">2020</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Party</label>
                  <Select
                    value={filters.party}
                    onValueChange={(value) => handleFilterChange('party', value)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="DEM">Democratic</SelectItem>
                      <SelectItem value="REP">Republican</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">View</label>
                  <Select
                    value={filters.view}
                    onValueChange={(value) => handleFilterChange('view', value)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="table">Table</SelectItem>
                      <SelectItem value="heatmap">Heatmap</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2 items-center">
                {isFiltering && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Updating...</span>
                  </div>
                )}
                <Button
                  onClick={handleExportAllData}
                  variant="outline"
                  size="sm"
                  disabled={filteredZIPs.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Data
                </Button>
                <Button
                  onClick={handleFindProspects}
                  variant="default"
                  size="sm"
                  disabled={prospectZIPs.length === 0}
                  title="Find high-potential ZIP codes for donor acquisition based on demographics and current donor penetration"
                >
                  <Target className="h-4 w-4 mr-2" />
                  Find High-Potential ZIPs
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Overview Tab */}
        <TabsContent value="overview">

      {/* Cycle Filter Info Alert */}
      {filters.cycle !== 'all' && cycleTotals && (
        <Alert className="mb-6 border-blue-200 bg-blue-50">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-700">
            <strong>{filters.cycle} Cycle Summary:</strong> Stats cards above show totals for the {filters.cycle} election cycle.
            ZIP table shows all-time data (cycle-specific ZIP breakdown requires raw contribution data).
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Stats Cards */}
      {filteredSummaryStats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card className="rounded-lg shadow-md border-l-4 border-l-green-500 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Raised
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <div className="text-2xl font-bold">
                  {formatCurrency(filteredSummaryStats.totalRaised)}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-lg shadow-md border-l-4 border-l-blue-500 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Unique Donors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                <div className="text-2xl font-bold">
                  {filteredSummaryStats.uniqueDonors.toLocaleString()}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-lg shadow-md border-l-4 border-l-purple-500 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Contributions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-purple-600" />
                <div className="text-2xl font-bold">
                  {filteredSummaryStats.totalContributions.toLocaleString()}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-lg shadow-md border-l-4 border-l-orange-500 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Gift
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Gift className="h-4 w-4 text-orange-600" />
                <div className="text-2xl font-bold">
                  {formatCurrency(filteredSummaryStats.avgGift)}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-lg shadow-md border-l-4 border-l-amber-500 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Largest Gift
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(filteredSummaryStats.largestGift)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Party Split Bar */}
      {filteredSummaryStats && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm font-medium">
                <span>Party Split</span>
              </div>
              <div className="flex h-8 rounded overflow-hidden">
                <div
                  className="bg-blue-500 flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: `${filteredSummaryStats.demPercent}%` }}
                >
                  {filteredSummaryStats.demPercent > 10 && `DEM ${formatPercent(filteredSummaryStats.demPercent)}`}
                </div>
                <div
                  className="bg-red-500 flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: `${filteredSummaryStats.repPercent}%` }}
                >
                  {filteredSummaryStats.repPercent > 10 && `REP ${formatPercent(filteredSummaryStats.repPercent)}`}
                </div>
                <div
                  className="bg-gray-400 flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: `${filteredSummaryStats.otherPercent}%` }}
                >
                  {filteredSummaryStats.otherPercent > 5 && `Other ${formatPercent(filteredSummaryStats.otherPercent)}`}
                </div>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>DEM: {formatCurrency(filteredSummaryStats.demAmount)}</span>
                <span>REP: {formatCurrency(filteredSummaryStats.repAmount)}</span>
                <span>Other: {formatCurrency(filteredSummaryStats.otherAmount)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Time Series Analysis Section */}
      {timeSeriesData ? (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <LineChart className="h-5 w-5" />
                Contribution Trends & Forecasting
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTimeSeries(!showTimeSeries)}
              >
                {showTimeSeries ? 'Collapse' : 'Expand'}
              </Button>
            </div>
          </CardHeader>
          {showTimeSeries && (
            <CardContent>
              <DonorTimeSeriesAdapter data={timeSeriesData} />
            </CardContent>
          )}
          {!showTimeSeries && (
            <CardContent>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{timeSeriesData.monthlyTotals?.length || 0} months of data available</span>
                <span>Click expand to view trends, seasonal patterns, and forecasts</span>
              </div>
            </CardContent>
          )}
        </Card>
      ) : (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LineChart className="h-5 w-5" />
              Contribution Trends & Forecasting
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4 py-12">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <AlertCircle className="h-8 w-8 text-muted-foreground" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="font-medium text-foreground">Time series data not available</p>
                <p className="text-sm text-muted-foreground">
                  Trend analysis and forecasting requires time series data generation
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">What you can do instead:</p>
                <div className="flex flex-col sm:flex-row justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      fetchTimeSeriesData();
                    }}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Loading Again
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  >
                    View Summary Stats
                  </Button>
                </div>
                <div className="flex flex-col sm:flex-row justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleFindProspects()}
                  >
                    <Target className="h-4 w-4 mr-2" />
                    Find Prospects
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => CrossToolNavigator.navigateWithContext('political-ai', { metric: 'donor_concentration' })}
                  >
                    Explore Map
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top ZIP Codes - Table or Heatmap View */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {filters.view === 'heatmap'
                  ? 'Donor Concentration Heatmap'
                  : 'Top ZIP Codes'}
              </CardTitle>
              {filteredZIPs.length !== zipAggregates.length && (
                <Badge variant="secondary">
                  {filteredZIPs.length} of {zipAggregates.length}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {filters.view === 'table' ? (
              <>
                <div className="border rounded-lg relative">
                  {isFiltering && (
                    <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10 rounded-lg">
                      <Loader2 className="h-6 w-6 animate-spin text-green-600" />
                    </div>
                  )}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Rank</TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleSort('zipCode')}
                        >
                          <div className="flex items-center gap-1">
                            ZIP
                            {sortField === 'zipCode' ? (
                              sortDirection === 'asc' ? (
                                <ArrowUp className="h-3 w-3 text-green-600" />
                              ) : (
                                <ArrowDown className="h-3 w-3 text-green-600" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead>City</TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleSort('totalAmount')}
                        >
                          <div className="flex items-center gap-1">
                            Total
                            {sortField === 'totalAmount' ? (
                              sortDirection === 'asc' ? (
                                <ArrowUp className="h-3 w-3 text-green-600" />
                              ) : (
                                <ArrowDown className="h-3 w-3 text-green-600" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleSort('donorCount')}
                        >
                          <div className="flex items-center gap-1">
                            Donors
                            {sortField === 'donorCount' ? (
                              sortDirection === 'asc' ? (
                                <ArrowUp className="h-3 w-3 text-green-600" />
                              ) : (
                                <ArrowDown className="h-3 w-3 text-green-600" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleSort('avgContribution')}
                        >
                          <div className="flex items-center gap-1">
                            Avg Gift
                            {sortField === 'avgContribution' ? (
                              sortDirection === 'asc' ? (
                                <ArrowUp className="h-3 w-3 text-green-600" />
                              ) : (
                                <ArrowDown className="h-3 w-3 text-green-600" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedZIPs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="h-48 text-center">
                            <div className="space-y-4">
                              <div className="flex justify-center">
                                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                                  <AlertCircle className="h-6 w-6 text-muted-foreground" />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <p className="font-medium text-foreground">No donor data found for current filters</p>
                                <p className="text-sm text-muted-foreground">
                                  {filters.party !== 'all' && filters.cycle !== 'all'
                                    ? `No ${filters.party === 'DEM' ? 'Democratic' : 'Republican'} donors found in the ${filters.cycle} cycle`
                                    : filters.party !== 'all'
                                    ? `No ${filters.party === 'DEM' ? 'Democratic' : 'Republican'} donors found`
                                    : `No donors found in the ${filters.cycle} cycle`
                                  }
                                </p>
                              </div>
                              <div className="space-y-2">
                                <p className="text-sm font-medium text-foreground">Try these suggestions:</p>
                                <div className="flex flex-col sm:flex-row justify-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      handleFilterChange('party', 'all');
                                      handleFilterChange('cycle', 'all');
                                    }}
                                  >
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Clear All Filters
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleFilterChange('view', 'heatmap')}
                                  >
                                    Switch to Heatmap View
                                  </Button>
                                </div>
                                <div className="flex flex-col sm:flex-row justify-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => CrossToolNavigator.navigateWithContext('political-ai', {})}
                                  >
                                    Explore Map
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => CrossToolNavigator.navigateWithContext('segments', {})}
                                  >
                                    Analyze Voter Segments
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        sortedZIPs.slice(0, 10).map((zip, index) => (
                          <ZIPRow
                            key={zip.zipCode}
                            zip={zip}
                            index={index}
                            formatCurrency={formatCurrency}
                            formatNumber={formatNumber}
                            onClick={handleZIPClick}
                          />
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                {sortedZIPs.length > 10 && (
                  <div className="mt-4 text-center">
                    <Button variant="outline" size="sm">
                      View All {sortedZIPs.length} ZIPs
                    </Button>
                  </div>
                )}
              </>
            ) : (
              // Heatmap View
              <div className="space-y-4">
                {/* Color Legend */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Donation Amount:</span>
                  <div className="flex items-center gap-1">
                    <div
                      className="w-8 h-4 rounded"
                      style={{ backgroundColor: 'rgba(51, 168, 82, 0.2)' }}
                    />
                    <span className="text-muted-foreground">Low</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div
                      className="w-8 h-4 rounded"
                      style={{ backgroundColor: 'rgba(51, 168, 82, 0.6)' }}
                    />
                    <span className="text-muted-foreground">Medium</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div
                      className="w-8 h-4 rounded"
                      style={{ backgroundColor: 'rgba(51, 168, 82, 1)' }}
                    />
                    <span className="text-muted-foreground">High</span>
                  </div>
                </div>

                {/* Heatmap Grid */}
                <div className="relative">
                  {isFiltering && (
                    <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10 rounded-lg">
                      <Loader2 className="h-6 w-6 animate-spin text-green-600" />
                    </div>
                  )}
                  <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 max-h-96 overflow-y-auto p-2 border rounded-lg">
                    {(() => {
                      const maxAmount = Math.max(...sortedZIPs.map((z) => z.totalAmount));
                      return sortedZIPs.slice(0, 100).map((zip) => {
                        const intensity = maxAmount > 0 ? zip.totalAmount / maxAmount : 0;
                        const bgColor = `rgba(51, 168, 82, ${0.2 + intensity * 0.8})`;

                        return (
                          <div
                            key={zip.zipCode}
                            className="p-2 rounded cursor-pointer hover:ring-2 hover:ring-green-500 transition-all group relative"
                            style={{ backgroundColor: bgColor }}
                            onClick={() => handleZIPClick(zip.zipCode)}
                            title={`${zip.zipCode} - ${zip.city}: ${formatCurrency(zip.totalAmount)}`}
                          >
                            <div className="text-xs font-mono font-bold text-gray-800">
                              {zip.zipCode}
                            </div>
                            <div className="text-xs font-bold text-gray-900 truncate">
                              {formatCurrency(zip.totalAmount)}
                            </div>
                            <div className="text-xs text-gray-700 truncate">
                              {zip.donorCount} donors
                            </div>

                            {/* Tooltip on hover */}
                            <div className="hidden group-hover:block absolute z-20 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded shadow-lg whitespace-nowrap">
                              <div className="font-bold">{zip.zipCode} - {zip.city}</div>
                              <div>Total: {formatCurrency(zip.totalAmount)}</div>
                              <div>Donors: {formatNumber(zip.donorCount)}</div>
                              <div>Avg: {formatCurrency(zip.avgContribution)}</div>
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Heatmap Summary */}
                {sortedZIPs.length > 0 ? (
                  <div className="text-sm text-muted-foreground text-center space-y-1">
                    <p>Showing {Math.min(100, sortedZIPs.length)} of {sortedZIPs.length} ZIP codes
                    {sortedZIPs.length > 100 && ' (top 100 by donation amount)'}</p>
                    {(filters.party !== 'all' || filters.cycle !== 'all') && (
                      <p className="text-xs text-blue-600 font-medium">
                        Filtered results - totals reflect current filter selection
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center space-y-4 py-12">
                    <div className="flex justify-center">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                        <AlertCircle className="h-8 w-8 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="font-medium text-foreground">No donor data found for current filters</p>
                      <p className="text-sm text-muted-foreground">
                        {filters.party !== 'all' && filters.cycle !== 'all'
                          ? `No ${filters.party === 'DEM' ? 'Democratic' : 'Republican'} donors found in the ${filters.cycle} cycle`
                          : filters.party !== 'all'
                          ? `No ${filters.party === 'DEM' ? 'Democratic' : 'Republican'} donors found`
                          : `No donors found in the ${filters.cycle} cycle`
                        }
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">What you can do:</p>
                      <div className="flex flex-col sm:flex-row justify-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            handleFilterChange('party', 'all');
                            handleFilterChange('cycle', 'all');
                          }}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Clear All Filters
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleFilterChange('view', 'table')}
                        >
                          Switch to Table View
                        </Button>
                      </div>
                      <div className="flex flex-col sm:flex-row justify-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => CrossToolNavigator.navigateWithContext('political-ai', {})}
                        >
                          Explore Political Map
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => CrossToolNavigator.navigateWithContext('canvass', {})}
                        >
                          Plan Canvassing Routes
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* RFM Segments Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Donor Segments (RFM Analysis)</CardTitle>
              {rfmSegments.length > 0 && (
                <Badge variant="secondary">
                  {rfmSegments.reduce((sum, s) => sum + s.donorCount, 0).toLocaleString()} donors
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg relative">
              {isFiltering && (
                <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10 rounded-lg">
                  <Loader2 className="h-6 w-6 animate-spin text-green-600" />
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Segment</TableHead>
                    <TableHead className="text-right">Donors</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Avg Gift</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rfmSegments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-48 text-center">
                        <div className="space-y-4">
                          <div className="flex justify-center">
                            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                              <AlertCircle className="h-6 w-6 text-muted-foreground" />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <p className="font-medium text-foreground">No donor segments available</p>
                            <p className="text-sm text-muted-foreground">
                              RFM analysis requires donor profile data
                            </p>
                          </div>
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-foreground">What to try:</p>
                            <div className="flex flex-col sm:flex-row justify-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  fetchDonorData();
                                }}
                              >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Refresh Data
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setActiveTab('overview')}
                              >
                                View Overview
                              </Button>
                            </div>
                            <div className="flex flex-col sm:flex-row justify-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => CrossToolNavigator.navigateWithContext('segments', {})}
                              >
                                Analyze Voter Segments
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => CrossToolNavigator.navigateWithContext('political-ai', {})}
                              >
                                Explore Map
                              </Button>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    rfmSegments.map((segment) => (
                      <RFMSegmentRow
                        key={segment.segment}
                        segment={segment}
                        formatNumber={formatNumber}
                        formatCurrency={formatCurrency}
                        onExport={handleExportSegment}
                      />
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            {rfmSegments.length > 0 && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">
                  <strong>Strategy Recommendations:</strong> Click a segment row to view detailed
                  strategy and export donor list for targeted campaigns.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ZIP Detail Dialog */}
      <Dialog open={!!selectedZIP} onOpenChange={(open) => !open && setSelectedZIP(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              ZIP Code: {selectedZIP}
              {zipDetailData && ` - ${zipDetailData.city}`}
            </DialogTitle>
          </DialogHeader>

          {zipDetailData ? (
            <div className="space-y-6">
              {/* Contribution Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Contribution Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Total Raised</div>
                      <div className="text-2xl font-bold">
                        {formatCurrency(zipDetailData.aggregate.totalAmount)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Unique Donors</div>
                      <div className="text-2xl font-bold">
                        {formatNumber(zipDetailData.aggregate.donorCount)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Contributions</div>
                      <div className="text-xl font-bold">
                        {formatNumber(zipDetailData.aggregate.contributionCount)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Avg Contribution</div>
                      <div className="text-xl font-bold">
                        {formatCurrency(zipDetailData.aggregate.avgContribution)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Median Contribution</div>
                      <div className="text-xl font-bold">
                        {formatCurrency(zipDetailData.aggregate.medianContribution)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Largest Single</div>
                      <div className="text-xl font-bold">
                        {formatCurrency(zipDetailData.aggregate.maxSingleDonation)}
                      </div>
                    </div>
                  </div>

                  {/* Party Breakdown */}
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Party Breakdown</div>
                    <div className="flex gap-2">
                      <Badge variant="default">
                        DEM: {formatCurrency(zipDetailData.aggregate.demAmount)} (
                        {formatPercent(
                          (zipDetailData.aggregate.demAmount / zipDetailData.aggregate.totalAmount) *
                            100
                        )}
                        )
                      </Badge>
                      <Badge variant="destructive">
                        REP: {formatCurrency(zipDetailData.aggregate.repAmount)} (
                        {formatPercent(
                          (zipDetailData.aggregate.repAmount / zipDetailData.aggregate.totalAmount) *
                            100
                        )}
                        )
                      </Badge>
                      <Badge variant="secondary">
                        Other: {formatCurrency(zipDetailData.aggregate.otherAmount)} (
                        {formatPercent(
                          (zipDetailData.aggregate.otherAmount /
                            zipDetailData.aggregate.totalAmount) *
                            100
                        )}
                        )
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Top Occupations */}
              {zipDetailData.topOccupations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Top Occupations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {zipDetailData.topOccupations.slice(0, 5).map((occ) => (
                        <div key={occ.occupation} className="flex justify-between items-center">
                          <span className="text-sm">{occ.occupation}</span>
                          <div className="flex gap-4 text-sm">
                            <span className="text-muted-foreground">
                              {occ.donorCount} donors
                            </span>
                            <span className="font-medium">
                              {formatCurrency(occ.totalAmount)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Monthly Trend - uses time series data if available */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Monthly Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  {timeSeriesData && timeSeriesData.zipMonthly?.[selectedZIP || ''] ? (
                    <div className="h-32">
                      <div className="flex items-end gap-1 h-full">
                        {timeSeriesData.zipMonthly[selectedZIP || '']
                          .slice(-12)
                          .map((monthData: { month: string; total: number }, idx: number, arr: { total: number }[]) => {
                            const max = Math.max(...arr.map((m) => m.total));
                            const height = max > 0 ? (monthData.total / max) * 100 : 0;
                            return (
                              <div
                                key={monthData.month}
                                className="flex-1 bg-blue-500 rounded-t"
                                style={{ height: `${height}%` }}
                                title={`${monthData.month}: ${formatCurrency(monthData.total)}`}
                              />
                            );
                          })}
                      </div>
                      <p className="text-xs text-muted-foreground text-center mt-2">
                        Last 12 months contribution trend
                      </p>
                    </div>
                  ) : (
                    <div className="h-32 flex items-center justify-center text-muted-foreground">
                      <p className="text-sm">
                        {timeSeriesData
                          ? 'No trend data for this ZIP'
                          : 'Run time series generation for trends'}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              Loading ZIP details...
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Prospect Finder Dialog */}
      <Dialog open={showProspectFinder} onOpenChange={setShowProspectFinder}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-green-600" />
              High-Potential Prospect Areas
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Campaign ZIPs Summary */}
            {campaignZIPs.size > 0 && (
              <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-800">
                      {campaignZIPs.size} ZIP{campaignZIPs.size > 1 ? 's' : ''} added to campaign
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      {Array.from(campaignZIPs).join(', ')}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-green-700 border-green-300 hover:bg-green-100"
                    onClick={() => setCampaignZIPs(new Set())}
                  >
                    Clear All
                  </Button>
                </div>
              </div>
            )}

            {prospectZIPs.length > 0 ? (
              <>
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    These ZIP codes show high fundraising potential based on donor capacity estimates,
                    current donor penetration, and similarity to your best-performing areas.
                  </p>
                </div>

                {prospectZIPs.map((zip, i) => {
                  // Calculate penetration rate based on donor density
                  const estimatedPopulation = zip.donorCount * 50; // Rough estimate if not available
                  const penetrationRate = estimatedPopulation > 0
                    ? ((zip.donorCount / estimatedPopulation) * 100).toFixed(2)
                    : '0.00';

                  // Calculate score-based rating
                  const getRating = (score: number) => {
                    if (score >= 80) return { label: 'Excellent', color: 'text-green-700 bg-green-100' };
                    if (score >= 70) return { label: 'Very Good', color: 'text-green-600 bg-green-50' };
                    if (score >= 60) return { label: 'Good', color: 'text-blue-600 bg-blue-50' };
                    if (score >= 50) return { label: 'Moderate', color: 'text-yellow-600 bg-yellow-50' };
                    return { label: 'Low', color: 'text-gray-600 bg-gray-50' };
                  };

                  const rating = getRating(zip.prospectScore);

                  return (
                    <Card key={zip.zipCode} className="hover:border-green-600 transition-colors">
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0">
                            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                              <span className="text-xl font-bold text-green-600">#{i + 1}</span>
                            </div>
                          </div>

                          <div className="flex-1 space-y-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-lg font-semibold">{zip.zipCode}</h3>
                                <span className="text-muted-foreground">-</span>
                                <span className="text-muted-foreground">{zip.city}, {zip.state}</span>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="bg-green-50">
                                  Score: {zip.prospectScore}/100
                                </Badge>
                                <Badge variant="outline" className={rating.color}>
                                  {rating.label}
                                </Badge>
                                <Badge variant="secondary">
                                  {penetrationRate}% Penetration
                                </Badge>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <div className="text-xs text-muted-foreground">Current Donors</div>
                                <div className="text-lg font-semibold">{formatNumber(zip.donorCount)}</div>
                              </div>
                              <div>
                                <div className="text-xs text-muted-foreground">Total Raised</div>
                                <div className="text-lg font-semibold">{formatCurrency(zip.totalAmount)}</div>
                              </div>
                              <div>
                                <div className="text-xs text-muted-foreground">Avg Gift</div>
                                <div className="text-lg font-semibold">{formatCurrency(zip.avgContribution)}</div>
                              </div>
                            </div>

                            {/* Score Breakdown */}
                            <div className="bg-blue-50 p-3 rounded-md">
                              <div className="text-xs font-medium text-blue-800 mb-2">
                                Score Breakdown
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs text-blue-700">
                                <div className="flex justify-between">
                                  <span>Giving Capacity:</span>
                                  <span className="font-medium">{Math.round(zip.prospectScore * 0.4)}/40</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Political Alignment:</span>
                                  <span className="font-medium">{Math.round(zip.prospectScore * 0.3)}/30</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Donor Density:</span>
                                  <span className="font-medium">{Math.round(zip.prospectScore * 0.2)}/20</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Engagement:</span>
                                  <span className="font-medium">{Math.round(zip.prospectScore * 0.1)}/10</span>
                                </div>
                              </div>
                            </div>

                            <div className="bg-green-50 p-3 rounded-md">
                              <div className="text-xs font-medium text-green-800 mb-1">
                                Why This ZIP?
                              </div>
                              <div className="text-sm text-green-700">
                                {zip.prospectScore >= 80 && (
                                  <>Exceptional opportunity with high capacity, strong alignment, and low current penetration.</>
                                )}
                                {zip.prospectScore >= 70 && zip.prospectScore < 80 && (
                                  <>Strong prospect area with good demographics and significant untapped potential.</>
                                )}
                                {zip.prospectScore >= 60 && zip.prospectScore < 70 && (
                                  <>Good acquisition target with favorable indicators and room for growth.</>
                                )}
                                {zip.prospectScore >= 50 && zip.prospectScore < 60 && (
                                  <>Moderate potential area worth considering for targeted outreach.</>
                                )}
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  handleZIPClick(zip.zipCode);
                                  setShowProspectFinder(false);
                                }}
                              >
                                View Details
                              </Button>
                              <Button
                                size="sm"
                                variant={campaignZIPs.has(zip.zipCode) ? "default" : "outline"}
                                onClick={() => handleAddToCampaign(zip.zipCode)}
                              >
                                {campaignZIPs.has(zip.zipCode) ? '✓ Added' : 'Add to Campaign'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </>
            ) : (
              <div className="py-12 text-center space-y-4">
                <div className="flex justify-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <AlertCircle className="h-8 w-8 text-muted-foreground" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">No High-Potential Prospects Found</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Prospect scoring requires demographic enrichment data. The prospect finder identifies
                    ZIP codes with:
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1 max-w-md mx-auto text-left">
                    <li>• High median income areas</li>
                    <li>• Low current donor penetration</li>
                    <li>• Similar demographics to your best donor areas</li>
                  </ul>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto pt-2">
                    To enable this feature, enrich your donor data with demographic information
                    from Census data or commercial sources.
                  </p>
                </div>
                <Button onClick={() => setShowProspectFinder(false)} variant="outline">
                  Close
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
        </TabsContent>

        {/* Lapsed Donors Tab */}
        <TabsContent value="lapsed">
          {/* Filter indicator */}
          {filters.party !== 'all' && (
            <Alert className="mb-4 border-blue-200 bg-blue-50">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700">
                Filtering by <strong>{filters.party === 'DEM' ? 'Democratic' : 'Republican'}</strong> donors
              </AlertDescription>
            </Alert>
          )}
          {lapsedData ? (
            <LapsedDonorPanel data={lapsedData} partyFilter={filters.party} />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-4 py-12">
                  <div className="flex justify-center">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                      <AlertCircle className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="font-medium text-foreground">Lapsed donor data not available</p>
                    <p className="text-sm text-muted-foreground">
                      Run the lapsed donor analysis script to identify reactivation opportunities
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Explore other analysis:</p>
                    <div className="flex flex-col sm:flex-row justify-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveTab('overview')}
                      >
                        View Overview
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleFindProspects()}
                      >
                        <Target className="h-4 w-4 mr-2" />
                        Find Prospects
                      </Button>
                    </div>
                    <div className="flex flex-col sm:flex-row justify-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => CrossToolNavigator.navigateWithContext('segments', {})}
                      >
                        Analyze Voter Segments
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => CrossToolNavigator.navigateWithContext('political-ai', {})}
                      >
                        Explore Map
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Upgrade Prospects Tab */}
        <TabsContent value="upgrade">
          {/* Filter indicator - upgrade prospect data doesn't include party affiliation */}
          {filters.party !== 'all' && (
            <Alert className="mb-4 border-amber-200 bg-amber-50">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-700">
                Note: Party filter does not apply to upgrade prospects. This analysis shows all donors based on capacity potential.
              </AlertDescription>
            </Alert>
          )}
          {upgradeData ? (
            <UpgradeProspectPanel data={upgradeData} />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-4 py-12">
                  <div className="flex justify-center">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                      <AlertCircle className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="font-medium text-foreground">Upgrade prospect data not available</p>
                    <p className="text-sm text-muted-foreground">
                      Run the upgrade analysis script to identify major gift opportunities
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Meanwhile, explore:</p>
                    <div className="flex flex-col sm:flex-row justify-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveTab('overview')}
                      >
                        View Overview
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleFindProspects()}
                      >
                        <Target className="h-4 w-4 mr-2" />
                        Find High-Potential ZIPs
                      </Button>
                    </div>
                    <div className="flex flex-col sm:flex-row justify-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => CrossToolNavigator.navigateWithContext('canvass', {})}
                      >
                        Plan Canvassing
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => CrossToolNavigator.navigateWithContext('political-ai', {})}
                      >
                        Explore Map
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Candidate Comparison Tab */}
        <TabsContent value="compare">
          {/* Filter indicator */}
          {filters.party !== 'all' && (
            <Alert className="mb-4 border-blue-200 bg-blue-50">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700">
                Showing only <strong>{filters.party === 'DEM' ? 'Democratic' : 'Republican'}</strong> candidates
              </AlertDescription>
            </Alert>
          )}
          {Object.keys(candidatesData).length > 0 ? (
            <ComparisonView candidates={candidatesData} partyFilter={filters.party} />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-4 py-12">
                  <div className="flex justify-center">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                      <AlertCircle className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="font-medium text-foreground">Candidate comparison data not available</p>
                    <p className="text-sm text-muted-foreground">
                      Candidate fundraising data is required for comparison analysis
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Try other tools:</p>
                    <div className="flex flex-col sm:flex-row justify-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveTab('overview')}
                      >
                        View Overview
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveTab('ie')}
                      >
                        Outside Money
                      </Button>
                    </div>
                    <div className="flex flex-col sm:flex-row justify-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => CrossToolNavigator.navigateWithContext('compare', {})}
                      >
                        Compare Precincts
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => CrossToolNavigator.navigateWithContext('political-ai', {})}
                      >
                        Explore Map
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Independent Expenditures Tab */}
        <TabsContent value="ie">
          {/* Filter indicator - IE data is pre-aggregated by race */}
          {(filters.party !== 'all' || filters.cycle !== 'all') && (
            <Alert className="mb-4 border-amber-200 bg-amber-50">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-700">
                Overview filters don&apos;t apply here. Outside money shows all races. Use the race selector below.
              </AlertDescription>
            </Alert>
          )}
          {ieData ? (
            <IESpendingPanel data={ieData} />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-4 py-12">
                  <div className="flex justify-center">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                      <AlertCircle className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="font-medium text-foreground">Independent expenditure data not available</p>
                    <p className="text-sm text-muted-foreground">
                      Outside money analysis requires independent expenditure data from FEC
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Explore other options:</p>
                    <div className="flex flex-col sm:flex-row justify-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveTab('overview')}
                      >
                        View Overview
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveTab('compare')}
                      >
                        Compare Candidates
                      </Button>
                    </div>
                    <div className="flex flex-col sm:flex-row justify-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleFindProspects()}
                      >
                        <Target className="h-4 w-4 mr-2" />
                        Find Prospects
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => CrossToolNavigator.navigateWithContext('political-ai', {})}
                      >
                        Explore Map
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* NOTE: AI Assistant removed - UnifiedAIAssistant is rendered at page level (app/donors/page.tsx) */}
    </div>
  );
}
