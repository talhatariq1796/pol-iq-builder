'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { CanvassingPlanner } from '@/components/canvassing/CanvassingPlanner';
import { AppNavigation } from '@/components/navigation/AppNavigation';
import UnifiedAIAssistant from '@/components/ai-native/UnifiedAIAssistant';
import CollapsibleAIPanel from '@/components/ai-native/CollapsibleAIPanel';
import MapToggleButton from '@/components/map/MapToggleButton';
import { HelpDialog, canvassHelp } from '@/components/help';
import { Play, Filter, Map, X, Route, Target, MapPin } from 'lucide-react';
import type { MapCommand } from '@/lib/ai-native/types';
import { useToolUrlParams } from '@/lib/ai-native/hooks/useToolUrlParams';
import { getStateManager } from '@/lib/ai-native/ApplicationStateManager';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { segmentStore } from '@/lib/segmentation/SegmentStore';
import { politicalDataService } from '@/lib/services/PoliticalDataService';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Dynamic import to prevent SSR issues with ArcGIS/ResizeObserver
const SharedMapPanel = dynamic(
  () => import('@/components/map/SharedMapPanel'),
  { ssr: false }
);

interface PrecinctInfo {
  precinctId: string;
  precinctName: string;
  county: string;
  attributes?: Record<string, unknown>;
}

