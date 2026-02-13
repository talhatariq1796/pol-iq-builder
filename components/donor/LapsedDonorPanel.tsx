'use client';

/**
 * Lapsed Donor Recovery Panel
 *
 * Features:
 * - Summary stats: total lapsed, historical value, recovery potential
 * - Priority breakdown: high/medium/low tiers
 * - Cluster list with action buttons
 * - Donor table (sortable by score, value, recency)
 * - "Create Canvassing Turf" button for clusters
 * - Channel breakdown chart
 */

import React, { useState, useMemo } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Phone,
  Mail,
  DoorOpen,
  Globe,
  TrendingUp,
  Users,
  DollarSign,
  AlertCircle,
  MapPin,
} from 'lucide-react';

import type {
  LapsedDonorData,
  LapsedDonor,
  DonorCluster,
} from '@/lib/donor/types';

interface LapsedDonorPanelProps {
  data: LapsedDonorData;
  partyFilter?: 'all' | 'DEM' | 'REP';
  onDonorSelect?: (donor: LapsedDonor) => void;
  onClusterSelect?: (cluster: DonorCluster) => void;
  onCreateTurf?: (cluster: DonorCluster) => void;
  className?: string;
}

type SortField = 'recoveryScore' | 'totalHistoricalAmount' | 'monthsSinceLastGift' | 'estimatedRecoveryAmount';
type SortDirection = 'asc' | 'desc';

