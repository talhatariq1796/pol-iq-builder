'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import type {
  PrecinctData,
  SegmentDefinition,
  LookalikeProfile,
  LookalikeResults,
  LookalikeMatch
} from '@/lib/segmentation/types';
import { ChevronDown, ChevronUp, Download, X, RotateCcw, Search } from 'lucide-react';

interface LookalikeBuilderProps {
  precincts: PrecinctData[];
  savedSegments: SegmentDefinition[];
  onResultsChange?: (results: LookalikeResults | null) => void;
}

const ALGORITHM_DESCRIPTIONS = {
  euclidean: 'Straight-line distance in feature space. Good for general similarity.',
  cosine: 'Directional similarity. Good for pattern matching regardless of magnitude.',
  mahalanobis: 'Accounts for feature correlations. More sophisticated but computationally intensive.'
};

const DEFAULT_WEIGHTS = {
  demographics: 30,
  political: 25,
  electoral: 20,
  tapestry: 15,
  engagement: 10
};

export function LookalikeBuilder({
  precincts,
  savedSegments,
  onResultsChange
}: LookalikeBuilderProps) {
  const { toast } = useToast();

  // Reference source state
  const [sourceMode, setSourceMode] = useState<'precinct' | 'segment'>('precinct');
  const [selectedPrecinct, setSelectedPrecinct] = useState<string>('');
  const [selectedSegment, setSelectedSegment] = useState<string>('');
  const [multiSelect, setMultiSelect] = useState(false);
  const [selectedPrecincts, setSelectedPrecincts] = useState<string[]>([]);

  // Algorithm and settings
  const [algorithm, setAlgorithm] = useState<'euclidean' | 'cosine' | 'mahalanobis'>('euclidean');
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [minSimilarity, setMinSimilarity] = useState(75);
  const [maxResults, setMaxResults] = useState(20);
  const [excludeSources, setExcludeSources] = useState(true);

  // Results state
  const [results, setResults] = useState<LookalikeResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [sortField, setSortField] = useState<keyof LookalikeMatch>('similarityScore');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Normalize weights to sum to 100%
  const normalizedWeights = useMemo(() => {
    const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
    if (total === 0) return weights;

    const normalized: Record<string, number> = {};
    for (const [key, value] of Object.entries(weights)) {
      normalized[key] = (value / total) * 100;
    }
    return normalized;
  }, [weights]);

  const handleWeightChange = (category: keyof typeof weights, value: number) => {
    setWeights((prev: typeof DEFAULT_WEIGHTS) => ({ ...prev, [category]: value }));
  };

  const resetWeights = () => {
    setWeights(DEFAULT_WEIGHTS);
  };

  const clearSelection = () => {
    setSelectedPrecinct('');
    setSelectedSegment('');
    setSelectedPrecincts([]);
    setResults(null);
    onResultsChange?.(null);
  };

  const handlePrecinctToggle = (precinctId: string) => {
    setSelectedPrecincts((prev: string[]) =>
      prev.includes(precinctId)
        ? prev.filter((id: string) => id !== precinctId)
        : [...prev, precinctId]
    );
  };

  const handleFindLookalikes = async () => {
    setLoading(true);

    try {
      const profile: LookalikeProfile = {
        sourcePrecinct: !multiSelect ? selectedPrecinct : undefined,
        sourcePrecincts: multiSelect ? selectedPrecincts : undefined,
        algorithm,
        featureWeights: {
          demographics: normalizedWeights.demographics / 100,
          political: normalizedWeights.political / 100,
          electoral: normalizedWeights.electoral / 100,
          tapestry: normalizedWeights.tapestry / 100,
          engagement: normalizedWeights.engagement / 100
        },
        minSimilarityScore: minSimilarity / 100,
        maxResults,
        excludeSources
      };

      const response = await fetch('/api/segmentation/lookalike', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });

      if (!response.ok) {
        throw new Error('Failed to find lookalikes');
      }

      const data: LookalikeResults = await response.json();
      setResults(data);
      onResultsChange?.(data);
    } catch (error) {
      console.error('Error finding lookalikes:', error);
      toast({
        title: 'Error finding lookalikes',
        description: error instanceof Error ? error.message : 'Failed to find similar precincts. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!results) return;

    try {
      const csv = [
        ['Precinct', 'Jurisdiction', 'Similarity Score', 'Demographic', 'Political', 'Electoral', 'Tapestry', 'Engagement'],
        ...results.matches.map(m => [
          m.precinctName,
          m.jurisdiction,
          (m.similarityScore * 100).toFixed(1),
          (m.demographicSimilarity * 100).toFixed(1),
          (m.politicalSimilarity * 100).toFixed(1),
          (m.electoralSimilarity * 100).toFixed(1),
          (m.tapestrySimilarity * 100).toFixed(1),
          (m.engagementSimilarity * 100).toFixed(1)
        ])
      ].map(row => row.join(',')).join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lookalike-results-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting results:', error);
      toast({
        title: 'Export failed',
        description: 'Failed to export results to CSV. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const sortedResults = useMemo(() => {
    if (!results) return [];

    const sorted = [...results.matches].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return 0;
    });

    return sorted;
  }, [results, sortField, sortDirection]);

  const handleSort = (field: keyof LookalikeMatch) => {
    if (sortField === field) {
      setSortDirection((prev: 'asc' | 'desc') => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const canSearch = sourceMode === 'precinct'
    ? (multiSelect ? selectedPrecincts.length > 0 : selectedPrecinct !== '')
    : selectedSegment !== '';

  return (
    <div className="space-y-6">
      {/* Reference Source Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Reference Source
            {(selectedPrecinct || selectedSegment || selectedPrecincts.length > 0) && (
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={sourceMode} onValueChange={(v: string) => setSourceMode(v as 'precinct' | 'segment')}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="precinct" id="mode-precinct" />
              <Label htmlFor="mode-precinct">Use Precinct(s)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="segment" id="mode-segment" />
              <Label htmlFor="mode-segment">Use Saved Segment</Label>
            </div>
          </RadioGroup>

          {sourceMode === 'precinct' && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Switch
                  id="multi-select"
                  checked={multiSelect}
                  onCheckedChange={setMultiSelect}
                />
                <Label htmlFor="multi-select">Select multiple precincts</Label>
              </div>

              {!multiSelect ? (
                <Select value={selectedPrecinct} onValueChange={setSelectedPrecinct}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a precinct" />
                  </SelectTrigger>
                  <SelectContent>
                    {precincts.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} - {p.jurisdiction}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                  {precincts.map(p => (
                    <div key={p.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`precinct-${p.id}`}
                        checked={selectedPrecincts.includes(p.id)}
                        onChange={() => handlePrecinctToggle(p.id)}
                        className="rounded"
                      />
                      <Label htmlFor={`precinct-${p.id}`} className="cursor-pointer flex-1">
                        {p.name} - {p.jurisdiction}
                      </Label>
                    </div>
                  ))}
                </div>
              )}

              {multiSelect && selectedPrecincts.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  {selectedPrecincts.length} precinct(s) selected
                </div>
              )}
            </div>
          )}

          {sourceMode === 'segment' && (
            <Select value={selectedSegment} onValueChange={setSelectedSegment}>
              <SelectTrigger>
                <SelectValue placeholder="Select a saved segment" />
              </SelectTrigger>
              <SelectContent>
                {savedSegments.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.cachedResults?.precinctCount ?? '?'} precincts)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {/* Algorithm Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Similarity Algorithm</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={algorithm} onValueChange={(v: string) => setAlgorithm(v as typeof algorithm)}>
            {(Object.keys(ALGORITHM_DESCRIPTIONS) as Array<keyof typeof ALGORITHM_DESCRIPTIONS>).map(alg => (
              <div key={alg} className="flex items-start space-x-2 py-2">
                <RadioGroupItem value={alg} id={`alg-${alg}`} className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor={`alg-${alg}`} className="capitalize cursor-pointer font-medium">
                    {alg}
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {ALGORITHM_DESCRIPTIONS[alg]}
                  </p>
                </div>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Feature Weights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Feature Weights
            <Button variant="ghost" size="sm" onClick={resetWeights}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(Object.keys(weights) as Array<keyof typeof weights>).map(category => (
            <div key={category} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="capitalize">{category}</Label>
                <span className="text-sm font-medium">
                  {normalizedWeights[category].toFixed(0)}%
                </span>
              </div>
              <Slider
                value={[weights[category]]}
                onValueChange={(v: number[]) => handleWeightChange(category, v[0])}
                min={0}
                max={100}
                step={5}
                className="w-full"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Result Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Result Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Minimum Similarity Score</Label>
              <span className="text-sm font-medium">{minSimilarity}%</span>
            </div>
            <Slider
              value={[minSimilarity]}
              onValueChange={(v: number[]) => setMinSimilarity(v[0])}
              min={50}
              max={100}
              step={5}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-results">Maximum Results</Label>
            <input
              id="max-results"
              type="number"
              min={5}
              max={50}
              value={maxResults}
              onChange={(e) => setMaxResults(parseInt(e.target.value) || 20)}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="exclude-sources"
              checked={excludeSources}
              onCheckedChange={setExcludeSources}
            />
            <Label htmlFor="exclude-sources">Exclude source precincts from results</Label>
          </div>
        </CardContent>
      </Card>

      {/* Find Button */}
      <Button
        onClick={handleFindLookalikes}
        disabled={!canSearch || loading}
        className="w-full"
        size="lg"
      >
        <Search className="h-5 w-5 mr-2" />
        {loading ? 'Finding Lookalikes...' : 'Find Lookalikes'}
      </Button>

      {/* Results Display */}
      {results && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Results
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" />
                Export CSV
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary */}
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <div className="font-medium">
                  Found {results.matches.length} lookalike precinct{results.matches.length !== 1 ? 's' : ''}
                </div>
                <div className="text-sm text-muted-foreground">
                  Average similarity: {(results.avgSimilarityScore * 100).toFixed(1)}%
                </div>
              </div>
              <Badge variant="secondary">
                {algorithm}
              </Badge>
            </div>

            {/* Reference Profile */}
            <div className="p-4 border rounded-lg space-y-2">
              <div className="font-medium">Reference Profile</div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span>{' '}
                  {results.referenceProfile.name}
                </div>
                <div>
                  <span className="text-muted-foreground">Precincts:</span>{' '}
                  {results.referenceProfile.precinctCount}
                </div>
                <div>
                  <span className="text-muted-foreground">Avg Age:</span>{' '}
                  {results.referenceProfile.avgAge.toFixed(1)}
                </div>
                <div>
                  <span className="text-muted-foreground">Avg Income:</span>{' '}
                  ${Math.round(results.referenceProfile.avgIncome).toLocaleString()}
                </div>
                <div>
                  <span className="text-muted-foreground">Partisan Lean:</span>{' '}
                  {results.referenceProfile.avgPartisanLean > 0 ? 'R+' : 'D+'}
                  {Math.abs(results.referenceProfile.avgPartisanLean).toFixed(1)}
                </div>
              </div>
            </div>

            {/* Results Table */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('precinctName')}
                    >
                      Precinct {sortField === 'precinctName' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('jurisdiction')}
                    >
                      Jurisdiction {sortField === 'jurisdiction' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('similarityScore')}
                    >
                      Similarity {sortField === 'similarityScore' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead>Top Difference</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedResults.map(match => (
                    <React.Fragment key={match.precinctId}>
                      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => setExpandedRow(expandedRow === match.precinctId ? null : match.precinctId)}>
                        <TableCell className="font-medium">{match.precinctName}</TableCell>
                        <TableCell className="text-muted-foreground">{match.jurisdiction}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <Progress value={match.similarityScore * 100} className="flex-1" />
                              <span className="text-sm font-medium whitespace-nowrap">
                                {(match.similarityScore * 100).toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {match.topDifferences[0] && (
                            <Badge variant={match.topDifferences[0].direction === 'higher' ? 'default' : 'secondary'}>
                              {match.topDifferences[0].feature}: {match.topDifferences[0].direction === 'higher' ? '+' : ''}
                              {match.topDifferences[0].difference.toFixed(1)}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {expandedRow === match.precinctId ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </TableCell>
                      </TableRow>
                      {expandedRow === match.precinctId && (
                        <TableRow>
                          <TableCell colSpan={5} className="bg-muted/30">
                            <div className="p-4 space-y-3">
                              <div className="font-medium">Detailed Similarity Breakdown</div>
                              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                <div className="space-y-1">
                                  <div className="text-xs text-muted-foreground">Demographics</div>
                                  <div className="font-medium">{(match.demographicSimilarity * 100).toFixed(1)}%</div>
                                </div>
                                <div className="space-y-1">
                                  <div className="text-xs text-muted-foreground">Political</div>
                                  <div className="font-medium">{(match.politicalSimilarity * 100).toFixed(1)}%</div>
                                </div>
                                <div className="space-y-1">
                                  <div className="text-xs text-muted-foreground">Electoral</div>
                                  <div className="font-medium">{(match.electoralSimilarity * 100).toFixed(1)}%</div>
                                </div>
                                <div className="space-y-1">
                                  <div className="text-xs text-muted-foreground">Tapestry</div>
                                  <div className="font-medium">{(match.tapestrySimilarity * 100).toFixed(1)}%</div>
                                </div>
                                <div className="space-y-1">
                                  <div className="text-xs text-muted-foreground">Engagement</div>
                                  <div className="font-medium">{(match.engagementSimilarity * 100).toFixed(1)}%</div>
                                </div>
                              </div>
                              <div className="space-y-2 pt-2 border-t">
                                <div className="text-sm font-medium">Key Differences</div>
                                <div className="space-y-1">
                                  {match.topDifferences.slice(0, 3).map((diff, idx) => (
                                    <div key={idx} className="flex items-center justify-between text-sm">
                                      <span className="text-muted-foreground">{diff.feature}</span>
                                      <Badge
                                        variant={diff.direction === 'higher' ? 'default' : 'secondary'}
                                        className="text-xs"
                                      >
                                        Reference: {diff.referenceValue.toFixed(1)} →
                                        Match: {diff.matchValue.toFixed(1)}
                                        ({diff.direction === 'higher' ? '+' : ''}{diff.difference.toFixed(1)})
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
