'use client';

import React, { useState, useMemo } from 'react';
import {
  DonorIntegrator,
  type DonorEnrichedAddress,
  type DonorRecoveryTurf,
  type DonorRecoverySummary,
} from '@/lib/canvassing/DonorIntegrator';
import type { LapsedDonor, DonorProfile, DonorCluster } from '@/lib/donor/types';
import type { CanvassingPrecinct } from '@/lib/canvassing/types';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DollarSign,
  Users,
  MapPin,
  Target,
  MessageSquare,
  Heart,
  AlertCircle,
} from 'lucide-react';

interface DonorTargetingPanelProps {
  universeId?: string;
  precincts?: CanvassingPrecinct[];
  lapsedDonors?: LapsedDonor[];
  donorProfiles?: DonorProfile[];
  className?: string;
  onCreateRecoveryTurf?: (turf: DonorRecoveryTurf) => void;
}

type SortField = 'donorCount' | 'avgScore' | 'estimatedRecovery';
type SortDirection = 'asc' | 'desc';

export function DonorTargetingPanel({
  universeId,
  precincts = [],
  lapsedDonors = [],
  donorProfiles = [],
  className = '',
  onCreateRecoveryTurf,
}: DonorTargetingPanelProps) {
  const [clusters, setClusters] = useState<DonorCluster[]>([]);
  const [selectedClusters, setSelectedClusters] = useState<Set<string>>(new Set());
  const [enrichedAddresses, setEnrichedAddresses] = useState<DonorEnrichedAddress[]>([]);
  const [showEnrichedView, setShowEnrichedView] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<DonorEnrichedAddress | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isCreatingTurf, setIsCreatingTurf] = useState(false);
  const [showScriptDialog, setShowScriptDialog] = useState(false);
  const [campaignSummary, setCampaignSummary] = useState<DonorRecoverySummary | null>(null);
  const [sortField, setSortField] = useState<SortField>('estimatedRecovery');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // DonorIntegrator uses static methods

  // Discover lapsed donor clusters
  const handleDiscoverClusters = async () => {
    if (lapsedDonors.length === 0) {
      return;
    }

    setIsDiscovering(true);
    try {
      const discovered = DonorIntegrator.findDonorClusters(lapsedDonors);
      setClusters(discovered);
    } catch (error) {
      console.error('Failed to discover clusters:', error);
    } finally {
      setIsDiscovering(false);
    }
  };

  // Sort clusters
  const sortedClusters = useMemo(() => {
    const sorted = [...clusters];
    sorted.sort((a, b) => {
      let aVal: number;
      let bVal: number;

      switch (sortField) {
        case 'donorCount':
          aVal = a.donorCount;
          bVal = b.donorCount;
          break;
        case 'avgScore':
          aVal = a.avgRecoveryScore;
          bVal = b.avgRecoveryScore;
          break;
        case 'estimatedRecovery':
          aVal = a.estimatedRecoveryValue;
          bVal = b.estimatedRecoveryValue;
          break;
      }

      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return sorted;
  }, [clusters, sortField, sortDirection]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Toggle cluster selection
  const toggleCluster = (clusterKey: string) => {
    const newSelection = new Set(selectedClusters);
    if (newSelection.has(clusterKey)) {
      newSelection.delete(clusterKey);
    } else {
      newSelection.add(clusterKey);
    }
    setSelectedClusters(newSelection);
  };

  // Create recovery turfs from selected clusters
  const handleCreateRecoveryTurf = async () => {
    if (selectedClusters.size === 0) return;

    setIsCreatingTurf(true);
    try {
      const selectedClusterObjs = clusters.filter((c) =>
        selectedClusters.has(`${c.centerZip}-${c.city}`)
      );

      const turfs = DonorIntegrator.createDonorRecoveryTurfs(
        selectedClusterObjs,
        precincts,
        lapsedDonors
      );

      // Use first turf if available (or combine multiple)
      if (turfs.length > 0) {
        const firstTurf = turfs[0];
        if (onCreateRecoveryTurf) {
          onCreateRecoveryTurf(firstTurf);
        }

        // Set enriched addresses from all turfs for display
        const allEnrichedAddresses = turfs.flatMap(t => t.enrichedAddresses);
        setEnrichedAddresses(allEnrichedAddresses);
        setShowEnrichedView(true);
      }
      setSelectedClusters(new Set());
    } catch (error) {
      console.error('Failed to create recovery turf:', error);
    } finally {
      setIsCreatingTurf(false);
    }
  };

  // Get donor type badge
  const getDonorTypeBadge = (donorType: DonorEnrichedAddress['donorType']) => {
    const variants: Record<typeof donorType, { color: string; label: string }> = {
      lapsed: { color: 'bg-amber-100 text-amber-800 border-amber-300', label: 'Lapsed' },
      major: { color: 'bg-yellow-100 text-yellow-800 border-yellow-300', label: 'Major' },
      recurring: { color: 'bg-green-100 text-green-800 border-green-300', label: 'Recurring' },
      grassroots: { color: 'bg-blue-100 text-blue-800 border-blue-300', label: 'Grassroots' },
      prospect: { color: 'bg-gray-100 text-gray-800 border-gray-300', label: 'Prospect' },
      none: { color: 'bg-gray-50 text-gray-600 border-gray-200', label: 'None' },
    };

    const variant = variants[donorType];
    return (
      <Badge className={`${variant.color} border`} variant="outline">
        {variant.label}
      </Badge>
    );
  };

  // Get priority indicator
  const getPriorityIndicator = (priority: number) => {
    const colors: Record<number, string> = {
      5: 'bg-red-500',
      4: 'bg-orange-500',
      3: 'bg-yellow-500',
      2: 'bg-gray-400',
      1: 'bg-gray-300',
    };

    const labels: Record<number, string> = {
      5: 'High',
      4: 'Med-High',
      3: 'Medium',
      2: 'Low',
      1: 'Lowest',
    };

    return (
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${colors[priority]}`} />
        <span className="text-sm">{labels[priority]}</span>
      </div>
    );
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return `$${Math.round(amount).toLocaleString()}`;
  };

  // Show script dialog
  const handleShowScript = (address: DonorEnrichedAddress) => {
    setSelectedAddress(address);
    setShowScriptDialog(true);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Cluster Discovery */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Donor Cluster Discovery
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Find geographic clusters of lapsed donors for targeted recovery campaigns
              </p>
              <Button
                onClick={handleDiscoverClusters}
                disabled={isDiscovering || lapsedDonors.length === 0}
              >
                {isDiscovering ? 'Discovering...' : 'Find Lapsed Donor Clusters'}
              </Button>
            </div>

            {clusters.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    Found {clusters.length} cluster{clusters.length !== 1 ? 's' : ''}
                  </p>
                  <Button
                    onClick={handleCreateRecoveryTurf}
                    disabled={selectedClusters.size === 0 || isCreatingTurf}
                    variant="default"
                  >
                    {isCreatingTurf
                      ? 'Creating...'
                      : `Create Recovery Turf (${selectedClusters.size} selected)`}
                  </Button>
                </div>

                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Select</TableHead>
                        <TableHead>ZIP Code</TableHead>
                        <TableHead>City</TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => toggleSort('donorCount')}
                        >
                          Donors {sortField === 'donorCount' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => toggleSort('avgScore')}
                        >
                          Avg Recovery Score{' '}
                          {sortField === 'avgScore' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => toggleSort('estimatedRecovery')}
                        >
                          Est. Recovery Value{' '}
                          {sortField === 'estimatedRecovery' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </TableHead>
                        <TableHead>Recommended Approach</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedClusters.map((cluster) => {
                        const key = `${cluster.centerZip}-${cluster.city}`;
                        return (
                          <TableRow key={key}>
                            <TableCell>
                              <Checkbox
                                checked={selectedClusters.has(key)}
                                onCheckedChange={() => toggleCluster(key)}
                              />
                            </TableCell>
                            <TableCell className="font-mono">{cluster.centerZip}</TableCell>
                            <TableCell>{cluster.city}</TableCell>
                            <TableCell>{cluster.donorCount}</TableCell>
                            <TableCell>{cluster.avgRecoveryScore.toFixed(1)}</TableCell>
                            <TableCell className="font-semibold">
                              {formatCurrency(cluster.estimatedRecoveryValue)}
                            </TableCell>
                            <TableCell className="text-sm text-gray-600">
                              {cluster.recommendedApproach}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {lapsedDonors.length === 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No lapsed donors available. Load donor data to discover clusters.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Enriched Walk List */}
      {enrichedAddresses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Donor-Enriched Walk List
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="show-enriched"
                    checked={showEnrichedView}
                    onCheckedChange={(checked: boolean) => setShowEnrichedView(checked)}
                  />
                  <label htmlFor="show-enriched" className="text-sm font-medium cursor-pointer">
                    Show donor-enriched addresses ({enrichedAddresses.length} total)
                  </label>
                </div>
              </div>

              {showEnrichedView && (
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Address</TableHead>
                        <TableHead>Donor Type</TableHead>
                        <TableHead>Last Gift</TableHead>
                        <TableHead>Lifetime Total</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Script</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {enrichedAddresses.map((addr, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-sm">
                            {addr.address}
                            <div className="text-xs text-gray-500">{addr.precinct}</div>
                          </TableCell>
                          <TableCell>{getDonorTypeBadge(addr.donorType)}</TableCell>
                          <TableCell>
                            {addr.lastGiftDate ? new Date(addr.lastGiftDate).toLocaleDateString() : '-'}
                          </TableCell>
                          <TableCell>
                            {addr.lifetimeTotal ? formatCurrency(addr.lifetimeTotal) : '-'}
                          </TableCell>
                          <TableCell>
                            {addr.recoveryScore !== undefined ? (
                              <div className="flex items-center gap-1">
                                <Heart className="w-3 h-3 text-red-500" />
                                <span>{addr.recoveryScore.toFixed(1)}</span>
                              </div>
                            ) : addr.upgradeScore !== undefined ? (
                              <div className="flex items-center gap-1">
                                <DollarSign className="w-3 h-3 text-green-500" />
                                <span>{addr.upgradeScore.toFixed(1)}</span>
                              </div>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>{getPriorityIndicator(addr.priority)}</TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleShowScript(addr)}
                            >
                              <MessageSquare className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Campaign Summary */}
      {campaignSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Recovery Campaign Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-gray-600">Contacts Made</p>
                <p className="text-2xl font-bold">{campaignSummary.totalContactsMade}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-600">Donors Targeted</p>
                <p className="text-2xl font-bold">{campaignSummary.totalDonorsTargeted}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-600">Donors Recovered</p>
                <p className="text-2xl font-bold">{campaignSummary.donorsRecovered}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-600">Recovery Rate</p>
                <p className="text-2xl font-bold text-green-600">
                  {(campaignSummary.recoveryRate * 100).toFixed(1)}%
                </p>
              </div>
            </div>

            {campaignSummary.insights && campaignSummary.insights.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium">Insights & Recommendations:</p>
                <ul className="space-y-1">
                  {campaignSummary.insights.map((insight, idx) => (
                    <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">•</span>
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Script Dialog */}
      <Dialog open={showScriptDialog} onOpenChange={setShowScriptDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Recommended Script
            </DialogTitle>
            <DialogDescription>
              {selectedAddress?.address}
              {selectedAddress?.precinct && ` • ${selectedAddress.precinct}`}
            </DialogDescription>
          </DialogHeader>

          {selectedAddress && (
            <div className="space-y-4">
              {/* Donor Info */}
              <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                <div className="flex items-center gap-4">
                  <div>{getDonorTypeBadge(selectedAddress.donorType)}</div>
                  <div>{getPriorityIndicator(selectedAddress.priority)}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {selectedAddress.lastGiftDate && (
                    <div>
                      <span className="text-gray-600">Last Gift:</span>{' '}
                      <span className="font-medium">
                        {new Date(selectedAddress.lastGiftDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {selectedAddress.lifetimeTotal && (
                    <div>
                      <span className="text-gray-600">Lifetime:</span>{' '}
                      <span className="font-medium">
                        {formatCurrency(selectedAddress.lifetimeTotal)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Script */}
              {selectedAddress.recommendedScript && (
                <div className="space-y-2">
                  <h4 className="font-medium">Opening Script:</h4>
                  <p className="text-sm p-3 bg-blue-50 border-l-4 border-blue-500 rounded">
                    {selectedAddress.recommendedScript}
                  </p>
                </div>
              )}

              {/* Conversation Tips */}
              {selectedAddress.conversationTips && selectedAddress.conversationTips.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Conversation Tips:</h4>
                  <ul className="space-y-1">
                    {selectedAddress.conversationTips.map((tip, idx) => (
                      <li key={idx} className="text-sm flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">✓</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Special Handling */}
              {selectedAddress.specialHandling && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Special Handling:</strong> {selectedAddress.specialHandling}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setShowScriptDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
