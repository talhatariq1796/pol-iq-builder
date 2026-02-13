'use client';

/**
 * Upgrade Prospect Panel
 *
 * Features:
 * - Summary: total prospects, current giving, upgrade gap
 * - Capacity tier breakdown (high/medium/low)
 * - Top 20 prospects table with recommended ask
 * - ZIP summary with upgrade potential
 * - "Export Call Sheet" button
 * - Filter by capacity tier, ZIP, min score
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
  Users,
  TrendingUp,
  DollarSign,
  Target,
  AlertCircle,
  Award,
} from 'lucide-react';

import type {
  UpgradeProspectData,
  UpgradeProspect,
} from '@/lib/donor/types';

interface UpgradeProspectPanelProps {
  data: UpgradeProspectData;
  onProspectSelect?: (prospect: UpgradeProspect) => void;
  onExport?: (prospects: UpgradeProspect[]) => void;
  className?: string;
}

type SortField = 'upgradeScore' | 'upgradeGap' | 'currentTotalGiven' | 'estimatedCapacity' | 'recommendedAsk';
type SortDirection = 'asc' | 'desc';

export function UpgradeProspectPanel({
  data,
  onProspectSelect,
  onExport,
  className,
}: UpgradeProspectPanelProps) {
  const [sortField, setSortField] = useState<SortField>('upgradeScore');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [tierFilter, setTierFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [minScore, setMinScore] = useState<number>(0);

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

  // Format percentage
  const formatPercent = (num: number) => {
    return `${(num * 100).toFixed(0)}%`;
  };

  // Calculate tier breakdown
  const tierBreakdown = useMemo(() => {
    const breakdown = {
      high: { count: 0, currentGiving: 0, upgradeGap: 0 },
      medium: { count: 0, currentGiving: 0, upgradeGap: 0 },
      low: { count: 0, currentGiving: 0, upgradeGap: 0 },
    };

    data.prospects.forEach((prospect) => {
      breakdown[prospect.capacityTier].count++;
      breakdown[prospect.capacityTier].currentGiving += prospect.currentTotalGiven;
      breakdown[prospect.capacityTier].upgradeGap += prospect.upgradeGap;
    });

    return breakdown;
  }, [data.prospects]);

  // Calculate ZIP summary
  const zipSummary = useMemo(() => {
    const zipMap = new Map<string, {
      city: string;
      prospectCount: number;
      upgradeGap: number;
    }>();

    data.prospects.forEach((prospect) => {
      const existing = zipMap.get(prospect.zipCode);
      if (existing) {
        existing.prospectCount++;
        existing.upgradeGap += prospect.upgradeGap;
      } else {
        zipMap.set(prospect.zipCode, {
          city: prospect.city,
          prospectCount: 1,
          upgradeGap: prospect.upgradeGap,
        });
      }
    });

    return Array.from(zipMap.entries())
      .map(([zipCode, data]) => ({ zipCode, ...data }))
      .sort((a, b) => b.upgradeGap - a.upgradeGap)
      .slice(0, 10);
  }, [data.prospects]);

  // Filter prospects
  const filteredProspects = useMemo(() => {
    let filtered = data.prospects;

    if (tierFilter !== 'all') {
      filtered = filtered.filter((p) => p.capacityTier === tierFilter);
    }

    if (minScore > 0) {
      filtered = filtered.filter((p) => p.upgradeScore >= minScore);
    }

    return filtered;
  }, [data.prospects, tierFilter, minScore]);

  // Sort prospects
  const sortedProspects = useMemo(() => {
    const sorted = [...filteredProspects];

    sorted.sort((a, b) => {
      let aVal = 0;
      let bVal = 0;

      switch (sortField) {
        case 'upgradeScore':
          aVal = a.upgradeScore;
          bVal = b.upgradeScore;
          break;
        case 'upgradeGap':
          aVal = a.upgradeGap;
          bVal = b.upgradeGap;
          break;
        case 'currentTotalGiven':
          aVal = a.currentTotalGiven;
          bVal = b.currentTotalGiven;
          break;
        case 'estimatedCapacity':
          aVal = a.estimatedCapacity;
          bVal = b.estimatedCapacity;
          break;
        case 'recommendedAsk':
          aVal = a.recommendedAsk;
          bVal = b.recommendedAsk;
          break;
      }

      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return sorted;
  }, [filteredProspects, sortField, sortDirection]);

  // Handlers
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleExportCallSheet = () => {
    const csv = generateCallSheetCSV(sortedProspects.slice(0, 100));
    downloadCSV(csv, 'upgrade-call-sheet.csv');
  };

  const handleExportAll = () => {
    const csv = generateFullCSV(sortedProspects);
    downloadCSV(csv, 'upgrade-prospects.csv');
  };

  const generateCallSheetCSV = (prospects: UpgradeProspect[]) => {
    const headers = [
      'Donor ID',
      'ZIP',
      'City',
      'Current Total',
      'Recommended Ask',
      'Upgrade Gap',
      'Score',
      'Phone',
      'Notes',
    ];

    const rows = prospects.map((p) => [
      p.donorId,
      p.zipCode,
      p.city,
      p.currentTotalGiven,
      p.recommendedAsk,
      p.upgradeGap,
      p.upgradeScore,
      '', // Phone placeholder
      `${p.giftCount} gifts, ${formatPercent(p.currentUtilization)} capacity`,
    ]);

    return [headers, ...rows].map((row) => row.join(',')).join('\n');
  };

  const generateFullCSV = (prospects: UpgradeProspect[]) => {
    const headers = [
      'Donor ID',
      'ZIP',
      'City',
      'Current Total',
      'Current Avg',
      'Last Gift',
      'Gift Count',
      'Estimated Capacity',
      'Capacity Tier',
      'Upgrade Gap',
      'Upgrade Score',
      'Recommended Ask',
      'Channel',
    ];

    const rows = prospects.map((p) => [
      p.donorId,
      p.zipCode,
      p.city,
      p.currentTotalGiven,
      p.currentAvgGift,
      p.lastGiftAmount,
      p.giftCount,
      p.estimatedCapacity,
      p.capacityTier,
      p.upgradeGap,
      p.upgradeScore,
      p.recommendedAsk,
      p.recommendedChannel,
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

  const getTierBadgeVariant = (tier: string): 'default' | 'secondary' | 'destructive' => {
    if (tier === 'high') return 'destructive';
    if (tier === 'medium') return 'default';
    return 'secondary';
  };

  return (
    <div className={className}>
      {/* Summary Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="rounded-lg shadow-md border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Prospects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              <div className="text-2xl font-bold">
                {formatNumber(data.metadata.totalProspects)}
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Out of {formatNumber(data.metadata.totalDonors)} total donors
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg shadow-md border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Current Giving
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <div className="text-2xl font-bold">
                {formatCurrency(data.metadata.totalCurrentGiving)}
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              From upgrade prospects
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg shadow-md border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Upgrade Gap
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-600" />
              <div className="text-2xl font-bold">
                {formatCurrency(data.metadata.totalUpgradeGap)}
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Additional capacity identified
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg shadow-md border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-orange-600" />
              <div className="text-2xl font-bold">
                {data.metadata.avgUpgradeScore}
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Out of 100
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Capacity Tier Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Capacity Tier Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(['high', 'medium', 'low'] as const).map((tier) => (
                <div key={tier} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={getTierBadgeVariant(tier)}>
                        {tier.toUpperCase()}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {tierBreakdown[tier].count} prospects
                      </span>
                    </div>
                    <span className="text-sm font-medium">
                      {formatCurrency(tierBreakdown[tier].upgradeGap)} gap
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded overflow-hidden">
                    <div
                      className={`h-full ${
                        tier === 'high'
                          ? 'bg-red-500'
                          : tier === 'medium'
                          ? 'bg-blue-500'
                          : 'bg-gray-400'
                      }`}
                      style={{
                        width: `${
                          (tierBreakdown[tier].count / data.metadata.totalProspects) * 100
                        }%`,
                      }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Current: {formatCurrency(tierBreakdown[tier].currentGiving)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top ZIPs by Upgrade Potential */}
        <Card>
          <CardHeader>
            <CardTitle>Top ZIPs by Upgrade Potential</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {zipSummary.map((zip, idx) => (
                <div
                  key={zip.zipCode}
                  className="flex items-center justify-between p-2 rounded hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
                      {idx + 1}
                    </div>
                    <div>
                      <div className="font-mono text-sm font-medium">{zip.zipCode}</div>
                      <div className="text-xs text-muted-foreground">{zip.city}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {formatCurrency(zip.upgradeGap)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {zip.prospectCount} prospects
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Prospects Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Top Upgrade Prospects</CardTitle>
            <div className="flex gap-2 items-center">
              <Select value={tierFilter} onValueChange={(v) => setTierFilter(v as any)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Select value={minScore.toString()} onValueChange={(v) => setMinScore(Number(v))}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Min Score" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">All Scores</SelectItem>
                  <SelectItem value="50">50+</SelectItem>
                  <SelectItem value="60">60+</SelectItem>
                  <SelectItem value="70">70+</SelectItem>
                  <SelectItem value="80">80+</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={handleExportCallSheet}
                variant="outline"
                size="sm"
                disabled={sortedProspects.length === 0}
              >
                <Phone className="h-4 w-4 mr-2" />
                Call Sheet
              </Button>
              <Button
                onClick={handleExportAll}
                variant="outline"
                size="sm"
                disabled={sortedProspects.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Rank</TableHead>
                  <TableHead>ZIP</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('upgradeScore')}
                  >
                    <div className="flex items-center gap-1">
                      Score
                      {sortField === 'upgradeScore' ? (
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
                    onClick={() => handleSort('currentTotalGiven')}
                  >
                    <div className="flex items-center gap-1">
                      Current
                      {sortField === 'currentTotalGiven' ? (
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
                    onClick={() => handleSort('upgradeGap')}
                  >
                    <div className="flex items-center gap-1">
                      Gap
                      {sortField === 'upgradeGap' ? (
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
                    onClick={() => handleSort('recommendedAsk')}
                  >
                    <div className="flex items-center gap-1">
                      Ask
                      {sortField === 'recommendedAsk' ? (
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
                  <TableHead>Tier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedProspects.slice(0, 20).map((prospect, idx) => (
                  <TableRow
                    key={prospect.donorId}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onProspectSelect && onProspectSelect(prospect)}
                  >
                    <TableCell className="font-medium">{idx + 1}</TableCell>
                    <TableCell className="font-mono">{prospect.zipCode}</TableCell>
                    <TableCell>{prospect.city}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{prospect.upgradeScore}</Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(prospect.currentTotalGiven)}</TableCell>
                    <TableCell className="text-purple-600 font-medium">
                      {formatCurrency(prospect.upgradeGap)}
                    </TableCell>
                    <TableCell className="text-green-600 font-medium">
                      {formatCurrency(prospect.recommendedAsk)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getTierBadgeVariant(prospect.capacityTier)}>
                        {prospect.capacityTier}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {sortedProspects.length > 20 && (
            <div className="mt-4 text-center text-sm text-muted-foreground">
              Showing top 20 of {sortedProspects.length} prospects. Export to see all.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Recommendations */}
      <Alert className="mt-6">
        <Award className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-2">
            <p className="font-medium">Upgrade Strategy Recommendations</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>
                <strong>High Capacity ({tierBreakdown.high.count}):</strong> Personal solicitation
                by senior staff or board, major gift proposals
              </li>
              <li>
                <strong>Medium Capacity ({tierBreakdown.medium.count}):</strong> Upgrade campaigns
                via phone and email, mid-level events
              </li>
              <li>
                <strong>Low Capacity ({tierBreakdown.low.count}):</strong> Monthly giving programs,
                automated upgrade sequences
              </li>
            </ul>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