function CanvassPageContent() {
  const [mapCommand, setMapCommand] = useState<MapCommand | null>(null);
  const [selectedPrecinct, setSelectedPrecinct] = useState<PrecinctInfo | null>(null);
  // Map should only show when user clicks "Show Map" button
  const [showMap, setShowMap] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [hasUniverse, setHasUniverse] = useState(false);
  const [showSegmentSelector, setShowSegmentSelector] = useState(false);
  const { params } = useToolUrlParams();
  const stateManager = getStateManager();
  const { toast } = useToast();

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Check if universe exists based on state manager context
  useEffect(() => {
    const canvassContext = stateManager.getToolContexts().canvass;
    const hasTurfs = canvassContext.turfs && canvassContext.turfs.length > 0;
    const hasPrecincts = canvassContext.targetPrecincts && canvassContext.targetPrecincts.length > 0;
    setHasUniverse(hasTurfs || hasPrecincts);
  }, [stateManager]);

  // Apply URL parameters on mount (enhanced with cross-tool context - Wave 4B #10)
  useEffect(() => {
    // Set current tool
    stateManager.setCurrentTool('canvass');

    // Check for cross-tool navigation context from session storage
    const navSource = sessionStorage.getItem('pol_nav_source');
    const navPrecincts = sessionStorage.getItem('pol_nav_precincts');
    const navTimestamp = sessionStorage.getItem('pol_nav_timestamp');

    let precinctsToUse: string[] = params.precincts || [];

    // Check if context is fresh (within last 2 hours)
    const isContextFresh = navTimestamp && (Date.now() - parseInt(navTimestamp)) < 2 * 60 * 60 * 1000;

    // If navigated from another tool and context is fresh, restore context
    if (navSource && navPrecincts && isContextFresh && precinctsToUse.length === 0) {
      try {
        const storedPrecincts = JSON.parse(navPrecincts);
        if (Array.isArray(storedPrecincts) && storedPrecincts.length > 0) {
          precinctsToUse = storedPrecincts;
          console.log(`[CanvassPage] Restored ${precinctsToUse.length} precincts from ${navSource}`);

          // Clear context after successful restoration to prevent stale reuse
          sessionStorage.removeItem('pol_nav_source');
          sessionStorage.removeItem('pol_nav_precincts');
          sessionStorage.removeItem('pol_nav_timestamp');
        }
      } catch (error) {
        console.warn('[CanvassPage] Failed to parse nav context:', error);
        // Clear corrupted context
        sessionStorage.removeItem('pol_nav_source');
        sessionStorage.removeItem('pol_nav_precincts');
        sessionStorage.removeItem('pol_nav_timestamp');
      }
    }

    // If segment param exists, load that segment as universe
    if (params.segment) {
      // Update state manager context
      stateManager.updateToolContext('canvass', {
        turfs: [], // Will be populated when segment loads
        targetPrecincts: [],
      });

      // Log exploration
      stateManager.logExploration({
        tool: 'canvass',
        action: 'load_segment',
        metadata: { segment: params.segment, source: navSource || 'url_params' },
      });

      console.log('[CanvassPage] Loading segment as universe:', params.segment);
    }

    // If precincts exist (from URL or session), use as initial selection
    if (precinctsToUse.length > 0) {
      setMapCommand({
        type: 'highlight',
        ids: precinctsToUse,
      });

      stateManager.updateToolContext('canvass', {
        targetPrecincts: precinctsToUse,
        turfs: [],
      });

      // Log exploration
      stateManager.logExploration({
        tool: 'canvass',
        action: navSource ? 'cross_tool_navigation' : 'url_navigation',
        precinctIds: precinctsToUse,
        metadata: { source: navSource || 'url_params' },
      });
    }

    // P2 Fix: Restore map state from previous tool
    const { CrossToolNavigator } = require('@/lib/ai-native/navigation/CrossToolNavigator');
    const restoredMapState = CrossToolNavigator.restoreMapState();
    if (restoredMapState) {
      CrossToolNavigator.applyRestoredMapState(restoredMapState);
      // If there's a visualization to restore, queue it as a map command
      if (restoredMapState.layer === 'heatmap' && restoredMapState.metric) {
        setMapCommand({
          type: 'showHeatmap',
          metric: restoredMapState.metric,
        });
      } else if (restoredMapState.layer === 'choropleth') {
        setMapCommand({
          type: 'showChoropleth',
        });
      }
    }
  }, [params.segment, params.precincts, stateManager]);

  const handleMapCommand = (command: MapCommand) => {
    setMapCommand(command);
    // Don't auto-show map - user must click "Show Map" button
    // Map commands will be queued and applied when map is shown
  };

  const handlePrecinctSelected = (precinct: PrecinctInfo | null) => {
    setSelectedPrecinct(precinct);
  };

  const handleLoadSegment = () => {
    const segments = segmentStore.getAll();

    if (segments.length === 0) {
      toast({
        title: 'No saved segments',
        description: 'Create and save a segment first in the Segments tool',
        variant: 'destructive'
      });
      return;
    }

    setShowSegmentSelector(true);
  };

  const handleSegmentSelected = (segmentId: string) => {
    const segment = segmentStore.getById(segmentId);

    if (!segment) {
      toast({
        title: 'Segment not found',
        description: 'The selected segment could not be loaded',
        variant: 'destructive'
      });
      return;
    }

    // Load the segment's matching precincts as canvassing universe
    const cachedResults = segment.cachedResults;
    const precinctIds = cachedResults?.matchingPrecincts?.map(p => p.precinctId) || [];

    if (precinctIds.length === 0) {
      toast({
        title: 'Empty segment',
        description: 'This segment has no matching precincts',
        variant: 'destructive'
      });
      return;
    }

    // Update state manager context
    stateManager.updateToolContext('canvass', {
      targetPrecincts: precinctIds,
      turfs: [],
    });

    // Highlight precincts on map
    setMapCommand({
      type: 'highlight',
      ids: precinctIds,
    });

    // Show map if hidden
    if (!showMap) {
      setShowMap(true);
    }

    // Update universe state
    setHasUniverse(true);
    setShowSegmentSelector(false);

    // Log exploration
    stateManager.logExploration({
      tool: 'canvass',
      action: 'load_segment',
      result: `Loaded segment "${segment.name}" with ${precinctIds.length} precincts`,
      metadata: {
        segmentId: segment.id,
        segmentName: segment.name,
        precinctCount: precinctIds.length
      },
    });

    toast({
      title: 'Segment loaded',
      description: `Loaded "${segment.name}" with ${precinctIds.length} precincts`
    });
  };

  const handleStartCanvassing = async () => {
    console.log('[CanvassPage] Starting canvassing route');

    // Get canvassing context from state manager
    const canvassingContext = stateManager.getToolContexts().canvass;

    // Check if there are any turfs or target precincts
    const hasTurfs = canvassingContext.turfs && canvassingContext.turfs.length > 0;
    const hasPrecincts = canvassingContext.targetPrecincts && canvassingContext.targetPrecincts.length > 0;

    if (!hasTurfs && !hasPrecincts) {
      toast({
        title: 'No canvassing universe selected',
        description: 'Create or load a canvassing universe first to start a route',
        variant: 'destructive'
      });
      return;
    }

    // Show loading toast
    toast({
      title: 'Preparing export...',
      description: 'Loading precinct coordinates'
    });

    // Count total doors from turfs or estimate from precincts
    let totalDoors = 0;
    let routeData: Array<{ name: string; address: string; lat: number; lng: number; phone: string; notes: string }> = [];

    // Ingham County center as fallback
    const INGHAM_CENTER: [number, number] = [-84.55, 42.60];

    if (hasTurfs) {
      // Calculate total doors from turfs
      totalDoors = canvassingContext.turfs.reduce((sum, turf) => {
        const doors = (turf as { doorCount?: number }).doorCount || 0;
        return sum + doors;
      }, 0);

      // Create MiniVAN format data with real coordinates
      routeData = await Promise.all(canvassingContext.turfs.map(async (turf, index) => {
        const turfName = (turf as { name?: string }).name || `Turf ${index + 1}`;
        const precinctIds = (turf as { precinctIds?: string[] }).precinctIds || [];

        // Get centroid from first precinct in turf, or use Ingham County center
        let coords = INGHAM_CENTER;
        if (precinctIds.length > 0) {
          try {
            coords = await politicalDataService.getPrecinctCentroid(precinctIds[0]);
          } catch (e) {
            console.warn(`[CanvassPage] Could not get centroid for ${precinctIds[0]}, using fallback`);
          }
        }

        return {
          name: `Turf ${index + 1}`,
          address: turfName,
          lat: coords[1], // GeoJSON is [lng, lat], need lat
          lng: coords[0], // GeoJSON is [lng, lat], need lng
          phone: '',
          notes: `Estimated ${(turf as { doorCount?: number }).doorCount || 0} doors`
        };
      }));
    } else if (hasPrecincts) {
      // Load precinct data to get estimated doors (returns Record<string, UnifiedPrecinct>)
      const precinctDataMap = await politicalDataService.getUnifiedPrecinctData();

      // Create route data with real coordinates
      routeData = await Promise.all(canvassingContext.targetPrecincts.map(async (precinctId) => {
        // Get centroid for this precinct
        let coords = INGHAM_CENTER;
        try {
          coords = await politicalDataService.getPrecinctCentroid(precinctId);
        } catch (e) {
          console.warn(`[CanvassPage] Could not get centroid for ${precinctId}, using fallback`);
        }

        // Find precinct data for door estimate - search by key or by property values
        const precinct = precinctDataMap[precinctId]
          ?? Object.values(precinctDataMap).find(p =>
            p.id === precinctId ||
            p.name === precinctId ||
            p.name.toLowerCase().replace(/\s+/g, '-') === precinctId.toLowerCase()
          );

        const estimatedDoors = precinct?.demographics?.registeredVoters
          ? Math.round(precinct.demographics.registeredVoters * 0.6) // Estimate ~60% as reachable doors
          : 100;

        totalDoors += estimatedDoors;

        return {
          name: precinctId,
          address: precinct?.name || `Precinct ${precinctId}`,
          lat: coords[1], // GeoJSON is [lng, lat], need lat
          lng: coords[0], // GeoJSON is [lng, lat], need lng
          phone: '',
          notes: `Estimated ${estimatedDoors} doors`
        };
      }));
    }

    // Generate CSV content in MiniVAN format
    const csvHeaders = 'Name,Address,Lat,Lng,Phone,Notes\n';
    const csvRows = routeData.map(row =>
      `"${row.name}","${row.address}",${row.lat.toFixed(6)},${row.lng.toFixed(6)},"${row.phone}","${row.notes}"`
    ).join('\n');
    const csvContent = csvHeaders + csvRows;

    // Create and download the CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `canvassing-route-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Show success toast
    toast({
      title: 'Route exported',
      description: `Downloaded canvassing list with ${totalDoors > 0 ? totalDoors : routeData.length} estimated doors`
    });

    // Log exploration
    stateManager.logExploration({
      tool: 'canvass',
      action: 'export_route',
      result: `Exported ${routeData.length} locations`,
      metadata: { doorCount: totalDoors, format: 'minivan_csv' }
    });
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden" style={{ backgroundColor: 'var(--theme-bg-primary, #f8f8f8)' }}>
      {/* Help Dialog */}
      <HelpDialog
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        title="Canvassing Planner"
        subtitle="Door-knocking optimization"
        sections={canvassHelp}
        footerText="Got it, let's plan canvassing!"
        toolContext="canvass"
      />

      {/* Navigation Sidebar - Hidden on mobile, vertical bar on desktop */}
      <div className="hidden lg:flex w-14 h-full flex-shrink-0 relative z-50">
        <AppNavigation variant="sidebar" />
      </div>

      {/* AI Panel - Full width on mobile, collapsible sidebar on desktop */}
      <div className={`${isMobile ? 'w-full border-b' : 'w-auto'}`}>
        <CollapsibleAIPanel
          position="left"
          defaultCollapsed={isMobile}
          expandedWidth={isMobile ? '100%' : 400}
          storageKey="canvass-ai-panel-collapsed"
        >
          <UnifiedAIAssistant
            toolContext="canvass"
            onMapCommand={handleMapCommand}
            selectedPrecinct={selectedPrecinct}
          />
        </CollapsibleAIPanel>
      </div>

      {/* Main Content - Canvassing Planner */}
      <main className="flex-1 overflow-auto bg-background pb-20 lg:pb-0">
        <div className="container mx-auto py-4 lg:py-6 px-3 lg:px-4">
          <div className="mb-4 lg:mb-6">
            <h1 className="text-xl lg:text-2xl font-bold">Canvassing Planner</h1>
            <p className="text-sm lg:text-base text-muted-foreground">
              Build universes, optimize routes, and manage door-knocking operations
            </p>
          </div>

          {!hasUniverse ? (
            <Card className="max-w-2xl mx-auto mt-12">
              <CardContent className="text-center py-12 px-6">
                <Route className="h-16 w-16 mx-auto mb-6 text-muted-foreground" />
                <h2 className="text-2xl font-semibold mb-3">Plan Your Canvassing Routes</h2>
                <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
                  Build optimized walking routes for door-to-door voter contact. Start by selecting a universe or importing a list.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto">
                  <Button
                    variant="outline"
                    className="h-auto py-4 px-6 flex flex-col items-center gap-2"
                    onClick={handleLoadSegment}
                  >
                    <Target className="h-6 w-6" />
                    <div className="text-sm font-semibold">From Saved Segment</div>
                    <div className="text-xs text-muted-foreground">Load a voter segment</div>
                  </Button>

                  <Button
                    variant="outline"
                    className="h-auto py-4 px-6 flex flex-col items-center gap-2"
                    onClick={() => setHasUniverse(true)}
                  >
                    <MapPin className="h-6 w-6" />
                    <div className="text-sm font-semibold">Select on Map</div>
                    <div className="text-xs text-muted-foreground">Draw or click precincts</div>
                  </Button>
                </div>

                <p className="text-sm text-muted-foreground mt-6">
                  Or ask the AI: "Create a canvassing plan for high GOTV areas"
                </p>
              </CardContent>
            </Card>
          ) : (
            <CanvassingPlanner />
          )}
        </div>
      </main>

      {/* Map Panel - Always rendered, controlled by collapsed state
          Full screen overlay on mobile, right sidebar on desktop */}
      {!isMobile ? (
        // Desktop: Always show SharedMapPanel with collapse control
        // Wave 7: Increased width to 70% for better map usability as reference
        <SharedMapPanel
          mapCommand={mapCommand}
          onPrecinctSelected={handlePrecinctSelected}
          position="right"
          expandedWidth="70%"
          collapsed={!showMap}
          onToggle={() => setShowMap(!showMap)}
        />
      ) : (
        // Mobile: Full screen overlay when shown
        showMap && (
          <div className="fixed inset-0 z-40 bg-white">
            <div className="p-3 border-b flex justify-between items-center bg-white">
              <h3 className="font-medium">Map View</h3>
              <button
                onClick={() => setShowMap(false)}
                className="p-2 hover:bg-gray-100 rounded-lg touch-manipulation"
                aria-label="Close map"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <SharedMapPanel
              mapCommand={mapCommand}
              onPrecinctSelected={handlePrecinctSelected}
              position="right"
              expandedWidth="100%"
              collapsed={false}
            />
          </div>
        )
      )}

      {/* Mobile Action Bar - Only visible on mobile */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-3 flex gap-2 z-50">
          <button
            className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 touch-manipulation active:bg-green-700 min-h-[48px]"
            onClick={handleStartCanvassing}
            aria-label="Start canvassing route"
          >
            <Play className="w-5 h-5" />
            <span>Start Route</span>
          </button>
          <button
            className="px-4 py-3 bg-gray-100 rounded-lg touch-manipulation active:bg-gray-200 min-h-[48px]"
            onClick={() => setShowFilters(!showFilters)}
            aria-label="Toggle filters"
          >
            <Filter className="w-5 h-5" />
          </button>
          <button
            className="px-4 py-3 bg-gray-100 rounded-lg touch-manipulation active:bg-gray-200 min-h-[48px]"
            onClick={() => setShowMap(!showMap)}
            aria-label="Toggle map view"
          >
            <Map className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Segment Selector Dialog */}
      <Dialog open={showSegmentSelector} onOpenChange={setShowSegmentSelector}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Load Saved Segment</DialogTitle>
            <DialogDescription>
              Select a saved segment to use as your canvassing universe
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select onValueChange={handleSegmentSelected}>
              <SelectTrigger>
                <SelectValue placeholder="Select a segment..." />
              </SelectTrigger>
              <SelectContent>
                {segmentStore.getAll().map((segment) => (
                  <SelectItem key={segment.id} value={segment.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{segment.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {segment.cachedResults?.matchingPrecincts?.length || 0} precincts
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CanvassPage() {
  return (
    <ErrorBoundary fallbackTitle="Canvassing Planner Error">
      <React.Suspense fallback={
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
            <p className="text-gray-600 text-sm">Loading...</p>
          </div>
        </div>
      }>
        <CanvassPageContent />
      </React.Suspense>
    </ErrorBoundary>
  );
}
