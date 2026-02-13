'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search,
  TrendingUp,
  ArrowUpDown,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import type {
  ComparisonEntity,
  BoundaryType,
  SimilarEntityResult,
} from '@/lib/comparison/types';

interface SimilarPrecinctsModalProps {
  isOpen: boolean;
  onClose: () => void;
  referenceEntity: ComparisonEntity;
  boundaryType: BoundaryType;
  onSelectEntity?: (entityId: string) => void;
}

type SortField = 'similarity' | 'name' | 'partisanLean' | 'gotvPriority' | 'strategy';
type SortDirection = 'asc' | 'desc';

export function SimilarPrecinctsModal({
  isOpen,
  onClose,
  referenceEntity,
  boundaryType,
  onSelectEntity,
}: SimilarPrecinctsModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SimilarEntityResult[]>([]);
  const [minSimilarity, setMinSimilarity] = useState(60);
  const [maxResults, setMaxResults] = useState(10);
  const [sortField, setSortField] = useState<SortField>('similarity');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Fetch similar entities when modal opens or settings change
  useEffect(() => {
    if (!isOpen) return;

    const fetchSimilarEntities = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/comparison/similar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            referenceEntityId: referenceEntity.id,
            boundaryType,
            minSimilarity,
            maxResults,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch similar entities: ${response.statusText}`);
        }

        const data = await response.json();
        setResults(data.results || []);
      } catch (err) {
        console.error('Error fetching similar entities:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchSimilarEntities();
  }, [isOpen, referenceEntity.id, boundaryType, minSimilarity, maxResults]);

  // Sort results
  const sortedResults = React.useMemo(() => {
    const sorted = [...results];

    sorted.sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      switch (sortField) {
        case 'similarity':
          aValue = a.similarityScore;
          bValue = b.similarityScore;
          break;
        case 'name':
          aValue = a.entity.name;
          bValue = b.entity.name;
          break;
        case 'partisanLean':
          aValue = a.entity.politicalProfile.partisanLean;
          bValue = b.entity.politicalProfile.partisanLean;
          break;
        case 'gotvPriority':
          aValue = a.entity.targetingScores.gotvPriority;
          bValue = b.entity.targetingScores.gotvPriority;
          break;
        case 'strategy':
          aValue = a.entity.targetingScores.recommendedStrategy;
          bValue = b.entity.targetingScores.recommendedStrategy;
          break;
        default:
          aValue = a.similarityScore;
          bValue = b.similarityScore;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortDirection === 'asc'
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });

    return sorted;
  }, [results, sortField, sortDirection]);

  // Handle sort toggle
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'similarity' ? 'desc' : 'asc');
    }
  };

  // Get similarity badge color
  const getSimilarityColor = (score: number): string => {
    if (score >= 90) return 'bg-green-600 text-white hover:bg-green-700';
    if (score >= 70) return 'bg-yellow-500 text-white hover:bg-yellow-600';
    return 'bg-gray-400 text-white hover:bg-gray-500';
  };

  // Format partisan lean
  const formatLean = (lean: number): string => {
    if (Math.abs(lean) < 1) return 'Even';
    const prefix = lean > 0 ? 'D+' : 'R+';
    return `${prefix}${Math.abs(lean).toFixed(0)}`;
  };

  // Get partisan lean color
  const getLeanColor = (lean: number): string => {
    if (lean >= 20) return 'bg-blue-600 text-white';
    if (lean >= 10) return 'bg-blue-400 text-white';
    if (lean >= 5) return 'bg-blue-200 text-blue-900';
    if (lean > -5) return 'bg-gray-200 text-gray-900';
    if (lean > -10) return 'bg-red-200 text-red-900';
    if (lean > -20) return 'bg-red-400 text-white';
    return 'bg-red-600 text-white';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <Search className="h-5 w-5" />
            Find Similar Entities
          </DialogTitle>
          <DialogDescription className="text-sm mt-1">
            Comparing to: <strong>{referenceEntity.name}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* Settings Panel */}
        <div className="px-6 py-4 bg-muted/30 border-b space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">
                Minimum Similarity: {minSimilarity}%
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMinSimilarity(60)}
                className="text-xs"
              >
                Reset
              </Button>
            </div>
            <Slider
              value={[minSimilarity]}
              onValueChange={(values: number[]) => setMinSimilarity(values[0])}
              min={50}
              max={90}
              step={5}
              className="w-full"
            />
          </div>

          <div className="flex items-center gap-4">
            <label className="text-sm font-medium">Max Results:</label>
            <div className="flex gap-2">
              {[5, 10, 15].map((num) => (
                <Button
                  key={num}
                  variant={maxResults === num ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMaxResults(num)}
                  className="text-xs"
                >
                  {num}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Results Table */}
        <div className="flex-1 overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-64 px-6">
              <div className="text-center">
                <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && sortedResults.length === 0 && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <TrendingUp className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No similar entities found. Try lowering the minimum similarity.
                </p>
              </div>
            </div>
          )}

          {!loading && !error && sortedResults.length > 0 && (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-1">
                        Name
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('similarity')}
                    >
                      <div className="flex items-center gap-1">
                        Similarity
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('partisanLean')}
                    >
                      <div className="flex items-center gap-1">
                        Partisan Lean
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('gotvPriority')}
                    >
                      <div className="flex items-center gap-1">
                        GOTV
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('strategy')}
                    >
                      <div className="flex items-center gap-1">
                        Strategy
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedResults.map((result: SimilarEntityResult) => (
                    <TableRow key={result.entity.id}>
                      <TableCell className="font-medium">
                        <div>
                          <div className="text-sm">{result.entity.name}</div>
                          {result.entity.parentJurisdiction && (
                            <div className="text-xs text-muted-foreground">
                              {result.entity.parentJurisdiction}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={getSimilarityColor(result.similarityScore)}
                        >
                          {result.similarityScore.toFixed(0)}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={getLeanColor(
                            result.entity.politicalProfile.partisanLean
                          )}
                        >
                          {formatLean(result.entity.politicalProfile.partisanLean)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {result.entity.targetingScores.gotvPriority.toFixed(0)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {result.entity.targetingScores.recommendedStrategy}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => {
                            onSelectEntity?.(result.entity.id);
                            onClose();
                          }}
                          className="text-xs"
                        >
                          Compare
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
