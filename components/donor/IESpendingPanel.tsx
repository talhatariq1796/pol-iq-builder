'use client';

/**
 * Independent Expenditure Spending Panel
 *
 * Features:
 * - Race selector dropdown
 * - Total spending by race
 * - Support vs Oppose breakdown
 * - Top spenders list
 * - Timeline chart of spending
 * - Purpose breakdown (TV, Digital, Mail, etc.)
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
  DollarSign,
  TrendingUp,
  TrendingDown,
  Building2,
  AlertCircle,
  Download,
} from 'lucide-react';

import type { IndependentExpenditureData } from '@/lib/donor/types';

interface IESpendingPanelProps {
  data: IndependentExpenditureData;
  selectedRace?: string;
  onRaceSelect?: (race: string) => void;
  className?: string;
}

export function IESpendingPanel({
  data,
  selectedRace: initialSelectedRace,
  onRaceSelect,
  className,
}: IESpendingPanelProps) {
  const [selectedRace, setSelectedRace] = useState<string>(
    initialSelectedRace || (data?.byRace ? Object.keys(data.byRace)[0] : '') || ''
  );

  const raceData = selectedRace && data?.byRace ? data.byRace[selectedRace] : null;

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

  // Get sorted races by total IE spending
  const sortedRaces = useMemo(() => {
    if (!data?.byRace) return [];
    return Object.entries(data.byRace)
      .map(([raceId, race]) => ({
        raceId,
        candidateName: race.candidateName,
        totalIE: race.totalIE,
      }))
      .sort((a, b) => b.totalIE - a.totalIE);
  }, [data?.byRace]);

  const handleRaceChange = (raceId: string) => {
    setSelectedRace(raceId);
    if (onRaceSelect) {
      onRaceSelect(raceId);
    }
  };

  const handleExport = () => {
    if (!raceData) return;

    const csv = generateCSV(raceData);
    downloadCSV(csv, `ie-spending-${selectedRace}.csv`);
  };

  const generateCSV = (race: typeof raceData) => {
    if (!race?.topSpenders) return '';

    const headers = [
      'Committee ID',
      'Committee Name',
      'Amount',
      'Support/Oppose',
    ];

    const rows = race.topSpenders.map((spender) => [
      spender.committeeId,
      spender.committeeName,
      spender.amount,
      spender.supportOppose === 'S' ? 'Support' : 'Oppose',
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

  return (
    <div className={className}>
      {/* Summary Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="rounded-lg shadow-md border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total IE Spending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-purple-600" />
              <div className="text-2xl font-bold">
                {formatCurrency(data?.metadata?.totalSpending ?? 0)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg shadow-md border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Support Spending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <div className="text-2xl font-bold">
                {formatCurrency(data?.metadata?.totalSupport ?? 0)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg shadow-md border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Oppose Spending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-600" />
              <div className="text-2xl font-bold">
                {formatCurrency(data?.metadata?.totalOppose ?? 0)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg shadow-md border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Races Tracked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-600" />
              <div className="text-2xl font-bold">
                {data?.metadata?.raceCount ?? 0}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Race Selector */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">Select Race</label>
              <Select value={selectedRace} onValueChange={handleRaceChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a race" />
                </SelectTrigger>
                <SelectContent>
                  {sortedRaces.map((race) => (
                    <SelectItem key={race.raceId} value={race.raceId}>
                      {race.candidateName} ({formatCurrency(race.totalIE)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleExport}
              variant="outline"
              size="sm"
              disabled={!raceData}
              className="mt-7"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {raceData ? (
        <>
          {/* Race Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Support vs Oppose Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Support vs Oppose</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium">Support</span>
                      </div>
                      <span className="text-lg font-bold text-green-600">
                        {formatCurrency(raceData.support)}
                      </span>
                    </div>
                    <div className="h-3 bg-muted rounded overflow-hidden">
                      <div
                        className="h-full bg-green-500"
                        style={{
                          width: `${(raceData.support / raceData.totalIE) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {((raceData.support / raceData.totalIE) * 100).toFixed(1)}% of total IE
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-medium">Oppose</span>
                      </div>
                      <span className="text-lg font-bold text-red-600">
                        {formatCurrency(raceData.oppose)}
                      </span>
                    </div>
                    <div className="h-3 bg-muted rounded overflow-hidden">
                      <div
                        className="h-full bg-red-500"
                        style={{
                          width: `${(raceData.oppose / raceData.totalIE) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {((raceData.oppose / raceData.totalIE) * 100).toFixed(1)}% of total IE
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Net IE</span>
                      <span className={`text-xl font-bold ${raceData.netIE >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(raceData.netIE)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {raceData.netIE >= 0
                        ? 'Net positive outside spending'
                        : 'Net negative outside spending'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Race Totals */}
            <Card>
              <CardHeader>
                <CardTitle>Race Totals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Candidate</div>
                    <div className="text-xl font-bold">{raceData.candidateName}</div>
                  </div>

                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Total IE Spending</div>
                    <div className="text-3xl font-bold text-purple-600">
                      {formatCurrency(raceData.totalIE)}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Number of Spenders</div>
                    <div className="text-2xl font-bold">
                      {raceData.topSpenders?.length ?? 0}
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="text-sm text-muted-foreground mb-2">Spending Balance</div>
                    <div className="flex items-center gap-2">
                      {raceData.netIE >= 0 ? (
                        <>
                          <Badge variant="default" className="bg-green-500">
                            Favorable
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            More support than opposition
                          </span>
                        </>
                      ) : (
                        <>
                          <Badge variant="destructive">
                            Unfavorable
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            More opposition than support
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Spenders Table */}
          <Card>
            <CardHeader>
              <CardTitle>Top Spenders in This Race</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Rank</TableHead>
                      <TableHead>Committee</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead className="w-24">Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(raceData.topSpenders ?? []).map((spender, idx) => (
                      <TableRow key={`${spender.committeeId}-${idx}`}>
                        <TableCell className="font-medium">{idx + 1}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{spender.committeeName}</div>
                            <div className="text-xs text-muted-foreground font-mono">
                              {spender.committeeId}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-lg font-bold">
                          {formatCurrency(spender.amount)}
                        </TableCell>
                        <TableCell>
                          {spender.supportOppose === 'S' ? (
                            <Badge variant="default" className="bg-green-500">
                              Support
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              Oppose
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Timeline Chart */}
          {data?.timeline && data.timeline.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Spending Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-end gap-2">
                  {(data.timeline ?? []).map((month) => {
                    const maxSpending = Math.max(...(data.timeline ?? []).map((m) => m.totalSpending));
                    const height = maxSpending > 0 ? (month.totalSpending / maxSpending) * 100 : 0;

                    return (
                      <div key={month.month} className="flex-1 flex flex-col items-center gap-2">
                        <div className="w-full space-y-1">
                          <div
                            className="w-full bg-green-500 rounded-t hover:opacity-80 transition-opacity cursor-pointer"
                            style={{ height: `${(month.support / maxSpending) * 100}%` }}
                            title={`Support: ${formatCurrency(month.support)}`}
                          />
                          <div
                            className="w-full bg-red-500 hover:opacity-80 transition-opacity cursor-pointer"
                            style={{ height: `${(month.oppose / maxSpending) * 100}%` }}
                            title={`Oppose: ${formatCurrency(month.oppose)}`}
                          />
                        </div>
                        <div className="text-xs text-muted-foreground rotate-45 origin-top-left whitespace-nowrap">
                          {month.month}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-8 flex items-center justify-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-500 rounded" />
                    <span>Support</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-500 rounded" />
                    <span>Oppose</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Select a race above to view independent expenditure details.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