export function LapsedDonorPanel({
  data,
  partyFilter = 'all',
  onDonorSelect,
  onClusterSelect,
  onCreateTurf,
  className,
}: LapsedDonorPanelProps) {
  const [sortField, setSortField] = useState<SortField>('recoveryScore');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  // Apply party filter first to get the working dataset
  const partyFilteredDonors = useMemo(() => {
    if (partyFilter === 'all') {
      return data.donors;
    }
    return data.donors.filter((d) => d.likelyParty === partyFilter);
  }, [data.donors, partyFilter]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Format number
  const formatNumber = (num: number) => {
    return Math.round(num).toLocaleString();
  };

  // Calculate filtered totals for display
  const filteredTotals = useMemo(() => {
    return {
      totalLapsed: partyFilteredDonors.length,
      totalHistoricalValue: partyFilteredDonors.reduce((sum, d) => sum + d.totalHistoricalAmount, 0),
      estimatedRecoveryValue: partyFilteredDonors.reduce((sum, d) => sum + d.estimatedRecoveryAmount, 0),
      avgRecoveryScore: partyFilteredDonors.length > 0
        ? partyFilteredDonors.reduce((sum, d) => sum + d.recoveryScore, 0) / partyFilteredDonors.length
        : 0,
      avgMonthsSinceLapse: partyFilteredDonors.length > 0
        ? partyFilteredDonors.reduce((sum, d) => sum + d.monthsSinceLastGift, 0) / partyFilteredDonors.length
        : 0,
    };
  }, [partyFilteredDonors]);

  // Calculate priority breakdown
  const priorityBreakdown = useMemo(() => {
    const breakdown = {
      high: { count: 0, value: 0, recovery: 0 },
      medium: { count: 0, value: 0, recovery: 0 },
      low: { count: 0, value: 0, recovery: 0 },
    };

    partyFilteredDonors.forEach((donor) => {
      breakdown[donor.priority].count++;
      breakdown[donor.priority].value += donor.totalHistoricalAmount;
      breakdown[donor.priority].recovery += donor.estimatedRecoveryAmount;
    });

    return breakdown;
  }, [partyFilteredDonors]);

  // Calculate channel breakdown
  const channelBreakdown = useMemo(() => {
    const breakdown = {
      phone: 0,
      mail: 0,
      door: 0,
      digital: 0,
    };

    partyFilteredDonors.forEach((donor) => {
      breakdown[donor.recommendedChannel]++;
    });

    return breakdown;
  }, [partyFilteredDonors]);

  // Filter donors by priority (using already party-filtered donors)
  const filteredDonors = useMemo(() => {
    if (priorityFilter === 'all') {
      return partyFilteredDonors;
    }
    return partyFilteredDonors.filter((d) => d.priority === priorityFilter);
  }, [partyFilteredDonors, priorityFilter]);

  // Sort donors
  const sortedDonors = useMemo(() => {
    const sorted = [...filteredDonors];

    sorted.sort((a, b) => {
      let aVal = 0;
      let bVal = 0;

      switch (sortField) {
        case 'recoveryScore':
          aVal = a.recoveryScore;
          bVal = b.recoveryScore;
          break;
        case 'totalHistoricalAmount':
          aVal = a.totalHistoricalAmount;
          bVal = b.totalHistoricalAmount;
          break;
        case 'monthsSinceLastGift':
          aVal = a.monthsSinceLastGift;
          bVal = b.monthsSinceLastGift;
          break;
        case 'estimatedRecoveryAmount':
          aVal = a.estimatedRecoveryAmount;
          bVal = b.estimatedRecoveryAmount;
          break;
      }

      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return sorted;
  }, [filteredDonors, sortField, sortDirection]);

  // Handlers
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleExport = () => {
    const csv = generateCSV(sortedDonors);
    downloadCSV(csv, 'lapsed-donors.csv');
  };

  const generateCSV = (donors: LapsedDonor[]) => {
    const headers = [
      'Donor ID',
      'ZIP',
      'City',
      'Last Gift Date',
      'Last Gift Amount',
      'Historical Total',
      'Gift Count',
      'Avg Gift',
      'Party',
      'Months Since Last',
      'Recovery Score',
      'Est. Recovery Amount',
      'Channel',
      'Priority',
    ];

    const rows = donors.map((donor) => [
      donor.donorId,
      donor.zipCode,
      donor.city,
      donor.lastGiftDate,
      donor.lastGiftAmount,
      donor.totalHistoricalAmount,
      donor.giftCount,
      donor.avgGift,
      donor.likelyParty,
      donor.monthsSinceLastGift,
      donor.recoveryScore,
      donor.estimatedRecoveryAmount,
      donor.recommendedChannel,
      donor.priority,
    ]);

    return [headers, ...rows].map((row) => row.join(',')).join('\n');
  };

  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'phone':
        return <Phone className="h-3 w-3" />;
      case 'mail':
        return <Mail className="h-3 w-3" />;
      case 'door':
        return <DoorOpen className="h-3 w-3" />;
      case 'digital':
        return <Globe className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getPriorityBadgeVariant = (priority: string): 'default' | 'secondary' | 'destructive' => {
    if (priority === 'high') return 'destructive';
    if (priority === 'medium') return 'default';
    return 'secondary';
  };

  return (
    <div className={className}>
      {/* Summary Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="rounded-lg shadow-md border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Lapsed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-red-600" />
              <div className="text-2xl font-bold">
                {formatNumber(filteredTotals.totalLapsed)}
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Avg {filteredTotals.avgMonthsSinceLapse.toFixed(1)} months since last gift
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg shadow-md border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Historical Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-blue-600" />
              <div className="text-2xl font-bold">
                {formatCurrency(filteredTotals.totalHistoricalValue)}
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Lifetime value of lapsed donors
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg shadow-md border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recovery Potential
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <div className="text-2xl font-bold">
                {formatCurrency(filteredTotals.estimatedRecoveryValue)}
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Expected recovery value
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg shadow-md border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Recovery Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-purple-600" />
              <div className="text-2xl font-bold">
                {filteredTotals.avgRecoveryScore.toFixed(0)}
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Out of 100
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Priority Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Priority Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(['high', 'medium', 'low'] as const).map((priority) => (
                <div key={priority} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={getPriorityBadgeVariant(priority)}>
                        {priority.toUpperCase()}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {priorityBreakdown[priority].count} donors
                      </span>
                    </div>
                    <span className="text-sm font-medium">
                      {formatCurrency(priorityBreakdown[priority].value)}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded overflow-hidden">
                    <div
                      className={`h-full ${
                        priority === 'high'
                          ? 'bg-red-500'
                          : priority === 'medium'
                          ? 'bg-blue-500'
                          : 'bg-gray-400'
                      }`}
                      style={{
                        width: `${
                          filteredTotals.totalLapsed > 0
                            ? (priorityBreakdown[priority].count / filteredTotals.totalLapsed) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Est. Recovery: {formatCurrency(priorityBreakdown[priority].recovery)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Channel Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Recommended Channels</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(channelBreakdown).map(([channel, count]) => (
                <div key={channel} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getChannelIcon(channel)}
                      <span className="text-sm font-medium capitalize">{channel}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {count} donors ({filteredTotals.totalLapsed > 0 ? ((count / filteredTotals.totalLapsed) * 100).toFixed(1) : 0}%)
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{
                        width: `${filteredTotals.totalLapsed > 0 ? (count / filteredTotals.totalLapsed) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Donor Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lapsed Donors</CardTitle>
            <div className="flex gap-2 items-center">
              <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as any)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={handleExport}
                variant="outline"
                size="sm"
                disabled={sortedDonors.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ZIP</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('recoveryScore')}
                  >
                    <div className="flex items-center gap-1">
                      Score
                      {sortField === 'recoveryScore' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('totalHistoricalAmount')}
                  >
                    <div className="flex items-center gap-1">
                      Historical
                      {sortField === 'totalHistoricalAmount' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('monthsSinceLastGift')}
                  >
                    <div className="flex items-center gap-1">
                      Lapsed
                      {sortField === 'monthsSinceLastGift' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('estimatedRecoveryAmount')}
                  >
                    <div className="flex items-center gap-1">
                      Est. Recovery
                      {sortField === 'estimatedRecoveryAmount' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Priority</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedDonors.slice(0, 50).map((donor) => (
                  <TableRow
                    key={donor.donorId}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onDonorSelect && onDonorSelect(donor)}
                  >
                    <TableCell className="font-mono">{donor.zipCode}</TableCell>
                    <TableCell>{donor.city}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{donor.recoveryScore}</Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(donor.totalHistoricalAmount)}</TableCell>
                    <TableCell>{donor.monthsSinceLastGift}m</TableCell>
                    <TableCell>{formatCurrency(donor.estimatedRecoveryAmount)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {getChannelIcon(donor.recommendedChannel)}
                        <span className="text-xs capitalize">{donor.recommendedChannel}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getPriorityBadgeVariant(donor.priority)}>
                        {donor.priority}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {sortedDonors.length > 50 && (
            <div className="mt-4 text-center text-sm text-muted-foreground">
              Showing 50 of {sortedDonors.length} donors. Export to see all.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Recommendations */}
      <Alert className="mt-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-2">
            <p className="font-medium">Recovery Strategy Recommendations</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>
                <strong>High Priority ({priorityBreakdown.high.count}):</strong> Personal outreach
                (phone calls, handwritten notes) within 2 weeks
              </li>
              <li>
                <strong>Medium Priority ({priorityBreakdown.medium.count}):</strong> Email
                campaign with special win-back offer
              </li>
              <li>
                <strong>Low Priority ({priorityBreakdown.low.count}):</strong> Include in general
                re-activation mailings
              </li>
            </ul>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
