'use client';

/**
 * Candidate Comparison View
 *
 * Features:
 * - Side-by-side candidate comparison cards
 * - Metrics: total raised, donors, avg gift, grassroots %
 * - Bar charts comparing key metrics
 * - Geographic comparison (who leads where)
 * - Outside money section (IE support/oppose)
 * - "Total Investment" calculation
 */

import React, { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
  TrendingUp,
  Users,
  DollarSign,
  Building2,
  AlertCircle,
  ArrowRight,
  Award,
} from 'lucide-react';

import type { Candidate } from '@/lib/donor/types';

interface ComparisonViewProps {
  candidates: Record<string, Candidate>;
  partyFilter?: 'all' | 'DEM' | 'REP';
  onCandidateSelect?: (candidateId: string) => void;
  className?: string;
}

// Clean up candidate name (remove "FOR CONGRESS", "FOR SENATE", etc.)
const cleanCandidateName = (name: string): string => {
  return name
    .replace(/\s+FOR\s+(CONGRESS|SENATE|HOUSE|REPRESENTATIVE|PRESIDENT)\s*/gi, ' ')
    .replace(/\s+COMMITTEE\s*/gi, ' ')
    .replace(/\s+CAMPAIGN\s*/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

// Check if name looks like a business/LLC (not a candidate)
const isBusinessEntity = (name: string): boolean => {
  const businessPatterns = /\b(LLC|INC|CORP|CORPORATION|COMPANY|CO\.|LLP|LP|HOLDINGS|ENTERPRISES|GROUP|ASSOCIATION)\b/i;
  return businessPatterns.test(name);
};

export function ComparisonView({
  candidates,
  partyFilter = 'all',
  onCandidateSelect,
  className,
}: ComparisonViewProps) {
  // Filter out business entities, apply party filter, and clean names
  const candidateList = useMemo(() =>
    Object.values(candidates)
      .filter(c => !isBusinessEntity(c.name))
      .filter(c => partyFilter === 'all' || c.party === partyFilter)
      .map(c => ({ ...c, displayName: cleanCandidateName(c.name) }))
      .sort((a, b) => b.totalRaised - a.totalRaised),
    [candidates, partyFilter]
  );
  const [candidate1Id, setCandidate1Id] = useState<string>('');
  const [candidate2Id, setCandidate2Id] = useState<string>('');

  const candidate1 = candidate1Id ? candidates[candidate1Id] : null;
  const candidate2 = candidate2Id ? candidates[candidate2Id] : null;

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

  // Calculate comparison metrics
  const comparisonMetrics = useMemo(() => {
    if (!candidate1 || !candidate2) return null;

    const raisedDiff = candidate1.totalRaised - candidate2.totalRaised;
    const raisedPct = candidate2.totalRaised > 0
      ? (raisedDiff / candidate2.totalRaised) * 100
      : 0;

    const donorDiff = candidate1.committeeDonorCount - candidate2.committeeDonorCount;

    const avgGift1 = candidate1.committeeDonorCount > 0
      ? candidate1.totalRaised / candidate1.committeeDonorCount
      : 0;
    const avgGift2 = candidate2.committeeDonorCount > 0
      ? candidate2.totalRaised / candidate2.committeeDonorCount
      : 0;
    const avgGiftDiff = avgGift1 - avgGift2;

    const ieSupportDiff = candidate1.ieSupport - candidate2.ieSupport;
    const totalInvestmentDiff = candidate1.totalInvestment - candidate2.totalInvestment;

    return {
      raisedDiff,
      raisedPct,
      donorDiff,
      avgGiftDiff,
      ieSupportDiff,
      totalInvestmentDiff,
    };
  }, [candidate1, candidate2]);

  const getPartyColor = (party: string) => {
    if (party === 'DEM') return 'bg-blue-500';
    if (party === 'REP') return 'bg-red-500';
    return 'bg-gray-500';
  };

  const getPartyBadgeVariant = (party: string): 'default' | 'secondary' | 'destructive' => {
    if (party === 'DEM') return 'default';
    if (party === 'REP') return 'destructive';
    return 'secondary';
  };

  const renderCandidateCard = (candidate: Candidate | null, position: 'left' | 'right') => {
    if (!candidate) {
      return (
        <Card className="h-full">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Users className="h-12 w-12 mb-4" />
              <p>Select a candidate to compare</p>
            </div>
          </CardContent>
        </Card>
      );
    }

    const avgGift = candidate.committeeDonorCount > 0
      ? candidate.totalRaised / candidate.committeeDonorCount
      : 0;

    const grassrootsPct = candidate.totalRaised > 0
      ? (candidate.individualContributions / candidate.totalRaised) * 100
      : 0;

    return (
      <Card className="h-full">
        <CardHeader className={`pb-4 ${getPartyColor(candidate.party)} text-white`}>
          <div className="flex items-center justify-between">
            <Badge variant={getPartyBadgeVariant(candidate.party)} className="mb-2">
              {candidate.party}
            </Badge>
            <Badge variant="outline" className="bg-white/20 text-white border-white/40">
              {candidate.office}-{candidate.state}-{candidate.district}
            </Badge>
          </div>
          <CardTitle className="text-xl">{candidate.name}</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {/* Total Raised */}
          <div>
            <div className="text-sm text-muted-foreground mb-1">Total Raised</div>
            <div className="text-3xl font-bold">{formatCurrency(candidate.totalRaised)}</div>
          </div>

          {/* Donor Count */}
          <div>
            <div className="text-sm text-muted-foreground mb-1">Committee Donors</div>
            <div className="text-2xl font-bold">{formatNumber(candidate.committeeDonorCount)}</div>
          </div>

          {/* Average Gift */}
          <div>
            <div className="text-sm text-muted-foreground mb-1">Average Gift</div>
            <div className="text-2xl font-bold">{formatCurrency(avgGift)}</div>
          </div>

          {/* Grassroots Percentage */}
          <div>
            <div className="text-sm text-muted-foreground mb-2">Grassroots %</div>
            <div className="h-2 bg-muted rounded overflow-hidden">
              <div
                className="h-full bg-green-500"
                style={{ width: `${grassrootsPct}%` }}
              />
            </div>
            <div className="text-sm font-medium mt-1">{grassrootsPct.toFixed(1)}%</div>
          </div>

          {/* IE Support/Oppose */}
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Independent Expenditures</div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-green-600">Support:</span>
                <span className="font-medium">{formatCurrency(candidate.ieSupport)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-red-600">Oppose:</span>
                <span className="font-medium">{formatCurrency(candidate.ieOppose)}</span>
              </div>
              <div className="flex justify-between text-sm border-t pt-1">
                <span className="font-medium">Net IE:</span>
                <span className={`font-bold ${candidate.netIE >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(candidate.netIE)}
                </span>
              </div>
            </div>
          </div>

          {/* Total Investment */}
          <div className="pt-4 border-t">
            <div className="text-sm text-muted-foreground mb-1">Total Investment</div>
            <div className="text-2xl font-bold text-purple-600">
              {formatCurrency(candidate.totalInvestment)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Direct + IE Support
            </div>
          </div>

          {/* Top PACs */}
          {candidate.topPACs && candidate.topPACs.length > 0 && (
            <div>
              <div className="text-sm text-muted-foreground mb-2">Top PACs</div>
              <div className="space-y-1">
                {candidate.topPACs.slice(0, 3).map((pac, idx) => (
                  <div key={idx} className="flex justify-between text-xs">
                    <span className="truncate flex-1 mr-2">{pac.name}</span>
                    <span className="font-medium">{formatCurrency(pac.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderComparison = () => {
    if (!candidate1 || !candidate2 || !comparisonMetrics) return null;

    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Head-to-Head Comparison
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Fundraising Advantage */}
          <div>
            <div className="text-sm font-medium mb-3">Fundraising Advantage</div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="text-xs text-muted-foreground mb-1">{candidate1.name}</div>
                <div className="h-8 bg-blue-500 rounded-l flex items-center justify-end pr-2 text-white text-sm font-medium"
                  style={{ width: comparisonMetrics.raisedDiff > 0 ? '100%' : '50%' }}>
                  {comparisonMetrics.raisedDiff > 0 && formatCurrency(Math.abs(comparisonMetrics.raisedDiff))}
                </div>
              </div>
              <div className="flex-1">
                <div className="text-xs text-muted-foreground mb-1">{candidate2.name}</div>
                <div className="h-8 bg-red-500 rounded-r flex items-center justify-start pl-2 text-white text-sm font-medium"
                  style={{ width: comparisonMetrics.raisedDiff < 0 ? '100%' : '50%' }}>
                  {comparisonMetrics.raisedDiff < 0 && formatCurrency(Math.abs(comparisonMetrics.raisedDiff))}
                </div>
              </div>
            </div>
            {comparisonMetrics.raisedPct !== 0 && (
              <div className="text-xs text-muted-foreground mt-2 text-center">
                {Math.abs(comparisonMetrics.raisedPct).toFixed(1)}% advantage for{' '}
                {comparisonMetrics.raisedDiff > 0 ? candidate1.name : candidate2.name}
              </div>
            )}
          </div>

          {/* Donor Base Advantage */}
          <div>
            <div className="text-sm font-medium mb-3">Donor Base Size</div>
            <div className="flex items-center gap-4">
              <div className="flex-1 text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {formatNumber(candidate1.committeeDonorCount)}
                </div>
                <div className="text-xs text-muted-foreground">{candidate1.name}</div>
              </div>
              <ArrowRight className="h-6 w-6 text-muted-foreground" />
              <div className="flex-1 text-center">
                <div className="text-2xl font-bold text-red-600">
                  {formatNumber(candidate2.committeeDonorCount)}
                </div>
                <div className="text-xs text-muted-foreground">{candidate2.name}</div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-2 text-center">
              {formatNumber(Math.abs(comparisonMetrics.donorDiff))} more donors for{' '}
              {comparisonMetrics.donorDiff > 0 ? candidate1.name : candidate2.name}
            </div>
          </div>

          {/* Outside Money Advantage */}
          <div>
            <div className="text-sm font-medium mb-3">Outside Money (IE Support)</div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="text-xs text-muted-foreground mb-1">{candidate1.name}</div>
                <div className="h-8 bg-green-500 rounded-l flex items-center justify-end pr-2 text-white text-sm font-medium"
                  style={{ width: comparisonMetrics.ieSupportDiff > 0 ? '100%' : '50%' }}>
                  {comparisonMetrics.ieSupportDiff > 0 && formatCurrency(Math.abs(comparisonMetrics.ieSupportDiff))}
                </div>
              </div>
              <div className="flex-1">
                <div className="text-xs text-muted-foreground mb-1">{candidate2.name}</div>
                <div className="h-8 bg-green-600 rounded-r flex items-center justify-start pl-2 text-white text-sm font-medium"
                  style={{ width: comparisonMetrics.ieSupportDiff < 0 ? '100%' : '50%' }}>
                  {comparisonMetrics.ieSupportDiff < 0 && formatCurrency(Math.abs(comparisonMetrics.ieSupportDiff))}
                </div>
              </div>
            </div>
          </div>

          {/* Total Investment Comparison */}
          <div className="pt-4 border-t">
            <div className="text-sm font-medium mb-3">Total Investment (Direct + IE)</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600">
                  {formatCurrency(candidate1.totalInvestment)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{candidate1.name}</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600">
                  {formatCurrency(candidate2.totalInvestment)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{candidate2.name}</div>
              </div>
            </div>
            <div className="text-center mt-3">
              <Badge variant="outline" className="text-base">
                {formatCurrency(Math.abs(comparisonMetrics.totalInvestmentDiff))} advantage for{' '}
                {comparisonMetrics.totalInvestmentDiff > 0 ? candidate1.name : candidate2.name}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className={className}>
      {/* Candidate Selectors */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Candidate 1</label>
              <Select value={candidate1Id} onValueChange={setCandidate1Id}>
                <SelectTrigger>
                  <SelectValue placeholder="Select first candidate" />
                </SelectTrigger>
                <SelectContent>
                  {candidateList.map((c) => (
                    <SelectItem key={c.candidateId} value={c.candidateId}>
                      {c.displayName} ({c.party})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Candidate 2</label>
              <Select value={candidate2Id} onValueChange={setCandidate2Id}>
                <SelectTrigger>
                  <SelectValue placeholder="Select second candidate" />
                </SelectTrigger>
                <SelectContent>
                  {candidateList.map((c) => (
                    <SelectItem key={c.candidateId} value={c.candidateId}>
                      {c.displayName} ({c.party})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Candidate Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {renderCandidateCard(candidate1, 'left')}
        {renderCandidateCard(candidate2, 'right')}
      </div>

      {/* Comparison Section */}
      {renderComparison()}

      {/* Info Alert */}
      {!candidate1 || !candidate2 ? (
        <Alert className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Select two candidates above to see a detailed head-to-head comparison of their fundraising performance and outside money support.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
