'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Globe, 
  Layers, 
  Download, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle,
  Eye,
  EyeOff,
  Zap,
  GripVertical,
  Trash2,
  Move,
  FolderOpen,
  Filter,
  Search,
  Plus,
  X,
  Target,
  Users,
  ShoppingCart
} from 'lucide-react';

import { ArcGISService, ServiceDerivedLayer, LayerGroupConfiguration } from '@/types/project-config';
import { arcgisServiceManager, ArcGISServiceInfo } from '@/services/arcgis-service-manager';

interface AdvancedServiceManagerProps {
  services: ArcGISService[];
  layers: ServiceDerivedLayer[];
  groups: LayerGroupConfiguration[];
  onServiceAdded: (service: ArcGISService) => void;
  onServiceUpdated: (service: ArcGISService) => void;
  onServiceRemoved: (serviceId: string) => void;
  onLayersGenerated: (layers: ServiceDerivedLayer[]) => void;
  onLayersUpdated: (layers: ServiceDerivedLayer[]) => void;
  onLayerAdded: (layer: ServiceDerivedLayer) => void;
  onLayerRemoved: (layerId: string) => void;
  onLayerGroupChanged: (layerId: string, newGroupId: string) => void;
  onGroupsUpdated: (groups: LayerGroupConfiguration[]) => void;
}

