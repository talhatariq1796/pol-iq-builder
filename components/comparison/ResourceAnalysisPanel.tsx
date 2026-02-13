'use client';

import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DollarSign,
  Target,
  TrendingUp,
  Users,
  Phone,
  Mail,
  Monitor,
  MapPin,
} from 'lucide-react';
import type { ComparisonEntity } from '@/lib/comparison/types';
import { ResourceOptimizer } from '@/lib/comparison/ResourceOptimizer';

interface ResourceAnalysisPanelProps {
  entity: ComparisonEntity;
  side: 'left' | 'right';
}

export function ResourceAnalysisPanel({ entity, side }: ResourceAnalysisPanelProps) {
  // Calculate ROI and cost analysis using ResourceOptimizer
  const analysis = useMemo(() => {
    const optimizer = new ResourceOptimizer();
    return optimizer.analyzeEntity(entity);
  }, [entity]);

  // Get color for ROI score badge
  const getROIColor = (score: number): string => {
    if (score >= 80) return 'bg-green-600 text-white';
    if (score >= 60) return 'bg-yellow-500 text-white';
    return 'bg-gray-500 text-white';
  };

  // Get icon for each channel
  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'canvassing':
        return <MapPin className="h-4 w-4" />;
      case 'digital':
        return <Monitor className="h-4 w-4" />;
      case 'mail':
        return <Mail className="h-4 w-4" />;
      case 'phone':
        return <Phone className="h-4 w-4" />;
      default:
        return <Target className="h-4 w-4" />;
    }
  };

  // Format currency
  const formatCurrency = (value: number): string => {
    return `$${value.toFixed(2)}`;
  };

  // Format percentage
  const formatPercent = (value: number): string => {
    return `${(value * 100).toFixed(1)}%`;
  };

  // Side-specific styling
  const borderColor = side === 'left' ? 'border-blue-500' : 'border-red-500';

  const { roiScore, channelCosts, recommendedChannel, estimatedPersuadableVoters } = analysis;

  // ROI breakdown components with weights
  const roiComponents = [
    { name: 'Persuadable Voters', score: roiScore.breakdown.persuadableVoters, weight: 30 },
    { name: 'Efficiency', score: roiScore.breakdown.efficiency, weight: 25 },
    { name: 'Swing Impact', score: roiScore.breakdown.swingImpact, weight: 20 },
    { name: 'Turnout Gap', score: roiScore.breakdown.turnoutGap, weight: 15 },
    { name: 'Competitive Proximity', score: roiScore.breakdown.competitiveProximity, weight: 10 },
  ];

  // Channel data for table
  const channelData = [
    {
      channel: 'Canvassing',
      icon: getChannelIcon('canvassing'),
      costPerUnit: channelCosts.canvassing.costPerUnit,
      costPerPersuadable: channelCosts.canvassing.costPerPersuadable,
      efficiency: channelCosts.canvassing.relativeEfficiency,
      isRecommended: channelCosts.canvassing.isRecommended,
    },
    {
      channel: 'Digital',
      icon: getChannelIcon('digital'),
      costPerUnit: channelCosts.digital.costPerUnit,
      costPerPersuadable: channelCosts.digital.costPerPersuadable,
      efficiency: channelCosts.digital.relativeEfficiency,
      isRecommended: channelCosts.digital.isRecommended,
    },
    {
      channel: 'Mail',
      icon: getChannelIcon('mail'),
      costPerUnit: channelCosts.mail.costPerUnit,
      costPerPersuadable: channelCosts.mail.costPerPersuadable,
      efficiency: channelCosts.mail.relativeEfficiency,
      isRecommended: channelCosts.mail.isRecommended,
    },
    {
      channel: 'Phone',
      icon: getChannelIcon('phone'),
      costPerUnit: channelCosts.phone.costPerUnit,
      costPerPersuadable: channelCosts.phone.costPerPersuadable,
      efficiency: channelCosts.phone.relativeEfficiency,
      isRecommended: channelCosts.phone.isRecommended,
    },
  ];

  return (
    <Card className="h-full">
      <CardHeader className={`pb-3 border-b-2 ${borderColor}`}>
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          <CardTitle className="text-base font-bold">Resource Analysis</CardTitle>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-6">
        {/* ROI Score Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">ROI Score</span>
            </div>
            <Badge className={getROIColor(roiScore.totalScore)}>
              {roiScore.totalScore}/100
            </Badge>
          </div>

          {/* ROI Breakdown Bars */}
          <div className="space-y-2">
            {roiComponents.map(({ name, score, weight }) => (
              <div key={name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {name} ({weight}%)
                  </span>
                  <span className="font-medium">{score.toFixed(0)}</span>
                </div>
                <Progress value={score} className="h-2" />
              </div>
            ))}
          </div>

          {/* Recommendation */}
          <div className="bg-muted/30 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                {roiScore.recommendation}
              </p>
            </div>
          </div>
        </div>

        {/* Channel Costs Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Channel Costs</span>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs font-semibold">Channel</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Cost/Unit</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Cost/Persuadable</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Efficiency</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channelData.map((row) => (
                  <TableRow
                    key={row.channel}
                    className={row.isRecommended ? 'bg-green-50 dark:bg-green-950/20' : ''}
                  >
                    <TableCell className="py-2">
                      <div className="flex items-center gap-2">
                        {row.icon}
                        <span className="text-xs font-medium">
                          {row.channel}
                          {row.isRecommended && (
                            <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0">
                              Best
                            </Badge>
                          )}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-right py-2">
                      {formatCurrency(row.costPerUnit)}
                    </TableCell>
                    <TableCell className="text-xs text-right font-medium py-2">
                      {formatCurrency(row.costPerPersuadable)}
                    </TableCell>
                    <TableCell className="text-xs text-right py-2">
                      {formatPercent(row.efficiency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Summary metrics */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="flex items-center gap-1 mb-1">
                <Users className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground font-medium">
                  Persuadable Voters
                </span>
              </div>
              <p className="text-sm font-bold">
                {estimatedPersuadableVoters.toLocaleString()}
              </p>
            </div>

            <div className="bg-muted/30 rounded-lg p-3">
              <div className="flex items-center gap-1 mb-1">
                <Target className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground font-medium">
                  Best Cost/Voter
                </span>
              </div>
              <p className="text-sm font-bold">
                {formatCurrency(analysis.bestCostPerPersuadable)}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
