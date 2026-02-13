'use client';

/**
 * Knowledge Graph Page
 * Interactive knowledge graph visualization with AI chat integration
 *
 * This page fetches REAL data from the knowledge graph API, not hardcoded samples.
 * It displays all Ingham County jurisdictions, precincts, candidates, and relationships.
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { KnowledgeGraphViewer } from '@/components/knowledge-graph';
import UnifiedAIAssistant from '@/components/ai-native/UnifiedAIAssistant';
import { AppNavigation } from '@/components/navigation/AppNavigation';
import { HelpDialog, HelpButton, knowledgeGraphHelp, knowledgeGraphTutorials } from '@/components/help';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import MapToggleButton from '@/components/map/MapToggleButton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Entity, Relationship } from '@/lib/knowledge-graph/types';
import type { MapCommand } from '@/lib/ai-native/types';

const SharedMapPanel = dynamic(
  () => import('@/components/map/SharedMapPanel'),
  { ssr: false }
);

interface GraphStats {
  entityCount: number;
  relationshipCount: number;
  entitiesByType: Record<string, number>;
  relationshipsByType: Record<string, number>;
}

interface ApiResponse {
  success: boolean;
  entities?: Entity[];
  relationships?: Relationship[];
  stats?: GraphStats;
}

function KnowledgeGraphPageContent() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [mapCommand, setMapCommand] = useState<MapCommand | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [triggerAIQuery, setTriggerAIQuery] = useState<string | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  // Get unique entity types
  const entityTypes = useMemo(() => {
    const types = new Set(entities.map((e) => e.type));
    return Array.from(types).sort();
  }, [entities]);

  // Filter entities based on search query and selected types
  const filteredEntities = useMemo(() => {
    let filtered = entities;

    // Apply type filter
    if (selectedTypes.length > 0) {
      filtered = filtered.filter((entity) => selectedTypes.includes(entity.type));
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((entity) => {
        // Search by name
        if (entity.name.toLowerCase().includes(query)) {
          return true;
        }
        // Search by type
        if (entity.type.toLowerCase().includes(query)) {
          return true;
        }
        // Search by ID
        if (entity.id.toLowerCase().includes(query)) {
          return true;
        }
        // Search in metadata if available
        if (entity.metadata) {
          const metadataStr = JSON.stringify(entity.metadata).toLowerCase();
          if (metadataStr.includes(query)) {
            return true;
          }
        }
        return false;
      });
    }

    return filtered;
  }, [entities, searchQuery, selectedTypes]);

  // Filter relationships to only show those connected to filtered entities
  const filteredRelationships = useMemo(() => {
    if (!searchQuery.trim() && selectedTypes.length === 0) {
      return relationships;
    }

    const filteredEntityIds = new Set(filteredEntities.map((e) => e.id));
    return relationships.filter(
      (rel) => filteredEntityIds.has(rel.sourceId) && filteredEntityIds.has(rel.targetId)
    );
  }, [relationships, filteredEntities, searchQuery, selectedTypes]);

  // Map command handler for AI integration
  const handleMapCommand = useCallback((command: MapCommand) => {
    console.log('[KnowledgeGraphPage] Map command received:', command);
    setShowMap(true);
    setMapCommand(command);
  }, []);

  // Fetch graph data from API
  const fetchGraphData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all entities AND relationships using the 'all' action
      const response = await fetch('/api/knowledge-graph?action=all');
      const data: ApiResponse = await response.json();

      if (data.success) {
        setEntities(data.entities || []);
        setRelationships(data.relationships || []);
        if (data.stats) {
          setStats(data.stats);
        }
      } else {
        throw new Error('Failed to fetch graph data');
      }

      setLoading(false);
    } catch (err) {
      console.error('[KnowledgeGraphPage] Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load knowledge graph');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGraphData();
  }, [fetchGraphData]);

  const handleNodeSelect = (entity: Entity) => {
    setSelectedEntity(entity);
  };

  const handleExploreRequest = useCallback((entityId: string, query: string) => {
    console.log('[KnowledgeGraphPage] Explore request:', entityId, query);
    // Trigger the AI to process this query
    setTriggerAIQuery(query);
  }, []);

  const handleQueryProcessed = useCallback(() => {
    // Clear the trigger after it's been processed
    setTriggerAIQuery(null);
  }, []);

  const handleRefresh = () => {
    fetchGraphData();
  };

  const toggleType = (type: string) => {
    setSelectedTypes((prev: string[]) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const clearTypeFilters = () => {
    setSelectedTypes([]);
  };

  // Export to CSV
  const exportToCSV = useCallback(() => {
    // CSV header
    const headers = ['ID', 'Name', 'Type', 'Aliases', 'Metadata'];

    // Escape double quotes in fields
    const escapeField = (field: string) => {
      if (field.includes(',') || field.includes('"') || field.includes('\n')) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };

    // CSV rows
    const rows = filteredEntities.map((entity) => {
      const aliases = entity.aliases ? entity.aliases.join('; ') : '';
      const metadata = JSON.stringify(entity.metadata || {});

      return [
        escapeField(entity.id),
        escapeField(entity.name),
        escapeField(entity.type),
        escapeField(aliases),
        escapeField(metadata)
      ].join(',');
    });

    // Combine header and rows
    const csvContent = [headers.join(','), ...rows].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `knowledge-graph-entities-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [filteredEntities]);

  // Export to JSON
  const exportToJSON = useCallback(() => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      summary: {
        totalEntities: filteredEntities.length,
        totalRelationships: filteredRelationships.length,
        entitiesByType: stats?.entitiesByType || {},
        relationshipsByType: stats?.relationshipsByType || {}
      },
      entities: filteredEntities,
      relationships: filteredRelationships
    };

    const jsonContent = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `knowledge-graph-${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [filteredEntities, filteredRelationships, stats]);

  // Render loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#33a852] mx-auto mb-4"></div>
          <p className="text-slate-600">Loading knowledge graph...</p>
          <p className="text-sm text-slate-400 mt-2">Initializing entities and relationships</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-lg shadow-sm border border-red-200">
          <div className="text-red-500 text-4xl mb-4">!</div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Error Loading Graph</h2>
          <p className="text-slate-600 mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-[#33a852] text-white rounded-lg hover:bg-[#2d9944] transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <React.Fragment>
      {/* Help Dialog */}
      <HelpDialog
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        title="Knowledge Graph Help"
        subtitle="Interactive political entity visualization"
        sections={knowledgeGraphHelp}
        tutorials={knowledgeGraphTutorials}
        footerText="Got it, let's explore!"
        toolContext="knowledge-graph"
      />

      <div className="h-screen bg-slate-100 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <div className="w-14 h-full flex-shrink-0 relative z-50">
          <AppNavigation variant="sidebar" />
        </div>

        {/* AI Assistant Panel */}
        <div className="w-96 h-full border-r border-slate-200 bg-white flex-shrink-0">
          <UnifiedAIAssistant
            toolContext="knowledge-graph"
            onMapCommand={handleMapCommand}
            triggerQuery={triggerAIQuery}
            onQueryProcessed={handleQueryProcessed}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col h-full relative overflow-hidden">
          {/* Header */}
          <div className="bg-white border-b border-slate-200 px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Knowledge Graph Visualization</h1>
                <p className="text-sm text-slate-500 mt-1">
                  Interactive force-directed graph of political entities and relationships in Ingham County
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Export Buttons */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToCSV}
                  className="flex items-center gap-1.5"
                  title="Export entities as CSV"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToJSON}
                  className="flex items-center gap-1.5"
                  title="Export full graph data as JSON"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export JSON
                </Button>
                {/* Help Button */}
                <HelpButton onClick={() => setShowHelp(true)} />
                {/* Refresh Button */}
                <button
                  onClick={handleRefresh}
                  className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-2"
                >
                  <span>↻</span> Refresh
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="flex items-center gap-3">
              <div className="flex-1 max-w-md">
                <Input
                  type="text"
                  placeholder="Search entities by name, type, or ID..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>
              {(searchQuery || selectedTypes.length > 0) && (
                <div className="text-sm text-slate-600">
                  Found <span className="font-semibold text-[#33a852]">{filteredEntities.length}</span> of {entities.length} entities
                </div>
              )}
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Clear Search
                </button>
              )}
            </div>

            {/* Entity Type Filters */}
            {entityTypes.length > 0 && (
              <div className="mt-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-slate-600 font-medium">Filter by type:</span>
                  {entityTypes.map((type) => (
                    <Button
                      key={type}
                      variant={selectedTypes.includes(type) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleType(type)}
                      className="capitalize"
                    >
                      {type}
                      {selectedTypes.includes(type) && stats?.entitiesByType[type] && (
                        <span className="ml-1 opacity-80">({stats.entitiesByType[type]})</span>
                      )}
                    </Button>
                  ))}
                  {selectedTypes.length > 0 && (
                    <button
                      onClick={clearTypeFilters}
                      className="ml-2 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Main content with map panel */}
          <div className="flex-1 flex">
            {/* Graph content area */}
            <div className={`flex-1 p-6 transition-all duration-300 ${showMap ? 'w-2/3' : 'w-full'}`}>
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
                {/* Graph viewer */}
                <div className="lg:col-span-3">
                  <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden h-full">
                    <KnowledgeGraphViewer
                      entities={filteredEntities}
                      relationships={filteredRelationships}
                      onNodeSelect={handleNodeSelect}
                      onExploreRequest={handleExploreRequest}
                      height={600}
                      showLabels={true}
                      showLegend={true}
                    />
                  </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-4">
                  {/* Instructions - now with help link */}
                  <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-slate-800">Quick Start</h3>
                      <button
                        onClick={() => setShowHelp(true)}
                        className="text-xs text-[#33a852] hover:underline"
                      >
                        Full guide
                      </button>
                    </div>
                    <ul className="text-sm text-slate-600 space-y-1.5">
                      <li>• <strong>Click</strong> nodes to select</li>
                      <li>• <strong>Drag</strong> to reposition</li>
                      <li>• <strong>Scroll</strong> to zoom</li>
                      <li>• <strong>AI chat</strong> for questions</li>
                    </ul>
                  </div>

                  {/* Selected entity details */}
                  {selectedEntity && (
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                      <h3 className="font-semibold text-slate-800 mb-2">Selected Entity</h3>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-slate-500">Name:</span>
                          <span className="ml-2 font-medium">{selectedEntity.name}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Type:</span>
                          <span className="ml-2 capitalize">{selectedEntity.type}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">ID:</span>
                          <span className="ml-2 font-mono text-xs">{selectedEntity.id}</span>
                        </div>
                        {selectedEntity.metadata && Object.keys(selectedEntity.metadata).length > 0 && (
                          <div className="mt-3 pt-3 border-t border-slate-100">
                            <span className="text-slate-500 block mb-2">Metadata:</span>
                            <div className="space-y-1.5">
                              {Object.entries(selectedEntity.metadata).map(([key, value]) => (
                                <div key={key} className="text-xs">
                                  <span className="text-slate-500">• {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</span>
                                  <span className="ml-2 font-medium text-slate-700">
                                    {typeof value === 'object' && value !== null
                                      ? JSON.stringify(value)
                                      : String(value)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      {/* Note: Users can ask AI about selected entity directly in the AI panel */}
                    </div>
                  )}

                  {/* Graph Stats */}
                  <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                    <h3 className="font-semibold text-slate-800 mb-2">
                      {searchQuery ? 'Filtered Stats' : 'Graph Stats'}
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-slate-50 rounded p-2">
                        <div className="text-2xl font-bold text-[#33a852]">{filteredEntities.length}</div>
                        <div className="text-slate-500">
                          Entities{searchQuery && ` (of ${entities.length})`}
                        </div>
                      </div>
                      <div className="bg-slate-50 rounded p-2">
                        <div className="text-2xl font-bold text-[#2d9944]">{filteredRelationships.length}</div>
                        <div className="text-slate-500">
                          Relationships{searchQuery && ` (of ${relationships.length})`}
                        </div>
                      </div>
                    </div>

                    {/* Entity type breakdown */}
                    {stats?.entitiesByType && (
                      <div className="mt-4 pt-3 border-t border-slate-100">
                        <h4 className="text-xs font-medium text-slate-500 uppercase mb-2">By Type</h4>
                        <div className="space-y-1">
                          {Object.entries(stats.entitiesByType)
                            .filter(([, count]) => count > 0)
                            .sort(([, a], [, b]) => b - a)
                            .map(([type, count]) => (
                              <div key={type} className="flex justify-between text-sm">
                                <span className="capitalize text-slate-600">{type}</span>
                                <span className="font-medium text-slate-800">{count}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Quick Actions */}
                  <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                    <h3 className="font-semibold text-slate-800 mb-2">Quick Actions</h3>
                    <div className="space-y-2">
                      <button
                        onClick={() => setShowHelp(true)}
                        className="w-full text-left px-3 py-2 text-sm bg-[#33a852]/10 text-[#33a852] rounded-lg hover:bg-[#33a852]/20 transition-colors font-medium"
                      >
                        View help & tips
                      </button>
                      <div className="text-xs text-slate-500 mt-2">
                        Use the AI panel on the left to ask questions about entities, relationships, or the graph structure.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Map Panel (conditional) */}
            {showMap && (
              <div className="w-1/3 border-l border-slate-200">
                <SharedMapPanel
                  mapCommand={mapCommand || undefined}
                  position="right"
                  expandedWidth="33%"
                />
              </div>
            )}
          </div>

          {/* Map Toggle Button */}
          <MapToggleButton
            isMapVisible={showMap}
            onToggle={() => setShowMap(!showMap)}
            position="bottom-right"
          />
        </div>
      </div>
    </React.Fragment>
  );
}

export default function KnowledgeGraphPage() {
  return (
    <ErrorBoundary fallbackTitle="Knowledge Graph Error">
      <KnowledgeGraphPageContent />
    </ErrorBoundary>
  );
}
