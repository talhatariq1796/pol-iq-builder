'use client';

import React, { useState, useMemo } from 'react';
import {
  RouteOptimizer,
  type OptimizedRoute,
  type RouteOptions,
  type RouteStop,
  type RoutePrecinctData,
} from '@/lib/canvassing/RouteOptimizer';
import type { CanvassingTurf, CanvassingPrecinct } from '@/lib/canvassing/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  MapPin,
  Navigation,
  Clock,
  Route,
  Footprints,
  Coffee,
  Printer,
  Download,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react';

interface RouteOptimizerPanelProps {
  turfs: CanvassingTurf[];
  precincts: CanvassingPrecinct[];
  className?: string;
  onRouteOptimized?: (route: OptimizedRoute) => void;
}

/**
 * RouteOptimizerPanel
 *
 * Provides route optimization UI for canvassing turfs.
 * Generates optimal walking routes with timing, breaks, and turn-by-turn directions.
 */
export function RouteOptimizerPanel({
  turfs,
  precincts,
  className = '',
  onRouteOptimized,
}: RouteOptimizerPanelProps) {
  const { toast } = useToast();

  // Selection state
  const [selectedTurfId, setSelectedTurfId] = useState<string>('');

  // Route options state
  const [useCustomStart, setUseCustomStart] = useState(false);
  const [startLat, setStartLat] = useState<string>('');
  const [startLng, setStartLng] = useState<string>('');
  const [breakInterval, setBreakInterval] = useState<number>(90);
  const [breakDuration, setBreakDuration] = useState<number>(15);
  const [maxMinutes, setMaxMinutes] = useState<string>('');

  // Results state
  const [optimizedRoute, setOptimizedRoute] = useState<OptimizedRoute | null>(null);
  const [isDirectionsExpanded, setIsDirectionsExpanded] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Build precinct data map for RouteOptimizer
  const precinctDataMap = useMemo(() => {
    const map = new Map<string, RoutePrecinctData>();

    precincts.forEach(p => {
      // Note: We need centroids from precinct GeoJSON data
      // For now, use placeholder - in real implementation, compute from geometry
      const centroid: [number, number] = [-84.55, 42.6]; // Lansing center as fallback

      map.set(p.precinctId, {
        precinctId: p.precinctId,
        precinctName: p.precinctName,
        centroid,
        estimatedDoors: p.estimatedDoors,
        density: 'suburban', // Would come from precinct attributes
        gotvPriority: p.gotvPriority,
        persuasionOpportunity: p.persuasionOpportunity,
      });
    });

    return map;
  }, [precincts]);

  // Get selected turf
  const selectedTurf = useMemo(
    () => turfs.find(t => t.turfId === selectedTurfId),
    [turfs, selectedTurfId]
  );

  // Handle optimization
  const handleOptimize = () => {
    if (!selectedTurf) return;

    setIsOptimizing(true);

    try {
      // Build options
      const options: RouteOptions = {
        startLocation:
          useCustomStart && startLat && startLng
            ? { lat: parseFloat(startLat), lng: parseFloat(startLng) }
            : undefined,
        breakEveryMinutes: breakInterval,
        breakDuration: breakDuration,
        maxMinutes: maxMinutes ? parseInt(maxMinutes, 10) : undefined,
        includeBreaks: true,
      };

      // Get precinct data for this turf
      const turfPrecinctData = selectedTurf.precinctIds
        .map(id => precinctDataMap.get(id))
        .filter((p): p is RoutePrecinctData => p !== undefined);

      // Optimize route
      const route = RouteOptimizer.optimizeRoute(selectedTurf, turfPrecinctData, options);

      setOptimizedRoute(route);
      onRouteOptimized?.(route);
      toast({
        title: 'Route Optimized',
        description: `Generated ${route.stops.length} stops with estimated ${Math.round(route.totalMinutes)} min`,
      });
    } catch (error) {
      console.error('Route optimization failed:', error);
      toast({
        title: 'Route Optimization Failed',
        description: error instanceof Error ? error.message : 'Failed to calculate optimal route',
        variant: 'destructive',
      });
    } finally {
      setIsOptimizing(false);
    }
  };

  // Format time as "X hr Y min"
  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);

    if (hours === 0) {
      return `${mins} min`;
    } else if (mins === 0) {
      return `${hours} hr`;
    } else {
      return `${hours} hr ${mins} min`;
    }
  };

  // Get density badge variant
  const getDensityBadge = (density: string): React.ReactNode => {
    const variants: Record<string, string> = {
      urban: 'bg-blue-500',
      suburban: 'bg-green-500',
      rural: 'bg-amber-500',
    };

    return (
      <Badge className={`${variants[density] || 'bg-gray-500'} text-white`}>
        {density}
      </Badge>
    );
  };

  // Generate turn-by-turn directions
  const directions = useMemo(() => {
    if (!optimizedRoute) return [];
    return RouteOptimizer.generateDirections(optimizedRoute);
  }, [optimizedRoute]);

  // Handle print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Turf Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route className="h-5 w-5" />
            Route Optimizer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="turf-select">Select Turf to Optimize</Label>
              <Select value={selectedTurfId} onValueChange={setSelectedTurfId}>
                <SelectTrigger id="turf-select">
                  <SelectValue placeholder="Choose a turf..." />
                </SelectTrigger>
                <SelectContent>
                  {turfs.map(turf => (
                    <SelectItem key={turf.turfId} value={turf.turfId}>
                      {turf.turfName} ({turf.estimatedDoors} doors, {turf.precinctIds.length}{' '}
                      precincts)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedTurf && (
              <div className="text-sm text-muted-foreground space-y-1">
                <div>Precincts: {selectedTurf.precinctIds.length}</div>
                <div>Est. Doors: {selectedTurf.estimatedDoors.toLocaleString()}</div>
                <div>Est. Hours: {selectedTurf.estimatedHours.toFixed(1)}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Route Options */}
      {selectedTurf && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" />
              Route Options
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Start Location */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={useCustomStart}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUseCustomStart(e.target.checked)}
                  className="rounded"
                />
                Use Custom Start Location
              </Label>

              {useCustomStart && (
                <div className="grid grid-cols-2 gap-3 ml-6">
                  <div>
                    <Label htmlFor="start-lat" className="text-xs">
                      Latitude
                    </Label>
                    <Input
                      id="start-lat"
                      type="number"
                      step="0.0001"
                      placeholder="42.6000"
                      value={startLat}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartLat(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="start-lng" className="text-xs">
                      Longitude
                    </Label>
                    <Input
                      id="start-lng"
                      type="number"
                      step="0.0001"
                      placeholder="-84.5500"
                      value={startLng}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartLng(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Break Interval */}
            <div className="space-y-2">
              <Label>Break Interval: {breakInterval} minutes</Label>
              <Slider
                value={[breakInterval]}
                onValueChange={([val]: number[]) => setBreakInterval(val)}
                min={60}
                max={120}
                step={5}
              />
              <div className="text-xs text-muted-foreground">
                Suggest breaks every {breakInterval} minutes
              </div>
            </div>

            {/* Break Duration */}
            <div className="space-y-2">
              <Label>Break Duration: {breakDuration} minutes</Label>
              <Slider
                value={[breakDuration]}
                onValueChange={([val]: number[]) => setBreakDuration(val)}
                min={10}
                max={20}
                step={5}
              />
            </div>

            <Separator />

            {/* Max Minutes (Optional) */}
            <div>
              <Label htmlFor="max-minutes">Max Route Duration (optional)</Label>
              <Input
                id="max-minutes"
                type="number"
                placeholder="Leave blank for no limit"
                value={maxMinutes}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMaxMinutes(e.target.value)}
              />
              <div className="text-xs text-muted-foreground mt-1">
                Limit route to specific number of minutes
              </div>
            </div>

            {/* Optimize Button */}
            <Button
              onClick={handleOptimize}
              disabled={isOptimizing}
              className="w-full"
              size="lg"
            >
              <Navigation className="mr-2 h-4 w-4" />
              {isOptimizing ? 'Optimizing...' : 'Optimize Route'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Results Panel */}
      {optimizedRoute && (
        <>
          {/* Summary Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Footprints className="h-5 w-5" />
                  Optimized Route
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handlePrint}>
                    <Printer className="h-4 w-4 mr-1" />
                    Print
                  </Button>
                  <Button variant="outline" size="sm" disabled>
                    <Download className="h-4 w-4 mr-1" />
                    GPX
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Total Distance</div>
                  <div className="text-2xl font-bold">
                    {optimizedRoute.totalDistanceKm.toFixed(1)} km
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Est. Time</div>
                  <div className="text-2xl font-bold">
                    {formatTime(optimizedRoute.totalMinutes)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Total Stops</div>
                  <div className="text-2xl font-bold">{optimizedRoute.stops.length}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Doors / km</div>
                  <div className="text-2xl font-bold">
                    {optimizedRoute.totalDistanceKm > 0
                      ? Math.round(optimizedRoute.totalDoors / optimizedRoute.totalDistanceKm)
                      : 0}
                  </div>
                </div>
              </div>

              {optimizedRoute.breakSuggestions.length > 0 && (
                <div className="mt-4 flex items-center gap-2 text-sm">
                  <Coffee className="h-4 w-4" />
                  <span className="font-medium">
                    {optimizedRoute.breakSuggestions.length} break
                    {optimizedRoute.breakSuggestions.length !== 1 ? 's' : ''} suggested
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Route Stops Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Route Stops</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Precinct</TableHead>
                      <TableHead className="text-right">Doors</TableHead>
                      <TableHead className="text-right">Est. Time</TableHead>
                      <TableHead className="text-right">Cumulative</TableHead>
                      <TableHead>Density</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {optimizedRoute.stops.map((stop, idx) => {
                      // Check if there's a break after this stop
                      const breakAfter = optimizedRoute.breakSuggestions.find(
                        b => b.afterStop === stop.order
                      );

                      return (
                        <React.Fragment key={stop.precinctId}>
                          <TableRow>
                            <TableCell className="font-medium">{stop.order}</TableCell>
                            <TableCell>
                              <div>{stop.precinctName}</div>
                              {stop.tips.length > 0 && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {stop.tips.join(' • ')}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {stop.estimatedDoors.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatTime(stop.estimatedMinutes)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatTime(stop.cumulativeMinutes)}
                            </TableCell>
                            <TableCell>{getDensityBadge(stop.density)}</TableCell>
                          </TableRow>

                          {/* Break row */}
                          {breakAfter && (
                            <TableRow className="bg-amber-50">
                              <TableCell colSpan={6} className="text-center py-3">
                                <div className="flex items-center justify-center gap-2 text-amber-700">
                                  <Coffee className="h-4 w-4" />
                                  <span className="font-medium">
                                    Break ({breakAfter.durationMinutes} min)
                                  </span>
                                  <span className="text-sm">- {breakAfter.reason}</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Route Tips */}
          {optimizedRoute.routeTips.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Route Tips
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {optimizedRoute.routeTips.map((tip, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <span className="text-muted-foreground mt-0.5">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Turn-by-Turn Directions (Collapsible) */}
          <Card>
            <CardHeader
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setIsDirectionsExpanded(!isDirectionsExpanded)}
            >
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Turn-by-Turn Directions
                </span>
                {isDirectionsExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </CardTitle>
            </CardHeader>

            {isDirectionsExpanded && (
              <CardContent>
                <div className="space-y-1 text-sm font-mono whitespace-pre-wrap">
                  {directions.map((line, idx) => (
                    <div key={idx} className={line === '' ? 'h-2' : ''}>
                      {line}
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        </>
      )}

      {/* Empty State */}
      {!selectedTurf && turfs.length === 0 && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <Route className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No turfs available for route optimization.</p>
              <p className="text-sm mt-1">Create turfs from your canvassing universe first.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
