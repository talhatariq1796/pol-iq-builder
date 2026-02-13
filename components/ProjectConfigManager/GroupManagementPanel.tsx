'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { 
  FolderTree, 
  FolderPlus, 
  FolderEdit,
  FolderX,
  Layers,
  Users,
  Settings,
  Palette,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Plus,
  Trash2,
  Copy,
  Wand2,
  Target,
  BarChart3,
  AlertCircle,
  CheckCircle,
  Info,
  Search,
  Filter,
  Download,
  Upload,
  Lightbulb
} from 'lucide-react';

import { 
  ProjectConfiguration, 
  ConfigurationChange, 
  ValidationError,
  LayerGroupConfiguration,
  EnhancedLayerConfig,
  ServiceDerivedLayer
} from '@/types/project-config';

interface GroupManagementPanelProps {
  config: ProjectConfiguration;
  onChange: (config: ProjectConfiguration, change: ConfigurationChange) => void;
  validationErrors: ValidationError[];
}

interface GroupStats {
  totalLayers: number;
  activeLayers: number;
  inactiveLayers: number;
  avgQueryFrequency: number;
  lastUsed: string;
  dataSize: number;
}

interface SmartGroupSuggestion {
  id: string;
  name: string;
  description: string;
  layers: string[];
  confidence: number;
  reasoning: string;
  category: 'semantic' | 'usage' | 'source' | 'geographic';
}

interface DragState {
  isDragging: boolean;
  draggedItem: { type: 'layer' | 'group'; id: string } | null;
  dropTarget: string | null;
}