export const AdvancedServiceManager: React.FC<AdvancedServiceManagerProps> = ({
  services,
  layers,
  groups,
  onServiceAdded,
  onServiceUpdated,
  onServiceRemoved,
  onLayersGenerated,
  onLayersUpdated,
  onLayerAdded,
  onLayerRemoved,
  onLayerGroupChanged,
  onGroupsUpdated
}) => {
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryUrl, setDiscoveryUrl] = useState('');
  const [discoveryResult, setDiscoveryResult] = useState<ArcGISServiceInfo | { error: string } | null>(null);
  const [selectedService, setSelectedService] = useState<string>('all');
  const [selectedLayers, setSelectedLayers] = useState<Set<string>>(new Set());
  const [draggedLayer, setDraggedLayer] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('services');
  const [newGroupName, setNewGroupName] = useState<string>('');

  // Memoized filtered layers
  const filteredLayers = useMemo(() => {
    return layers.filter(layer => {
      const matchesSearch = layer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          layer.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesGroup = filterGroup === 'all' || layer.group === filterGroup;
      const matchesStatus = filterStatus === 'all' || layer.status === filterStatus;
      const matchesService = selectedService === 'all' || layer.serviceId === selectedService;
      
      return matchesSearch && matchesGroup && matchesStatus && matchesService;
    });
  }, [layers, searchTerm, filterGroup, filterStatus, selectedService]);

  // Group layers by group for display
  const layersByGroup = useMemo(() => {
    const grouped: Record<string, ServiceDerivedLayer[]> = {};
    
    groups.forEach(group => {
      grouped[group.id] = filteredLayers.filter(layer => layer.group === group.id);
    });
    
    // Add ungrouped layers
    const ungroupedLayers = filteredLayers.filter(layer => 
      !groups.some(group => group.id === layer.group)
    );
    if (ungroupedLayers.length > 0) {
      grouped['ungrouped'] = ungroupedLayers;
    }
    
    return grouped;
  }, [filteredLayers, groups]);

  const handleDiscoverService = useCallback(async () => {
    if (!discoveryUrl.trim()) return;

    setIsDiscovering(true);
    try {
      const serviceInfo = await arcgisServiceManager.discoverService(discoveryUrl);
      setDiscoveryResult(serviceInfo);
    } catch (error) {
      console.error('Service discovery failed:', error);
      
      // Handle different error types
      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        // Handle ArcGIS API error objects
        if ('message' in error) {
          errorMessage = String(error.message);
        } else if ('details' in error) {
          errorMessage = String(error.details);
        } else {
          errorMessage = JSON.stringify(error);
        }
      } else {
        errorMessage = String(error);
      }
      
      setDiscoveryResult({ error: errorMessage });
    } finally {
      setIsDiscovering(false);
    }
  }, [discoveryUrl]);

  const handleAddService = useCallback(async () => {
    if (!discoveryResult || 'error' in discoveryResult) return;

    try {
      const service = await arcgisServiceManager.createServiceConfiguration(discoveryUrl, {
        name: discoveryResult.name || `Service ${Date.now()}`,
        description: discoveryResult.serviceDescription,
        defaultGroup: 'service-layers'
      });

      onServiceAdded(service);
      
      // Auto-generate layers for the new service
      const layers = await arcgisServiceManager.generateLayersFromService(service, {
        autoGenerateGroups: true
      });
      onLayersGenerated(layers);
      
      setDiscoveryResult(null);
      setDiscoveryUrl('');
      setSelectedService(service.id);
    } catch (error) {
      console.error('Failed to add service:', error);
    }
  }, [discoveryUrl, discoveryResult, onServiceAdded, onLayersGenerated]);

  const handleRemoveService = useCallback(async (serviceId: string) => {
    if (!confirm('Remove this service and all its layers?')) return;
    
    // Remove all layers from this service
    const serviceLayers = layers.filter(layer => layer.serviceId === serviceId);
    serviceLayers.forEach(layer => onLayerRemoved(layer.id));
    
    // Remove the service
    onServiceRemoved(serviceId);
    
    if (selectedService === serviceId) {
      setSelectedService('all');
    }
  }, [layers, onLayerRemoved, onServiceRemoved, selectedService]);

  const handleBulkLayerOperation = useCallback((operation: string, layerIds?: string[]) => {
    const targetLayers = layerIds || Array.from(selectedLayers);
    if (targetLayers.length === 0) return;

    const updatedLayers = layers.map(layer => {
      if (!targetLayers.includes(layer.id)) return layer;

      switch (operation) {
        case 'activate':
          return { ...layer, status: 'active' as const };
        case 'deactivate':
          return { ...layer, status: 'inactive' as const };
        case 'remove':
          return null;
        default:
          return layer;
      }
    }).filter(Boolean) as ServiceDerivedLayer[];

    if (operation === 'remove') {
      targetLayers.forEach(layerId => onLayerRemoved(layerId));
    } else {
      onLayersUpdated(updatedLayers);
    }

    setSelectedLayers(new Set());
  }, [layers, selectedLayers, onLayersUpdated, onLayerRemoved]);

  const handleMoveToGroup = useCallback((layerIds: string[], groupId: string) => {
    layerIds.forEach(layerId => onLayerGroupChanged(layerId, groupId));
    setSelectedLayers(new Set());
  }, [onLayerGroupChanged]);

  // Drag and Drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, layerId: string) => {
    setDraggedLayer(layerId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    if (draggedLayer) {
      onLayerGroupChanged(draggedLayer, groupId);
      setDraggedLayer(null);
    }
  }, [draggedLayer, onLayerGroupChanged]);

  const handleLayerSelection = useCallback((layerId: string, checked: boolean) => {
    const newSelection = new Set(selectedLayers);
    if (checked) {
      newSelection.add(layerId);
    } else {
      newSelection.delete(layerId);
    }
    setSelectedLayers(newSelection);
  }, [selectedLayers]);

  const getServiceStats = (service: ArcGISService) => {
    const serviceLayers = layers.filter(l => l.serviceId === service.id);
    const activeCount = serviceLayers.filter(l => l.status === 'active').length;
    const groups = [...new Set(serviceLayers.map(l => l.group))];
    
    return {
      totalLayers: serviceLayers.length,
      activeLayers: activeCount,
      groups: groups.length,
      lastSynced: service.layerDiscovery.lastDiscovered
    };
  };

  return (
    <div className="space-y-6 p-4">
      {/* Debug Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-bold text-blue-800 mb-2">🔧 Advanced Service Manager</h3>
        <div className="text-sm text-blue-600 space-y-1">
          <p>Services: {services.length} | Layers: {layers.length} | Groups: {groups.length}</p>
          <p>Active Tab: {activeTab} | Selected Service: {selectedService || 'None'}</p>
          <p>Component Status: ✅ Rendering Successfully</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="layers">Layer Management</TabsTrigger>
          <TabsTrigger value="groups">Group Management</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Operations</TabsTrigger>
        </TabsList>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Add New Service
              </CardTitle>
              <CardDescription>
                Discover and add ArcGIS FeatureServers to your project
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="service-url">Service URL</Label>
                <Input
                  id="service-url"
                  placeholder="https://services8.arcgis.com/.../FeatureServer"
                  value={discoveryUrl}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDiscoveryUrl(e.target.value)}
                />
                <div className="text-xs text-gray-500">
                  <p>💡 Try this sample URL:</p>
                  <div className="space-y-1">
                    <button 
                      type="button"
                      className="text-blue-600 hover:text-blue-800 underline text-xs block"
                      onClick={() => setDiscoveryUrl('https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/ArcGIS/rest/services/VFR_Navigation_Landmarks/FeatureServer')}
                    >
                      VFR Navigation Landmarks (FAA)
                    </button>
                    <button 
                      type="button"
                      className="text-blue-600 hover:text-blue-800 underline text-xs block"
                      onClick={() => setDiscoveryUrl('https://services9.arcgis.com/RHVPKKiFTONKtxq3/ArcGIS/rest/services/Active_Hurricanes_v1/FeatureServer')}
                    >
                      Active Hurricanes (NOAA)
                    </button>
                    <button 
                      type="button"
                      className="text-blue-600 hover:text-blue-800 underline text-xs block"
                      onClick={() => setDiscoveryUrl('https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/ArcGIS/rest/services/Pending_ChangeOver/FeatureServer')}
                    >
                      Aviation Changeover Points (FAA)
                    </button>
                  </div>
                </div>
              </div>

              <Button 
                onClick={handleDiscoverService} 
                disabled={isDiscovering || !discoveryUrl.trim()}
                className="w-full"
              >
                {isDiscovering ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Discovering...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Discover Service
                  </>
                )}
              </Button>

              {discoveryResult && (
                <div className="mt-4">
                  {'error' in discoveryResult ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Discovery Failed:</strong> {discoveryResult.error}
                        {discoveryResult.error.includes('Token Required') && (
                          <div className="mt-2 text-sm">
                            <p className="font-medium">💡 This service requires authentication.</p>
                            <p>Try one of the public sample services above instead.</p>
                          </div>
                        )}
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Service Found!</CardTitle>
                        <CardDescription>{discoveryResult.serviceDescription || 'No description available'}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <p className="text-sm font-medium">Layers Found</p>
                            <p className="text-2xl font-bold text-green-600">
                              {discoveryResult.layers?.length || 0}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium">Max Records</p>
                            <p className="text-2xl font-bold text-blue-600">
                              {discoveryResult.maxRecordCount?.toLocaleString() || 'N/A'}
                            </p>
                          </div>
                        </div>

                        <Button onClick={handleAddService} className="w-full">
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Add Service & Generate Layers
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Existing Services */}
          <div className="grid gap-4">
            {services.map((service) => {
              const stats = getServiceStats(service);
              return (
                <Card key={service.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Layers className="h-5 w-5" />
                          {service.name}
                        </CardTitle>
                        <CardDescription>{service.description}</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedService(selectedService === service.id ? 'all' : service.id)}
                        >
                          <Filter className="h-4 w-4" />
                          {selectedService === service.id ? 'Show All' : 'Filter'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveService(service.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">{stats.totalLayers}</p>
                        <p className="text-xs text-gray-500">Total Layers</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">{stats.activeLayers}</p>
                        <p className="text-xs text-gray-500">Active</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-purple-600">{stats.groups}</p>
                        <p className="text-xs text-gray-500">Groups</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium">
                          {service.layerDiscovery.layerCount || 0}
                        </p>
                        <p className="text-xs text-gray-500">Service Layers</p>
                      </div>
                    </div>

                    <div className="text-xs text-gray-500 mb-2">
                      <p><strong>Service URL:</strong> {service.baseUrl}</p>
                      <p><strong>Last Synced:</strong> {stats.lastSynced ? new Date(stats.lastSynced).toLocaleString() : 'Never'}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Layer Management Tab */}
        <TabsContent value="layers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Layer Management
              </CardTitle>
              <CardDescription>
                Manage individual layers, organize into groups, and perform bulk operations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filters and Search */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div>
                  <Label htmlFor="search">Search Layers</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                    <Input
                      id="search"
                      placeholder="Search by name..."
                      value={searchTerm}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="filter-service">Filter by Service</Label>
                  <Select value={selectedService} onValueChange={setSelectedService}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Services" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Services</SelectItem>
                      {services.map(service => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="filter-group">Filter by Group</Label>
                  <Select value={filterGroup} onValueChange={setFilterGroup}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Groups" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Groups</SelectItem>
                      {groups.map(group => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="filter-status">Filter by Status</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="deprecated">Deprecated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Bulk Operations Bar */}
              {selectedLayers.size > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-900">
                        {selectedLayers.size} layer{selectedLayers.size > 1 ? 's' : ''} selected
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Select onValueChange={(groupId) => handleMoveToGroup(Array.from(selectedLayers), groupId)}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Move to group..." />
                        </SelectTrigger>
                        <SelectContent>
                          {groups.map(group => (
                            <SelectItem key={group.id} value={group.id}>
                              <Move className="h-4 w-4 mr-2 inline" />
                              {group.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkLayerOperation('activate')}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Activate
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkLayerOperation('deactivate')}
                      >
                        <EyeOff className="h-4 w-4 mr-1" />
                        Deactivate
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkLayerOperation('remove')}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Layers by Group */}
              <div className="space-y-4">
                {Object.entries(layersByGroup).map(([groupId, groupLayers]) => {
                  const group = groups.find(g => g.id === groupId);
                  const groupName = group?.name || 'Ungrouped';
                  
                  return (
                    <div
                      key={groupId}
                      className="border rounded-lg"
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, groupId)}
                    >
                      <div className="bg-gray-50 px-4 py-2 border-b flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FolderOpen className="h-4 w-4" />
                          <span className="font-medium">{groupName}</span>
                          <Badge variant="outline">{groupLayers.length}</Badge>
                        </div>
                      </div>
                      
                      <div className="p-2 space-y-1">
                        {groupLayers.map(layer => (
                          <div
                            key={layer.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, layer.id)}
                            className={`flex items-center gap-3 p-2 rounded border ${
                              selectedLayers.has(layer.id) ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                            } cursor-move`}
                          >
                            <GripVertical className="h-4 w-4 text-gray-400" />
                            
                            <Checkbox
                              checked={selectedLayers.has(layer.id)}
                              onCheckedChange={(checked: boolean) => handleLayerSelection(layer.id, checked)}
                            />
                            
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{layer.name}</p>
                              <p className="text-xs text-gray-500 truncate">{layer.description}</p>
                            </div>
                            
                            <Badge variant={layer.status === 'active' ? 'default' : 'secondary'}>
                              {layer.status}
                            </Badge>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onLayerRemoved(layer.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                        
                        {groupLayers.length === 0 && (
                          <div className="text-center py-8 text-gray-500">
                            <p className="text-sm">No layers in this group</p>
                            <p className="text-xs">Drag layers here to organize them</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Group Management Tab */}
        <TabsContent value="groups" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Group Management</CardTitle>
              <CardDescription>Create and organize layer groups</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {groups.map(group => (
                  <div key={group.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{group.name}</h4>
                        <p className="text-sm text-gray-500">{group.description}</p>
                      </div>
                      <Badge variant="outline">
                        {layers.filter(l => l.group === group.id).length} layers
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bulk Operations Tab */}
        <TabsContent value="bulk" className="space-y-4">
          {selectedLayers.size > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Bulk Operations
                  <Badge variant="default">{selectedLayers.size} layers selected</Badge>
                </CardTitle>
                <CardDescription>
                  Apply changes to {selectedLayers.size} selected layers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Quick Actions */}
                  <div>
                    <h4 className="font-medium mb-3">Quick Actions</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkLayerOperation('activate')}
                        className="justify-start"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Activate All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkLayerOperation('deactivate')}
                        className="justify-start"
                      >
                        <EyeOff className="h-4 w-4 mr-2" />
                        Deactivate All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkLayerOperation('remove')}
                        className="justify-start text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedLayers(new Set())}
                        className="justify-start"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Clear Selection
                      </Button>
                    </div>
                  </div>

                  {/* Group Assignment */}
                  <div>
                    <h4 className="font-medium mb-3">Group Assignment</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium">Move to existing group:</Label>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {groups.slice(0, 6).map(group => (
                            <Button
                              key={group.id}
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                Array.from(selectedLayers).forEach(layerId => {
                                  onLayerGroupChanged(layerId, group.id);
                                });
                                setSelectedLayers(new Set());
                              }}
                              className="justify-start text-xs"
                            >
                              <FolderOpen className="h-3 w-3 mr-1" />
                              {group.name}
                            </Button>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <Label className="text-sm font-medium">Create new group:</Label>
                        <div className="flex gap-2 mt-2">
                          <Input
                            placeholder="Group name"
                            value={newGroupName}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewGroupName(e.target.value)}
                            className="text-sm"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (newGroupName.trim()) {
                                const newGroup = {
                                  id: `group_${Date.now()}`,
                                  name: newGroupName.trim(),
                                  description: `Auto-created for ${selectedLayers.size} layers`,
                                  layers: Array.from(selectedLayers),
                                  isCollapsed: false,
                                  priority: groups.length + 1
                                };
                                onGroupsUpdated([...groups, newGroup]);
                                setSelectedLayers(new Set());
                                setNewGroupName('');
                              }
                            }}
                            disabled={!newGroupName.trim()}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Create
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Smart Suggestions */}
                  <div>
                    <h4 className="font-medium mb-3">Smart Suggestions</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Group by service
                          const serviceGroups = new Map();
                          Array.from(selectedLayers).forEach(layerId => {
                            const layer = layers.find(l => l.id === layerId);
                            if (layer && 'serviceId' in layer) {
                              const service = services.find(s => s.id === layer.serviceId);
                              if (service) {
                                if (!serviceGroups.has(service.id)) {
                                  serviceGroups.set(service.id, {
                                    name: `${service.name} Layers`,
                                    layers: []
                                  });
                                }
                                serviceGroups.get(service.id).layers.push(layerId);
                              }
                            }
                          });
                          
                          serviceGroups.forEach((groupData, serviceId) => {
                            const newGroup = {
                              id: `service_group_${serviceId}_${Date.now()}`,
                              name: groupData.name,
                              description: `Auto-grouped by service`,
                              layers: groupData.layers,
                              isCollapsed: false,
                              priority: groups.length + 1
                            };
                            onGroupsUpdated([...groups, newGroup]);
                          });
                          
                          setSelectedLayers(new Set());
                        }}
                        className="justify-start text-xs"
                      >
                        <Target className="h-3 w-3 mr-1" />
                        Group by Service
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Group by name similarity
                          const demographicLayers = Array.from(selectedLayers).filter(layerId => {
                            const layer = layers.find(l => l.id === layerId);
                            return layer && (
                              layer.name.toLowerCase().includes('population') ||
                              layer.name.toLowerCase().includes('demographic') ||
                              layer.name.toLowerCase().includes('census')
                            );
                          });
                          
                          if (demographicLayers.length > 0) {
                            const newGroup = {
                              id: `demo_group_${Date.now()}`,
                              name: 'Demographics',
                              description: `Auto-grouped demographic layers`,
                              layers: demographicLayers,
                              isCollapsed: false,
                              priority: groups.length + 1
                            };
                            onGroupsUpdated([...groups, newGroup]);
                            setSelectedLayers(new Set(Array.from(selectedLayers).filter(id => !demographicLayers.includes(id))));
                          }
                        }}
                        className="justify-start text-xs"
                      >
                        <Users className="h-3 w-3 mr-1" />
                        Group Demographics
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Group by sports/consumer data
                          const consumerLayers = Array.from(selectedLayers).filter(layerId => {
                            const layer = layers.find(l => l.id === layerId);
                            return layer && (
                              layer.name.toLowerCase().includes('sports') ||
                              layer.name.toLowerCase().includes('nike') ||
                              layer.name.toLowerCase().includes('adidas') ||
                              layer.name.toLowerCase().includes('spent') ||
                              layer.name.toLowerCase().includes('purchase')
                            );
                          });
                          
                          if (consumerLayers.length > 0) {
                            const newGroup = {
                              id: `consumer_group_${Date.now()}`,
                              name: 'Consumer Behavior',
                              description: `Auto-grouped consumer/sports layers`,
                              layers: consumerLayers,
                              isCollapsed: false,
                              priority: groups.length + 1
                            };
                            onGroupsUpdated([...groups, newGroup]);
                            setSelectedLayers(new Set(Array.from(selectedLayers).filter(id => !consumerLayers.includes(id))));
                          }
                        }}
                        className="justify-start text-xs"
                      >
                        <ShoppingCart className="h-3 w-3 mr-1" />
                        Group Consumer Data
                      </Button>
                    </div>
                  </div>

                  {/* Selected Layers Preview */}
                  <div>
                    <h4 className="font-medium mb-3">Selected Layers</h4>
                    <div className="max-h-48 overflow-y-auto border rounded-lg p-3 bg-gray-50">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {Array.from(selectedLayers).map(layerId => {
                          const layer = layers.find(l => l.id === layerId);
                          return layer ? (
                            <div key={layerId} className="flex items-center gap-2 p-2 bg-white rounded border text-sm">
                              <Checkbox
                                checked={true}
                                onCheckedChange={() => {
                                  const newSelection = new Set(selectedLayers);
                                  newSelection.delete(layerId);
                                  setSelectedLayers(newSelection);
                                }}
                              />
                              <span className="flex-1 truncate">{layer.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {layer.status}
                              </Badge>
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Zap className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Layers Selected</h3>
                <p className="text-gray-500 mb-6">
                  Select layers from the Layer Management tab to perform bulk operations
                </p>
                <Button
                  variant="outline"
                  onClick={() => setActiveTab('layers')}
                >
                  Go to Layer Management
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdvancedServiceManager; 