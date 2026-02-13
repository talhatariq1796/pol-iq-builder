'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { DonorDashboard } from '@/components/donor/DonorDashboard';
import { AppNavigation } from '@/components/navigation/AppNavigation';
import UnifiedAIAssistant from '@/components/ai-native/UnifiedAIAssistant';
import CollapsibleAIPanel from '@/components/ai-native/CollapsibleAIPanel';
import MapToggleButton from '@/components/map/MapToggleButton';
import { HelpDialog, donorsHelp, donorsTutorials } from '@/components/help';
import type { MapCommand } from '@/lib/ai-native/types';
import { useToolUrlParams } from '@/lib/ai-native/hooks/useToolUrlParams';
import { getStateManager } from '@/lib/ai-native/ApplicationStateManager';
import { ErrorBoundary } from '@/components/ErrorBoundary';

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

function DonorsPageContent() {
  const [mapCommand, setMapCommand] = useState<MapCommand | null>(null);
  const [selectedPrecinct, setSelectedPrecinct] = useState<PrecinctInfo | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const { params } = useToolUrlParams();
  const stateManager = getStateManager();

  // Apply URL parameters on mount (enhanced with cross-tool context - Wave 4B #10)
  useEffect(() => {
    // Set current tool
    stateManager.setCurrentTool('donors');

    // Check for cross-tool navigation context from session storage
    const navSource = sessionStorage.getItem('pol_nav_source');
    const navPrecincts = sessionStorage.getItem('pol_nav_precincts');
    const navTimestamp = sessionStorage.getItem('pol_nav_timestamp');

    // Check if context is fresh (within last 2 hours)
    const isContextFresh = navTimestamp && (Date.now() - parseInt(navTimestamp)) < 2 * 60 * 60 * 1000;

    // Note: Donors page doesn't use precincts directly, but we track the context
    if (navSource && navPrecincts && isContextFresh) {
      try {
        const storedPrecincts = JSON.parse(navPrecincts);
        if (Array.isArray(storedPrecincts) && storedPrecincts.length > 0) {
          console.log(`[DonorsPage] Navigated from ${navSource} with ${storedPrecincts.length} precincts`);

          // Clear context after successful restoration to prevent stale reuse
          sessionStorage.removeItem('pol_nav_source');
          sessionStorage.removeItem('pol_nav_precincts');
          sessionStorage.removeItem('pol_nav_timestamp');
        }
      } catch (error) {
        console.warn('[DonorsPage] Failed to parse nav context:', error);
        // Clear corrupted context
        sessionStorage.removeItem('pol_nav_source');
        sessionStorage.removeItem('pol_nav_precincts');
        sessionStorage.removeItem('pol_nav_timestamp');
      }
    }

    // If zips param exists, filter to those ZIP codes
    if (params.zips && params.zips.length > 0) {
      // Update state manager context
      stateManager.updateToolContext('donors', {
        selectedZips: params.zips,
      });

      // Queue map command but don't auto-show - user must click "Show Map" button
      setMapCommand({
        type: 'showHeatmap',
        metric: 'donor_concentration',
        ids: params.zips,
      });

      // Log exploration
      stateManager.logExploration({
        tool: 'donors',
        action: navSource ? 'cross_tool_navigation' : 'url_navigation',
        metadata: { zips: params.zips, source: navSource || 'url_params' },
      });
    }

    // If view param exists, set active view
    if (params.view) {
      stateManager.updateToolContext('donors', {
        activeView: params.view,
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
  }, [params.zips, params.view, stateManager]);

  const handleMapCommand = (command: MapCommand) => {
    setMapCommand(command);
    // Don't auto-show map - user must click "Show Map" button
    // Map commands will be queued and applied when map is shown
  };

  const handlePrecinctSelected = (precinct: PrecinctInfo | null) => {
    setSelectedPrecinct(precinct);
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--theme-bg-primary, #f8f8f8)' }}>
      {/* Help Dialog */}
      <HelpDialog
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        title="Donor Analysis"
        subtitle="FEC contribution patterns"
        sections={donorsHelp}
        tutorials={donorsTutorials}
        footerText="Got it, let's analyze donors!"
        toolContext="donors"
      />

      {/* Navigation Sidebar */}
      <div className="w-14 h-full flex-shrink-0 relative z-50">
        <AppNavigation variant="sidebar" />
      </div>

      {/* AI Assistant Panel (Left, Collapsible) */}
      <CollapsibleAIPanel
        position="left"
        defaultCollapsed={false}
        expandedWidth={400}
        storageKey="donors-ai-panel-collapsed"
      >
        <UnifiedAIAssistant
          toolContext="donors"
          onMapCommand={handleMapCommand}
          selectedPrecinct={selectedPrecinct}
        />
      </CollapsibleAIPanel>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-background">
        <div className="container mx-auto py-6 px-4">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Donor Analysis</h1>
            <p className="text-muted-foreground">
              Visualize contribution patterns, segment donors by RFM, and identify high-potential areas
            </p>
          </div>
          <DonorDashboard onMapCommand={handleMapCommand} />
        </div>
      </main>

      {/* Map Panel (Right, Collapsible) - Always rendered, controlled by collapsed state */}
      {/* Wave 7: Increased width to 70% for better map usability as reference */}
      <SharedMapPanel
        mapCommand={mapCommand}
        onPrecinctSelected={handlePrecinctSelected}
        position="right"
        expandedWidth="70%"
        collapsed={!showMap}
        onToggle={() => setShowMap(!showMap)}
      />
    </div>
  );
}

export default function DonorsPage() {
  return (
    <ErrorBoundary fallbackTitle="Donor Analysis Error">
      <React.Suspense fallback={
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
            <p className="text-gray-600 text-sm">Loading...</p>
          </div>
        </div>
      }>
        <DonorsPageContent />
      </React.Suspense>
    </ErrorBoundary>
  );
}