export const GroupManagementPanel: React.FC<GroupManagementPanelProps> = ({
  config,
  onChange,
  validationErrors
}) => {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [dragState, setDragState] = useState<DragState>({ isDragging: false, draggedItem: null, dropTarget: null });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showUngrouped, setShowUngrouped] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('organization');
  const [smartSuggestions, setSmartSuggestions] = useState<SmartGroupSuggestion[]>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);

  // Get all layers as an array
  const layers = useMemo(() => {
    return Object.values(config.layers);
  }, [config.layers]);

  // Get ungrouped layers
  const ungroupedLayers = useMemo(() => {
    const groupedLayerIds = new Set(config.groups?.flatMap(g => g.layers) || []);
    return layers.filter(layer => !groupedLayerIds.has(layer.id));
  }, [layers, config.groups]);

  // Filter groups based on search and category
  const filteredGroups = useMemo(() => {
    if (!config.groups) return [];
    
    return config.groups.filter(group => {
      const matchesSearch = group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          group.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = filterCategory === 'all' || 
                            group.customProperties?.category === filterCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [config.groups, searchTerm, filterCategory]);

  // Calculate group statistics
  const getGroupStats = useCallback((group: LayerGroupConfiguration): GroupStats => {
    const groupLayers = group.layers.map(layerId => config.layers[layerId]).filter(Boolean);
    
    return {
      totalLayers: groupLayers.length,
      activeLayers: groupLayers.filter(l => l.status === 'active').length,
      inactiveLayers: groupLayers.filter(l => l.status === 'inactive').length,
      avgQueryFrequency: groupLayers.reduce((sum, l) => sum + (l.usage?.queryFrequency || 0), 0) / groupLayers.length || 0,
      lastUsed: groupLayers.reduce((latest, l) => {
        const layerDate = l.usage?.lastUsed || '1970-01-01';
        return layerDate > latest ? layerDate : latest;
      }, '1970-01-01'),
      dataSize: groupLayers.reduce((sum, l) => sum + (l.metadata?.estimatedSize || 0), 0)
    };
  }, [config.layers]);

  // Handle group updates
  const handleGroupUpdate = useCallback((groupId: string, updates: Partial<LayerGroupConfiguration>) => {
    const updatedGroups = (config.groups || []).map(group => 
      group.id === groupId ? { ...group, ...updates } : group
    );

    const newConfig = { ...config, groups: updatedGroups };
    onChange(newConfig, {
      type: 'modify',
      target: 'group',
      path: `groups.${groupId}`,
      oldValue: config.groups?.find(g => g.id === groupId),
      newValue: updatedGroups.find(g => g.id === groupId)
    });
  }, [config, onChange]);

  // Create new group
  const handleCreateGroup = useCallback((name: string, description?: string) => {
    const newGroup: LayerGroupConfiguration = {
      id: `group_${Date.now()}`,
      name,
      description: description || '',
      layers: [],
      isCollapsed: false,
      priority: (config.groups?.length || 0) + 1,
      customProperties: {
        category: 'custom',
        createdAt: new Date().toISOString()
      }
    };

    const updatedGroups = [...(config.groups || []), newGroup];
    const newConfig = { ...config, groups: updatedGroups };
    
    onChange(newConfig, {
      type: 'add',
      target: 'group',
      path: `groups.${newGroup.id}`,
      oldValue: null,
      newValue: newGroup
    });

    setSelectedGroupId(newGroup.id);
  }, [config, onChange]);

  // Delete group
  const handleDeleteGroup = useCallback((groupId: string) => {
    if (!confirm('Are you sure you want to delete this group? Layers will become ungrouped.')) return;

    const updatedGroups = (config.groups || []).filter(g => g.id !== groupId);
    const newConfig = { ...config, groups: updatedGroups };
    
    onChange(newConfig, {
      type: 'remove',
      target: 'group',
      path: `groups.${groupId}`,
      oldValue: config.groups?.find(g => g.id === groupId),
      newValue: null
    });

    if (selectedGroupId === groupId) {
      setSelectedGroupId(null);
    }
  }, [config, onChange, selectedGroupId]);

  // Move layer to group
  const handleMoveLayerToGroup = useCallback((layerId: string, targetGroupId: string | null) => {
    const updatedGroups = (config.groups || []).map(group => ({
      ...group,
      layers: group.layers.filter(id => id !== layerId)
    }));

    if (targetGroupId) {
      const targetGroup = updatedGroups.find(g => g.id === targetGroupId);
      if (targetGroup) {
        targetGroup.layers.push(layerId);
      }
    }

    const newConfig = { ...config, groups: updatedGroups };
    onChange(newConfig, {
      type: 'modify',
      target: 'group',
      path: 'groups',
      oldValue: config.groups,
      newValue: updatedGroups
    });
  }, [config, onChange]);

  // Generate smart grouping suggestions
  const generateSmartSuggestions = useCallback(async () => {
    setIsGeneratingSuggestions(true);
    
    try {
      // Simulate AI-powered grouping suggestions
      const suggestions: SmartGroupSuggestion[] = [];
      
      // Semantic grouping based on layer names
      const demographicLayers = layers.filter(l => 
        l.name.toLowerCase().includes('population') || 
        l.name.toLowerCase().includes('demographic') ||
        l.name.toLowerCase().includes('census')
      );
      
      if (demographicLayers.length >= 2) {
        suggestions.push({
          id: 'semantic_demographics',
          name: 'Demographics',
          description: 'Population and demographic data layers',
          layers: demographicLayers.map(l => l.id),
          confidence: 0.92,
          reasoning: 'Layers contain demographic and population-related terms',
          category: 'semantic'
        });
      }

      // Usage-based grouping
      const highUsageLayers = layers.filter(l => (l.usage?.queryFrequency || 0) > 0.5);
      if (highUsageLayers.length >= 3) {
        suggestions.push({
          id: 'usage_frequent',
          name: 'Frequently Used',
          description: 'Most commonly queried layers',
          layers: highUsageLayers.map(l => l.id),
          confidence: 0.85,
          reasoning: 'Layers have high query frequency (>0.5)',
          category: 'usage'
        });
      }

      // Source-based grouping
      const serviceGroups = new Map<string, string[]>();
      layers.forEach(layer => {
        if ('serviceId' in layer) {
          const serviceLayer = layer as ServiceDerivedLayer;
          const serviceId = serviceLayer.serviceId;
          if (!serviceGroups.has(serviceId)) {
            serviceGroups.set(serviceId, []);
          }
          serviceGroups.get(serviceId)!.push(layer.id);
        }
      });

      serviceGroups.forEach((layerIds, serviceId) => {
        if (layerIds.length >= 3) {
          const service = config.services?.arcgis?.find(s => s.id === serviceId);
          suggestions.push({
            id: `source_${serviceId}`,
            name: service?.name || `Service ${serviceId}`,
            description: `All layers from ${service?.name || 'this service'}`,
            layers: layerIds,
            confidence: 0.88,
            reasoning: 'Layers originate from the same ArcGIS service',
            category: 'source'
          });
        }
      });

      setSmartSuggestions(suggestions);
    } catch (error) {
      console.error('Error generating suggestions:', error);
    } finally {
      setIsGeneratingSuggestions(false);
    }
  }, [layers, config.services]);

  // Apply smart suggestion
  const applySuggestion = useCallback((suggestion: SmartGroupSuggestion) => {
    handleCreateGroup(suggestion.name, suggestion.description);
    
    // Move suggested layers to the new group
    setTimeout(() => {
      const newGroupId = `group_${Date.now()}`;
      suggestion.layers.forEach(layerId => {
        handleMoveLayerToGroup(layerId, newGroupId);
      });
    }, 100);
  }, [handleCreateGroup, handleMoveLayerToGroup]);

  // Drag and drop handlers
  const handleDragStart = useCallback((type: 'layer' | 'group', id: string) => {
    setDragState({
      isDragging: true,
      draggedItem: { type, id },
      dropTarget: null
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragState((prev: DragState) => ({ ...prev, dropTarget: targetId }));
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetGroupId: string | null) => {
    e.preventDefault();
    
    if (dragState.draggedItem?.type === 'layer') {
      handleMoveLayerToGroup(dragState.draggedItem.id, targetGroupId);
    }
    
    setDragState({ isDragging: false, draggedItem: null, dropTarget: null });
  }, [dragState.draggedItem, handleMoveLayerToGroup]);

  const handleDragEnd = useCallback(() => {
    setDragState({ isDragging: false, draggedItem: null, dropTarget: null });
  }, []);

  // Toggle group expansion
  const toggleGroupExpansion = useCallback((groupId: string) => {
    setExpandedGroups((prev: Set<string>) => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  }, []);

  // Get selected group
  const selectedGroup = useMemo(() => {
    return selectedGroupId ? config.groups?.find(g => g.id === selectedGroupId) : null;
  }, [selectedGroupId, config.groups]);

  // Auto-generate suggestions on component mount
  useEffect(() => {
    if (layers.length > 0 && smartSuggestions.length === 0) {
      generateSmartSuggestions();
    }
  }, [layers.length, smartSuggestions.length, generateSmartSuggestions]);

  const renderGroupOrganization = () => (
    <div className="space-y-6">
      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Group Discovery
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search groups..."
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="demographics">Demographics</SelectItem>
                  <SelectItem value="economic">Economic</SelectItem>
                  <SelectItem value="environmental">Environmental</SelectItem>
                  <SelectItem value="infrastructure">Infrastructure</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="flex items-center space-x-2">
                <Switch
                  checked={showUngrouped}
                  onCheckedChange={setShowUngrouped}
                />
                <Label>Show Ungrouped</Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Group List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Groups */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FolderTree className="h-5 w-5" />
                Groups ({filteredGroups.length})
              </CardTitle>
              <Button
                size="sm"
                onClick={() => {
                  const name = prompt('Group name:');
                  if (name) {
                    const description = prompt('Group description (optional):');
                    handleCreateGroup(name, description || undefined);
                  }
                }}
              >
                <FolderPlus className="h-4 w-4 mr-1" />
                New Group
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredGroups.map(group => {
                const stats = getGroupStats(group);
                const isExpanded = expandedGroups.has(group.id);
                const isSelected = selectedGroupId === group.id;
                const errors = validationErrors.filter(e => e.path.includes(`groups.${group.id}`));
                
                return (
                  <div key={group.id} className="space-y-2">
                    <div
                      className={`p-3 border rounded-lg cursor-pointer transition-all ${
                        isSelected ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                      } ${dragState.dropTarget === group.id ? 'border-green-500 bg-green-50' : ''}`}
                      onClick={() => setSelectedGroupId(group.id)}
                      onDragOver={(e) => handleDragOver(e, group.id)}
                      onDrop={(e) => handleDrop(e, group.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-0 h-auto"
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              toggleGroupExpansion(group.id);
                            }}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium truncate">{group.name}</h4>
                              <Badge variant="outline" className="text-xs">
                                {stats.totalLayers}
                              </Badge>
                              {group.color && (
                                <div 
                                  className="w-3 h-3 rounded-full border"
                                  style={{ backgroundColor: group.color }}
                                />
                              )}
                            </div>
                            <p className="text-sm text-gray-500 truncate">{group.description}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant={stats.activeLayers > 0 ? 'default' : 'secondary'} className="text-xs">
                                {stats.activeLayers} active
                              </Badge>
                              {stats.avgQueryFrequency > 0.5 && (
                                <Badge variant="outline" className="text-xs">
                                  High Usage
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          {errors.length > 0 && (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          )}
                          <GripVertical className="h-4 w-4 text-gray-400" />
                        </div>
                      </div>
                    </div>

                    {/* Expanded Group Layers */}
                    {isExpanded && (
                      <div className="ml-6 space-y-1">
                        {group.layers.map(layerId => {
                          const layer = config.layers[layerId];
                          if (!layer) return null;
                          
                          return (
                            <div
                              key={layerId}
                              className="p-2 bg-gray-50 rounded border text-sm flex items-center justify-between"
                              draggable
                              onDragStart={() => handleDragStart('layer', layerId)}
                              onDragEnd={handleDragEnd}
                            >
                              <div className="flex items-center gap-2">
                                <Layers className="h-3 w-3" />
                                <span className="truncate">{layer.name}</span>
                                <Badge variant={layer.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                                  {layer.status}
                                </Badge>
                              </div>
                              <GripVertical className="h-3 w-3 text-gray-400" />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              
              {filteredGroups.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <FolderTree className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p>No groups found</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      const name = prompt('Group name:');
                      if (name) handleCreateGroup(name);
                    }}
                  >
                    Create First Group
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Ungrouped Layers */}
        {showUngrouped && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Ungrouped Layers ({ungroupedLayers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                className={`space-y-2 max-h-96 overflow-y-auto p-2 border-2 border-dashed rounded-lg ${
                  dragState.dropTarget === null ? 'border-gray-300 bg-gray-50' : 'border-blue-500 bg-blue-50'
                }`}
                onDragOver={(e) => handleDragOver(e, 'ungrouped')}
                onDrop={(e) => handleDrop(e, null)}
              >
                {ungroupedLayers.map(layer => (
                  <div
                    key={layer.id}
                    className="p-2 bg-white rounded border text-sm flex items-center justify-between hover:bg-gray-50"
                    draggable
                    onDragStart={() => handleDragStart('layer', layer.id)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="flex items-center gap-2">
                      <Layers className="h-3 w-3" />
                      <span className="truncate">{layer.name}</span>
                      <Badge variant={layer.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                        {layer.status}
                      </Badge>
                    </div>
                    <GripVertical className="h-3 w-3 text-gray-400" />
                  </div>
                ))}
                
                {ungroupedLayers.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    <p className="text-sm">All layers are grouped!</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );

  const renderGroupConfiguration = () => {
    if (!selectedGroup) {
      return (
        <Card>
          <CardContent className="p-8 text-center">
            <FolderTree className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Select a group to configure its properties</p>
          </CardContent>
        </Card>
      );
    }

    const stats = getGroupStats(selectedGroup);

    return (
      <div className="space-y-6">
        {/* Group Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FolderEdit className="h-5 w-5" />
                  {selectedGroup.name}
                </CardTitle>
                <p className="text-gray-600 mt-1">{selectedGroup.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newName = `${selectedGroup.name} (Copy)`;
                    handleCreateGroup(newName, selectedGroup.description);
                  }}
                >
                  <Copy className="h-4 w-4" />
                  Duplicate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteGroup(selectedGroup.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          </CardHeader>
          
          {/* Group Statistics */}
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.totalLayers}</div>
                <div className="text-sm text-gray-500">Total Layers</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.activeLayers}</div>
                <div className="text-sm text-gray-500">Active</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{stats.avgQueryFrequency.toFixed(2)}</div>
                <div className="text-sm text-gray-500">Avg Usage</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{Math.round(stats.dataSize / 1024)} KB</div>
                <div className="text-sm text-gray-500">Est. Size</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Group Properties */}
        <Card>
          <CardHeader>
            <CardTitle>Group Properties</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="group-name">Group Name</Label>
                <Input
                  id="group-name"
                  value={selectedGroup.name}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleGroupUpdate(selectedGroup.id, { name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="group-priority">Priority</Label>
                <Input
                  id="group-priority"
                  type="number"
                  value={selectedGroup.priority}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleGroupUpdate(selectedGroup.id, { priority: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="group-description">Description</Label>
              <Textarea
                id="group-description"
                value={selectedGroup.description || ''}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleGroupUpdate(selectedGroup.id, { description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="group-color">Group Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="group-color"
                    type="color"
                    value={selectedGroup.color || '#3b82f6'}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleGroupUpdate(selectedGroup.id, { color: e.target.value })}
                    className="w-16"
                  />
                  <Input
                    value={selectedGroup.color || '#3b82f6'}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleGroupUpdate(selectedGroup.id, { color: e.target.value })}
                    placeholder="#3b82f6"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="group-icon">Icon</Label>
                <Select
                  value={selectedGroup.icon || 'folder'}
                  onValueChange={(value) => handleGroupUpdate(selectedGroup.id, { icon: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="folder">📁 Folder</SelectItem>
                    <SelectItem value="layers">📊 Layers</SelectItem>
                    <SelectItem value="users">👥 Users</SelectItem>
                    <SelectItem value="settings">⚙️ Settings</SelectItem>
                    <SelectItem value="chart">📈 Chart</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={!selectedGroup.isCollapsed}
                  onCheckedChange={(checked: boolean) => handleGroupUpdate(selectedGroup.id, { isCollapsed: !checked })}
                />
                <Label>Expanded by Default</Label>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderSmartGrouping = () => (
    <div className="space-y-6">
      {/* Smart Suggestions Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              Smart Grouping Suggestions
            </CardTitle>
            <Button
              onClick={generateSmartSuggestions}
              disabled={isGeneratingSuggestions}
            >
              {isGeneratingSuggestions ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  Analyzing...
                </div>
              ) : (
                <>
                  <Lightbulb className="h-4 w-4 mr-1" />
                  Generate Suggestions
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            AI-powered analysis of your layers to suggest optimal grouping strategies based on semantic similarity, 
            usage patterns, data sources, and geographic relationships.
          </p>
        </CardContent>
      </Card>

      {/* Suggestions List */}
      <div className="space-y-4">
        {smartSuggestions.map(suggestion => (
          <Card key={suggestion.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium">{suggestion.name}</h4>
                    <Badge variant="outline" className="text-xs">
                      {suggestion.category}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <Progress value={suggestion.confidence * 100} className="w-16 h-2" />
                      <span className="text-xs text-gray-500">{Math.round(suggestion.confidence * 100)}%</span>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-2">{suggestion.description}</p>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs">
                      {suggestion.layers.length} layers
                    </Badge>
                    <span className="text-xs text-gray-500">{suggestion.reasoning}</span>
                  </div>
                  
                  <div className="flex flex-wrap gap-1">
                    {suggestion.layers.slice(0, 5).map(layerId => {
                      const layer = config.layers[layerId];
                      return layer ? (
                        <Badge key={layerId} variant="secondary" className="text-xs">
                          {layer.name}
                        </Badge>
                      ) : null;
                    })}
                    {suggestion.layers.length > 5 && (
                      <Badge variant="secondary" className="text-xs">
                        +{suggestion.layers.length - 5} more
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applySuggestion(suggestion)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Apply
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {smartSuggestions.length === 0 && !isGeneratingSuggestions && (
          <Card>
            <CardContent className="p-8 text-center">
              <Lightbulb className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No smart suggestions available yet</p>
              <Button onClick={generateSmartSuggestions}>
                <Wand2 className="h-4 w-4 mr-1" />
                Generate Suggestions
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );

  const renderGroupAnalytics = () => (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{config.groups?.length || 0}</div>
            <div className="text-sm text-gray-500">Total Groups</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{ungroupedLayers.length}</div>
            <div className="text-sm text-gray-500">Ungrouped Layers</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">
              {config.groups?.reduce((sum, g) => sum + g.layers.length, 0) || 0}
            </div>
            <div className="text-sm text-gray-500">Grouped Layers</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {Math.round(((config.groups?.reduce((sum, g) => sum + g.layers.length, 0) || 0) / layers.length) * 100)}%
            </div>
            <div className="text-sm text-gray-500">Organization Rate</div>
          </CardContent>
        </Card>
      </div>

      {/* Group Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Group Performance Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {config.groups?.map(group => {
              const stats = getGroupStats(group);
              const utilizationRate = stats.avgQueryFrequency * 100;
              
              return (
                <div key={group.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{group.name}</h4>
                    <Badge variant={utilizationRate > 50 ? 'default' : 'secondary'}>
                      {utilizationRate.toFixed(1)}% utilization
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-gray-500">Layers</div>
                      <div className="font-medium">{stats.totalLayers}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Active</div>
                      <div className="font-medium text-green-600">{stats.activeLayers}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Last Used</div>
                      <div className="font-medium">{new Date(stats.lastUsed).toLocaleDateString()}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Est. Size</div>
                      <div className="font-medium">{Math.round(stats.dataSize / 1024)} KB</div>
                    </div>
                  </div>
                  
                  <div className="mt-2">
                    <Progress value={utilizationRate} className="h-2" />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="h-full p-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="organization">Organization</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="smart">Smart Grouping</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>
        
        <div className="flex-1 overflow-auto">
          <TabsContent value="organization" className="h-full">
            {renderGroupOrganization()}
          </TabsContent>
          
          <TabsContent value="configuration" className="h-full">
            {renderGroupConfiguration()}
          </TabsContent>
          
          <TabsContent value="smart" className="h-full">
            {renderSmartGrouping()}
          </TabsContent>
          
          <TabsContent value="analytics" className="h-full">
            {renderGroupAnalytics()}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}; 